# T-load-1 — Skeleton profile-header for entity-call latency

> **EXECUTED 2026-05-18.** Skeleton header lands from first paint on candidate.html + committee.html; hydrates on entity-resolve; 10s "still loading" + 30s retry adapt T12's `.section-state-msg` and `.tab-error`/`.retry-btn` primitives at page scope. committee.html's Promise.all split bundled — `fetchEntity()` and `fetchAllTotals()` cache the in-flight promises so init()'s skeleton-hydration path awaits entity-only before totals. Shared `initPageLoadingTimers(stateMsgEl)` helper in utils.js. State-msg `#state-msg` relocated below the profile-header in document flow (was above) — initial "Fetching candidate/committee data from FEC…" text retired entirely; skeleton communicates "loading" structurally. Note: the doc section "JS changes (candidate.html)" originally said "the `state-msg` toggle stays in place" — that was superseded during scoping; the state-msg *element* stays, the *initial loader text* retires. Tests +9 net (554 → 563).

---

## Context

User-observable symptom (Sloane, 2026-05-18): on candidate.html and committee.html, profile pages open with "the very first thing I see on load is an empty page with a loader + text only. And then a bunch of content appears at once." The profile-header (entity name, party/type/status tags, FEC ID, race tag) is among the first data to land from the API but waits to reveal until after the broader fetch chain resolves.

Two questions framed the investigation:

1. Is the slow profile-header reveal a recent regression (T-nav-scroll arc broke it), or a longstanding inefficiency?
2. What's the minimum change to decouple the reveal from the broader fetch chain?

Code-trace + production measurement reframed both questions: the architecture is longstanding (since T9/T10 on 2026-04-28, no T-nav-scroll regression), and the actual user-observed delay is dominated by **FEC API cold-cache latency**, not by reveal-mechanism coupling. The decoupling fix saves <100ms warm-cache; the symptom Sloane is reporting is the 1-43 second cold-cache window during which the page shows only "Fetching..." text with no structural content.

This rescopes T-load-1 from "decouple reveal" to "loading-state UI for entity-call latency."

---

## Measurement findings (2026-05-18, production fecledgerapp.pages.dev)

Console-snippet instrumentation captured entity-call response time, meta-row write time, `.visible` class application, and opacity-transition end. Three runs per URL across four URLs. Key numbers:

| Surface | Warm cache | Cold cache (outlier) |
|---|---|---|
| candidate.html cycle-detail (`#2024#summary`) | `/candidate/{id}/` T+550-800ms | (not captured — fast) |
| candidate.html cycle-index (bare URL) | T+700-900ms | `/history/` T+8632ms · `/totals/` T+14154ms |
| committee.html cycle-detail (`#2024#summary`) | `/committee/{id}/` T+273-1062ms · totals T+1073ms (warm) | `/committee/{id}/` **T+42972ms** (43 seconds) |
| committee.html cycle-index (bare URL) | T+500-800ms | `/totals/` T+8475ms |

**The Promise.all delta on committee.html (between entity-call and totals-call resolution) is 10-100ms warm cache.** This is the "small fix" Path A would have shipped — below human-perception threshold.

**The substantive find:** FEC API cold-cache latency is the actual driver. 43-second `/committee/{id}/` response (test 2 cold cache) and 14-second `/candidate/{id}/totals/` response (cycle-index cold cache) are real production occurrences. During those windows the page shows only "Fetching..." text — no skeleton, no structural placeholder, no timeout messaging, no retry affordance.

---

## Reveal architecture (no regression — longstanding since T9/T10)

`git log -L` on the reveal sites:

- **candidate.html** (current lines 2125-2135) — reveal site set in `bec7e0d` (T9, 2026-04-28); last touched `b10c9b5` (T11, 2026-04-29). Reveal is already gated on a single API call (`/candidate/{id}/`) and fires before `loadCycle`.
- **committee.html** (current lines 605-612) — reveal site set in `0eef3df` (T10, 2026-04-28). Reveal is gated on `Promise.all([/committee/{id}/, /committee/{id}/totals/?per_page=100])` resolving — totals-call participation is the unnecessary coupling.
- **styles.css** (current lines 588-590) — `.page-header-reveal { opacity:0; transition:opacity 0.4s ease }` + `.page-header-reveal.visible { opacity:1 }`. Last touched `ea81ff4` (committee-row refactor, structural only).

The T-nav-scroll arc (`3074673..91e8a26`) and all subsequent commits (T12, T14/T14.5, T16, T-bug, committees-modal refresh) did not touch the reveal sites. The "feels slower now" perception is most likely attention shifting to load polish post-committees-modal session, not a code regression.

`renderHeader(c)` on committee.html (lines 714-746) reads only from the entity response — name, designation, type, status, FEC ID, state. The totals call is needed later for `renderStats(cycle)` via `ALL_TOTALS`, not for header rendering. The Promise.all coupling is fixable independent of the larger latency story.

---

## Decision — Path B-full

**Path A** (ship the Promise.all split alone on committee.html, defer load-state UX to T-load-3/4) was rejected: the warm-cache win is below perception threshold and doesn't address the symptom Sloane reported.

**Path B-full** ships:
1. **Skeleton header from first paint** — structural placeholders for page-title and meta-row visible immediately, before any API call resolves. Hydrate with real content when the entity call resolves.
2. **Promise.all split on committee.html** — bundled prerequisite. Hydrate the header when `/committee/{id}/` resolves, not when both calls resolve.
3. **10-second "still loading" augmentation** — page-level adaptation of T12's `.section-state-msg` primitive. Surfaces under the skeleton when entity-call latency exceeds 10s.
4. **30-second retry affordance** — page-level adaptation of T12's `.tab-error` + retry primitive. Surfaces when entity-call latency exceeds 30s; clicking reloads.

**Why bundled, not split into smaller tickets:** the 10s and 30s augmentations reuse T12 primitives at a different DOM scope (page-level vs. tab-level). The marginal scope is small; the marginal coherence is large. Shipping skeleton-alone would leave the 8-43s outliers still looking broken — a likely candidate for the "ship, look, decide we needed more" cycle Sloane flagged yesterday during the height-stability arc.

**Out of scope for T-load-1:**
- Skeleton placeholders for stats-grid, cycle-index, tabs-bar content (those are T-load-3 / T-load-4).
- `apiFetch` retry/backoff behavior in utils.js (separate concern).

---

## Skeleton design intent — minimal first

Ship a deliberately minimal skeleton. Two simple gray rectangles:

- **Page-title placeholder** — one `.skeleton` element sized to approximate the Oswald display title (height matching `clamp(2rem,5vw,4.5rem)`, width ~60% of expected title width).
- **Meta-row placeholder** — one `.skeleton` element treated as a single shape (not N tag-shaped placeholders), sized to approximate the meta-row's height + a reasonable width covering 3-4 tags.

**No skeleton on the race-context-bar.** It already has its own loading state via `formatRaceLabelLong()` rendering the prose-emphasis label from first paint and a `.skeleton` placeholder for the sentence body (set in `loadCycle` lines 1672-1678 today).

**Reasoning for minimal-first** (per Sloane, 2026-05-18):
- Minimal shapes use known T12 `.skeleton` primitives — low hydration-jolt risk because placeholders don't try to mimic tag shapes that would shift on hydration.
- The prototype step (half a session of skeleton-design exploration) is only worth doing if the minimal version reads wrong in production. Ship, look, decide if more refinement is needed.
- Same iteration pattern that worked during T-nav-scroll's polish tail.

**Fallback path** (if minimal version reads as regression vs. today's "Fetching..." text on production verification): invest in elaborate skeleton design — per-tag placeholders, hydration animation, content-aware widths. Banked as a follow-up; not committed to upfront.

---

## Implementation outline

### HTML changes (candidate.html, committee.html)

Profile-header currently initializes as `style="display:none"` and JS does `removeProperty('display')` + RAF + `classList.add('visible')` to fade it in. New shape:

1. Remove `style="display:none"` from `#profile-header` / `#committee-header`.
2. Add `.visible` class to the page-header in the initial HTML so the skeleton is opacity:1 from first paint. (Or: trigger the existing reveal RAF immediately on `init()` start so the skeleton fades in within the first frame.)
3. Inside `#candidate-name` / `#committee-name`: render `<span class="skeleton" style="display:inline-block;width:60%;height:1em"></span>` as initial content.
4. Inside `#meta-row`: render a single `<span class="skeleton" style="display:inline-block;width:280px;height:1.2rem"></span>` as initial content.
5. Below the skeleton header, render the current `state-msg` loader text but with a delayed visibility — only appear after 10s (the "still loading" augmentation). Replace the current "Fetching..." default state.

The skeleton hydration happens naturally via the existing JS — `document.getElementById('candidate-name').textContent = displayName` (candidate.html line 2100) and `document.getElementById('meta-row').innerHTML = ...` (line 2119) both replace child nodes wholesale, swapping out skeletons for real content. No new hydration logic needed.

**Reveal-mechanism decision:** preserve the opacity:0→1 transition. Two ways to trigger it pre-entity-resolve:

- **Option A** — set `.visible` in initial HTML; header is opacity:1 immediately, no transition on initial paint, no transition on hydration. (Simplest.)
- **Option B** — keep `.page-header-reveal` opacity:0 default; trigger `classList.add('visible')` synchronously at the top of `init()` (before any await). Header fades in during the first frame; real content swaps in sync when entity resolves.

Recommend **Option B** — preserves the existing fade-in motion; the skeleton fades in instead of the resolved content, but the perceived load rhythm stays the same. The transition timing (~16ms RAF + 400ms ease) is fast enough that "skeleton fade-in" reads as page loading, not as content arriving.

### JS changes (candidate.html)

Lines 2126-2130 currently:

```js
document.getElementById('state-msg').style.display = 'none';
document.getElementById('profile-header').style.removeProperty('display');
requestAnimationFrame(function() {
  document.getElementById('profile-header').classList.add('visible');
});
```

Move the RAF+`.visible` trigger to the **top of `init()`** (synchronously, before the `await apiFetch('/candidate/'+CANDIDATE_ID+'/')` on line 2083). Skeleton fades in immediately. The `state-msg` toggle stays in place — it's the page-level "Fetching..." loader that disappears once the header has real data.

`document.getElementById('candidate-name').textContent = displayName` (line 2100) and `document.getElementById('meta-row').innerHTML = ...` (line 2119) already handle hydration via DOM replacement. No code changes there.

The 10s/30s augmentation needs a `setTimeout` pair fired from the top of `init()`:

```js
var stillLoadingTimer = setTimeout(function() {
  // Show .section-state-msg variant under the skeleton header
}, 10000);
var retryTimer = setTimeout(function() {
  // Show retry affordance: .tab-error variant + retry button
}, 30000);
// Clear both in the success branch (after entity resolves and header hydrates)
// and in the catch branch (where the existing error UI fires).
```

### JS changes (committee.html)

Two changes:

1. **Move the skeleton-visible RAF trigger to the top of `init()`** (same pattern as candidate.html), before the `await fetchIndexData()` on line 591.

2. **Split `fetchIndexData()` so entity and totals are independently awaitable.** Current shape (lines 568-579):

   ```js
   async function fetchIndexData() {
     if (cachedMeta && cachedAllTotalsRes) {
       return { metaRes: cachedMeta, allTotalsRes: cachedAllTotalsRes };
     }
     var idxResults = await Promise.all([
       apiFetch('/committee/' + COMMITTEE_ID + '/'),
       apiFetch('/committee/' + COMMITTEE_ID + '/totals/', { per_page: 100, sort: '-coverage_end_date' })
     ]);
     cachedMeta         = idxResults[0];
     cachedAllTotalsRes = idxResults[1];
     return { metaRes: cachedMeta, allTotalsRes: cachedAllTotalsRes };
   }
   ```

   Replace with a shape that returns two awaitable promises so the caller can hydrate the header on entity-resolve and await totals before `view.switchTo`:

   ```js
   async function fetchIndexData() {
     if (cachedMeta && cachedAllTotalsRes) {
       return { metaP: Promise.resolve(cachedMeta), totalsP: Promise.resolve(cachedAllTotalsRes) };
     }
     var metaP   = apiFetch('/committee/' + COMMITTEE_ID + '/');
     var totalsP = apiFetch('/committee/' + COMMITTEE_ID + '/totals/', { per_page: 100, sort: '-coverage_end_date' });
     metaP.then(function(r)   { cachedMeta = r; });
     totalsP.then(function(r) { cachedAllTotalsRes = r; });
     return { metaP: metaP, totalsP: totalsP };
   }
   ```

   And in `init()`:

   ```js
   var { metaP, totalsP } = await fetchIndexData();   // both fire immediately
   var metaRes = await metaP;                         // wait for entity → hydrate header
   var committee = (metaRes.results || [])[0];
   if (!committee) throw new Error('Committee not found');
   renderHeader(committee);
   ALL_CYCLES = (committee.cycles || []).slice().sort(function(a,b){ return b-a; });
   // ... skeleton hydrates here ...

   var totalsRes = await totalsP;                     // wait for totals before view.switchTo
   ALL_TOTALS = totalsRes.results || [];
   // ... continue with view.switchTo as today ...
   ```

   **Back-navigation cache path:** the `initViewSwitcher` helper's `fetchIndexData` config callback contract is `() => Promise<any>`. The current per-page `fetchIndexData` returns `{metaRes, allTotalsRes}`; the new shape returns `{metaP, totalsP}` (promises, not resolved values). The helper's `renderIndex(data)` callback (committee.html lines 651-659) reads from `data.metaRes.results` and `data.allTotalsRes.results` — would need updating to await the inner promises or accept resolved values. **Simplest path:** keep two variants — the new `fetchIndexData()` for `init()`'s skeleton-hydration flow; a separate wrapper that awaits both and returns the `{metaRes, allTotalsRes}` shape for the helper's `renderIndex` path. Adds ~5 lines, preserves the helper contract untouched.

`renderHeader(c)` itself doesn't change — it already reads only from the entity response.

### CSS additions (styles.css)

The existing `.skeleton` class works as-is. Two page-level augmentation rules to add:

```css
/* Page-level loading augmentation — adapts T12's .section-state-msg pattern */
#state-msg .page-state-still-loading {
  font-family: 'IBM Plex Sans', sans-serif;
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: var(--space-16);
  display: none;  /* JS toggles after 10s */
}
/* Page-level retry — adapts T12's .tab-error pattern */
#state-msg .page-state-retry-btn {
  /* same styling as .retry-btn in styles.css */
}
```

Exact selectors/markup TBD during implementation — the goal is reuse of T12's existing visual treatment, not new design.

---

## 10s / 30s augmentation — T12 primitive references

Page-level adaptations of three T12 primitives:

| T12 primitive | Definition | T-load-1 adaptation |
|---|---|---|
| `.section-state-msg` (styles.css) | "Still working" message under slow-tier skeletons; body type, muted. | Same visual treatment, rendered under the page-level loader after 10s. |
| `.tab-error` (styles.css) + `.retry-btn` | Per-tier error UI on Raised/Spent tabs with retry button. | Same visual treatment at page level after 30s. Retry button calls `location.reload()` (page-level retry) rather than re-firing a specific apiFetch. |
| `showTabError(errorEl, err, defaultMsg)` (inline per-page in T12) | Picks default/429/init-failure variant. | Not directly applicable at 10s/30s — those aren't error states yet, just "still loading" / "loading is taking unusual time." Reserve `showTabError`-style branching for the actual catch branch when entity-fetch throws. |
| `is429(err)` + `TAB_ERROR_RATE_LIMIT_MSG` + `TAB_ERROR_INIT_FAILURE_MSG` (utils.js) | Error-copy single source of truth. | Add `PAGE_ERROR_*` constants for page-level variants. Or reuse `TAB_ERROR_INIT_FAILURE_MSG` directly if the copy matches — entity-fetch failure is structurally similar to T12's init-stage failure (both block the page from rendering). |

**Copy proposal** (refine during implementation):

- 10s: "Still loading — the FEC API can be slow during high-traffic periods."
- 30s: "Loading is taking longer than expected. [Try again]"
- Catch branch (entity-fetch throws): existing error UI in candidate.html lines 2205-2210 / committee.html — already in place, no change.

---

## Verification protocol

### Manual browser checks

1. **Cold cache, warm path** — DevTools → Network → "Disable cache". Reload candidate.html and committee.html. Skeleton header should be visible from first paint; hydrate within 1-3s typical. No content shift on hydration.
2. **Cold cache, slow path** — same as above but on a slow connection (DevTools → Network → "Slow 3G"). Verify the 10s message appears under the skeleton; verify the 30s retry button appears if loading exceeds 30s.
3. **Warm cache** — second reload immediately after #1. Skeleton may flash briefly or not at all (entity resolves before paint). Verify no visible artifact from the skeleton (no flash of placeholder content).
4. **Cycle-detail vs cycle-index** — both paths share the same reveal site; behavior should be identical.
5. **Compact-header transition** — scroll past the threshold during the skeleton-loading state (if skeleton-loading lasts >1s on a real load). Verify compact-header layout transitions cleanly with the skeleton; verify the skeleton doesn't break compact-header's `min-height:48px` cap.
6. **Mobile viewport** — DevTools device toolbar at ≤860px. Skeleton sizing should adapt to mobile (page-title placeholder narrows, meta-row placeholder wraps or fits).

### Playwright (Track 1, mocked API)

The current mocks resolve instantaneously, so the skeleton state isn't normally observed in tests. Two test shapes needed:

- **Structural** — verify skeleton elements exist in initial HTML; verify they're replaced by real content after the entity-mock resolves; verify the 10s/30s timers fire correctly (use `page.evaluate` to advance timers or directly inspect timer state).
- **Optional latency simulation** — `page.route('**/api/fec/candidate/H2WA03217/', async (route) => { await new Promise(r => setTimeout(r, 11000)); ... })` to simulate slow API; verify 10s "still loading" message appears. Slow tests; flag with `@slow` so they're skippable.

Test counts: estimate +6 to +10 tests. Update `test-cases.md` and `TESTING.md` with the new pages-spec counts when shipping.

### Live-API smoke (Track 2)

Not strictly needed — Track 1 covers the structural behavior. If a smoke test is added, scope it to "skeleton header visible on page load before any API call resolves" — purely DOM-shape, no API timing assertion (live API is unpredictable).

---

## Decisions (running list)

1. **Path B-full over Path A.** Ship skeleton header + Promise.all split + 10s/30s augmentation as one ticket. Reasoning: Path A is below human-perception threshold and doesn't address the symptom.
2. **Minimal-first skeleton.** Two simple gray rectangles (page-title shape, meta-row shape). No skeleton on race-context-bar. Prototype-elaborate-skeleton reserved as fallback if minimal reads as regression in production.
3. **Reveal mechanism preserved.** Existing `.page-header-reveal` opacity transition stays; trigger moves to top of `init()` so skeleton fades in instead of resolved content. Real content swaps in sync after entity resolves (no fade on hydration).
4. **Committee.html Promise.all split bundled.** Required for skeleton hydration on `/committee/{id}/` resolve independent of `/totals/`. Helper contract preserved via separate wrapper for the back-navigation `renderIndex` path.
5. **10s "still loading" + 30s retry reuse T12 primitives at page scope.** Visual treatment matches `.section-state-msg` (10s) and `.tab-error` + `.retry-btn` (30s). Retry button calls `location.reload()` — simplest universally-understood action.

---

## Implementation order suggestion

When picked up:

1. **Skeleton HTML + reveal-trigger move** on candidate.html (small, low-risk, isolated). Verify skeleton paints from first frame and hydrates cleanly.
2. **Skeleton HTML + reveal-trigger move** on committee.html (apply the same pattern).
3. **Promise.all split** on committee.html (with helper-contract preservation via separate wrapper).
4. **10s "still loading"** on both pages — page-level adaptation of `.section-state-msg`.
5. **30s retry affordance** on both pages — page-level adaptation of `.tab-error` + `.retry-btn`.
6. **Playwright tests** for each — structural assertions, with optional slow-API simulation.
7. **Production verification** — measurement-snippet re-run on all four URLs (matching investigation protocol); confirm symptom resolved or surface need for elaborate-skeleton fallback.

Estimated implementation footprint: ~100-150 lines across candidate.html + committee.html + styles.css; ~6-10 new Playwright tests. Single session if minimal-skeleton reads well; second session if elaborate-skeleton fallback triggers.

---

## Related work / cross-references

- **`strategy/t12-loading-state-rescope.md`** — source of `.section-state-msg`, `.tab-error`, `.retry-btn`, `showTabError`, `is429`, `TAB_ERROR_*` primitives reused here at page scope.
- **CLAUDE.md** "Tab-skeleton variants (T12)" — defines the `.skeleton` family this ticket extends to the header.
- **CLAUDE.md** "Skeleton loading" — defines the `.skeleton` shared primitive used for the page-title and meta-row placeholders.
- **T-load-3** (not yet scoped) — stats-grid skeleton placeholders. The "header into emptiness" UX concern this doc flagged (skeleton header reveals into still-loading stats-grid) becomes T-load-3's surface to address.
- **T-load-4** (not yet scoped) — cycle-index loading state. Same pattern applied to the cycle-index view's CareerStrip + cycle table on bare URLs.
