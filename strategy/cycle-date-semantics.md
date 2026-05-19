# Cycle date semantics audit + revised treatment

**Status:** Diagnostic / proposal. Sloane review required before implementation scoping.
**Date:** 2026-05-19 (revised after first proposal retired)
**Pauses:** T-load-4a / T-load-4b (skeleton loading work resumes after this lands).

---

## TL;DR

The candidate page today renders cycle labels with two semantics in two places:

- **Index view** → coverage_start_date semantic (Trump 2024 = `"2022–2024"`)
- **Detail view stat-cycle card** → office-aware year-N math (Trump 2024 = `"2021–2024"`)

A user clicking from `"2022–2024"` lands on `"2021–2024"`. Real, pre-existing inconsistency.

**Revised treatment (per Sloane's reframe):** retire BOTH year-range formats on candidate.html. Display election as a single year ("2024"), rename column header "Cycle" → "Election". This matches FEC.gov's own convention (verified — see section 2).

Committee.html stays unchanged — committee /totals/ records are 2-year FEC filing cycles, and the existing year-range label is correct semantically. FEC.gov uses the same year-range format for what it calls the "Two-year period" selector, distinct from the "Election" selector on candidate pages.

**An earlier proposal (`resolveCycleRange` helper + Senate-special gap analysis + "entered race [year]" sub-note) is retired.** That proposal compensated for misleading primary labels under a flawed direction. The single-year label is honest on its own; no helper, no detection logic, no sub-note needed.

---

## 1. Today's implementation per label site

### 1a. Candidate page — three label sites

| Site | Code location | Field(s) used today | Today's output |
|---|---|---|---|
| **History card** (`#cstat-history`) | candidate.html `renderHistoryStrip` line 1950 | `histData.first_file_date` + max `coverage_end_date` from totals | "2022–2026" (Marie), "2019–2024" (Kamala), "1987–2024" (Trump) — date range from real data, not cycle math |
| **Cycle row label** (`renderCycleIndex`) | candidate.html lines 2019–2022 | `coverage_start_date` from totals record per cycle | "2022–2024" (Trump), "2019–2024" (Gillibrand), "2021–2022" (Marie's first cycle via defensive fallback) |
| **Detail stat-cycle card** (`#stat-cycle`) | candidate.html line 1693 (`loadCycle`) | `(cycle - getCycleSpanYears() + 1) + '–' + cycle` — H=2yr, S=6yr, P=4yr | "2021–2024" (Trump), "2019–2024" (Gillibrand regular), "2005–2010" (Gillibrand special — WRONG) |

### 1b. Committee page — three label sites

| Site | Code location | Field(s) used today | Today's output |
|---|---|---|---|
| **History card** (`#cstat-history`) | committee.html `renderHistoryStrip` line 493 | `c.first_file_date` + `c.last_file_date` (entity-only) | "2009–2026" (Gillibrand's PCC), "2022–2026" (Marie's PCC) — date range from entity |
| **Cycle row label** (`renderCycleIndex`) | committee.html lines 549–552 | `coverage_start_date` from totals record per cycle | "2023–2024", "2021–2022" (always 2-year FEC reporting cycles regardless of supported office) |
| **Detail stat-cycle card** (`#stat-cycle`) | committee.html line 949 + T-load-3 init() sync hash-write | `(cycle - 1) + '–' + cycle` | "2023–2024" — always 2-year cycle, matches committee data semantic |

### 1c. The inconsistency, concretely

Sample rendering on candidate.html today:

| Candidate | Cycle | Index says | Detail says |
|---|---|---|---|
| Marie (H) | 2022 | `2021–2022` | `2021–2022` |
| Trump (P) | 2024 | `2022–2024` | `2021–2024` ⚠ |
| Kamala (P) | 2020 | `2019–2020` | `2017–2020` ⚠ |
| Gillibrand (S regular) | 2024 | `2019–2024` | `2019–2024` |
| Gillibrand (S special) | 2010 | `2009–2010` | `2005–2010` ⚠ |
| Gillibrand (S post-special 2yr) | 2012 | `2011–2012` | `2007–2012` ⚠ |

The detail-view labels marked ⚠ are factually wrong against FEC's own per-cycle coverage data. The detail card's office-aware formula doesn't know about Senate specials and doesn't track per-candidate filing dates.

---

## 2. Verification findings

### 2a. `?cycle={year}&election_full=true` returns the election-aggregated record

Tested live against production proxy for Senate and Presidential:

**Gillibrand 2024 (Senate, 6-year):**
- `/totals/?cycle=2024&election_full=true` returns ONE record: cov=2019-01-01→2024-12-31, receipts=$15,722,159 (aggregated across 3 subcycles)

**Trump 2024 (Presidential, 4-year):**
- `/totals/?cycle=2024&election_full=true` returns ONE record: cov=2022-11-15→2024-08-08, receipts=$3,852,435 (aggregated across his filing window)

**Implication:** the single-year label "2024" is backed by FEC's own pre-aggregated election record. The data behind a single-year display is real election-level data, not a confusing per-subcycle slice. **No new API calls needed**; the existing `?cycle={year}` query pattern already supports election-aggregated retrieval via the `election_full=true` filter. Today's loadCycle on candidate.html iterates subcycles and sums; could be simplified later but isn't a blocker for the label change.

### 2b. FEC.gov uses single election years as the primary cycle selector

Verified directly against `fec.gov/data/candidate/...` for all three office types:

| Page | "Election" selector values | Other selector(s) |
|---|---|---|
| Marie (H2WA03217) | 2026, 2024, 2022 (single years) | none on this page |
| Trump (P80001571) | 2024, 2020, 2016, 1988 (single years) | none on this page |
| Gillibrand (S0NY00410) | 2030, 2024, 2018, 2012, 2010 (single years) | Separate "Two-year period" selector with values 2025–2026, 2023–2024, etc. |

**Pattern confirmed:** FEC's candidate-page convention is single election years labeled "Election." The 2-year reporting cycle is a separate filing-mechanism concept, surfaced via a distinct "Two-year period" selector only where it's meaningful (Senate). FEC's data model treats election year as the unit of display; the 2-year subcycle is the filing mechanism.

This validates Sloane's reframe. The proposed treatment maps directly to FEC's own organizational convention.

---

## 3. Endpoint research — what date fields are available where

(Reference for context. The revised treatment requires zero new API call work, but field availability is documented for completeness.)

### 3a. `/candidate/{id}/` — used by both pages
- `first_file_date`, `last_file_date` — career-wide dates (entity scope)
- `election_years` — cycles the candidate ran in (single years)
- `cycles` — all 2-year FEC reporting periods (superset of election_years)
- `office` — H/S/P

### 3b. `/candidate/{id}/totals/` — used by candidate.html
- `candidate_election_year` — the election cycle this record belongs to
- `cycle` — the 2-year FEC subcycle (may differ from candidate_election_year for Senate/Presidential)
- `election_full` (bool) — true = pre-aggregated election record; false = per-subcycle record
- `coverage_start_date`, `coverage_end_date` — FEC's reporting window for this record (varies by candidate filing pattern)

### 3c. `/candidate/{id}/history/` — used by candidate.html
- `election_years`, `cycles`, `first_file_date`, `last_file_date` — overlap with /candidate/{id}/
- `two_year_period` — per-history-record 2-year FEC cycle
- **Finding:** /history/ provides nothing not already on /candidate/{id}/ for label purposes. Banked: post-this-work, the /history/ call could potentially be retired entirely. Out of scope for this ticket.

### 3d. `/committee/{id}/`, `/committee/{id}/totals/` — used by committee.html
- Committee totals records are 2-year FEC reporting periods. `coverage_start_date` ≈ Jan 1 of year-1 of cycle (or committee founding date).
- No `candidate_election_year`, no `election_full` (committees aren't candidates).

### 3e. `/elections/`, `/election-dates/`
- Neither exposes cycle-start-boundary fields useful for label derivation. Not relevant to the revised treatment.

---

## 4. Revised unified treatment

### 4a. History card — no changes

Both pages keep today's behavior:
- candidate.html: `first_file_date` (entity) for start year, `max(coverage_end_date)` from totals for end year
- committee.html: `first_file_date` + `last_file_date` (entity only)

Audited across the sample candidates — produces intuitive results in every case. The History card displays a date range derived from real data, not cycle math; that's correct semantic for "history" framing.

### 4b. Candidate page cycle row + detail stat-cycle — single-year labels

**Cycle row label** (`renderCycleIndex` on candidate.html):
- Today: `"{startYear}–{year}"` derived from `coverage_start_date` or fallback
- New: `"{year}"` — just the election year
- Column header rename: `"Cycle"` → `"Election"`

**Detail stat-cycle card** (`loadCycle` line 1693 on candidate.html):
- Today: `(cycle - getCycleSpanYears() + 1) + '–' + cycle`
- New: `cycle` (the year as written in the URL hash and `activeCycle` variable)
- Card label rename: `"Cycle"` → `"Election"` (HTML around line 129)

Sample renderings under revised treatment:

| Candidate | Cycle | Index label (new) | Detail label (new) |
|---|---|---|---|
| Marie (H) | 2022 | `2022` | `2022` |
| Marie (H) | 2024 | `2024` | `2024` |
| Kellogg (H newcomer) | 2026 | `2026` | `2026` |
| Trump (P) | 2024 | `2024` | `2024` |
| Trump (P) | 1988 | `1988` | `1988` |
| Kamala (P) | 2020 | `2020` | `2020` |
| Gillibrand (S regular) | 2024 | `2024` | `2024` |
| Gillibrand (S special) | 2010 | `2010` | `2010` |
| Gillibrand (S post-special) | 2012 | `2012` | `2012` |

Every case is honest. No flash. No range. No special-election detection. No fallback for missing data (the year is the URL hash; always known). No sub-note (single-year labels don't need clarification).

### 4c. Committee page — no changes

Committee.html keeps:
- Cycle row label: `"{cycle-1}–{cycle}"`
- Detail stat-cycle card: `"{cycle-1}–{cycle}"`
- Column header: `"Cycle"`

This is correct because committee /totals/ records ARE 2-year FEC reporting periods. The label communicates the actual data semantic. FEC.gov uses the same convention ("Two-year period" with year ranges) on its committee-level surfaces. Verified across the sample (Senate PCC, House PCC, multi-cycle committees).

The asymmetry between candidate and committee is intentional and matches FEC's own convention.

### 4d. What's NOT included in this work

Banked for future tickets (Sloane's call on when/if):
- **Detail-view sub-note about coverage span or election dates.** E.g., a small caption under #stat-cycle reading "Coverage: Nov 2022 – Aug 2024" or "Election held Nov 5, 2024". Would surface candidate-specific context as supplementary info. Not scoped here; the single-year label is honest enough to ship without it.
- **"Two-year period" filter surface for Senate detail view.** FEC.gov exposes both selectors on Senate pages so users can drill into a specific 2-year subcycle within a 6-year election. We don't do this today (loadCycle aggregates across subcycles). If users request this drill-down in the future, it'd be a meaningful feature addition.
- **Retiring the /history/ API call** on candidate.html post-this-work. Currently called by `fetchIndexData`; after this change, the endpoint provides nothing not already on the entity call. Latency win on cold cache. Separate cleanup ticket.
- **Simplifying loadCycle** to use `?cycle={year}&election_full=true` (single call) instead of iterating subcycles and summing. Performance win, simplification, but not required for the label change.

### 4e. The previously-proposed work that's RETIRED

The earlier proposal in this doc included:
- `resolveCycleRange(office, cycle, electionYears)` helper in utils.js
- Senate gap-analysis special-election detection
- "Entered race [year]" / "First filing [year]" sub-notes
- House special-election handling
- Mixed-office election_years edge case discussion

All of this was compensating for misleading primary labels under the year-range direction. Under the revised single-year direction, none of it is needed. Retiring the helper proposal eliminates ~150 LOC of complexity, three new test surfaces (special-election labels, sub-note presence/absence, fallback logic), and an open edge case (mixed-office candidates).

---

## 5. Implementation impact

### 5a. Code changes

| File | Change | Approx LOC |
|---|---|---|
| `candidate.html` | `renderCycleIndex` cycleRowHTML format change (drop startYear, render `{year}`); column header text "Cycle" → "Election"; `cycleRowHTML` signature simplification | ~15 |
| `candidate.html` | `loadCycle` line 1693 `#stat-cycle` text change to `cycle` alone; HTML `<div class="stat-label">Cycle</div>` line 129 → `<div class="stat-label">Election</div>` | ~3 |
| `candidate.html` | `renderCycleIndex` archive divider text — current copy "FEC coverage begins {threshold} for {officeLabel} races" stays valid (threshold is single year already, "2008" not "2007–2008"); no change | 0 |
| `committee.html` | No changes | 0 |
| `utils.js` | No changes (no helper needed) | 0 |
| `styles.css` | No changes (label is plain text in existing cell) | 0 |
| `tests/candidate.spec.js` | Update tests asserting on cycle label format and stat-card label text | ~20 |
| `tests/committee.spec.js` | No changes | 0 |
| `CLAUDE.md` | Update candidate page section: stat-cycle card description, cycle-row description, cycle/election terminology note | ~10 |
| `design-system.html` | Update candidate-header / stat-card demo if they show "Cycle" header text | ~3 |
| `test-cases.md` | New 2026-05-19 row | ~3 |
| `TESTING.md` | Update describe-block descriptions where cycle label format is mentioned | ~3 |
| **Total** | | **~55 LOC** |

### 5b. Code identifiers stay `cycle`

Internal terminology stays as today — `activeCycle`, `ALL_CYCLES`, `cycleFetchToken`, `#stat-cycle`, `#cycle-index`, `#cycle-back-btn`, etc. URL hash format `#{year}#{tab}` stays. Only user-facing strings change ("Cycle" → "Election" header; "{year-N}–{year}" → "{year}" value). Minimum churn; no migration risk on bookmarks, links, or stable code surfaces.

### 5c. Tests affected (specific list)

candidate.spec.js tests to update:
- `'#stat-cycle shows cycle year-range on detail view (T14.5)'` — assertion changes from `^\d{4}[–\-]\d{4}$` to `^\d{4}$`
- `'first stat card label = "Cycle"'` (if present) — update to "Election"
- `'cycle row labels contain a year range with en-dash'` (line ~1053) — update to single-year pattern
- T-load-3 `'cycle-detail stat cells replaced by real values after loadCycle resolves'` — `#stat-cycle` regex changes
- T-load-3 `'cycle-detail stat cells have skeleton spans in initial HTML'` — initial HTML for `#stat-cycle` still has skeleton, but resolved value shape changes
- Any test asserting `text /^\d{4}[–\-]\d{4}$/` on a candidate cycle-row label

committee.spec.js: no changes (committee labels stay 2-year range).

### 5d. Docs affected

- **CLAUDE.md**: candidate page section describing the stats grid (cycle card now reads "Election: {year}" not "Cycle: {year-N}–{year}"); resolves the documented inconsistency between index view (coverage_start_date) and detail view (office-aware) noted in earlier sessions.
- **design-system.html**: candidate-header demo or stat-card demo if they include the cycle card with the old "Cycle" label.
- **TESTING.md**: minor text updates in describe-block descriptions.
- **test-cases.md**: new dated row.

---

## 6. Fallback documentation

Trivial under single-year treatment. No fallback logic needed.

| Site | No /totals/ record (Kellogg case) | Missing field | Edge case |
|---|---|---|---|
| Cycle row label | `{year}` from `ALL_CYCLES` (entity) | n/a (year always known) | n/a |
| Detail stat-cycle | `{cycle}` from URL hash (or `activeCycle`) | n/a | n/a |

The cycle year is always known from entity data (`election_years` on candidate.html, `cycles` on committee.html) and from the URL hash. No fetch dependency for label derivation.

---

## 7. Recommended next steps + implementation scope

### Ticket structure

**One combined ticket: T-cycle-semantics.**

Scope:
1. candidate.html `renderCycleIndex` — drop `{startYear}–` from cycleRowHTML labels
2. candidate.html `loadCycle` line 1693 — drop `(cycle - getCycleSpanYears() + 1) + '–'` from #stat-cycle write
3. candidate.html HTML — rename "Cycle" label text to "Election" in both stat-card AND cycle-index column header
4. Test updates (~6 assertion updates in candidate.spec.js)
5. Docs updates (CLAUDE.md, design-system.html, TESTING.md, test-cases.md)

### Estimated scope

~55 LOC total. Single contained ticket, no helper, no architectural changes, no API call changes, no test infrastructure changes.

### Dependencies / sequencing

- **T-load-4a and T-load-4b are blocked on this ticket** per Sloane's prompt. After T-cycle-semantics ships, the cycle-row scaffold question becomes trivial: scaffold renders `{year}` from `ALL_CYCLES` (already in memory after entity resolves), hydrate replaces nothing on the year label, financial cells continue to use skeletons. No flash. T-load-4a's helper-refactor work can resume after this.
- **No external dependencies** — no new API calls, no schema changes, no migration.
- **Bookmarks and external links stay valid** — URL hash format unchanged.

### Banked observations for future work

1. **Sub-note for actual coverage span on detail view.** Banked, not scoped. Worth revisiting if user testing shows the bare year leaves users uncertain about what timeframe the data covers.
2. **"Two-year period" filter on Senate detail view.** FEC.gov has this. We don't. Future feature, separate ticket.
3. **/history/ API call retirement on candidate.html.** Post-this-work, /history/ provides nothing not already on entity. Cleanup ticket, latency win on cold cache.
4. **loadCycle simplification to single `election_full=true` fetch.** Today's iteration-and-sum approach works but could be one call instead of 1/2/3 (H/P/S). Performance simplification, not required.

---

## Audit completeness

Sample candidates verified via production proxy + FEC.gov direct comparison:
- Marie Gluesenkamp Perez (H2WA03217) — House standard
- Joe Kent (H2WA03100) — House pre-cycle-year filer
- Lawrence Curtis Kellogg (H6WA03309) — House newcomer no totals
- Kirsten Gillibrand (S0NY00410) — Senate with special-election history
- Donald Trump (P80001571) — Presidential, multiple cycles
- Kamala Harris (P00009423) — Presidential mid-cycle launches

FEC.gov convention verified for: Marie (H), Trump (P), Gillibrand (S, including the dual "Election" + "Two-year period" selector pattern).

**No new API calls required by the revised treatment.**
