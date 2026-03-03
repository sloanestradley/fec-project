# Claude Code Brief — ledger.fec
*Hand this to Claude Code at the start of each session.*

---

## What this is

A web-based campaign finance visualization tool built on the FEC public API. The goal: give political strategists, journalists, and researchers a faster, clearer window into where money is flowing in a race than the FEC website provides.

This is also a portfolio piece for a staff-level product designer (Sloane). It needs to look and feel like a designer built it — not a developer prototype.

**Live URL:** sloanestradley.netlify.app  
**Repo:** GitHub (ask Sloane for the repo URL if you don't have it)  
**Deployment:** Netlify, auto-deploys on push to main  
**Analytics:** Amplitude (already integrated)

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

Dark theme. Key CSS variables (defined in `:root` on every page):

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

The candidate page (`candidate.html`) is the main work in progress. It is hardcoded to one candidate while the architecture is being proven out:

- **Candidate:** Marie Gluesenkamp Perez
- **Candidate ID:** `H2WA03217`
- **State:** WA, **District:** 03, **Office:** House
- **Cycles shown:** 2022, 2024, 2026

### What's working
- Profile header with initials avatar, party tag, office/district tag, incumbency tag
- Cycle switcher (buttons to toggle between cycles, re-fetches data)
- URL anchor encodes cycle + tab: `candidate.html#2024#summary`
- Tab navigation: Summary, Raised, Spent, Committees
- Stats row: Total Raised, Total Spent, Cash on Hand, Raised-to-Spent Ratio
- Cycle-aware banner: health signal (green/amber/red) for active cycles; "Cycle Complete" summary for closed cycles
- Committees tab: lists associated committees with type labels
- Responsive layout: desktop sidebar nav, mobile scroll-aware header + hamburger drawer
- Smooth fade-in animations on load

### What's broken / in progress
1. **Chart data showing $0** — ✅ Fixed. Using `total_receipts_ytd` / `total_disbursements_ytd` with year-boundary accumulation.

2. **Election date markers** — ✅ Mostly working. Current cycle shows primary only (general not yet scheduled in FEC system — expected behavior). Past cycles show both. Field name confirmed: `election_date`.

3. **Filing deadline markers** — ✅ Fixed. `/reporting-dates/` has no `report_form` field — filter by excluding presidential monthly report types (M1–M12, MSA, MYS, CA, SA) instead. Has not been verified live yet — confirm on next deploy.

### Chart architecture
- Type: line chart with `type: 'time'` x-axis (requires date-fns adapter)
- X-axis spans full FEC two-year cycle: Jan 1 of prior odd year → Dec 31 of cycle year
- Points only at actual filing dates (quarterly cadence = 4–8 points per cycle)
- Raised and Spent: `stepped: 'before'` (cumulative, stair-step between filing dates)
- Cash on Hand: linear connect (snapshot value, not cumulative)
- Overlay plugin draws vertical lines: grey dashed = filing deadlines, amber dotted = election dates, subtle = "today" (active cycles only)

### Key FEC API endpoints in use
```
GET /candidate/{id}/                          — candidate metadata
GET /candidate/{id}/totals/?cycle={year}      — cycle-level financial totals
GET /candidate/{id}/committees/?cycle={year}  — associated committees
GET /committee/{id}/reports/?cycle={year}     — per-period filing reports (chart data)
GET /reporting-dates/?due_date_gte=&..._lte=  — filing deadlines
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
- Filter by excluding monthly presidential types: M1–M12, MSA, MYS, CA, SA

Candidate totals endpoint returns:
- `receipts` — cycle total raised
- `disbursements` — cycle total spent
- `last_cash_on_hand_end_period` — most recent COH
- `coverage_end_date` — most recent coverage date

---

## Known architectural debt to address

1. **Everything is hardcoded to MGP.** The candidate ID, state, district, office, and cycle list are all hardcoded constants. The page needs to derive these from the candidate API response so it works for any candidate. Specifically:
   - Cycle list should come from the candidate's `election_years` array
   - X-axis span should be derived from office type (House = 2yr, Senate = 6yr, President = 4yr)
   - Form type filter for deadlines should come from committee's `report_form`
   - State/district for election date lookup should come from candidate data

2. **No homepage / search yet.** The entry point is candidate.html with a hardcoded ID. Search is the next major feature after the candidate page is solid.

3. **Raised/Spent/Committees tabs are placeholders.** Only Summary is implemented.

---

## Product decisions already made (don't re-litigate)

- **Stepped line chart** (not smooth) for Raised and Spent — honest to the quarterly reporting rhythm
- **Full cycle x-axis** — even for active cycles where future quarters are empty; shows where we are in the cycle
- **"Raised-to-spent ratio"** — not "burn rate" (domain expert feedback from Tim, a congressional campaign manager)
- **Health indicator hidden for closed cycles** — replaced with "Cycle Complete" contextual summary
- **Points only at filing dates** — no interpolation between quarters
- **YTD field strategy** — use `_ytd` fields from reports and carry year-1 total as base for year-2 (avoids per-period accumulation errors)
- **Election dates from `/election-dates/`** — not `/elections/` (which returns candidate financial summaries, not actual dates)

---

## Domain context

- FEC "cycle" ends Dec 31 of the election year, not on election day
- House candidates file Form 3, quarterly + pre/post election reports
- Senate = 6-year terms; presidential = 4-year. X-axis logic must account for this
- `_ytd` fields reset each January 1, so a two-year cycle requires stitching year 1 final YTD + year 2 running YTD
- Memoed transactions must be excluded from any manual totals (we avoid this by using FEC-computed `_ytd` fields)
- The FEC `/reporting-dates/` endpoint returns deadlines for ALL form types — must filter to `Form 3` for House/Senate candidate pages
- Tim (domain expert, congressional campaign manager) is available for validation questions

---

## What "done" looks like for the candidate page

- [ ] Chart renders real data (not $0)
- [ ] Stepped lines visible between quarterly filing points
- [ ] Full cycle x-axis with future quarters shown as empty space
- [ ] Filing deadline markers: Form 3 only, correctly positioned
- [ ] Election date markers: primary + general, amber dotted lines
- [ ] Health banner: active vs. closed cycle logic working
- [ ] All hardcoded candidate values derived from API response
- [ ] Page works for any candidate ID passed as a URL param (`?id=H2WA03217`)
- [ ] Responsive: mobile header, hamburger nav, chart doesn't overflow viewport

---

## Design reference

The process log (`process-log.html`) has the full project history including domain research notes, Tim's feedback, and all key decisions with rationale. Read it for context on *why* things are the way they are.

The full product brief (`project-brief.md`) has MVP scope, audience definition, backlog, open questions, and definitions.

---

## How to start a session

```bash
cd [your project directory]
claude
```

First thing: read this file, then read `candidate.html`. Ask Sloane what's been tested since the last session and what the current priority is. Don't assume the latest file in the repo matches what's been deployed — ask.
