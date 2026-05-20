# committee.html init() refactor — scaffold visibility audit + proposal

**EXECUTED 2026-05-20 (commit `72a0a23`)** — Implemented as T-committee-init-defer-totals. `await totalsP` moved into `if (isDetailView)` branch; `totalsP.then()` populator at init() sets `ALL_TOTALS` + re-fires `renderStats` on cycle-row-click-during-load; empty-ALL_TOTALS guard at top of `renderStats`. +3 tests (588 → 591). Cross-page invariant established: **init() awaits only entity; totals is per-path** (helper's fetchIndexData on index, loadCycle on candidate detail, init's conditional await on committee detail). Banked items (localStorage cycle-list caching; column-header pre-entity shell) retained as not-in-scope.

---

**Status:** Diagnostic / proposal. Sloane review before any implementation.
**Date:** 2026-05-20
**Builds on:** T-load-4 arc (complete and shipped). Banked follow-up from T-load-4a.

---

## TL;DR

The committee.html init() flow has **one meaningful piece of refactor headroom on the index-view path**: the eager `await totalsP` before `view.switchTo` is unnecessary on index view (the scaffold doesn't need ALL_TOTALS — the helper's Promise.all awaits totals later, inside view.switchTo). Moving this await into a conditional `if (isDetailView)` branch lets the index-view scaffold render immediately after entity resolves, saving the entity-vs-totals max window.

**Honest payoff:** modest. On a cold cache where entity and totals are similarly slow (FEC API typical), the scaffold appears ~0–500ms earlier in practice. On the worst observed cold-cache cases (T-load-1 measurements: 14s totals, 43s entity), totals is faster than entity — meaning today's `await totalsP` is already a no-op (totals resolved before entity did) and the refactor saves nothing. The refactor wins only when totals is the slower call.

**The column-header-pre-entity shell idea explored but rejected:** rendering the cycle-index column header before entity is technically possible (zero data dependency) but the visual progression from "header only" → "header + skeleton rows" → "hydrated rows" is marginal vs today's "all skeletons appear together" pattern. Adds complexity without clear UX benefit.

**Detail-view path is genuinely entity-gated** — renderStats needs ALL_TOTALS, ALL_CYCLES, COMM_FIRST_FILE_DATE etc., all entity-derived. No refactor headroom there.

**Recommendation:** ship the index-path refactor as T-committee-init-defer-totals. ~15 LOC + careful test coverage of the cycle-row-click-during-load edge case. Honest scope. Skip the column-header pre-entity exploration.

---

## 1. Current init() flow — cold-cache bare-URL trace

committee.html init() steps (line numbers per 2026-05-20):

| Step | Line | What happens | Blocks on |
|---|---|---|---|
| 1 | 723–731 | `if (!COMMITTEE_ID) { error; return }` | sync |
| 2 | 733 | `history.scrollRestoration = 'manual'` | sync |
| 3 | 735–745 | T-load-3 sync hash-write for `#stat-cycle` (URL-hash-derived) | sync |
| 4 | 747–753 | RAF reveal `#committee-header` (skeleton fade-in) | sync (RAF) |
| 5 | 754 | `initPageLoadingTimers(state-msg)` | sync |
| 6 | 759 | `entityP = fetchEntity()` (fires; in-flight-promise cached) | sync |
| 7 | 760 | `totalsP = fetchAllTotals()` (fires in parallel) | sync |
| 8 | 763 | `await entityP` | **entity network round trip** |
| 9 | 765–767 | clear timers, hide state-msg | sync |
| 10 | 769–772 | `renderHeader(committee)` — sets `ALL_CYCLES`, `COMM_PARTY/TYPE`, `COMM_FIRST_FILE_DATE/LAST_FILE_DATE` | sync |
| 11 | 777–779 | parse hash → `hashCycle` / `isDetailView` | sync |
| 12 | 784 | `await totalsP` (typically resolved by now) | **0–N ms blocks if entity was faster than totals** |
| 13 | 785 | `ALL_TOTALS = totalsRes.results` | sync |
| 14 | 791–797 | `fetchAndRenderAssocSection` (fire-and-forget async; doesn't block) | sync (async fire) |
| 15 | 803–804 | `initCompactHeader` | sync |
| 16 | 810–813 | `initTabSection` | sync |
| 17 | 815+ | `initViewSwitcher(...)` → `view.switchTo` | sync until view.switchTo's awaits |
| 18 | inside switchTo | `renderIndexScaffold()` runs sync | sync |
| 19 | inside switchTo | `await Promise.all(fetchIndexData())` | totals network (typically cached/resolved by now) |
| 20 | inside switchTo | `renderIndex` hydrates | sync |

**The user-visible "scaffold visible" moment is step 18.** Today, this is gated on steps 8 + 12 (entity + totals max).

candidate.html's analogous flow gates step 18 on the entity await only. Totals is fired inside `view.switchTo`'s else branch via `fetchIndexData → fetchAllTotals`.

---

## 2. Scaffold visibility gating analysis

### What `renderIndexScaffold` reads (committee.html)

From the existing function (committee.html lines ~602–625):
- `COMM_FIRST_FILE_DATE`, `COMM_LAST_FILE_DATE` — for cstat-history entity-hydration (set in renderHeader, step 10)
- `ALL_CYCLES` — for cycle-row skeleton iteration (set in renderHeader, step 10)
- `setStatSkeleton` calls — no data dependency

**All of these are set in step 10 (post-entity).** The function genuinely needs entity data. No headroom to render `renderIndexScaffold` before entity.

### Shell-vs-rows distinction

| Element | Entity-derived? | Sync-renderable? |
|---|---|---|
| `#cycle-index` column header ("Cycle / Raised / Spent / Cash on Hand") | No — static text | Yes (zero data) |
| Archive divider position | Yes — `ARCHIVE_MIN_YEAR_COMMITTEE` is a constant, but inclusion depends on cycle list | Partial — could render unconditionally |
| Cycle rows | Yes — `ALL_CYCLES` from entity | No |
| Career-strip cells (cstat-history etc.) | Yes — entity dates | No |

The "column header only" pre-entity shell IS sync-renderable. But on its own, the visual progression "title + empty column header → title + column header + skeleton rows → hydrated rows" is marginal vs today's "title → all skeletons appear together → hydrated rows."

**Rejecting the column-header pre-entity exploration.** Adds complexity (separate render-shell function, separate visibility toggle, careful interaction with helper's show()) for a sub-frame UX nuance.

### The actual headroom: step 12's `await totalsP`

Step 12 only blocks when totals is slower than entity. On the FEC API, totals at `?per_page=100` is a 100-record fetch — typically faster than entity (single record) on warm cache, slower on cold cache for committees with deep history.

If totals is faster than entity (common warm-cache case), step 12 is a no-op (`await` on already-resolved promise = sync).

If totals is slower than entity (cold-cache committees with deep history, e.g., Gillibrand's PCC with 11 cycles), step 12 blocks for the difference.

**Realistic payoff range:** 0ms (totals already resolved) to several seconds (cold cache, deep-history committee).

### Why step 12 exists today

`ALL_TOTALS` (set at step 13) is read by `renderStats` on detail-view entry. If `view.switchTo` enters the detail branch and `loadCycle` → `renderStats` runs before `ALL_TOTALS` is populated, renderStats reads empty array → all stats resolve to dashes.

This is the architectural reason for the eager await. It's defensive against detail-view entry.

For INDEX view: `ALL_TOTALS` isn't read by the scaffold OR by the helper's renderIndex hydration (which reads from `data.totals.results` passed by the helper's Promise.all). The eager await is unnecessary on index path.

---

## 3. candidate.html comparison

candidate.html init() (lines 2226–2335):

| Step | What happens | Blocks on |
|---|---|---|
| 1 | URL guard, history.scrollRestoration | sync |
| 2 | T-cycle-semantics sync hash-write for `#stat-cycle` | sync |
| 3 | RAF reveal header | sync (RAF) |
| 4 | `initPageLoadingTimers` | sync |
| 5 | `await apiFetch('/candidate/{id}/')` | **entity** |
| 6 | Set CAND_* globals incl. ALL_CYCLES, CAND_FIRST_FILE_DATE | sync |
| 7 | hash parsing, isDetailView | sync |
| 8 | initCompactHeader, initTabSection | sync |
| 9 | `view.switchTo` | sync until awaits inside |
| 10 | inside switchTo: renderIndexScaffold sync | sync |
| 11 | inside switchTo: await Promise.all (totals fires here, in-flight cached) | **totals** (first fire) |
| 12 | renderIndex hydrate | sync |

**candidate.html does NOT fire totals before view.switchTo.** Totals fires inside the helper's `fetchIndexData → fetchAllTotals` path. On index path, this means totals fires inside the scaffold-then-hydrate flow.

Why does candidate.html not need an eager totals await? Because `loadCycle` on candidate.html fires its OWN totals fetch (with `cycle=Y&election_full=true`) when detail-view entry happens. The cycle-detail data isn't read from `ALL_TOTALS` (that doesn't even exist on candidate.html) — it's fetched per-cycle inside loadCycle. So candidate.html's detail view has its own totals path independent of the index view's totals.

committee.html has the architectural difference: `renderStats` reads `ALL_TOTALS` (in-memory cache populated at init), not from a per-cycle fetch. So committee's detail view depends on ALL_TOTALS being available, which depends on the eager init-level await.

### Is convergence worth pursuing?

Committee.html could in principle adopt candidate.html's pattern — refactor `renderStats` to fire its own per-cycle totals fetch with `cycle=Y&election_full=true` instead of reading from `ALL_TOTALS`. This would:
- Eliminate the eager init-level totals await
- Match candidate.html's flow
- Add a per-cycle totals fetch on every detail-view entry (current behavior: zero detail-view-entry fetches; ALL_TOTALS is read in-memory)

**The convergence trade is a per-cycle-switch fetch.** Today's committee cycle-switch is free (sync renderStats from ALL_TOTALS). Converging would add a network round-trip per switch. Defending today's pattern: committee /totals/?per_page=100 IS the all-cycles data in one shot; iterating per-cycle would multiply network calls for what's currently a single fetch.

**Not converging.** Committee's pattern is better for its data shape. The init-level refactor is the right answer: keep the eager parallel fire of totals, defer the await to only when needed (detail view path).

---

## 4. Refactor proposal

### Core change: defer `await totalsP` to detail-view branch only

```js
// Today (committee.html lines 759–785):
var entityP = fetchEntity();
var totalsP = fetchAllTotals();
try {
  var metaRes = await entityP;
  // ...
  renderHeader(committee);
  var hashCycle = parseInt(...);
  var isDetailView = ALL_CYCLES.indexOf(hashCycle) !== -1;
  var totalsRes = await totalsP;        // ← BLOCKS index-path scaffold
  ALL_TOTALS = totalsRes.results || [];
  // ...rest of init...
  view.switchTo(isDetailView, hashCycle);
```

```js
// After:
var entityP = fetchEntity();
var totalsP = fetchAllTotals();

// Populate ALL_TOTALS as soon as totals resolves, regardless of view path.
// Detail-view path awaits this explicitly (renderStats needs ALL_TOTALS sync).
// Index-view path doesn't await — the helper's fetchIndexData re-uses the
// same cached promise inside view.switchTo's Promise.all.
totalsP.then(function(res) {
  ALL_TOTALS = res.results || [];
});

try {
  var metaRes = await entityP;
  // ...renderHeader sets ALL_CYCLES, COMM_FIRST_FILE_DATE, etc...

  var hashCycle = parseInt(...);
  var isDetailView = ALL_CYCLES.indexOf(hashCycle) !== -1;

  if (isDetailView) {
    // Detail view needs ALL_TOTALS populated before view.switchTo →
    // loadCycle → renderStats. Block here on cold cache where totals
    // wasn't already done.
    await totalsP;
  }
  // Index view: don't await — scaffold doesn't need ALL_TOTALS, and the
  // helper's renderIndex hydration awaits the same cached promise inside
  // view.switchTo's Promise.all.

  // ...rest of init...
  view.switchTo(isDetailView, hashCycle);
```

### Cycle-row-click-during-load edge case

User scenario: bare-URL load → entity resolves → scaffold renders → user clicks cycle row BEFORE totals resolves. Today this case is impossible (totals already awaited at init); under the refactor, it's possible.

Flow: hashchange → `view.switchTo(true, year)` → `loadCycle(year)` → `renderStats(year)` → reads `ALL_TOTALS` → empty → all stats resolve to dashes.

**Fix:** add a guard at top of `renderStats` that no-ops when `ALL_TOTALS` is empty AND wire a `totalsP.then()` re-render trigger:

```js
function renderStats(cycle) {
  if (!ALL_TOTALS || !ALL_TOTALS.length) {
    // Totals not yet resolved — leave T-load-3 skeletons in place;
    // totalsP.then() below will re-fire renderStats when ready.
    return;
  }
  // ...existing body...
}

// In init(), alongside the totalsP.then() ALL_TOTALS populator:
totalsP.then(function(res) {
  ALL_TOTALS = res.results || [];
  // If we're in detail view at the time totals resolves (either entered
  // detail before totals resolved on bare-URL load, OR clicked a cycle row
  // before totals resolved), re-fire renderStats with fresh data.
  if (activeCycle && !isCurrentlyOnIndexView) renderStats(activeCycle);
});
```

The "isCurrentlyOnIndexView" check needs a state signal — could use `document.getElementById('cycle-index').style.display !== 'none'` or a module-scope flag updated by view.switchTo.

### LOC + complexity estimate

- Move `await totalsP` into `if (isDetailView)` branch: ~3 lines
- Add `totalsP.then()` populator: ~3 lines
- Guard at top of renderStats: ~4 lines
- Re-render trigger after totals resolve: ~6 lines (incl. view-state check)
- Total: ~15–20 LOC

### Tests needed

- Index-path bare-URL load: scaffold visible after entity resolves, before totals resolves (regression-lock the headroom). Mock totals with 1500ms delay; assert career-strip + cycle-index visible within ~500ms (entity is mock-instant, so the refactor's value is measured by scaffold-visible-before-totals).
- Cycle-row-click-during-load: bare-URL load with delayed totals; click cycle row before totals resolves; assert stats render as skeletons (not dashes) until totals resolves, then re-render to real values.
- Cycle-row-click-after-load: normal case (totals resolved first); cycle-row click renders stats immediately. Existing test coverage probably captures this.
- Detail-URL load: existing T-load-1 / T-load-3 behavior preserved (totals awaited before view.switchTo).

Estimate +3 new tests, ~75 LOC.

### Honest payoff revisited

The win is the cold-cache bare-URL committee-page load where:
- Entity is slower than totals: refactor saves nothing (today's `await totalsP` is already a no-op)
- Entity is faster than totals: refactor saves `totals - entity` ms

T-load-1 measurements showed entity up to 43s and totals up to 14s on cold cache. In that case, totals is FASTER than entity → today's await is a no-op → refactor saves zero.

But on WARM cache or normal connections, entity and totals are both ~hundreds of ms. The faster of the two is faster than today's max. Refactor saves 0–500ms typical.

**Realistic average win: ~200ms on warm-cache loads. Worst case (cold-cache deep-history): 0ms.** This is a polish improvement, not a transformative win.

---

## 5. Scope + risk + recommended tickets

### Recommended ticket structure

**One ticket: T-committee-init-defer-totals.**

Scope:
1. committee.html init(): conditional `await totalsP` based on `isDetailView`
2. committee.html init(): `totalsP.then()` populator with optional re-render trigger
3. committee.html `renderStats`: empty-ALL_TOTALS guard
4. View-state signal (module-scope flag OR DOM-based check)
5. Tests: ~3 new + regression coverage of existing detail-view path
6. Docs: CLAUDE.md note + test-cases row

**Estimated total: ~20 LOC + ~75 LOC tests + docs.**

### Risks

- **Regression on cycle-row-click-during-load.** Mitigated by the renderStats guard + re-render trigger, but needs careful test coverage.
- **Async state coordination.** `totalsP.then()` side effect introduces a non-trivial async pattern. Module-scope state for "is detail view active" needs careful sync with view.switchTo's actual reveal timing.
- **Helper interaction.** view.switchTo's helper-side Promise.all already awaits totalsP (via fetchIndexData → fetchAllTotals → cached promise). On index path, the helper-side await still happens — but in parallel with scaffold render, not blocking it. Verify the cached promise is the same instance the init-level totalsP points to. (It should be — both call fetchAllTotals which checks `cachedTotalsP` first.)
- **Test count growth.** +3 tests at ~25 LOC each. Existing committee.spec.js is already large.

### candidate.html parity

**candidate.html stays as-is.** Its pattern (no eager init-level totals; per-cycle totals fired inside loadCycle) is architecturally different and better for its data shape (per-cycle election_full=true fetch).

If the refactor establishes that committee can match candidate's "no init-level totals await" pattern, the two pages converge on a useful invariant: **init() only awaits entity. Totals is awaited per-path (helper for index, loadCycle for detail).** That convergence is the cleaner end-state and worth pursuing as part of this ticket.

### Recommendation

**Ship.** ~20 LOC refactor. Real-but-modest payoff. Cleaner cross-page convention. Risk is real but contained — tests cover the new async race.

If Sloane wants to defer based on the "honest payoff is modest" framing, that's a valid call too. The win is most visible on warm-cache loads (which strategists/journalists are likely on once they've visited the site before) — so the audience-impact is reasonable. But it's not a transformative UX improvement; it's polish on top of the T-load-4 arc that already shipped.

---

## Banked observations (not in this ticket's scope)

1. **localStorage cycle-list caching.** Could let the cycle-index render before entity resolves on repeat visits, using the previous visit's cycle list. Would require careful staleness handling (FEC data updates daily; cycle list mostly stable across days). Out of scope per Sloane's standing direction on staleness windows.

2. **Defensive cycle-index render with `c.cycles` from cached metadata service worker.** Not applicable today (no service worker). Future deployment-architecture question.

3. **The "column header only" pre-entity shell idea.** Documented as rejected in section 2. Could revisit if Sloane wants the marginal UX improvement.
