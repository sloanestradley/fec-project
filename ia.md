# FECLedger — Information Architecture

*Last updated: 2026-04-28. Update this file whenever pages are added, renamed, or promoted in phase.*

---

## Page Inventory

| File | Purpose | Clean URL (Netlify) | Status | Phase |
|---|---|---|---|---|
| `index.html` | Root redirect → search.html | `/` | Live (redirect) | 1 |
| `search.html` | Name-based candidate + committee search with typeahead | `/search?q={query}` | Live | 2 |
| `candidates.html` | Browse candidates by filter, or search by name via `?q=` | `/candidates?state=WA&office=H&party=DEM&cycle=2026` or `/candidates?q={query}` | Scaffold + search | 2 |
| `candidate.html` | Single candidate profile with career index landing state | `/candidate/{fec_candidate_id}` (index) or `/candidate/{fec_candidate_id}#{cycle}` (detail — single flowing view, T-remove-profile-tabs) | Live | 1 |
| `committees.html` | Browse committees by type/state, or search by name via `?q=` | `/committees?state=WA&type=P` or `/committees?q={query}` | Scaffold + search | 3 |
| `committee.html` | Single committee profile — in-place index↔detail transitions (T10) | `/committee/{fec_committee_id}` (index) or `/committee/{fec_committee_id}#{cycle}` (detail — single flowing view, T-remove-profile-tabs) | Live | 3 |
| `races.html` | Browse races by year, office, state | `/races` | Live | 3 |
| `race.html` | Single race view — all candidates in a contest | `/race?state=WA&district=03&year=2026&office=H` | Scaffold | 3 |
| `feed.html` | Live filing feed — recent candidate committee filings | `/feed` | Live | 3 |
| `process-log.html` | Living case study / dev diary | `/process-log.html` | Live | 1 |
| `design-system.html` | Design token and component reference | `/design-system.html` | Live | 1 |

**Clean URL note:** Clean URLs are Netlify 200 rewrites defined in `_redirects`. The `.html` files stay in root; Netlify rewrites the path server-side. Clean URLs only work on the deployed Netlify site — locally (`localhost:8080`) use `.html` paths directly. **Netlify Pretty URLs is also enabled** (site setting), which automatically redirects `.html` URLs to their clean equivalents (e.g. `/candidate.html?id=X` → `/candidate?id=X`). **Profile pages with path-segment URLs** (`candidate.html`, `committee.html`) must use absolute paths for all local resources and nav links — see CLAUDE.md tech stack note.

**Status key:** Live = fully functional | Scaffold = real structure + real data, not all features built | Stub = placeholder, no data

---

## Navigation Structure

The global nav is a top nav (`.top-nav`) — not a sidebar. It was refactored from a sidebar layout in 2026-03-19. The nav is `position:relative` (in-flow); it scrolls out with content on scroll-down and reappears at its document position on scroll-up. Sticky profile-header and tabs-bar pin at viewport top once the nav has scrolled past.

```
FECLedger (logo → /)        [top-nav-logo]

Nav links (desktop, always visible)
├── Races       → /races        (browse landing)
└── Feed        → /feed         (filing feed)

Search button (desktop, inline right of nav links)
└── #nav-search-btn → opens the full-page search overlay
    (on /search: aria-current="page", muted, no-op — you're already there)

Mobile controls (hidden at desktop)
├── Search toggle icon → opens the full-page search overlay
└── Hamburger → opens .mobile-nav drawer

Mobile nav drawer (.mobile-nav)
├── Races
└── Feed
```

Top-level nav exposes only the curated/contextual experiences (Races + Feed). **Search, Candidates browse, Committees browse, Process Log, Design System, and all profile pages are not nav link items.** Search is a full-page overlay (`#search-overlay`, T-search-overlay) opened from the desktop nav search button or the mobile search-toggle — it layers over the current page and closes via the X, Escape, or browser-back. `/search` also remains a real page (reached by direct URL / bookmark / shared link). The `/candidates` and `/committees` browse pages are reached from search results' "View all" affordances or directly via URL.

**No active-state treatment:** Every page renders its nav links identically. The `.nav-link.active` / `.nav-item.active` CSS rules and their markup application were retired in T-IA-candidate-committees-nav-removal (2026-05-20) — they had been visual no-ops (same color as base) and were not load-bearing for any UX affordance.

**Mobile nav:** Two main items (Races, Feed) in the drawer. Search toggle icon always visible left of the hamburger in the mobile header — search does not collapse into the drawer.

---

## Page Relationships

### Browse → Profile

| Browse page | Profile page | Link pattern |
|---|---|---|
| `candidates.html` (any mode) | `candidate.html` | `/candidate/{candidate_id}` (clean URL — unified since 2026-03-12) |
| `committees.html` (any mode) | `committee.html` | `/committee/{committee_id}` (clean URL — unified since 2026-03-12) |
| `races.html` → `race.html` | `candidate.html` | `candidate.html?id={id}#{year}` |
| `search.html` | `candidate.html` | `/candidate/{candidate_id}` |
| `search.html` | `committee.html` | `/committee/{committee_id}` |

### Profile → Profile

| From | To | Trigger | Link pattern |
|---|---|---|---|
| `candidate.html` | `committee.html` | Committees modal — click committee name | `/committee/{committee_id}` |
| `committee.html` | `candidate.html` | Associated-candidate card on detail view | `/candidate/{candidate_id}` |
| `race.html` | `candidate.html` | Candidate card click | `candidate.html?id={id}#{race_year}` |

### Race flow

```
races.html  →  (race row click)       →  race.html?state=WA&district=03&year=2026&office=H
race.html   →  (candidate card click) →  candidate.html?id=H2WA03217#2026
race.html   →  (back link)            →  races.html
```

The `#{year}` anchor on candidate links from `race.html` pre-selects the race's cycle on the candidate page, avoiding the default (latest cycle). The candidate/committee detail view reads the cycle from the bare `#{year}` hash (T-remove-profile-tabs retired the `#{year}#summary` tab segment; race's outbound links were updated to emit `#{year}` directly in the race final pass, 2026-06-04).

### Committee modal

The committees modal on `candidate.html` is not a separate page — it's an overlay triggered from the profile header. Committee names within the modal are `<a>` links to `/committee/{id}`.

---

## URL Patterns Reference

Clean URLs (Netlify-deployed) are canonical. Use `.html` equivalents on localhost.

| Page | Clean URL | Required params | Optional params | Notes |
|---|---|---|---|---|
| `candidate.html` | `/candidate/{id}` | `id` (path segment) | hash: `#{cycle}` | No ID → error state. **Detail view is a single flowing column** (summary → raised → spent), no tabs (T-remove-profile-tabs, 2026-06-03). **Bare URL (no hash) → index view** (CareerStrip + cycle index table). Hash with valid cycle year → detail view. `#cycles` or any non-year hash → also index view. **Back-compat:** legacy `#{cycle}#{tab}` links honor the cycle and drop the tab segment (canonicalize to `#{cycle}`). All identity/discovery entry points should use the bare form. |
| `candidate.html` | `/candidate/{id}#cycles` | `id` (path segment) | — | Alias for index view — `parseInt('cycles')` = NaN → ALL_CYCLES.indexOf(NaN) = -1 → index view. Same landing state as bare URL. |
| `committee.html` | `/committee/{id}` | `id` (path segment) | hash: `#{cycle}` | No ID → error state. **Detail view is a single flowing column** (summary → raised → spent), no tabs (T-remove-profile-tabs, 2026-06-03). **Bare URL (no hash) → index view** (CareerStrip + cycle index table). Hash with valid cycle year → detail view. `#cycles` or any non-year hash → also index view. **Back-compat:** legacy `#{cycle}#{tab}` and old `#all#{tab}` bookmarks resolve via cycle-only parsing (canonicalize to `#{cycle}`; `#all`→index via NaN routing, post-T8). |
| `race.html` | `/race` | `state`, `year`, `office` | `district` (required for House) | No params → error state. **No URL hash** (T-remove-profile-tabs, 2026-06-04 — the Candidates/Insights tabs were retired; the candidate list is the single flowing page, Insights deferred to Phase 4). **Cycle switching is in-place (T-race-inplace-cycle, 2026-06-03):** changing the year re-renders without a reload and `pushState`s the new `?year=` (shareable + back/forward); a bare load canonicalizes `?year=` to the resolved cycle via `replaceState`. |
| `races.html` | `/races` | — | `cycle`, `office`, `state` | URL sync on all three filters — `pushState` on every filter change, params restored on init. Cycle dropdown populated from `/elections/search/`; race rows progressively enriched via `/elections/` as they scroll into view (IntersectionObserver). |
| `candidates.html` | `/candidates` | — | `state`, `office`, `party`, `cycle`, `q` | All params are unified — filter bar always visible, results auto-load on page visit. `?q=` populates the inline search field and pre-fires search. All result cards link to `/candidate/{id}`. Filter chips + URL sync on every change. |
| `committees.html` | `/committees` | — | `state`, `type`, `q` | Same unified control surface as candidates. Filter bar always visible; `?q=` populates search field. All rows link to `/committee/{id}`. Treasurer always shown. |
| `feed.html` | `/feed` | — | — | No URL sync yet. Client-side filters: office (button group), report type (select), time window (button group). Default: All offices, All types, 24h. |
| `search.html` | `/search` | — | `q` | If `q` present, auto-fires search on load |

**FEC candidate_id format:** `H2WA03217` — office (H/S/P) + cycle digits + state + district + sequence
**FEC committee_id format:** `C00744946` — always starts with `C`, 8 digits
**Cycle year:** Even number (FEC 2-year cycle end year). E.g. 2026, 2024, 2022.
**Detail-view structure (candidate/committee):** the `#tab-summary/-raised/-spent` wrapper divs were **DISSOLVED** in the profile flatten (9b, 2026-06-10). The detail view is now thematic raised|spent paired rows in a single flow: **`#breakdown-slot`** (Money flow Sankey **XOR** the Raised/Spent donut pair `#breakdown-donut-grid` — **mutually exclusive on the gate**, 9c) → Geographic | Spending by Purpose → Timeline (candidate-only, full-width) → Top Contributors (full-width) → Top Vendors (full-width) → Contributions to Candidates (committee-only) → `#page-note`. Committee's **Associated Candidate** sits first (committee context). Routing is unchanged — cycle-hash `#{cycle}` only; it never referenced the divs. **No tabs anywhere** (T-remove-profile-tabs closed 2026-06-04; race.html de-tabbed too — its candidate list is the page, Insights deferred to Phase 4). **The breakdown slot is mutually exclusive per entity (T-profile-flatten 9c, shipped 2026-06-10):** in-scope → Money flow Sankey (donut pair hidden); gated (presidential + dual-account committees) → the donut pair (a complete, conserving first-class view) with **no "not yet modeled" caption** — the gate detector only selects which viz mounts. A `breakdown_viz` dimension on `Page Viewed` records which rendered. Full layout spec + remaining steps: `strategy/profile-flatten-layout.md`.

---

## Phase Roadmap

Phase assignments follow `project-brief.md`. Pages listed here by first-built phase.

### Phase 1 — Candidate page
- `candidate.html` — profile with career index landing state (CareerStrip + cycle index), cycle switcher, single flowing detail view (Summary/Raised/Spent sections — de-tabbed in T-remove-profile-tabs), chart, committees modal
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
