/**
 * FECLedger Pipeline Worker
 *
 * NOTE: As of 2026-04-16, all FEC bulk file processing has moved to GitHub Actions
 * (scripts/ingest-bulk.js). Both pas2 and indiv files are now ingested there.
 *
 * This Worker's FILES array is now empty — it processes no files on schedule
 * or via the HTTP trigger. It remains deployed for two reasons:
 *   1. The fetch handler (/admin/pipeline/run) is useful for ad-hoc testing.
 *   2. The utility functions (processZip, _stream, filterColsBinary, etc.) are
 *      retained intact in case this Worker is extended for future use cases
 *      (e.g. lightweight on-demand processing of small supplemental files).
 *
 * The weekly cron trigger has been removed from wrangler.toml — there are no
 * files to process on a schedule.
 *
 * Deploy (if changes are needed):
 *   cd pipeline && npm install && npx wrangler deploy
 *
 * Manual trigger (no-op with empty FILES array, useful for health-checking):
 *   curl "https://fecledger-pipeline.sloanestradley.workers.dev/admin/pipeline/run"
 */

// No third-party imports needed — ZIP header is parsed manually and DEFLATE
// decompression uses the native DecompressionStream('deflate-raw') API,
// which is C++ and 10-50× faster than fflate's pure-JS implementation.

// ---------------------------------------------------------------------------
// File manifest
// ---------------------------------------------------------------------------

const FEC_BASE = 'https://www.fec.gov/files/bulk-downloads';

// All file processing has moved to GitHub Actions (scripts/ingest-bulk.js) as of 2026-04-16.
// FILES is empty — this Worker processes no files. See file-level comment for details.
const FILES = [];

// ---------------------------------------------------------------------------
// Column configuration
// ---------------------------------------------------------------------------

// indiv full schema (21 columns, 0-indexed):
//   0  CMTE_ID           6  ENTITY_TP         12 OCCUPATION
//   1  AMNDT_IND         7  NAME              13 TRANSACTION_DT
//   2  RPT_TP            8  CITY              14 TRANSACTION_AMT
//   3  TRANSACTION_PGI   9  STATE             15 OTHER_ID
//   4  IMAGE_NUM        10  ZIP_CODE          16 TRAN_ID
//   5  TRANSACTION_TP   11  EMPLOYER          17 FILE_NUM
//                                             18 MEMO_CD
//                                             19 MEMO_TEXT
//                                             20 SUB_ID
//
// Keeping 14 columns drops ~70% of the uncompressed size.
// MEMO_CD='X' rows (conduit entries — ActBlue, WinRed) are retained as-is.
const INDIV_KEEP_COLS = [0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20];
const INDIV_HEADER    = [
  'CMTE_ID', 'ENTITY_TP', 'NAME', 'CITY', 'STATE', 'ZIP_CODE',
  'EMPLOYER', 'OCCUPATION', 'TRANSACTION_DT', 'TRANSACTION_AMT',
  'OTHER_ID', 'MEMO_CD', 'MEMO_TEXT', 'SUB_ID',
].join('|') + '\n';

// pas2: all 21 columns retained
const PAS2_HEADER = [
  'CMTE_ID', 'AMNDT_IND', 'RPT_TP', 'TRANSACTION_PGI', 'IMAGE_NUM',
  'TRANSACTION_TP', 'ENTITY_TP', 'NAME', 'CITY', 'STATE', 'ZIP_CODE',
  'EMPLOYER', 'OCCUPATION', 'TRANSACTION_DT', 'TRANSACTION_AMT',
  'OTHER_ID', 'TRAN_ID', 'FILE_NUM', 'MEMO_CD', 'MEMO_TEXT', 'SUB_ID',
].join('|') + '\n';

// R2 multipart part size — 10MB (R2 minimum is 5MB; last part may be smaller)
const PART_SIZE = 10 * 1024 * 1024;

const FETCH_HEADERS = { 'User-Agent': 'FECLedger-Pipeline/1.0' };

// ---------------------------------------------------------------------------
// Worker entry points
// ---------------------------------------------------------------------------

export default {
  /**
   * HTTP trigger — manual runs during development.
   *
   * GET /admin/pipeline/run              → trigger all 6 files
   * GET /admin/pipeline/run?file=pas224  → trigger one file by key
   *
   * Returns 202 immediately. Pipeline runs via ctx.waitUntil (background).
   * Note: HTTP Workers have a 30s CPU limit. For large indiv files, use the
   * Cloudflare dashboard → fecledger-pipeline → Triggers → "Test scheduled event"
   * which runs under the 15-minute scheduled CPU limit.
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/admin/pipeline/run') {
      const fileFilter = url.searchParams.get('file') || null;
      ctx.waitUntil(runPipeline(env, fileFilter));
      return new Response(
        JSON.stringify({
          ok:        true,
          triggered: fileFilter || 'all',
          ts:        new Date().toISOString(),
        }),
        { status: 202, headers: { 'Content-Type': 'application/json' } },
      );
    }

    return new Response('FECLedger Pipeline Worker\n', { status: 200 });
  },

  /**
   * Cron trigger — runs every Monday at 6:00 UTC.
   * 15 minutes of CPU time on Workers Paid plan.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runPipeline(env, null));
  },
};

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------

/**
 * Process all files sequentially (or a single file if fileFilter is set).
 * Sequential processing keeps memory below 128MB — only one file active at a time.
 */
async function runPipeline(env, fileFilter) {
  const targets = fileFilter
    ? FILES.filter(f => f.key === fileFilter)
    : FILES;

  if (targets.length === 0) {
    console.error(`[pipeline] unknown file key "${fileFilter}"`);
    return;
  }

  for (const file of targets) {
    console.log(`[pipeline] starting ${file.key}`);
    try {
      await processZip(env, file.url, file.r2key, file.header, file.keepCols);
      console.log(`[pipeline] completed ${file.key}`);
    } catch (err) {
      console.error(`[pipeline] FAILED ${file.key}:`, err);
    }
  }
}

// ---------------------------------------------------------------------------
// Unified streaming processor — all file types
// ---------------------------------------------------------------------------

/**
 * Stream a ZIP from fec.gov, decompress with native DecompressionStream,
 * optionally filter columns in binary, and write to R2 via multipart upload.
 *
 * Why native DecompressionStream instead of fflate:
 *   fflate's pure-JS DEFLATE runs at ~100 MB/s uncompressed output — processing
 *   a 4.5 GB indiv file takes ~45 seconds of CPU, exceeding Cloudflare's limit.
 *   The native C++ implementation runs at ~1-2 GB/s, reducing that to ~2-4 seconds.
 *
 * ZIP header parsing:
 *   ZIP local file header is 30 bytes fixed + variable name/extra fields.
 *   We parse it manually to locate the raw DEFLATE stream, then feed those bytes
 *   directly to DecompressionStream('deflate-raw'). Only standard DEFLATE (method 8)
 *   is supported — data descriptor mode (bit 3 flag) is rejected with a clear error.
 *
 * @param {object}        env       - Worker env (env.BULK = R2 bucket)
 * @param {string}        url       - FEC bulk download URL
 * @param {string}        r2key     - R2 object key
 * @param {string}        headerRow - pipe-delimited header line including \n
 * @param {number[]|null} keepCols  - 0-indexed columns to retain, or null for all
 */
async function processZip(env, url, r2key, headerRow, keepCols) {
  const enc = new TextEncoder(); // needed to encode the header row string

  const upload = await env.BULK.createMultipartUpload(r2key, {
    httpMetadata: { contentType: 'text/csv' },
  });

  try {
    await _stream(upload, url, headerRow, keepCols, enc);
  } catch (err) {
    try { await upload.abort(); } catch (_) { /* ignore abort errors */ }
    throw err;
  }
}

/**
 * Inner streaming implementation.
 *
 * Two processing paths chosen by keepCols:
 *   keepCols = null  (pas2)  — raw passthrough; decompressed bytes written as-is.
 *   keepCols set     (indiv) — filterColsBinary(); O(n) byte scan, no string ops.
 *
 * Async coordination:
 *   A feed coroutine writes compressed bytes to the DecompressionStream writer
 *   concurrently while the main loop reads decompressed chunks. R2 uploadPart
 *   calls are serialized via chainPromise to guarantee part order.
 */
async function _stream(upload, url, headerRow, keepCols, enc) {
  const parts       = [];
  let   partNumber  = 1;
  const headerChunk = enc.encode(headerRow);
  let   bufChunks   = [headerChunk];
  let   bufSize     = headerChunk.length;
  let   carry       = new Uint8Array(0); // partial trailing line (indiv only)
  let   chainPromise = Promise.resolve();

  // Pre-build O(1) lookup for binary column filter
  let keepArr = null;
  if (keepCols) {
    keepArr = new Uint8Array(22); // covers columns 0–20
    keepCols.forEach(i => { keepArr[i] = 1; });
  }

  // --- Fetch ZIP and parse local file header ---
  const resp = await fetch(url, { headers: FETCH_HEADERS });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);

  const netReader = resp.body.getReader();
  let zbuf = new Uint8Array(0);

  // Buffer until we have the 30-byte fixed portion of the local file header
  while (zbuf.length < 30) {
    const { done, value } = await netReader.read();
    if (done) throw new Error('ZIP stream ended before header');
    zbuf = concat(zbuf, value);
  }

  // Verify PK\x03\x04 local file header signature
  if (zbuf[0] !== 0x50 || zbuf[1] !== 0x4B || zbuf[2] !== 0x03 || zbuf[3] !== 0x04) {
    throw new Error(`Invalid ZIP signature: ${[...zbuf.subarray(0,4)].map(b=>b.toString(16)).join(' ')}`);
  }

  const flags      = zbuf[6]  | (zbuf[7]  << 8);
  const comprMethod = zbuf[8] | (zbuf[9]  << 8);
  const nameLen    = zbuf[26] | (zbuf[27] << 8);
  const extraLen   = zbuf[28] | (zbuf[29] << 8);
  const dataStart  = 30 + nameLen + extraLen;
  // Compressed size as unsigned 32-bit int (>>> 0 prevents signed overflow)
  const compressedSize = ((zbuf[18] | (zbuf[19] << 8) | (zbuf[20] << 16) | (zbuf[21] << 24)) >>> 0);

  if (flags & 0x08)    throw new Error('ZIP data descriptor mode not supported (bit 3 flag set)');
  if (comprMethod !== 8) throw new Error(`Unsupported ZIP compression method: ${comprMethod} (expected 8=DEFLATE)`);
  if (compressedSize === 0) throw new Error('ZIP compressed size is 0 — data descriptor mode not supported');

  // Buffer until we have the full variable-length header (name + extra fields)
  while (zbuf.length < dataStart) {
    const { done, value } = await netReader.read();
    if (done) throw new Error('ZIP stream ended in variable header');
    zbuf = concat(zbuf, value);
  }

  // --- Set up backpressure-aware compressed data source ---
  // Using ReadableStream with a pull controller so the decompressor only receives
  // new input when it's ready for it — prevents the internal buffer from growing
  // unboundedly (which caused the Worker memory limit to be exceeded).
  let netWritten = 0;
  const leftover = zbuf.subarray(dataStart, Math.min(zbuf.length, dataStart + compressedSize));

  const compressedStream = new ReadableStream({
    start(controller) {
      if (leftover.length > 0) {
        controller.enqueue(leftover);
        netWritten += leftover.length;
        if (netWritten >= compressedSize) controller.close();
      }
    },
    async pull(controller) {
      if (netWritten >= compressedSize) { controller.close(); return; }
      const { done, value } = await netReader.read();
      if (done) { controller.close(); return; }
      const remaining = compressedSize - netWritten;
      const slice = remaining < value.length ? value.subarray(0, remaining) : value;
      controller.enqueue(slice);
      netWritten += slice.length;
      if (netWritten >= compressedSize) controller.close();
    },
  });

  const dsReader = compressedStream
    .pipeThrough(new DecompressionStream('deflate-raw'))
    .getReader();

  // --- Read decompressed output, filter, accumulate, upload ---
  while (true) {
    const { done, value } = await dsReader.read();
    if (done) break;

    let filtered;
    if (!keepArr) {
      filtered = value; // pas2: raw passthrough
    } else {
      // indiv: binary column filter
      const data = carry.length > 0 ? concat(carry, value) : value;
      let lastNL = -1;
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i] === 0x0A) { lastNL = i; break; }
      }
      const processable = lastNL >= 0 ? data.subarray(0, lastNL + 1) : new Uint8Array(0);
      carry             = lastNL >= 0 ? data.slice(lastNL + 1) : data;
      filtered          = processable.length > 0 ? filterColsBinary(processable, keepArr) : new Uint8Array(0);
    }

    if (filtered.length > 0) { bufChunks.push(filtered); bufSize += filtered.length; }

    while (bufSize >= PART_SIZE) {
      const all      = flattenChunks(bufChunks, bufSize);
      const partData = all.slice(0, PART_SIZE);
      const rest     = all.slice(PART_SIZE);
      bufChunks = [rest];
      bufSize   = rest.length;
      const pn  = partNumber++;
      chainPromise = chainPromise.then(async () => {
        const part = await upload.uploadPart(pn, partData);
        parts.push(part);
        console.log(`[pipeline] part ${pn} (${(partData.length / 1024 / 1024).toFixed(1)} MB)`);
      });
    }
  }

  // Flush partial trailing line (indiv: last line may not end with \n)
  if (carry.length > 0 && keepArr) {
    const lastLine = filterColsBinary(concat(carry, new Uint8Array([0x0A])), keepArr);
    bufChunks.push(lastLine);
    bufSize += lastLine.length;
  }

  // Flush final part
  if (bufSize > 0) {
    const partData = flattenChunks(bufChunks, bufSize);
    const pn       = partNumber++;
    chainPromise   = chainPromise.then(async () => {
      parts.push(await upload.uploadPart(pn, partData));
      console.log(`[pipeline] final part ${pn} (${(partData.length / 1024 / 1024).toFixed(2)} MB)`);
    });
  }

  await chainPromise;

  parts.sort((a, b) => a.partNumber - b.partNumber);
  await upload.complete(parts);
  console.log(`[pipeline] complete: ${parts.length} parts → ${upload.key ?? ''}`);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// Merge an array of Uint8Array chunks into one contiguous buffer.
// Called once per part flush (every 10MB), not on every chunk append.
function flattenChunks(chunks, totalSize) {
  const out = new Uint8Array(totalSize);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

// Binary column filter for pipe-delimited rows.
// data must contain only complete lines (each ending with 0x0A).
// keepArr is a Uint8Array where keepArr[colIndex] === 1 means keep that column.
// Returns a new Uint8Array with only the kept columns, separated by 0x7C.
function filterColsBinary(data, keepArr) {
  const PIPE = 0x7C;
  const NL   = 0x0A;

  const out = new Uint8Array(data.length); // output ≤ input size
  let outPos = 0;
  let col    = 0;
  let colStart       = 0;
  let firstKeptOnLine = true;

  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    if (b === PIPE || b === NL) {
      if (keepArr[col]) {
        if (!firstKeptOnLine) out[outPos++] = PIPE; // separator before this column
        const len = i - colStart;
        out.set(data.subarray(colStart, i), outPos);
        outPos += len;
        firstKeptOnLine = false;
      }
      if (b === NL) {
        out[outPos++]   = NL;
        col             = 0;
        firstKeptOnLine = true;
      } else {
        col++;
      }
      colStart = i + 1;
    }
  }

  return out.subarray(0, outPos);
}
