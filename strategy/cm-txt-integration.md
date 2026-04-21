# FECLedger — `cm.txt` integration (Committee Master File)

> **EXECUTED 2026-04-21 (commit `12c5aaf`).** `ENABLE_TOP_COMMITTEES_PASS = true`; cm.txt is wired as the giver-name source in `buildCommitteesAggSql()`; KV verified (Marie for Congress C00806174 2024 returns real external PACs with `DIGIDEMS PAC` at #1 and no self-refs; ActBlue/DCCC still miss as expected). Doc retained as a historical reference — the up-front-verification discipline written here is the reference treatment for future pipeline work.

*Prepared as a handoff from 2026-04-20 session to a future session. Self-contained; no prior context needed.*

---

## Context

On 2026-04-20, FECLedger shipped KV-backed pre-computation for the "Top Committee Contributors" card on `committee.html` as part of Session 3's bundle (commit `05f4122`). The feature produces visually incorrect data because it stored the wrong field as the committee name.

**Root cause:** pas2 bulk data's `NAME` column stores the **recipient's** name (equivalent to Schedule B's `recipient_name` field), written as free-form text by the filer. My implementation incorrectly assumed it was the **giver's** name. For straightforward committee-to-committee contributions, `NAME` usually matches the recipient's registered FEC name — but when an affiliate filer (e.g. a JFA) contributes to a principal committee they share branding with, `NAME` holds the affiliate's recipient-naming convention (e.g. "MARIE FOR CONGRESS"), making every affiliate row look like the committee listing itself as its own top contributor. A second failure mode: some filers use a DBA in `recipient_name` (DIGIDEMS PAC wrote "DIGIDEMS LLC") so the stored display name isn't even the FEC-registered recipient name.

The bug was discovered by Sloane spotting "Marie For Congress" listed 10 times as its own top contributor at ~$10K each. A self-affiliate filter was attempted on 2026-04-20 but couldn't work because the filter had no reliable source for either giver's or receiver's canonical name.

**Interim state (as of 2026-04-20 session close):**

- `ENABLE_TOP_COMMITTEES_PASS = false` at the top of `scripts/precompute-aggregations.js`. The second SQL pass is gated off; pipeline runs no longer write `top_committees:*` KV keys, and the KV namespace wipe at the start of each run cleared any existing broken keys.
- `buildCommitteesAggSql()` function and its linear-scan block in `processCycle` are retained verbatim. Re-enabling requires flipping the flag and updating the SQL to use `cm.txt`-sourced names.
- Frontend (committee.html branch tree, render logic, data-note provenance sentence) and Pages Function route (`/api/aggregations/top-committees`) are untouched. They fall through to KV miss → live Schedule A API fallback → the pre-Session-3 behavior (which is what committee.html had before the bundle).
- `committee.html`'s empty-state copy for `topCommitteesSource === 'unavailable'` is currently "Unable to show due to high transaction volume." (restored from the pre-bundle wording per Sloane's request 2026-04-20).

## What this session solves

Reliable `committee_id → registered_name` lookup for the pas2 aggregation, by ingesting FEC's **Committee Master File (`cm.txt`)** into the pipeline.

- `cm.txt` is a pipe-delimited bulk file listing every committee registered with the FEC, keyed by `CMTE_ID`, with the committee's official `CMTE_NM` (committee name) and other registration metadata.
- Publication URL pattern: `https://www.fec.gov/files/bulk-downloads/{year}/cm{YY}.zip` — one file per cycle year (`cm22.zip`, `cm24.zip`, `cm26.zip`).
- Each file is a few MB unzipped. Incremental cost to the pipeline is negligible.
- Only two columns are needed: `CMTE_ID`, `CMTE_NM`. The rest (treasurer, address, filing frequency, organization type, etc.) can be dropped at ingest via the existing column-filter pattern.

## Scope

### 1. Ingest step — `scripts/ingest-bulk.js`

- Add three `cm.txt` entries to the `FILES` array, mirroring the existing `indiv` and `pas2` patterns:
  ```js
  { name: 'cm22',  year: '2022', type: 'cm',   url: 'https://www.fec.gov/files/bulk-downloads/2022/cm22.zip', r2Key: 'fec/cm/2022/cm.csv' },
  { name: 'cm24',  year: '2024', type: 'cm',   url: 'https://www.fec.gov/files/bulk-downloads/2024/cm24.zip', r2Key: 'fec/cm/2024/cm.csv' },
  { name: 'cm26',  year: '2026', type: 'cm',   url: 'https://www.fec.gov/files/bulk-downloads/2026/cm26.zip', r2Key: 'fec/cm/2026/cm.csv' },
  ```
- Define `CM_HEADER` constant with the full FEC cm.txt schema (for reference) and the `CM_KEEP` column keep-list as `['CMTE_ID', 'CMTE_NM']`.
- The existing `BulkProcessingStream` handles this via its column-filter branch (as used for indiv). No new stream logic needed.
- Add a `'cm'` case in the `type` switch for any file-type-specific handling.
- `fec/meta/pipeline_state.json` tracks Last-Modified per file automatically; the daily cron naturally picks up cm.txt updates.

**Verify before writing any code:** fetch the exact cm.txt column layout from the FEC description page — https://www.fec.gov/campaign-finance-data/committee-master-file-description/ — AND `head -n 2` a downloaded sample file. Confirm column count, column order, and any quirks (null patterns, quoting, encoding). Write the schema constant against the verified layout, not against assumptions. This is the pas2 21-vs-22-column lesson (Session 4A / 2026-04-17) applied proactively: a one-column-off header breaks strict CSV parsers downstream, and the bug surfaces far from the ingest step as a confusing aggregation failure. Cost of verifying up front: ~5 minutes. Cost of debugging after: a full pipeline re-run plus the follow-up commit.

### 2. Precompute step — `scripts/precompute-aggregations.js`

- Add `CM_COLUMNS` DuckDB schema constant (`CMTE_ID: VARCHAR`, `CMTE_NM: VARCHAR`).
- In `processCycle`, download `fec/cm/{year}/cm.csv` to local `/tmp` alongside pas2 + indiv. R2 download pattern matches existing code exactly.
- Rewrite `buildCommitteesAggSql()` to use cm.txt as the name source:
  ```sql
  WITH committee_names AS (
    SELECT CMTE_ID AS committee_id, upper(trim(CMTE_NM)) AS name
    FROM read_csv('/tmp/fecledger/cm-{year}.csv', delim='|', header=false, skip=1, quote='"',
                  columns=${cmSchema}, auto_detect=false, null_padding=true)
    WHERE CMTE_ID IS NOT NULL AND CMTE_NM IS NOT NULL
  ),
  filtered AS ( /* unchanged — reads pas2 */ ),
  agg AS (
    SELECT f.receiver, f.giver_id,
           any_value(cn_g.name) AS giver_name,
           any_value(f.entity_type) AS entity_type,
           SUM(f.amt) AS total
    FROM filtered f
    LEFT JOIN committee_names cn_g ON cn_g.committee_id = f.giver_id
    LEFT JOIN committee_names cn_r ON cn_r.committee_id = f.receiver
    WHERE f.receiver IS NOT NULL AND f.receiver != ''
      AND f.giver_id IS NOT NULL AND f.giver_id != ''
      AND f.amt IS NOT NULL
      AND f.giver_id != f.receiver
      AND (cn_g.name IS NULL OR cn_r.name IS NULL OR cn_g.name != cn_r.name)
    GROUP BY f.receiver, f.giver_id
  ),
  ranked AS (
    SELECT receiver, giver_id, giver_name AS name, entity_type, total,
           ROW_NUMBER() OVER (PARTITION BY receiver ORDER BY total DESC, giver_id ASC) AS rnk
    FROM agg
  )
  SELECT receiver, giver_id, name, entity_type, total
  FROM ranked WHERE rnk <= ${TOP_N} ORDER BY receiver, rnk;
  ```
- Key semantic changes from the broken version:
  - `giver_name` comes from cm.txt (`cn_g.name`), not pas2 NAME. This is the registered committee name for `giver_id` — the right field to display in a "Top Committee Contributors" table.
  - Self-affiliate filter now compares cm.txt-sourced names on both sides. Correctly excludes Marie's JFAs because they have their own distinct registered names in cm.txt (`DEMOCRACY SUMMER 2024`, etc.), and Marie's principal's registered name is `MARIE FOR CONGRESS` — the JFAs don't match, so the filter doesn't over-filter. But an affiliated committee that legitimately shares the registered name would still be filtered (rare; acceptable).
  - ID-level filter (`f.giver_id != f.receiver`) stays as belt-and-suspenders against mis-filed amendments.
  - Committees not in cm.txt (very rare — unregistered, or registered between the last pipeline run and now) fall through the lenient NULL handling. For unknown givers, `cn_g.name IS NULL` → filter is lenient; `any_value(cn_g.name)` returns NULL → display would be NULL. Fall back to `f.name` via COALESCE if you want a fallback, but it's probably fine to skip this case since anyone in the top-25 is almost certainly registered.

- Flip `ENABLE_TOP_COMMITTEES_PASS = true` at the top of the file.
- Remove the explanatory comment block from the feature flag declaration (or keep and annotate with the re-enable date).

### 3. Frontend

Zero changes. KV JSON shape stays `{name, entity_type, committee_id, total}`. The Pages Function route, `committee.html`'s KV-first branch tree, `renderCommitteeDonors`, and data-note provenance sentence all work unchanged — they just receive correct `name` values once the pipeline re-runs.

### 4. Documentation updates

- **`CLAUDE.md`**
  - Current files: add `fec/cm/{year}/cm.csv` to `ingest-bulk.js` description; add `CM_COLUMNS` mention in `precompute-aggregations.js` description.
  - Remove the `ENABLE_TOP_COMMITTEES_PASS = false` caveat from the Session 3 bundle bullet if one was added during 2026-04-20 session close.
  - Update the architectural-debt / Session roadmap note about top_committees to reflect re-enabled status with cm.txt source.
- **`project-brief.md`** — Top Committee Contributors bullet already frames the surface correctly; update to note cm.txt as the name source.
- **`test-cases.md`** — new manual test cases for:
  - Marie for Congress (C00806174): Top Committee Contributors populated with real PAC/committee names, no "MARIE FOR CONGRESS" self-refs.
  - DIGIDEMS committee (C00679191): displays as "DIGIDEMS PAC" (registered name), not "DIGIDEMS LLC".
  - ActBlue / DNC / NRSC / DCCC-class: still KV miss (the conduit-memo-rows and transfers-not-contributions gaps are unchanged; pas2 simply doesn't capture their inbound flows). Confirms the cm.txt work is scoped correctly — it fixes the display-name problem, not the pas2-coverage problem.
- **`claude-to-claude.md`** — new session entry documenting the cm.txt ingest + re-enable decision and noting this strategy doc is now fully executed (can be archived or left for reference).

### 5. Testing

- **Structural Playwright**: no changes expected; data-layer-only work.
- **Manual pre-deploy (via curl)**:
  - `curl /api/aggregations/top-committees?committee_id=C00806174&cycle=2024` — first entry should be a non-Marie PAC with a real registered name; no "MARIE FOR CONGRESS" rows anywhere.
  - Same for ActBlue, DCCC — should still return `{results:null, source:'api'}` (miss), same as during the 2026-04-20 investigation.
- **Manual post-deploy (browser)**:
  - Open `https://fecledger.pages.dev/committee/C00806174` → Raised tab → Top Committee Contributors card shows real external committee names.
  - Open a DCCC/DNC page → Top Committee Contributors still shows the API-paginated result or the "Unable to show" empty state (unchanged).

## Pipeline runtime impact

- cm.csv download: <1 second per cycle (small file).
- DuckDB LEFT JOIN on a ~few-thousand-row cm table: <1 second additional SQL time per cycle.
- Total pipeline runtime delta: under 30 seconds across both cycles.
- No memory pressure — cm.txt easily fits in memory.

## Out of scope for this session

- **Conduit mega-committee gap (ActBlue, WinRed):** Their Schedule A volume is dominated by memo rows representing individual contributions forwarded through the platform — these aren't in pas2, so no bulk-data solution exists within our current R2 inventory. Closing this gap requires a separate Schedule A pre-computation (essentially a different bulk file: `oppexp.txt` or similar), which is its own project.
- **National party committee transfers (DNC, NRSC, NRCC, DSCC, DCCC):** Their inbound money is dominated by FEC "transfers" between affiliated party committees, which is a distinct transaction type from "contributions" and isn't captured in pas2. Same scope as the conduit gap — not solvable without additional data sources.
- **Other FEC bulk files:** `cn.txt` (candidate master), `ccl.txt` (candidate-committee linkages). Would unlock other product surfaces (e.g. consistent candidate-name display on candidate.html) but not needed for this bug fix.
- **Frontend changes** beyond documentation.

## Estimated session budget

- Half a session, assuming the upfront column-layout verification above is actually done. The pas2 22-vs-21 column issue (Session 4A / 2026-04-17) and the pas2 NAME-semantics issue (2026-04-20) both stretched past their original budgets because assumptions about the data were validated reactively, after code was written and the pipeline had run. For cm.txt, a ~5-minute check against the FEC description page plus `head -n 2` on a sample file removes the biggest source of variance.
- Could stretch to a full session if the DuckDB LEFT JOIN hits an unexpected performance pattern or if cm.txt has a field-encoding quirk (non-UTF-8, unusual null markers) that requires iteration.

## Reference state at session kickoff (2026-04-20)

Commits that produced the current state:
- `05f4122` — Session 3 bundle (initial shipping of top_committees KV, now gated off).
- `361dda9` — `mode()` → `any_value()` for city/state in top_contributors.
- `ded3fdc` — candidate.html Top Individual Contributors rollback.
- `190ceb7` — self-affiliate filter attempt (supplanted; ID-level filter is worth keeping, name-level filter needs cm.txt to work).
- `6b313b0` — `ENABLE_TOP_COMMITTEES_PASS = false` (the state this session starts from).

Live site: `https://fecledger.pages.dev`.
KV namespace: `fecledger-aggregations` (Cloudflare dashboard).
Pipeline workflow: `.github/workflows/fec-bulk-pipeline.yml`.
Pages deploy: `bash scripts/deploy-pages.sh`.
