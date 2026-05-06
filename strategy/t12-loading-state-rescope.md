# T12 — Loading-state polish (rescoped from lazy-fetch)

> **EXECUTED 2026-05-05 (commits `f496351` T12 + `ef377d0` T12.5 + `ba1eee8` donut skeleton + `506480a` skeleton refactor + `c1add5a` contributions polish + `ea81ff4` committee-row consolidation + `d8ff951` modal section-title spacing).** Original T12 plan was to defer Raised/Spent fetches from cycle-load eager to tab-click lazy. Latency investigation surfaced 5–25s Schedule A non-individual fetches on principal CCs (cold cache). Lazy-fetch would expose that latency to the user as a visible skeleton from click time; eager-fetch hides it behind Summary-tab attention. The arc rescoped to loading-state polish only — substantive skeletons, per-tier error UI, 429-aware messaging, init-stage failure bridging — and the lazy timing change was deferred. Doc retained as a banking record so a future "lazy fetch" attempt sees the diagnostic discipline + decision rationale.

---

## Context

Pre-T12, candidate.html and committee.html eager-fetched Raised + Spent tab data on every cycle load. The plan was T12 = defer those fetches to tab click, freeing 4–13 API calls per cycle load for users who never click Raised/Spent.

The original prompt asked for diagnostic-first treatment: investigate latency, recommend the design, then implement. The investigation found:

1. **Schedule A `is_individual=false` page 1 latency is 5–25s on principal CCs** (cold cache; varies with FEC-side load balancing). Pelosi's principal CC was 24.6s once, then 0.13s on warm — FEC load-balancers serve from independent caches. Marie's principal CC was 6s consistently. DCCC was 0.6s → 9.4s → 9.9s on three back-to-back runs.

2. **Mid-tier committees that paginate fully (≤100 pages) take longer than mega-committees that bail.** MAGA PAC at 14 pages × 1.7s ≈ 24s. CLF at 13 pages × 3s ≈ 39s. Marie's principal CC bails at PAGE_THRESHOLD=100 → 1 page fetch. So the "expensive" committees today actually cost less than the ones that don't trigger the bail-out.

3. **By_state and KV reads are fast** (sub-300ms typical). Donut data is in memory from totals (no fetch). So the Raised tab has a clear fast/slow split:
   - **Fast tier:** by_state choropleth + (committee.html) KV-backed top individuals + top committees
   - **Slow tier:** Schedule A non-individual pagination → top committees (KV-miss fallback) + top conduits (always)

4. **Spent tab is uniformly mid-tier** (1–10s typical, no clean split worth the complexity). Two parallel Schedule B paginated calls.

The **practical problem with lazy fetch** post-investigation: clicking Raised on Marie or Pelosi would show a substantive skeleton for 5–25s (sometimes longer on cold cache). With eager fetch, the user spends those seconds reading Summary; the fetch resolves in the background. Same total wait time; very different perceived UX.

## Decision

**T12 rescoped to loading-state polish.** Eager fetch behavior on cycle load stays as today. The new UI handles the case where the user clicks Raised/Spent before the eager fetch resolves: substantive skeletons, per-tier error UI, 429-aware messaging, 10s "still loading" augmentation.

**Lazy fetch deferred.** It becomes viable when the slow tier's underlying source extends to bulk-precomputed KV (top-committee-contributors and top-conduit-sources). With KV, fast tier covers everything; the Schedule A non-individual fetch becomes optional / fallback only. At that point lazy fetch saves API calls without exposing 5–25s waits.

## What shipped

### T12 (commit `f496351`)

`fetchRaisedData` split into two functions on each profile page:
- `fetchRaisedFastData(committeeId, subCycles)` — by_state + (committee.html: KV indiv + KV committees). Sub-second typical.
- `fetchRaisedSlowData(committeeId, subCycles)` — Schedule A non-individual pagination. 5–25s typical. Used for top conduits (always) + KV-miss fallback for top committees + top individuals.

Both kicked off in parallel from `loadCycle()` (candidate.html) / `renderStats()` (committee.html). Promises stored at module scope with race-token protection via `view.claimToken()` / `view.isCurrentToken()`.

`renderRaisedIfReady` became idempotent and progressive — each tier renders independently when its fetch resolves. Donut renders synchronously from totals data already in memory.

Per-tier skeletons (`.skeleton.tab-skeleton.skeleton-{donut,map,table,bars}` in styles.css) replace the previous single-spinner loading state. Per-tier error UI (`.tab-error` + `.tab-retry-btn`) with retry button. 10s "still loading" augmentation (`.tab-still-loading`) fires from a `setTimeout` keyed on fetch start.

Spent tab uses single-tier shape (one fetch). Inner try/catch removed from `fetchSpentData` so errors propagate to `spentError` instead of silently rendering empty tables.

### T12.5 (commit `ef377d0`)

`is429(err)` detector + `TAB_ERROR_RATE_LIMIT_MSG` + `TAB_ERROR_INIT_FAILURE_MSG` constants in utils.js. `showTabError(errorEl, err, defaultMsg)` helper inline on each profile page picks the variant:

- **Default** (network blip, server error) → generic copy + retry button
- **429** (`is429(err)` matches `'FEC 429'` in apiFetch's thrown error) → rate-limit copy ("⚠ FEC API rate limit reached. Please wait a minute, then reload the page."), retry button hidden
- **Init-stage failure** (`err.initStage === true`, set in `loadCycle()` outer catch) → init-failure copy ("⚠ Couldn't load this page. Please reload to try again."), retry button hidden

Init-stage bridging: candidate.html's `loadCycle()` outer catch sets `raisedFastError = raisedSlowError = spentError = err` (with `err.initStage = true`) and calls render functions so the tab-error UI surfaces. Without this bridge, kickoff functions sat after the awaited init calls that threw and never ran — skeletons held forever. Committee.html init failures already surface a page-level `state-msg.error` before tabs reveal; no bridging needed.

### Donut skeleton (commit `ba1eee8`)

Added `#raised-donut-skeleton` + `#raised-donut-content` toggle on Raised tab so the donut cell shows a skeleton during cycle-switch and cold-load. Previously the donut canvas was empty (no chart) during the brief loading window — visually inconsistent with the rest of the tab.

### Skeleton refactor (commit `506480a`)

All chart/table cells consolidated to **title-always-visible pattern**: section title (`.raised-cell-title`, `.donors-head`) renders immediately and stays visible during loading; only the chart canvas / table body area swaps between skeleton and content via per-section `*-skeleton` and `*-content` IDs.

Removed unified `#spent-skeleton-wrap` + `#spent-content` two-state toggle on Spent tab; replaced with per-section skeletons (`spent-donut-skeleton` + `spent-donut-content`, `spent-bars-skeleton` + `spent-bars-content`, `spent-vendors-skeleton` + `spent-vendors-content`).

Removed `border-bottom` from `.donors-head` — title-above-content reads cleaner without the line; the table's own `thead` border carries the visual separator.

### Contributions polish (commit `c1add5a`)

committee.html Spent → "Contributions to Candidates & Committees" — data note moved below the table; whole-row link via absolute `::before` overlay (native `<a>` semantics: middle-click, keyboard, screen reader).

### Committee-row consolidation (commit `ea81ff4`)

Single shared `committeeRowHTML(c, opts)` helper in utils.js. Three callers (candidate.html committees modal, /committees browse, /search results) all render the same shape. Removed `.committee-result-row`, `.committee-result-name`, `.committee-name-link` CSS rules. Modal lost its 3-column shape (committee-id no longer displayed) — deliberate trade for cross-page consistency.

### Modal section-title spacing (commit `d8ff951`)

`.modal-body .committee-row + .section-title { margin-top: var(--space-24) }` adjacent sibling — first title (preceded by `.modal-tabs`, not a row) correctly gets no extra margin.

## What's deferred

- **Auto-retry-with-backoff in `apiFetch`** — banked future polish. Pages Function proxy already passes through `Retry-After` headers. apiFetch could read it on 429, retry up to 2 times with backoff (cap ~5s), then surface to UI.
- **Lazy Raised/Spent tab fetches** — blocked on KV pipeline extension to top-committees + top-conduits. When those become bulk-pre-computed, the slow tier disappears and lazy becomes viable.
- **Server-side proxy caching at `functions/api/fec/[[path]].js`** — Phase 4 lift. Would collapse all visitor traffic into one cold fetch per TTL period.

## What's banked (process-level)

1. **Diagnostic-first ticket discipline.** The original T12 prompt asked for latency timing before the implementation plan. Without that step, the team would have shipped lazy fetch and immediately hit the "click Raised, wait 25s, see only the skeleton" UX hole. Latency timing is cheap; the rescope conversation it enabled saved a meaningful regression.

2. **Mid-investigation rescope is okay.** The original T12 plan was for lazy fetch. The investigation surfaced findings that changed the right answer. Rescoping mid-ticket — without abandoning the goal of "Raised/Spent loading-state UX" — is a normal part of diagnostic-first work. The rescope wasn't a failure; it was the diagnostic doing its job.

3. **The `memo_code=X` silent-ignore** (T11.5 banked finding, also documented in CLAUDE.md) — `apiFetch` thrown error messages now carry status codes that downstream UI can branch on. The shape `'FEC ' + status + ' — ' + path` is committed-to as a contract for `is429` and any future status-aware helpers.

## Files touched in this arc

candidate.html, committee.html, search.html, committees.html, utils.js, styles.css, design-system.html, tests/candidate.spec.js, tests/committee.spec.js, CLAUDE.md, test-cases.md, TESTING.md, claude-to-claude.md, strategy/t11-5-conduit-gate.md (closed earlier in arc), strategy/t12-loading-state-rescope.md (this file).
