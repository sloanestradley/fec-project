/**
 * FECLedger Pipeline Worker
 *
 * Downloads FEC bulk ZIP files, strips unused columns, and stores the result
 * as pipe-delimited CSVs in Cloudflare R2.
 *
 * Runs on a weekly cron schedule (Monday 6am UTC — a few hours after FEC's
 * Sunday night refresh). Also exposes a manual HTTP trigger for development.
 *
 * Files processed:
 *   indiv22/24/26.zip  → fec/indiv/{year}/indiv.csv  (14-column subset, streaming)
 *   pas222/224/226.zip → fec/pas2/{year}/pas2.csv    (all columns, in-memory)
 *
 * Deploy:
 *   cd pipeline && npm install && npx wrangler deploy
 *
 * Manual trigger (pas2 files only — indiv files exceed HTTP CPU budget):
 *   curl "https://fecledger-pipeline.<subdomain>.workers.dev/admin/pipeline/run?file=pas224"
 *
 * For indiv files use Cloudflare dashboard → fecledger-pipeline → Test scheduled event
 * (runs under the 15-minute scheduled handler CPU limit, not the 30s HTTP limit).
 */

// ---------------------------------------------------------------------------
// File manifest
// ---------------------------------------------------------------------------

const FEC_BASE = 'https://www.fec.gov/files/bulk-downloads';

const FILES = [
  {
    key:   'indiv22',
    url:   `${FEC_BASE}/2022/indiv22.zip`,
    r2key: 'fec/indiv/2022/indiv.csv',
    type:  'indiv',
  },
  {
    key:   'indiv24',
    url:   `${FEC_BASE}/2024/indiv24.zip`,
    r2key: 'fec/indiv/2024/indiv.csv',
    type:  'indiv',
  },
  {
    key:   'indiv26',
    url:   `${FEC_BASE}/2026/indiv26.zip`,
    r2key: 'fec/indiv/2026/indiv.csv',
    type:  'indiv',
  },
  {
    key:   'pas222',
    url:   `${FEC_BASE}/2022/pas222.zip`,
    r2key: 'fec/pas2/2022/pas2.csv',
    type:  'pas2',
  },
  {
    key:   'pas224',
    url:   `${FEC_BASE}/2024/pas224.zip`,
    r2key: 'fec/pas2/2024/pas2.csv',
    type:  'pas2',
  },
  {
    key:   'pas226',
    url:   `${FEC_BASE}/2026/pas226.zip`,
    r2key: 'fec/pas2/2026/pas2.csv',
    type:  'pas2',
  },
];

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
// We keep 14 columns — drops IMAGE_NUM, AMNDT_IND, RPT_TP, TRANSACTION_PGI,
// TRANSACTION_TP, TRAN_ID, FILE_NUM (~70% size reduction).
// MEMO_CD='X' rows (conduit entries) are retained — the product surfaces them.
const INDIV_KEEP_COLS = [0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20];
const INDIV_HEADER    = [
  'CMTE_ID', 'ENTITY_TP', 'NAME', 'CITY', 'STATE', 'ZIP_CODE',
  'EMPLOYER', 'OCCUPATION', 'TRANSACTION_DT', 'TRANSACTION_AMT',
  'OTHER_ID', 'MEMO_CD', 'MEMO_TEXT', 'SUB_ID',
].join('|') + '\n';

// pas2 full schema (21 columns) — keep all
const PAS2_HEADER = [
  'CMTE_ID', 'AMNDT_IND', 'RPT_TP', 'TRANSACTION_PGI', 'IMAGE_NUM',
  'TRANSACTION_TP', 'ENTITY_TP', 'NAME', 'CITY', 'STATE', 'ZIP_CODE',
  'EMPLOYER', 'OCCUPATION', 'TRANSACTION_DT', 'TRANSACTION_AMT',
  'OTHER_ID', 'TRAN_ID', 'FILE_NUM', 'MEMO_CD', 'MEMO_TEXT', 'SUB_ID',
].join('|') + '\n';

// R2 multipart part size — 10MB (min is 5MB; 10MB keeps part count low for ~4GB files)
const PART_SIZE = 10 * 1024 * 1024;

const FETCH_HEADERS = { 'User-Agent': 'FECLedger-Pipeline/1.0' };

// ---------------------------------------------------------------------------
// Worker entry points
// ---------------------------------------------------------------------------

export default {
  /**
   * HTTP trigger — for manual runs during development.
   *
   * GET /admin/pipeline/run          → trigger all 6 files
   * GET /admin/pipeline/run?file=pas224 → trigger one file by key
   *
   * Returns 202 immediately; pipeline runs in background via ctx.waitUntil.
   * Use ?file=pas22x/pas224/pas226 for HTTP tests (small files, ~30s).
   * For indiv files, use the Cloudflare dashboard "Test scheduled event" button
   * which invokes the scheduled handler and its 15-minute CPU budget.
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
   * Has 15 minutes of CPU time on Workers Paid plan.
   */
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runPipeline(env, null));
  },
};

// ---------------------------------------------------------------------------
// Pipeline orchestrator
// ---------------------------------------------------------------------------

/**
 * Process all files (or a single file if fileFilter is set).
 * Files are processed sequentially to stay within the 128MB memory limit.
 * A failure on one file logs an error and continues to the next.
 *
 * @param {object} env         - Worker env bindings (env.BULK = R2 bucket)
 * @param {string|null} fileFilter - key from FILES, or null for all
 */
async function runPipeline(env, fileFilter) {
  const targets = fileFilter
    ? FILES.filter(f => f.key === fileFilter)
    : FILES;

  if (targets.length === 0) {
    console.error(`[pipeline] unknown file key "${fileFilter}"`);
    return;
  }

  const results = [];
  for (const file of targets) {
    console.log(`[pipeline] starting ${file.key}`);
    try {
      if (file.type === 'indiv') {
        await processLargeZip(env, file.url, file.r2key, INDIV_KEEP_COLS, INDIV_HEADER);
      } else {
        await processSmallZip(env, file.url, file.r2key, PAS2_HEADER);
      }
      console.log(`[pipeline] completed ${file.key}`);
      results.push({ key: file.key, ok: true });
    } catch (err) {
      console.error(`[pipeline] FAILED ${file.key}:`, err);
      results.push({ key: file.key, ok: false, error: String(err) });
    }
  }

  const failed = results.filter(r => !r.ok);
  if (failed.length) {
    console.error(`[pipeline] ${failed.length} file(s) failed:`, failed.map(r => r.key).join(', '));
  } else {
    console.log(`[pipeline] all ${results.length} file(s) completed successfully`);
  }
}

// ---------------------------------------------------------------------------
// Small file path (pas2) — buffer in memory, single R2 put
// ---------------------------------------------------------------------------

/**
 * Download a small ZIP (<< 128MB), decompress in memory with fflate unzipSync,
 * prepend a header row, and write to R2 as a single put().
 *
 * @param {object} env       - Worker env (env.BULK = R2 bucket)
 * @param {string} url       - FEC bulk download URL
 * @param {string} r2key     - R2 object key
 * @param {string} headerRow - pipe-delimited header line including trailing \n
 */
async function processSmallZip(env, url, r2key, headerRow) {
  // Dynamic import — wrangler bundles fflate at deploy time
  const { unzipSync } = await import('fflate');

  const resp = await fetch(url, { headers: FETCH_HEADERS });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);

  const buffer = new Uint8Array(await resp.arrayBuffer());

  // unzipSync returns { filename: Uint8Array } for every file in the archive
  const zipContents = unzipSync(buffer);

  // FEC bulk ZIPs contain a single pipe-delimited .txt data file
  const dataFilename = Object.keys(zipContents).find(k => k.endsWith('.txt'));
  if (!dataFilename) throw new Error(`No .txt file found in ZIP: ${url}`);

  const csvText = new TextDecoder('utf-8').decode(zipContents[dataFilename]);

  await env.BULK.put(r2key, headerRow + csvText, {
    httpMetadata: { contentType: 'text/csv' },
  });

  console.log(`[pipeline] R2 put complete: ${r2key}`);
}

// ---------------------------------------------------------------------------
// Large file path (indiv) — streaming fflate + R2 multipart upload
// ---------------------------------------------------------------------------

/**
 * Stream a large ZIP from fec.gov through fflate AsyncUnzip, filter columns
 * from each decompressed chunk, and write to R2 via multipart upload.
 *
 * Memory ceiling: the 10MB part buffer + fflate's internal streaming buffer
 * should stay well below the 128MB limit regardless of file size.
 *
 * On any error, aborts the multipart upload to avoid orphaned R2 parts.
 *
 * @param {object}   env       - Worker env (env.BULK = R2 bucket)
 * @param {string}   url       - FEC bulk download URL
 * @param {string}   r2key     - R2 object key
 * @param {number[]} keepCols  - 0-indexed column positions to retain
 * @param {string}   headerRow - pipe-delimited header line including trailing \n
 */
async function processLargeZip(env, url, r2key, keepCols, headerRow) {
  const { AsyncUnzip } = await import('fflate');
  const enc = new TextEncoder();
  const dec = new TextDecoder('utf-8');

  const upload = await env.BULK.createMultipartUpload(r2key, {
    httpMetadata: { contentType: 'text/csv' },
  });

  try {
    await _streamZipToR2({ upload, url, keepCols, headerRow, enc, dec, AsyncUnzip });
  } catch (err) {
    // Abort cleans up pending parts so they don't accumulate storage charges
    try { await upload.abort(); } catch (_) { /* ignore abort errors */ }
    throw err;
  }
}

/**
 * Inner streaming implementation for processLargeZip.
 *
 * Async coordination:
 *   fflate's AsyncUnzip fires file.ondata synchronously in Cloudflare Workers
 *   (no Web Worker thread pool available; fflate falls back to sync processing).
 *   Each ondata invocation appends a .then(() => upload.uploadPart(...)) to a
 *   single chainPromise, guaranteeing parts are uploaded in strict order with
 *   no await inside the synchronous callback.
 *
 *   The outer loop awaits `unzipDone`, which resolves only after the final
 *   part in the chain has been uploaded — ensuring all data is in R2 before
 *   upload.complete() is called.
 */
async function _streamZipToR2({ upload, url, keepCols, headerRow, enc, dec, AsyncUnzip }) {
  const parts = [];
  let partNumber  = 1;
  let buf         = enc.encode(headerRow); // prime with header so first part includes it
  let carry       = new Uint8Array(0);     // bytes of an incomplete trailing line
  let chainPromise = Promise.resolve();    // sequential upload chain

  // Resolved by the ondata final callback after all parts have been enqueued
  let resolveUnzip, rejectUnzip;
  const unzipDone = new Promise((res, rej) => {
    resolveUnzip = res;
    rejectUnzip  = rej;
  });

  const unzip = new AsyncUnzip();

  unzip.onfile = (file) => {
    // Skip any non-data files inside the ZIP (e.g. readme, directory entries)
    if (!file.name.endsWith('.txt')) {
      file.start();
      return;
    }

    file.ondata = (err, chunk, final) => {
      if (err) {
        rejectUnzip(err);
        return;
      }

      // Prepend any incomplete bytes from the previous chunk, then split on \n.
      // lines.pop() removes and saves the potentially incomplete trailing line.
      const combined = concat(carry, chunk);
      const text     = dec.decode(combined);
      const lines    = text.split('\n');
      carry          = enc.encode(lines.pop());

      // Filter each complete line to the desired columns
      const filteredText = lines
        .map(line => {
          if (!line) return '';
          const cols = line.split('|');
          return keepCols.map(i => (cols[i] !== undefined ? cols[i] : '')).join('|');
        })
        .join('\n');

      // Add trailing newline only when there were complete lines to write
      const filtered = enc.encode(filteredText + (lines.length > 0 ? '\n' : ''));
      buf = concat(buf, filtered);

      // Flush full 10MB parts into the sequential upload chain
      while (buf.length >= PART_SIZE) {
        const partData = buf.slice(0, PART_SIZE);
        buf            = buf.slice(PART_SIZE);
        const pn       = partNumber++;

        // Arrow function captures pn and partData in closure —
        // these values are safe to close over because JS is single-threaded
        chainPromise = chainPromise.then(async () => {
          const part = await upload.uploadPart(pn, partData);
          parts.push(part);
          console.log(`[pipeline] uploaded part ${pn} (${(partData.length / 1024 / 1024).toFixed(1)} MB)`);
        });
      }

      if (final) {
        // Flush any remaining bytes as the last part.
        // The final part may be < 5MB — R2 allows this for the last part only.
        if (buf.length > 0) {
          const partData = buf;
          const pn       = partNumber++;
          chainPromise   = chainPromise.then(async () => {
            const part = await upload.uploadPart(pn, partData);
            parts.push(part);
            console.log(`[pipeline] uploaded final part ${pn} (${(partData.length / 1024 / 1024).toFixed(2)} MB)`);
          });
        }

        // Resolve unzipDone only after the entire chain has settled
        chainPromise.then(resolveUnzip).catch(rejectUnzip);
      }
    };

    file.start(); // begin decompressing this file entry
  };

  // Fetch the ZIP and feed its bytes to fflate chunk-by-chunk
  const resp = await fetch(url, { headers: FETCH_HEADERS });
  if (!resp.ok) throw new Error(`HTTP ${resp.status} fetching ${url}`);

  const reader = resp.body.getReader();
  try {
    while (true) {
      const { done, value } = await reader.read();
      // Push an empty array with final=true on EOF to flush fflate's internal state
      unzip.push(done ? new Uint8Array(0) : value, done);
      if (done) break;
    }
  } catch (readErr) {
    rejectUnzip(readErr);
  }

  // Block until every uploadPart has completed
  await unzipDone;

  // Parts must be sorted ascending by partNumber before completing
  parts.sort((a, b) => a.partNumber - b.partNumber);
  await upload.complete(parts);

  console.log(`[pipeline] multipart complete: ${parts.length} parts for ${r2key}`);
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

/**
 * Concatenate two Uint8Arrays into a new Uint8Array.
 */
function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}
