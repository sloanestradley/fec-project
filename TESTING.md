# Testing — ledger.fec

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
**Speed:** ~1 minute for all 227 tests.

### What they test

All tests mock the FEC API (instant responses, no network) and the Amplitude SDK (events captured in-memory via the snippet's `_q` queue).

| File | What's covered |
|------|----------------|
| `tests/shared.spec.js` | Shared checks for every page: `styles.css` linked, `main.js` linked, sidebar nav present with all 4 links, correct active nav item, mobile search icon present, warm parchment background, `Page Viewed` Amplitude event fires |
| `tests/candidate.spec.js` | Profile header, stats row (non-$0 financials), health banner, chart canvas, tab navigation, committees modal, Amplitude events, URL hash pre-selection, API correctness (no 422 errors) |
| `tests/search.spec.js` | Hero state, typeahead dropdown (2-char trigger, two groups, keyboard/click behavior), two-group results (candidates + committees), `?q=` auto-search, View all links, Amplitude events, no-results state |
| `tests/pages.spec.js` | committee.html, races.html (mode cards, curated form), race.html (candidate cards, financial figures, cycle-anchored links), candidates.html (auto-load, search input, clean URLs, filter chips, URL sync, error state, ?q= search mode, #load-more-spinner and #end-of-results DOM presence), committees.html (same as candidates), process-log.html, design-system.html (token tables, color swatches, component card attributes), index.html redirect, mobile layout at 390px and 1280px |

### How mocking works

**FEC API:** `tests/helpers/api-mock.js` intercepts all `api.open.fec.gov` requests and returns shape-correct fixture data. Pages render fully without hitting the real API.

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
| Committee C00775668 | Committee name appears, financial figures non-zero |
| WA-03 2024 race | Candidate cards render, MGP name appears, cycle-anchored links present |

### FEC API rate limits

The FEC API has rate limits. Smoke tests include a 45-second timeout per test to handle slow responses. Running smoke tests more than a few times in quick succession may hit rate limits.

---

## Known expected failures

Tests are written around known-incomplete features. These are not failures — they're tracked in `test-cases.md`:

| Feature | Status |
|---------|--------|
| Spent tab on candidate.html | Not yet built — spent-loading state will show |
| Filing history on committee.html | Scaffold only |
| Associated candidates on committee.html | Scaffold only |
| Ad hoc mode on races.html | Stub with planned badge |

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
