#!/usr/bin/env node
/**
 * FECLedger — KV pre-computation of top contributors per committee (DuckDB)
 *
 * Runs after scripts/ingest-bulk.js in the same GitHub Actions job.
 *
 * Architecture (v2, 2026-04-17):
 *   The v1 streaming-Map approach worked but used mid-stream pruning to bound
 *   memory — which sacrifices accuracy for mega-committees (ActBlue, WinRed,
 *   etc.) because a pruned contributor loses their prior accumulation. v2
 *   replaces the aggregation engine with DuckDB, which does external (spill-
 *   to-disk) GROUP BY natively. Bounded memory, zero accuracy compromise.
 *
 * For each cycle (2024, 2026):
 *   1. Download fec/pas2/{year}/pas2.csv and fec/indiv/{year}/indiv.csv
 *      from R2 to local /tmp disk (runner has ~14 GB free)
 *   2. Run a single SQL query in DuckDB that filters, aggregates, scope-
 *      filters, and ranks — returning top 25 per committee, ordered by
 *      (cmte_id, rank)
 *   3. Iterate result rows, group by cmte_id in a linear scan, build KV
 *      entries with key `top_contributors:{cmte_id}:{cycle}`
 *   4. Delete local CSVs to reclaim disk
 *
 * The KV namespace is wiped entirely up front (before aggregation), so the
 * v1 pruned-era entries can't coexist with v2 exact-total entries.
 *
 * Required env vars:
 *   CLOUDFLARE_ACCOUNT_ID  — for R2 endpoint + KV REST API
 *   CLOUDFLARE_API_TOKEN   — needs Account → Workers KV Storage → Edit scope
 *   R2_ACCESS_KEY_ID       — from a Cloudflare R2 API Token
 *   R2_SECRET_ACCESS_KEY   — from the same R2 API Token
 *   KV_NAMESPACE_ID        — id of fecledger-aggregations namespace
 */

import fs             from 'node:fs';
import fsp            from 'node:fs/promises';
import path           from 'node:path';
import { pipeline }   from 'node:stream/promises';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { DuckDBInstance }              from '@duckdb/node-api';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const BUCKET        = 'fecledger-bulk';
const TOP_N         = 25;            // top-K stored in KV (UI shows top 10)
const MIN_ROWS      = 500;           // committee in-scope if rowCount >= MIN_ROWS
const KV_TTL        = 604800;        // 7 days
const KV_BATCH_SIZE = 50;
const TMP_DIR       = '/tmp/fecledger';
const DUCKDB_TMP    = '/tmp/duckdb';
const CYCLES        = [
  { year: '2024', cycle: 2024 },
  { year: '2026', cycle: 2026 },
];

// ---------------------------------------------------------------------------
// DuckDB schemas — matching BulkProcessingStream output in ingest-bulk.js
// ---------------------------------------------------------------------------

// indiv: 14 columns, pipe-delimited, header row
const INDIV_COLUMNS = {
  CMTE_ID:         'VARCHAR',
  ENTITY_TP:       'VARCHAR',
  NAME:            'VARCHAR',
  CITY:            'VARCHAR',
  STATE:           'VARCHAR',
  ZIP_CODE:        'VARCHAR',
  EMPLOYER:        'VARCHAR',
  OCCUPATION:      'VARCHAR',
  TRANSACTION_DT:  'VARCHAR',
  TRANSACTION_AMT: 'DOUBLE',
  OTHER_ID:        'VARCHAR',
  MEMO_CD:         'VARCHAR',
  MEMO_TEXT:       'VARCHAR',
  SUB_ID:          'VARCHAR',
};

// pas2: we only read cmte_id, but the columns map must be complete
const PAS2_COLUMNS = {
  CMTE_ID:         'VARCHAR',
  AMNDT_IND:       'VARCHAR',
  RPT_TP:          'VARCHAR',
  TRANSACTION_PGI: 'VARCHAR',
  IMAGE_NUM:       'VARCHAR',
  TRANSACTION_TP:  'VARCHAR',
  ENTITY_TP:       'VARCHAR',
  NAME:            'VARCHAR',
  CITY:            'VARCHAR',
  STATE:           'VARCHAR',
  ZIP_CODE:        'VARCHAR',
  EMPLOYER:        'VARCHAR',
  OCCUPATION:      'VARCHAR',
  TRANSACTION_DT:  'VARCHAR',
  TRANSACTION_AMT: 'DOUBLE',
  OTHER_ID:        'VARCHAR',
  TRAN_ID:         'VARCHAR',
  FILE_NUM:        'VARCHAR',
  MEMO_CD:         'VARCHAR',
  MEMO_TEXT:       'VARCHAR',
  SUB_ID:          'VARCHAR',
};

function columnsToSqlMap(cols) {
  // DuckDB's read_csv `columns=` expects a STRUCT literal: {'COL': 'TYPE', ...}
  return '{' + Object.entries(cols).map(([k, v]) => `'${k}': '${v}'`).join(', ') + '}';
}

// ---------------------------------------------------------------------------
// R2 download helpers
// ---------------------------------------------------------------------------

async function downloadFromR2(s3, r2Key, localPath, label) {
  const t0 = Date.now();
  console.log(`[${label}] Downloading s3://${BUCKET}/${r2Key} → ${localPath}`);

  const resp = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: r2Key }));
  await pipeline(resp.Body, fs.createWriteStream(localPath));

  const stat     = await fsp.stat(localPath);
  const sizeMb   = (stat.size / 1024 / 1024).toFixed(0);
  const elapsed  = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${label}] Downloaded ${sizeMb} MB in ${elapsed}s`);
}

// ---------------------------------------------------------------------------
// KV REST API helpers
//
// Three operations used:
//   GET  /accounts/{id}/storage/kv/namespaces/{ns}/keys          (list, paginated)
//   POST /accounts/{id}/storage/kv/namespaces/{ns}/bulk/delete   (bulk delete)
//   PUT  /accounts/{id}/storage/kv/namespaces/{ns}/bulk          (bulk put)
//
// All use Authorization: Bearer {CLOUDFLARE_API_TOKEN}.
// Retry once on 5xx with 30s backoff.
// ---------------------------------------------------------------------------

async function kvFetch(url, options, label) {
  let resp = await fetch(url, options);
  if (!resp.ok && resp.status >= 500) {
    console.warn(`[${label}] HTTP ${resp.status} — retrying in 30s`);
    await new Promise(r => setTimeout(r, 30_000));
    resp = await fetch(url, options);
  }
  const text = await resp.text();
  let body;
  try { body = JSON.parse(text); } catch { body = null; }

  if (!resp.ok) throw new Error(`${label} HTTP ${resp.status}: ${text.slice(0, 500)}`);
  if (!body || body.success !== true) {
    const errs = body?.errors ? JSON.stringify(body.errors).slice(0, 500) : text.slice(0, 500);
    throw new Error(`${label} reported failure: ${errs}`);
  }
  return body;
}

async function wipeNamespace(accountId, namespaceId, apiToken) {
  const t0       = Date.now();
  let cursor     = null;
  let totalKeys  = 0;

  console.log('[wipe] Listing existing keys...');
  do {
    const listUrl = cursor
      ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?cursor=${encodeURIComponent(cursor)}`
      : `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`;

    const listBody = await kvFetch(listUrl,
      { headers: { Authorization: `Bearer ${apiToken}` } },
      '[wipe/list]');

    const keys = (listBody.result || []).map(k => k.name);
    if (keys.length === 0) break;

    const delUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk/delete`;
    await kvFetch(delUrl, {
      method:  'POST',
      headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
      body:    JSON.stringify(keys),
    }, '[wipe/delete]');

    totalKeys += keys.length;
    cursor     = listBody.result_info?.cursor || null;
    console.log(`[wipe] Deleted ${keys.length} keys (running total ${totalKeys.toLocaleString()})`);
  } while (cursor);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[wipe] Done — ${totalKeys.toLocaleString()} keys removed in ${elapsed}s`);
  return totalKeys;
}

async function kvBulkPut(accountId, namespaceId, apiToken, batch, label) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk`;
  await kvFetch(url, {
    method:  'PUT',
    headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
    body:    JSON.stringify(batch),
  }, label);
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
    await kvBulkPut(accountId, namespaceId, apiToken, batch, `[${label} batch ${batchNum}/${batches}]`);
    written += batch.length;
    if (batchNum % 20 === 0 || batchNum === batches) {
      console.log(`[${label}] KV batch ${batchNum}/${batches} written (${written}/${total} entries)`);
    }
  }
}

// ---------------------------------------------------------------------------
// DuckDB aggregation query
//
// Single pass over indiv CSV. Filters memo rows, groups by (cmte_id, name,
// entity_type), sums amt, filters to in-scope committees, ranks with
// ROW_NUMBER, slices to top 25, orders by (cmte_id, rnk) for linear grouping
// in Node. Scope rule matches v1: committee in pas2 as recipient OR >= 500
// post-memo rows in indiv.
// ---------------------------------------------------------------------------

function buildPas2Sql(pas2Path) {
  const pas2Schema = columnsToSqlMap(PAS2_COLUMNS);
  return `
    CREATE OR REPLACE TABLE pas2_recipients AS
    SELECT DISTINCT CMTE_ID AS cmte_id
    FROM read_csv(
      '${pas2Path.replace(/'/g, "''")}',
      delim='|', header=true, quote='"', columns=${pas2Schema}, auto_detect=false
    )
    WHERE CMTE_ID IS NOT NULL AND CMTE_ID != '';
  `;
}

function buildAggSql(indivPath) {
  const indivSchema = columnsToSqlMap(INDIV_COLUMNS);
  return `
    WITH filtered AS (
      SELECT CMTE_ID AS cmte_id, ENTITY_TP AS entity_type, NAME AS name,
             TRANSACTION_AMT AS amt, MEMO_CD AS memo_cd
      FROM read_csv(
        '${indivPath.replace(/'/g, "''")}',
        delim='|', header=true, quote='"', columns=${indivSchema}, auto_detect=false
      )
      WHERE (memo_cd != 'X' OR memo_cd IS NULL)
    ),
    row_counts AS (
      SELECT cmte_id, COUNT(*) AS rc
      FROM filtered
      WHERE cmte_id IS NOT NULL AND cmte_id != ''
      GROUP BY cmte_id
    ),
    in_scope AS (
      SELECT cmte_id FROM row_counts WHERE rc >= ${MIN_ROWS}
      UNION
      SELECT cmte_id FROM pas2_recipients
    ),
    agg AS (
      SELECT cmte_id, name, entity_type, SUM(amt) AS total
      FROM filtered
      WHERE cmte_id IS NOT NULL AND cmte_id != ''
        AND name    IS NOT NULL AND name    != ''
        AND amt     IS NOT NULL
        AND cmte_id IN (SELECT cmte_id FROM in_scope)
      GROUP BY cmte_id, name, entity_type
    ),
    ranked AS (
      SELECT cmte_id, name, entity_type, total,
             ROW_NUMBER() OVER (PARTITION BY cmte_id ORDER BY total DESC, name ASC) AS rnk
      FROM agg
    )
    SELECT cmte_id, name, entity_type, total
    FROM ranked
    WHERE rnk <= ${TOP_N}
    ORDER BY cmte_id, rnk;
  `;
}

// ---------------------------------------------------------------------------
// Per-cycle pipeline
// ---------------------------------------------------------------------------

async function processCycle(s3, conn, { year, cycle }) {
  const t0        = Date.now();
  const label     = String(cycle);
  const pas2Path  = path.join(TMP_DIR, `pas2-${year}.csv`);
  const indivPath = path.join(TMP_DIR, `indiv-${year}.csv`);

  console.log(`\n[${cycle}] ── Starting ─────────────────────────────`);

  // 1. Download both files
  await downloadFromR2(s3, `fec/pas2/${year}/pas2.csv`,   pas2Path,  `${label}/pas2`);
  await downloadFromR2(s3, `fec/indiv/${year}/indiv.csv`, indivPath, `${label}/indiv`);

  // 2. Run SQL — load pas2 into a table, then execute the aggregation query
  console.log(`[${cycle}] Loading pas2 recipients...`);
  await conn.run(buildPas2Sql(pas2Path));

  console.log(`[${cycle}] Running DuckDB aggregation SQL...`);
  const sqlT0  = Date.now();
  const reader = await conn.runAndReadAll(buildAggSql(indivPath));
  const rows   = reader.getRows();
  const sqlEl  = ((Date.now() - sqlT0) / 1000).toFixed(1);
  console.log(`[${cycle}] SQL done in ${sqlEl}s — ${rows.length.toLocaleString()} (committee, contributor) result rows`);

  // 3. Linear scan to group by cmte_id (rows are pre-sorted by cmte_id, rnk)
  const entries = [];
  let current   = null;
  for (const row of rows) {
    const [cmteId, name, entityTp, total] = row;
    if (!current || current.cmteId !== cmteId) {
      if (current) {
        entries.push({
          key:            `top_contributors:${current.cmteId}:${cycle}`,
          value:          JSON.stringify(current.list),
          expiration_ttl: KV_TTL,
        });
      }
      current = { cmteId, list: [] };
    }
    current.list.push({
      name,
      entity_type: entityTp ?? '',
      total:       Math.round(Number(total)),
    });
  }
  if (current) {
    entries.push({
      key:            `top_contributors:${current.cmteId}:${cycle}`,
      value:          JSON.stringify(current.list),
      expiration_ttl: KV_TTL,
    });
  }

  console.log(`[${cycle}] in-scope: ${entries.length.toLocaleString()} committees`);

  // 4. Clean up CSVs and DuckDB table for this cycle
  await fsp.unlink(pas2Path).catch(() => {});
  await fsp.unlink(indivPath).catch(() => {});
  await conn.run('DROP TABLE IF EXISTS pas2_recipients');

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${cycle}] ✓ Cycle processing done (${elapsed}s)`);

  return entries;
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
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    process.exit(1);
  }

  // Ensure scratch directories exist
  await fsp.mkdir(TMP_DIR,    { recursive: true });
  await fsp.mkdir(DUCKDB_TMP, { recursive: true });

  const s3 = new S3Client({
    region:      'auto',
    endpoint:    `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  console.log('FECLedger — KV pre-computation (DuckDB)');
  console.log(`Bucket: ${BUCKET} | Cycles: ${CYCLES.map(c => c.cycle).join(', ')} | Top N: ${TOP_N} | TTL: ${KV_TTL}s`);

  const runT0 = Date.now();

  // 1. Wipe existing KV entries first — prevents v1 (pruned) data from
  //    coexisting with v2 (exact) data in the namespace
  await wipeNamespace(accountId, namespaceId, apiToken);

  // 2. Open DuckDB once, reuse the connection across cycles
  const db = await DuckDBInstance.create(':memory:', {
    memory_limit:   '4GB',
    temp_directory: DUCKDB_TMP,
    threads:        '4',
  });
  const conn = await db.connect();

  let totalEntries = 0;
  let allSucceeded = true;

  for (const c of CYCLES) {
    try {
      const entries = await processCycle(s3, conn, c);
      await writeKvBulk(accountId, namespaceId, apiToken, entries, String(c.cycle));
      totalEntries += entries.length;
    } catch (err) {
      console.error(`\n[${c.cycle}] ✗ FAILED: ${err.stack || err.message}`);
      allSucceeded = false;
    }
  }

  // 3. Tear down DuckDB + clean up temp files
  try { await conn.close();  } catch {}
  try { await fsp.rm(DUCKDB_TMP, { recursive: true, force: true }); } catch {}
  try { await fsp.rm(TMP_DIR,    { recursive: true, force: true }); } catch {}

  const elapsed = ((Date.now() - runT0) / 1000).toFixed(1);
  console.log(`\n${allSucceeded ? '✓' : '✗'} Run complete — ${totalEntries.toLocaleString()} total KV entries written across ${CYCLES.length} cycles (${elapsed}s)`);

  if (!allSucceeded) process.exit(1);
}

main().catch(err => {
  console.error('[precompute] Fatal:', err);
  process.exit(1);
});
