# ledger.fec — Information Architecture

*Last updated: 2026-03-10. Update this file whenever pages are added, renamed, or promoted in phase.*

---

## Page Inventory

| File | Purpose | Clean URL (Netlify) | Status | Phase |
|---|---|---|---|---|
| `index.html` | Root redirect → search.html | `/` | Live (redirect) | 1 |
| `search.html` | Name-based candidate + committee search with typeahead | `/search?q={query}` | Live | 2 |
| `candidates.html` | Browse candidates by filter, or search by name via `?q=` | `/candidates?state=WA&office=H&party=DEM&cycle=2026` or `/candidates?q={query}` | Scaffold + search | 2 |
| `candidate.html` | Single candidate profile | `/candidate/{fec_candidate_id}#{cycle}#{tab}` | Live | 1 |
| `committees.html` | Browse committees by type/state, or search by name via `?q=` | `/committees?state=WA&type=P` or `/committees?q={query}` | Scaffold + search | 3 |
| `committee.html` | Single committee profile | `/committee/{fec_committee_id}` | Scaffold | 3 |
| `races.html` | Race mode selector (curated / ad hoc) | `/races` | Scaffold | 3 |
| `race.html` | Single race view — all candidates in a contest | `/race?state=WA&district=03&year=2026&office=H` | Scaffold | 3 |
| `process-log.html` | Living case study / dev diary | `/process-log.html` | Live | 1 |
| `design-system.html` | Design token and component reference | `/design-system.html` | Live | 1 |

**Clean URL note:** Clean URLs are Netlify 200 rewrites defined in `_redirects`. The `.html` files stay in root; Netlify rewrites the path server-side. Clean URLs only work on the deployed Netlify site — locally (`localhost:8080`) use `.html` paths directly. **Netlify Pretty URLs is also enabled** (site setting), which automatically redirects `.html` URLs to their clean equivalents (e.g. `/candidate.html?id=X` → `/candidate?id=X`). **Profile pages with path-segment URLs** (`candidate.html`, `committee.html`) must use absolute paths for all local resources and nav links — see CLAUDE.md tech stack note.

**Status key:** Live = fully functional | Scaffold = real structure + real data, not all features built | Stub = placeholder, no data

---

## Navigation Structure

The global sidebar nav has two sections: **Pages** (user-facing) and **Documentation** (meta).

```
ledger.fec (logo → index.html)

Pages
├── Candidates  → candidates.html   (browse landing)
├── Committees  → committees.html   (browse landing)
├── Races       → races.html        (browse/mode selector)
└── Search      → search.html       (name-based search)

Documentation
├── Process Log   → process-log.html
└── Design System → design-system.html
```

**Active state logic:**
- Browse landing pages (`candidates.html`, `committees.html`, `races.html`) activate their own nav item
- Profile pages (`candidate.html`, `committee.html`, `race.html`) also activate their parent section's nav item (Candidates, Committees, Races respectively) — they are subsections, not top-level destinations
- `search.html`, `process-log.html`, `design-system.html` each activate their own item

**Mobile nav:** Same four main items + separator before Documentation items. Search icon in mobile header (`.mobile-search-icon`) always links to `search.html`.

---

## Page Relationships

### Browse → Profile

| Browse page | Profile page | Link pattern |
|---|---|---|
| `candidates.html` (browse mode) | `candidate.html` | `candidate.html?id={candidate_id}` |
| `candidates.html` (search mode) | `candidate.html` | `/candidate/{candidate_id}` (clean URL) |
| `committees.html` (browse mode) | `committee.html` | `committee.html?id={committee_id}` |
| `committees.html` (search mode) | `committee.html` | `/committee/{committee_id}` (clean URL) |
| `races.html` → `race.html` | `candidate.html` | `candidate.html?id={id}#{year}#summary` |
| `search.html` | `candidate.html` | `/candidate/{candidate_id}` |
| `search.html` | `committee.html` | `/committee/{committee_id}` |

### Profile → Profile

| From | To | Trigger | Link pattern |
|---|---|---|---|
| `candidate.html` | `committee.html` | Committees modal — click committee name | `committee.html?id={committee_id}` |
| `committee.html` | `candidate.html` | Back-link in header | `candidate.html?id={candidate_id}` |
| `race.html` | `candidate.html` | Candidate card click | `candidate.html?id={id}#{race_year}#summary` |

### Race flow

```
races.html  →  (curated form submit)  →  race.html?state=WA&district=03&year=2026&office=H
race.html   →  (candidate card click) →  candidate.html?id=H2WA03217#2026#summary
race.html   →  (back link)            →  races.html
```

The `#{year}#summary` anchor on candidate links from `race.html` pre-selects the race's cycle on the candidate page, avoiding the default (latest cycle).

### Committee modal

The committees modal on `candidate.html` is not a separate page — it's an overlay triggered from the profile header. Committee names within the modal are `<a>` links to `committee.html?id={id}`.

---

## URL Patterns Reference

Clean URLs (Netlify-deployed) are canonical. Use `.html` equivalents on localhost.

| Page | Clean URL | Required params | Optional params | Notes |
|---|---|---|---|---|
| `candidate.html` | `/candidate/{id}` | `id` (path segment) | hash: `#{cycle}#{tab}` | Default fallback: MGP (`H2WA03217`). Tab options: summary, raised, spent |
| `committee.html` | `/committee/{id}` | `id` (path segment) | — | No ID → error state |
| `race.html` | `/race` | `state`, `year`, `office` | `district` (required for House) | No params → error state |
| `races.html` | `/races` | — | — | Mode selector only; no data params |
| `candidates.html` | `/candidates` | — | `state`, `office`, `party`, `cycle`, `q` | `?q=` triggers search mode (hides filter bar, shows paginated results with infinite scroll, links to `/candidate/{id}`); browse params trigger browse mode |
| `committees.html` | `/committees` | — | `state`, `type`, `q` | `?q=` triggers search mode (hides filter bar, shows paginated results with treasurer name, infinite scroll, links to `/committee/{id}`); browse params trigger browse mode |
| `search.html` | `/search` | — | `q` | If `q` present, auto-fires search on load |

**FEC candidate_id format:** `H2WA03217` — office (H/S/P) + cycle digits + state + district + sequence
**FEC committee_id format:** `C00744946` — always starts with `C`, 8 digits
**Cycle year:** Even number (FEC 2-year cycle end year). E.g. 2026, 2024, 2022.
**Tab names:** `summary` | `raised` | `spent`

---

## Phase Roadmap

Phase assignments follow `project-brief.md`. Pages listed here by first-built phase.

### Phase 1 — Candidate page
- `candidate.html` — profile with cycle switcher, tabs (Summary/Raised/Spent), chart, committees modal
- `process-log.html` — dev diary
- `design-system.html` — token/component reference

### Phase 2 — Search and navigation
- `search.html` — name-based candidate search
- `candidates.html` — browse by filters (scaffolded in session alongside Phase 3 pages)
- `index.html` — root redirect

### Phase 3 — Committee and race pages
- `committee.html` — committee profile with financials
- `committees.html` — browse committees
- `races.html` — race mode selector
- `race.html` — single race view with candidate financial cards

### Phase 4 — Early signal data, AI insights
- 48/24hr reports integration on candidate/race pages
- AI-generated insights panel
- Transaction-level search

---

## Open IA Questions

- **Homepage:** `index.html` currently redirects to `search.html`. A proper homepage may be warranted in Phase 4 — would surface trending races, recent filings, or editorial picks.
- ~~**Committees nav item:** Committee search lives in `search.html` as a two-group preview (candidates + committees). Results link to `/candidates?q=` and `/committees?q=` for full-list views. Resolved 2026-03-12.~~
- **Ad hoc race URLs:** When the ad hoc comparison builder is built (Phase 3), candidate IDs will be comma-separated in `?candidates=`. The URL may become long — consider whether to use short-lived server-side IDs or accept long URLs.
- **Candidate ID in URL:** No slug or human-readable alias — FEC IDs are canonical. This is intentional: FEC IDs are stable and unambiguous; slugs would require a lookup layer.
