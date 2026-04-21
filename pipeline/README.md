# FECLedger Bulk Data Pipeline

Downloads FEC bulk contribution files daily, strips them to the columns the product needs, stores them in Cloudflare R2, then pre-computes per-committee top-contributor aggregations into Cloudflare KV for fast read-time access by the product surface.

---

## Architecture

Three components, one workflow:

| Component | Role | Schedule |
|---|---|---|
| **GitHub Actions step 1 — ingest** (`scripts/ingest-bulk.js`) | Downloads all 72 FEC bulk files (3 file types × 24 cycles, 1980–2026), strips indiv files to 14 columns and cm files to 2 columns (CMTE_ID + CMTE_NM), uploads pipe-delimited CSVs to R2 | Daily, 6am UTC |
| **GitHub Actions step 2 — pre-compute** (`scripts/precompute-aggregations.js`) | Reads pas2 + indiv + cm CSVs from R2, runs DuckDB SQL GROUP BY queries (spill-to-disk, 100% accurate), writes top-25 contributors per in-scope committee per cycle to Cloudflare KV namespace `fecledger-aggregations`. Two aggregation passes per cycle: individual contributors (from indiv) and committee contributors (from pas2, LEFT-JOINed against cm.txt for display names). Per-cycle skip logic via `pipeline_state.json` avoids redundant SQL on cycles whose source files haven't changed. | Same job as ingest — daily, 6am UTC |
| **Cloudflare Worker** (`pipeline/src/index.js`) | HTTP trigger for ad-hoc testing; no scheduled processing | On-demand only |

Both processing steps run in GitHub Actions, in the same job (ingest first, then pre-compute). The Worker's `FILES` array is empty — it exists solely so the HTTP endpoint (`/admin/pipeline/run`) remains available for development and debugging.

KV details (key format `top_contributors:{cmte_id}:{cycle}`, scope rules, value shape) are documented in CLAUDE.md → "Bulk data pipeline" → Session 2 note. The KV namespace is bound to the fecledger Pages project as `AGGREGATIONS` for read access from Pages Functions.

---

## Feature flag — `ENABLE_TOP_COMMITTEES_PASS`

`scripts/precompute-aggregations.js` contains a second aggregation pass over pas2 that writes the `top_committees:{cmte_id}:{cycle}` key pattern (committee-to-committee contribution data for committee.html's Top Committee Contributors card). The pass is gated behind `const ENABLE_TOP_COMMITTEES_PASS` at the top of the file and is **currently enabled** (as of 2026-04-21, Session 4B).

History: shipped 2026-04-20, disabled same day after discovering pas2's `NAME` column stores the recipient's name (Schedule B `recipient_name`), not the giver's. Re-enabled 2026-04-21 after ingesting FEC's Committee Master File (`cm.txt`) and wiring it into `buildCommitteesAggSql()` as the authoritative `committee_id → registered_name` source via LEFT JOIN on both giver and receiver. Strategy doc: `strategy/cm-txt-integration.md` (executed). Flipping the flag back off is supported — `buildCommitteesAggSql()` and its linear-scan block in `processCycle()` are structured to be skipped cleanly.

---

## Files processed

Coverage: **all cycles 1980–2026** (24 cycles × 3 file types = 72 files). Historical backfill (1980–2020) landed 2026-04-21. Schemas are stable across all cycles (verified empirically before backfill): indiv = 21 cols, pas2 = 22 cols, cm = 15 cols. Files are 404 at 1978 and earlier.

| File type | FEC source pattern | R2 destination | Columns | Size range |
|---|---|---|---|---|
| **indiv** | `fec.gov/files/bulk-downloads/{year}/indiv{yy}.zip` | `fec/indiv/{year}/indiv.csv` | 14 of 21 | 4.5 MB (1982) → 5.87 GB (2020) compressed |
| **pas2** | `fec.gov/files/bulk-downloads/{year}/pas2{yy}.zip` | `fec/pas2/{year}/pas2.csv` | all 22 | 3.9 MB (1980) → 29 MB (2020) compressed |
| **cm** | `fec.gov/files/bulk-downloads/{year}/cm{yy}.zip` | `fec/cm/{year}/cm.csv` | 2 of 15 | 360 KB → 880 KB per cycle |

**indiv** = individual contributions (Schedule A). Most recent cycles are 1.5–5.87 GB compressed / 4.5+ GB uncompressed; historical cycles (1980–2014) are 4–200 MB. Filtered to 14 columns to reduce storage and query cost:

```
CMTE_ID | ENTITY_TP | NAME | CITY | STATE | ZIP_CODE | EMPLOYER | OCCUPATION
TRANSACTION_DT | TRANSACTION_AMT | OTHER_ID | MEMO_CD | MEMO_TEXT | SUB_ID
```

`MEMO_CD='X'` rows (conduit entries — ActBlue, WinRed, Anedot) are retained.

**pas2** = committee-to-committee transfers (Schedule B). ~23 MB compressed. All 22 columns retained (FEC schema includes `CAND_ID` — the candidate the transaction supports — between `OTHER_ID` and `TRAN_ID`; an earlier version of the ingest header omitted this column, breaking strict CSV parsers downstream — fixed 2026-04-17).

**cm** = Committee Master File. ~1 MB compressed / ~2 MB uncompressed each, ~19K rows per cycle. FEC schema has 15 columns; filtered at ingest to just `CMTE_ID | CMTE_NM` (the registered committee name), which is everything `buildCommitteesAggSql()` needs as the authoritative `committee_id → registered_name` source. No header row in the source — one is prepended at ingest to match the indiv/pas2 pattern. DuckDB reads use `quote=''` because `CMTE_NM` contains literal `"` chars in some rows (e.g. `CONSTANCE "CONNIE" JOHNSON`) that would otherwise be misparsed as quoted-field delimiters.

---

## R2 bucket structure

Bucket: `fecledger-bulk`

```
fec/
  indiv/
    1980/indiv.csv   …   2026/indiv.csv   ← 24 cycles
  pas2/
    1980/pas2.csv    …   2026/pas2.csv    ← 24 cycles
  cm/
    1980/cm.csv      …   2026/cm.csv      ← 24 cycles
  meta/
    pipeline_state.json   ← per-file Last-Modified + per-cycle precompute state
  last_updated.json       ← { "indiv": "<ISO>", "pas2": "<ISO>", "cm": "<ISO>" } — run completion time
```

All CSVs are pipe-delimited (`|`), not comma-delimited. The format was chosen for compatibility with DuckDB-WASM, which reads pipe-delimited files natively.

---

## Conditional fetching + precompute skip

`fec/meta/pipeline_state.json` carries two kinds of state — flat per-file Last-Modified values used by ingest, and a nested `precompute` object used by precompute's skip logic:

```json
{
  "indiv20": "<Last-Modified GMT string>",
  "pas220":  "<Last-Modified GMT string>",
  "cm20":    "<Last-Modified GMT string>",
  ...
  "precompute": {
    "1980": { "indiv": "...", "pas2": "...", "cm": "..." },
    "1982": { "indiv": "...", "pas2": "...", "cm": "..." },
    ...
    "2026": { "indiv": "...", "pas2": "...", "cm": "..." }
  }
}
```

**Ingest** (`scripts/ingest-bulk.js`) — HEAD-checks each FEC URL's `Last-Modified` against the flat `state[${type}${yy}]` key. Unchanged → skip. Changed or missing → download, process, write new Last-Modified to state. State is written after each individual file succeeds so partial runs preserve progress on already-completed files.

**Precompute** (`scripts/precompute-aggregations.js`) — for each cycle, compares the current ingest-side tuple `{ state[indiv{yy}], state[pas2{yy}], state[cm{yy}] }` against `state.precompute[year]`. If all three match, the cycle's SQL + KV work is skipped. If the ingest-side keys are missing entirely (cycle not yet ingested), the cycle is also skipped (with a distinct log line). Otherwise, the cycle runs fully, then `state.precompute[year]` is updated to the current tuple after the KV writes succeed — so a mid-run failure re-attempts this cycle on the next run rather than being silently skipped.

The FEC URL redirects to S3 (302). Node.js `fetch` follows this automatically; the `Last-Modified` header comes from the final S3 response with no special handling needed.

On a typical daily run after the initial full backfill, all 72 ingest files are skipped (304-equivalent) and all but the active cycles (typically just 2026 while current) are skipped in precompute. The job completes in ~8 minutes. Historical cycles (1980–2020) never re-run after backfill unless FEC republishes a file.

---

## Manual triggers

**GitHub Actions (recommended for full runs):**

1. Go to the repo → Actions → `FEC bulk data pipeline`
2. Click `Run workflow` → `Run workflow`

The workflow respects conditional fetching — files unchanged since the last run will be skipped.

**Worker HTTP trigger (development / debugging):**

```bash
# Trigger the Worker's HTTP handler (no-op with empty FILES array, useful for health-check)
curl "https://fecledger-pipeline.sloanestradley.workers.dev/admin/pipeline/run"
# → 202 { "ok": true, "triggered": "all", "ts": "..." }
```

The Worker processes no files (FILES is empty). This endpoint is useful for confirming the Worker is deployed and reachable.

---

## Verifying a run

After a successful GitHub Actions run, check R2 via the Cloudflare dashboard or wrangler:

```bash
# List R2 bucket contents (from pipeline/ directory)
cd pipeline && npx wrangler r2 object get fecledger-bulk/fec/last_updated.json --file /tmp/last_updated.json && cat /tmp/last_updated.json
# → { "indiv": "2026-04-16T06:31:44.000Z", "pas2": "2026-04-16T06:31:44.000Z" }

npx wrangler r2 object get fecledger-bulk/fec/meta/pipeline_state.json --file /tmp/state.json && cat /tmp/state.json
# → { "indiv22": "Sun, 13 Apr 2026 ...", "indiv24": "...", ... }
```

Both files present with recent timestamps = pipeline healthy.

---

## Authentication

Two separate credential types are required:

| Credential | Used for | Where to create |
|---|---|---|
| **R2 API Token** (`R2_ACCESS_KEY_ID` + `R2_SECRET_ACCESS_KEY`) | Writing to R2 from GitHub Actions | Cloudflare Dashboard → R2 → Manage R2 API Tokens |
| **General Cloudflare API Token** (`CLOUDFLARE_API_TOKEN`) | Deploying the Worker via Wrangler | Cloudflare Dashboard → My Profile → API Tokens |

**Critical:** A general Cloudflare API token will not authenticate to the R2 S3-compatible API. You need a dedicated R2 API Token for R2 reads/writes.

All credentials are stored as GitHub repository secrets. The Worker is deployed using `CLOUDFLARE_API_TOKEN` via Wrangler from a local machine — it is not deployed via CI.

---

## Deploying the Worker

The Worker is not deployed automatically. Deploy manually after making changes to `src/index.js` or `wrangler.toml`:

```bash
cd pipeline
npm install
npx wrangler deploy
```

Requires `CLOUDFLARE_API_TOKEN` in your local environment (or set via `wrangler login`).

---

## Why not Cloudflare Workers for all files?

The `indiv` files are ~4.5 GB uncompressed each. Cloudflare Workers have a 128 MB memory limit and a CPU time limit — both are binding constraints regardless of streaming implementation. The Worker architecture was tried and confirmed infeasible before GitHub Actions was adopted. The streaming code (`processZip`, `filterColsBinary`) is retained in `src/index.js` for reference and potential future use with smaller files.
