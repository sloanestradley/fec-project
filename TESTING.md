# Testing — FECLedger

Playwright-based automated tests. Two tracks: structural (mocked API, fast, runs every session) and smoke (live API, slow, run manually before deploys).

---

## Quick start

```bash
# Install dependencies (one-time)
npm install
npx playwright install chromium

# Run Track 1 — structural tests (default, mocked API)
npx playwright test

# Run Track 2 — smoke tests (live FEC API, run manually)
npm run test:smoke
# or: npx playwright test --config playwright.smoke.config.js

# Open the last HTML report
npm run test:report
```

---

## Track 1 — Structural tests (mocked API)

**Command:** `npx playwright test` or `npm test`
**When to run:** Every session, before and after making changes.
**Speed:** ~2.5 minutes for all 593 tests.

### What they test

All tests mock the FEC API (instant responses, no network) and the Amplitude SDK (events captured in-memory via the snippet's `_q` queue).

| File | What's covered |
|------|----------------|
| `tests/shared.spec.js` | Shared checks for every page (10 pages): `styles.css` linked, `main.js` linked, top nav present with four nav links (Candidates/Committees/Races/Feed) scoped to `.top-nav-links`, correct active nav link, mobile search toggle present, warm parchment background, `Page Viewed` Amplitude event fires, nav logo `.logo-fec`/`.logo-ledger` spans present, `.global-banner` precedes `.top-nav` in DOM, desktop nav search wrapped in `.search-field` with icon, desktop nav search submit button is `.sr-only` with `aria-label="Search"`, `#nav-typeahead-dropdown` present with `role=listbox`, `#mobile-nav` and `#top-nav-mobile-search` are children of `.top-nav`, mobile nav has four links |
| `tests/candidate.spec.js` | Profile header (including `#race-context` DOM presence, `.race-context-line` flex structure with `.race-context-line-label`, `.race-context-line-text`, and link (label content matches `formatRaceLabelLong()`), `#profile-header-sentinel` present for compact scroll observer, T14.5 Cycle card chevron renders on cycle detail / hidden on cycle index, Cycle card chevron aria-label = "Back to all cycles", Cycle card chevron click on fresh-load detail returns to cycle index, `#stat-cycle` shows single election year (T-cycle-semantics, 2026-05-19, was "year-range"), race tag (`.tag-neutral` via `formatRaceName()`) present in `#meta-row` between FEC ID and party, no `.candidate-race-label`, meta-row canonical order FEC ID → race → party → incumbent, scroll down adds `.compact` class, scroll to top removes `.compact` class, `.main` paddingBottom set when compact and cleared on un-compact), stats row (non-$0 financials), health banner, `#summary-strip` persistence across Summary/Raised/Spent tabs, first stat card label = "Election" (T-cycle-semantics, 2026-05-19, was "Cycle"), chart canvas, chart legend (3 money-series items only — filing deadline + election day overlays removed 2026-04-24), network assertion (neither `/reporting-dates/` nor `/election-dates/` called), tab navigation, committees modal, Amplitude events, URL hash pre-selection, API correctness (no 422 errors), Raised tab contributors: `#donors-tbody` non-empty + `.raised-cell-title` reads "Raised breakdown", Top Conduit Sources card (`#conduits-card` visible + `#conduits-tbody` contains the mocked ActBlue memo row); **index view landing state**: bare URL → `#career-strip` + `#cycle-index` visible, tabs-bar + summary-strip hidden; `#cycles` hash → also index view; CareerStrip three labels (T14): History / Career Raised / Career Spent; History cell shows year or year-range; cycle index row count matches fixture; `Page Viewed` fires with `view: 'index'`; cycle row href format; single-year label format (T-cycle-semantics, 2026-05-19); `#committees-trigger` visible; **detail view regression**: hash URL renders tabs-bar + summary-strip, career-strip hidden; **archive threshold**: pre-2008 rows are non-navigable divs with `tabindex=-1`, archive divider present; **in-place transitions (T6.5)**: no page reload on cycle-row click (DOM identity check via dataset.mark), `#profile-header` DOM node preserved across transition, index elements hidden after transition, back button returns to index, back button does not re-fetch cached data, index→detail compact-engaged case scrolls to compactThreshold (uses `cycle-index` padding inflation pattern as of 2026-04-28 — body.minHeight scaffolding masked the scrollTo-clamp class of bug; see committee.spec.js for the second-instance fix), index→detail non-compact case scrolls to 0, compact header active on index-only visit (no prior detail visit), back→index re-engages compact when restored scroll is past threshold, fetch race condition (last-clicked cycle wins); **path-segment URL ID extraction** (T10 parity, 2026-04-28): no-slash URL extracts ID, trailing-slash URL extracts ID, no-ID clean URL `/candidate` shows friendly "Browse candidates →" link, no-ID `.html` URL shows same friendly link, non-existent cycle year (`#1999#summary`) falls through to index view, invalid tab hash (`#2024#bogus`) defaults to Summary and URL gets normalized; **T11 committees-modal lazy fetch** (2026-04-29): trigger reads `Committees →` (no count); zero `/committees/` calls fire on cycle load; first modal open fires both calls; second modal open hits cache (no refire); page reload re-fires on first open; `Committees Modal Opened` Amplitude still fires on click; **T12 progressive loading** (2026-05-05): donut renders synchronously; slow-tier skeletons visible during in-flight; no skeleton flash when fetch already resolved; per-tier failure renders error UI with retry; skeleton heights ≥200px (scroll-clamp guard); spent retry refires + content resolves; **T12.5 429-aware error UI**: init-stage 429 on `/committees/?cycle=` shows rate-limit copy on Raised + Spent tabs; init-stage 500 shows init-failure copy; tab-fetch 429 hides retry button; tab-fetch non-429 keeps retry button (regression); cycle switch after 429 clears error state; donut skeleton present in DOM and hides after donut renders; **T-load-3 stats-grid skeletons** (2026-05-19): cycle-detail stat cells (raised/spent/coh/ratio) have skeleton spans in initial HTML (regex match on raw HTML), `#stat-cycle` has NO skeleton in initial HTML and hydrates synchronously from URL hash before any await (T-cycle-semantics, 2026-05-19), replaced by real values after loadCycle resolves; cycle-index career cells (cstat-history/raised/spent) have skeleton spans in initial HTML, replaced by real values after fetchIndexData resolves; **T-load-4a progressive cycle-index** (2026-05-19): scaffold renders cycle-row year labels + skeleton financial cells during /totals/ fetch (real labels via T-cycle-semantics, skeleton cells until /totals/ resolves), hydration replaces skeletons with real values, back navigation reuses cached promise (no refire), partial-data /totals/ failure renders .tab-error retry UI with dashed cells, retry click refires and hydrates on success; **T-history-retire regression lock** (2026-05-19): /candidate/{id}/history/ is NOT called on cycle-index landing or cycle-detail landing — locks the architectural retirement so a future regression that reintroduces the call gets caught; **T-loadcycle-single-fetch regression lock** (2026-05-19): cycle-detail fires exactly one /totals/?cycle= call (was 1-3 parallel iterate-and-sum calls; now single election_full=true call returns FEC's pre-aggregated record); **T-load-4b chart-card skeleton** (2026-05-20): initial-HTML overlay presence (#chart-area at 320px height floor + #chart-skeleton + #chart-error overlays), post-renderChart hydration clears skeleton + height floor, loadCycle catch path resolves skeleton to "Unable to load chart" inline-status-msg via #chart-error overlay; **T-load-header-title-skeleton regression lock** (2026-05-20): name skeleton renders at non-zero width during entity-fetch await window (was a latent bug — width:60% inside .page-title flex item resolved to 0 via CSS circular-percentage-ref; fixed to width:8em — proportional to title font-size) |
| `tests/search.spec.js` | Hero state, typeahead dropdown (2-char trigger, two groups, keyboard/click behavior), two-group results (candidates + committees), `?q=` auto-search, View all links, Amplitude events, no-results state |
| `tests/committee.spec.js` | **Detail view** (cycle-anchored URL `#2024#summary`): nav active state, profile header, FEC ID tag, stats grid (#summary-strip), 3 tabs present, Summary active by default, tab switching, `#summary-strip` persistence across tabs, first stat card label = "Cycle" (T14), cycle changes via Cycle card chevron → cycle index → row click (T16 retired the in-tabs-bar `#cycle-switcher`), committee-name title-cased, .candidate-card-office absent, filing history stub absent, URL hash updates on cycle and tab change, profile-header-sentinel present, T14.5 Cycle card chevron renders on cycle detail / hidden on cycle index, Cycle card chevron aria-label = "Back to all cycles", Cycle card chevron click on fresh-load detail returns to cycle index, `#stat-cycle` shows year-range, committee-header starts un-compact, index-view elements hidden in detail view; Raised tab: donut canvas + tooltip on candidate-contributions-and-loans segment, map container, individual donors tbody non-empty, committee donors card visible on a specific cycle, conduits card visible and populated, Top Individual Contributors card header includes cycle label (no "Most recent cycle" copy); Spent tab: donut canvas, spend-detail-bars, vendors tbody non-empty, contributions-section visible, contributions-tbody non-empty, vendors header shows cycle range (no "All time" label); **Index view landing state** (bare URL): `#career-strip` + `#cycle-index` visible, detail-view elements hidden; `#cycles` hash → also index view (NaN routing); CareerStrip 3 labels (T14): History / Lifetime Raised / Lifetime Spent; History cell shows year-range "2020–2026" from `first_file_date` + `last_file_date`; Lifetime Raised matches summed receipts ($7.6M from mock); Lifetime Spent matches summed disbursements; cycle-index row count matches `c.cycles`; rows sorted descending; cycle row labels use coverage_start_date for year range; cycle row click navigates to `#{year}#summary`; `Page Viewed` fires with `view: 'index'`; **Archive threshold** (per-test mock with pre-2008 cycle): pre-2008 row renders as non-navigable `div.cycle-row--archive` with `tabindex="-1"`; archive divider precedes archive rows with "FEC coverage begins 2008" copy (no office reference); post-2008 rows are navigable `a.cycle-row`; **All-time removal regressions**: cycle switcher has zero `value="all"` options and zero "All time" text; old `#all#summary` bookmarks land on index view (NaN fallthrough); no "All cycles" copy on detail view; no "All-cycle aggregate" copy in data note; **Terminated committee branch**: FEC ID tag still renders (the prior "Active since" prose / `.meta-prose` regression guard was retired in T21 follow-up when the prose was removed entirely); **Raised tab unavailable-state copy**: "Unable to show due to high transaction volume." when Schedule A pages > threshold; **Associated-candidate section**: assoc-list link uses bare `/candidate/{id}` URL; **In-place transitions (T10)**: no page reload on cycle-row click (DOM identity check via dataset.loadId), `#committee-header` DOM node preserved across transition, back button returns to index, back button does not re-fetch metadata or all-totals, index→detail compact-engaged case scrolls past 0 (uses `cycle-index` padding inflation pattern — body.minHeight scaffolding masked the scrollTo-clamp class of bug; second instance after T6.5; fix: minHeight stays as floor, never cleared), index→detail non-compact case scrolls to 0, compact header active on index-only visit (no prior detail visit), rapid cycle hash navigation: last cycle wins in summary stats; **path-segment URL ID extraction** (T10 parity, 2026-04-28): no-slash URL extracts ID, trailing-slash URL extracts ID (was returning "No committee specified" before .filter(Boolean) fix), no-ID clean URL `/committee` shows friendly "Browse committees →" link (was extracting `'committee'` as a literal ID before page-name guard added), no-ID `.html` URL shows same friendly link, non-existent cycle year (`#1999#summary`) falls through to index view, invalid tab hash (`#2024#bogus`) defaults to Summary and URL gets normalized; **T12 progressive loading** (2026-05-05): donut renders synchronously; slow-tier skeletons visible during in-flight; no skeleton flash when fetch already resolved; per-tier failure renders error UI with retry; skeleton heights ≥200px (scroll-clamp guard); spent retry refires + content resolves; **T12.5 429-aware error UI**: init-stage 429 on `/committee/{id}/totals/` falls through to page-level state-msg.error (no tab-error bridging needed on committee.html — tabs aren't revealed if init fails); init-stage 500 same; tab-fetch 429 on `/schedules/schedule_a/` hides retry button; tab-fetch non-429 keeps retry button (regression); cycle switch after 429 clears error state; donut skeleton attached to DOM and hides after donut renders; **T-load-3 stats-grid skeletons** (2026-05-19): cycle-detail raised/spent/coh cells have skeleton spans in initial HTML (regex match on raw HTML), `#stat-cycle` has NO skeleton in initial HTML and hydrates synchronously from URL hash before any await, cycle-detail values replace skeletons after totals resolve; cycle-index career cells (cstat-history/raised/spent) have skeleton spans in initial HTML, replaced by real values after index resolves; **T-load-4a progressive cycle-index** (2026-05-19): cstat-history entity-hydrated at scaffold (no skeleton on that cell — committee data is entity-only), career raised/spent cells hydrate after /totals/, empty-cycle case (c.cycles=[]) renders "No filing cycles on record." inside #cycle-index; **T-committee-init-defer-totals** (2026-05-20): cycle-index scaffold renders independent of /totals/ (init awaits only entity on index path; ~1500ms delayed totals does not block scaffold visibility); cycle-row click during /totals/ load shows stat skeletons until totals resolves, then renderStats re-fires via totalsP.then() populator; detail-URL cold load still awaits totals before view.switchTo (no dashed stats from empty ALL_TOTALS); **T-load-header-title-skeleton regression lock** (2026-05-20): name skeleton renders at non-zero width during entity-fetch await window (was a latent bug — width:60% inside .page-title flex item resolved to 0 via CSS circular-percentage-ref; fixed to width:8em — proportional to title font-size) |
| `tests/pages.spec.js` | races.html (page header, filter bar fields, state combo ARIA semantics + native fallback, office combo ARIA + listbox + native, cycle combo ARIA + listbox + native, results area containers), race.html (candidate cards, financial figures, cycle-anchored links), candidates.html (auto-load, search input, clean URLs, state combo ARIA, office/party/cycle combos ARIA + listbox structure + native fallback, dynamic cycle rows in listbox, filter chips, URL sync, error state, ?q= search mode, typeahead: 2-char trigger / result links / Escape key, #load-more-spinner and #end-of-results DOM presence), committees.html (state combo ARIA, type combo ARIA + listbox row count, auto-load, clean URLs, filter chips, URL sync, error state, typeahead: 2-char trigger / result links / Escape key), feed.html (results render on load, results header count, column headers, feed row structure with committee link + report tag + FEC external link, office/window/report-type filter controls, filter chips, end-of-results, error/empty states hidden, office filter interaction narrows rows, report type filter interaction narrows rows), process-log.html, design-system.html (token tables, color swatches, component card attributes), index.html redirect, mobile layout at 390px (top-nav visible, search toggle visible) and 1280px (search toggle hidden), mobile nav toggle behavior at 390px (hamburger opens/closes #mobile-nav, search toggle opens #top-nav-mobile-search, mutual exclusion between hamburger and search panel) |

### How mocking works

**FEC API:** `tests/helpers/api-mock.js` intercepts all `/api/fec/*` requests (the Cloudflare proxy path used by `utils.js`) and returns shape-correct fixture data. Pages render fully without hitting the real API. The `SCHEDULE_A_COMMITTEES` fixture includes a 3rd row with `memo_code: 'X'` (mocked as ActBlue) so both aggregation paths are exercised — the committee contributors dedup which excludes memos, and the conduit sources dedup which only includes memos.

**Amplitude:** `tests/helpers/amp-mock.js` blocks the Amplitude CDN (SDK never loads, but the snippet's queue still works), and provides a stub `window.sessionReplay`. All `amplitude.track()` calls queue up in `window.amplitude._q`, which tests read via `page.evaluate()`.

---

## Track 2 — Smoke tests (live API)

**Command:** `npm run test:smoke` or `npx playwright test --config playwright.smoke.config.js`
**When to run:** Manually — before a deploy, after major changes, when debugging data issues.
**Speed:** 1–3 minutes (depends on FEC API response times). Will fail if FEC API is down.

### What they test

| Test | What's verified |
|------|----------------|
| MGP candidate page | Financials are non-zero, name matches, chart canvas renders, no 422 errors |
| Gillibrand (Senate) | Page loads with Senate-sized cycle switcher |
| Search for "Gillibrand" | At least one result, name in result text |
| Committee C00806174 (Marie for Congress) | Committee name appears, financial figures non-zero |
| WA-03 2024 race | Candidate cards render, MGP name appears, cycle-anchored links present |

### FEC API rate limits

The FEC API has rate limits. Smoke tests include a 45-second timeout per test to handle slow responses. Running smoke tests more than a few times in quick succession may hit rate limits.

---

## Pipeline — no automated tests

Neither the Cloudflare Worker (`pipeline/`) nor the GitHub Actions script (`scripts/ingest-indiv.js`) has Playwright tests. Both run outside the browser and produce no DOM to assert against.

**Cloudflare Worker (pas2) — manual verification:**
- R2 dashboard (Cloudflare → R2 → fecledger-bulk) — confirm `fec/pas2/{year}/pas2.csv` objects exist with non-zero size after a cron run or manual trigger
- `wrangler tail` — stream live logs during a run; look for `[pipeline] part N` progress lines and `[pipeline] complete: N parts`
- Manual trigger: `curl "https://fecledger-pipeline.sloanestradley.workers.dev/admin/pipeline/run?file=pas224"` → 202 response, then tail logs

**GitHub Actions (indiv) — manual verification:**
- GitHub → Actions → FEC indiv bulk data pipeline → Run workflow (manual trigger)
- Watch run log for `[2022] Part 1 complete` (confirms ZIP header parsing, decompression, column filter, and R2 auth all working)
- R2 dashboard — confirm `fec/indiv/{year}/indiv.csv` exists with non-zero size for all three years
- Spot-check: first line of each file should be the 14-column header (`CMTE_ID|ENTITY_TP|NAME|...`); a data row should have 13 pipes
- Confirm `fec/last_updated.json` exists in R2 after all three files complete

---

## Known expected failures

Tests are written around known-incomplete features. These are not failures — they're tracked in `test-cases.md`:

| Feature | Status |
|---------|--------|
| Spent tab on candidate.html | Not yet built — spent-loading state will show |
| Spent tab on committee.html | Stub placeholder only — "coming soon" text |
| IntersectionObserver enrichment on races.html | Observer fires in Playwright (Chromium has full IO support), but enrichment calls are intercepted by the API mock — cache population path is not exercised in automated tests. Manual verification required (DevTools → Network + localStorage). |

---

## File structure

```
playwright.config.js        — Playwright config (webServer, grep exclusion, timeouts)
package.json                — npm scripts: test, test:smoke, test:report
tests/
  helpers/
    amp-mock.js             — Amplitude mock helpers (CDN blocking + queue reader)
    api-mock.js             — FEC API mock (route intercept + fixture data)
  shared.spec.js            — Shared structural checks for all 9 pages
  candidate.spec.js         — candidate.html tests
  search.spec.js            — search.html tests
  pages.spec.js             — all other pages
  smoke.spec.js             — @smoke live API tests
```

---

## Adding new tests

### For a new page
1. Add the page to the `PAGES` manifest in `shared.spec.js` with its expected active nav item.
2. Add a new `test.describe` block in `pages.spec.js` for page-specific checks.
3. Add a smoke test in `smoke.spec.js` tagged `@smoke`.

### For a new API endpoint
Add a fixture to `tests/helpers/api-mock.js` in `resolveFixture()`. Follow the existing URL pattern matching order (specific before generic).

### For new Amplitude events
Use `findTrackEvent(page, 'Event Name')` from `amp-mock.js`. Events are captured in `window.amplitude._q` since the Amplitude SDK is blocked — they queue up there for the duration of the page session.

### Testing hash navigation while preserving scrollY
Use `page.evaluate(() => { window.location.hash = '#year#tab'; })` instead of `element.click()` when a test needs to trigger hash navigation AND check `window.scrollY` afterward. Playwright's `element.click()` auto-scrolls the target element into view before the click fires, resetting `scrollY` to a browser-controlled value before the page's JS can read it. The `page.evaluate` approach changes the hash directly without triggering scroll-into-view. Used by the compact-header transition tests in `candidate.spec.js`.
