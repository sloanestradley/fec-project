# Retiring `/candidate/{id}/history/` — investigation + recommendation

**EXECUTED 2026-05-19 (commit `c992ea7`)** — Shipped as T-history-retire. `/candidate/{id}/history/` no longer called on candidate.html. All three fields previously read from it (`first_file_date`, `election_years`, `cycles`) are sourced from `/candidate/{id}/` entity — verified 100% field match across Marie, Gillibrand, Trump, Kamala, Kellogg samples. Gillibrand entity `election_years` exposes the 2010 special election distinctly, correcting the CLAUDE.md framing of special-election visibility as a `/history/`-specific property. Implementation: removed `cachedHistoryP`, `fetchHistory()`, `/history/`-path branch in retryIndexTotals; simplified `fetchIndexData` to return `{ totalsP }` only; simplified `renderIndexFromData` signature to `(allTotalsJson)`; stashed `CAND_FIRST_FILE_DATE` module var. Helper `renderIndex` callback updated to single-arg shape. Tests +2 net (582 → 584) — regression-locks that `/history/` is NOT called on cycle-index landing or cycle-detail landing.

---

**Status:** Diagnostic / proposal. Sloane review before implementation scoping.
**Date:** 2026-05-19
**Banked from:** T-load-4a follow-ups (CLAUDE.md "Banked future work" + test-cases.md row)

---

## TL;DR

**Retirement is safe.** Every field candidate.html reads from `/history/` (`first_file_date`, `election_years`, `cycles`) is also returned by the entity endpoint `/candidate/{id}/` with identical values across the sample candidates verified.

**The Gillibrand special-election concern is unfounded.** CLAUDE.md framed special-election visibility as a `/history/`-specific property, but entity `election_years` exposes specials distinctly too (`[2010, 2012, 2018, 2024, 2030]` — identical to `/history/.election_years`). No data loss on retirement.

**Latency win is structural, not perceptual.** `/totals/?per_page=100` (up to 14s cold) is the index-view bottleneck. `/history/` (up to 8.6s cold) fires in parallel with `/totals/`, so retiring it doesn't shorten the visible loading window. The wins are: one fewer API call per candidate page load (lower rate-limit pressure, particularly in burst scenarios), simpler code, and clearer architectural intent.

**Recommendation: retire.** Even without a perceptual win, the cleanup is worth ~25–40 LOC of removals across candidate.html. Implementation pattern is mechanical.

---

## 1. `/history/` consumers inventory

candidate.html reads `/history/` data in exactly one render function — `renderIndexFromData(histJson, allTotalsJson)`. The fetch + caching infrastructure adds three additional consumer sites:

| Site | What it does | Lines |
|---|---|---|
| `var cachedHistoryP = null` | In-flight-promise cache (T-load-4a) | 443 |
| `fetchHistory()` | apiFetch wrapper with promise caching | 2171–2174 |
| `fetchIndexData()` | Returns `{ histP, totalsP }` for the helper | 2182 |
| `retryIndexTotals()` | Calls `fetchHistory()` alongside `fetchAllTotals()` on retry path | 2127 |
| `renderIndexFromData(histJson, allTotalsJson)` | Reads `histJson.results[0]` → extracts fields | 2145–2169 |

Fields actually read from the resolved `histData` object:

| Field | Used for | Fallback if missing |
|---|---|---|
| `histData.election_years` | Primary cycle list source for `renderCycleIndex` | Falls back to `histData.cycles` |
| `histData.cycles` | Secondary cycle list source | Falls back to entity's `ALL_CYCLES` |
| `histData.first_file_date` | Start year for `cstat-history` card (via `renderHistoryStrip(idxFirstFiledYear, fullTotals)`) | Bare `'—'` if missing |

**Defensive `console.warn`** at line 2052: warns if `histData.election_years` contains a year not in `ALL_CYCLES` (entity's election_years). Implies the developer who wrote the code anticipated divergence — but the sampled data shows no divergence in practice (see section 2).

That's the complete consumer inventory. Three data fields, all with entity equivalents.

---

## 2. Entity vs `/history/` comparison — sample data

Five candidates sampled live via production proxy:

| Candidate | Field | Entity (`/candidate/{id}/`) | `/history/?per_page=1` | Match? |
|---|---|---|---|---|
| Marie (H2WA03217) | `first_file_date` | `2022-02-22` | `2022-02-22` | ✓ |
| | `election_years` | `[2022, 2024, 2026]` | `[2022, 2024, 2026]` | ✓ |
| | `cycles` | `[2022, 2024, 2026]` | `[2022, 2024, 2026]` | ✓ |
| Gillibrand (S0NY00410) | `first_file_date` | `2009-01-28` | `2009-01-28` | ✓ |
| | `election_years` | `[2010, 2012, 2018, 2024, 2030]` | `[2010, 2012, 2018, 2024, 2030]` | ✓ |
| | `cycles` | `[2010, 2012, 2014, 2016, 2018, 2020, 2022, 2024, 2026]` | (same) | ✓ |
| Trump (P80001571) | `first_file_date` | `2015-06-22` | `2015-06-22` | ✓ |
| | `election_years` | `[1988, 2016, 2020, 2024]` | `[1988, 2016, 2020, 2024]` | ✓ |
| | `cycles` | `[1988, 2012, 2016, 2018, 2020, 2022, 2024, 2026]` | (same) | ✓ |
| Kamala (P00009423) | `first_file_date` | `2019-01-21` | `2019-01-21` | ✓ |
| | `election_years` | `[2020, 2024]` | `[2020, 2024]` | ✓ |
| | `cycles` | `[2020, 2022, 2024, 2026]` | (same) | ✓ |
| Kellogg (H6WA03309) | `first_file_date` | `2025-11-14` | `2025-11-14` | ✓ |
| | `election_years` | `[2026]` | `[2026]` | ✓ |
| | `cycles` | `[2026]` | `[2026]` | ✓ |

**100% field match across all five candidates.** No divergences. Entity is a safe substitute for every field candidate.html currently reads from `/history/`.

### Multi-record `/history/` check

`/history/` returns one record per 2-year FEC reporting period when paginated higher than 1. Sampled Gillibrand at `per_page=20`: 9 records returned, each with `two_year_period` varying (2026/2024/2022/…) but `office`/`party`/`state`/`first_file_date`/`election_years`/`cycles` IDENTICAL across all records. The `per_page=1` request returns the most-recent two_year_period record, but every field candidate.html reads is career-wide and consistent across all records. **No multi-record data is being missed by `per_page=1`** — and consequently no multi-record data is lost by retirement.

### Edge case considered: candidates who changed office or party mid-career

The per-record `office`/`party`/`state` on `/history/` records could in principle differ for a candidate who switched offices or parties between cycles. Entity only returns the candidate's CURRENT (latest) office/party/state. If candidate.html ever needed to surface a per-cycle office change, `/history/` multi-record would be the only source.

candidate.html does NOT currently use per-cycle office/party. The meta-row tags reflect the candidate's current office (from entity). No regression on retirement.

---

## 3. Special-election handling — verification

CLAUDE.md banks: "Partial exception discovered 2026-04-23: the `/candidate/{id}/history/` endpoint's `election_years` field DOES expose special elections as distinct cycle entries — Gillibrand (S0NY00410) shows 2010 (special election win after Clinton appointment) and 2012 (regular cycle) as separate entries in the candidate cycle index..."

**Verification result: entity `election_years` ALSO exposes specials distinctly.**

Live query on Gillibrand `/candidate/S0NY00410/`:
```
election_years: [2010, 2012, 2018, 2024, 2030]
```

Live query on Gillibrand `/candidate/S0NY00410/history/?per_page=1`:
```
election_years: [2010, 2012, 2018, 2024, 2030]
```

Identical array. Both endpoints expose Gillibrand's 2010 special election as a distinct cycle entry; both correctly produce her career as 5 election cycles (1 special + 4 regular).

**The CLAUDE.md note framed this as a `/history/`-specific property — that framing is incorrect.** Special-election visibility is an entity property too. CLAUDE.md should be updated when implementation lands. (Note: the same CLAUDE.md paragraph correctly identifies `/elections/search/` as the endpoint that DOESN'T expose specials — that part stays accurate.)

No data loss on retirement.

---

## 4. Latency analysis

### What T-load-1 measured

From `strategy/t-load-1-skeleton-header.md` and the T-load-1 commit message:
- `/candidate/{id}/` (entity): up to 43s on cold cache
- `/candidate/{id}/totals/`: up to 14s on cold cache
- `/candidate/{id}/history/`: up to 8.6s on cold cache

### How they interact on candidate.html cycle-index load

The flow:
1. `init()` awaits `apiFetch('/candidate/{id}/')` — entity blocks here (longest single call, up to 43s cold)
2. After entity resolves, `init()` continues synchronously to `view.switchTo`
3. `view.switchTo` else branch: `fetchIndexData()` returns `{histP, totalsP}` (both promises in flight)
4. `await Promise.all([histP, totalsP])` — waits for the slower of the two

Step 4's wait time = `max(history, totals)`. Since `/totals/` (14s) is consistently longer than `/history/` (8.6s) in the measured cold-cache case, `/totals/` is the bottleneck. Retiring `/history/` reduces Step 4's wait from `max(14, 8.6) = 14s` to `14s` — **no user-visible change**.

### Other latency contexts

| Context | Bottleneck | Win from retirement? |
|---|---|---|
| Cold-cache cycle-index load | `/totals/` (14s+) | None — `/history/` finishes before `/totals/`, retirement saves no time |
| Warm-cache cycle-index load | likely `/totals/` (~hundreds of ms) | Minimal — one HTTP round-trip removed, but `/totals/` still bounds the wait |
| Detail-view loadCycle path | Doesn't fetch `/history/` | n/a |
| Cycle-switch (within candidate page) | Index data is cached after first load | n/a — cached promise reuse skips both |
| Rate-limit budget | All visitors share the FEC API key (now server-side, but shared) | Real — one fewer API call per candidate page load, ~50% reduction in index-view rate impact |

**Conclusion: retirement saves no user-visible loading time. The wins are structural — rate-limit pressure, code simplicity, and architectural clarity.**

---

## 5. Recommended treatment + scope estimate

**Recommendation: retire `/candidate/{id}/history/` on candidate.html.** Even without a perceptual latency win, the cleanup is worth the effort:

- One fewer API call per candidate page load (lower rate-limit pressure in burst scenarios — e.g., election night traffic)
- Simpler code (single-key `fetchIndexData` shape, no `fetchHistory()` helper, no histData unpacking in render)
- Removes the misleading `histData.election_years || histData.cycles || ALL_CYCLES` fallback chain (the entity is the canonical source for the same data)
- Aligns code intent with the actual data model — entity provides candidate-level cycle info; `/history/` is for per-cycle-history queries which we don't make

### Implementation scope

| Element | Change | Approx LOC |
|---|---|---|
| `cachedHistoryP` module var | Delete | -2 |
| `fetchHistory()` function | Delete | -4 |
| `fetchIndexData()` | Return `{ totalsP }` only (single key) | -1 net |
| `renderIndexFromData()` signature | `(histJson, allTotalsJson)` → `(allTotalsJson)` — drop histJson param; read first-file-date from a new module var `CAND_FIRST_FILE_DATE` stashed at entity-resolve time | -4 net |
| Stash `CAND_FIRST_FILE_DATE` in init() | New module var alongside `CAND_STATE`/`CAND_OFFICE`/etc.; assigned in init() after entity resolves (line ~2102 area) | +2 |
| `retryIndexTotals()` | Remove `fetchHistory()` call, simplify to single fetch | -3 |
| Helper config `renderIndex` callback | `function(data) { renderIndexFromData(data.totals); }` (was `data.hist, data.totals`) | -1 |
| **Test updates** | The "back navigation doesn't refire" test counts `/totals/?per_page=100` requests — unchanged. No `/history/`-counting assertion currently exists. May want to ADD a regression-lock assertion that `/history/` is NOT called (page.route + counter) — small new test or extension of existing | +5–10 (optional regression lock) |
| **Doc updates** | CLAUDE.md: update the "Partial exception discovered 2026-04-23" note (special-election visibility is NOT `/history/`-specific); update T-load-4a paragraph (drop `/history/` retirement from banked follow-ups). TESTING.md describe-block text. test-cases.md row. | +10 |

**Total estimated change: ~15 LOC of code removal + ~10 LOC of doc updates + optional ~10 LOC of regression-lock test.** Most of the LOC budget is in deletions and doc cleanup.

### Mechanical implementation outline

1. **Stash entity field** in init() after `await apiFetch('/candidate/'+CANDIDATE_ID+'/')` resolves:
   ```js
   CAND_FIRST_FILE_DATE = cand.first_file_date || null;
   ```
   Declare `var CAND_FIRST_FILE_DATE = null;` alongside `CAND_STATE` etc.

2. **Simplify renderIndexFromData**:
   ```js
   function renderIndexFromData(allTotalsJson) {
     var fullTotals = (allTotalsJson.results || []).filter(function(r) { return r.election_full; });
     var totalsMap  = {};
     fullTotals.forEach(function(r) { totalsMap[r.candidate_election_year] = r; });
     var idxFirstFiledYear = CAND_FIRST_FILE_DATE ? String(CAND_FIRST_FILE_DATE).slice(0, 4) : null;
     renderHistoryStrip(idxFirstFiledYear, fullTotals);
     renderCycleIndex(ALL_CYCLES, totalsMap, CAND_OFFICE);
   }
   ```
   Uses `ALL_CYCLES` directly (entity-sourced — already in scope). The `historyCycles || histData.cycles || ALL_CYCLES` fallback collapses to just `ALL_CYCLES`. Defensive `console.warn` is deleted (no source-of-truth divergence to warn about — entity IS the source).

3. **Simplify fetchIndexData**:
   ```js
   function fetchIndexData() {
     return { totalsP: fetchAllTotals() };
   }
   ```

4. **Delete fetchHistory and cachedHistoryP**.

5. **Simplify retryIndexTotals**:
   ```js
   function retryIndexTotals() {
     cachedAllTotalsP = null;
     var myToken = view.claimToken();
     renderIndexScaffold();
     fetchAllTotals()
       .then(function(totalsRes) {
         if (!view.isCurrentToken(myToken)) return;
         renderIndexFromData(totalsRes);
       })
       .catch(function(err) {
         if (!view.isCurrentToken(myToken)) return;
         onPartialError(err);
       });
   }
   ```

6. **Update helper config**:
   ```js
   renderIndex: function(data) { renderIndexFromData(data.totals); },
   ```

7. **CLAUDE.md note correction**: the "Partial exception discovered 2026-04-23" paragraph in the architectural-debt section frames Gillibrand's 2010 special-election visibility as a `/history/`-specific feature. Update to reflect that entity exposes it too. The `/elections/search/` part of the same note stays accurate (that endpoint still doesn't expose specials).

### Test treatment

The existing T-load-4a tests pass through cached-promise paths and partial-data retry — none reference `/history/` directly. They should continue to pass after retirement.

**Optional regression-lock test**: add to the candidate `T-load-4a progressive cycle-index` describe block:
```js
test('/candidate/{id}/history/ is no longer called (post-retirement regression lock)', async ({ page }) => {
  let historyCalled = false;
  page.on('request', (req) => {
    if (/\/api\/fec\/candidate\/[^/]+\/history\//.test(req.url())) historyCalled = true;
  });
  await mockAmplitude(page);
  await mockFecApi(page);
  await page.goto('/candidate.html?id=H2WA03217');
  await page.waitForSelector('#cycle-index.visible', { timeout: 12000 });
  expect(historyCalled).toBe(false);
});
```

Test count delta: +1 if the regression lock is included; +0 otherwise.

### Risks

Low. The sampling is broad (House active filer, Senate with specials, Presidential with deep history, Kamala mid-cycle launches, Kellogg newcomer with no totals). Every sample matches. The FEC data model treats entity-level fields as career-wide aggregates derived from the same upstream data that feeds `/history/` — same source, same values.

The one residual unknown: a candidate whose entity vs `/history/` somehow differs in production due to FEC data sync delays. If observed, fall-back is restoring the `/history/` call — a small revert. Code change is contained and easily reversible.

---

## Summary table

| Question | Answer |
|---|---|
| Are all `/history/` fields available from entity? | Yes — `first_file_date`, `election_years`, `cycles` all match across 5 sampled candidates |
| Does entity expose Senate special elections distinctly? | Yes — Gillibrand entity `election_years = [2010, 2012, 2018, 2024, 2030]`, identical to `/history/` |
| Latency win from retirement? | None user-visible (`/totals/` is the bottleneck; `/history/` fires in parallel and finishes earlier) |
| Other wins? | Lower rate-limit pressure, simpler code, clearer architectural intent |
| Implementation scope | ~15 LOC code removal + ~10 LOC doc updates + optional ~10 LOC regression-lock test |
| Risk | Low — broad sampling matched 100%; rollback is contained |
| Recommendation | Retire |
