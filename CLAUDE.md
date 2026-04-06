# Claude Code Brief — FECLedger
*Hand this to Claude Code at the start of each session.*

---

## Frontend skill

**Frontend skill:** Use the `frontend-design` skill whenever creating or modifying UI — new components, new pages, style updates, CSS edits, design token changes. It should assess the existing design system, work within it where it's sound, and propose or apply systematic improvements where it isn't. Consistency and systems thinking take priority over local fixes.

---

## What this is

A web-based campaign finance visualization tool built on the FEC public API. The goal: give political strategists, journalists, and researchers a faster, clearer window into where money is flowing in a race than the FEC website provides.

This is also a portfolio piece for a staff-level product designer (Sloane). It needs to look and feel like a designer built it — not a developer prototype.

**Live URL:** sloanestradley.netlify.app  
**Repo:** GitHub (ask Sloane for the repo URL if you don't have it)  
**Deployment:** Netlify, auto-deploys on push to main. **Pretty URLs is enabled** (site setting) — Netlify automatically strips `.html` from URLs and redirects to clean paths.

**`redesign` branch:** An active long-running branch for visual redesign exploration. It has a separate Netlify branch preview (auto-deployed on push). **Do not merge to main and do not use it for feature/bugfix work** — Phase 4 and any functional changes go on main. If you open a session and `git branch --show-current` shows `redesign`, all work in that session should be visual/design work scoped to the branch. Intentional divergences from main on this branch:
- Project name: `FECLedger` (main still uses `ledger.fec`)
- Font system: Oswald + IBM Plex Sans + IBM Plex Serif (main uses Barlow Condensed + DM Sans)
- Typography specimens in design-system.html updated to reflect the new font system
**Analytics:** Amplitude
- Integrated on the original FRED proof-of-concept index page; may not be present on all current pages — audit before assuming
- Pageview tracking is the baseline expectation on every page
- Meaningful interactions worth tracking: tab switches on the candidate page, committee modal opens, build log / reflections toggle on process log, search queries and result clicks (once search is built)
- Do not add a second Amplitude instance to pages that already have it — check first

---

## Tech stack

- Vanilla HTML/CSS/JS — no framework, intentional for this stage
- Chart.js 4.4.0 + chartjs-adapter-date-fns 3.0.0 (time scale support)
- Google Fonts: Oswald (display/headings) + IBM Plex Sans (body/nav) + IBM Plex Serif (available, not yet assigned) + IBM Plex Mono (labels/data) — **redesign branch only**; main still uses Barlow Condensed + DM Sans
- FEC public API: `https://api.open.fec.gov/v1`
- Netlify Functions for any server-side API proxying needed
- No build step — files are served directly
- **Clean URLs:** `_redirects` defines Netlify 200 rewrites for all pages. Profile pages with path-segment URLs (`/candidate/:id`, `/committee/:id`) **must use absolute paths** for every local resource and nav link — `href="/styles.css"`, `src="/main.js"`, `href="/candidates"`, etc. Relative paths break because the browser treats the path segment as a subdirectory (e.g. from `/candidate/H2WA03217`, relative `utils.js` resolves to `/candidate/utils.js`, which also matches the rewrite rule and returns HTML served as JS). Browse pages (`/candidates`, `/committees`, `/races`, `/race`, `/search`) use single-level paths so relative links still resolve to root — but any new page with a deeper path must follow the absolute-path rule.
- **Testing:** Playwright (`@playwright/test`) — `npx playwright test` runs 280 structural tests (mocked API); `npm run test:smoke` runs 5 live-API smoke tests. See `TESTING.md`.
- **apiFetch concurrency queue:** `utils.js` implements a `MAX_CONCURRENT = 4` request queue to avoid 429 rate-limit errors when pages fire many parallel API calls (candidate page fires 15–20 on load). All calls still execute — they just pace to ≤4 in-flight at a time. No call-site changes needed; `apiFetch(path, params)` signature is identical.
- **FEC API key is shared across all users:** The key in `utils.js` is client-side and visible in source. All visitors to the site draw from the same 1000-calls/hour limit. `races.html` was the primary offender (475 calls/visit) — mitigated via IntersectionObserver enrichment + localStorage caching (see Races browse architecture section). An upgraded key has been confirmed at 7,200 calls/hour (120 calls/min). Rotate the key before public launch (currently exposed client-side in utils.js — Netlify Function proxy is the fix).
- **FEC API field verification:** Before writing logic that depends on a specific field name or value from any FEC endpoint, verify the actual response shape first. Navigate directly to the endpoint in a browser (or use `apiFetch` in the console) and confirm field names, value formats, and null behavior. Do not infer from the FEC docs alone — the docs and actual responses diverge in practice (e.g. `/elections/` returns `incumbent_challenge_full` as `"Incumbent"/"Challenger"/"Open seat"`, not the single-letter `incumbent_challenge` code). Document any verified field behavior in the relevant section below.

---

## Design system

**Reference file:** `design-system.html` is the living design system reference. Read it (or at minimum the token table and component list) before building any new page or component.

**Skeleton loading:** `.skeleton` (in `styles.css`) is the standard placeholder for content that loads asynchronously after the initial page render. Use it whenever a UI element shows a loading state before data resolves — set `width` and `height` inline to approximate the expected content size. Do not define page-specific skeleton keyframes; always use the shared class. Size guidance: height should match the resolved element's total height (content + padding), width should approximate the minimum resolved state. Do NOT wrap the skeleton in its resolved container (e.g. `.tag-context`) during loading — that adds a second visible background layer behind the pulse.

**Tag context:** `.tag-context` (in `styles.css`) is a filled-background tag variant for contextual prose inline with the tag row. No border, no uppercase — distinct from `.tag`. Used for the race context sentence on the candidate profile. Promote from `candidate-only` to `stable` in `design-system.html` when used on a second page.

**Shared files:** `styles.css` contains the CSS reset, token `:root`, shared layout (sidebar, mobile nav, header), utility classes, and all shared component CSS — including `.page-header` (layout-only: padding — no border, no animation), `.page-header-reveal` (animation modifier: `opacity:0` fade-in; add this alongside `.page-header` on elements that JS reveals via `.visible`; profile pages use both, browse/static pages use `.page-header` only), `.page-title` (Barlow Condensed 800, clamp 1.6–2.4rem, uppercase, margin-bottom 0.5rem — used as the page title on all pages: candidate, committee, race, and browse pages), and `.breadcrumb` (breadcrumb typography and link styles; `text-transform:uppercase` applied — currently hidden via `display:none` on all profile pages; JS wiring preserved for future redesign), `.tabs-bar` (profile tab strip — includes `padding:0 var(--page-gutter)`, `opacity:0`, `transition` reveal; add `.tabs-bar.visible` via JS to reveal), `.tabs-bar.visible` (opacity:1), `.cycle-select` (the cycle `<select>` element inside `.tabs-bar`), and `.meta-row` (flex row of tags/badges below the page title on profile pages — used on candidate.html and committee.html). `main.js` contains Amplitude init + Session Replay, mobile scroll-aware header, and hamburger nav (all null-guarded). `utils.js` contains shared JS utilities: `BASE`, `API_KEY`, `apiFetch` (concurrency-limited to MAX_CONCURRENT=4 — see tech stack note), `fmt`, `fmtDate`, `toTitleCase`, `formatCandidateName` (semantic alias for `toTitleCase` — use this when rendering candidate names at call sites), `partyClass`, `partyLabel` (returns human label: "Democrat", "Republican", "Libertarian", "Green Party", "Independent", or "Party N/A" for unmapped codes — N/A bucket: NNE/NON/UNK/OTH/NPA/UN/W/O), `partyTooltip(p, party_full)` (returns title attribute text: title-cased `party_full` if available, fallback map for known codes, "No party affiliation on file" for N/A bucket), `committeeTypeLabel`, `formatRaceName` (returns e.g. `'House • WA-03'` from office/state/district — suppresses district suffix when district is `'00'` for at-large seats; returns `'US President'` for office `'P'` (no bullet, no state suffix); used by candidate breadcrumb, race title, race breadcrumb, and races browse page), `CHART_COLORS` (JS chart color palette — raised/spent/COH line colors, donut/tooltip/axis colors; used by candidate.html and committee.html chart configs), `ENTITY_TYPE_LABELS` (maps FEC entity type codes to human labels: PAC, Party committee, Committee, Candidate committee, Organization, Candidate (self), Individual — used by Schedule A contributor tables), `PURPOSE_MAP` (ordered array of disbursement purpose buckets with keyword patterns — used by Spent tab on candidate.html and committee.html), `purposeBucket(desc)` (maps a disbursement description string to a PURPOSE_MAP label, or 'Other' — used by renderSpendDetail() on both Spent tabs). Every page links all three (main.js → utils.js → inline script block).

**CSS consolidation principle:** Component CSS lives in `styles.css`. Inline `<style>` blocks in individual pages are for page-specific overrides only (layout grid, page-specific spacing, page-specific components). `design-system.html` imports the same `styles.css` as production — no component CSS is duplicated between pages.

**Design system demo override pattern:** Any shared component rule that uses `opacity:0` / `transition` for a JS-revealed animation needs a matching override in `design-system.html`'s inline `<style>` block, alongside the existing `.page-header-reveal` reset: `.ds-component-demo .component-class { opacity:1; transition:none; }`. Demos don't run page JS so `.visible` is never added — without the override, the component renders invisible in the design system. Currently: `.page-header-reveal` and `.tabs-bar` both have overrides at line 115–117 of `design-system.html`.

**Flush list item border pattern:** List items that stack flush in a column (`.candidate-card`, `.committee-row`, `.committee-result-row`) use the adjacent sibling selector to suppress the doubled border: `component + component { border-top:none }`. The container (`.results-list`, `.race-list`) is a plain `flex-direction:column` with no border, no background, no gap. Do not use inset `box-shadow` as an alternative — two touching inset shadows still render as a doubled line on retina displays.

**`.candidate-card-office` — removed:** Replaced by `<span class="tag tag-neutral">` with `formatRaceName()` output on all pages. CSS rule and last call site (committee.html) both removed 2026-03-20.

**`.committee-name-link` — active in modal, removed from committees.html:** The `.committee-row` in committees.html converted to a full `<a>` tag — the inner `.committee-name-link` anchor is gone there. However, the class is still in use in `candidate.html`'s committees modal (`renderCommitteeGroups()`) as the link on each committee name. The CSS rule in `styles.css` should stay. Remove only after that modal render is refactored.

**Party tag render order:** Race tag first, party tag second — on candidates.html, search.html, and candidate.html. This is the canonical order. Party tag always includes `title="..."` via `partyTooltip(c.party, c.party_full)` — native browser tooltip on desktop hover.

**Office/race display in candidate cards:** Use `formatRaceName(c.office, c.state, c.district)` + `<span class="tag tag-neutral" style="font-size:0.62rem">` to render the race/seat label in candidate card meta rows. This is the canonical pattern on all three browse pages.

**Shared form controls:** `.form-input`, `.form-select`, `.form-search-btn` (and their focus/disabled variants) are defined in `styles.css` and used across search.html, candidates.html, and committees.html. `.toggle-switch` (CSS-only pill toggle: hidden checkbox + `.toggle-track` + `.toggle-knob` + `.toggle-label`) is also defined in `styles.css` — used on committees.html filter bar for "Show terminated". `.toggle-label` uses DM Sans 0.8rem to match form input value text. Also in `styles.css` (promoted from candidates.html/committees.html): `.search-combo` (position:relative; display:flex — the search input + button row), `.search-combo .form-input` (flex:1; min-width:160px; border-right:none), `.state-combo`, `.state-combo .form-input`, `.filter-bar-wrap`, `.filter-bar`, `.form-field`, `.form-label`, `.filter-chips-wrap`, `.filter-chip`, `.chip-x`, `.chip-clear-all`, `.results-area`, `.no-results`, `.error-prompt`, `.retry-btn`. Page-specific extensions stay inline: `.form-select.wide` (committees only), `.search-bar .form-input` (search.html flex + border-right). **Custom combo dropdowns:** `.combo-wrap` + `.combo-trigger` (in `styles.css`) + `initComboDropdown(config)` (in `utils.js`) implement the accessible filter dropdown pattern used for office/party/cycle on candidates.html, type on committees.html, and year/office on races.html. The trigger `<button>` carries both `combo-trigger` and `form-select` classes for visual consistency — **critical:** the hide/show CSS for native selects inside `.combo-wrap` must use `select.form-select` (type-qualified), not `.form-select`, to avoid hiding the button via specificity. At ≤860px, `.combo-wrap .combo-trigger { display:none }` and `.combo-wrap select.form-select { display:block }` swap in the native `<select>` for mobile. `initComboDropdown` returns `{ setValue(v), setDisabled(bool) }` — use these in `clearFilter`, `clearAllFilters`, and `init` to keep combo state in sync with `activeFilters`. **CSS consolidation (2026-04-01):** `.combo-wrap` is now the single source for `position:relative` and `select.form-select { display:none }` (desktop) / `select.form-select { display:block }` (mobile) / `.typeahead-dropdown { display:none !important }` (mobile). `.state-combo` retains only its unique rules: `.form-input { width:120px }`, `.typeahead-dropdown { min-width:200px }`, mobile `.form-input { display:none }`, mobile `select.form-select { width:120px }`. All three state-combo divs in HTML carry both `state-combo` and `combo-wrap` classes.

**`apiFetch` array params:** `utils.js` `_execute` supports array values in the params object — `{ filing_frequency: ['-T', '-A'] }` correctly serializes to `filing_frequency=-T&filing_frequency=-A`. This was added 2026-03-31 to support multi-value filter params. All existing scalar call sites are unaffected.

**Typeahead container:** `.typeahead-dropdown` is the canonical class, defined in `styles.css` (position, sizing, shadow, `display:none` default, `max-height:240px`, `overflow-y:auto`). All three search pages (search.html, candidates.html, committees.html) use `.typeahead-dropdown`. Toggle mechanism differs by page: browse pages use `classList.add/remove('open')` with `.typeahead-dropdown.open { display:block }`; search.html uses `style.display` directly. **Critical:** The `.map()` callback in `renderTypeahead()` on browse pages must be `function(c, i)` — the `i` index is used in the Amplitude onclick string. If omitted, a `ReferenceError` silently kills the typeahead (caught by the surrounding try/catch, which calls `closeTypeahead()`). All three pages handle Escape key to close the typeahead.

**Typeahead item format:** candidates.html right side = office word only (`House`/`Senate`/`President`, no state, no bullet). committees.html right side = status dot only (no text label). search.html uses the same format as these — it is the reference.

**Chart colors:** `--chart-*` CSS vars in `styles.css :root` are the canonical chart palette. JS chart configs reference the `CHART_COLORS` constant defined in `utils.js`. `CHART_COLORS` is populated via a `getComputedStyle` IIFE that reads the CSS variables at runtime — changing a token in `styles.css :root` automatically propagates to charts with no changes needed in `utils.js`. HTML legend swatches use the CSS vars directly (`style="background:var(--chart-raised)"`). Add new chart color vars to `styles.css :root` first; `utils.js` will pick them up via the IIFE.

### Token naming tiers

- **Tier 1 — Primitives:** Raw hex values. Not CSS vars. Documented in `design-system.html` only. Do not use directly in components.
- **Tier 2 — Semantic tokens:** CSS vars in `styles.css :root`. Named by meaning, not appearance (`--bg`, `--surface`, `--dem`, `--green`). New tokens always go here first. Add to `styles.css :root` and document in `design-system.html`.
- **Tier 3 — Component tokens:** Not yet built. Would be things like `--tag-dem-bg`. Document as `planned` in `design-system.html` before building.

**Rgba semantic token refactor — deferred:** Several semantic tokens in `:root` (`--chart-raised`, `--chart-spent`, `--chart-overlay-*`, etc.) are expressed as raw `rgba()` values rather than `color-mix()` derivations from primitives. This is a known cleanup item. Blocked on a decision about whether blue-500 (`#4a90d9`), red-500 (`#d94a4a`), and chart-amber (`rgba(232,160,32,...)`) should be promoted to `:root` as explicit primitive tokens. Do not refactor piecemeal — address as a single pass when unblocked.

**Page gutter pattern:** All content sections use `var(--page-gutter)` for horizontal padding — not hardcoded `3rem`/`1rem`. This means mobile padding is controlled in one place (the `:root` override in `styles.css`'s `@media (max-width:860px)` block). When adding a new page or content section, use `padding: <vertical> var(--page-gutter)` and you get correct desktop/mobile gutters for free. Component-internal padding (buttons, cards, modals) should remain hardcoded.

**Known intentional overlap:** `--red` and `--rep` both resolve to `#d94a4a`. `--rep` = Republican partisan color; `--red` = status color (stressed/error). Do not merge them. If the status system ever diverges from the partisan palette, split them at that point.

### Component status lifecycle

Each component in `design-system.html` has a `data-status` attribute and badge:
- New component added to one page → document with `candidate-only` or `log-only` status in the same session
- Component moves to a second page → update status to `stable`
- Component being removed → set `deprecated` first, remove code in a later session
- Planned component → add with `planned` status before building

### Figma data attributes

Every color swatch has `data-token` and `data-hex` attributes. Every component card has `id="comp-{name}"`. Preserve these when editing `design-system.html`.

---

### CSS variables (defined in `styles.css :root`)

Light "broadsheet" theme. Key CSS variables:

```
--bg: #F8F5EC        (page background + nav)
--surface: #ffffff   (cards, panels)
--surface2: #eee9e1  (chart interiors, inset elements)
--border: #cdc7bc
--border-strong: #a8a099  (strong borders, nav dots default)
--text: #1a1510
--muted: #625b52
--subtle: #46403a
--dem: #1e3a5f       (Democrat)
--rep: #a83228       (Republican)
--ind: #5a4a7a       (Independent)
--green: #1e6644     (healthy)
--filing-active: #3dbf7a (active filing status dot)
--amber: #8a5f10     (watch / warning)
--red: #a83228       (stressed)
--filing-terminated: #a8a099 (terminated filing status dot)
--accent: #2c5282    (interactive accent, active indicators)
--accent-dim: rgba(44,82,130,0.1)  (accent tint)
--overlay-bg: rgba(26,21,16,0.65)  (modal and drawer overlay scrim)

Layout tokens:
--page-gutter: 3rem       (horizontal content padding — 1rem at mobile ≤860px)
--section-gap: 1.5rem     (vertical margin-bottom between stacked content sections — .banner, .chart-card, .donors-card, .stats-grid, .raised-grid)

Nav tokens:
--nav-active-bg: #d4cdc3  (nav active state background — currently unused, reserved)
```

Typography: Oswald 400–600 for display/headings (uppercase), IBM Plex Sans 400–600 for body/nav, IBM Plex Mono 400–600 for labels and data. (redesign branch; main uses Barlow Condensed + DM Sans)

---

## Current files

```
index.html        — Root redirect → search.html (entry point)
search.html       — Candidate name search (live)
candidates.html   — Unified browse+search (live): auto-load, inline search + typeahead, state combo, filter chips, URL sync, error state
candidate.html    — Single candidate profile (live, primary active file)
committees.html   — Unified browse+search (live): auto-load, inline search + typeahead, state combo, filter chips, URL sync, error state, "Show terminated" toggle (off by default — excludes `filing_frequency=T/A`; `?terminated=1` URL param)
committee.html    — Single committee profile (tabs bar + cycle switcher live; Raised tab live; Spent tab live — donut by category, purpose bars, vendors table, contributions to candidates & committees; filing history removed from scope)
races.html        — Browse races by year, office, state (live — progressive enrichment from /elections/; URL sync on cycle/office/state filters)
race.html         — Single race view — all candidates in a contest (scaffold)
process-log.html  — Living case study / dev diary
design-system.html — Token and component reference (live)
project-brief.md  — Full product vision and open questions
ia.md             — Information architecture reference (page inventory, nav structure, URL patterns)
test-cases.md     — Manual browser test checklist; one section per page + shared checks + test log
TESTING.md        — Playwright automated test setup, Track 1 vs Track 2 commands, how mocking works
playwright.config.js       — Playwright config (Track 1, structural, mocked API)
playwright.smoke.config.js — Playwright config (Track 2, smoke, live FEC API)
package.json      — npm scripts: test, test:smoke, test:report
_redirects        — Netlify clean URL rewrites (200 rewrites; HTML files stay in root)
tests/
  helpers/amp-mock.js  — Amplitude mock (blocks CDN, stubs sessionReplay, reads _q queue)
  helpers/api-mock.js  — FEC API mock (route intercept + fixture data for all endpoints)
  shared.spec.js       — 63 structural tests × all 9 pages (nav, CSS, Amplitude, background)
  candidate.spec.js    — candidate.html tests (stats, modal, chart, tabs, Amplitude events)
  search.spec.js       — search.html tests (states, interaction, Amplitude events)
  pages.spec.js        — all other pages + mobile layout
  smoke.spec.js        — 5 live-API smoke tests (@smoke tagged)
```

**Local dev:** `python3 -m http.server 8080` from project root → `localhost:8080/` (redirects to search.html)

---

## Candidate page: current state

The candidate page (`candidate.html`) is the main work in progress. It accepts any candidate via `?id=` URL param (e.g. `candidate.html?id=H2WA03217`). MGP is the default fallback for development.

- **Test candidate:** Marie Gluesenkamp Perez — `H2WA03217` (House, WA-03)
- **Also verified with:** Kirsten Gillibrand — `S0NY00410` (Senate, NY)
- **Local dev:** `python3 -m http.server 8080` from project root, then `localhost:8080/candidate.html?id=H2WA03217`

### What's working
- Three-segment linked breadcrumb: Candidates → race (e.g. `House • WA-03`, links to `/race?...&year={activeCycle}`) → candidate name (plain text). `updateBreadcrumb()` is called after initial load and at the top of `loadCycle()` so the race link year stays in sync with the selected cycle. **Currently hidden** via `display:none` — JS wiring preserved for future redesign.
- Profile header (no top border); initials avatar, office/district tag first then party tag, all inline in `.candidate-row` with flex-wrap; "Committees (N) →" trigger floats right via `margin-left:auto` within the same row
- Race context sentence (`.tag-context` pill sourced from `/elections/`, skeleton while loading) lives in a persistent `#race-context-bar` strip between the tab bar and content — visible on all tabs
- Cycle switcher is a `<select>` element, first child of `.tabs-bar`, populated from `election_years` — `loadCycle()` updates `select.value` in sync; Amplitude `Cycle Switched` fires on `onchange`
- URL anchor encodes cycle + tab: `candidate.html#2024#summary`
- Tab navigation: Summary, Raised, Spent
- Stats row: Total Raised, Total Spent, Cash on Hand, Raised-to-Spent Ratio
- Cycle-aware banner: health signal (green/amber/red) for active cycles; "Cycle Complete" summary for closed cycles
- Associated committees modal: "Committees (N) →" trigger in profile header opens a modal with Active and History tabs; committees fetched eagerly at init so count is immediate
- Responsive layout: desktop sidebar nav, mobile scroll-aware header + hamburger drawer
- Smooth fade-in animations on load; profile header, tabs bar, race context bar, and content all revealed together in the RAF block
- `.main-inner` wrapper inside `.main` constrains content to `max-width:1600px` and centers it via `margin-left:auto; margin-right:auto` — defined in `styles.css`. All 7 pages use it. Key insight: `margin:auto` centering doesn't work on grid items (`.main` itself), but does work on a normal block element inside a grid item — that's why `.main-inner` solves the ultra-wide problem where earlier attempts on `.layout` and `.main` failed.

### Chart architecture
- Type: line chart with `type: 'time'` x-axis (requires date-fns adapter)
- X-axis spans full election cycle, office-aware: House = 2yr, Senate = 6yr, President = 4yr
- Points only at actual filing dates (quarterly cadence = 4–8 points per cycle)
- Raised and Spent: `stepped: 'before'` (cumulative, stair-step between filing dates)
- Cash on Hand: linear connect (snapshot value, not cumulative)
- Overlay plugin draws vertical lines: grey dashed = filing deadlines, amber dotted = election dates, subtle = "today" (active cycles only)

### Key FEC API endpoints in use
```
GET /candidate/{id}/                          — candidate metadata
GET /candidate/{id}/totals/?cycle={year}      — cycle-level financial totals
GET /candidate/{id}/committees/               — associated committees (not cycle-scoped; returns all)
GET /committees/?sponsor_candidate_id={id}    — leadership PACs sponsored by this candidate (separate endpoint!)
GET /committee/{id}/                          — committee metadata (name, type, designation, status)
GET /committee/{id}/totals/?per_page=1        — committee financial summary (most recent filing)
GET /committee/{id}/reports/?cycle={year}     — per-period filing reports (chart data)
GET /reporting-dates/?report_year={year}&report_type={type} — filing deadlines (one call per type)
GET /election-dates/?election_state=&office_sought=&election_year= — actual election dates
GET /elections/?state=&cycle=&office=&district= — all candidates in a contest with financial summaries
GET /elections/search/?state=&office=&district=&per_page= — available election cycles for a race (returns {cycle, district, office, state})
GET /candidates/search/?q=&per_page=&sort=    — name-based candidate search
GET /candidates/?state=&office=&party=&election_year= — browse candidates by filter
GET /committees/?state=&committee_type=       — browse committees by filter
```

**Critical — `/elections/` office param:** This endpoint requires `office` as a **lowercase full word** (`house`, `senate`, `president`), NOT the single-letter code (`H`, `S`, `P`) used by other endpoints. Passing `H`/`S`/`P` returns a 422 error. Use a conversion function:
```javascript
function officeApiParam(o) {
  return { H:'house', S:'senate', P:'president' }[o] || o.toLowerCase();
}
```
Other endpoints (`/candidates/`, `/candidate/{id}/totals/`) use the single-letter codes — the inconsistency is an FEC API quirk.

**Critical — `/elections/` party field:** This endpoint does NOT return a `party` field. Party affiliation comes back as `party_full` with full names like `"DEMOCRATIC PARTY"` / `"REPUBLICAN PARTY"`. When building cards from `/elections/` data, read `c.party || c.party_full`. The `partyClass()`, `partyLabel()`, and `partyTooltip()` utilities in `utils.js` accept both short codes (`DEM`, `REP`) and full names (`DEMOCRATIC PARTY`, `REPUBLICAN PARTY`). Pass `party_full` as the second arg to `partyTooltip()` when available — it title-cases it for the tooltip (e.g. "Democratic Party").

**Critical — `/elections/` incumbent field:** This endpoint returns `incumbent_challenge_full` (e.g. `'Incumbent'`, `'Challenger'`, `'Open seat'`) — NOT the short-code `incumbent_challenge: 'I'/'C'/'O'` that appears on the `/candidate/{id}/` metadata endpoint. The field is populated at time of candidacy filing, so it's available for future cycles as soon as a candidate has declared. Check `c.incumbent_challenge === 'I' || c.incumbent_challenge_full === 'Incumbent'` to handle both shapes (mock uses short code; live API returns full string).

### Key FEC API field names (verified from live response)
Reports endpoint (`/committee/{id}/reports/`) returns per-filing objects with:
- `total_receipts_period` — raised this filing period only
- `total_disbursements_period` — spent this filing period only
- `total_receipts_ytd` — cumulative raised, resets Jan 1 each year
- `total_disbursements_ytd` — cumulative spent, resets Jan 1 each year
- `cash_on_hand_end_period` — COH snapshot at end of period
- `coverage_start_date` / `coverage_end_date` — in format `"2025-03-31T00:00:00"` (strip `T` and after)
- `report_form` — e.g. `"Form 3"` (use this to filter deadlines)
- **Amended filings:** When multiple reports exist for the same period, use only the most recent. Amendment-tracking fields (verified from live response, C00806174 "Marie for Congress"):
  - `most_recent` (boolean) — `true` = current authoritative version; `false` = superseded. **This is the correct dedup filter.** The API also accepts `?most_recent=true` as a query param to filter server-side.
  - `is_amended` (boolean) — `true` = this record has been superseded by a newer filing. Equivalent to `most_recent: false`.
  - `amendment_indicator` — `"N"` = originally filed as a new report; `"A"` = this record is itself an amendment filing
  - `amendment_indicator_full` — `"NEW"` or `"AMENDMENT"`
  - `amendment_chain` — array of `file_number` integers tracking the full amendment lineage
  - `most_recent_file_number` — float; the `file_number` of the current authoritative version
  - **`amendment_version` does NOT exist** — remove any logic relying on this field name; it is not present in API responses.

Reporting-dates endpoint (`/reporting-dates/`) returns:
- `report_type` — short code e.g. `"Q1"`, `"YE"`, `"12G"`, `"M6"`
- `report_type_full` — human label e.g. `"APRIL QUARTERLY"`, `"YEAR-END"`
- `due_date` — e.g. `"2027-01-31"` (no timestamp, safe to use directly)
- No `report_form` or `form_type` field exists on this endpoint
- **Critical:** `due_date_gte` / `due_date_lte` are silently ignored — API returns all 4,896 records across all time if used
- **Critical:** Correct filter is `report_year=<year>` (one value per call)
- **Critical:** Default sort is by creation date descending — always pass `sort=due_date`
- **Critical:** `per_page` max is 100; 2026 has 182 records so unfiltered fetch cuts off Q3 and YE
- **Critical:** `MY` (mid-year) appears in results but is a PAC type, not a Form 3 quarterly deadline — exclude it
- **Correct approach:** 4 parallel calls per cycle year, one each for Q1, Q2, Q3, YE — each returns exactly 1 record, sidestepping pagination and false positives entirely

Candidate totals endpoint returns:
- `receipts` — cycle total raised
- `disbursements` — cycle total spent
- `last_cash_on_hand_end_period` — most recent COH
- `coverage_end_date` — most recent coverage date

Committee totals endpoint (`/committee/{id}/totals/`) — amendment safety (verified from live response, C00806174 "Marie for Congress"):
- Returns one record **per cycle** — 4 records for a multi-cycle committee, not one record by design. `per_page=1` with no cycle filter returns the most recent cycle only.
- Has **no amendment fields** (`is_amended`, `most_recent`, `amendment_indicator` are absent). The endpoint returns pre-aggregated cycle totals, not raw filings — no dedup logic needed here.

Elections-search endpoint (`/elections/search/`) returns:
- `cycle` — integer, election cycle year (even number)
- `district` — string, e.g. `'03'` (House only)
- `office` — string, e.g. `'H'`, `'S'`, `'P'`
- `state` — string, e.g. `'WA'`
- **Critical:** Returns projected future cycles out to 2060+ — must cap client-side. House: cap at current cycle. Senate: cap at current cycle + 4 (covers both seats' next election).
- **Critical:** For Senate, returns cycles for *both* seats in the state (unioned). Deduplication required.
- **Critical:** No Senate class field exists anywhere in the FEC API (`/elections/`, `/elections/search/`). Senate seat class (I/II/III) must be derived heuristically from cycle year.

---

## What to build next

See `project-brief.md` for the full phased roadmap. Short version:

**Phase 1 (complete):** Candidate page — all tabs (Summary, Raised, Spent), committees modal, design system.

**Phase 2 (complete):** Search + navigation — search.html, candidates.html, committees.html, index redirect.

**Phase 3 (scaffold):** Committee and race pages.
- ~~committee.html~~ ✅ structural parity — tabs bar (Summary/Raised/Spent) + cycle switcher, cycle-aware stats (All time / per-cycle), overspend callout, title-cased name, relType-aware associated candidate section, .candidate-card-office removed, URL hash encoding (`#cycleOrAll#tab`), `Tab Switched` Amplitude event
- ~~committees.html~~ ✅ unified browse+search — auto-load, inline search + typeahead, state combo, filter chips, URL sync, error state, treasurer always shown
- ~~races.html~~ ✅ browse page — filter bar (Year/Office/State), results area, state combo, filter chips, all UI states; data fetching with progressive enrichment via /elections/; URL sync on all three filters
- ~~race.html~~ ✅ scaffold — single race view, candidate cards with financials, cycle-anchored links, dynamic cycle dropdown from `/elections/search/`, Senate class indicator, URL param validation
- committee.html: Raised tab ✅ live; Spent tab ✅ live (donut by category, purpose breakdown bars, top vendors table, contributions to candidates & committees section); filing history removed from scope — moved to backlog as a broader "candidate and committee filings" item pending validation with John

**Phase 4:** Early signal data (48/24hr reports), AI insights, transaction-level search.

## Remaining architectural debt

- **YTD per_page limit:** Reports currently fetched with `per_page=20` per sub-cycle — verify this is sufficient for Senate candidates with dense filing histories. Some cycles may have more than 20 reports.
- **Presidential cycle untested:** 4-year cycle is architecturally supported via `getCycleSpanYears()` / `getSubCycles()` but has not been tested with a real presidential candidate.
- **Multi-cycle stat labels:** Stats row (Raised, Spent, COH) doesn't yet indicate when figures represent a multi-sub-cycle sum (e.g. "6-year total" vs. "cycle total"). Needs a label or caveat for Senate candidates.
- **Spent tab timeline:** A spend-over-time line chart (parallel to the Raised tab's chart) has not been built. Lower priority — the category/purpose/vendor breakdown is sufficient for current use. Add when the Raised chart pattern is ready to be reused.
- **JFA committee gap:** Joint fundraising committees where a candidate is a participant (not the principal) have `candidate_ids: []` and `sponsor_candidate_ids: null` in the FEC API — they don't appear in either `/candidate/{id}/committees/` or `/committees/?sponsor_candidate_id=`. The only source of truth is the candidate's F2 filing document, which lists them as authorized committees. Surfacing these would require fetching the most recent F2 via `/filings/?candidate_id=&form_type=F2` and parsing committee references from the filing data. Not built yet; validate approach with John before implementing.
- **Presidential races use `state=US`:** The FEC API returns `state: 'US'` for presidential races in `/elections/search/`. `race.html`'s `VALID_STATES` array includes `'US'` to allow this. `formatRaceName` returns `'US President'` (no bullet, no state suffix) for `office === 'P'`.
- **Office cycle rhythms (race.html cycle cap):** Each office type has a distinct electoral rhythm that governs how far ahead the cycle dropdown should look. House: 2-year terms — cap at current cycle only. President: 4-year terms — cap at `currentCycle + 2` (next presidential election is always 0–2 years out from any given year). Senate: 6-year terms — cap at `currentCycle + 4` (covers both seats' next election in the state). These caps filter the projected-to-2060 results returned by `/elections/search/`. When adding any cycle-capping logic, treat all three office types explicitly — do not bucket President with House.
- **Senate class heuristic:** `getSenateClass()` in race.html derives class from cycle year via modular arithmetic. Special elections can seat a senator from a different class than the cycle implies. The FEC `/election-dates/` endpoint exposes SP/SG/SGR election types that could detect this, but financial data in `/elections/search/` has no special election flag — specials are folded into the standard 2-year cycle. Low priority: ~1-2 special Senate elections per decade.
- **Server-side API proxy for races.html (Phase 4):** The current solution (IntersectionObserver + localStorage cache) reduces the per-visit API call count from ~475 to ~15–20 and eliminates repeat-visitor calls within the 24h TTL. For high-traffic scenarios — election night, a viral link — this still won't be enough, because the FEC API key is embedded in client-side source and shared across all visitors. The permanent fix is a Netlify Function that proxies `/elections/` calls server-side: (1) the API key moves off the client entirely, (2) the function caches responses in Netlify Blob storage or in-memory, so all visitors share a single cold fetch per TTL period. The `/elections/search/` (race list) and `/elections/` (per-race enrichment) endpoints are the only ones that need proxying for races.html — financial data on candidate/committee pages is per-user and not worth proxying. Build this before any push for real traffic volume.
- **`/schedules/schedule_a/by_state/` silently ignores cycle params:** The `two_year_transaction_period` filter on this endpoint is silently ignored — the API returns the full contribution history regardless. Correct pattern: make one call with no cycle param, then filter client-side by `d.cycle` on each result record. Used by both candidate.html and committee.html choropleth maps.
- **`/schedules/schedule_b/` `entity_type` param silently ignored:** Passing `entity_type=CCM` to filter for political committee contributions is silently ignored by the live FEC API — the response returns all disbursement types regardless. Always add a client-side filter as belt-and-suspenders: `d.entity_type === 'CCM' || d.disbursement_purpose_category === 'CONTRIBUTIONS'`. Confirmed 2026-03-20.
- **`disbursement_purpose_category` field values (verified from live `/schedules/schedule_b/` response):** `'CONTRIBUTIONS'` (political contributions to other committees), `'REFUNDS'` (contribution refunds to donors — money returned, not a vendor payment), `'ADVERTISING'`, `'ADMINISTRATIVE'`, `'FUNDRAISING'`, `'TRAVEL'`, `'OTHER'`. Vendor table should exclude `CONTRIBUTIONS` and `REFUNDS`. Note: `disbursement_purpose_description` (the human-readable label field) is always null in live responses — use `disbursement_description` for keyword-based purpose mapping.
- **`.spend-note` CSS class — removed:** Was a dead class in candidate.html with no CSS definition. Replaced with `.data-note` (the shared equivalent, defined in `styles.css`). Removed 2026-03-20.
- **`/committee/{id}/totals/` spending field names (verified 2026-03-20):** The transfers field is `transfers_to_affiliated_committee` — NOT `transfers_to_other_authorized_committee` (which doesn't exist). PACs may have zero `operating_expenditures` with spending in `shared_nonfed_operating_expenditures`, `independent_expenditures`, or `fed_candidate_committee_contributions` instead. The committee.html spent donut computes "Other Disbursements" as `totalSpent - sum(named categories)` to ensure 100% coverage regardless of committee type.
- **Mock/live field shape gap risk:** Some FEC endpoints return different field names or value types than their mock counterparts — the `/elections/` endpoint returns `party_full` (full name) instead of `party` (short code); `/elections/` returns `incumbent_challenge_full` (full string) not `incumbent_challenge` (short code) — mock corrected 2026-03-16; `total_receipts_ytd` in reports is a string in the live API but was mocked as a number; `/schedule_a/by_state/` returns `{state, state_full, total, count}` while the individual `/schedule_a/` endpoint returns `{contributor_state, contribution_receipt_amount, ...}`; `/committee/{id}/totals/` uses `transfers_to_affiliated_committee` not `transfers_to_other_authorized_committee` — fixed 2026-03-20. Rule: when adding a new endpoint, fetch one live response and verify field names against the mock before writing assertions. Utilities should always accept both short and full-form values where the API may vary by endpoint.

## Committee modal architecture

The associated committees feature is a modal triggered from the profile header — not a tab, and not cycle-scoped. Key design decisions and API patterns:

- **Two parallel API calls at init:** `/candidate/{id}/committees/` (authorized committees) + `/committees/?sponsor_candidate_id={id}` (leadership PACs). Results merged, deduped by `committee_id`.
- **Leadership PAC identification:** `leadership_pac: true` boolean field on the committee record is the reliable signal. `committee_type === 'D'` is unreliable — some leadership PACs have `committee_type: 'N'`. Records from the sponsor endpoint are tagged `_isLeadershipPac = true` as a fallback.
- **Active vs. terminated split:** `filing_frequency === 'T'` = terminated; `filing_frequency === 'A'` = administratively terminated (FEC-initiated, committee has unresolved debts). Both route to the History tab. Active tab = everything else.
- **Committee grouping order:** Principal Committee → Joint Fundraising → Leadership PAC → Other Authorized → Other. Uses an `assigned` Set to prevent double-counting.
- **Eager loading:** `fetchAndRenderCommittees()` called in `init()` (not on modal open) so the count in the trigger label is immediate. `committeesLoaded` flag prevents double-fetch on modal re-open.
- **JFA gap acknowledged in modal:** A `.data-note` at the bottom of the modal explains that JFA committees where the candidate is a participant (not principal) may not appear — this is an FEC API indexing limitation, not a bug.
- **JFA organizer display gap (unresolved):** The "Joint Fundraising" group in `renderCommitteeGroups()` only renders when `committee_type === 'J'`. In practice, the FEC assigns many JFAs `committee_type: 'N'` (Non-Qualified PAC) or `'Q'` (Qualified PAC) even when the candidate is the organizer — confirmed via Nancy Pelosi's modal (NANCY PELOSI VICTORY FUND shows as "Other", not "Joint Fundraising"). The `designation` field may be a more reliable signal (`designation === 'J'`) but has not been verified against live data. Needs investigation before the "Joint Fundraising" group can be considered reliable.

Key committee fields:
- `designation` — `'P'` = Principal CC, `'A'` = Authorized, `'J'` = Joint Fundraising
- `committee_type` — `'J'` = JFA, `'D'` = Leadership PAC (unreliable for LP detection — use `leadership_pac` boolean)
- `filing_frequency` — `'T'` = terminated, `'A'` = administratively terminated (FEC-initiated), `'Q'` = quarterly (active)
- `leadership_pac` — boolean; most reliable leadership PAC signal
- `sponsor_candidate_ids` — array on committee record; leadership PACs carry the candidate's ID here

## Unified browse+search architecture (candidates.html / committees.html)

Both browse pages use a single unified state machine — no separate browse/search modes. Key patterns:

- **Auto-load on page visit** — `doFetch(false)` fires in `init()` regardless of URL params. No "click to browse" gate.
- **Unified `doFetch(isLoadMore)`** — single code path. Uses `activeQ` (string) and `activeFilters` (object) to build params. If `activeQ` is set, fires `Candidates/Committees Searched`; otherwise fires `Candidates/Committees Browsed`.
- **State vars:** `activeQ` (search query), `activeFilters` (state/office/party/cycle for candidates; state/type for committees), `currentPage`, `totalPages`, `loading`, `lastFetch` (fn ref for retry).
- **URL sync** — `updateURL()` calls `pushState` after every fetch. `init()` restores from URL params on load.
- **Filter chips** — `renderChips()` rebuilds chip row after every fetch. `clearFilter(key)` and `clearAllFilters()` reset state and re-fetch.
- **State combo** — text input filters a `size="6"` listbox; `:focus-within` shows/hides the listbox. On selection, `f-state` fires `change`, populates `f-state-filter`, and calls `doFetch`.
- **Typeahead** — 300ms debounced, 6 results. Results link directly to `/candidate/{id}` or `/committee/{id}` — clicking does NOT trigger a search, it navigates.
- **Search field submit** — sets `activeQ` and calls `doFetch(false)`. Enter key or button click.
- **All result links are clean URLs** — `/candidate/{id}` and `/committee/{id}` in all modes (browse and search).
- **Error state** — `#state-error` shown on API failure; `.retry-btn` calls `lastFetch()`.
- **`needsApiMock: true`** in `shared.spec.js` for both pages — they make API calls on load.

## Races browse architecture (races.html)

Progressive loading pattern — instant race list, then viewport-gated enrichment:

- **Step 1 (instant render):** `/elections/search/?cycle=X` returns the authoritative race list (`{cycle, district, office, state}` per result). Rendered immediately with skeleton placeholders for candidate count and total raised.
- **Step 2 (IntersectionObserver enrichment):** `raceObserver` fires `enrichRace()` only for race rows that scroll within 100px of the viewport. Each call fetches one `/elections/` response, writes `candidateCount` + `totalRaised` to the race object, and caches the processed aggregate to localStorage. On repeat visit within 24h, all previously-seen races load from cache with 0 API calls.
- **Why IntersectionObserver instead of fire-all:** Original architecture fired ~475 `/elections/` calls on every page load, exhausting the shared API key (1000 calls/hour). IO scopes enrichment to visible rows — typical filtered browsing session fires 10–35 calls instead. Aligned with the long-term page direction (editorial curation / location-based filtering will make the initial viewport small by design).
- **localStorage cache:** Key = `lf:race:{cycle}:{office}:{state}:{district}`. Value = `{ data: { candidateCount, totalRaised }, expires }`. TTL = 24h. Caches aggregates only (~50 bytes/race vs ~2KB for raw response). Silently skips caching on QuotaExceededError or private browsing.
- **Why not `/candidates/totals/`:** That endpoint includes anyone who *filed* for a cycle, not just candidates in the actual race. Counts and totals are inflated. `/elections/` is the gold standard — same source race.html uses.
- **Why per-race, not per-state:** `/elections/` requires both `office` and `state`, and House races additionally require `district`. The endpoint doesn't return a `district` field on results — district is implicit from the query params.
- **Client-side filtering:** Office and state filter changes call `applyFilters()` directly — no API re-fetch. `renderResults` disconnects and re-wires the observer after every re-render so filter changes correctly scope enrichment to the newly visible subset.
- **URL sync:** `updateURL()` calls `pushState` at the end of `applyFilters()`, covering all filter changes. `init()` reads `?cycle`, `?office`, `?state` from URL params and restores them before `populateCycles()` resolves — cycle is applied after the dropdown is populated (sequencing handled in `populateCycles(preferredCycle)`).
- **Stale response guard:** `fetchGeneration` counter increments on each `fetchAllRaces()` call. `enrichRace()` captures `gen` at call time and discards results if the generation has changed (cycle switch mid-flight).
- **`needsApiMock: true`** in `shared.spec.js` — makes API calls on load.
- **Long-term solution:** A Netlify Function proxy with server-side caching would move the API key off the client entirely and collapse all visitor traffic into one cold fetch per TTL period. See "Remaining architectural debt" for the full note.

## Navigation and IA architecture

The nav has a browse/profile split that must be preserved as new pages are added:

- **Browse pages** (`candidates.html`, `committees.html`, `races.html`) are primary nav destinations — each is its own nav item's active target
- **Profile pages** (`candidate.html`, `committee.html`, `race.html`) are subsections — they activate their *parent* browse page's nav item (e.g. `candidate.html` keeps "Candidates" active)
- **`ia.md`** is the canonical IA reference — page inventory, URL patterns, nav hierarchy, page relationships, phase roadmap. Read it before adding new pages or changing nav structure.

Nav link targets (all pages must use these — absolute paths, no stubs):
- Candidates → `/candidates`
- Committees → `/committees`
- Races → `/races`

Search, Process Log, and Design System are **not** in the top nav. No active link on those pages.

**Top nav structure (`.top-nav`):** Fixed below the global banner (`top:var(--banner-h)`), full-width, `z-index:200`. Inner: logo left → nav links (`Candidates`, `Committees`, `Races`) → search bar (desktop, `margin-left:auto`) → mobile controls (hidden at desktop: search toggle icon + hamburger). Mobile nav drawer (`.mobile-nav`) drops down from below the nav bar (not from the side). Search toggle expands `.top-nav-mobile-search` panel inline below the nav bar. No `.sidebar`, no `.layout` grid wrapper — `.main` is a direct child of `<body>`.

**Active state:** `.nav-link.active` on the correct `<a>` in `.top-nav-links`, plus `.nav-item` with active class in `.mobile-nav` for browse pages. Profile pages activate their parent browse page's link.

**`.main` padding:** Global rule `padding-top:var(--header-h)` in `styles.css` handles the fixed nav offset. No per-page media query override needed.

Cycle-anchored links from race view: `candidate.html?id={id}#{year}#summary` — the `#{year}#summary` hash pre-selects the correct election cycle on the candidate page. Use this pattern whenever linking to a candidate from a race context.

## Senate multi-sub-cycle architecture

Senate 6-year cycles introduce a multi-sub-cycle pattern worth understanding before modifying:

- `getSubCycles(cycle)` returns `[cycle-4, cycle-2, cycle]` — three FEC 2-year periods
- Reports are fetched from all three in parallel and combined
- **Raised / Spent totals:** summed across all sub-cycles
- **COH and debt:** use most recent sub-cycle only
- **YTD stitching:** carries cumulative base forward across each calendar year reset within each sub-cycle, then chains sub-cycles together

---

## Product decisions already made (don't re-litigate)

- **Stepped line chart** (not smooth) for Raised and Spent — honest to the quarterly reporting rhythm
- **Full cycle x-axis** — even for active cycles where future quarters are empty; shows where we are in the cycle
- **"Raised-to-spent ratio"** — not "burn rate" (domain expert feedback from John, a congressional campaign manager)
- **Health indicator hidden for closed cycles** — replaced with "Cycle Complete" contextual summary
- **Points only at filing dates** — no interpolation between quarters
- **YTD field strategy** — use `_ytd` fields from reports and carry year-1 total as base for year-2 (avoids per-period accumulation errors)
- **Election dates from `/election-dates/`** — not `/elections/` (which returns candidate financial summaries, not actual dates)
- **Mobile nav search icon** — at smaller breakpoints, search does not collapse into the hamburger drawer. A search icon remains exposed left of the menu icon at all times.
- **Global nav links** — Home, Candidates, Committees, Races present from launch as stubs; activated as pages are built per phase plan.
- **Race page** — single contest view; all declared candidates auto-populated from `/elections/`. The comparison builder (selecting candidates across races) is a separate Phase 4 feature, not a mode of the race page.

---

## Domain context

- FEC "cycle" ends Dec 31 of the election year, not on election day
- House candidates file Form 3, quarterly + pre/post election reports
- Senate = 6-year terms; presidential = 4-year. X-axis logic must account for this
- `_ytd` fields reset each January 1, so a two-year cycle requires stitching year 1 final YTD + year 2 running YTD
- Memoed transactions must be excluded from any manual totals (we avoid this by using FEC-computed `_ytd` fields)
- The FEC API silently ignores unrecognized query parameters — always verify a filter is working by checking total result counts, not just response shape
- The FEC `/reporting-dates/` endpoint ignores date range params; use `report_year` + `report_type` for targeted queries
- John (domain expert, congressional campaign manager) is available for validation questions

---

## Design reference

The process log (`process-log.html`) has the full project history including domain research notes, John's feedback, and all key decisions with rationale. Read it for context on *why* things are the way they are.

The full product brief (`project-brief.md`) has MVP scope, audience definition, backlog, open questions, and definitions.

---

## How to start a session

```bash
cd ~/Vibecoding/fec-project && claude
```

**Session-start ritual check:** Read CLAUDE.md, project-brief.md, ia.md, and claude-to-claude.md. (1) Check whether the most recent entry in `claude-to-claude.md` matches the last commit — if the log entry is missing and work was clearly done, flag it. (2) Run `git status` — if there are uncommitted changes, flag them before starting new work.

**Opening prompt:**
```
Read CLAUDE.md, project-brief.md, ia.md, and claude-to-claude.md, then: (1) check whether the last session's end-of-session rituals were completed — if not, flag it. (2) Summarize the current state of the project, the top priority, and what you need from me to get started.
```

---

## When compacting or ending a session

**Before wrapping up:** Run `npx playwright test` (Track 1 — structural, mocked API, ~1 min). Fix any new failures before shipping. Then run the manual browser checks from `test-cases.md` for every page touched this session. Append a row to the Test log table at the bottom of `test-cases.md`. If any new failures are found, add them to the Known open issues table. If new features shipped, write Playwright assertions for them in the same session — not just manual checklist items in `test-cases.md`. The bar: any new DOM element, conditional render, or API behavior change must have at least one `.spec.js` assertion covering it.

**Documentation updates (always apply before outputting the four blocks below):** After tests pass, audit and apply any needed updates to these four files — do not wait to be asked:
- `CLAUDE.md` — update Current files list, What to build next checklist, and any API/architecture notes learned this session
- `test-cases.md` — add manual test cases for new features; update test count if changed; append test log row
- `TESTING.md` — update test count; update the pages.spec.js coverage description if new describe blocks were added
- `ia.md` — update Page Inventory status, URL Patterns table, Browse→Profile link patterns, or Phase Roadmap if any pages changed behavior or were promoted
- `design-system.html` — add new tokens to the token table (with primitive source and usage note); update or add component cards for any new or changed components; remove entries for anything deleted
- `project-brief.md` — add or update definitions for any new domain concepts, data fields, status values, or product decisions introduced this session

Before running /compact or ending a session, output all four of the following — each in its own fenced code block so they're easy to copy individually. Sloane will bring these to Claude Chat.

---

### 1. Process log draft
A draft entry for process-log.html covering:
- A title in the voice of existing entries (e.g. "Debugging in the dark, then the lights came on")
- A 2–3 sentence summary written from Sloane's perspective — not a technical changelog
- Changelog bullets: what changed, in plain language
- A field notes block: a journal-style reflection on what the session revealed — about the product, the process, or the tools
- Stack tags for anything new introduced this session

---

### 2. How Sloane steered the work
A summary of the key moments where Sloane shaped direction this session — product instincts, UX calls, decisions to push back or redirect, priorities set. Written for Sloane, not as a changelog. Focus on judgment and intent, not implementation.

Format: one named heading per moment (e.g. "Modal over tab — your call, for scale reasons"), followed by 2–3 sentences on what happened and why it mattered. Close with a 1–2 sentence through-line identifying the pattern across all the moments (e.g. "The through-line: you're making UX calls based on user psychology..."). No limit on number of moments — include everything that was genuinely Sloane's judgment call, not Claude's default.

---

### 3. Proposed CLAUDE.md updates
A list of specific, actionable updates to make to CLAUDE.md based on what was learned or built this session — new API findings, resolved debt items, architectural decisions, workflow notes. Format as: section name + what to change. Do not rewrite the file — just propose the changes.

---

### 4. What to bring to Claude Chat
A short list of topics, decisions, or open questions that are better discussed in Claude Chat than resolved in Claude Code — product direction, prioritization, design decisions, domain questions for John, anything requiring strategic thinking before building. 2–5 bullets.

---

### Logging to claude-to-claude.md
After outputting all four blocks above, append outputs #1, #2, and #4 to `claude-to-claude.md` in the project root. Use this format:

```
---
[DATE] [TIME]

## Process log draft
[content]

## How Sloane steered the work
[content]

## What to bring to Claude Chat
[content]
```

If the file doesn't exist, create it. Always append — never overwrite.

**Final step — commit:** After appending to `claude-to-claude.md`, commit all session changes with `git add` (specific files, not `-A`) and a descriptive commit message. Uncommitted changes at session end are invisible to the next session's start check and will appear as mysterious working tree noise. If the session produced no code changes (discussion-only), a commit is not needed — but documentation-only changes still warrant one.
