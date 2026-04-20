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
**Speed:** ~2 minutes for all 417 tests.

### What they test

All tests mock the FEC API (instant responses, no network) and the Amplitude SDK (events captured in-memory via the snippet's `_q` queue).

| File | What's covered |
|------|----------------|
| `tests/shared.spec.js` | Shared checks for every page (10 pages): `styles.css` linked, `main.js` linked, top nav present with four nav links (Candidates/Committees/Races/Feed) scoped to `.top-nav-links`, correct active nav link, mobile search toggle present, warm parchment background, `Page Viewed` Amplitude event fires, nav logo `.logo-fec`/`.logo-ledger` spans present, `.global-banner` precedes `.top-nav` in DOM, desktop nav search wrapped in `.search-field` with icon, desktop nav search submit button is `.sr-only` with `aria-label="Search"`, `#nav-typeahead-dropdown` present with `role=listbox`, `#mobile-nav` and `#top-nav-mobile-search` are children of `.top-nav`, mobile nav has four links |
| `tests/candidate.spec.js` | Profile header (including `#race-context` DOM presence, `.tag-context` flex structure with `.tag-context-text` and link, `#profile-header-sentinel` present for compact scroll observer, `.compact-sep` inside `#profile-header` and hidden in full mode, scroll down adds `.compact` class, scroll to top removes `.compact` class, `.main` paddingBottom set when compact and cleared on un-compact), cycle switcher as `select#cycle-switcher` with options, stats row (non-$0 financials), health banner, `#summary-strip` persistence across Summary/Raised/Spent tabs, first stat card label = "Raised-to-Spent Ratio", chart canvas, tab navigation, committees modal, Amplitude events, URL hash pre-selection, API correctness (no 422 errors), Raised tab contributors: `#donors-tbody` non-empty + `.raised-cell-title` reads "Raised breakdown", new Top Conduit Sources card (`#conduits-card` visible + `#conduits-tbody` contains the mocked ActBlue memo row) |
| `tests/search.spec.js` | Hero state, typeahead dropdown (2-char trigger, two groups, keyboard/click behavior), two-group results (candidates + committees), `?q=` auto-search, View all links, Amplitude events, no-results state |
| `tests/pages.spec.js` | committee.html (nav active state, stats grid, tabs bar visible, 3 tabs present, Summary active by default, tab switching, `#summary-strip` persistence across tabs, first stat card label = "Coverage Through", cycle switcher present + "All time" option + numeric options, committee-name title-cased, .candidate-card-office absent, filing history stub absent; Raised tab: donut canvas, map container, individual donors tbody non-empty, committee donors tbody non-empty when specific cycle selected, committee donors card hidden on All time, conduits card visible and populated on specific cycle with mocked ActBlue memo row, conduits card hidden on All time; Spent tab: donut canvas, spend-detail-bars, vendors tbody non-empty, contributions-section visible, contributions-tbody non-empty), races.html (page header, filter bar fields, state combo ARIA semantics + native fallback, office combo ARIA + listbox + native, cycle combo ARIA + listbox + native, results area containers), race.html (candidate cards, financial figures, cycle-anchored links), candidates.html (auto-load, search input, clean URLs, state combo ARIA, office/party/cycle combos ARIA + listbox structure + native fallback, dynamic cycle rows in listbox, filter chips, URL sync, error state, ?q= search mode, typeahead: 2-char trigger / result links / Escape key, #load-more-spinner and #end-of-results DOM presence), committees.html (state combo ARIA, type combo ARIA + listbox row count, auto-load, clean URLs, filter chips, URL sync, error state, typeahead: 2-char trigger / result links / Escape key), feed.html (results render on load, results header count, column headers, feed row structure with committee link + report tag + FEC external link, office/window/report-type filter controls, filter chips, end-of-results, error/empty states hidden, office filter interaction narrows rows, report type filter interaction narrows rows), process-log.html, design-system.html (token tables, color swatches, component card attributes), index.html redirect, mobile layout at 390px (top-nav visible, search toggle visible) and 1280px (search toggle hidden), mobile nav toggle behavior at 390px (hamburger opens/closes #mobile-nav, search toggle opens #top-nav-mobile-search, mutual exclusion between hamburger and search panel) |

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
