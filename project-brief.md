# FEC Data Visualization — Project Brief

---

## Context

FEC data is used to track campaign fundraising and spending. It is crucial for researchers, campaign teams, journalists, and voters to analyze election trends, identify donor networks, and investigate political spending. The FEC offers a basic presentation of data on their website organized by political candidate, committee (donor group), and contributor (donor). The plain presentation makes it cumbersome to perform comparisons and glean insights at-a-glance. While this data is publicly available and there is genuine appetite for a more user-friendly solution, there is nothing on the market that presents it with the visual clarity and speed that political strategists, researchers, and journalists actually need to work efficiently.

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
- Breakdown by contributor type (itemized individuals, unitemized individuals, PACs & other committees, party committees, candidate authorized committees, candidate self-funding, loans, federal funds, offsets, other receipts) — donut chart
- Geography of individual contributions displayed in a US heat map visualization
- **Top Individual Contributors** — ranked list of the largest individual donors to the committee (by cycle), surfaced as an entity-level view to complement the aggregate geography map. Live on committee.html AND candidate.html as of Session 3 (2026-04-19), served from pre-computed bulk data (FEC indiv files → daily DuckDB GROUP BY in GitHub Actions → Cloudflare KV namespace `fecledger-aggregations`, key `top_contributors:{cmte_id}:{cycle}`). Pages Function at `functions/api/aggregations/[[path]].js` reads KV and returns top 25 per committee; UI shows top 10. Accuracy 100% — DuckDB does external spill-to-disk GROUP BY, no pruning. **Scope:** only committees that appear as a recipient in pas2 OR have ≥500 post-memo individual rows in indiv get pre-computed entries. Committees outside that scope fall through to a paginated API fetch (gated at 100 pages / 10,000 transactions) or render `"Data not available for this committee."` when even that would be incomplete. On candidate.html the card is scoped to the *latest 2-year sub-cycle* (KV keys are per sub-cycle, not per multi-year election cycle) with a data-note disclaimer for Senate/Presidential candidates.
- **Top Committee Contributors** — PACs, party committees, and other committee-type contributors giving their own money. Legally distinct from conduit flow. As of the 2026-04-20 Session 3 bundle, served from pre-computed bulk data on committee.html (pas2 aggregated via DuckDB → Cloudflare KV, key `top_committees:{cmte_id}:{cycle}`). KV-first branch tree with live-API fallback for small committees and an honest `"Data not available for this committee."` empty state for mega-committees with no KV entry. candidate.html continues to use the live paginated API (candidate committees never hit the mega threshold).
- **Top Conduit Sources** — platforms like ActBlue and WinRed that forward individual contributions to the committee. Surfaced as a separate table because the money is legally the individuals', not the platforms' — conflating them misrepresents both categories. Sourced from Schedule A `memo_code='X'` entries in a second aggregation pass over the same fetch.

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

- **Spend timeline on Spent tab (candidate + committee):** A spend-over-time line chart parallel to the Raised tab's chart. Deferred from Phase 1 — the category/purpose/vendor breakdown is sufficient for current use. Add when the Raised chart pattern is ready to be reused across both pages.

- **Candidate and committee filings** — surfacing formal FEC documents (statement of candidacy, other filed documents) on candidate and committee profile pages. Likely low value for strategists — this is closer to backend recordkeeping that the FEC itself already surfaces well. Backlogged pending validation with John on whether this data is useful in context.

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

- ~~**Raised tab**~~ ✅ live — contributor breakdown, top donors, geography heatmap
- ~~**Spent tab**~~ ✅ live — category breakdown, purpose bars, vendor table (spend timeline deferred to backlog)
- ~~**Associated committees**~~ ✅ live — header modal with Active/History tabs, leadership PAC via `sponsor_candidate_id`, JFA participant gap acknowledged with transparent UI note.
- ~~**Data freshness indicators**~~ ✅ live — coverage end dates shown on summary stats and data notes across all profile pages
- ~~**Empty / zero-data states**~~ ✅ live — tables handle empty arrays; graceful fallbacks throughout
- ~~**Error states**~~ ✅ live — try/catch throughout, error messages rendered inline
- ~~**Design system page**~~ ✅ live — living reference, actively maintained
- ~~**Mobile chart**~~ ✅ live — responsive via Chart.js settings, grid collapses at 860px

### Phase 2 — Make it navigable
*Goal: a user can find any candidate, not just one you link them to.*

- ~~**Search**~~ ✅ live — covers candidates and committees (exceeded original scope); races not yet searchable
- ~~**Search results page**~~ ✅ live — both entity types, grouped results
- ~~**Candidates browse page**~~ ✅ live — unified browse+search on one surface; typeahead, filter chips (office/party/state/cycle), URL sync, error state with retry
### Phase 3 — Expand the data model
*Goal: show the full money ecosystem, not just the candidate.*

- ~~**Committee page**~~ ✅ live — Summary/Raised/Spent tabs live; contributor breakdown, choropleth, vendor table, contributions-to-candidates section
- ~~**Committees browse page**~~ ✅ live — unified browse+search; typeahead, filter chips (type/state), URL sync, treasurer always shown, error state with retry
- ~~**Race page**~~ ✅ live — single contest view; all declared candidates auto-populated from `/elections/` with financial cards and cycle switcher
- ~~**Races browse page**~~ ✅ live — filter bar (year/office/state), progressive enrichment via IntersectionObserver, localStorage cache (24h TTL), stale-response guard
- ~~**Associated committees**~~ ✅ live — committee links in modal and contributions section point to `/committee/{id}`
- ~~**Filing feed**~~ ✅ live — monitoring page showing recent candidate committee filings (F3/F3P); load-all-upfront architecture with client-side office/report-type/time-window filters; refresh with dedup; scoped to candidate committees only (H/S/P office field); future scope may expand to all committee types

### Phase 4 — Differentiation features
*Goal: reasons to return; things OpenSecrets doesn't do.*

- **Early signal data** — 48/24-hour reports surfaced on candidate pages; strongest repeat-usage driver
- **AI insights** — 2–3 sentence plain-language narrative on candidate and race pages, generated on load
- **Transactions search** — FEC-style linked data; useful but not differentiating; lower priority than above
- **Browse receipts** - Filing history and transaction-level browsing are deferred — the intended solution is a 'Browse receipts' affordance (button in profile header) that links to a filtered transaction browse page, applicable to both candidate and committee profiles. Not a tab or inline table.
- **Candidate comparison builder** — a tool for assembling any set of candidates across races for side-by-side comparison; designed for consultants tracking multiple frontline races simultaneously (John's use case). Distinct from the race page — no single contest anchors it, entry point and URL structure are TBD.
- **Independent expenditures (Schedule E)** — outside spending for or against a candidate, surfaced in two places: (1) on candidate pages (Summary tab), showing all committees making IEs targeting that candidate, with support/oppose breakdown; (2) on committee pages (Spent tab), as a drill-down behind the existing `independent_expenditures` line item in the spending donut — showing which candidates the committee is targeting and in which direction. Particularly meaningful for leadership PAC and super PAC profiles where IEs are the primary political activity. Endpoint: `/schedules/schedule_e/`; `support_oppose_indicator: 'S'` = supporting, `'O'` = opposing. Field shapes unverified — verify against live response before building.
- **Refund spike detection** — flag unusual outflows in `contribution_refunds` on the candidate/committee Raised tab as a potential signal of donor retreat or compliance issues. Threshold for "spike" requires validation with John before implementation.
- **Overhead ratio (committee pages)** — derived metric on the committee Spent tab: `operating_expenditures / total_disbursements`. High ratios may indicate a committee oriented around consultant fees rather than political impact. Threshold requires validation — do not hardcode without John's input.
- **Dark money signals** — flag Schedule A receipts where `entity_type: 'ORG'` and contributor name contains LLC or INC as potential non-disclosing entities. Surfaces in two places: (1) on candidate pages (Raised tab), flagging dark money contributions to the candidate's principal committee; (2) on super PAC committee pages, flagging dark money flowing into the PAC itself. Heuristic approach — validate signal reliability and non-partisan framing with John before building.

---

## Gaps to Address (no phase assigned yet)

- **The name** — "Ledger" appears in the process log nav but hasn't been committed to. Name and domain matter for portfolio presentation and user perception.
- **UI, interaction, and accessibility** — needs a holistic pass; not scoped to a single phase. Accessibility standards, motion design, touch targets, color contrast, keyboard navigation.
- **House / Senate browsing pages** — filtered search results serve this function for MVP; revisit post-Phase 2.

---

## Infrastructure / Architecture debt

- ~~**Server-side API proxy**~~ — ✅ **Done (2026-04-14).** Migrated from Netlify to Cloudflare Pages. FEC API calls now route through `functions/api/fec/[[path]].js`; API key stored as a Cloudflare secret, no longer client-visible. Remaining work: server-side *caching* for races.html enrichment calls (Cloudflare KV). The mega-committee Schedule A aggregation problem was closed by Session 3 (2026-04-19/20) via the pre-computed bulk pipeline (pas2 + indiv → DuckDB → KV) — see CLAUDE.md roadmap.

- ~~**Bulk data pipeline (pas2)**~~ — ✅ **Done (2026-04-16).** `pipeline/` Cloudflare Worker downloads pas222/24/26 from FEC bulk downloads weekly (cron `0 6 * * 1`) and writes pipe-delimited CSVs to R2 bucket `fecledger-bulk` at `fec/pas2/{year}/pas2.csv`. Worker requires Workers Paid plan ($5/mo) for cron triggers. **Not covered:** indiv22/24/26 individual contribution files (~4.5 GB uncompressed each) exceed Cloudflare Workers' 128 MB memory cap and CPU time limit — these require GitHub Actions (ubuntu runner, no memory/CPU cap, free for public repos, R2 auth via Cloudflare API token). R2 key pattern `fec/indiv/{year}/indiv.csv` is reserved; streaming code is complete in `pipeline/src/index.js` and just needs a new runtime wrapper.

- **Pages project is Direct Upload, not git-connected** — Discovered 2026-04-17 when a binding change (Session 4B AGGREGATIONS) failed to activate after pushes. The `fecledger` Pages project was created via `wrangler pages deploy` during the 2026-04-14 Netlify migration, which produces Direct Upload projects by default. Git pushes to main do not trigger deploys; every deploy must be manual via `npx wrangler pages deploy <staging-dir> --project-name=fecledger --branch=main`. The project has no Builds & deployments settings section in the dashboard (the visible absence is the tell).

  **Cloudflare architectural constraint:** Direct Upload and Git-connected cannot be converted in-place. The fix requires creating a new Pages project with a git connection, re-attaching bindings and secrets, and cutting over. Rough scope: 1–2 hours of focused work.

  **Migration steps:**
  1. Dashboard → Workers & Pages → Create → Pages → **Connect to Git** (this OAuth flow is the only way to produce a git-connected project; CLI-created projects are always Direct Upload). Select the `fec-project` repo, production branch `main`.
  2. Configure bindings: re-add `AGGREGATIONS` → `fecledger-aggregations` (the KV namespace itself is separate from the project and does not need to be recreated). Re-add `API_KEY` as a secret.
     - **Gotcha:** Cloudflare secrets are write-only; you cannot read the existing `API_KEY` value from the current project. Have the FEC API key value from your password manager, email, or api.data.gov before starting — otherwise a new key has to be provisioned.
  3. Solve the deploy surface problem. Without intervention, a git-connected Pages project uploads the *entire repo* — including `scripts/`, `pipeline/`, `tests/`, `CLAUDE.md`, `claude-to-claude.md`, etc. This is the same leak risk addressed by our current `rsync --exclude …` staging pattern. Two reasonable approaches:
     - **Build command does the staging.** Commit a `deploy/stage.sh` that rsyncs site content into `deploy/dist/`. Set Pages build command to `bash deploy/stage.sh`, output directory to `deploy/dist/`. The exclusion list lives in version control and is auditable.
     - **Monorepo restructure.** Move non-site files under a `workspace/` directory, leave site files + `functions/` at root, set Pages root directory to a clean site subdirectory. Cleaner long-term but invasive (import paths, CI configs, Playwright paths all change).

     The build-script approach is lower risk.
  4. Test the new project's preview URL end-to-end before cutover: landing → `/search`, `/candidate/H2WA03217`, `/committee/C00806174`, `/api/fec/*` proxy, AGGREGATIONS binding.
  5. URL cutover — three options:
     - **Accept new subdomain** (e.g. `fecledger-git.pages.dev`) — fastest; update references in `CLAUDE.md`, `playwright.smoke.config.js`, `ia.md`, and any shared links, then delete the old project.
     - **Reclaim `fecledger` subdomain** — delete the old project, wait ~24h for Cloudflare to release the name, recreate with that name. Timing risk; cooldown is not well-documented.
     - **Wait for a custom domain** — if a real domain is acquired (already on the project-brief Go-live list), the custom domain decouples URL from Pages subdomain. Point the new domain at the new project, delete the old. Cleanest long-term; requires a domain first.
  6. Delete old `fecledger` Direct Upload project.
  7. **Lock in the lessons (prevents recurrence).** Before closing the migration session:
     - Push a trivial site change (e.g. a whitespace edit to `index.html`) and watch the Deployments tab. Confirm a new deployment appears with the expected commit hash, and confirm the change is live on the URL. Do not skip this — "the site is live" and "new pushes actually deploy" are two separate states, and conflating them is how we got here in the first place.
     - Update CLAUDE.md's deployment note with **verified** state, not assumed state. Format: "Deploys via git — verified on `<date>` by pushing a change and watching the Deployments tab." This replaces the stale "auto-deploys on push to main" assumption that went unchecked for 3 days.
     - Delete the `Option B` manual-deploy rsync instructions and any references to `npx wrangler pages deploy` in CLAUDE.md and claude-to-claude.md. Future sessions should find one deploy path, not two.
     - Add a pre-delete safeguard note to CLAUDE.md or this file: before deleting any Cloudflare Pages project in the future, confirm it is not the currently-live production site by visiting its `.pages.dev` URL and checking against the expected content. (The migration below walks this correctly, but the general rule is worth recording.)

  **Timing recommendation:** Do this after Session 3 (committee.html wiring). Session 3 can ship via the current manual deploy flow; the git migration is yak-shaving before user-visible progress and bundles naturally with a custom-domain purchase if that's near-term.

  **Root-cause summary for future reference:** The Pages project was created via `npx wrangler pages deploy` during the 2026-04-14 Netlify migration. That CLI path produces Direct Upload projects with no git linkage — there is no "upgrade to git-connected" option after creation. The only way to produce a git-connected Pages project is the Dashboard → Create → Pages → **Connect to Git** OAuth flow. For any future Pages project creation, prefer the dashboard flow unless deliberately choosing Direct Upload.

---

## Open items (not prioritized)

- **Tooltip UI debt** — Party tags currently use the native `title` attribute for tooltips (e.g. "Democratic Party", "No party affiliation on file"). Works on desktop but invisible on touch, unstyled, and has a ~1s browser-imposed delay. When doing a mobile polish pass, replace with a CSS-only `data-tooltip` pattern (pseudo-element, no JS, no library) for full control over appearance, timing, and touch support. Affects party tags on candidates.html, search.html, and candidate.html.
- **Default sort for browse mode (candidates + committees)** - Currently sort=name. Ideally sort=-receipts for discovery, but FEC API blocks it without a q= param. Date-based alternatives (last_file_date, load_date, first_file_date) are either invalid sort fields or null-heavy, producing useless ordering. Options: default to election_year=2026 filter to narrow the browse set meaningfully, or revisit when the Netlify proxy is in place (server-side could pre-filter or cache a sorted set). Not urgent but intentionally deferred. *noted, but this might not be as much of an issue when it stops being a top-level page and acts as a landing after kicking off search*
- **Primary losers in active cycle candidate counts** — The FEC API does not filter out candidates who lost a primary from the /elections/ endpoint results. Challenger counts and race pages will overcount active candidates mid-cycle (between primary and general). Fixing this requires cross-referencing election results data, which the FEC API does not provide — likely requires a third-party data source. Noted as a known gap; acceptable for now.

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
- **Committee profile:** For a leadership PAC profile, which section do strategists care about more — the sponsor relationship, or the list of candidates receiving money? *(Validate with John)*
- **Committee treasurer visibility:** Treasurer names are currently shown in committee browse results. For opposition research workflows, tracing a treasurer's network across multiple committees may be valuable — but this is a narrow secondary use case. Is treasurer-level data worth surfacing on committee profiles or in search, and if so, in what context? *(Validate with John)*

---

## Definitions

- **Committee:** Legal entity (business); any PAC, candidate committee, or any legal entity allowed to raise or spend money
- **JFA (Joint Fundraising Committee):** Allows multiple committees to raise together. Note: there is an important distinction between a candidate who is the *organizer* of a JFA (queryable via FEC API) and one who is merely a *participant* (not queryable — only surfaced in F2 filings).
- **Leadership PAC:** A political action committee sponsored by an elected official or candidate, separate from their principal campaign committee. Used to donate to other candidates and build political relationships. Queryable via `sponsor_candidate_id` in the FEC API.
- **JFA participant gap:** JFA committees where a candidate participates (but is not the organizer) have no `candidate_ids` or `sponsor_candidate_ids` in the FEC API. They don't appear in standard committee queries — only surfaced in the candidate's F2 Statement of Candidacy filing.
- **Hybrid PAC (Super PAC):** Allowed to have an unlimited IE side (soft side); there's a hard side also, with a wall between soft and hard
- **Spend-down rate:** The pace at which a campaign is depleting its cash reserves, particularly relevant in the final weeks before an election
- **Raised-to-spent ratio:** Total receipts divided by total disbursements for a cycle; a signal of financial efficiency and health (preferred framing over "burn rate" per John)
- **Independent Expenditure (IE):** Spending by a committee to support or oppose a candidate, made without coordination with the candidate's campaign. Reported on Schedule E (`/schedules/schedule_e/`). The `support_oppose_indicator` field distinguishes direction: `'S'` = supporting the candidate, `'O'` = opposing. Relevant for surfacing attack vs. support spending on candidate and race pages (Phase 4).
- **Employee aggregates vs. PAC money:** Individual contributions from employees of a corporation or union are legally distinct from that organization's PAC contributions. Do not imply corporate funding from employee donation patterns. The Raised tab must clearly separate "Corporate/Labor PAC" (hard money, capped at $5k) from "Individual" contributions — even when those individuals share an employer.
- **Contributions to Candidates & Committees:** Outbound political giving from a committee to other federal candidates and committees, reported on Schedule B (`entity_type: CCM`). Particularly relevant for leadership PACs and party committees, which exist partly to funnel money to allied candidates. Surfaced as a dedicated section on the committee Spent tab — distinct from operating expenditures (vendors/staff/media).
- **Conduit platform:** A registered committee that forwards individual contributions to other committees without acting as the contributor itself. Examples: ActBlue (Democratic), WinRed (Republican), Anedot. Under FEC reporting rules, an earmarked conduit contribution is attributed to the original individual donor on the main Schedule A line (entity_type=IND), with the conduit committee appearing only as a `memo_code='X'` memo entry annotating the lineage. The memo and the main row represent the same money — counting both double-counts. FECLedger surfaces conduit flow as a dedicated "Top Conduit Sources" table on candidate.html and committee.html Raised tabs, distinct from "Top Committee Contributors" (which shows committees giving their own money). Labels make clear that conduit amounts represent individuals' money, not the platforms' own funds.
- **Memoed transaction (`memo_code='X'`):** FEC Schedule A/B field that flags itemization detail rather than standalone money movement. Memos annotate conduit contributions, JFA sub-itemization, and other structural relationships. Must be excluded from any manual total or double-counting occurs. The `_ytd` fields on the totals endpoint already handle memo exclusion internally; direct Schedule A/B aggregation must filter `memo_code === 'X'` explicitly.
- **Mega-committee:** Informal term for committees whose Schedule A volume exceeds what client-side pagination can handle — measured threshold ~100 pages at per_page=100. Examples: ActBlue (measured 11,163,722 rows / 111,638 pages in 2024), WinRed, DNC/RNC/NRSC/DSCC/DCCC/NRCC. For these committees, FECLedger's Top Committee Contributors and Top Conduit Sources tables show an "Unable to show top committees due to high transaction volume" empty state on committee.html until the server-side aggregation architecture lands (see `strategy/hosting-migration.md`). Candidate.html doesn't hit this limit because candidate committees have bounded incoming committee-to-committee transfer volume.

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
