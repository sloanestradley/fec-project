# FECLedger Bulk Data Pipeline

Downloads FEC bulk contribution files weekly, strips them to the columns the product needs, and stores them in Cloudflare R2 for query-time access.

---

## Architecture

Two components, one purpose:

| Component | Role | Schedule |
|---|---|---|
| **GitHub Actions** (`.github/workflows/fec-bulk-pipeline.yml`) | Downloads, processes, and uploads all 6 FEC bulk files to R2 | Daily, 6am UTC |
| **Cloudflare Worker** (`pipeline/src/index.js`) | HTTP trigger for ad-hoc testing; no scheduled processing | On-demand only |

All file processing runs in GitHub Actions. The Worker's `FILES` array is empty — it exists solely so the HTTP endpoint (`/admin/pipeline/run`) remains available for development and debugging.

---

## Files processed

| FEC source | R2 destination | Columns |
|---|---|---|
| `fec.gov/files/bulk-downloads/2022/indiv22.zip` | `fec/indiv/2022/indiv.csv` | 14 of 21 (see below) |
| `fec.gov/files/bulk-downloads/2024/indiv24.zip` | `fec/indiv/2024/indiv.csv` | 14 of 21 |
| `fec.gov/files/bulk-downloads/2026/indiv26.zip` | `fec/indiv/2026/indiv.csv` | 14 of 21 |
| `fec.gov/files/bulk-downloads/2022/pas222.zip` | `fec/pas2/2022/pas2.csv` | all 21 |
| `fec.gov/files/bulk-downloads/2024/pas224.zip` | `fec/pas2/2024/pas2.csv` | all 21 |
| `fec.gov/files/bulk-downloads/2026/pas226.zip` | `fec/pas2/2026/pas2.csv` | all 21 |

**indiv** = individual contributions (Schedule A). ~1.5 GB compressed / ~4.5 GB uncompressed each. Filtered to 14 columns to reduce storage and query cost:

```
CMTE_ID | ENTITY_TP | NAME | CITY | STATE | ZIP_CODE | EMPLOYER | OCCUPATION
TRANSACTION_DT | TRANSACTION_AMT | OTHER_ID | MEMO_CD | MEMO_TEXT | SUB_ID
```

`MEMO_CD='X'` rows (conduit entries — ActBlue, WinRed, Anedot) are retained.

**pas2** = committee-to-committee transfers (Schedule B). ~23 MB compressed. All 21 columns retained.

---

## R2 bucket structure

Bucket: `fecledger-bulk`

```
fec/
  indiv/
    2022/indiv.csv
    2024/indiv.csv
    2026/indiv.csv
  pas2/
    2022/pas2.csv
    2024/pas2.csv
    2026/pas2.csv
  meta/
    pipeline_state.json   ← Last-Modified timestamps per file (conditional fetching)
  last_updated.json       ← { "indiv": "<ISO>", "pas2": "<ISO>" } — run completion time
```

All CSVs are pipe-delimited (`|`), not comma-delimited. The format was chosen for compatibility with DuckDB-WASM, which reads pipe-delimited files natively.

---

## Conditional fetching

Before downloading any file, the pipeline makes a HEAD request to its FEC URL to get the `Last-Modified` header. This header is compared against the saved value in `fec/meta/pipeline_state.json`.

- **Unchanged** → file is skipped; logged as "Skipped — Last-Modified unchanged"
- **Changed or missing from state** → file is downloaded and processed

State is written to R2 after each individual file succeeds — not just at the end — so a partial run preserves progress on already-completed files.

The FEC URL redirects to S3 (302). Node.js `fetch` follows this automatically; the `Last-Modified` header comes from the final S3 response with no special handling needed.

On a typical daily run after the initial full run, all 6 files are skipped and the job completes in seconds.

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
