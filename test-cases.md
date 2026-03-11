# ledger.fec — Test Cases
*Manual browser checklist. Run locally: `python3 -m http.server 8080` from project root.*

---

## How to use this file

**Automated tests (Track 1):** Run `npx playwright test` from the project root before and after changes. 175 structural tests across all pages run in ~1 minute with mocked API. See `TESTING.md` for full details.

**Smoke tests (Track 2):** Run `npm run test:smoke` before deploys. Hits the live FEC API — 5 key checks. Requires the dev server to be running.

**Manual browser checks:** Use the checklists below for things automated tests can't verify — visual design quality, chart rendering, animation smoothness, content accuracy. Run for every page touched in a session.

**Amplitude verification method:** Open DevTools → Network tab → filter for `api2.amplitude.com`. Each event appears as a POST request. Click the request to inspect the payload and confirm event name + required properties. `Page Viewed` should fire within 2 seconds of load. Interaction events should fire only on user action, not on programmatic init calls.

**Checkboxes reset each session** — uncheck everything before starting a run. The Test log is the persistent record, not the checkboxes.

## How to maintain this file

- **New feature lands:** Add test cases in the same session it ships. New page = new section. New feature on existing page = new cases in that section.
- **Known issue resolved:** Remove from Known open issues table; add corresponding test cases to the page section.
- **Scaffold → live transition:** Expand that page's section from scaffold-scope to full coverage.
- **Test log:** Append a row for every test run. Never delete old rows — they show the testing history.

---

## Shared — run for every page touched this session

*Items marked ✅ are covered by automated tests (`npx playwright test`). Run manual checks for the rest.*

- [ ] ✅ `styles.css` and `main.js` both linked
- [ ] ✅ Sidebar nav present with all 4 main nav links
- [ ] ✅ Mobile search icon present, links to search.html
- [ ] ✅ Nav active state is correct for this page
- [ ] ✅ Page background is warm parchment (not dark or white)
- [ ] ✅ Amplitude `Page Viewed` fires on load
- [ ] ✅ No uncaught JS errors on load
- [ ] Page loads without console errors (open DevTools — automated checks miss network/CORS noise)
- [ ] Light broadsheet theme applied — visually warm parchment, not dark or white
- [ ] Barlow Condensed used for headings and display text
- [ ] DM Sans used for body and nav text
- [ ] IBM Plex Mono used for data labels and monospaced values
- [ ] Sidebar nav visible at desktop width (≥861px)
- [ ] Hamburger menu icon visible at ≤860px; sidebar hidden
- [ ] Mobile search icon (magnifying glass SVG) visible at ≤860px, links to search.html
- [ ] Mobile search icon hidden at desktop width
- [ ] Nav links resolve: Candidates → candidates.html, Committees → committees.html, Races → races.html, Search → search.html
- [ ] Amplitude: `Page Viewed` fires within 2 seconds of load (verify via Network tab → api2.amplitude.com)

---

## candidate.html

**Test URL:** `localhost:8080/candidate.html?id=H2WA03217` (MGP, House WA-03)
**Also test with:** `localhost:8080/candidate.html?id=S0NY00410` (Gillibrand, Senate NY)

### Nav active state
- [ ] "Candidates" nav item is active (profile page activates parent browse)

### Amplitude events
- [ ] `Page Viewed` fires with properties: `page`, `candidate_id`, `candidate_name`, `cycle`
- [ ] `Tab Switched` fires on tab click (not on init) with `tab`, `candidate_id`, `candidate_name`
- [ ] `Cycle Switched` fires on cycle button click with `cycle`, `candidate_id`, `candidate_name`
- [ ] `Committees Modal Opened` fires on clicking the committees trigger
- [ ] `Committees Tab Switched` fires on clicking Active/History tabs inside modal

### Breadcrumb
- [ ] ✅ Breadcrumb shows "Candidates / House • WA-03 / Marie Gluesenkamp Perez" (mixed case, bullet separator)
- [ ] ✅ "Candidates" is a link to /candidates
- [ ] ✅ "House • WA-03" is a link to /race with correct state, office, district, and active cycle year (e.g. `/race?state=WA&district=03&office=H&year=2024`)
- [ ] "Marie Gluesenkamp Perez" is plain text (no link — current page)
- [ ] Switch to a different cycle — verify the race link year in the breadcrumb updates to match
- [ ] All breadcrumb text renders uppercase (text-transform:uppercase via shared CSS)

### Header template (shared with committee.html and race.html)
- [ ] Header uses `.page-header` wrapper — same padding and border-bottom as committee and race headers
- [ ] Candidate name uses `.page-header-title` — same Barlow Condensed 800, clamp(1.6rem,3vw,2.4rem), uppercase as other profile pages
- [ ] Breadcrumb uses `.breadcrumb` shared class — same size, spacing, color as other profile pages

### Header animation
- [ ] Profile header, tab bar, and content area all fade in together on load (no element pops in before others)
- [ ] No vertical jump or layout shift as the header fades in (opacity-only transition, no translateY)

### Profile header
- [ ] Candidate name displays
- [ ] Initials avatar present (3-letter preferred, e.g. "MGP")
- [ ] Party tag visible (Dem / Rep / Ind)
- [ ] Office + district tag visible (e.g. "House · WA-03")
- [ ] Incumbency tag visible if applicable
- [ ] "Committees (N) →" trigger shows a count immediately on load (not blank while loading)

### Cycle switcher
- [ ] Buttons render with all cycles from the candidate's `election_years`
- [ ] Default to current active cycle (or most recent if no active cycle)
- [ ] Clicking a different cycle re-fetches data and updates the view
- [ ] URL anchor updates to `#YYYY#summary` on cycle change
- [ ] `localhost:8080/candidate.html?id=H2WA03217#2022#raised` pre-selects 2022 cycle and Raised tab on load

### Stats row
- [ ] Total Raised shows a formatted dollar amount (not $0, not blank)
- [ ] Total Spent shows a formatted dollar amount
- [ ] Cash on Hand shows a formatted dollar amount
- [ ] Raised-to-Spent Ratio shows a value

### Health banner
- [ ] Active cycle: green/amber/red signal visible with descriptive text
- [ ] Closed cycle: "Cycle Complete" summary shown instead of health signal

### Summary tab — chart
- [ ] Chart renders with data (lines are visible, not flat at $0)
- [ ] Raised and Spent lines are stepped (stair-step between filing dates)
- [ ] Cash on Hand line is smooth/linear
- [ ] X-axis spans the full election cycle (2yr for House, verified MGP)
- [ ] Filing deadline markers visible as grey dashed vertical lines
- [ ] Election date markers visible as amber dotted vertical lines
- [ ] "Today" marker visible on active cycles

### Raised tab
- [ ] Contributor breakdown section renders with data
- [ ] Geography section renders (choropleth or placeholder)
- [ ] Top committee contributors section renders

### Committees modal
- [ ] Opens on clicking "Committees (N) →"
- [ ] Active tab shows authorized/principal committees
- [ ] History tab visible if terminated committees exist
- [ ] Each committee row shows name and type; name links to committee.html?id=...
- [ ] JFA gap note visible at bottom of modal
- [ ] Modal closes on Escape key
- [ ] Modal closes on clicking outside the modal panel

### Senate-specific (Gillibrand S0NY00410)
- [ ] Cycle switcher shows 6-year cycles
- [ ] Chart x-axis spans 6 years
- [ ] Stats represent full 6-year cycle totals

---

## search.html

**Test URL:** `localhost:8080/search.html`

### Nav active state
- [ ] "Search" nav item is active

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'search'`
- [ ] `Candidate Searched` fires on search submit with `query` property
- [ ] `Candidate Result Clicked` fires on result click with `candidate_id`, `candidate_name`, `query`, `result_position`

### Search behavior
- [ ] Search input is focused / prominent on page load
- [ ] Typing a candidate name and pressing Enter returns results
- [ ] Results show candidate name, office, state, party
- [ ] Clicking a result navigates to `candidate.html?id=...`
- [ ] `localhost:8080/search.html?q=pelosi` auto-fires a search on load and shows results
- [ ] Empty search with no results shows a no-results state (not blank, not an error)
- [ ] Loading state visible while fetch is in flight
- [ ] API error shows an error state (not a blank page or crash)

---

## committee.html

**Test URL:** Navigate from a candidate's committees modal, or `localhost:8080/committee.html?id=C00775668`
*(C00775668 verified active with real filings — used as demo data in design-system.html)*

### Nav active state
- [ ] "Committees" nav item is active (profile page activates parent browse)

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'committee'` and `committee_id` property

### Breadcrumb
- [ ] ✅ Breadcrumb shows "Committees / [Full Committee Name]" (not type label like "House Candidate Committee")
- [ ] ✅ "Committees" is a link to /committees
- [ ] Committee name is plain text (no link — current page)
- [ ] Committee name in breadcrumb is title-case (not ALL CAPS from FEC API) — `toTitleCase()` applied in `renderHeader()`
- [ ] All breadcrumb text renders uppercase (text-transform:uppercase via shared CSS)

### Header template (shared with candidate.html and race.html)
- [ ] Header uses `.page-header` wrapper — same padding and border-bottom as candidate and race headers
- [ ] Committee name uses `.page-header-title` — same Barlow Condensed 800, clamp(1.6rem,3vw,2.4rem), uppercase as other profile pages (accepts wrapping for long names)
- [ ] Header fades in on load (opacity transition via `.page-header-reveal`)

### Profile header
- [ ] Committee name displays
- [ ] Committee type tag visible
- [ ] Designation tag visible (Principal / Authorized / Joint Fundraising / etc.)
- [ ] Active or Terminated status tag visible

### Back-link
- [ ] Back-link to candidates.html (or to candidate if navigated via `?from=`) is present and functional

### Stats grid
- [ ] Total Raised shows a formatted dollar amount (not $0 or blank)
- [ ] Total Spent shows a formatted dollar amount
- [ ] Cash on Hand shows a formatted dollar amount
- [ ] Last Filing / Coverage date shows a real date

### Scaffold sections (verify present, not that they have full data)
- [ ] Filing history section renders (stub content is acceptable)
- [ ] Associated candidates section renders (stub content is acceptable)

---

## races.html

**Test URL:** `localhost:8080/races.html`

### Nav active state
- [ ] "Races" nav item is active

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'races'`

### Mode selector
- [ ] Two mode cards render: Curated and Ad Hoc
- [ ] Ad Hoc card shows a "planned" or disabled badge
- [ ] Clicking Curated reveals the curated form

### Curated form
- [ ] State dropdown populates
- [ ] Office dropdown populates (House, Senate, President)
- [ ] Year/cycle input or dropdown present
- [ ] District field appears when House is selected; hidden for Senate/President
- [ ] Submitting the form navigates to `race.html?state=...&office=...&year=...`
- [ ] If URL params are present on load, form pre-fills and auto-fetches

---

## race.html

**Test URL:** `localhost:8080/race.html?state=WA&district=03&year=2024&office=H`
*(2024 is a completed cycle with known filings — 2026 is too early to have reliable financial data)*

### Nav active state
- [ ] "Races" nav item is active (profile page activates parent browse)

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'race'` and `state`, `year`, `office`, `district` properties
- [ ] `Candidate Result Clicked` fires on card click with `candidate_id`, `from_page: 'race'`, `race_year`

### API correctness
- [ ] No 422 error in console (confirms office param is sent as lowercase full word: "house", not "H")
- [ ] Check Network tab: the `/elections/` API call includes `office=house` (not `office=H`)

### Breadcrumb
- [ ] ✅ Breadcrumb shows "Races / House • WA-03" (no year in breadcrumb; mixed case with bullet separator)
- [ ] ✅ "Races" is a link to /races
- [ ] "House • WA-03" is plain text (no link — current page)
- [ ] "← All Races" back-link is absent (removed; breadcrumb serves this purpose)
- [ ] All breadcrumb text renders uppercase (text-transform:uppercase via shared CSS)

### Header template (shared with candidate.html and committee.html)
- [ ] Header uses `.page-header` wrapper — same padding and border-bottom as candidate and committee headers
- [ ] Race title uses `.page-header-title` — same Barlow Condensed 800, clamp(1.6rem,3vw,2.4rem), uppercase
- [ ] Header fades in on load (opacity transition via `.page-header-reveal`)

### Race header
- [ ] Race title reads "House • WA-03" (not "WA-03 HOUSE" — mixed case with bullet separator)
- [ ] Browser tab title reads "House • WA-03 — ledger.fec" (no year)
- [ ] Year dropdown present below the title, showing 2024 selected (from URL param)
- [ ] Candidate count shown in meta row (e.g. "3 candidates")
- [ ] Changing year dropdown to 2022 reloads page with `year=2022` in URL
- [ ] ✅ Year dropdown shows 2024 as selected value when URL param is `year=2024`

### Candidate cards
- [ ] At least 1 candidate card renders (not a blank list)
- [ ] Each card shows candidate name
- [ ] Each card shows party tag
- [ ] Each card shows financial figures — Raised, Spent, COH — formatted (not $0, not blank)
- [ ] Clicking a card navigates to `candidate.html?id={id}#{year}#summary` (cycle-anchored — verify the hash in the URL after clicking)

---

## candidates.html

**Test URL:** `localhost:8080/candidates.html`

### Nav active state
- [ ] "Candidates" nav item is active

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'candidates'`
- [ ] `Candidates Browsed` fires on filter submit with filter properties
- [ ] `Candidate Result Clicked` fires on result click with `candidate_id`, `from_page: 'candidates'`, `result_position`

### Filters and results
- [ ] State dropdown populates
- [ ] Office dropdown populates (House, Senate, President)
- [ ] Party dropdown populates
- [ ] Cycle field present
- [ ] Submitting filters returns candidate results
- [ ] Result cards show name, office, state, party
- [ ] Clicking a result navigates to `candidate.html?id=...`
- [ ] No-results state renders if filters return nothing (not blank/crash)

---

## committees.html

**Test URL:** `localhost:8080/committees.html`

### Nav active state
- [ ] "Committees" nav item is active

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'committees'`
- [ ] `Committees Browsed` fires on filter submit with filter properties
- [ ] `Committee Result Clicked` fires on result click with `committee_id`, `from_page: 'committees'`, `result_position`

### Filters and results
- [ ] State dropdown populates
- [ ] Committee type dropdown populates
- [ ] Submitting filters returns committee results
- [ ] Result rows show committee name and type
- [ ] Clicking a result navigates to `committee.html?id=...`
- [ ] No-results state renders if filters return nothing (not blank/crash)

---

## process-log.html

**Test URL:** `localhost:8080/process-log.html`

### Nav active state
- [ ] "Process Log" link in Documentation section is active

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'process-log'`
- [ ] `Process Log View Toggled` fires when toggling between view modes, with `view` property

### Content
- [ ] All entries readable; no clipped or overflowing text
- [ ] View toggle buttons functional (if present)
- [ ] No broken layout at desktop width (1280px+)
- [ ] No broken layout at mobile width (390px)

---

## design-system.html

**Test URL:** `localhost:8080/design-system.html`

### Nav active state
- [ ] "Design System" link in Documentation section is active

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'design-system'`

### Token tables
- [ ] Tier 1 primitives table renders
- [ ] Tier 2 semantic token table renders; `--chart-*` vars present in the list

### Color swatches
- [ ] Background swatches show warm light colors (not dark)
- [ ] Partisan swatches: Dem (dark navy), Rep (dark red), Ind (purple)
- [ ] Status swatches: Green, Amber, Red
- [ ] Chart color swatches present
- [ ] Inspect any swatch element: `data-token` and `data-hex` attributes present

### Typography
- [ ] Barlow Condensed specimen renders
- [ ] DM Sans specimen renders
- [ ] IBM Plex Mono specimen renders

### Component cards
- [ ] Each card has `id="comp-{name}"` attribute (inspect element to verify one)
- [ ] Each card has a status badge (stable / candidate-only / log-only / planned / deprecated)
- [ ] Live demos work: tab bar switches tabs, health banner cycles through Green/Amber/Red/Closed states, modal opens and closes
- [ ] View page source: no `<style>` block in `<head>` containing component CSS (all CSS should be in styles.css)
- [ ] Page Header component card present (`id="comp-page-header"`, status "stable") — documents `.page-header`, `.page-header-title`, `.breadcrumb`
- [ ] Page Header and Candidate Header component demos are visible (not invisible — demos don't use `.page-header-reveal` so no JS required)
- [ ] Breadcrumb demo text appears uppercase

---

## index.html

**Test URL:** `localhost:8080/` or `localhost:8080/index.html`

- [ ] Redirects immediately to search.html
- [ ] No visible flash of unstyled or blank content before redirect

---

## Pre-deploy checks — clean URL pages

*Run before committing any changes to `candidate.html`, `committee.html`, or `race.html`, or when adding a new profile page. Playwright cannot catch this class of bug.*

- [ ] `styles.css` linked as `href="/styles.css"` (absolute), not `href="styles.css"` (relative)
- [ ] `main.js` linked as `src="/main.js"` (absolute)
- [ ] `utils.js` linked as `src="/utils.js"` (absolute)
- [ ] All nav links use absolute paths: `/candidates`, `/committees`, `/races`, `/search`, `/`, `/process-log.html`, `/design-system.html`
- [ ] Any outgoing links to other profile pages use clean URL format: `/candidate/{id}`, `/committee/{id}`
- [ ] race.html: sidebar logo links to `/` (not `index.html`); all nav items use `/candidates`, `/committees`, etc.

---

## Post-deploy checks (Netlify only — cannot run locally)

*These verify clean URL rewrites in `_redirects`. Run against `sloanestradley.netlify.app` after any deploy.*

- [ ] `/search` loads search.html (not 404)
- [ ] `/candidates` loads candidates.html (not 404)
- [ ] `/committees` loads committees.html (not 404)
- [ ] `/races` loads races.html (not 404)
- [ ] `/candidate/H2WA03217` loads candidate.html with MGP's profile (not 404 or blank)
- [ ] `/committee/C00744946` loads committee.html with committee data (not 404 or blank)
- [ ] `/race?state=WA&district=03&year=2024&office=H` loads race.html with candidate cards (not 404 or blank)
- [ ] Browser URL bar shows clean path (not `.html` equivalent) for all above
- [ ] Navigating to a clean URL and refreshing does not 404

---

## Known open issues

Expected failures — not bugs to fix now. Remove a row when the issue is resolved; add test cases to the relevant page section at that time.

| Issue | Page | Added |
|-------|------|-------|
| Spent tab not yet built | candidate.html | 2026-03-10 |
| .layout div appears to overlap global banner visually — root cause TBD, separate debugging session | candidate.html | 2026-03-11 |
| Filing history not yet built | committee.html | 2026-03-10 |
| Associated candidates section not yet built | committee.html | 2026-03-10 |
| Ad hoc mode is stub/planned only | races.html | 2026-03-10 |

---

## Test log

Append a row after each test run. Never delete old rows.

| Date | Session focus | Pages tested | Failures found | Status |
|------|---------------|--------------|----------------|--------|
| 2026-03-10 | test-cases.md creation + CLAUDE.md ritual update | None (infrastructure session — no HTML pages modified) | — | N/A |
| 2026-03-10 | Playwright setup — Track 1 structural (170 tests) + Track 2 smoke (5 tests) | All 9 pages + index (automated) | design-system.html missing .mobile-search-icon (fixed) | 170/170 Track 1 passing; Track 2 ready for manual run |
| 2026-03-10 | utils.js extraction — shared utilities refactor | All pages (automated) | None | 170/170 Track 1 passing |
| 2026-03-10 | _redirects — Netlify clean URL rewrites | None (no HTML modified; Playwright can't test Netlify rewrites) | None | 170/170 Track 1 passing; post-deploy checks pending |
| 2026-03-10 | Clean URL debugging — relative path fix on profile pages | candidate.html, committee.html, race.html (automated + live) | apiFetch not defined on /candidate/:id; unstyled committee page; race nav submitting to wrong path; index redirect using relative URL | 170/170 Track 1 passing; live post-deploy checks in progress |
| 2026-03-10 | Banner refactor + polish fixes | All pages (automated) | None | 170/170 Track 1 passing |
| 2026-03-11 | Card separation (Raised/Spent tabs) + avatar restyle + avatar/name inline layout | candidate.html, design-system.html (automated) | None | 170/170 Track 1 passing |
| 2026-03-11 | Breadcrumbs + formatRaceName + race year dropdown | candidate.html, race.html, committee.html, utils.js (automated) | None | 174/174 Track 1 passing |
| 2026-03-11 | Header consistency refactor + breadcrumb uppercase + page-header-reveal architecture | candidate.html, committee.html, race.html, candidates.html, committees.html, design-system.html (automated) | None | 174/174 Track 1 passing |
| 2026-03-11 | Party tag on race candidate cards — fix party_full vs party field mismatch | race.html, styles.css, utils.js (automated) | None | 174/174 Track 1 passing |
| 2026-03-11 | Mock/live field shape audit — fix 7 fixture gaps across 9 endpoints | tests/helpers/api-mock.js (automated) | schedule_a/by_state used wrong field names (state vs contributor_state); coverage_end_date missing timestamp; total_receipts_ytd should be string; leadership_pac should be null; organization_type_full should be null — all fixed | 175/175 Track 1 passing |
