#!/usr/bin/env node
/**
 * FECLedger — KV pre-computation of top contributors per committee (DuckDB)
 *
 * Runs after scripts/ingest-bulk.js in the same GitHub Actions job.
 *
 * Architecture (v2, 2026-04-17; extended 2026-04-21 for historical backfill):
 *   The v1 streaming-Map approach worked but used mid-stream pruning to bound
 *   memory — which sacrifices accuracy for mega-committees (ActBlue, WinRed,
 *   etc.) because a pruned contributor loses their prior accumulation. v2
 *   replaces the aggregation engine with DuckDB, which does external (spill-
 *   to-disk) GROUP BY natively. Bounded memory, zero accuracy compromise.
 *
 * For each cycle in CYCLES (1980..2026):
 *   0. Check skip conditions against fec/meta/pipeline_state.json (shared
 *      with ingest-bulk.js). Skip if ingest hasn't completed for this cycle
 *      yet, OR if the three source files' Last-Modified tuple matches the
 *      value stored at the last successful precompute for this cycle.
 *   1. Download fec/pas2/{year}/pas2.csv, fec/indiv/{year}/indiv.csv, and
 *      fec/cm/{year}/cm.csv from R2 to local /tmp disk (runner has ~14 GB
 *      free; per-cycle cleanup keeps peak usage at one cycle's files)
 *   2. Run DuckDB SQL that filters, aggregates, scope-filters, and ranks —
 *      returning top 25 per committee, ordered by (cmte_id, rank)
 *   3. Iterate result rows, group by cmte_id in a linear scan, build KV
 *      entries with keys `top_contributors:{cmte_id}:{cycle}` and (when
 *      the second-pass flag is enabled) `top_committees:{cmte_id}:{cycle}`
 *   4. Scoped KV wipe — delete only keys ending in `:${cycle}` so stale
 *      committees don't persist across runs. Per-cycle so cycles that
 *      skipped don't get their KV cleared.
 *   5. Bulk-write new KV entries
 *   6. Persist state.precompute[year] = currentTuple to R2, mirroring
 *      ingest's per-file state-write-on-success pattern. Writing after
 *      the KV work succeeds gives the same partial-failure recovery:
 *      a mid-run failure leaves earlier cycles' state intact.
 *   7. Delete local CSVs to reclaim disk
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
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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
  { year: '1980', cycle: 1980 },
  { year: '1982', cycle: 1982 },
  { year: '1984', cycle: 1984 },
  { year: '1986', cycle: 1986 },
  { year: '1988', cycle: 1988 },
  { year: '1990', cycle: 1990 },
  { year: '1992', cycle: 1992 },
  { year: '1994', cycle: 1994 },
  { year: '1996', cycle: 1996 },
  { year: '1998', cycle: 1998 },
  { year: '2000', cycle: 2000 },
  { year: '2002', cycle: 2002 },
  { year: '2004', cycle: 2004 },
  { year: '2006', cycle: 2006 },
  { year: '2008', cycle: 2008 },
  { year: '2010', cycle: 2010 },
  { year: '2012', cycle: 2012 },
  { year: '2014', cycle: 2014 },
  { year: '2016', cycle: 2016 },
  { year: '2018', cycle: 2018 },
  { year: '2020', cycle: 2020 },
  { year: '2022', cycle: 2022 },
  { year: '2024', cycle: 2024 },
  { year: '2026', cycle: 2026 },
];

// Feature flag — top_committees:* KV key pattern.
// History: shipped 2026-04-20; disabled same day after realizing pas2 NAME
// is the RECIPIENT's name (Schedule B recipient_name), not the giver's —
// which made Marie-for-Congress appear as its own top contributor whenever
// an affiliated JFA wrote "MARIE FOR CONGRESS" as recipient_name. Re-enabled
// after wiring FEC's cm.txt Committee Master File as the authoritative
// committee_id → registered_name source (see buildCommitteesAggSql below).
const ENABLE_TOP_COMMITTEES_PASS = true;

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

// pas2: 22 columns per FEC schema. We only read CMTE_ID but the columns map
// must be complete. Note: the header row in the R2 CSV is currently 21
// columns (missing CAND_ID) due to a pre-existing bug in ingest-bulk.js's
// PAS2_HEADER constant. Data rows are correctly 22 cols. We bypass the
// bad header row with header=false + skip=1 in read_csv so this schema
// takes precedence.
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
  CAND_ID:         'VARCHAR', // the 22nd column — candidate ID this transaction supports
  TRAN_ID:         'VARCHAR',
  FILE_NUM:        'VARCHAR',
  MEMO_CD:         'VARCHAR',
  MEMO_TEXT:       'VARCHAR',
  SUB_ID:          'VARCHAR',
};

// cm.txt: 2 columns after ingest (filtered down from FEC's 15-col schema by
// BulkProcessingStream). A `CMTE_ID|CMTE_NM\n` header row is prepended at
// ingest time, so we read with skip=1 to mirror the pas2/indiv pattern.
//
// quote='' is required because CMTE_NM contains literal double-quote chars in
// some rows (e.g. `CONSTANCE "CONNIE" JOHNSON FOR UNITED STATES SENATOR`,
// `...OGLE "JOOGLE"...`). The fields themselves are NOT quoted — the `"` is
// embedded content. DuckDB's default quote='"' would misinterpret these as
// quoted-field delimiters and drop the row or fold fields together. Disabling
// quote processing is safe because the data has no CSV-style quoting convention.
const CM_COLUMNS = {
  CMTE_ID: 'VARCHAR',
  CMTE_NM: 'VARCHAR',
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

// Per-cycle scoped wipe — deletes only keys ending in `:${cycle}`. The KV list
// API supports prefix filtering but not suffix, so we paginate the full list
// and filter client-side by cycle suffix. Called before writing new entries
// for a cycle so that removed committees don't leave stale data behind.
async function wipeCycleKeys(accountId, namespaceId, apiToken, cycle) {
  const t0         = Date.now();
  const suffix     = `:${cycle}`;
  let cursor       = null;
  let totalDeleted = 0;

  do {
    const listUrl = cursor
      ? `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys?cursor=${encodeURIComponent(cursor)}`
      : `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`;

    const listBody = await kvFetch(listUrl,
      { headers: { Authorization: `Bearer ${apiToken}` } },
      `[wipe-${cycle}/list]`);

    const keys = (listBody.result || [])
      .map(k => k.name)
      .filter(name => name.endsWith(suffix));

    if (keys.length > 0) {
      const delUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk/delete`;
      await kvFetch(delUrl, {
        method:  'POST',
        headers: { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify(keys),
      }, `[wipe-${cycle}/delete]`);
      totalDeleted += keys.length;
    }

    cursor = listBody.result_info?.cursor || null;
  } while (cursor);

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  if (totalDeleted > 0) {
    console.log(`[${cycle}] Wiped ${totalDeleted.toLocaleString()} existing KV keys in ${elapsed}s`);
  } else {
    console.log(`[${cycle}] No existing KV keys to wipe (${elapsed}s)`);
  }
  return totalDeleted;
}

// ---------------------------------------------------------------------------
// pipeline_state.json — read/write (shared schema with ingest-bulk.js)
//
// Ingest writes flat per-file keys `${type}${yy}` mapping to the FEC
// Last-Modified string (e.g. `indiv20`, `pas220`, `cm20`).
//
// Precompute adds a nested `precompute` object keyed by 4-digit cycle year,
// storing the tuple of Last-Modified values that was in effect at the moment
// this cycle's precompute last succeeded:
//
//   {
//     "indiv20": "Wed, 01 Jan 2025 12:00:00 GMT",
//     ...
//     "precompute": {
//       "2020": { "indiv": "...", "pas2": "...", "cm": "..." },
//       ...
//     }
//   }
//
// Skip semantics: at the start of each cycle, compare the current ingest-side
// tuple against state.precompute[year]. If all three values match, the source
// files haven't changed since the last successful precompute and we skip the
// cycle's SQL + KV work entirely.
// ---------------------------------------------------------------------------

async function readPipelineState(s3) {
  try {
    const resp   = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: 'fec/meta/pipeline_state.json' }));
    const chunks = [];
    for await (const chunk of resp.Body) chunks.push(chunk);
    return JSON.parse(Buffer.concat(chunks).toString());
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

async function writePipelineState(s3, state) {
  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         'fec/meta/pipeline_state.json',
    Body:        JSON.stringify(state, null, 2),
    ContentType: 'application/json',
  }));
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
  // header=false + skip=1: ignore the (buggy 21-col) header row and parse
  // raw 22-column data using our schema. null_padding handles any
  // malformed short rows gracefully.
  //
  // parallel=false: DuckDB's parallel CSV scanner cannot handle null_padding
  // in combination with quoted newlines (field values with literal \n inside
  // double-quoted strings, which appear in modern FEC data like OCCUPATION /
  // EMPLOYER strings from 2012 onward). Serial scan works with any row shape;
  // read time difference is dominated by the downstream GROUP BY spill so
  // the practical runtime impact is small. Trigger seen 2026-04-21 on 2022
  // indiv line 8,755,603 — same hazard applies to pas2 as a defensive guard.
  //
  // strict_mode=false + ignore_errors=true: historical FEC files have rows
  // containing literal " inside field content that isn't CSV-quoted — e.g.
  // pas2 1984 line 63877 has NAME="GRAMMIES" FOR BARTON where the quotes are
  // part of the committee's actual branding. Same class of issue as cm.txt
  // (which uses quote=''), but we can't disable quoting here because modern
  // FEC data DOES use legitimate CSV quoting for fields with embedded \n or
  // |. strict_mode=false makes the parser lenient — it recovers from quote
  // errors per-row and preserves data when it can. ignore_errors=true is a
  // safety net for any row that still can't be cleanly recovered; without it,
  // a single unterminated quote can cause DuckDB to read forward consuming
  // many following rows before the whole block gets thrown out.
  return `
    CREATE OR REPLACE TABLE pas2_recipients AS
    SELECT DISTINCT CMTE_ID AS cmte_id
    FROM read_csv(
      '${pas2Path.replace(/'/g, "''")}',
      delim='|', header=false, skip=1, quote='"', parallel=false,
      strict_mode=false, ignore_errors=true,
      columns=${pas2Schema}, auto_detect=false, null_padding=true
    )
    WHERE CMTE_ID IS NOT NULL AND CMTE_ID != '';
  `;
}

// Pas2 aggregation — "who gave money to this committee?"
// Pas2 rows: CMTE_ID = giver (filer), OTHER_ID = receiver. To surface top
// contributors TO committee X we filter WHERE OTHER_ID = X and group by
// CMTE_ID (giver). any_value() on entity_type is safe — stable per giver
// within a cycle.
//
// Name source: cm.txt (Committee Master File), via LEFT JOIN on committee_id.
// The pas2 NAME column is the RECIPIENT's name (Schedule B recipient_name,
// free-form filer text that can be a DBA or affiliate-branded string) and
// can't be used as a giver display name. cm.txt provides the FEC-registered
// name for each committee_id.
//
// Two self-reference filters, belt-and-suspenders:
//
//  1. ID-level filter (giver_id != receiver): catches literal self-references
//     on the same row (rare, mis-filed amendments). Cheap, deterministic.
//
//  2. Name-level filter via cm.txt on both sides: catches affiliate transfers
//     across distinct committee_ids that share a branding name. Compare
//     upper(trim(cn_g.name)) to upper(trim(cn_r.name)). If either side is
//     absent from cm.txt (unregistered / newly registered), the filter is
//     lenient (NULL means no exclusion) so we don't over-drop.
//
// Display name for the giver falls back via COALESCE to pas2's filer NAME
// (f.name) if cm.txt has no entry — preferable to a NULL display. Note this
// is the FILER's self-reported name for its own committee, not the recipient
// field, so it's a reasonable fallback.
function buildCommitteesAggSql(pas2Path, cmPath) {
  const pas2Schema  = columnsToSqlMap(PAS2_COLUMNS);
  const cmSchema    = columnsToSqlMap(CM_COLUMNS);
  const pas2PathEsc = pas2Path.replace(/'/g, "''");
  const cmPathEsc   = cmPath.replace(/'/g, "''");
  return `
    WITH committee_names AS (
      SELECT CMTE_ID AS committee_id, upper(trim(CMTE_NM)) AS name
      FROM read_csv(
        '${cmPathEsc}',
        delim='|', header=false, skip=1, quote='',
        columns=${cmSchema}, auto_detect=false, null_padding=true
      )
      WHERE CMTE_ID IS NOT NULL AND CMTE_ID != ''
        AND CMTE_NM IS NOT NULL AND CMTE_NM != ''
    ),
    pas2_raw AS (
      SELECT OTHER_ID, CMTE_ID, NAME, ENTITY_TP, TRANSACTION_AMT, MEMO_CD
      FROM read_csv(
        '${pas2PathEsc}',
        delim='|', header=false, skip=1, quote='"', parallel=false,
        strict_mode=false, ignore_errors=true,
        columns=${pas2Schema}, auto_detect=false, null_padding=true
      )
    ),
    filtered AS (
      SELECT OTHER_ID AS receiver, CMTE_ID AS giver_id, NAME AS name,
             ENTITY_TP AS entity_type, TRANSACTION_AMT AS amt, MEMO_CD AS memo_cd
      FROM pas2_raw
      WHERE (MEMO_CD != 'X' OR MEMO_CD IS NULL)
    ),
    agg AS (
      SELECT f.receiver, f.giver_id,
             any_value(COALESCE(cn_g.name, upper(trim(f.name)))) AS name,
             any_value(f.entity_type)                            AS entity_type,
             SUM(f.amt)                                          AS total
      FROM filtered f
      LEFT JOIN committee_names cn_g ON cn_g.committee_id = f.giver_id
      LEFT JOIN committee_names cn_r ON cn_r.committee_id = f.receiver
      WHERE f.receiver IS NOT NULL AND f.receiver != ''
        AND f.giver_id IS NOT NULL AND f.giver_id != ''
        AND f.amt      IS NOT NULL
        AND f.giver_id != f.receiver
        AND (cn_g.name IS NULL OR cn_r.name IS NULL OR cn_g.name != cn_r.name)
      GROUP BY f.receiver, f.giver_id
    ),
    ranked AS (
      SELECT receiver, giver_id, name, entity_type, total,
             ROW_NUMBER() OVER (PARTITION BY receiver ORDER BY total DESC, giver_id ASC) AS rnk
      FROM agg
    )
    SELECT receiver, giver_id, name, entity_type, total
    FROM ranked
    WHERE rnk <= ${TOP_N}
    ORDER BY receiver, rnk;
  `;
}

function buildAggSql(indivPath) {
  const indivSchema = columnsToSqlMap(INDIV_COLUMNS);
  // any_value() picks a representative city/state per (cmte_id, name,
  // entity_type) group — returns the first non-null value encountered.
  // For donors with consistent location (the common case) this is identical
  // to the most-common value; for donors with mixed address history we get
  // one reported address rather than the most-frequent one. Accepted
  // tradeoff — an initial version using mode() ran past the 28-min historical
  // pipeline ceiling on cycle 2024's indiv file (frequency-tallying across
  // ~12M rows × millions of (donor, committee) groups was too expensive).
  return `
    WITH filtered AS (
      SELECT CMTE_ID AS cmte_id, ENTITY_TP AS entity_type, NAME AS name,
             CITY AS city, STATE AS state,
             TRANSACTION_AMT AS amt, MEMO_CD AS memo_cd
      FROM read_csv(
        '${indivPath.replace(/'/g, "''")}',
        delim='|', header=false, skip=1, quote='"', parallel=false,
        strict_mode=false, ignore_errors=true,
        columns=${indivSchema}, auto_detect=false, null_padding=true
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
      SELECT cmte_id, name, entity_type,
             any_value(city)  AS city,
             any_value(state) AS state,
             SUM(amt)         AS total
      FROM filtered
      WHERE cmte_id IS NOT NULL AND cmte_id != ''
        AND name    IS NOT NULL AND name    != ''
        AND amt     IS NOT NULL
        AND cmte_id IN (SELECT cmte_id FROM in_scope)
      GROUP BY cmte_id, name, entity_type
    ),
    ranked AS (
      SELECT cmte_id, name, entity_type, city, state, total,
             ROW_NUMBER() OVER (PARTITION BY cmte_id ORDER BY total DESC, name ASC) AS rnk
      FROM agg
    )
    SELECT cmte_id, name, entity_type, city, state, total
    FROM ranked
    WHERE rnk <= ${TOP_N}
    ORDER BY cmte_id, rnk;
  `;
}

// ---------------------------------------------------------------------------
// Per-cycle pipeline
// ---------------------------------------------------------------------------

async function processCycle(s3, conn, { year, cycle }, state) {
  const t0        = Date.now();
  const label     = String(cycle);
  const pas2Path  = path.join(TMP_DIR, `pas2-${year}.csv`);
  const indivPath = path.join(TMP_DIR, `indiv-${year}.csv`);
  const cmPath    = path.join(TMP_DIR, `cm-${year}.csv`);

  console.log(`\n[${cycle}] ── Starting ─────────────────────────────`);

  // 0. Skip-logic branch — skip cycles where (a) ingest has never run for any
  //    of the three file types, or (b) all three source files have the same
  //    Last-Modified as at the last successful precompute. See the schema
  //    comment above readPipelineState for the contract.
  const yy = year.slice(-2);
  const currentTuple = {
    indiv: state[`indiv${yy}`],
    pas2:  state[`pas2${yy}`],
    cm:    state[`cm${yy}`],
  };

  if (!currentTuple.indiv || !currentTuple.pas2 || !currentTuple.cm) {
    const missing = ['indiv', 'pas2', 'cm'].filter(t => !currentTuple[t]).join(', ');
    console.log(`[${cycle}] Skipping — ingest has not yet completed for this cycle (missing: ${missing})`);
    return { skipped: true, reason: 'no-ingest' };
  }

  const lastTuple = state.precompute?.[year];
  if (lastTuple
      && lastTuple.indiv === currentTuple.indiv
      && lastTuple.pas2  === currentTuple.pas2
      && lastTuple.cm    === currentTuple.cm) {
    console.log(`[${cycle}] Skipping — no file changes since last precompute`);
    return { skipped: true, reason: 'unchanged' };
  }

  // 1. Download all three files (pas2 for scope + committee aggregation,
  //    indiv for individual-contributor aggregation, cm.txt for the
  //    committee_id → registered_name dictionary used in the committee pass)
  await downloadFromR2(s3, `fec/pas2/${year}/pas2.csv`,   pas2Path,  `${label}/pas2`);
  await downloadFromR2(s3, `fec/indiv/${year}/indiv.csv`, indivPath, `${label}/indiv`);
  await downloadFromR2(s3, `fec/cm/${year}/cm.csv`,       cmPath,    `${label}/cm`);

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
    const [cmteId, name, entityTp, city, state, total] = row;
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
      city:        city     ?? '',
      state:       state    ?? '',
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

  console.log(`[${cycle}] top_contributors: ${entries.length.toLocaleString()} committees`);

  // 4. Second aggregation — top_committees (who gave money TO each committee,
  //    from pas2). Gated by ENABLE_TOP_COMMITTEES_PASS (see top of file).
  //    The SQL function and scan block are retained verbatim so re-enabling
  //    only requires flipping the flag once cm.txt integration lands.
  if (ENABLE_TOP_COMMITTEES_PASS) {
    console.log(`[${cycle}] Running DuckDB committee-contributors SQL...`);
    const commT0     = Date.now();
    const commReader = await conn.runAndReadAll(buildCommitteesAggSql(pas2Path, cmPath));
    const commRows   = commReader.getRows();
    const commSqlEl  = ((Date.now() - commT0) / 1000).toFixed(1);
    console.log(`[${cycle}] committee SQL done in ${commSqlEl}s — ${commRows.length.toLocaleString()} (receiver, giver) result rows`);

    let currentComm = null;
    let commCount   = 0;
    for (const row of commRows) {
      const [receiver, giverId, name, entityTp, total] = row;
      if (!currentComm || currentComm.receiver !== receiver) {
        if (currentComm) {
          entries.push({
            key:            `top_committees:${currentComm.receiver}:${cycle}`,
            value:          JSON.stringify(currentComm.list),
            expiration_ttl: KV_TTL,
          });
          commCount += 1;
        }
        currentComm = { receiver, list: [] };
      }
      currentComm.list.push({
        name,
        entity_type:  entityTp ?? '',
        committee_id: giverId  ?? '',
        total:        Math.round(Number(total)),
      });
    }
    if (currentComm) {
      entries.push({
        key:            `top_committees:${currentComm.receiver}:${cycle}`,
        value:          JSON.stringify(currentComm.list),
        expiration_ttl: KV_TTL,
      });
      commCount += 1;
    }
    console.log(`[${cycle}] top_committees: ${commCount.toLocaleString()} committees`);
  } else {
    console.log(`[${cycle}] top_committees: SKIPPED (ENABLE_TOP_COMMITTEES_PASS = false)`);
  }

  // 5. Clean up CSVs and DuckDB table for this cycle
  await fsp.unlink(pas2Path).catch(() => {});
  await fsp.unlink(indivPath).catch(() => {});
  await fsp.unlink(cmPath).catch(() => {});
  await conn.run('DROP TABLE IF EXISTS pas2_recipients');

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`[${cycle}] ✓ Cycle processing done (${elapsed}s)`);

  return { skipped: false, entries, tuple: currentTuple };
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

  // 1. Load pipeline state for skip-logic (shared with ingest-bulk.js)
  let state = await readPipelineState(s3);
  if (!state) {
    console.log('\nNo pipeline_state.json found — all cycles will be processed');
    state = {};
  } else {
    console.log('\nLoaded pipeline_state.json — cycles with unchanged source files will be skipped');
  }
  if (!state.precompute) state.precompute = {};

  // 2. Open DuckDB once, reuse the connection across cycles
  //
  // memory_limit='8GB': 2020 indiv is 9.6 GB (largest cycle in the dataset)
  // and OOMed at the 4GB cap. ubuntu-latest runners have 16 GB total RAM;
  // Node heap is 6 GB (via NODE_OPTIONS=--max-old-space-size=6144) so 8 GB
  // for DuckDB leaves ~2 GB headroom for OS + other processes. Any indiv
  // file below ~10 GB fits comfortably with spill-to-disk.
  //
  // preserve_insertion_order=false: DuckDB defaults to preserving insertion
  // order through operators, which requires extra buffering in aggregation
  // pipelines. Our queries end with ORDER BY so intermediate-stage order
  // doesn't matter — this is a free memory reduction that costs nothing.
  const db = await DuckDBInstance.create(':memory:', {
    memory_limit:   '8GB',
    temp_directory: DUCKDB_TMP,
    threads:        '4',
  });
  const conn = await db.connect();
  await conn.run('SET preserve_insertion_order=false');

  let totalEntries  = 0;
  let cyclesRun     = 0;
  let cyclesSkipped = 0;
  let allSucceeded  = true;

  for (const c of CYCLES) {
    try {
      const result = await processCycle(s3, conn, c, state);
      if (result.skipped) {
        cyclesSkipped += 1;
        continue;
      }

      // Scoped wipe of this cycle's existing KV entries before writing new ones.
      // Ensures committees that no longer appear in the current data don't
      // leave stale top-contributor / top-committee lists behind.
      await wipeCycleKeys(accountId, namespaceId, apiToken, c.cycle);

      await writeKvBulk(accountId, namespaceId, apiToken, result.entries, String(c.cycle));

      // Persist state.precompute[year] only after successful wipe + write, so
      // a mid-cycle failure re-attempts this cycle next run instead of being
      // silently skipped. Writing per-cycle also means a partial failure on
      // cycle N doesn't lose progress on cycles 1..N-1.
      state.precompute[c.year] = result.tuple;
      await writePipelineState(s3, state);

      totalEntries += result.entries.length;
      cyclesRun    += 1;
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
  console.log(`\n${allSucceeded ? '✓' : '✗'} Run complete — ${cyclesRun} cycles processed, ${cyclesSkipped} skipped, ${totalEntries.toLocaleString()} KV entries written (${elapsed}s)`);

  if (!allSucceeded) process.exit(1);
}

main().catch(err => {
  console.error('[precompute] Fatal:', err);
  process.exit(1);
});
