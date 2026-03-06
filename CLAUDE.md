# Claude Code Brief — ledger.fec
*Hand this to Claude Code at the start of each session.*

---

## What this is

A web-based campaign finance visualization tool built on the FEC public API. The goal: give political strategists, journalists, and researchers a faster, clearer window into where money is flowing in a race than the FEC website provides.

This is also a portfolio piece for a staff-level product designer (Sloane). It needs to look and feel like a designer built it — not a developer prototype.

**Live URL:** sloanestradley.netlify.app  
**Repo:** GitHub (ask Sloane for the repo URL if you don't have it)  
**Deployment:** Netlify, auto-deploys on push to main  
**Analytics:** Amplitude
- Integrated on the original FRED proof-of-concept index page; may not be present on all current pages — audit before assuming
- Pageview tracking is the baseline expectation on every page
- Meaningful interactions worth tracking: tab switches on the candidate page, committee modal opens, build log / reflections toggle on process log, search queries and result clicks (once search is built)
- Do not add a second Amplitude instance to pages that already have it — check first

---

## Tech stack

- Vanilla HTML/CSS/JS — no framework, intentional for this stage
- Chart.js 4.4.0 + chartjs-adapter-date-fns 3.0.0 (time scale support)
- Google Fonts: Syne (headings) + IBM Plex Mono (body/data)
- FEC public API: `https://api.open.fec.gov/v1`
- Netlify Functions for any server-side API proxying needed
- No build step — files are served directly

---

## Design system

**Reference file:** `design-system.html` is the living design system reference. Read it (or at minimum the token table and component list) before building any new page or component.

**Shared files:** `styles.css` contains the CSS reset, token `:root`, shared layout (sidebar, mobile nav, header), utility classes, and all shared component CSS. `main.js` contains Amplitude init + Session Replay, mobile scroll-aware header, and hamburger nav (all null-guarded). Every page links both.

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

Dark theme. Key CSS variables:

```
--bg: #0d0f12        (page background)
--surface: #141720   (cards, sidebar)
--surface2: #1c2030  (hover states)
--border: #252a38
--text: #e8eaf0
--muted: #5a6070
--subtle: #8890a0
--dem: #4a90d9       (Democrat)
--rep: #d94a4a       (Republican)
--green: #3dbf7a     (healthy)
--amber: #e8a020     (watch / warning)
--red: #d94a4a       (stressed)
```

Typography: Syne 800 for display/headings, IBM Plex Mono 300–500 for everything else.

---

## Current files

```
candidate.html    — Candidate profile page (primary active file)
process-log.html  — Living case study / dev diary
project-brief.md  — Full product vision and open questions
```

A homepage (`index.html`) doesn't exist yet — candidate.html is the entry point for now.

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
GET /committee/{id}/reports/?cycle={year}     — per-period filing reports (chart data)
GET /reporting-dates/?report_year={year}&report_type={type} — filing deadlines (one call per type)
GET /election-dates/?election_state=&office_sought=&election_year= — actual election dates
```

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

**Phase 1 (current):** Finish the candidate page before building anything new.
- ~~Raised tab~~ ✅ live
- **Spent tab** (category breakdown, spend timeline) — current priority
- ~~Associated committees~~ ✅ live — header modal with active/history tabs, leadership PAC support, JFA gap note
- Data freshness indicators on all data displays
- Empty and error states
- Design system documentation page
- Mobile chart pass

**Phase 2:** Search and navigation.
**Phase 3:** Committee page, race page (which is also the compare feature — two modes, one UI).
**Phase 4:** Early signal data (48/24hr reports), AI insights.

## Remaining architectural debt

- **YTD per_page limit:** Reports currently fetched with `per_page=20` per sub-cycle — verify this is sufficient for Senate candidates with dense filing histories. Some cycles may have more than 20 reports.
- **Presidential cycle untested:** 4-year cycle is architecturally supported via `getCycleSpanYears()` / `getSubCycles()` but has not been tested with a real presidential candidate.
- **Multi-cycle stat labels:** Stats row (Raised, Spent, COH) doesn't yet indicate when figures represent a multi-sub-cycle sum (e.g. "6-year total" vs. "cycle total"). Needs a label or caveat for Senate candidates.
- **JFA committee gap:** Joint fundraising committees where a candidate is a participant (not the principal) have `candidate_ids: []` and `sponsor_candidate_ids: null` in the FEC API — they don't appear in either `/candidate/{id}/committees/` or `/committees/?sponsor_candidate_id=`. The only source of truth is the candidate's F2 filing document, which lists them as authorized committees. Surfacing these would require fetching the most recent F2 via `/filings/?candidate_id=&form_type=F2` and parsing committee references from the filing data. Not built yet; validate approach with John before implementing.

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
- [ ] Search / homepage
- [x] Raised tab: contributor breakdown, geography heatmap, top committee contributors — live and verified
- [ ] Spent tab: category breakdown, spend timeline — next priority
- [x] Associated committees: header modal with Active/History tabs, leadership PAC via sponsor endpoint, JFA gap note

---

## Design reference

The process log (`process-log.html`) has the full project history including domain research notes, John's feedback, and all key decisions with rationale. Read it for context on *why* things are the way they are.

The full product brief (`project-brief.md`) has MVP scope, audience definition, backlog, open questions, and definitions.

---

## How to start a session

```bash
cd ~/Vibecoding/fred-project
claude
```

First thing: read this file. Then read `candidate.html` for current implementation state.

Before diving in, note what's been updated since the last session:
- `CLAUDE.md` — updated with verified API behavior, remaining debt items, Senate architecture notes
- `project-brief.md` — significantly expanded: now includes a phased roadmap, global nav spec (including mobile search icon behavior), race page / compare architecture, and new open questions on associated committees and unserious candidates
- `process-log.html` — updated with Mar 3 session entry and a new Mar 4 entry stub

Ask Sloane what's been tested since the last session and what the current priority is. Don't assume the latest file in the repo matches what's been deployed — ask.

**Session-start ritual check:** After reading CLAUDE.md and claude-to-claude.md, check whether the most recent entry in claude-to-claude.md is dated today or earlier. If the last session's entry is missing (i.e., today's date isn't in the log and work was clearly done), flag it: "It looks like the previous session wasn't wrapped up — no log entry found. Do you have screenshots or notes I can use to reconstruct it, or should we skip and move on?" Do not silently proceed without noting the gap.

**Suggested opening prompt for Sloane to paste at session start:**
```
Read CLAUDE.md, project-brief.md, and claude-to-claude.md, then: (1) check whether the last session's end-of-session rituals were completed — if not, flag it. (2) Summarize the current state of the project, the top priority, and what you need from me to get started.
```

---

## When compacting or ending a session

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
