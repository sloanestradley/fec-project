#!/usr/bin/env node
/**
 * FECLedger — FEC individual contribution file ingestion
 *
 * Downloads indiv22/24/26.zip from FEC bulk downloads, strips unused columns,
 * and uploads pipe-delimited CSVs to Cloudflare R2 via the S3-compatible API.
 *
 * Ported from pipeline/src/index.js (Cloudflare Worker). Processing logic is
 * identical; runtime differences are zlib vs. DecompressionStream and AWS SDK
 * vs. Workers R2 binding.
 *
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID  — Cloudflare account ID (for R2 endpoint URL)
 *   R2_ACCESS_KEY_ID       — from a Cloudflare R2 API Token
 *   R2_SECRET_ACCESS_KEY   — from the same R2 API Token
 *
 * R2 API Tokens are created at: Cloudflare Dashboard → R2 → Manage R2 API Tokens
 * A general Cloudflare API token (used for Wrangler) will NOT authenticate.
 */

import { createInflateRaw }    from 'node:zlib';
import { Transform }           from 'node:stream';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload }              from '@aws-sdk/lib-storage';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BUCKET         = 'fecledger-bulk';
const PART_SIZE      = 10 * 1024 * 1024; // 10 MB (R2 minimum is 5 MB)
const FETCH_HEADERS  = { 'User-Agent': 'FECLedger-Pipeline/1.0' };
const ZIP64_SENTINEL = 0xFFFFFFFF;

const FILES = [
  { yy: '22', year: '2022' },
  { yy: '24', year: '2024' },
  { yy: '26', year: '2026' },
];

// ---------------------------------------------------------------------------
// Column configuration — verbatim from pipeline/src/index.js
//
// indiv full schema (21 columns, 0-indexed):
//   0  CMTE_ID       6  ENTITY_TP     12 OCCUPATION
//   1  AMNDT_IND     7  NAME          13 TRANSACTION_DT
//   2  RPT_TP        8  CITY          14 TRANSACTION_AMT
//   3  TRANSACTION_PGI  9 STATE       15 OTHER_ID
//   4  IMAGE_NUM    10  ZIP_CODE      16 TRAN_ID
//   5  TRANSACTION_TP 11 EMPLOYER     17 FILE_NUM
//                                    18 MEMO_CD
//                                    19 MEMO_TEXT
//                                    20 SUB_ID
// ---------------------------------------------------------------------------

const INDIV_KEEP_COLS = [0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 18, 19, 20];
const INDIV_HEADER    = [
  'CMTE_ID', 'ENTITY_TP', 'NAME', 'CITY', 'STATE', 'ZIP_CODE',
  'EMPLOYER', 'OCCUPATION', 'TRANSACTION_DT', 'TRANSACTION_AMT',
  'OTHER_ID', 'MEMO_CD', 'MEMO_TEXT', 'SUB_ID',
].join('|') + '\n';

// ---------------------------------------------------------------------------
// Utilities — verbatim from pipeline/src/index.js
// ---------------------------------------------------------------------------

function concat(a, b) {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function filterColsBinary(data, keepArr) {
  const PIPE = 0x7C;
  const NL   = 0x0A;

  const out = new Uint8Array(data.length);
  let outPos = 0;
  let col    = 0;
  let colStart        = 0;
  let firstKeptOnLine = true;

  for (let i = 0; i < data.length; i++) {
    const b = data[i];
    if (b === PIPE || b === NL) {
      if (keepArr[col]) {
        if (!firstKeptOnLine) out[outPos++] = PIPE;
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

// ---------------------------------------------------------------------------
// ZIP local file header parser
//
// ZIP header layout (bytes):
//   0-3   PK\x03\x04 signature
//   6-7   general purpose bit flag
//   8-9   compression method (8 = DEFLATE)
//   18-21 compressed size (32-bit LE; 0xFFFFFFFF = ZIP64 sentinel)
//   22-25 uncompressed size (32-bit LE)
//   26-27 file name length
//   28-29 extra field length
//   30+nameLen  extra field (ZIP64 extended info if sizes == 0xFFFFFFFF)
//   dataStart   raw DEFLATE stream begins here
// ---------------------------------------------------------------------------

async function parseZipHeader(netReader, year) {
  let zbuf = new Uint8Array(0);

  // Buffer at least 30 bytes (fixed header size)
  while (zbuf.length < 30) {
    const { done, value } = await netReader.read();
    if (done) throw new Error(`[${year}] ZIP stream ended before 30-byte header`);
    zbuf = concat(zbuf, value);
  }

  // Verify PK\x03\x04 local file header signature
  if (zbuf[0] !== 0x50 || zbuf[1] !== 0x4B || zbuf[2] !== 0x03 || zbuf[3] !== 0x04) {
    throw new Error(`[${year}] Invalid ZIP signature: ${[...zbuf.subarray(0, 4)].map(b => b.toString(16)).join(' ')}`);
  }

  const flags       = zbuf[6]  | (zbuf[7]  << 8);
  const comprMethod = zbuf[8]  | (zbuf[9]  << 8);
  const nameLen     = zbuf[26] | (zbuf[27] << 8);
  const extraLen    = zbuf[28] | (zbuf[29] << 8);
  const dataStart   = 30 + nameLen + extraLen;

  // Compressed size as unsigned 32-bit int (>>> 0 prevents signed overflow)
  let compressedSize = ((zbuf[18] | (zbuf[19] << 8) | (zbuf[20] << 16) | (zbuf[21] << 24)) >>> 0);

  if (flags & 0x08)     throw new Error(`[${year}] ZIP data descriptor mode (bit 3) not supported`);
  if (comprMethod !== 8) throw new Error(`[${year}] Unsupported compression method ${comprMethod} (expected 8=DEFLATE)`);

  // Buffer until we have the full variable-length header (name + extra fields)
  while (zbuf.length < dataStart) {
    const { done, value } = await netReader.read();
    if (done) throw new Error(`[${year}] ZIP stream ended in variable header`);
    zbuf = concat(zbuf, value);
  }

  let isZip64 = false;

  if (compressedSize === ZIP64_SENTINEL) {
    // ZIP64 format: parse extra field to find the real compressed size.
    // ZIP64 Extended Information Extra Field (ID 0x0001) layout:
    //   4 bytes: header ID (0x0001) + field size
    //   8 bytes: uncompressed size (64-bit LE)
    //   8 bytes: compressed size (64-bit LE)
    isZip64 = true;
    console.log(`[${year}] ZIP64 format detected — parsing extra field for compressed size`);

    const extra = zbuf.subarray(30 + nameLen, 30 + nameLen + extraLen);
    let found = false;
    let pos   = 0;

    while (pos + 4 <= extra.length) {
      const headerId  = extra[pos]     | (extra[pos + 1] << 8);
      const fieldSize = extra[pos + 2] | (extra[pos + 3] << 8);
      pos += 4;

      if (headerId === 0x0001 && pos + 16 <= extra.length) {
        // Skip 8-byte uncompressed size, read 8-byte compressed size
        const lo = ((extra[pos + 8]  | (extra[pos + 9]  << 8) |
                     (extra[pos + 10] << 16) | (extra[pos + 11] << 24)) >>> 0);
        const hi = ((extra[pos + 12] | (extra[pos + 13] << 8) |
                     (extra[pos + 14] << 16) | (extra[pos + 15] << 24)) >>> 0);
        // Safe: actual compressed size ~1.5 GB fits in a JS Number (< 2^53)
        compressedSize = hi * 0x100000000 + lo;
        console.log(`[${year}] ZIP64 compressed size: ${(compressedSize / 1024 / 1024).toFixed(0)} MB`);
        found = true;
        break;
      }

      pos += fieldSize;
    }

    if (!found) {
      console.warn(`[${year}] ZIP64 extra field (0x0001) not found — streaming until network EOF`);
      compressedSize = Infinity; // stream until done
    }
  }

  return { compressedSize, dataStart, zbuf, isZip64 };
}

// ---------------------------------------------------------------------------
// IndivFilterStream — pipe-delimited column filter as a Node.js Transform
//
// Prepends the 14-column header row, then for each decompressed chunk:
//   1. Prepend any carry bytes from the previous chunk (partial last line)
//   2. Process all complete lines (up to and including the last \n)
//   3. Save remaining bytes as carry for the next chunk
//   4. On flush, process the final carry (last line may omit trailing \n)
// ---------------------------------------------------------------------------

class IndivFilterStream extends Transform {
  constructor() {
    super();
    const keepArr = new Uint8Array(22); // covers columns 0–20
    INDIV_KEEP_COLS.forEach(i => { keepArr[i] = 1; });
    this._keepArr      = keepArr;
    this._carry        = new Uint8Array(0);
    this._headerPushed = false;
  }

  _transform(chunk, _encoding, callback) {
    try {
      if (!this._headerPushed) {
        this.push(Buffer.from(INDIV_HEADER));
        this._headerPushed = true;
      }

      // Merge carry + incoming chunk into a contiguous buffer
      const data = this._carry.length > 0 ? concat(this._carry, chunk) : chunk;

      // Find last newline to bound the processable region to complete lines
      let lastNL = -1;
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i] === 0x0A) { lastNL = i; break; }
      }

      if (lastNL >= 0) {
        const processable = data.subarray(0, lastNL + 1);
        // Copy carry — the source buffer may not be safe to hold a view into
        this._carry = new Uint8Array(data.subarray(lastNL + 1));
        const filtered = filterColsBinary(processable, this._keepArr);
        if (filtered.length > 0) this.push(Buffer.from(filtered));
      } else {
        // No newline in this chunk — entire chunk becomes carry
        this._carry = new Uint8Array(data);
      }

      callback();
    } catch (err) {
      callback(err);
    }
  }

  _flush(callback) {
    try {
      if (this._carry.length > 0) {
        // Last line may omit trailing \n — append one so filterColsBinary processes it
        const lastLine = concat(this._carry, new Uint8Array([0x0A]));
        const filtered = filterColsBinary(lastLine, this._keepArr);
        if (filtered.length > 0) this.push(Buffer.from(filtered));
      }
      callback();
    } catch (err) {
      callback(err);
    }
  }
}

// ---------------------------------------------------------------------------
// Compressed data feed
// ---------------------------------------------------------------------------

// Write a chunk to inflate, respecting backpressure.
// inflate.write() returns false when its output buffer is full (downstream
// is consuming slower than inflate is producing). Waiting for 'drain' before
// the next write keeps memory usage bounded throughout the upload.
function writeInflate(inflate, chunk) {
  if (inflate.write(chunk)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const onDrain = () => { cleanup(); resolve(); };
    const onError = (err) => { cleanup(); reject(err); };
    const cleanup = () => {
      inflate.removeListener('drain', onDrain);
      inflate.removeListener('error', onError);
    };
    inflate.once('drain', onDrain);
    inflate.once('error', onError);
  });
}

async function feedCompressedToInflate(inflate, netReader, zbuf, dataStart, compressedSize) {
  const useLimit = isFinite(compressedSize);
  let netWritten = 0;

  // Write any compressed bytes already buffered during header parsing
  const leftover = zbuf.subarray(dataStart);
  if (leftover.length > 0) {
    const slice = useLimit
      ? leftover.subarray(0, Math.min(leftover.length, compressedSize))
      : leftover;
    await writeInflate(inflate, slice);
    netWritten += slice.length;
  }

  // Stream the rest from the network
  while (!useLimit || netWritten < compressedSize) {
    const { done, value } = await netReader.read();
    if (done) break;
    const remaining = useLimit ? compressedSize - netWritten : Infinity;
    const slice     = remaining < value.length ? value.subarray(0, remaining) : value;
    if (slice.length > 0) {
      await writeInflate(inflate, slice);
      netWritten += slice.length;
    }
  }

  inflate.end();
}

// ---------------------------------------------------------------------------
// Fetch with single 503 retry
// ---------------------------------------------------------------------------

async function fetchWithRetry(url, year) {
  let resp = await fetch(url, { headers: FETCH_HEADERS });
  if (!resp.ok && resp.status === 503) {
    console.log(`[${year}] 503 from FEC — retrying in 30 seconds...`);
    await new Promise(r => setTimeout(r, 30_000));
    resp = await fetch(url, { headers: FETCH_HEADERS });
  }
  if (!resp.ok) throw new Error(`[${year}] HTTP ${resp.status} fetching ${url}`);
  return resp;
}

// ---------------------------------------------------------------------------
// Process one file
// ---------------------------------------------------------------------------

async function processFile(s3, { yy, year }) {
  const t0    = Date.now();
  const url   = `https://www.fec.gov/files/bulk-downloads/${year}/indiv${yy}.zip`;
  const r2Key = `fec/indiv/${year}/indiv.csv`;

  console.log(`\n[${year}] ── Starting ─────────────────────────────`);
  console.log(`[${year}] URL: ${url}`);

  const resp      = await fetchWithRetry(url, year);
  const netReader = resp.body.getReader();

  const { compressedSize, dataStart, zbuf, isZip64 } = await parseZipHeader(netReader, year);
  const sizeLabel = isFinite(compressedSize)
    ? `${(compressedSize / 1024 / 1024).toFixed(0)} MB compressed`
    : 'unknown size (streaming to EOF)';
  console.log(`[${year}] ZIP64=${isZip64} | ${sizeLabel}`);

  const inflate      = createInflateRaw();
  const filterStream = new IndivFilterStream();

  // pipe() does not forward errors — propagate manually
  inflate.on('error', err => filterStream.destroy(err));
  inflate.pipe(filterStream);

  const upload = new Upload({
    client: s3,
    params: {
      Bucket:      BUCKET,
      Key:         r2Key,
      Body:        filterStream,
      ContentType: 'text/csv',
    },
    partSize:          PART_SIZE,
    queueSize:         1,     // serial parts — one in-flight at a time
    leavePartsOnError: false,
  });

  let lastLoggedPart = 0;
  upload.on('httpUploadProgress', ({ part, loaded }) => {
    if (part && part !== lastLoggedPart) {
      lastLoggedPart = part;
      const mb = loaded !== undefined ? ` (${(loaded / 1024 / 1024).toFixed(0)} MB uploaded)` : '';
      console.log(`[${year}] Part ${part} complete${mb}`);
    }
  });

  // feedCompressedToInflate and upload.done() run concurrently:
  // feed writes compressed bytes → inflate decompresses → filterStream filters
  // → upload reads from filterStream and uploads to R2 in 10 MB parts
  const feedPromise = feedCompressedToInflate(inflate, netReader, zbuf, dataStart, compressedSize)
    .catch(err => {
      inflate.destroy(err); // unblocks filterStream so upload can fail cleanly
      throw err;
    });

  try {
    await Promise.all([feedPromise, upload.done()]);
  } catch (err) {
    inflate.destroy();
    filterStream.destroy();
    throw err;
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${year}] ✓ Done — ${r2Key} (${lastLoggedPart} parts, ${elapsed}s)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const accountId       = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    console.error(
      'Missing required env vars: CLOUDFLARE_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY\n' +
      'R2 credentials come from a Cloudflare R2 API Token (Dashboard → R2 → Manage R2 API Tokens),\n' +
      'not from a general Cloudflare API token.'
    );
    process.exit(1);
  }

  const s3 = new S3Client({
    region:      'auto',
    endpoint:    `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  console.log('FECLedger — FEC indiv pipeline');
  console.log(`Bucket: ${BUCKET} | Files: ${FILES.map(f => `indiv${f.yy}`).join(', ')}`);

  let allSucceeded = true;

  for (const file of FILES) {
    try {
      await processFile(s3, file);
    } catch (err) {
      console.error(`\n[${file.year}] ✗ FAILED: ${err.message}`);
      allSucceeded = false;
      // Continue to next file — do not abort the entire run on a single failure
    }
  }

  if (allSucceeded) {
    const ts   = new Date().toISOString();
    const body = JSON.stringify({ indiv: ts, pas2: null });
    await s3.send(new PutObjectCommand({
      Bucket:      BUCKET,
      Key:         'fec/last_updated.json',
      Body:        body,
      ContentType: 'application/json',
    }));
    console.log(`\n✓ All files complete. last_updated.json written (indiv: ${ts})`);
  } else {
    console.error('\n✗ One or more files failed — last_updated.json NOT written');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('[pipeline] Fatal:', err);
  process.exit(1);
});
