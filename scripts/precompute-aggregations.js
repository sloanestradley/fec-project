#!/usr/bin/env node
/**
 * FECLedger — KV pre-computation of top contributors per committee
 *
 * Runs after scripts/ingest-bulk.js in the same GitHub Actions job.
 *
 * For each cycle (2024, 2026):
 *   1. Stream fec/pas2/{year}/pas2.csv from R2 → Set of recipient CMTE_IDs
 *   2. Stream fec/indiv/{year}/indiv.csv from R2 → aggregate per-committee
 *      top contributors (NAME + ENTITY_TP), summing TRANSACTION_AMT,
 *      excluding memo rows (MEMO_CD === 'X')
 *   3. Filter committees in scope (in pas2 set OR rowCount >= 500), sort each
 *      committee's contributors descending, slice top 25
 *   4. Write entries to Cloudflare KV via REST bulk endpoint, in batches of 50
 *
 * KV key format:   top_contributors:{committee_id}:{cycle}
 * KV value format: JSON array of { name, entity_type, total }
 * KV TTL:          7 days (604800 seconds) — defensive against pipeline outages
 *
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID  — for R2 endpoint URL and KV REST API path
 *   CLOUDFLARE_API_TOKEN   — needs Account → Workers KV Storage → Edit scope
 *   R2_ACCESS_KEY_ID       — from a Cloudflare R2 API Token
 *   R2_SECRET_ACCESS_KEY   — from the same R2 API Token
 *   KV_NAMESPACE_ID        — id of the fecledger-aggregations namespace
 *
 * Pages binding (manual, separate from this script):
 *   The fecledger Pages project must have an AGGREGATIONS binding to the
 *   fecledger-aggregations namespace before Session 4C can read these values.
 *   Configured via Cloudflare Dashboard → Pages → Settings → Functions → KV.
 */

import readline from 'node:readline';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BUCKET         = 'fecledger-bulk';
const TOP_N          = 25;           // top-K stored in KV (UI shows top 10)
const MIN_ROWS       = 500;          // committee qualifies if rowCount >= MIN_ROWS
const KV_TTL         = 604800;       // 7 days
const KV_BATCH_SIZE  = 50;
const CYCLES         = [
  { year: '2024', cycle: 2024 },
  { year: '2026', cycle: 2026 },
];

// In-stream pruning to bound memory.
// Mega-committees (ActBlue, WinRed, DNC, etc.) accumulate 1M+ unique
// (NAME|ENTITY_TP) keys; the unbounded Map exhausted a 6 GB heap.
//
// Strategy: every PRUNE_EVERY_ROWS streamed, sort each oversize committee's
// contributor Map and discard everything outside top PRUNE_TO. PRUNE_TO=500
// is a 20× safety buffer above the TOP_N=25 stored in KV — a contributor
// pruned mid-stream would need to climb from $0 to a top-25 total in the
// remaining rows alone to be lost from the final output. This is rare in
// practice: top-25 contributors to mega-committees are dominated by max-out
// donors and bundlers who establish their position early in the cycle.
//
// Committees with <= PRUNE_THRESHOLD entries are never pruned — preserves
// full data for the long tail of small/medium committees where the safety
// margin doesn't matter and pruning could silently drop a real top-25.
const PRUNE_TO         = 500;
const PRUNE_THRESHOLD  = 1000;
const PRUNE_EVERY_ROWS = 5_000_000;

// indiv CSV column indices (0-based) — produced by ingest-bulk.js BulkProcessingStream
//   0: CMTE_ID  1: ENTITY_TP  2: NAME  9: TRANSACTION_AMT  11: MEMO_CD
const COL_CMTE_ID  = 0;
const COL_ENTITY   = 1;
const COL_NAME     = 2;
const COL_AMT      = 9;
const COL_MEMO     = 11;
const INDIV_COLS   = 14;

// ---------------------------------------------------------------------------
// R2 streaming
// ---------------------------------------------------------------------------

async function streamPas2Recipients(s3, year) {
  const set = new Set();
  const resp = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key:    `fec/pas2/${year}/pas2.csv`,
  }));

  const rl = readline.createInterface({ input: resp.Body, crlfDelay: Infinity });
  let isHeader = true;

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    const pipe   = line.indexOf('|');
    const cmteId = pipe < 0 ? line : line.slice(0, pipe);
    if (cmteId) set.add(cmteId);
  }

  return set;
}

function pruneOversizedCommittees(agg) {
  let prunedCount = 0;
  let droppedKeys = 0;
  for (const cmteAgg of agg.values()) {
    const before = cmteAgg.contributors.size;
    if (before <= PRUNE_THRESHOLD) continue;
    const sorted = [...cmteAgg.contributors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, PRUNE_TO);
    cmteAgg.contributors = new Map(sorted);
    droppedKeys += (before - PRUNE_TO);
    prunedCount++;
  }
  return { prunedCount, droppedKeys };
}

async function aggregateIndiv(s3, year) {
  const agg = new Map(); // CMTE_ID → { rowCount, contributors: Map<name|entity, total> }
  const resp = await s3.send(new GetObjectCommand({
    Bucket: BUCKET,
    Key:    `fec/indiv/${year}/indiv.csv`,
  }));

  const rl = readline.createInterface({ input: resp.Body, crlfDelay: Infinity });
  let isHeader  = true;
  let totalRows = 0;
  let kept      = 0;

  for await (const line of rl) {
    if (isHeader) { isHeader = false; continue; }
    totalRows++;

    const cols = line.split('|');
    if (cols.length < INDIV_COLS) continue;
    if (cols[COL_MEMO] === 'X')   continue;

    const cmteId   = cols[COL_CMTE_ID];
    const entityTp = cols[COL_ENTITY];
    const name     = cols[COL_NAME];
    const amt      = parseFloat(cols[COL_AMT]);

    if (!cmteId || !name || !isFinite(amt)) continue;

    let cmteAgg = agg.get(cmteId);
    if (!cmteAgg) {
      cmteAgg = { rowCount: 0, contributors: new Map() };
      agg.set(cmteId, cmteAgg);
    }
    cmteAgg.rowCount++;
    const key = name + '|' + entityTp;
    cmteAgg.contributors.set(key, (cmteAgg.contributors.get(key) || 0) + amt);
    kept++;

    if (totalRows % PRUNE_EVERY_ROWS === 0) {
      const heapBeforeMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
      const { prunedCount, droppedKeys } = pruneOversizedCommittees(agg);
      const heapAfterMb  = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
      console.log(`[${year}/indiv] ${totalRows.toLocaleString()} rows | kept ${kept.toLocaleString()} | committees ${agg.size.toLocaleString()} | pruned ${prunedCount} (-${droppedKeys.toLocaleString()} keys) | heap ${heapBeforeMb}→${heapAfterMb} MB`);
    }
  }

  return { agg, totalRows, kept };
}

// ---------------------------------------------------------------------------
// Scope filter + top-N slice
// ---------------------------------------------------------------------------

function buildKvEntries(agg, pas2Set, cycle) {
  const entries = [];
  let pas2Count = 0;
  let highVolOnly = 0;

  for (const [cmteId, { rowCount, contributors }] of agg) {
    const inPas2     = pas2Set.has(cmteId);
    const highVolume = rowCount >= MIN_ROWS;
    if (!inPas2 && !highVolume) continue;
    if (inPas2) pas2Count++; else highVolOnly++;

    const sorted = [...contributors.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_N)
      .map(([key, total]) => {
        const sep = key.indexOf('|');
        const name       = sep < 0 ? key : key.slice(0, sep);
        const entity_type = sep < 0 ? '' : key.slice(sep + 1);
        return { name, entity_type, total: Math.round(total) };
      });

    entries.push({
      key:            `top_contributors:${cmteId}:${cycle}`,
      value:          JSON.stringify(sorted),
      expiration_ttl: KV_TTL,
    });
  }

  return { entries, pas2Count, highVolOnly };
}

// ---------------------------------------------------------------------------
// KV bulk write — Cloudflare REST API
//
// Endpoint: PUT /accounts/{id}/storage/kv/namespaces/{ns}/bulk
// Body:     [{ key, value: <string>, expiration_ttl }, ...]
// Auth:     Bearer {CLOUDFLARE_API_TOKEN} (needs Workers KV Storage: Edit)
//
// HTTP 200 does not guarantee per-key success; check body.success and
// body.errors[]. Single retry on 5xx with 30s backoff (matches the
// fetchWithRetry pattern in ingest-bulk.js).
// ---------------------------------------------------------------------------

async function kvBulkPut(accountId, namespaceId, apiToken, batch, label) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`;

  let resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify(batch),
  });

  if (!resp.ok && resp.status >= 500) {
    console.warn(`[${label}] KV bulk write returned HTTP ${resp.status} — retrying in 30s`);
    await new Promise(r => setTimeout(r, 30_000));
    resp = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify(batch),
    });
  }

  const text = await resp.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }

  if (!resp.ok) {
    throw new Error(`KV bulk write HTTP ${resp.status}: ${text.slice(0, 500)}`);
  }
  if (!body || body.success !== true) {
    const errors = body?.errors ? JSON.stringify(body.errors).slice(0, 500) : text.slice(0, 500);
    throw new Error(`KV bulk write reported failure: ${errors}`);
  }
}

async function writeKvBulk(accountId, namespaceId, apiToken, entries, label) {
  const total = entries.length;
  if (total === 0) {
    console.log(`[${label}] No KV entries to write`);
    return;
  }
  const batches = Math.ceil(total / KV_BATCH_SIZE);
  let written = 0;

  for (let i = 0; i < total; i += KV_BATCH_SIZE) {
    const batch    = entries.slice(i, i + KV_BATCH_SIZE);
    const batchNum = Math.floor(i / KV_BATCH_SIZE) + 1;
    await kvBulkPut(accountId, namespaceId, apiToken, batch, `${label} batch ${batchNum}/${batches}`);
    written += batch.length;
    if (batchNum % 20 === 0 || batchNum === batches) {
      console.log(`[${label}] KV batch ${batchNum}/${batches} written (${written}/${total} entries)`);
    }
  }
}

// ---------------------------------------------------------------------------
// Per-cycle pipeline
// ---------------------------------------------------------------------------

async function processCycle(s3, accountId, apiToken, namespaceId, { year, cycle }) {
  const t0 = Date.now();
  console.log(`\n[${cycle}] ── Starting ─────────────────────────────`);

  console.log(`[${cycle}] Streaming pas2 to build recipient scope set...`);
  const pas2Set = await streamPas2Recipients(s3, year);
  console.log(`[${cycle}] pas2 recipients: ${pas2Set.size.toLocaleString()} unique committees`);

  console.log(`[${cycle}] Streaming indiv to aggregate contributors...`);
  let { agg, totalRows, kept } = await aggregateIndiv(s3, year);
  const heapMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(0);
  console.log(`[${cycle}] indiv complete: ${totalRows.toLocaleString()} rows | kept ${kept.toLocaleString()} | ${agg.size.toLocaleString()} unique committees | heap ${heapMb} MB`);

  const { entries, pas2Count, highVolOnly } = buildKvEntries(agg, pas2Set, cycle);
  console.log(`[${cycle}] in-scope: ${entries.length.toLocaleString()} committees (pas2-recipients: ${pas2Count.toLocaleString()} | high-volume only: ${highVolOnly.toLocaleString()})`);

  // Free the aggregation Map before KV writes — it's no longer needed
  agg = null;

  await writeKvBulk(accountId, namespaceId, apiToken, entries, `${cycle}`);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${cycle}] ✓ Done — ${entries.length.toLocaleString()} KV entries written (${elapsed}s)`);

  return entries.length;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const accountId       = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken        = process.env.CLOUDFLARE_API_TOKEN;
  const accessKeyId     = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const namespaceId     = process.env.KV_NAMESPACE_ID;

  const missing = [];
  if (!accountId)       missing.push('CLOUDFLARE_ACCOUNT_ID');
  if (!apiToken)        missing.push('CLOUDFLARE_API_TOKEN');
  if (!accessKeyId)     missing.push('R2_ACCESS_KEY_ID');
  if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!namespaceId)     missing.push('KV_NAMESPACE_ID');

  if (missing.length) {
    console.error(
      `Missing required env vars: ${missing.join(', ')}\n` +
      'CLOUDFLARE_API_TOKEN must have Account → Workers KV Storage → Edit scope.\n' +
      'R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY come from a Cloudflare R2 API Token.\n' +
      'KV_NAMESPACE_ID is the id printed by `wrangler kv namespace create fecledger-aggregations`.'
    );
    process.exit(1);
  }

  const s3 = new S3Client({
    region:      'auto',
    endpoint:    `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  console.log('FECLedger — KV pre-computation');
  console.log(`Bucket: ${BUCKET} | Cycles: ${CYCLES.map(c => c.cycle).join(', ')} | Top N: ${TOP_N} | TTL: ${KV_TTL}s`);

  const t0 = Date.now();
  let totalEntries = 0;
  let allSucceeded = true;

  for (const c of CYCLES) {
    try {
      totalEntries += await processCycle(s3, accountId, apiToken, namespaceId, c);
    } catch (err) {
      console.error(`\n[${c.cycle}] ✗ FAILED: ${err.message}`);
      allSucceeded = false;
      // Continue to next cycle — partial success is preferable to all-or-nothing
    }
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n${allSucceeded ? '✓' : '✗'} Run complete — ${totalEntries.toLocaleString()} total KV entries written across ${CYCLES.length} cycles (${elapsed}s)`);

  if (!allSucceeded) process.exit(1);
}

main().catch(err => {
  console.error('[precompute] Fatal:', err);
  process.exit(1);
});
