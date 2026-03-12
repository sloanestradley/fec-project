# FEC Data Visualization — Project Brief

---

## Context

FEC data is used to track campaign fundraising and spending. It is crucial for journalists, researchers, campaign teams, and voters to analyze election trends, identify donor networks, and investigate political spending. The FEC offers a basic presentation of data on their website organized by political candidate, committee (donor group), and contributor (donor). The plain presentation makes it cumbersome to perform comparisons and glean insights at-a-glance. While this data is publicly available and there is genuine appetite for a more user-friendly solution, there is nothing on the market that presents it with the visual clarity and speed that political strategists, journalists, and researchers actually need to work efficiently.

---

## Audience

- **Primary:** Political strategists doing competitive research — including campaign managers, consultants working across multiple frontline races, and party operatives tracking a broad landscape of contests simultaneously
- **Secondary:** Journalists, researchers, and voters

---

## What This Is

A visual, non-partisan tool for answering one question fast: *where is money flowing in this race?* Designed for anyone who needs to move faster than the FEC website allows — from political strategists doing competitive research to journalists, researchers, and engaged voters. The long-term vision is a tool as comprehensive as the FEC itself, but presented with the clarity and speed that professionals actually need to work.

## What This Is Not
- Not partisan
- Not a tool for scraping donor data

---

## Differentiators

- Centers around race-level comparison of campaign financing across all candidates in a single race
- Presents data visually — charts over tables
- Surfaces the full committee ecosystem around a candidate — including leadership PACs via a FEC data relationship (`sponsor_candidate_id`) that tools like OpenSecrets miss entirely — giving strategists visibility into the full money network, not just the principal campaign committee
- Objective, non-partisan presentation — data is shown without editorializing
- Shows the most recently filed information, not just closed races
- Note: OpenSecrets is the closest comparable, but presents data in a way that nudges toward negative conclusions about campaign financing

---

## MVP Requirements

### Global Navigation
- Navigation links: Home, Candidates, Committees, Races (present from launch as stubs; activated as pages are built per phase plan)
- Search exposed in nav across all pages
- **Mobile nav:** at smaller breakpoints, search remains accessible via a search icon exposed left of the hamburger menu icon — search does not collapse into the drawer

### Homepage
- Search by candidate and committee profiles
- Browse aggregate-level data
  - Candidates raising the most (example: https://www.fec.gov/data/raising-bythenumbers/) *Bubble chart over a map of the US might be an interesting visualization here*
  - Candidates spending the most (example: https://www.fec.gov/data/spending-bythenumbers/) *Bubble chart over a map of the US might be an interesting visualization here*
  - Cumulative amount raised by committees (example: https://www.fec.gov/data/browse-data/?tab=raising)
  - Cumulative amount spent by committees (example: https://www.fec.gov/data/browse-data/?tab=spending)

### Candidate Profiles

**Basic profile data**
- Name — initials avatar using first-name-first format (e.g. MGP, AOC); 3-letter initials preferred where applicable
- Race ("Seat"?)
- Political party
- Type of candidacy
- Principal Campaign Committee
- Cycle switcher — allow user to toggle between all cycles the candidate has run in; re-fetch data on selection. Default to active cycle on landing; if no active cycle, default to most recent available.
- URL anchor includes cycle: e.g. `candidate#2026#summary`

**Compare feature**
- Ability to view multiple candidates side-by-side; show candidate information in columns borrowing from the candidate page layout; make visual comparison easy across all candidates

**Financials broken down by: Summary, Raised, Spent**
- Each tab has its own anchor link for direct sharing (e.g. `#summary`, `#raised`, `#spent`)
- Cycle is also encoded in the URL anchor (e.g. `#2024#summary`)

*Summary*
- **Primary question this view answers: "Is this campaign financially healthy or stressed?"**
- Financial health indicator (green/amber/red) — behavior varies by lifecycle state (see Data Lifecycle States). Only shown as an active signal during an active cycle; framed differently for closed cycles, especially when debt remains.
  - Key signal: **raised-to-spent ratio** (John's preferred framing — not "burn rate", which implies a monthly expense concept he doesn't associate with this). Label as "Raised vs. Spent Ratio" or similar. Intriguing as a health signal even to a domain expert who hadn't thought of it that way before.
  - Additional signal of interest: "How much are they spending just to raise?" — fundraising cost efficiency (John)
- Time-based line chart of Raised, Spent, and COH over the course of the cycle (John's suggestion; to be explored — may be more useful than a single static bar)
- When overspend occurs, flag clearly and explain likely cause (prior-cycle reserves, debt)
- Spend-down rate is particularly interesting as a signal, especially in the final weeks before a primary or general (John)

*Raised*
- Breakdown by contributor type (individual, ?, ?, ?, etc.)
- Geography of individual contributions displayed in a US heat map visualization
- Top contributors

*Spent*
- Breakdown by spend category
- Line chart of spend over the cycle, plotted by week for two-year cycles and month for 4–6 year cycles

**Associated Committees**
- Principal campaign committee
- Leadership PAC (~92% of Congress, ~98% of Senate) — surfaced via a separate FEC API endpoint (`sponsor_candidate_id`), not available through standard candidate committee queries; OpenSecrets does not surface these
- Joint fundraising committees (where candidate is the organizer)
- Authorized by candidate
- **Known gap:** JFA committees where the candidate is a participant (not organizer) have no `candidate_ids` or `sponsor_candidate_ids` in the FEC API — they don't appear in standard committee queries. Only surfaced in the candidate's F2 Statement of Candidacy filing. Surfacing these requires F2 parsing — not yet built; validate approach with John before implementing.
- **UI:** Committees are presented in a header modal (not a tab), not cycle-scoped. Active and terminated committees shown in separate tabs with counts. Committees will eventually link to committee pages.
- **Termination statuses:** Two distinct terminated states exist in FEC data. *Voluntarily terminated* (`filing_frequency: 'T'`) — committee filed to close. *Administratively terminated* (`filing_frequency: 'A'`) — FEC-initiated; applies to inactive committees with unresolved debts that failed to settle through normal procedures. Both are shown in the History tab; the distinction is not currently surfaced in the UI.
- NOTE: If candidate associates with a new PAC mid-cycle, they must refile F2.

### Committee Profiles
- TBD

### Race Profiles
- TBD

### Other MVP Notes
- Supportive of further research: individual data components linked to their own page or filtered search where relevant
- Individual contributions search page with filters and table of results (TBD)

---

## Data Lifecycle States

A candidate's data exists in at least four distinct states, each requiring different UI treatment:

1. **Pre-filing** — candidate declared but no financial data filed yet. Surface declared status; no financial charts; communicate data forthcoming.
2. **Active cycle** — filing quarterly (more frequently near elections). Data is live but incomplete. This is the primary use case. Active cycle itself has sub-stages:
   - **Early cycle** — little data, spend patterns not yet established
   - **Mid-cycle** — baseline established; raised-to-spent ratio becomes meaningful
   - **Pre-primary / pre-general (final ~2 weeks)** — spend accelerates sharply; spend-down rate is the most interesting signal; 48/24-hour reporting kicks in (see Backlog: Early Signal Data)
   - John example: *"We'll start spending in week 22, that's a bit earlier/later than others."*
3. **Post-cycle** — race concluded, data complete. Health indicator no longer active; reframe any remaining debt as a lingering obligation rather than a real-time signal. Example: Kamala Harris' 2024 presidential campaign closed with significant debt that the Democratic Party has been slowly retiring — this should be surfaced transparently but framed as historical context, not active concern.
4. **Amended** — prior filing corrected. Surface transparently; show latest figures with amendment noted.

Note: the brief is currently written with the active cycle mid-stage as the primary focus. Design decisions for other states TBD.

---

## Go-live Considerations

- What to name this!
- Buy a domain, pay to make contact info private
- Harassment potential by publishing a tool for politics in a politically charged environment
- Include a mechanism to submit feedback / request features
- Thoughtful Amplitude metrics identified, implemented, and tested prior to launch
- How to make this proprietary, difficult to replicate

---

## Backlog Discussion

- **Scalability:** Can this support viral traffic (at least 100–1,000 users at a time)? Want to confirm architectural decisions won't pigeonhole long-term options.

- **Early signal data (post-MVP, high priority):** Congressional candidates report quarterly, but certain committee types and large contributions ($1,000+ in the final weeks before an election; $10,000+ at any time for certain committees) are required to file 48-hour and 24-hour reports. The FEC API exposes this data through Schedule A and Schedule E endpoints. The opportunity: surface this early-signal data on candidate pages before the quarterly report drops, clearly flagged as preliminary. This would give political strategists an early warning system and a compelling reason to return to the tool regularly — potentially the single strongest driver of repeat traffic.

- **AI-generated insights (post-MVP):** Surface 2–3 sentences of plain-language narrative on candidate and race pages, generated by AI on page load based on the current data. Example: *"Candidate A is outpacing Candidate B in cash on hand by 3:1, but B's spend-down rate has slowed significantly in the last filing period."* The technical approach is straightforward — pass key figures to the Claude API and render the response inline. The editorial challenge is deciding which insights are worth generating vs. noise.

- **Future features:**
  - Secure login for bookmarking and quick access
  - Paywall
  - Data not provided by FEC:
    - Candidate profile images
    - Race predictions

---

## Instructions / Considerations When Building

- This needs to double as a portfolio piece for a staff-level product designer. It should look and feel like a designer made it.
  - Adhere to latest accessibility standards
  - Fully responsive
  - Tasteful, purposeful motion — especially to aid data comprehension
  - Thoughtfully handle non-ideal states (error, empty, no-data-for-cycle, pre-filing, post-cycle with debt)
  - Reduce cognitive load
  - Diligent data transparency — always show coverage dates, data freshness, and caveats
- Local dev: `python3 -m http.server 8080` from project root; URL params work identically to production (e.g. `localhost:8080/candidate.html?id=H2WA03217`)
- Scale is crucial. Ensure architectural decisions consider post-MVP growth (design system, interactive charts, high traffic, early signal data, AI insights, auth, paywall, additional data sources).
- Include a design system documentation page from the start: foundations (color, type, spacing) and all components with states. Sidebar navigation for easy reference.

---

## Phased Roadmap

### Phase 1 — Make the candidate page genuinely useful
*Goal: one page that a real campaign staffer would actually use. Complete before building any new pages.*

- **Raised tab** — contributor breakdown, top donors, geography heatmap
- **Spent tab** — category breakdown, spend timeline
- ~~**Associated committees**~~ ✅ live — header modal with Active/History tabs, leadership PAC via `sponsor_candidate_id`, JFA participant gap acknowledged with transparent UI note.
- **Data freshness indicators** — always show coverage date and filing recency. Staffers need to know if they're looking at last quarter or last week.
- **Empty / zero-data states** — declared candidates with no filings, past candidates with closed cycles, candidates with debt remaining. Each needs a deliberate design treatment.
- **Error states** — FEC API failures, slow responses, unexpected data shapes.
- **Design system page** — start now, not later. Build it as a living reference alongside Phase 1 components. Every component built before it's documented becomes debt.
- **Mobile chart** — nav is responsive; chart needs a dedicated pass before adding more complexity.

### Phase 2 — Make it navigable
*Goal: a user can find any candidate, not just one you link them to.*

- **Search** — scoped to candidates only to start; architecture anticipates committees and races without building them yet
- **Search results page** — one template, candidate-only for now, type-aware formatting ready for committees and races
- **Candidate breadcrumbs** — House/Senate pages are filtered search results at this stage, not standalone pages. Don't build them as real pages yet.

### Phase 3 — Expand the data model
*Goal: show the full money ecosystem, not just the candidate.*

- **Committee page** — build after search exists so it can be navigated to meaningfully
- **Race page** — the compare feature lives here. Two modes, one shared UI:
  - **Curated mode:** a specific contest (e.g. WA-03 2026) auto-populates all declared candidates; no user input needed
  - **Ad hoc mode:** user searches and selects any candidates to compare regardless of race — designed for consultants managing multiple frontline races simultaneously (John's use case). No editorial curation required.
- **Associated committees** — link to live committee pages once those exist

### Phase 4 — Differentiation features
*Goal: reasons to return; things OpenSecrets doesn't do.*

- **Early signal data** — 48/24-hour reports surfaced on candidate pages; strongest repeat-usage driver
- **AI insights** — 2–3 sentence plain-language narrative on candidate and race pages, generated on load
- **Transactions search** — FEC-style linked data; useful but not differentiating; lower priority than above

---

## Gaps to Address (no phase assigned yet)

- **The name** — "Ledger" appears in the process log nav but hasn't been committed to. Name and domain matter for portfolio presentation and user perception.
- **UI, interaction, and accessibility** — needs a holistic pass; not scoped to a single phase. Accessibility standards, motion design, touch targets, color contrast, keyboard navigation.
- **House / Senate browsing pages** — breadcrumbs reference these but they're not priority pages. Filtered search results serve this function for MVP; revisit post-Phase 2.

---

## Infrastructure / Architecture debt

- **Netlify Function proxy** - the API key is currently exposed client-side in utils.js; the fix is a Netlify serverless function that proxies all FEC requests server-side, holds the key as an environment variable, and optionally adds response caching for repeat lookups. Worth a dedicated session — it touches utils.js, requires a netlify/functions/ directory, a netlify.toml, and Netlify environment variable configuration. - *FLAG: this is a pre-launch priority, not a polish item.*

---

## Open items (not prioritized)

- **Default sort for browse mode (candidates + committees)** - Currently sort=name. Ideally sort=-receipts for discovery, but FEC API blocks it without a q= param. Date-based alternatives (last_file_date, load_date, first_file_date) are either invalid sort fields or null-heavy, producing useless ordering. Options: default to election_year=2026 filter to narrow the browse set meaningfully, or revisit when the Netlify proxy is in place (server-side could pre-filter or cache a sorted set). Not urgent but intentionally deferred. *noted, but this might not be as much of an issue when it stops being a top-level page and acts as a landing after kicking off search*

---

## Open Questions

- What data varies for Senate vs. Congressional candidates?
- Do I include Presidential candidates yet? Are there drawbacks?
- Would it be useful to "Compare committees"? Or show aggregate data across a candidate's committee ecosystem?
- What does "financially healthy" mean quantitatively to a political strategist? What raised-to-spent ratio or COH level triggers concern at different stages of a cycle? *(Validate with John)*
- How do we best visualize "how much are they spending just to raise?" — is this a ratio, a dollar figure, a chart? *(Validate with John)*
- What does a healthy vs. concerning spend-down rate look like in the final two weeks before a primary/general? *(Validate with John)*
- At what point in the active cycle sub-stages does the raised-to-spent ratio become a meaningful signal vs. noise? *(Validate with John)*
- **Race page — defining "unserious" candidates:** Candidates with low or no financial data should be shown with reduced visual hierarchy on race pages, but what threshold defines "unserious"? A declared candidate with zero filings is different from one with minimal activity. *(Validate with John — what would a strategist actually want to see?)*
- **JFA participant gap via F2:** For JFA committees where the candidate is a participant (not the organizer), the FEC API has no queryable relationship — these committees have no `candidate_ids` or `sponsor_candidate_ids`. The only source of truth is the candidate's most recent F2 filing. Is F2 parsing a reliable approach at scale? What are the edge cases? *(Validate with John before building)*
- ~~**Associated committees — leadership PAC identification:**~~ ✅ Resolved. Use the `leadership_pac` boolean field on committee records, combined with a parallel call to `/committees/?sponsor_candidate_id={candidate_id}`. The `sponsor_candidate_id` relationship surfaces PACs the candidate sponsors — not indexed through the standard authorized-committee endpoint. `committee_type === 'D'` is unreliable (some leadership PACs have `committee_type: 'N'`).
- **Raised tab — "Transfers In" category:** John flagged confusion between "Transfers In" and "PAC / Other Committees" — they appear to overlap because JFA contributions are categorized as "Transfers In" by the FEC rather than under "Individual" or "PAC." Total raised figures match campaign-confirmed numbers so double-counting is not occurring. Two actions needed: (1) confirm `receipt_type` values behind "Transfers In" via Schedule A in Claude Code; (2) add plain-language tooltip or footnote explaining the category to users. *(FEC note: contributions received as part of a joint fundraising transfer are included in "Transfers In" rather than "Individual contributions" in some data files)*

---

## Definitions

- **Committee:** Legal entity (business); any PAC, candidate committee, or any legal entity allowed to raise or spend money
- **JFA (Joint Fundraising Committee):** Allows multiple committees to raise together. Note: there is an important distinction between a candidate who is the *organizer* of a JFA (queryable via FEC API) and one who is merely a *participant* (not queryable — only surfaced in F2 filings).
- **Leadership PAC:** A political action committee sponsored by an elected official or candidate, separate from their principal campaign committee. Used to donate to other candidates and build political relationships. Queryable via `sponsor_candidate_id` in the FEC API.
- **JFA participant gap:** JFA committees where a candidate participates (but is not the organizer) have no `candidate_ids` or `sponsor_candidate_ids` in the FEC API. They don't appear in standard committee queries — only surfaced in the candidate's F2 Statement of Candidacy filing.
- **Hybrid PAC (Super PAC):** Allowed to have an unlimited IE side (soft side); there's a hard side also, with a wall between soft and hard
- **Spend-down rate:** The pace at which a campaign is depleting its cash reserves, particularly relevant in the final weeks before an election
- **Raised-to-spent ratio:** Total receipts divided by total disbursements for a cycle; a signal of financial efficiency and health (preferred framing over "burn rate" per John)

---

## Reference

- FEC API
- OpenSecrets
- California Target Book
- X: CATargetBot0001
- X: rspyers
- John's 'Lay of the Land' deck

---

## Unorganized Notes

- Campaign teams report quarterly with the exception of a 2-week deadline right before primary and general elections; last-minute data shows spending at crunch time *(John)*
- Candidate profile data is similar to their Principal Campaign Committee's profile data *(John)*
- Separate out candidate and candidate committees *(John)*
- Might be cool to have a search by zip code to view all federal races relevant to a voter in this cycle
- Aggregate-level data of unions spending the most ("What unions should I reach out to proactively or have on my radar?")
