# FECLedger — Hosting architecture strategy

*Prepared for Claude Chat strategy session. Self-contained; no prior context needed.*

---

## Context

FECLedger is a web-based campaign finance visualization tool built on the FEC public API. Currently hosted on Netlify as static HTML/CSS/JS with no build step. All FEC API calls happen client-side using a shared API key embedded in `utils.js`. The key has a 7,200 requests/hour limit shared across every visitor.

Two forcing functions are pushing the project toward server-side infrastructure:

1. **The FEC API key is exposed in client-side source code.** Anyone can scrape it from DevTools. It's a presentation concern as much as a technical one — a staff-designer portfolio piece that ships with a visible secret doesn't tell a strong craft story. Pre-launch priority.

2. **Client-side aggregation is architecturally impossible for a subset of committee pages.** The "Top Committee Contributors" table on committee profiles needs to walk FEC Schedule A to produce accurate totals. For typical committees this is fine (~25-50 API calls), but for conduits like ActBlue (measured 11,163,722 rows / 111,638 pages in 2024) and national party committees, client-side pagination would take hours or exhaust the entire API budget on one page load. Those pages currently show an empty state ("Unable to show top committees due to high transaction volume") — honest but unsatisfying.

The obvious next step was "add Netlify Functions as a server-side proxy." But before locking in that work, there's a **prior architectural question** that changes which host even makes sense.

---

## The architectural fork

The straightforward story is: "add a server-side proxy in front of the FEC API. Keep using the API for everything, just run it through your own server." This is the Netlify Functions path.

The less obvious story is: **the FEC publishes bulk data files** (candidate master, committee master, individual contributions, disbursements, committee-to-committee transactions, independent expenditures) at `fec.gov/data/browse-data/?tab=bulk-data`. These are downloadable flat files, refreshed on a schedule, with **no rate limit**. They contain the same underlying data as the JSON API.

Bulk data fundamentally changes the cost model for aggregation-heavy questions. ActBlue's Top Committee Contributors table goes from "walk 111,638 pages via the API (infeasible)" to "run a `GROUP BY` query over a local copy of Schedule A (milliseconds)." The mega-committee problem mostly evaporates.

**The fork is: API-only architecture vs. hybrid (bulk for analytics + API for reactive/fresh).** This choice upstream shapes everything — which host is right, what the ETL pipeline looks like, how long the work takes, what features become cheap.

Both paths are legitimate. The API-only path is simpler and more conservative. The hybrid path is how mature campaign finance tools (OpenSecrets, Follow The Money, Center for Responsive Politics) actually work, and is where the product likely ends up eventually regardless.

---

## Option A — API-only server-side proxy

**What it is**: a thin server layer in front of the FEC API. Browser calls your site, site calls FEC with the hidden key, caches responses in a key-value store, returns result. All data still comes from the FEC JSON API per visitor, though cache hits collapse repeat visitors into single upstream calls.

**Pros**:
- Smaller investment (~2-4 days of work to ship meaningfully)
- No new infrastructure beyond what Netlify Functions already provides
- Zero migration cost if you stay on Netlify
- Key is private; most pages behave the same as today, just with one server hop added

**Cons**:
- **Mega-committee aggregation remains architecturally infeasible.** You're still paginating the API, just from a server instead of a browser. Even with generous function timeouts, walking 111k pages of ActBlue data takes hours — this is bounded by FEC API response times, not by your host.
- You're still burning through the 7,200/hr FEC budget, just more efficiently via cache hits
- Leaves the Top Committee Contributors mega-committee empty state unresolved
- Doesn't meaningfully enable Phase 4 product features (AI insights over historical data, transaction-level search, custom historical comparisons) that benefit from owning a queryable copy of the data

**Phased implementation**:

1. **Phase A1 — Simple proxy (1-2 days)**: move FEC API calls from client to a serverless function that forwards with the hidden key. Immediate value: key secrecy. Pre-launch required.
2. **Phase A2 — Response caching (1-2 days)**: add KV cache on the proxy. Read-through pattern, 5-60 minute TTL depending on endpoint volatility. Cuts API usage dramatically for hot pages.
3. **Phase A3 — Per-surface aggregation walker (3-5 days per surface)**: for specific use cases (races.html enrichment, committee contributors), build a function that orchestrates API pagination server-side and returns a small pre-computed blob. Still bounded by FEC response times; still fails for mega-committees.

Phase A1 alone unblocks the portfolio-launch blocker (key secrecy). Phases A2–A3 are progressive improvements.

---

## Option B — Bulk data + hybrid architecture

**What it is**: a scheduled ETL pipeline downloads FEC bulk files on a cadence, parses them into a local queryable store (SQL database or columnar file format), and serves pre-computed aggregations from that store. The JSON API is still used for freshness-sensitive endpoints (filing feed, early signal reports, search, metadata lookups) — but heavy aggregation queries never hit the FEC API at all.

**Pros**:
- **Mega-committee problem solved completely.** ActBlue's top contributors become a SQL query — milliseconds, not hours.
- FEC API budget no longer a constraint for analytics surfaces
- Sets up Phase 4 features (AI insights over historical data, transaction-level search, custom metrics) at the architecture level
- Matches how mature campaign finance tools are actually built
- Refresh cadence is explicit and auditable — users know the data is "as of last Tuesday" with no ambiguity

**Cons**:
- Meaningfully more upfront work (~1-2 weeks for a proper ETL + query layer, realistically a bit more)
- Real infrastructure to operate: object storage, database or columnar store, scheduled jobs, monitoring
- Data freshness is limited by bulk cadence (weekly for contributions/disbursements per general knowledge; needs verification). Freshness-sensitive features still need the API as a second path.
- More moving parts, more possible failure modes (what happens when an ETL run fails silently?)
- Bulk data ingestion is a genuine backend skill set — schema knowledge, data cleanup, entity normalization, refresh orchestration

**What bulk data does NOT solve** (and still needs the API):
- **Freshness** — filing feed, 48/24-hour early signal reports, post-filing quickness. Bulk is batch, not streaming.
- **Convenience lookups** — endpoints like `/candidate/{id}/committees/`, `/committees/?sponsor_candidate_id=`, `/reporting-dates/`, `/elections/`. Ergonomic shortcuts that would be painful to reconstruct from bulk files.
- **Search** — name-based fuzzy search via `/candidates/search/`. The API does this well; no need to replicate.

**The architecture is explicitly hybrid**: bulk-backed store for analytics surfaces, API (via proxy) for fresh and reactive data.

**Phased implementation**:

1. **Phase B1 — API proxy for key secrecy (1-2 days)**: same as Phase A1. Move the client-side API key off the client. Pre-launch required. Orthogonal to the bulk data question.
2. **Phase B2 — API response caching (1-2 days)**: still valuable for the endpoints you keep on the API side (search, metadata, fresh data). Lower priority than Phase B1.
3. **Phase B3 — Bulk data ingestion + queryable store (1-2 weeks)**: the architectural piece. Download bulk files on a cadence, parse into a store, expose query functions for top contributors / top vendors / top conduits / historical aggregations. Rewrite affected page fetch logic to hit new aggregation endpoints instead of direct FEC API.
4. **Phase B4 — Early signal data (unchanged from original roadmap)**: 48/24-hour reports via the API, because freshness matters.

Total calendar time is larger than Option A, but the investment lands differently — less "glue code for rate-limit avoidance," more "real data platform unlocking future features."

---

## How host evaluation shifts depending on the path

### Must-haves for both paths

1. Serverless / edge functions
2. Environment variables and secrets management
3. Static asset hosting with rewrite / redirect rules (clean URLs are currently defined in `_redirects`)
4. Automatic HTTPS, custom domain, git-based deploys
5. Generous free tier or predictable paid tier
6. Local dev simulator (`netlify dev`, `vercel dev`, `wrangler dev`)
7. Deploy previews per branch

### More important if Option A (API-only)

- Concurrent function invocation limits — the hot path hits FEC per visitor after a cache miss
- Long-running function support for the Phase A3 server-side aggregation walker
- Key-value cache (Netlify Blobs, Cloudflare KV, Vercel KV, Upstash)
- Edge compute performance — matters more when requests flow through functions on every page load

### More important if Option B (bulk + hybrid)

- **Object storage** (R2, Netlify Blobs, S3-compatible) for holding raw bulk files
- **A real database or columnar query layer** (Cloudflare D1, Vercel Postgres, Neon, PlanetScale, or DuckDB-over-object-storage)
- **Long-running scheduled jobs with generous execution limits** — the ETL pipeline needs to download, decompress, parse, and load hundreds of MB. Needs meaningful runtime headroom beyond typical short-lived serverless functions.
- **Data transfer pricing** — ingesting bulk files is bandwidth-heavy; hosts with egress-friendly pricing (notably Cloudflare R2) are materially cheaper
- Read concurrency / request handling concerns are *less* important in this path because most page loads hit your own database, not a function calling upstream APIs

### Long-term feature enablement (either path, weighted more for Option B)

- **AI/LLM integration options** — matters more if Phase 4 AI insights are on the roadmap. Cloudflare Workers AI and Vercel AI SDK bundle this; others leave you to bring your own.
- **Full database options** — even if not needed at launch, what's the path to adding one later?

---

## Candidate hosts to evaluate

**Netlify (current)**. Has all the basics plus Netlify Blobs (KV store), scheduled functions, background functions (beta). Generous free tier. Familiar operational model. Zero migration cost.

- **Option A fit**: excellent. Exactly what Netlify is built for.
- **Option B fit**: possible but not where Netlify shines. Netlify Blobs + an external database (Neon, Supabase) could work, but ergonomics aren't as clean as bundled platforms.

**Cloudflare Pages + Workers + R2 + D1**. The most technically interesting fit for this project. Workers have <10ms cold starts, KV storage built-in, Cron Triggers for scheduled work, R2 for object storage (no egress fees — unique among major hosts), D1 for SQL. Very generous free tier. Workers AI for future ML work.

- **Option A fit**: strong. Workers + KV is a clean proxy+cache pattern.
- **Option B fit**: strongest of any host. There's an emerging pattern of running **DuckDB inside a Worker querying Parquet files directly in R2** — no separate database server to operate, analytical SQL on top of cheap object storage. Almost ideal for this use case. Worth researching as a specific pattern if you go this direction.

**Vercel**. Similar feature set to Netlify with a slightly different flavor. Vercel KV, Vercel Postgres, strong DX, AI SDK. More expensive at scale than Cloudflare. Next.js integration is irrelevant for a vanilla HTML project.

- **Option A fit**: fine, comparable to Netlify.
- **Option B fit**: works well with Vercel Postgres, but generally more expensive than Cloudflare equivalents for the ETL + storage workload.

**Traditional server hosts (Fly.io, Railway, Render)**. Long-running process model rather than serverless. A small Postgres + nightly cron is mature, well-trodden territory. You give up serverless purity but gain predictable pricing and operational simplicity.

- **Option A fit**: fine but overkill. You don't need a persistent server for a thin proxy.
- **Option B fit**: becomes much more viable when bulk data is in play. Managing ETL + database feels more natural on a traditional host than a serverless platform. Probably the *simplest* Option B path for someone new to backend ops.

### Honest recommendation

- **If you commit to Option A (API proxy only)**: Netlify remains the right host. Migration cost isn't justified.
- **If you commit to Option B (bulk + hybrid)**: Cloudflare Pages is the most attractive option — free tier covers the use case, R2 + D1 + Workers + Cron Triggers is the best bundled fit, and the DuckDB-over-R2 pattern is a unique technical advantage. A traditional host (Fly.io, Render) is a defensible second choice if the Workers runtime model feels constraining.
- **If you're undecided between options**: move to Cloudflare now, because it supports either path well and you won't need to migrate again later.

---

## Things a non-engineer might not be thinking about

1. **The FEC API is free but the shared key is the real constraint.** 7,200 req/hour, shared across every visitor. A proxy doesn't eliminate the limit — it just makes you less likely to hit it via cache hits. Bulk data bypasses the limit entirely for the analytics surfaces.

2. **Private keys aren't really private until you move them server-side.** Any key in client-side JavaScript is visible in DevTools. This is a presentation concern as much as a technical one — a staff-level portfolio piece leaking secrets in plain sight is a red flag to reviewers.

3. **Cache invalidation is a real problem.** If you cache aggregated data for 24 hours and the FEC publishes a correction, users see stale data until expiry. Be explicit in the UI: "Data updated daily" — set the expectation rather than hide it.

4. **The FEC API is the bottleneck, not your host.** Even with a perfect server-side proxy, you're still limited by how fast the FEC API responds. Page-1 latency for ActBlue measured at 16 seconds. This is why Option B is fundamentally different from Option A — bulk data removes the FEC API from the critical path of analytics queries.

5. **Bulk data ingestion is a real skill, not a trivial add-on.** File schemas, handling NULLs, entity name normalization, refresh orchestration, detecting when the FEC changes a file format. Budget for this learning curve if going Option B. That said, it's well-understood patterns at the senior backend engineer level, not exotic work.

6. **Operational reliability matters differently in each path.** Option A's failure modes are mostly "cache is empty, fall through to API." Option B's failure modes include "ETL pipeline silently failed, data is stale, users don't know." Option B needs actual monitoring and alerting.

7. **Platform lock-in vs. portability.** The more you rely on host-specific features (Netlify Blobs, Cloudflare KV, Vercel-specific bindings), the harder it is to switch later. An abstraction layer (`cache.get()` / `cache.set()`) keeps you portable even when the underlying store changes. Worth building in even if you stay on one host.

8. **Testing serverless functions locally is harder than testing static pages.** Today, `python3 -m http.server 8080` just works. Post-proxy, you need the host's dev simulator. Your Playwright tests will also need awareness of the proxy — either mocked at a different layer, or the test setup spins up a local proxy.

9. **Cost surprises come from bugs, not from traffic.** Free tiers cover small traffic. The usual way to blow up your bill is a stuck loop in a function racking up billable minutes, or a cache miss storm, or an ETL job that downloads the same file 100 times a day. Cost transparency dashboards matter more than absolute pricing.

10. **Migration cost is operational, not just code.** DNS records, SSL, env vars, redirects, build commands, test infrastructure. Budget a day even for a clean migration. Test on a temporary subdomain before swapping DNS to avoid downtime.

11. **This is a one-way door architecturally.** Going from "pure static" to "static + proxy + caching + ETL" is a commitment. Rolling it back would be painful after features depend on it. Decide which things run client-side forever (charts, tabs, local state) and which run server-side (FEC key, aggregation cost >1s). Draw the line on purpose.

12. **Portfolio narrative matters.** A designer's portfolio that "ships insecurely for convenience" tells a different story than one that "makes deliberate infrastructure choices." The proxy work isn't just technical debt — it's part of the craft story you're telling. Whichever way you go, it's worth documenting the *why*.

13. **Phase 4 features change the math significantly.** If AI-generated insights, transaction-level search, and "early signal" 48/24-hour reporting are real roadmap items, the proxy work isn't just for FEC API access — it's the foundation for all compute features. That significantly raises the value of Option B *and* of picking a host with good compute/AI integration (Cloudflare Workers AI, Vercel AI SDK).

14. **Freshness expectations should be set explicitly with users.** If Option B, add "Data refreshed weekly" copy to the relevant surfaces. Users accept staleness if it's labeled; they lose trust when it's hidden.

15. **"Bulk-backed tool" is a category leap.** Today FECLedger is a "nicer front-end for the FEC API." Option B turns it into a "custom data platform for campaign finance analytics." That's a different kind of product, with a different ceiling. It's also the direction the mature players in this space (OpenSecrets, Follow The Money) already took. This is a competitive positioning question as much as a technical one.

---

## Things to verify before committing

I'm reasonably confident about the conceptual framing above but didn't check live before writing. Worth confirming:

1. **Bulk data refresh cadence per file type.** Believed to be weekly for contributions and disbursements, nightly for some metadata, but the FEC data browser will have the definitive schedule.
2. **File sizes per cycle.** Estimating hundreds of MB per large file based on general recall; could be materially bigger or smaller.
3. **File format specifics.** Pipe-delimited with separate header files, from memory. Worth confirming.
4. **Whether there's an incremental refresh mechanism** ("what changed since date X") or whether each refresh requires re-downloading the full cycle file. Incremental would meaningfully cut ETL cost.
5. **Whether the FEC's bulk files include Schedule A conduit memo entries** (`memo_code='X'`). The Top Conduit Sources surface depends on these. If bulk data excludes memos, that surface still needs the API.
6. **Cloudflare Workers execution limits for long-running work.** Workers have CPU time limits that might or might not accommodate parsing a large bulk file in one invocation. The DuckDB-over-R2 pattern partially sidesteps this by querying files directly without loading them into memory.
7. **Total size of D1 (or Neon / Vercel Postgres) on free tier.** Free-tier SQL databases cap out somewhere; need to know if a full cycle of Schedule A data fits, or whether you need to aggregate down before storing.

These are 30-60 minutes of research items before committing, not dealbreakers.

---

## Open questions to bring to Claude Chat

1. **Architecture decision**: Option A (API proxy only) or Option B (bulk + hybrid)? What's the signal that tips it one way?
2. **Host decision**: given the answer to #1, which host is best? Is a Netlify → Cloudflare migration worth the operational cost?
3. **Timing**: is Phase 1 (key secrecy) pre-launch-critical? Which phases can be post-launch?
4. **Phase 4 roadmap reality check**: are AI insights, transaction-level search, and 48/24-hour early signal reports actually on the roadmap, or "maybe someday"? If real, Option B gets much more attractive.
5. **Migration risk appetite**: the site has 416 passing tests, live at `sloanestradley.netlify.app`. Any migration has non-zero breakage risk. What's the tolerance for a day of potential downtime in exchange for long-term flexibility?
6. **Operational appetite**: Option B introduces real infrastructure to operate (ETL pipeline, database, monitoring). Is that a fit for your time and interest, or a drag you'd rather avoid?
7. **Positioning question**: does moving to a bulk-backed architecture change how FECLedger *presents itself*? "Nice FEC frontend" vs. "independent campaign finance data platform" are different product stories. Is the latter one you want to tell?
8. **What am I oversimplifying?** What's the one thing a non-engineer asking this question is most likely to miss?

---

## Current state details (for Claude Chat reference)

- **Stack**: vanilla HTML/CSS/JS, no build step, Chart.js 4.4 for charts, Google Fonts
- **Deploy**: Netlify auto-deploy on push to main, `_redirects` for clean URLs, Pretty URLs enabled (site setting)
- **Test suite**: Playwright 416 structural tests (mocked FEC), 5 live-API smoke tests
- **API strategy today**: client-side in `utils.js`, shared 7,200/hr key, `MAX_CONCURRENT=4` client-side concurrency queue in `apiFetch`
- **Existing mitigations already in place**:
  - `races.html` uses IntersectionObserver + 24h localStorage cache (reduces per-visit API calls from ~475 to ~15–35)
  - `committee.html` Top Committee Contributors uses an adaptive 100-page gate to avoid runaway pagination on mega-committees, showing a "Unable to show top committees due to high transaction volume" empty state when exceeded
  - `candidate.html` paginates Schedule A to full exhaustion across all sub-cycles (House 2-year, Senate 6-year, Presidential 4-year). Honest totals, bounded by real-world fundraising limits so page loads stay under ~10s even for Senate candidates.
- **Measured worst case**: ActBlue 2024 returned 11,163,722 non-individual Schedule A rows / 111,638 pages with 16-second page-1 latency — conclusively out of reach for client-side or API-based server-side aggregation
- **Memo handling**: conduit platforms (ActBlue, WinRed) appear in Schedule A as `memo_code='X'` entries with `entity_type='PAC'`. These are itemization metadata, not additional contributions. Recent work filters them from Top Committee Contributors totals (preventing double-counting) and surfaces them as a separate "Top Conduit Sources" table (preserving strategist visibility into platform-level flow). Both tables draw from the same Schedule A fetch in one aggregation pass.
- **FEC API quirks to be aware of** (relevant for any proxy/ETL layer):
  - `two_year_transaction_period` is sometimes silently ignored (e.g. on `/schedules/schedule_a/by_state/`) — always verify filter effectiveness on response counts
  - Repeated query params work for some endpoints (`form_type`) and not others (`committee_type`)
  - Cursor pagination key naming depends on sort field — `last_contribution_receipt_amount` + `last_index` for Schedule A sorted by amount; `last_disbursement_amount` + `last_index` for Schedule B similarly
  - Some endpoints (`/schedules/schedule_a/by_contributor/`) appear in the API docs but return 500s on reasonable queries — don't plan around them without live verification
