# Claude Code Brief — ledger.fec
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
**Analytics:** Amplitude
- Integrated on the original FRED proof-of-concept index page; may not be present on all current pages — audit before assuming
- Pageview tracking is the baseline expectation on every page
- Meaningful interactions worth tracking: tab switches on the candidate page, committee modal opens, build log / reflections toggle on process log, search queries and result clicks (once search is built)
- Do not add a second Amplitude instance to pages that already have it — check first

---

## Tech stack

- Vanilla HTML/CSS/JS — no framework, intentional for this stage
- Chart.js 4.4.0 + chartjs-adapter-date-fns 3.0.0 (time scale support)
- Google Fonts: Barlow Condensed (display/headings) + DM Sans (body/nav) + IBM Plex Mono (labels/data)
- FEC public API: `https://api.open.fec.gov/v1`
- Netlify Functions for any server-side API proxying needed
- No build step — files are served directly
- **Clean URLs:** `_redirects` defines Netlify 200 rewrites for all pages. Profile pages with path-segment URLs (`/candidate/:id`, `/committee/:id`) **must use absolute paths** for every local resource and nav link — `href="/styles.css"`, `src="/main.js"`, `href="/candidates"`, etc. Relative paths break because the browser treats the path segment as a subdirectory (e.g. from `/candidate/H2WA03217`, relative `utils.js` resolves to `/candidate/utils.js`, which also matches the rewrite rule and returns HTML served as JS). Browse pages (`/candidates`, `/committees`, `/races`, `/race`, `/search`) use single-level paths so relative links still resolve to root — but any new page with a deeper path must follow the absolute-path rule.
- **Testing:** Playwright (`@playwright/test`) — `npx playwright test` runs 170 structural tests (mocked API); `npm run test:smoke` runs 5 live-API smoke tests. See `TESTING.md`.

---

## Design system

**Reference file:** `design-system.html` is the living design system reference. Read it (or at minimum the token table and component list) before building any new page or component.

**Shared files:** `styles.css` contains the CSS reset, token `:root`, shared layout (sidebar, mobile nav, header), utility classes, and all shared component CSS. `main.js` contains Amplitude init + Session Replay, mobile scroll-aware header, and hamburger nav (all null-guarded). `utils.js` contains shared JS utilities: `BASE`, `API_KEY`, `apiFetch`, `fmt`, `fmtDate`, `toTitleCase`, `partyClass`, `partyLabel`, `committeeTypeLabel`. Every page links all three (main.js → utils.js → inline script block).

**CSS consolidation principle:** Component CSS lives in `styles.css`. Inline `<style>` blocks in individual pages are for page-specific overrides only (layout grid, page-specific spacing, page-specific components). `design-system.html` imports the same `styles.css` as production — no component CSS is duplicated between pages.

**Chart colors:** `--chart-*` CSS vars in `styles.css :root` are the canonical chart palette. JS chart configs reference the `CHART_COLORS` constant at the top of `candidate.html`'s `<script>` block (same rgba values). HTML legend swatches use the CSS vars directly (`style="background:var(--chart-raised)"`). Add new chart color vars to `styles.css :root` and `CHART_COLORS` before using hardcoded rgba in chart configs.

### Token naming tiers

- **Tier 1 — Primitives:** Raw hex values. Not CSS vars. Documented in `design-system.html` only. Do not use directly in components.
- **Tier 2 — Semantic tokens:** CSS vars in `styles.css :root`. Named by meaning, not appearance (`--bg`, `--surface`, `--dem`, `--green`). New tokens always go here first. Add to `styles.css :root` and document in `design-system.html`.
- **Tier 3 — Component tokens:** Not yet built. Would be things like `--tag-dem-bg`. Document as `planned` in `design-system.html` before building.

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
--bg: #ede8e0        (page background)
--surface: #f7f4ef   (cards, panels)
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
--amber: #8a5f10     (watch / warning)
--red: #a83228       (stressed)
--accent: #2c5282    (interactive accent, active indicators)
--accent-dim: rgba(44,82,130,0.1)  (accent tint)

Sidebar-scoped tokens (avoid using outside sidebar):
--sidebar-bg: #e8e2d8
--sidebar-border: #cdc7bc
--sidebar-text: #1a1510
--sidebar-muted: #625b52
--sidebar-active-bg: #d4cdc3
```

Typography: Barlow Condensed 700–900 for display/headings (uppercase), DM Sans 300–500 for body/nav, IBM Plex Mono 400–500 for labels and data.

---

## Current files

```
index.html        — Root redirect → search.html (entry point)
search.html       — Candidate name search (live)
candidates.html   — Browse candidates by state/office/party/cycle (scaffold)
candidate.html    — Single candidate profile (live, primary active file)
committees.html   — Browse committees by type/state (scaffold)
committee.html    — Single committee profile (scaffold)
races.html        — Race mode selector — curated form + ad hoc stub (scaffold)
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
- Profile header with initials avatar, party tag, office/district tag, incumbency tag
- Cycle switcher (buttons to toggle between cycles, re-fetches data)
- URL anchor encodes cycle + tab: `candidate.html#2024#summary`
- Tab navigation: Summary, Raised, Spent
- Stats row: Total Raised, Total Spent, Cash on Hand, Raised-to-Spent Ratio
- Cycle-aware banner: health signal (green/amber/red) for active cycles; "Cycle Complete" summary for closed cycles
- Associated committees modal: "Committees (N) →" trigger in profile header opens a modal with Active and History tabs; committees fetched eagerly at init so count is immediate
- Responsive layout: desktop sidebar nav, mobile scroll-aware header + hamburger drawer
- Smooth fade-in animations on load

### What's broken / in progress
1. **Chart data showing $0** — ✅ Fixed. Using `total_receipts_ytd` / `total_disbursements_ytd` with year-boundary accumulation.

2. **Election date markers** — ✅ Mostly working. Current cycle shows primary only (general not yet scheduled in FEC system — expected behavior). Past cycles show both. Field name confirmed: `election_date`.

3. **Filing deadline markers** — ✅ Fixed and verified live. `due_date_gte`/`due_date_lte` are silently ignored by the API — returns all 4,896 records if used. Fix: 4 parallel calls per cycle year, one each for Q1, Q2, Q3, YE using `report_year` + `report_type`. Each returns exactly 1 record.

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

### Key FEC API field names (verified from live response)
Reports endpoint (`/committee/{id}/reports/`) returns per-filing objects with:
- `total_receipts_period` — raised this filing period only
- `total_disbursements_period` — spent this filing period only
- `total_receipts_ytd` — cumulative raised, resets Jan 1 each year
- `total_disbursements_ytd` — cumulative spent, resets Jan 1 each year
- `cash_on_hand_end_period` — COH snapshot at end of period
- `coverage_start_date` / `coverage_end_date` — in format `"2025-03-31T00:00:00"` (strip `T` and after)
- `report_form` — e.g. `"Form 3"` (use this to filter deadlines)

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

---

## What to build next

See `project-brief.md` for the full phased roadmap. Short version:

**Phase 1 (complete):** Candidate page.
- ~~Raised tab~~ ✅ live
- ~~Associated committees~~ ✅ live — header modal with active/history tabs, leadership PAC support, JFA gap note
- ~~Design system documentation page~~ ✅ live
- **Spent tab** (category breakdown, spend timeline) — still pending, lower priority now that nav/browse is built

**Phase 2 (complete):** Search and navigation.
- ~~search.html~~ ✅ live — name search, result cards, Amplitude events
- ~~candidates.html~~ ✅ scaffold — browse by state/office/party/cycle
- ~~index.html~~ ✅ live — redirect to search.html

**Phase 3 (scaffold):** Committee and race pages.
- ~~committee.html~~ ✅ scaffold — header with financials, back-link to candidate
- ~~committees.html~~ ✅ scaffold — browse by state/type
- ~~races.html~~ ✅ scaffold — mode selector (curated form live; ad hoc stub)
- ~~race.html~~ ✅ scaffold — single race view, candidate cards with financials, cycle-anchored links
- Remaining: filing history on committee.html, associated candidates on committee.html, ad hoc mode on races.html

**Phase 4:** Early signal data (48/24hr reports), AI insights, transaction-level search.

## Remaining architectural debt

- **YTD per_page limit:** Reports currently fetched with `per_page=20` per sub-cycle — verify this is sufficient for Senate candidates with dense filing histories. Some cycles may have more than 20 reports.
- **Presidential cycle untested:** 4-year cycle is architecturally supported via `getCycleSpanYears()` / `getSubCycles()` but has not been tested with a real presidential candidate.
- **Multi-cycle stat labels:** Stats row (Raised, Spent, COH) doesn't yet indicate when figures represent a multi-sub-cycle sum (e.g. "6-year total" vs. "cycle total"). Needs a label or caveat for Senate candidates.
- **JFA committee gap:** Joint fundraising committees where a candidate is a participant (not the principal) have `candidate_ids: []` and `sponsor_candidate_ids: null` in the FEC API — they don't appear in either `/candidate/{id}/committees/` or `/committees/?sponsor_candidate_id=`. The only source of truth is the candidate's F2 filing document, which lists them as authorized committees. Surfacing these would require fetching the most recent F2 via `/filings/?candidate_id=&form_type=F2` and parsing committee references from the filing data. Not built yet; validate approach with John before implementing.
- ~~**utils.js duplication:**~~ ✅ Resolved. Shared utilities extracted to `utils.js` — `BASE`, `API_KEY`, `apiFetch`, `fmt`, `fmtDate`, `toTitleCase`, `partyClass`, `partyLabel`, `committeeTypeLabel`. All pages load it between `main.js` and their own script block.

## Committee modal architecture

The associated committees feature is a modal triggered from the profile header — not a tab, and not cycle-scoped. Key design decisions and API patterns:

- **Two parallel API calls at init:** `/candidate/{id}/committees/` (authorized committees) + `/committees/?sponsor_candidate_id={id}` (leadership PACs). Results merged, deduped by `committee_id`.
- **Leadership PAC identification:** `leadership_pac: true` boolean field on the committee record is the reliable signal. `committee_type === 'D'` is unreliable — some leadership PACs have `committee_type: 'N'`. Records from the sponsor endpoint are tagged `_isLeadershipPac = true` as a fallback.
- **Active vs. terminated split:** `filing_frequency === 'T'` = terminated. Active committees go in the Active tab; terminated in History tab (hidden if empty).
- **Committee grouping order:** Principal Committee → Joint Fundraising → Leadership PAC → Other Authorized → Other. Uses an `assigned` Set to prevent double-counting.
- **Eager loading:** `fetchAndRenderCommittees()` called in `init()` (not on modal open) so the count in the trigger label is immediate. `committeesLoaded` flag prevents double-fetch on modal re-open.
- **JFA gap acknowledged in modal:** A `.data-note` at the bottom of the modal explains that JFA committees where the candidate is a participant (not principal) may not appear — this is an FEC API indexing limitation, not a bug.

Key committee fields:
- `designation` — `'P'` = Principal CC, `'A'` = Authorized, `'J'` = Joint Fundraising
- `committee_type` — `'J'` = JFA, `'D'` = Leadership PAC (unreliable for LP detection — use `leadership_pac` boolean)
- `filing_frequency` — `'T'` = terminated, `'Q'` = quarterly (active)
- `leadership_pac` — boolean; most reliable leadership PAC signal
- `sponsor_candidate_ids` — array on committee record; leadership PACs carry the candidate's ID here

## Navigation and IA architecture

The nav has a browse/profile split that must be preserved as new pages are added:

- **Browse pages** (`candidates.html`, `committees.html`, `races.html`) are primary nav destinations — each is its own nav item's active target
- **Profile pages** (`candidate.html`, `committee.html`, `race.html`) are subsections — they activate their *parent* browse page's nav item (e.g. `candidate.html` keeps "Candidates" active)
- **`ia.md`** is the canonical IA reference — page inventory, URL patterns, nav hierarchy, page relationships, phase roadmap. Read it before adding new pages or changing nav structure.

Nav link targets (all pages must use these — no stubs):
- Candidates → `candidates.html`
- Committees → `committees.html`
- Races → `races.html`
- Search → `search.html`

The `.mobile-search-icon` (search icon SVG in `.mobile-header`) must appear on every page. It links to `search.html` and is `display:none` at desktop, `display:block` at ≤860px via `styles.css`.

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
- **Race page = compare feature** — two modes, one shared UI. Curated mode: a specific contest auto-populates all declared candidates. Ad hoc mode: user selects any candidates across races (designed for consultants tracking multiple frontline races). No editorial curation required.

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

## What "done" looks like for the candidate page

- [x] Chart renders real data (not $0)
- [x] Stepped lines visible between quarterly filing points
- [x] Full cycle x-axis with future quarters shown as empty space — office-aware (H=2yr, S=6yr, P=4yr)
- [x] Filing deadline markers: Form 3 quarterly only, correctly positioned, verified live
- [x] Election date markers: primary + general, amber dotted lines (current cycle: primary only — general not yet in FEC system)
- [x] Health banner: active vs. closed cycle logic working
- [x] All hardcoded candidate values derived from API response (state, district, office, cycle list from `election_years`)
- [x] Page works for any candidate ID passed as a URL param (`?id=H2WA03217`) — verified with MGP (House) and Gillibrand (Senate)
- [x] Responsive: mobile header, hamburger nav, chart doesn't overflow viewport
- [x] Search / homepage — search.html live, index.html redirects
- [x] Raised tab: contributor breakdown, geography heatmap, top committee contributors — live and verified
- [x] Spent tab: category breakdown, purpose breakdown, top vendors — live
- [x] Associated committees: header modal with Active/History tabs, leadership PAC via sponsor endpoint, JFA gap note

---

## Design reference

The process log (`process-log.html`) has the full project history including domain research notes, John's feedback, and all key decisions with rationale. Read it for context on *why* things are the way they are.

The full product brief (`project-brief.md`) has MVP scope, audience definition, backlog, open questions, and definitions.

---

## How to start a session

```bash
cd ~/Vibecoding/fec-project && claude
```

Read this file and `claude-to-claude.md` first. Check whether the most recent entry in `claude-to-claude.md` is from the last session — if the log is missing an entry and work was clearly done, flag it before proceeding.

Then ask Sloane what the current priority is. Don't assume the latest file in the repo matches what's been deployed.

**Opening prompt:**
```
Read CLAUDE.md, project-brief.md, and claude-to-claude.md, then: (1) check whether the last session's end-of-session rituals were completed — if not, flag it. (2) Summarize the current state of the project, the top priority, and what you need from me to get started.
```

**Session-start ritual check:** After reading CLAUDE.md and claude-to-claude.md, check whether the most recent entry in claude-to-claude.md is dated today or earlier. If the last session's entry is missing (i.e., today's date isn't in the log and work was clearly done), flag it: "It looks like the previous session wasn't wrapped up — no log entry found. Do you have screenshots or notes I can use to reconstruct it, or should we skip and move on?" Do not silently proceed without noting the gap.

**Suggested opening prompt for Sloane to paste at session start:**
```
Read CLAUDE.md, project-brief.md, and claude-to-claude.md, then: (1) check whether the last session's end-of-session rituals were completed — if not, flag it. (2) Summarize the current state of the project, the top priority, and what you need from me to get started.
```

---

## When compacting or ending a session

**Before wrapping up:** Run `npx playwright test` (Track 1 — structural, mocked API, ~1 min). Fix any new failures before shipping. Then run the manual browser checks from `test-cases.md` for every page touched this session. Append a row to the Test log table at the bottom of `test-cases.md`. If any new failures are found, add them to the Known open issues table. If new features shipped, add both automated and manual test cases for them in the same session they shipped.

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
