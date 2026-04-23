# FECLedger — Information Architecture

*Last updated: 2026-04-23. Update this file whenever pages are added, renamed, or promoted in phase.*

---

## Page Inventory

| File | Purpose | Clean URL (Netlify) | Status | Phase |
|---|---|---|---|---|
| `index.html` | Root redirect → search.html | `/` | Live (redirect) | 1 |
| `search.html` | Name-based candidate + committee search with typeahead | `/search?q={query}` | Live | 2 |
| `candidates.html` | Browse candidates by filter, or search by name via `?q=` | `/candidates?state=WA&office=H&party=DEM&cycle=2026` or `/candidates?q={query}` | Scaffold + search | 2 |
| `candidate.html` | Single candidate profile | `/candidate/{fec_candidate_id}#{cycle}#{tab}` | Live | 1 |
| `committees.html` | Browse committees by type/state, or search by name via `?q=` | `/committees?state=WA&type=P` or `/committees?q={query}` | Scaffold + search | 3 |
| `committee.html` | Single committee profile | `/committee/{fec_committee_id}` | Scaffold+ (tabs + cycle switcher live; Raised tab live; Spent tab live; filing history stub) | 3 |
| `races.html` | Browse races by year, office, state | `/races` | Live | 3 |
| `race.html` | Single race view — all candidates in a contest | `/race?state=WA&district=03&year=2026&office=H` | Scaffold | 3 |
| `feed.html` | Live filing feed — recent candidate committee filings | `/feed` | Live | 3 |
| `process-log.html` | Living case study / dev diary | `/process-log.html` | Live | 1 |
| `design-system.html` | Design token and component reference | `/design-system.html` | Live | 1 |

**Clean URL note:** Clean URLs are Netlify 200 rewrites defined in `_redirects`. The `.html` files stay in root; Netlify rewrites the path server-side. Clean URLs only work on the deployed Netlify site — locally (`localhost:8080`) use `.html` paths directly. **Netlify Pretty URLs is also enabled** (site setting), which automatically redirects `.html` URLs to their clean equivalents (e.g. `/candidate.html?id=X` → `/candidate?id=X`). **Profile pages with path-segment URLs** (`candidate.html`, `committee.html`) must use absolute paths for all local resources and nav links — see CLAUDE.md tech stack note.

**Status key:** Live = fully functional | Scaffold = real structure + real data, not all features built | Stub = placeholder, no data

---

## Navigation Structure

The global nav is a fixed top nav (`.top-nav`) — not a sidebar. It was refactored from a sidebar layout in 2026-03-19.

```
FECLedger (logo → /)        [top-nav-logo]

Nav links (desktop, always visible)
├── Candidates  → /candidates   (browse landing)
├── Committees  → /committees   (browse landing)
├── Races       → /races        (browse landing)
└── Feed        → /feed         (filing feed)

Search bar (desktop, inline right of nav links)
└── text input → submits to /search?q=

Mobile controls (hidden at desktop)
├── Search toggle icon → expands inline search panel
└── Hamburger → opens .mobile-nav drawer

Mobile nav drawer (.mobile-nav)
├── Candidates
├── Committees
├── Races
└── Feed
```

Search, Process Log, and Design System are **not** nav link items. Search is accessible via the inline search bar (desktop) or search toggle (mobile). Process Log and Design System have no nav presence.

**Active state logic:**
- Browse landing pages (`candidates.html`, `committees.html`, `races.html`, `feed.html`) activate their own nav item
- Profile pages (`candidate.html`, `committee.html`, `race.html`) activate their parent section's nav item (Candidates, Committees, Races respectively)
- `search.html`, `process-log.html`, `design-system.html` have no active nav link

**Mobile nav:** Three main items (Candidates, Committees, Races) in the drawer. Search toggle icon always visible left of the hamburger in the mobile header — search does not collapse into the drawer.

---

## Page Relationships

### Browse → Profile

| Browse page | Profile page | Link pattern |
|---|---|---|
| `candidates.html` (any mode) | `candidate.html` | `/candidate/{candidate_id}` (clean URL — unified since 2026-03-12) |
| `committees.html` (any mode) | `committee.html` | `/committee/{committee_id}` (clean URL — unified since 2026-03-12) |
| `races.html` → `race.html` | `candidate.html` | `candidate.html?id={id}#{year}#summary` |
| `search.html` | `candidate.html` | `/candidate/{candidate_id}` |
| `search.html` | `committee.html` | `/committee/{committee_id}` |

### Profile → Profile

| From | To | Trigger | Link pattern |
|---|---|---|---|
| `candidate.html` | `committee.html` | Committees modal — click committee name | `/committee/{committee_id}` |
| `committee.html` | `candidate.html` | Back-link in header | `candidate.html?id={candidate_id}` |
| `race.html` | `candidate.html` | Candidate card click | `candidate.html?id={id}#{race_year}#summary` |

### Race flow

```
races.html  →  (race row click)       →  race.html?state=WA&district=03&year=2026&office=H
race.html   →  (candidate card click) →  candidate.html?id=H2WA03217#2026#summary
race.html   →  (back link)            →  races.html
```

The `#{year}#summary` anchor on candidate links from `race.html` pre-selects the race's cycle on the candidate page, avoiding the default (latest cycle).

### Committee modal

The committees modal on `candidate.html` is not a separate page — it's an overlay triggered from the profile header. Committee names within the modal are `<a>` links to `/committee/{id}`.

---

## URL Patterns Reference

Clean URLs (Netlify-deployed) are canonical. Use `.html` equivalents on localhost.

| Page | Clean URL | Required params | Optional params | Notes |
|---|---|---|---|---|
| `candidate.html` | `/candidate/{id}` | `id` (path segment) | hash: `#{cycle}#{tab}` | Default fallback: MGP (`H2WA03217`). Tab options: summary, raised, spent. Bare URL (no hash) resolves to the detail view today; after T5/T6 it will resolve to the cycle index — all identity/discovery entry points should use the bare form. |
| `candidate.html` (future) | `/candidate/{id}#cycles` | `id` (path segment) | — | Cycle index landing state; not yet implemented. Reserved for T5/T6. |
| `committee.html` | `/committee/{id}` | `id` (path segment) | — | No ID → error state |
| `race.html` | `/race` | `state`, `year`, `office` | `district` (required for House) | No params → error state |
| `races.html` | `/races` | — | `cycle`, `office`, `state` | URL sync on all three filters — `pushState` on every filter change, params restored on init. Cycle dropdown populated from `/elections/search/`; race rows progressively enriched via `/elections/` as they scroll into view (IntersectionObserver). |
| `candidates.html` | `/candidates` | — | `state`, `office`, `party`, `cycle`, `q` | All params are unified — filter bar always visible, results auto-load on page visit. `?q=` populates the inline search field and pre-fires search. All result cards link to `/candidate/{id}`. Filter chips + URL sync on every change. |
| `committees.html` | `/committees` | — | `state`, `type`, `q` | Same unified control surface as candidates. Filter bar always visible; `?q=` populates search field. All rows link to `/committee/{id}`. Treasurer always shown. |
| `feed.html` | `/feed` | — | — | No URL sync yet. Client-side filters: office (button group), report type (select), time window (button group). Default: All offices, All types, 24h. |
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
- `races.html` — browse races by year/office/state with progressive enrichment
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
