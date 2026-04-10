# FECLedger — Test Cases
*Manual browser checklist. Run locally: `python3 -m http.server 8080` from project root.*

---

## How to use this file

**Automated tests (Track 1):** Run `npx playwright test` from the project root before and after changes. 280 structural tests across all pages run in ~1 minute with mocked API. See `TESTING.md` for full details.

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
- [ ] ✅ Top nav present with 3 main nav links (Candidates, Committees, Races)
- [ ] ✅ Mobile search toggle present
- [ ] ✅ Nav active state is correct for this page
- [ ] ✅ Page background is warm parchment (not dark or white)
- [ ] ✅ Amplitude `Page Viewed` fires on load
- [ ] ✅ No uncaught JS errors on load
- [ ] Page loads without console errors (open DevTools — automated checks miss network/CORS noise)
- [ ] Light broadsheet theme applied — visually warm parchment, not dark or white
- [ ] Barlow Condensed used for headings and display text
- [ ] DM Sans used for body and nav text
- [ ] IBM Plex Mono used for data labels and monospaced values
- [ ] Top nav visible and fixed at both desktop and mobile widths
- [ ] At ≤860px: nav links hidden, hamburger and search toggle visible; mobile nav drawer drops down on hamburger click
- [ ] At ≤860px: search toggle expands inline search panel below nav; closes when hamburger drawer opens and vice versa
- [ ] At ≥861px: full nav links and search bar visible; mobile controls hidden
- [ ] Nav links resolve: Candidates → /candidates, Committees → /committees, Races → /races
- [ ] Global search bar (desktop): submits to /search?q=…
- [ ] Amplitude: `Page Viewed` fires within 2 seconds of load (verify via Network tab → api2.amplitude.com)

---

## candidate.html

**Test URL:** `localhost:8080/candidate.html?id=H2WA03217` (MGP, House WA-03)
**Also test with:** `localhost:8080/candidate.html?id=H6WA09025` (D. Adam Smith, House WA-09), `localhost:8080/candidate.html?id=S0NY00410` (Gillibrand, Senate NY)

### Nav active state
- [ ] "Candidates" nav item is active (profile page activates parent browse)

### Amplitude events
- [ ] `Page Viewed` fires with properties: `page`, `candidate_id`, `candidate_name`, `cycle`
- [ ] `Tab Switched` fires on tab click (not on init) with `tab`, `candidate_id`, `candidate_name`
- [ ] `Cycle Switched` fires on cycle button click with `cycle`, `candidate_id`, `candidate_name`
- [ ] `Committees Modal Opened` fires on clicking the committees trigger
- [ ] `Committees Tab Switched` fires on clicking Active/Terminated tabs inside modal

### Header template (shared with committee.html and race.html)
- [ ] Header uses `.page-header` wrapper — same padding and border-bottom as committee and race headers
- [ ] Candidate name uses `.page-title` — same Barlow Condensed 800, clamp(1.6rem,3vw,2.4rem), uppercase as other profile pages

### Header animation
- [ ] Profile header, tab bar, and content area all fade in together on load (no element pops in before others)
- [ ] No vertical jump or layout shift as the header fades in (opacity-only transition, no translateY)

### Profile header
- [ ] Race label (`.candidate-race-label`) appears above the candidate name — reads e.g. "US HOUSE: WASHINGTON'S 3RD DISTRICT" in red-700 Oswald uppercase
- [ ] Race label is an `<a>` linking to the race page (`/race?state=WA&district=03&office=H&year=...`)
- [ ] Candidate name displays
- [ ] Meta-row shows party tag only — no race/office tag (race tag removed on redesign branch)
- [ ] "Committees (N) →" trigger floats to the far right of the candidate row, vertically centered
- [ ] At narrow viewports (≤860px), tags wrap below the name; committees link stays right-aligned
- [ ] ✅ `#race-context` element present in DOM (now in `#race-context-bar`, not meta-row)
- [ ] Race context bar appears as a persistent strip between the tab bar and content (visible on all tabs)
- [ ] Skeleton pulse appears in the race context bar while `/elections/` fetch is in-flight
- [ ] Race context sentence resolves to filled `.tag-context` pill in the bar
- [ ] Active cycle → sentence uses "is" (e.g. "Smith is the incumbent…")
- [ ] Past cycle → sentence uses "was"
- [ ] Incumbent with N challengers → "…the incumbent with N challenger/challengers." (plural conditional)
- [ ] Incumbent with 0 challengers → "[Name] is/was unopposed."
- [ ] Open seat → "Open seat with N candidate/candidates."
- [ ] No `/elections/` data → "View race →" link only, no broken UI
- [ ] "View race →" link goes to the correct race URL for the active cycle; updates on cycle switch
- [ ] Senate candidate: race link has no `-00` district segment; sentence renders correctly
- [ ] `.tag-context` text wraps at narrow viewports (no overflow); "View race →" link stays inline with last line
- [ ] Space between sentence period and "View race →" link is visible (non-breaking space)
- [ ] ✅ Incumbent tag `.incumbent-tag` appears in `#meta-row` after party tag when candidate is the incumbent (automated)
- [ ] Incumbent tag absent when candidate is a challenger or open-seat candidate
- [ ] Incumbent tag clears and re-evaluates correctly on cycle switch (tag may appear in one cycle but not another)
- [ ] "Committees (N) →" trigger shows a count immediately on load (not blank while loading)

### Compact sticky header
- [ ] ✅ `#profile-header-sentinel` is present in DOM (automated)
- [ ] ✅ `.compact-sep` is inside `#profile-header` and hidden in full mode (automated)
- [ ] ✅ Scrolling down 200px adds `.compact` class to `#profile-header` (automated)
- [ ] ✅ Scrolling back to top removes `.compact` from `#profile-header` (automated)
- [ ] ✅ `.main` `paddingBottom` is set (> 0, ≤ 80px) when compact is active (automated)
- [ ] ✅ `.main` `paddingBottom` is cleared when compact disengages (automated)
- [ ] Header compacts smoothly when scrolling down — no flash or bounce
- [ ] Header un-compacts smoothly when scrolling back to top — no bounce or snap
- [ ] After compacting, can still scroll back up to un-compact (not trapped in compact state)
- [ ] Navigating to Raised tab while compact: compact state persists, page does not snap to top
- [ ] Navigating to Spent tab while compact: same — no snap to top on first visit
- [ ] After all tabs visited once: switching tabs does not change compact state (no header snap)
- [ ] Tabs bar `top` offset adjusts when compact engages (bar visually follows the shorter header)
- [ ] Same behavior on committee.html and race.html (compact/un-compact cycle without bounce)

### Cycle switcher
- [ ] ✅ Cycle switcher renders as a `<select>` with options populated from candidate's `election_years`
- [ ] Select is positioned as the last element in the tab bar (after all tabs), pushed right via margin-left:auto
- [ ] No border on the select; tab bar's bottom border provides visual structure
- [ ] Tabs-bar bottom border spans full viewport width (check at >1600px viewport); tab text aligns with page content below
- [ ] Default to current active cycle (or most recent if no active cycle)
- [ ] Selecting a different cycle re-fetches data and updates the view; select value stays in sync
- [ ] `Cycle Switched` Amplitude event fires on select change (not on init)
- [ ] URL anchor updates to `#YYYY#summary` on cycle change
- [ ] `localhost:8080/candidate.html?id=H2WA03217#2022#raised` pre-selects 2022 cycle and Raised tab on load

### Stats row
- [ ] Card order (left to right): Raised-to-Spent Ratio → Cash on Hand → Total Raised → Total Spent
- [ ] Raised-to-Spent Ratio shows a value (first card)
- [ ] Cash on Hand shows a formatted dollar amount
- [ ] Total Raised shows a formatted dollar amount (not $0, not blank)
- [ ] Total Spent shows a formatted dollar amount

### Health banner
- [ ] Active cycle: green/amber/red signal visible with descriptive text
- [ ] Closed cycle: "Cycle Complete" label, desc reads "Cycle concluded with [X in outstanding debt | no outstanding debt reported]", note reads "Final coverage: {date}"
- [ ] No-data cycle: "No Data" label, desc reads "No filings this cycle.", note is empty
- [ ] Label and desc render in prose type (IBM Plex Serif, not uppercase Oswald)
- [ ] Navy top border visible above the banner

### Summary strip persistence
- [ ] Banner and stats grid visible on Summary tab
- [ ] Click Raised tab — banner and stats grid still visible above the Raised content
- [ ] Click Spent tab — banner and stats grid still visible above the Spent content
- [ ] Navy top/bottom borders on stats grid extend to .main-inner edges (wide viewport); stat card text aligned with page gutter

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
- [ ] "Terminated" tab visible (not "History") if terminated committees exist (`filing_frequency === 'T'` or `'A'`; administratively terminated committees go here too)
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
- [ ] `Candidate Result Clicked` fires on candidate card click with `candidate_id`, `candidate_name`, `query`, `result_position`
- [ ] `Committee Result Clicked` fires on committee row click with `committee_id`, `query`, `result_position`

### Typeahead
- [ ] Typing 1 character → no dropdown appears (wait 400ms to confirm)
- [ ] Typing 2+ characters → dropdown appears within ~350ms, flush below the input (no gap)
- [ ] Dropdown shows "Candidates" and "Committees" group labels
- [ ] Each candidate row: `First Last (CANDIDATE_ID)` on left, `House`/`Senate`/`President` on right
- [ ] Each committee row: `Committee Name (COMMITTEE_ID)` on left, colored status dot only on right (no text label)
- [ ] "No candidates found" shown when API returns 0 candidates for that group
- [ ] "No committees found" shown when API returns 0 committees for that group
- [ ] Pressing Escape closes the dropdown
- [ ] Clicking outside the dropdown closes it
- [ ] Clicking a candidate row navigates to `/candidate/{id}` (clean URL)
- [ ] Clicking a committee row navigates to `/committee/{id}` (clean URL)
- [ ] Pressing Enter while typeahead is open: closes dropdown, runs full search, shows two-group results

### Two-group results
- [ ] Submitting search shows a "Candidates" group and a "Committees" group
- [ ] Each group header reads e.g. "5 candidates for "cantwell"" with count first, label second, query in quotes
- [ ] Candidate cards link to `/candidate/{id}` (clean URL, no `?id=`)
- [ ] Committee rows link to `/committee/{id}` (clean URL)
- [ ] Candidate card shows name (First Last), race tag first, party tag second
- [ ] Committee row shows name, committee type, Active/Terminated status tag
- [ ] If total candidates > 5: "View all N →" link appears and links to `/candidates?q={query}`
- [ ] If total committees > 5: "View all N →" link appears and links to `/committees?q={query}`
- [ ] "View all" links absent when count ≤ 5
- [ ] If both groups return 0 results: no-results state shown (not blank)
- [ ] `localhost:8080/search.html?q=pelosi` auto-fires search on load and shows two-group results
- [ ] Loading state visible while fetch is in flight

---

## committee.html

**Test URL:** Navigate from a candidate's committees modal, or `localhost:8080/committee.html?id=C00775668`
*(C00775668 verified active with real filings — used as demo data in design-system.html)*

### Nav active state
- [ ] "Committees" nav item is active (profile page activates parent browse)

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'committee'` and `committee_id` property

### Breadcrumb
### Header template (shared with candidate.html and race.html)
- [ ] Header uses `.page-header` wrapper — same padding and border-bottom as candidate and race headers
- [ ] Committee name uses `.page-title` — same Barlow Condensed 800, clamp(1.6rem,3vw,2.4rem), uppercase as other profile pages (accepts wrapping for long names)
- [ ] Header fades in on load (opacity transition via `.page-header-reveal`)

### Profile header
- [ ] Committee name displays
- [ ] Committee type tag visible
- [ ] Designation tag visible (Principal / Authorized / Joint Fundraising / etc.)
- [ ] Active or Terminated status tag visible

### Back-link
- [ ] Back-link to candidates.html (or to candidate if navigated via `?from=`) is present and functional

### Tabs bar + cycle switcher
- [ ] ✅ Tabs bar is present and visible after load
- [ ] ✅ Three tabs: Summary, Raised, Spent
- [ ] ✅ Summary tab is active by default
- [ ] ✅ Clicking Raised tab activates it and shows #tab-raised; #tab-summary hidden
- [ ] ✅ Clicking Spent tab activates it and shows #tab-spent; #tab-summary hidden
- [ ] ✅ Cycle switcher is present inside .tabs-bar (last child, after all tabs)
- [ ] ✅ Cycle switcher has an "All time" option with value "all"
- [ ] ✅ Cycle switcher has at least one numeric cycle option
- [ ] Cycle switcher defaults to "All time" on load
- [ ] Tabs-bar bottom border spans full viewport width (check at >1600px viewport); tab text aligns with page content below
- [ ] Selecting a cycle re-renders stats for that cycle
- [ ] Selecting 2026 (no totals record) shows `—` in all stat fields
- [ ] Amplitude `Cycle Switched` fires with `{ cycle, committee_id }` — no `committee_name` property
- [ ] Amplitude `Tab Switched` fires on user tab click with `{ tab, committee_id }` — does NOT fire on hash-restore load

### Stats grid
- [ ] ✅ Stats grid shows financial figures (not $0 or blank)
- [ ] Card order (left to right): Coverage Through → Cash on Hand → Total Raised → Total Spent
- [ ] Coverage date shows a real date (first card)
- [ ] Cash on Hand shows a formatted dollar amount
- [ ] Total Raised shows a formatted dollar amount (not $0 or blank) — "All time" default sums all cycles
- [ ] Total Spent shows a formatted dollar amount
- [ ] Raised and Spent sub-labels show "All cycles" in All time mode; "{year–year} cycle" in per-cycle mode
- [ ] Overspend note hidden in "All time" mode even when disbursements > receipts
- [ ] "Financial Summary" section title is NOT present above the stats grid (removed in summary-strip refactor)

### Summary strip persistence (committee.html)
- [ ] Stats grid visible on Summary tab
- [ ] Click Raised tab — stats grid still visible above the Raised content
- [ ] Click Spent tab — stats grid still visible above the Spent content
- [ ] Navy top/bottom borders on stats grid extend to .main-inner edges (wide viewport); stat card text aligned with page gutter
- [ ] Overspend note hidden when disbursements ≤ receipts for a selected cycle
- [ ] Overspend note visible when disbursements > receipts for a selected cycle

### Associated candidate section
- [ ] No back-link in header (removed on redesign branch)
- [ ] Associated candidate card appears in Summary tab (if linked via candidate_ids or sponsor_candidate_ids)
- [ ] Associated candidate card shows race tag + party tag (not deprecated .candidate-card-office)
- [ ] Section title is "Sponsored Candidate" for leadership PACs, "Principal Committee For" for authorized committees
- [ ] ✅ .candidate-card-office class not present anywhere on page (deprecated class fully removed)

### URL hash
- [ ] ✅ Default load: URL hash updates to `#all#summary` after page renders
- [ ] ✅ Switching cycle: URL hash updates to `#2024#summary` (or selected cycle)
- [ ] ✅ Switching tab: URL hash updates cycle + tab (e.g. `#2024#raised`)
- [ ] Refresh with `#2024#raised` in URL: page loads with 2024 cycle selected and Raised tab active
- [ ] Invalid cycle in hash (e.g. `#9999`): falls back to `#all#summary`
- [ ] Invalid tab in hash (e.g. `#all#foo`): falls back to summary tab

### Raised tab
- [ ] ✅ Clicking Raised tab shows #tab-raised, hides #tab-summary
- [ ] ✅ Donut canvas (#chart-donut) renders inside raised tab
- [ ] ✅ Map container (#map-container) is present in raised tab
- [ ] ✅ Committee donors tbody has at least one row
- [ ] ✅ Individual donors tbody has at least one row
- [ ] Loading spinner visible while contributor data is fetching
- [ ] Contributor Types donut renders with legend rows and percentage labels
- [ ] Donut center shows total raised amount (formatted dollar)
- [ ] Choropleth map SVG renders; WA state is filled (not grey) for Marie for Congress
- [ ] State hover tooltip shows state name and formatted contribution total
- [ ] Map legend bar (Less → More gradient) visible below the map
- [ ] "Top Committee Contributors" table appears above "Top Individual Contributors" (committee donors first)
- [ ] Table headers dynamically reflect the cycle: "2023–2024" for specific cycle, "Most recent cycle" for All time
- [ ] Committee table shows name, type label, and amount columns
- [ ] Individual table shows name, city/state location, and amount columns
- [ ] Data note at bottom includes amendment processing caveat
- [ ] Switching cycles resets and re-fetches raised data; donut and map re-render for new cycle
- [ ] Navigating to Raised tab on a page where data is already fetched renders immediately (no re-fetch)
- [ ] State tooltip value for WA should not exceed total raised shown on Summary tab for the same cycle selection
- [ ] Timber PAC (C00833574): map uses neutral/purple color (no party affiliation)
- [ ] DEM committee (C00806174): map uses blue color

### Spent tab
- [ ] ✅ Clicking Spent tab shows #tab-spent, hides #tab-summary
- [ ] ✅ Spent donut canvas (#chart-spent-donut) renders inside spent tab
- [ ] ✅ Spending by Purpose bars (#spend-detail-bars) present in spent tab
- [ ] ✅ Vendors tbody has at least one row
- [ ] ✅ Contributions section visible when CCM records exist
- [ ] ✅ Contributions tbody has at least one row
- [ ] Loading spinner visible while spending data is fetching
- [ ] Spending by Category donut renders with legend rows and percentage labels
- [ ] Donut center shows total spent amount (formatted dollar)
- [ ] Purpose breakdown bars show category labels, amounts, and percentages
- [ ] Vendor table header dynamically reflects the cycle: "2023–2024" for specific cycle, "All time" for all-time view
- [ ] Vendor table shows vendor name, purpose, and total columns
- [ ] Contributions section hidden when no CCM/CONTRIBUTIONS records exist (e.g. principal committee C00806174)
- [ ] Contributions section visible for leadership PAC (C00833574 — Timber PAC): shows candidate recipients with office/state
- [ ] Contributions table shows recipient name (linked to /committee/ if committee_id present), candidate column, amount
- [ ] Switching cycles resets and re-fetches spent data; donut and purpose bars re-render for new cycle
- [ ] Data note at bottom includes Schedule B and FEC totals source attribution
- [ ] Navigating to Spent tab on a page where data is already fetched renders immediately (no re-fetch)

- [ ] ✅ Filing history stub is NOT present (removed)

---

## races.html

**Test URL:** `localhost:8080/races.html`

### Nav active state
- [ ] "Races" nav item is active ✅

### Amplitude events
- [ ] `Page Viewed` fires with `page: 'races'` ✅

### Page header
- [ ] Page eyebrow reads "Races" ✅
- [ ] Page title reads "Browse Races" ✅
- [ ] No `.page-desc` paragraph

### Filter bar
- [ ] Year combo trigger visible, clicking opens listbox populated with cycles from API, default to current cycle ✅
- [ ] Office combo trigger visible with "All offices", clicking opens listbox with House/Senate/President options ✅
- [ ] State combo with text filter input and listbox dropdown ✅
- [ ] At ≤860px: combo triggers hidden, native `<select>` elements appear in their place (Year, Office)
- [ ] State dropdown not clipped when open (overflow:visible on .main)
- [ ] Filter chips area present and hidden by default ✅

### Data fetching & rendering
- [ ] Default load shows races grouped by office (President → Senate → House) with correct header count
- [ ] Race rows show race name (e.g. "House • WA-03") linking to /race?... with correct params
- [ ] Race rows show skeleton placeholders for candidate count and total raised on initial load
- [ ] Skeletons replace with "N candidates" and "Total raised: $X" as races scroll into viewport (IntersectionObserver — only visible rows fire enrichment calls on load)
- [ ] Scrolling down progressively enriches new rows as they enter the viewport
- [ ] Candidate counts and total raised match the /elections/ endpoint (gold standard, not /candidates/totals/)
- [ ] Second visit within 24h: no /elections/ network calls fire for previously-seen races (verify in DevTools Network tab — served from localStorage cache)
- [ ] localStorage keys prefixed `lf:race:{cycle}:{office}:{state}:{district}` visible in DevTools → Application → localStorage
- [ ] At-large House seats (WY, AK, MT) display without district suffix (e.g. "House • WY" not "House • WY-00")
- [ ] Changing office or state filter updates results instantly with no API call; observer re-fires for newly visible rows
- [ ] Changing cycle triggers new API fetch, full re-render with skeletons, and observer re-wires
- [ ] Filter chips appear for active office and state filters (not cycle)
- [ ] Clearing a chip resets that filter and re-renders
- [ ] "Clear all" button appears when 2+ chips active
- [ ] No-results state shown when filters match zero races
- [ ] Error state shown on API failure; retry button re-fetches
- [ ] Races sorted by state then district within each office group

### URL sync
- [ ] Applying Office or State filter updates the URL (e.g. `/races?cycle=2026&office=H&state=WA`)
- [ ] Changing cycle updates URL with new cycle value
- [ ] Loading `/races?cycle=2024&office=S` restores those filters on page load (cycle dropdown set, office select set, results filtered)
- [ ] Loading `/races?state=WA` restores state filter (state combo input + listbox value set)
- [ ] Clearing all filters resets URL to `/races?cycle=XXXX` (cycle always present)

### Results area
- [ ] `#state-results`, `#state-loading`, `#state-no-results`, `#state-error` all present ✅
- [ ] Retry button present in error state ✅

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

### Header template (shared with candidate.html and committee.html)
- [ ] Header uses `.page-header` wrapper — same padding and border-bottom as candidate and committee headers
- [ ] Race title uses `.page-title` — same Barlow Condensed 800, clamp(1.6rem,3vw,2.4rem), uppercase
- [ ] Header fades in on load (opacity transition via `.page-header-reveal`)

### Race header + tabs bar
- [ ] Race title reads "US HOUSE: WASHINGTON'S 3RD DISTRICT" (long-form, uppercase via `.page-title`)
- [ ] Browser tab title reads "US House: Washington's 3rd District — FECLedger"
- [ ] Tabs bar visible below header with "Candidates" (active) and "Insights" tabs
- [ ] Year dropdown is inside the tabs bar, right-aligned
- [ ] No candidate count in header or meta (removed)
- [ ] Changing year dropdown to 2022 reloads page with `year=2022` in URL
- [ ] ✅ Year dropdown shows 2024 as selected value when URL param is `year=2024`
- [ ] Clicking "Insights" tab shows coming-soon message; clicking "Candidates" shows candidate list

### Dynamic cycle dropdown
- [ ] ✅ Year dropdown options populated from `/elections/search/` endpoint (not hardcoded)
- [ ] House race: dropdown shows historical cycles from FEC data, capped at current cycle
- [ ] Senate race: dropdown shows cycles for both seats (unioned), capped at current cycle + 4
- [ ] No future projected cycles beyond the cap (e.g. no 2060)
- [ ] Network tab: `/elections/search/` and `/elections/` fire near-simultaneously (parallel fetch)
- [ ] If `/elections/search/` fails: dropdown falls back to [2026, 2024, 2022, 2020, 2018]; console warning fires
- [ ] Year in URL not in dropdown (e.g. `year=2028` with no data): page snaps to nearest valid cycle

### Senate class indicator
- [ ] Senate race shows class label in the tabs bar left of the year dropdown (e.g. "Class I seat")
- [ ] ✅ House race does NOT show class label
- [ ] WA Senate 2024 → "Class I seat"; WA Senate 2022 → "Class III seat"
- [ ] Switching year on Senate race: class label updates correctly on reload
- [ ] Class label uses Oswald 400 1.25rem, `--muted` color

### URL param validation
- [ ] ✅ Invalid state (e.g. `state=ZZ`) shows error with back link to /races
- [ ] ✅ Invalid office (e.g. `office=X`) shows error
- [ ] ✅ Odd year (e.g. `year=2023`) shows error
- [ ] Garbage params (e.g. `state=ABCDEFG`) show error, not a loading spinner
- [ ] Valid but no-data params (e.g. `state=WY&office=S&year=2024`) show "No candidates found" (not error)

### Presidential race
**Test URL:** `localhost:8080/race.html?office=P&state=US&cycle=2024`
- [ ] Page loads without "Invalid state: US" error (state=US is valid for presidential races)
- [ ] Page title reads "US President" (not "President • US")
- [ ] Cycle dropdown includes 2028 (currentCycle + 2 cap applies)
- [ ] `localhost:8080/race.html?office=P&state=US&cycle=2028` loads without error

### Candidate cards
- [ ] At least 1 candidate card renders (not a blank list)
- [ ] Each card shows candidate name
- [ ] Each card shows party tag
- [ ] Each card shows financial figures — Raised, Spent, COH — formatted (not $0, not blank)
- [ ] Clicking a card navigates to `candidate.html?id={id}#{year}#summary` (cycle-anchored — verify the hash in the URL after clicking)
- [ ] Incumbent candidate shows "Incumbent" tag (tag-neutral style) next to party tag
- [ ] Challenger candidates show no incumbency tag (party tag only)
- [ ] Between adjacent candidate cards: gap reads as a single 1px line (not doubled)

---

## candidates.html

**Test URL:** `localhost:8080/candidates.html`

### Nav active state
- [ ] "Candidates" nav item is active

### Amplitude events
- [ ] ✅ `Page Viewed` fires with `page: 'candidates'`
- [ ] `Candidates Browsed` fires on auto-load and filter changes with filter properties
- [ ] ✅ `Candidates Searched` fires when `activeQ` is set (search field submitted or `?q=` param) with `query` property
- [ ] ✅ `Candidate Result Clicked` fires on result click with `candidate_id`, `from_page: 'candidates'`, `result_position`
- [ ] ✅ `Candidate Result Clicked` fires on search result click with `from_page: 'candidates_search'`

### Unified control surface
- [ ] ✅ Results auto-load immediately on page visit (no "click Browse" gate)
- [ ] ✅ Search input visible in filter bar alongside dropdowns
- [ ] State combo: typing in state input filters listbox options
- [ ] State combo: selecting from listbox populates text input and triggers fetch
- [ ] Office combo: clicking trigger opens custom listbox; selecting "President" disables state filter; selecting other option re-enables it; trigger label updates
- [ ] Party combo: clicking trigger opens listbox; selecting a party re-fetches and updates trigger label
- [ ] Cycle combo: clicking trigger opens listbox populated with even years 2026–2002; selecting a year re-fetches and updates trigger label
- [ ] All three combos: keyboard nav works (arrow keys move highlight, Enter selects, Escape closes)
- [ ] At ≤860px: combo triggers hidden, native `<select>` elements visible; selecting from native `<select>` triggers fetch
- [ ] ✅ Filter chips row appears when any filter is active; shows chip per active filter
- [ ] Clicking chip `×` clears that filter and re-fetches
- [ ] "Clear all" chip appears when 2+ filters active; clears everything and re-fetches
- [ ] ✅ URL updates (pushState) after every filter change — `?office=H`, `?state=WA`, etc.
- [ ] Opening `?state=WA&office=H` pre-fills controls and auto-fetches with those filters
- [ ] ✅ Error state (`#state-error`) renders and retry button visible when API fails

### Results
- [ ] ✅ Candidate cards render on load (not blank)
- [ ] ✅ Candidate card links to `/candidate/{id}` (clean URL — all modes, not just search)
- [ ] Cards show name (title case), race tag first (`tag tag-neutral` via `formatRaceName()`), then party tag (`tag tag-dem`/`tag-rep`/etc.)
- [ ] Party tag shows correct label: "Democrat", "Republican", "Libertarian", "Green Party", "Independent", or "Party N/A" for unmapped codes
- [ ] Hovering a party tag on desktop shows a tooltip (e.g. "Democratic Party", "No party affiliation on file")
- [ ] Results header shows count (e.g. "1 candidate")
- [ ] No-results state renders if filters return nothing (not blank/crash)

### Typeahead (search field)
- [ ] ✅ Typing 1 character → no dropdown
- [ ] ✅ Typing 2+ characters → typeahead dropdown appears within ~350ms, flush below the input (no gap)
- [ ] ✅ Each typeahead item links to `/candidate/{id}` (clean URL)
- [ ] Each typeahead item: candidate name + `(ID)` on the left, office (`House`/`Senate`/`President`) on the right — no state, no bullet separator
- [ ] ✅ Pressing Escape closes the typeahead
- [ ] Clicking a typeahead result navigates directly to `/candidate/{id}`
- [ ] Clicking outside the dropdown closes it

### Infinite scroll
- [ ] ✅ `#load-more-spinner` exists in DOM, hidden initially
- [ ] ✅ `#end-of-results` exists in DOM, hidden initially
- [ ] Scrolling near the bottom while more pages remain triggers a load-more fetch; spinner appears centered below results, disappears when cards append
- [ ] When all pages are loaded, "End of results" marker appears centered below the last card

### Search via `?q=` param
**Test URL:** `localhost:8080/candidates.html?q=marie`
- [ ] ✅ Filter bar remains visible (no longer hidden in search mode)
- [ ] ✅ Search input is populated with query value
- [ ] ✅ Candidate cards render with results
- [ ] ✅ Candidate card links to `/candidate/{id}` (clean URL)
- [ ] Results header shows count and query (e.g. "1 candidate for "marie"")
- [ ] Infinite scroll: scrolling near bottom triggers fetch for next page (test with broad query like `a`)

---

## committees.html

**Test URL:** `localhost:8080/committees.html`

### Nav active state
- [ ] "Committees" nav item is active

### Amplitude events
- [ ] ✅ `Page Viewed` fires with `page: 'committees'`
- [ ] `Committees Browsed` fires on auto-load and filter changes with filter properties
- [ ] ✅ `Committees Searched` fires when `activeQ` is set with `query` property
- [ ] ✅ `Committee Result Clicked` fires on result click with `committee_id`, `from_page: 'committees'`, `result_position`
- [ ] ✅ `Committee Result Clicked` fires on search result click with `from_page: 'committees_search'`

### Unified control surface
- [ ] ✅ Results auto-load immediately on page visit
- [ ] ✅ Search input visible in filter bar alongside dropdowns
- [ ] State combo: typing filters listbox; selecting from listbox triggers fetch
- [ ] Type combo: clicking trigger opens listbox with 7 options (All types + 6 committee types); selecting re-fetches and updates trigger label
- [ ] Type combo: keyboard nav works (arrow keys, Enter, Escape)
- [ ] At ≤860px: type combo trigger hidden, native `<select>` visible
- [ ] ✅ Filter chips row appears when any filter is active
- [ ] Clicking chip `×` clears that filter and re-fetches
- [ ] ✅ URL updates after filter change — `?type=P`, `?state=WA`, etc.
- [ ] Opening `?state=WA&type=P` pre-fills controls and auto-fetches
- [ ] ✅ Error state (`#state-error`) and retry button visible when API fails

### Results
- [ ] ✅ Committee rows render on load
- [ ] ✅ Committee row links to `/committee/{id}` (clean URL — all modes)
- [ ] Treasurer name always shown in each row (not only in search mode)
- [ ] Committee rows show name → treasurer → type → status (tag + dot); column order matches spec
- [ ] ✅ Clicking anywhere on a committee row navigates to `/committee/{id}` (full row is an `<a>`, not just name link)
- [ ] Committee rows have `var(--surface)` background and full border (not just a bottom rule)
- [ ] Between adjacent committee rows: gap reads as a single 1px line (not doubled)
- [ ] No-results state renders if filters return nothing

### Typeahead (search field)
- [ ] ✅ Typing 1 character → no dropdown
- [ ] ✅ Typing 2+ characters → typeahead dropdown appears, flush below the input (no gap)
- [ ] ✅ Each typeahead item links to `/committee/{id}` (clean URL)
- [ ] Each typeahead item: committee name + `(ID)` on the left, colored status dot only on the right — no state, no type label
- [ ] ✅ Pressing Escape closes the typeahead
- [ ] Clicking a typeahead result navigates to `/committee/{id}`
- [ ] Clicking outside closes dropdown

### Show terminated toggle
- [ ] Toggle is off by default; results exclude terminated committees (no `filing_frequency=T` or `A` rows)
- [ ] Toggling on re-fetches and includes terminated committees; "Include terminated" chip appears
- [ ] Clicking chip `×` turns toggle off, chip disappears, terminated excluded again
- [ ] `?terminated=1` in URL pre-checks the toggle and loads with terminated included
- [ ] Clear all filters resets toggle to off

### Infinite scroll
- [ ] ✅ `#load-more-spinner` exists in DOM, hidden initially
- [ ] ✅ `#end-of-results` exists in DOM, hidden initially
- [ ] Scrolling near the bottom while more pages remain: spinner appears centered below results, disappears when rows append
- [ ] When all pages are loaded, "End of results" marker appears centered below the last row

### Search via `?q=` param
**Test URL:** `localhost:8080/committees.html?q=marie`
- [ ] ✅ Filter bar remains visible (no longer hidden in search mode)
- [ ] ✅ Search input is populated with query value
- [ ] ✅ Committee rows render with results
- [ ] ✅ Committee row links to `/committee/{id}` (clean URL)
- [ ] ✅ Treasurer name visible in each search result row
- [ ] Results header shows count and query (e.g. "1 committee for "marie"")
- [ ] Infinite scroll: scrolling near bottom triggers fetch for next page

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
- [ ] Page Header component card present (`id="comp-page-header"`, status "stable") — documents `.page-header`, `.page-title`
- [ ] Page Header and Candidate Header component demos are visible (not invisible — demos don't use `.page-header-reveal` so no JS required)

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
| Ad hoc race comparison mode not yet built | race.html | 2026-03-10 |
| Schedule B 422s — Schedule B fetch failed: FEC 422 — /schedules/schedule_b/ — Fires 3–7 times per candidate page load. Predates the browse/search overhaul. FEC's /schedules/schedule_b/ endpoint requires committee_id as a mandatory param; at least some calls are firing without it. Contained to the Spent tab. Silently handled (console warning, no user-facing error). Non-blocking — fix before any work that touches the Spent tab. | candidate.html | 2026-03-12 |

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
| 2026-03-11 | Add Raised tab smoke tests — geography heatmap SVG + contributor table row coverage | candidate.html (automated) | None | 177/177 Track 1 passing |
| 2026-03-11 | Audit local apiFetch duplicates in race.html + committee.html | race.html, committee.html (automated) | No local definitions found — already removed in utils.js extraction session | 177/177 Track 1 passing |
| 2026-03-12 | Search overhaul (Session 1) — typeahead dropdown, two-group results preview, formatCandidateName, committee search fixture | search.html, utils.js, styles.css, api-mock.js, search.spec.js (automated) | None | 198/198 Track 1 passing |
| 2026-03-12 | Search overhaul (Session 2) — ?q= search mode on candidates.html and committees.html (filter bar hide, infinite scroll, clean URL links, treasurer in committee search rows) | candidates.html, committees.html, pages.spec.js (automated) | None | 209/209 Track 1 passing |
| 2026-03-12 | Unified browse+search control surface — auto-load, inline search + typeahead, state combo, filter chips, URL sync, error state, clean URLs in all modes; apiFetch concurrency queue (MAX_CONCURRENT=4) | candidates.html, committees.html, utils.js, pages.spec.js, shared.spec.js, api-mock.js (automated) | None | 222/222 Track 1 passing |
| 2026-03-12 | Filing status refactor — filing_frequency 'A' (admin terminated) fix; filingFrequencyLabel/DotClass utilities; replace binary Active/Terminated with raw labels + semantic dot tokens; token naming correction (--filing-active, --filing-terminated) | candidate.html, search.html, committees.html, committee.html, utils.js, styles.css, design-system.html (automated) | None | 222/222 Track 1 passing |
| 2026-03-12 | Polish pass — load-more spinner + end-of-results; typeahead gap fix; search bar compact style; typeahead row unification (.typeahead-row on browse pages); typeahead right-side content trimmed; CSS refactor (.form-input/.form-search-btn + .typeahead-dropdown into styles.css) | candidates.html, committees.html, search.html, styles.css, tests/search.spec.js, tests/pages.spec.js (automated) | None | 226/226 Track 1 passing |
| 2026-03-12 | Senate district tag fix — suppress district '00' in candidate.html office tag | candidate.html (automated) | None | 226/226 Track 1 passing |
| 2026-03-16 | Incumbent tag on race.html candidate cards — reads incumbent_challenge_full from /elections/ response | race.html, tests/helpers/api-mock.js (automated) | Live API returns incumbent_challenge_full (not incumbent_challenge short code) — mock corrected; condition checks both | 226/226 Track 1 passing |
| 2026-03-16 | Add incumbent tag test — assert .tag-neutral "Incumbent" renders on race candidate card; fix missing test coverage from previous session | tests/pages.spec.js (automated) | None | 227/227 Track 1 passing |
| 2026-03-16 | Skeleton loading infrastructure + race context sentence on candidate.html — .skeleton, .tag-context, #race-context, /elections/ fetch | styles.css, candidate.html, design-system.html, tests/candidate.spec.js (automated) | None | 228/228 Track 1 passing |
| 2026-03-19 | Dynamic cycle dropdown + Senate class indicator + URL param validation on race.html | race.html, tests/helpers/api-mock.js, tests/pages.spec.js (automated) | None | 234/234 Track 1 passing |
| 2026-03-19 | Candidate header IA overhaul — tags inline in candidate-row, committees button right-aligned, cycle select in tabs bar, race context bar, profile header top border, .main-inner max-width wrapper | candidate.html, styles.css, design-system.html, tests/candidate.spec.js, tests/smoke.spec.js (automated) | None | 234/234 Track 1 passing |
| 2026-03-19 | .main-inner centering — add to all 7 pages, add margin:auto, update max-width to 1600px; remove profile header top border + page-header-title bottom margin | all pages, styles.css, candidate.html (automated) | None | 234/234 Track 1 passing |
| 2026-03-19 | Visual consistency pass — list item borders, column order, race tag unification, adjacent sibling border fix, .race-list old pattern removed | styles.css, candidates.html, committees.html, search.html, race.html, design-system.html (automated) | None | 234/234 Track 1 passing |
| 2026-03-19 | Party label/tooltip refactor (partyLabel, partyTooltip, partyNaTooltip in utils.js); search.html results-group-header restructure (count+label+query); race-before-party tag order on candidates.html + search.html; committees.html full-row <a> (was name-link only); .committee-name-link deprecated; padding-bottom tweaks on section labels | utils.js, candidates.html, committees.html, search.html, candidate.html, styles.css, tests/pages.spec.js (automated) | 3 tests targeting .committee-name-link (fixed to .committee-row / .committee-name) | 234/234 Track 1 passing |
| 2026-03-19 | Sidebar → fixed top nav refactor — remove sidebar/layout grid/mobile-header; add .top-nav, .mobile-nav drop-down, .top-nav-mobile-search expand panel; update all 9 pages, styles.css, main.js; update shared.spec.js, pages.spec.js, candidate.spec.js, search.spec.js; update design-system comp-nav-item card + token table | All pages, styles.css, main.js, all test files (automated) | 14 stale test references in pages.spec.js, candidate.spec.js, search.spec.js (fixed) | 234/234 Track 1 passing |
| 2026-03-19 | Visual + copy polish — search button SVG icons, placeholder text updates, filter bar background removal, .page-desc removal, .committee-name font-weight, aria-label fixes, nav search input width | All 9 pages, styles.css (automated) | None | 234/234 Track 1 passing |
| 2026-03-19 | races.html browse page — replace mode selector with browse template (page header, filter bar, results area, state combo); fix state dropdown clipping (overflow:visible on .main); update 5 Playwright tests | races.html, tests/pages.spec.js, ia.md (automated) | 5 stale mode-selector tests (replaced with browse page structure tests) | 234/234 Track 1 passing |
| 2026-03-20 | races.html data fetching — cycle dropdown, /elections/search/ race list, progressive /elections/ enrichment with skeleton loading, filter chips, formatRaceName at-large fix, needsApiMock + CANDIDATES_TOTALS mock | races.html, utils.js, tests/helpers/api-mock.js, tests/shared.spec.js (automated) | races.html needsApiMock was false (live API calls caused flaky networkidle timeouts — fixed to true) | 234/234 Track 1 passing |
| 2026-03-20 | Typeahead bug fix (candidates.html + committees.html) — missing `i` index in .map() callback caused silent ReferenceError; added Escape key handling; added 8 Playwright typeahead tests; diagnosed shared API key rate limit; refactored races.html enrichment from fire-all to IntersectionObserver + localStorage caching (24h TTL, aggregate stats only) | candidates.html, committees.html, races.html, tests/pages.spec.js (automated) | None | 242/242 Track 1 passing |
| 2026-03-20 | committee.html structural parity — tabs bar + cycle switcher, cycle-aware renderStats (All time / per-cycle), overspend callout using shared .callout, renderHeader title-cases name, fetchAndRenderBackLink relType param + shared utils, .candidate-card-office removed from styles.css and last call site; COMMITTEE_TOTALS mock updated to 2 records with cycles field; 11 new Playwright tests | committee.html, styles.css, tests/helpers/api-mock.js, tests/pages.spec.js (automated) | None | 253/253 Track 1 passing |
| 2026-03-20 | committee.html follow-up — URL hash encoding (#cycleOrAll#tab, mirrors candidate.html), Tab Switched Amplitude event, overspend suppressed on All time, overspend copy past-tense across 3 files, .callout inline override removed, double border on assoc-list removed; 3 new hash Playwright tests | committee.html, candidate.html, design-system.html, tests/pages.spec.js (automated) | None | 256/256 Track 1 passing |
| 2026-03-20 | committee.html Raised tab — donut chart (contributor types), choropleth map, two donor tables (committee contributors first, then individual); String(activeCycle) coercion fix; CHART_COLORS + ENTITY_TYPE_LABELS moved to utils.js; ALL_CYCLES sort descending on candidate.html; by_state single-call pattern (filters by d.cycle client-side); dynamic table headers; 4 new Playwright raised tab tests | committee.html, candidate.html, utils.js, styles.css, tests/helpers/api-mock.js, tests/pages.spec.js (automated) | None | 260/260 Track 1 passing |
| 2026-03-20 | committee.html Spent tab — donut by category, purpose breakdown bars (PURPOSE_MAP keyword matching), top vendors table (dynamic header), contributions to candidates & committees section (CCM-filtered, conditionally shown); fetchSpentData from ALL_TOTALS + Schedule B pagination; COMMITTEE_TOTALS mock updated with breakdown fields; DISBURSEMENTS enhanced with 3 opex + 1 CCM record; 5 new Playwright spent tab tests | committee.html, tests/helpers/api-mock.js, tests/pages.spec.js (automated) | 2 pre-existing races.html mobile networkidle flaky failures (unrelated to this session — races.html not touched) | 263/265 Track 1 passing (260+5 new; 2 pre-existing flaky) |
| 2026-03-20 | Design cleanup — fix committee spent donut (wrong FEC field names + missing PAC categories), fix Chart.js hidden canvas bug, data note placement, committee header tag styling, remove page-header border-bottom globally, remove page eyebrows, hide breadcrumbs, unify page title sizes, tighten vertical rhythm | candidate.html, committee.html, candidates.html, committees.html, races.html, race.html, process-log.html, design-system.html, styles.css, tests/helpers/api-mock.js (automated) | None | 265/265 Track 1 passing |
| 2026-03-30 | Documentation + API research — verified FEC amendment fields against live API (C00806174), corrected MGP committee ID (was C00696948/Bernie Sanders), updated CLAUDE.md amendment findings, project-brief.md phase audit and roadmap cleanup, Phase 4 backlog additions (IE, refund spike, overhead ratio, dark money signals, comparison builder) | CLAUDE.md, project-brief.md (no code changes) | N/A | No tests run (documentation only) |
| 2026-03-31 | Cleanup + system debt session — doc corrections (race.html paths false alarm, committee.html status sync, ia.md link patterns); incumbent tag on candidate.html profile header; races.html URL sync (cycle/office/state); candidates.html computed cycle dropdown (was hardcoded); PURPOSE_MAP + purposeBucket() moved to utils.js; .committee-name-link deprecation note corrected; --section-gap token formalized; flaky networkidle test fixed (networkidle → load); 2 new Playwright tests | candidate.html, committee.html (via utils.js), candidates.html, races.html, utils.js, styles.css, design-system.html, CLAUDE.md, ia.md, tests/candidate.spec.js, tests/pages.spec.js (automated) | Pre-existing races.html mobile networkidle flakiness resolved this session | 267/267 Track 1 passing |
| 2026-03-31 | Presidential race fixes (VALID_STATES + 'US', formatRaceName → 'US President', cycle cap +2 for P office), races.html mobile networkidle fix (second instance), committees.html Show terminated toggle (filing_frequency array param, chip, URL sync), candidate.html modal 'Terminated' tab label, toggle-switch CSS component, design-system.html ds-component-notes class + note placement cleanup, CLAUDE.md office cycle rhythms note + API key update; 4 new Playwright assertions (toggle DOM, Terminated tab label, state=US valid, US President title) | race.html, utils.js, committees.html, candidate.html, styles.css, design-system.html, CLAUDE.md, tests/pages.spec.js, tests/candidate.spec.js (automated) | None | 271/271 Track 1 passing |
| 2026-03-31 | Design system documentation pass — rename .page-header-title → .page-title globally (styles.css single source, all local overrides removed); modal-scoped committee row spacing (.modal-body .committee-row); comp-raised-grid/comp-map/comp-donut promoted stable; comp-typeahead added (three demo dropdowns); comp-status-dot added; comp-results-groups added; comp-candidate-card extended with stats row; comp-modal updated with tab bar + Pelosi live data; JFA organizer display gap documented in CLAUDE.md; .typeahead-dd retired note removed | styles.css, candidate.html, committee.html, race.html, candidates.html, committees.html, races.html, process-log.html, design-system.html, CLAUDE.md, test-cases.md (no new Playwright tests — documentation/CSS pass only) | None | 271/271 Track 1 passing |
| 2026-03-31 | CSS consolidation session — global banner token substitution (--text/--muted/--border); --overlay-bg token added to :root + modal-overlay; .callout rgba → color-mix(); browse page chrome (~200 lines) promoted from candidates/committees/races/search inline blocks to styles.css section R; profile page inline cleanup (.tabs-bar padding+opacity merged, .cycle-select/.meta-row/.state-msg mobile/.stat-value 480px promoted; .main/.raised-grid/etc. redundant copies deleted from candidate/committee/race/search); design-system.html tabs-bar demo override added | styles.css, candidate.html, committee.html, race.html, candidates.html, committees.html, races.html, search.html, design-system.html, CLAUDE.md (no new Playwright tests — CSS-only refactor, no DOM changes) | None | 271/271 Track 1 passing |
| 2026-04-01 | Accessible state combo (state filter on candidates/committees/races): ARIA combobox/listbox semantics, keyboard nav, mobile native fallback, aria-selected visual indicator, blur timer race fix; Form Controls design-system.html card; initComboDropdown() factory in utils.js (office/party/cycle combos on candidates.html, type combo on committees.html, year/office combos on races.html); CSS specificity fix (.combo-wrap select.form-select to avoid hiding button triggers); 9 new Playwright combo ARIA assertions, 3 ARIA state combo assertions; 4 existing tests updated ({ force: true } for hidden native selects) | utils.js, styles.css, candidates.html, committees.html, races.html, design-system.html, CLAUDE.md, TESTING.md, test-cases.md, tests/pages.spec.js (automated) | CSS specificity bug: buttons with class="combo-trigger form-select" hidden by .combo-wrap .form-select rule (fixed to select.form-select); discovered after two context compactions | 280/280 Track 1 passing |
| 2026-04-01 | Design system cleanup — CSS consolidation: shared position:relative and native-select hide rules merged from .state-combo into .combo-wrap; state-combo div updated to carry both state-combo and combo-wrap classes on all three browse pages. design-system.html: comp-browse-chrome card added (stable); comp-form-controls updated (state-combo filterable demo row, native select label clarified, class list updated, notes rewritten to document initComboDropdown modes / .placeholder / search-bar-wrap scoping) | styles.css, candidates.html, committees.html, races.html, design-system.html (no new Playwright tests — CSS-only + design system documentation pass) | None | 280/280 Track 1 passing |
| 2026-04-02 | Color token audit + consolidation — warm-floor (#ede8e0) and warm-sidebar (#e8e2d8) consolidated into single --bg token at #F8F5EC; --nav-bg removed from :root; warm-card renamed light-card at #ffffff (--surface: #ffffff); .tag-context bg changed from var(--nav-bg) → var(--border); all hardcoded #ede8e0 and #f7f4ef values updated in candidate.html, committee.html, utils.js; CHART_COLORS refactored from hardcoded rgba strings to getComputedStyle IIFE reading CSS vars at runtime; design-system.html Tier 1/2 tables and swatches updated; CLAUDE.md token block updated | styles.css, candidate.html, committee.html, utils.js, design-system.html, CLAUDE.md, tests/shared.spec.js, tests/pages.spec.js (no new Playwright tests — color-only changes, heuristic background tests still pass) | None | 280/280 Track 1 passing |
| 2026-04-06 | Typography refinements (redesign branch) — Oswald weight audit: all font-weight:800/700 declarations updated to 600 across styles.css and design-system.html inline CSS + specimens; Google Fonts import confirmed already at Oswald:wght@400;600; .tag-context updated from IBM Plex Mono 0.62rem → IBM Plex Serif 0.875rem (padding adjusted); IBM Plex Serif section added to typography specimen table in design-system.html; line-height system: body 1.55→1.5, .data-note 1.8→1.75, .callout 1.6→1.75 (three-value system: 1.75/1.5/1) | styles.css, design-system.html (no new Playwright tests — CSS-only, no DOM changes) | None | 280/280 Track 1 passing |
| 2026-04-06 | redesign branch setup + font swap — created redesign branch; renamed ledger.fec → FECLedger across all UI and docs; styled as FEC<em>Ledger</em>; swapped Google Fonts import + all font-family declarations: Barlow Condensed → Oswald, DM Sans → IBM Plex Sans (IBM Plex Mono unchanged); audited Typography section of design-system.html: removed 4 phantom specimens (0.75rem nav, 0.72rem label, 0.68rem tab, 0.62rem chart title), fixed 2 real-but-stale entries (weight 300→400, missing font-family on spans, corrected descriptions); CLAUDE.md updated with new font stack | redesign branch: all HTML files, styles.css, design-system.html, CLAUDE.md (automated — no new Playwright tests needed; font swap is CSS-only, no DOM changes) | None | 280/280 Track 1 passing |
| 2026-04-06 | Typography system pass (redesign branch) — formalized line-height CSS vars (--lh-expanded/normal/tight); snapped off-system lh values (1.1/1.4/1.55/1.6/1.7) across all HTML inline style blocks; added Line-height system group to design-system.html Typography section + Tier 2 token rows; font-size consolidated to three tiers (0.625rem labels / 0.75rem body / 0.875rem medium) across 10 files; design-system.html specimen meta labels updated | styles.css, design-system.html, candidate.html, candidates.html, committee.html, committees.html, races.html, race.html, search.html, process-log.html, CLAUDE.md (redesign branch only) | None | 280/280 Track 1 passing |
| 2026-04-06 | Typography consolidation (redesign branch) — 32 type combos → 10 named styles; .search-hero eliminated (now .page-header + .page-title); .page-title updated (clamp to 5rem, -0.125rem tracking); tabs/cycle-select to 1.25rem Oswald; font-size tiers consolidated (1.1/1.2/1.3rem → 1.25rem); letter-spacing system (--ls-tight/-0.125rem, --ls-expanded/0.1em); stripped all letter-spacing:0 defaults; 10 named type styles documented in styles.css :root + CLAUDE.md + design-system.html; .candidate-name min-width:0 promoted to styles.css; design-system.html specimens rewritten to use production classes; .ds-demo-label class replaces ~15 inline demo labels; .modal-title/.form-search-btn → subheading (0.875rem); .nav-item → body (0.75rem); .committee-name → body-emphasis (0.875rem); .candidate-card-stat-val → subheading (0.875rem) | styles.css, design-system.html, candidate.html, candidates.html, committee.html, committees.html, races.html, race.html, search.html, process-log.html, CLAUDE.md, tests/search.spec.js (redesign branch only) | None | 280/280 Track 1 passing |
| 2026-04-07 | Spacing token system (redesign branch) — 8px grid established; 9 --space-* tokens added to :root (2px–4rem); --page-gutter updated to var(--space-48), --section-gap to var(--space-24), --header-h 52→48px, --banner-h 36→40px (net content offset unchanged at 88px); all padding/margin/gap declarations in styles.css replaced with tokens (~80+ values); 4 documented --space-2 micro exceptions with inline comments; gap:1px in .stats-grid flagged (hairline border technique); mobile :root gutter override updated from 1rem to var(--space-16); design-system.html Spacing section rewritten with named token scale (was 12 ad-hoc rows, now 9 named token rows); token table updated with --space-* group + --header-h/--banner-h rows; CLAUDE.md spacing system + layout token block updated | styles.css, design-system.html, CLAUDE.md (redesign branch only — no DOM changes, no new Playwright tests) | None | 280/280 Track 1 passing |
| 2026-04-07 | Performance fix + spacing token enforcement in inline blocks (redesign branch) — identified render-blocking Amplitude session replay script as cause of extreme localhost lag; added async attribute to all 9 pages; added null guard in main.js for sessionReplay.plugin() race condition; enforced --space-* tokens in all inline <style> blocks across all 9 HTML pages (all padding/margin/gap); applied user-provided off-grid mapping table (0.1–2rem → nearest token); applied same mapping pass to styles.css residuals; 3.5rem + 5rem hero spacings updated to 4rem (--space-64); CLAUDE.md spacing token section updated (scope extended to inline blocks, off-grid mapping table added, token usage descriptions expanded) | main.js, candidate.html, candidates.html, committee.html, committees.html, design-system.html, process-log.html, race.html, races.html, search.html, CLAUDE.md (redesign branch only — no new Playwright tests; no DOM changes) | None | 280/280 Track 1 passing |
| 2026-04-07 | Accessibility + global nav typeahead (redesign branch) — browse page sr-only button fix (candidates.html + committees.html filter bar search had visible form-search-btn outside .search-field; moved inside, added sr-only, removed border-right:none from .search-combo .form-input); search.html #search-input ARIA attributes (role=combobox, aria-haspopup=listbox, aria-expanded=false/true, aria-controls=typeahead-dropdown, aria-autocomplete=list); nav search typeahead global: officeWord + buildTypeaheadHTML + show/hide/doNavTypeahead moved to main.js; bindSearchForm updated with window.__navSearchHandler hook; #nav-typeahead-dropdown added to all 9 pages; search.html sets window.__navSearchHandler to fire inline doSearch instead of redirecting; +11 Playwright tests | main.js, styles.css, search.html, candidates.html, committees.html, candidate.html, committee.html, races.html, race.html, process-log.html, design-system.html, tests/shared.spec.js, tests/search.spec.js, tests/pages.spec.js (automated) | None | 333/333 Track 1 passing |
| 2026-04-07 | Tabs bar redesign (redesign branch) — navy border (2px --color-navy-950), red active indicator (4px --color-red-700), gap spacing (--space-16), cycle select reordered to last child (margin-left:auto pushes right); tabs-bar moved outside .main-inner to direct child of .main on candidate.html + committee.html for full-viewport border; responsive max() padding aligns tab content with .main-inner at wide viewports; tab colors updated (navy-950 default, muted hover); design-system.html demos updated | styles.css, candidate.html, committee.html, design-system.html, CLAUDE.md, test-cases.md (redesign branch only) | None | 333/333 Track 1 passing |
| 2026-04-07 | Redesign cleanup (redesign branch) — heading type style weight 600→400 (styles.css, design-system.html, process-log.html, CLAUDE.md); breadcrumbs removed sitewide (HTML markup, CSS rules, JS functions, 3 Playwright tests, all doc references); avatar removed from candidate profile (HTML, CSS, getInitials() JS, 1 Playwright test, all doc references) | styles.css, candidate.html, committee.html, race.html, design-system.html, process-log.html, tests/candidate.spec.js, tests/pages.spec.js, CLAUDE.md, project-brief.md, test-cases.md, TESTING.md (redesign branch only) | None | 329/329 Track 1 passing |
| 2026-04-08 | Profile header redesign (redesign branch) — formatRaceLabelLong() + STATE_NAMES + toOrdinal() added to utils.js; candidate.html: .candidate-race-label (red-700, links to race page) above name, race tag removed from meta-row (party only); styles.css: .page-title color → var(--color-navy-950); race.html: formatRaceLabelLong() for title, tabs bar (Candidates/Insights), year-select moved into tabs bar, Senate class → #race-seat-class, candidate count removed, showTab(); committee.html: #back-link-area removed from header, fetchAndRenderBackLink → fetchAndRenderAssocSection (assoc-section card in Summary tab preserved); docs + design-system.html + test-cases.md updated; +11 Playwright tests, 2 stale tests corrected | utils.js, candidate.html, committee.html, race.html, styles.css, design-system.html, CLAUDE.md, test-cases.md, tests/candidate.spec.js, tests/pages.spec.js (redesign branch only) | None | 341/341 Track 1 passing |
| 2026-04-08 | Compact sticky header + sticky stack (redesign branch) — #compact-header added to candidate.html (sticky [race]/[name] strip, z-index:190, populated from formatRaceLabelLong + displayName, scroll listener on profile-header-row.bottom <= headerH); .tabs-bar made sticky sitewide (position:sticky, top:var(--header-h), z-index:185, background:var(--bg)); .main overflow-x:hidden → overflow-x:clip (bug fix — hidden created scroll container breaking all sticky children); #profile-header-row id added; tabs-bar top offset updated dynamically; global banner &nbsp; removed across all 9 pages; +2 Playwright assertions for #compact-header | candidate.html, styles.css, tests/candidate.spec.js, all 9 HTML pages (banner cleanup) | Trigger timing: compact header requires profile-header-row to fully clear the nav before appearing — single-element refactor planned (see plans/adaptive-shimmying-sutton.md) | 343/343 Track 1 passing |
| 2026-04-08 | Profile page CSS consolidation (redesign branch) — .content/.committee-content/.race-content → .profile-content in styles.css (padding:--space-32, opacity:0 reveal); .candidate-row/.committee-header-row → .profile-header-row (no margin-bottom); .candidate-name/.committee-name-display/.race-title → .page-title only (.profile-header-row .page-title gets min-width:0); .page-header bottom padding --space-16 → --space-32; .candidate-race-label margin-bottom removed; display type clamp 1.6–5rem → 2rem–4.5rem; CLAUDE.md + design-system.html + test-cases.md updated; tests/pages.spec.js + smoke.spec.js updated (2 class → ID selector updates) | styles.css, candidate.html, committee.html, race.html, design-system.html, CLAUDE.md, tests/pages.spec.js, tests/smoke.spec.js (redesign branch only) | None | 343/343 Track 1 passing |
| 2026-04-08 | Single-element compact header (redesign branch) — replaced two-element approach (#compact-header + full header) with single sticky #profile-header that transitions full↔compact via .compact class; position:sticky always applied; scroll listener on #profile-header-sentinel (zero-height normal-flow sibling); display:flex always, removeProperty('display') in reveal code so CSS controls flex entirely; max() padding trick for full-viewport width constraint; pattern ported to committee.html + race.html; fixed duplicate removeProperty in committee.html rAF; fixed race.html style.display='block'; CLAUDE.md compact header note updated | styles.css, candidate.html, committee.html, race.html, CLAUDE.md, test-cases.md (redesign branch only — no new Playwright tests; DOM sentinel + compact class already covered by candidate.spec.js assertions from prior session) | None | 343/343 Track 1 passing |
| 2026-04-09 | feed.html — live filing feed page (redesign branch): new page with load-all-upfront architecture (per_page=100, parallel fetch), client-side office/report-type/time-window filters, filter chips, refresh with dedup + highlight animation + feedback states, state-wrapper pattern matching browse pages; "Feed" nav link added to all 10 HTML pages + _redirects; .button-group + .button-group-btn + .end-of-results promoted to styles.css; explicit height:34px on .form-select/.form-input/.button-group-btn for alignment; FEC API quirks documented (committee_type repeated param ignored, null-office F3 filers); "Try broadening your search" removed from all browse pages; toTitleCase removed from committee names on feed + committees browse; 7 Amplitude events (Page Viewed, 3 filter events, feed_refresh, Feed Filing Clicked, Feed FEC Link Clicked); +16 feed-specific Playwright tests in pages.spec.js; +14 shared tests for feed.html in shared.spec.js; FILINGS mock fixture added to api-mock.js | feed.html (new), _redirects, styles.css, CLAUDE.md, ia.md, TESTING.md, test-cases.md, candidates.html, committees.html, races.html, committee.html, candidate.html, race.html, search.html, process-log.html, design-system.html, tests/shared.spec.js, tests/pages.spec.js, tests/helpers/api-mock.js | 1 pre-existing flaky candidate.spec.js test (passes on retry, unrelated) | 377/377 Track 1 passing |
| 2026-04-09 | Maintenance + design-system.html audit (redesign branch): Amplitude Page Viewed bug fix on feed.html (moved out of init() — was firing on every window change; now fires once at IIFE bottom); design-system.html nav demo updated (Feed link added, was showing only 3 links); Browse Page Chrome card notes updated with state-wrapper pattern documentation (#state-loading/#state-results/#state-no-results/#state-error + showState()); filter-chips-wrap vs #filter-chips inconsistency investigated — confirmed non-issue (feed already has both class and id, consistent with all browse pages) | feed.html, design-system.html | None | 377/377 Track 1 passing |
| 2026-04-09 | Card surface strip (redesign branch, styles.css only): removed background/border/padding from .banner, .chart-card, .donors-card, .raised-cell, .raised-grid; replaced .stats-grid 1px-gap-trick with border-top/bottom (#05234f) + per-cell border-right; promoted .raised-cell-title/.donors-head/.chart-title/.banner-label to heading type style (Oswald 400 1.25rem); --section-gap increased to --space-32; .raised-grid gap set to --space-64; padding-top moved from title elements to parent containers; design-system.html inline overrides + type specimen + token table updated; CLAUDE.md spacing token notes updated | styles.css, design-system.html, CLAUDE.md, test-cases.md (redesign branch — no HTML/JS changes) | None | 377/377 Track 1 passing |
| 2026-04-09 | Token audit + --border update (redesign branch): audited --subtle (#46403a), --border (#cdc7bc), --surface2 (#eee9e1) across all files (html/css/js/md); updated --border → #D7D1C7 and warm-rule primitive; updated styles.css :root, CLAUDE.md, design-system.html (Tier 1 table, semantic token table, swatch data-hex + display) | styles.css, CLAUDE.md, design-system.html (redesign branch — no DOM changes) | None | 377/377 Track 1 passing |
| 2026-04-10 | Compact sticky header debugging (redesign branch) — three layered scroll-bug fixes: suppressUntil 100ms cooldown (scroll clamping events post-transition), paddingBottom compensation on .main (Math.min(80, fullH - compactHeaderH) — keeps document height stable so scrollY can reach un-compact threshold), showTab minHeight lock (candidate.html + committee.html — locks .main minHeight to scrollHeight before switching to unrendered Raised/Spent tab, clears after render); body overflow-x:clip fix (was hidden — implicit scroll container broke overflow-anchor targeting); +4 Playwright scroll behavior tests (compact class on scroll, un-compact on scroll to top, paddingBottom set/cleared); CLAUDE.md compact header section updated; TESTING.md count 381→385 | candidate.html, committee.html, race.html, styles.css, tests/candidate.spec.js, CLAUDE.md, TESTING.md, test-cases.md (redesign branch) | None | 385/385 Track 1 passing |
| 2026-04-10 | Summary strip + health banner refinements (redesign branch): banner copy updates ("No filings this cycle"; "Cycle concluded with..." + "Final coverage: {date}" moved to banner-note); .banner-label + .banner-desc promoted to prose type (IBM Plex Serif 0.875rem, no uppercase); navy border-top (#05234f) added to .banner; .banner margin-bottom → --space-16; .tag-context padding/background/border-radius removed (now inline serif prose with flex layout preserved); .banner + .stats-grid hoisted out of #tab-summary into new persistent #summary-strip wrapper on candidate.html; same pattern mirrored on committee.html (stats-grid only, "Financial Summary" section title removed); edge-to-edge navy borders via scoped gutter padding on .banner/.stats-grid children (strip itself full-width inside .main-inner); mobile stats-grid :nth-child(even)/border-right:none and :nth-child(-n+2)/border-bottom rules for 2x2 layout; stat card reorder (candidate: Ratio/COH/Raised/Spent; committee: Coverage/COH/Raised/Spent); .profile-content padding-top:0 scoped override; reveal JS wires #summary-strip alongside #race-context-bar + #content; design-system.html type specimen lists updated (banner-label/desc moved heading/body → prose), Health Banner status demoted stable → candidate-only, Stats Grid demo reordered + "Raised-to-Spent Ratio" label corrected, component notes updated (banner, tag context, stats grid), 5 demo padding:0 inline overrides removed (Page Header, Candidate Header, Stats Grid, Raised/Spent Grid, Browse Page Chrome), Tab Bar + Data Table padding:0 removed; design-system.html + process-log.html .main max-width → 1600px + centered; process-log #view-reflections/#view-build capped at 724px; +4 Playwright tests (candidate + committee summary-strip persistence across tabs; first stat card label assertion on both) | styles.css, candidate.html, committee.html, design-system.html, process-log.html, CLAUDE.md, TESTING.md, test-cases.md, tests/candidate.spec.js, tests/pages.spec.js (redesign branch) | None | 381/381 Track 1 passing |
