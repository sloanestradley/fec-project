### strategy/search-overlay-feasibility.md

**DECISIONS RESOLVED 2026-05-21** — all 10 open decisions in §8/§10 confirmed by Sloane (CC-recommended defaults across the board). Implementation planned in `strategy/search-overlay-implementation.md` (three tickets: T-search-inline-results, T-search-overlay, T-search-typeahead-retire). This doc remains the diagnostic reference.

**Status:** Diagnostic / feasibility investigation. Surfaces information for Sloane to decide; does not pre-decide.
**Date:** 2026-05-21
**Builds on:** T-IA-candidate-committees-nav-removal (2026-05-20) and the search-extension surface foundation arc.
**Scope:** /search, /candidates, /committees, nav search wiring across all 10 pages. Excludes Races/Feed nav pairing and any change to the search input's visual prominence (banked follow-ups).

---

## TL;DR

The edited plan (overlay hosts only /search content; /candidates and /committees stay as normal pages with their own in-page search) **holds up cleanly against the code**. There is no shared state between the overlay and the underlying page; the overlay is an independent chrome layer. No multi-surface internal router is required.

The largest pieces of work, in rough order of effort:

1. **History/back integration** — the project has zero `popstate` handlers today. Adding `popstate` (cleanly, without colliding with profile-page `hashchange` listeners) is the highest bug-risk area. Medium effort, high attention.
2. **Overlay chrome + open/close + focus management** — new modal-class component. Existing prior art (candidate.html committees modal) does NOT use focus trap, popstate, or escape handling; this is new territory. Small-to-medium effort.
3. **Inline-results renderer for /search page-mode** — retargeting the existing typeahead query to the existing `#state-results` inline region. The mechanics are nearly trivial; the question is whether to share the renderer with the overlay or duplicate. Small effort.
4. **Retire 4 search-typeahead instances** — `#typeahead-dropdown` on /search, `#search-typeahead` on /candidates and /committees, `#nav-typeahead-dropdown` global. CSS, JS, and ~40+ test assertions touched. Small-to-medium effort.
5. **Amplitude continuity** — `Page Viewed { page: 'search' }` shifts meaning if overlay-open fires it; need a new event surface for overlay-open. Small effort, decision-heavy.

**Cost tier: order of days, not weeks.** Best estimate 3–5 days of focused work for a well-scoped landing. **Can ship incrementally** in three phases (see §7). Atomic shipping is not required.

**Honest finding:** the simplification holds, but the implementation surface area is wider than "open a modal" reads. The history/back-integration discipline and the test-update sweep account for most of the time.

---

## 1. Current routing/init + history machinery

There is **no shared router** in this codebase. Each page is a static HTML file with its own inline `<script>` `(function init() { ... })()` IIFE at the bottom. `main.js` is a small shared module loaded by every page; it handles Amplitude bootstrap, hamburger nav, mobile search-toggle, and the global nav typeahead. There is no central navigation controller.

### History API usage today

```
grep -rn "popstate" --include="*.html" --include="*.js" (excluding tests/, dist/, node_modules/)
→ zero matches
```

**No page in this codebase listens for `popstate`.** Browser back/forward currently does whatever the browser does natively — which for hash-only changes (profile pages) means `hashchange` fires; for query-param changes (/candidates, /committees, /search), the URL changes but no JS re-renders. The query-param-change behavior is a latent issue today (back from `/candidates?q=foo&state=WA` to `/candidates?q=foo` does not re-fire `doFetch`; the page state stays stale until reload), but it has been low-cost to ignore because users rarely back-button across filter states.

**The overlay model introduces popstate as a load-bearing primitive for the first time.** Browser back closes the overlay; that requires a popstate handler. This is new architectural territory.

### Per-page `pushState` usage

| Page | Where | Form |
|---|---|---|
| search.html | `handleSubmit`, `__navSearchHandler` | `pushState(null, '', '/search?q=' + encodeURIComponent(q))` |
| candidates.html | `updateURL()` after every fetch | `pushState({}, '', u.toString())` |
| committees.html | `updateURL()` after every fetch | `pushState({}, '', u.toString())` |
| races.html | `updateURL()` after `applyFilters` | `pushState` on cycle/office/state changes |
| candidate.html | `loadCycle` cycle/tab hash sync (line 648, 1961) | **`replaceState`** — intentionally does NOT push |
| committee.html | same shape as candidate.html | **`replaceState`** |

**Pattern observation:** browse pages use `pushState` (each filter change is a "back-button-recoverable" state). Profile pages use `replaceState` (cycle/tab clicks would otherwise pollute history with dozens of entries per session — intentional). The overlay open is structurally closest to "a back-recoverable state" → `pushState`.

### Profile-page `hashchange` listeners — prior art for in-page URL transitions

`candidate.html` (line 2362) and `committee.html` (line 877) both wire a persistent `window.addEventListener('hashchange', ...)` that drives `view.switchTo()` (the index↔detail transition lifted into `initViewSwitcher` in utils.js). The mechanism is well-established within profile pages and has been hardened by the T9/T10/T14.5 arc.

**However:** this is the *only* hashchange/popstate-class listener in the codebase, and it lives inside two pages. It is NOT a general routing pattern.

**Specifically NOT applicable to the overlay:**
- `view.switchTo` is a same-entity transition (index↔detail of the same candidate). The overlay is a chrome layer on top of any page — different conceptual shape.
- `view.switchTo` uses `replaceState` for the URL update inside `loadCycle` (no history entry on cycle clicks). Overlay needs `pushState` (back = close).
- `view.switchTo`'s machinery (`indexElements`, `detailElements`, fetch-race tokens, scaffold-then-hydrate, minHeight floor for scroll-clamp) is built around show/hide of long-form content with async loading. The overlay's content is short, query-driven, and has no clamp issues.

**The honest read:** `view.switchTo` is good prior art for *the discipline* of in-place URL transitions (scroll restoration, token-based race protection, RAF reveal), but it is NOT a code primitive the overlay can lift. The overlay needs its own minimal open/close module.

### Is "overlay open = one pushed history entry" a natural extension or a foreign object?

**Natural extension.** The pattern `pushState on action → popstate listener undoes the action` is standard. The codebase doesn't use it yet, but introducing it is not in tension with anything that exists.

**One alignment risk to flag:** on profile pages (`candidate.html`, `committee.html`), a popstate event will fire **on every browser back navigation** including back-from-overlay-close. The profile pages' `hashchange` listener will ALSO fire if the URL fragment changes. The interaction window:

- User on `/candidate/X#2024#summary`.
- Clicks nav search-button → overlay opens → `pushState(null, '', '/candidate/X#2024#summary')` (no URL change, or trailing state token? — see §8 decision).
- Clicks browser back → popstate fires → overlay-close handler runs.
- If the popstate's URL has a different hash than the current URL, **hashchange will also fire** as a side effect, which would mistakenly invoke `view.switchTo`.

The mitigation is straightforward (overlay's pushState must preserve the exact URL fragment, or the URL strategy must not touch the hash) — but it's a coordination point that needs explicit attention during implementation. Listed in §7 as a high bug-risk area.

---

## 2. Two-presentation model for /search

### Can /search render in both overlay-mode and page-mode from one codebase?

**Yes, cleanly.** The conditional driver is whether `search.html` is being rendered as a normal navigation (the user typed/clicked a /search link) or it's being shown via the overlay (the user clicked the nav search-button on some other page).

**The cleanest model** — and the one consistent with the prompt's language — is that the overlay is **not a dynamic load of /search.html**. The overlay is its own chrome (markup in every page's body or injected by `main.js`, hidden by default) containing: an X close button, a search input, and an inline results region. The overlay's input and inline-results renderer **share the same JS code** as /search.html's page-mode renderer, but the **markup is independent**. Two surfaces, one renderer.

Under this model:
- /search.html the page is unchanged in structure. Its inline-results layout (`#state-results`) already exists.
- /search.html is updated to drop the floating `#typeahead-dropdown` and instead push live typeahead results into `#state-results` (the same region used today on form submit). One renderer for both "live typeahead" and "submitted query" on /search.
- The overlay markup has its own equivalent of the input + inline results region, rendered into the overlay panel.
- Both consumers (overlay open, /search page) call the same `doSearch(query)` and `renderCandidateGroup` / `renderCommitteeGroup` functions — these get lifted into either `main.js` or `utils.js` to be sharable.

**What drives the conditional on /search:** essentially nothing. /search the page does NOT toggle between two visual modes — it's only ever the page-mode presentation. The overlay is a separate UI mounted elsewhere. The conceptual "two presentations of identical content" the prompt describes is actually **two separate UIs that happen to render the same data with the same renderer.** This is cleaner than a single-page mode-flip.

**One nuance worth flagging:** the prompt says "/search, in BOTH modes: the typeahead query behavior is unchanged (live, debounced, as-you-type, 5 candidates + 5 committees) but results render INLINE in the page body instead of in the floating `.typeahead-dropdown`." So /search the page acquires the same live-typeahead-into-inline-results behavior the overlay has. Today /search has TWO renderers: floating typeahead (live, 5+5, debounced) and inline results (submit-driven, 5+5+count, View all). After this change, only the latter remains, and live typing flows into it.

**Is anything in current /search init awkward for this?** Mildly:
- `currentQuery` module-scoped global, used by `doSearch` and result clicks — fine, lifted into a shared module would still work.
- `aria-controls="typeahead-dropdown"` on `#search-input` — needs updating to point at `#state-results` (the new live target). Small, easy to miss.
- `(function init() { ... })()` runs on load; reads `?q=`; fires `doSearch(q)` if present. Under the new model, the same flow stays — page-mode initial render. Overlay-open is a separate code path entirely.
- `window.__navSearchHandler` — currently `search.html` sets this so the global nav-search input submit fires inline `doSearch` instead of redirecting. Under the new model, the global nav input is gone (replaced by button), so this handler retires. No replacement needed unless overlay-open should pre-populate from the nav input (which it can't, the input doesn't exist).

**Conclusion:** the two-presentation model is structurally trivial because they're not really two presentations of the same UI — they're two UIs that share a renderer. The shared renderer needs to live somewhere global (main.js or a new dedicated file).

---

## 3. Cold-start / orphan-overlay analysis

The concern is: can a user land on the site in a state where the overlay is "open" but there is no underlying page beneath it?

**Confirmed: no path produces an orphan overlay, given a reasonable URL strategy choice.**

### Entry-point enumeration

Every entry point into the site lands on a static HTML page. There are no SPA-style routes. The overlay is a JS-driven layer on top of HTML. Open paths:

1. **Direct URL to /search** (bookmark, share link, typed) → loads `search.html` → page-mode initial render. **No overlay-open intent.** Safe.
2. **Direct URL to /search?q=foo** → loads `search.html` → page-mode initial render + `doSearch('foo')` fires. **No overlay-open intent.** Safe.
3. **Direct URL to /candidate/X** → loads `candidate.html` → profile page renders. **No overlay-open intent.** The nav search-button is visible but the overlay is closed. Safe.
4. **Direct URL to anything else** (/, /candidates, /committees, /races, /race, /feed, /process-log, /design-system) → loads that page → overlay closed. Safe.
5. **Click nav search-button** → JS opens overlay over the current page. Underlying page is the page the user was on. Safe.
6. **Click a search result inside overlay** → href navigation → new page loads (which by definition is overlay-closed). Safe.
7. **Click View all # inside overlay** → href navigation to /candidates or /committees → those pages load fresh, overlay closed. Safe.
8. **Browser back from overlay-open** → popstate fires → overlay closes → reveals the page underneath (which never went away). Safe.
9. **Browser refresh while overlay-open** → reloads the current URL → depends on URL strategy:
   - If URL strategy is **state-only pushState** (no URL change on overlay open): refresh reloads the page that was underneath → page-mode of that page → overlay is closed. Safe.
   - If URL strategy is **pushed URL is `/search?q=foo`**: refresh loads /search.html in page-mode. Safe.
   - If URL strategy is **pushed URL is `?overlay=1` on the current URL**: refresh reloads e.g. `/candidate/X?overlay=1` → that's not a legitimate URL → and the JS would need to read the param and re-open the overlay. **This produces an orphan-style state** if not handled, where the user lands looking at a profile page with an unprompted overlay over it. Even if "handled" (overlay auto-opens), it's odd UX — the user didn't ask for it; they just refreshed. Recommend against this strategy.

**Conclusion:** strategies (a) state-only or (b) URL-on-overlay-becomes-`/search?q=` are both orphan-safe. Strategy (c) appending `?overlay=1` to the current URL is the only path that can produce an orphan; flag and reject.

### One subtle path

A user opens the overlay on /candidate/X, the URL becomes `/search?q=foo` (strategy b), and they navigate to another page via address bar or external link rather than via the overlay's affordances. Then they hit back. The browser goes to `/search?q=foo` → page-mode of /search → not an orphan, but the user has lost their "I was on /candidate/X" anchor. With strategy (a) state-only, back returns to /candidate/X with overlay open, then another back closes it. Strategy (a) is more conservative; strategy (b) makes URLs more shareable. Worth surfacing as a decision.

---

## 4. Amplitude blast radius

### Full event inventory (verified from source, not memory)

**Events that fire on /search, /candidates, /committees today:**

| Event | Properties | Fires on | Source |
|---|---|---|---|
| `Page Viewed` | `{ page: 'search' }` | /search init() | search.html:268 |
| `Page Viewed` | `{ page: 'candidates' }` | /candidates init() | candidates.html:622 |
| `Page Viewed` | `{ page: 'committees' }` | /committees init() | committees.html:546 |
| `Candidate Searched` | `{ query }` | /search form submit (Enter or button) | search.html:239 |
| `Candidates Searched` | `{ query }` | /candidates fetch with `activeQ` set | candidates.html:417 |
| `Candidates Browsed` | `{ state, office, party, cycle }` | /candidates fetch without `activeQ` | candidates.html:419 |
| `Committees Searched` | `{ query }` | /committees fetch with `activeQ` set | committees.html:362 |
| `Committees Browsed` | `{ state, type }` | /committees fetch without `activeQ` | committees.html:364 |
| `Typeahead Result Clicked` | `{ result_type:'candidate', candidate_id, candidate_name, result_position, from_page:'candidates' }` | /candidates typeahead click | candidates.html:566 |
| `Typeahead Result Clicked` | `{ result_type:'committee', committee_id, committee_name, result_position, from_page:'committees' }` | /committees typeahead click | committees.html:505 |
| `Candidate Result Clicked` | `{ candidate_id, candidate_name, from_page, result_position, query? }` | shared `candidateCardHTML` onclick (search, candidates, race) | utils.js:259 |
| `Committee Result Clicked` | `{ committee_id, from_page, result_position, query? }` | shared `committeeRowHTML` onclick (search, candidates' modal, committees) | utils.js:300 |

**Note:** the global nav typeahead (`doNavTypeahead` in main.js, the floating dropdown anchored to `.top-nav-search`) renders result rows as plain `<a>` tags with NO `onclick` Amplitude tracking. The result click currently fires NO Amplitude event when the user clicks a nav-typeahead result. **This is a current gap, not a regression introduced by the overlay change.** Worth flagging — the overlay change will retire nav typeahead, so the gap closes by removal.

### Per-event impact under the overlay model

| Event | Impact | Action |
|---|---|---|
| `Page Viewed { page:'search' }` | **Meaning shifts.** Today: fires once on /search page load. Under overlay model: still fires only on /search page-mode load. Overlay-open is a separate surface. | Keep `Page Viewed` strictly for page-mode loads. Do NOT fire it on overlay open. |
| `Page Viewed { page:'candidates' }` | **Unchanged.** /candidates stays a page. | No change. |
| `Page Viewed { page:'committees' }` | **Unchanged.** /committees stays a page. | No change. |
| `Candidate Searched` | **Meaning shifts.** Today: fires on /search submit. Under overlay model: /search submit still fires it, but most searches now happen inside the overlay (typing → click result, no "submit" event). Volume drops sharply. | Add new event `Search Opened` (or `Overlay Opened`) on overlay-open. Decide whether overlay-typing should also fire a "Search Queried" event per debounced query, or whether result-click is the meaningful conversion. |
| `Candidates Searched` | **Unchanged on /candidates.** Still fires when user submits in-page search. | No change. |
| `Candidates Browsed` | **Unchanged on /candidates.** | No change. |
| `Committees Searched` | **Unchanged on /committees.** | No change. |
| `Committees Browsed` | **Unchanged on /committees.** | No change. |
| `Typeahead Result Clicked` (candidates, committees) | **Retired.** Typeahead removed from both browse pages. | Delete the onclick wiring. Test removal. |
| `Candidate Result Clicked` | **Intact, but `from_page` value needs a decision** when result clicked inside overlay. Today's values: `'search'`, `'candidates'`, `'candidates_search'`, `'candidate-card'`, `'race'`, `'candidate-modal'` (from the shared helper's defaults). New value? `'search-overlay'` or `'search'` (collapsing overlay + page-mode into one bucket)? | **Decision needed.** Recommend `'search'` for both overlay and page-mode results (collapsing) with optional `presentation:'overlay'|'page'` property if the distinction is needed downstream. |
| `Committee Result Clicked` | Same as above. | Same decision. |

### What's lost in historical continuity

- **`Candidate Searched` volume comparability across the change.** Pre-change, this captures the user's search intent. Post-change, it only captures /search page-mode submits (a small subset). The metric "how many searches did users perform" needs a new event surface.
- **`Page Viewed { page:'search' }` volume.** Will not change in shape, but should be understood post-change as "users who reached /search as a page" — a much smaller cohort, since most search happens in overlay.

### Recommended event additions (decision needed)

1. `Search Opened` — fires when overlay opens. Property: `from_page` (the page underneath). Replaces the lost `Candidate Searched` volume baseline.
2. `Search Queried` — optional, fires per debounced typeahead query (with `query` property). Lets you measure typing patterns. Volume risk: noisy. Recommend deferring unless explicitly needed.
3. Keep `Candidate Searched` for /search page-mode submits only.

### The `?from=` URL attribution chain

`candidateCardHTML` writes `?from={fromPage}` to result hrefs (e.g. `/candidate/H2WA03217?from=search`). The receiving profile page (candidate.html) reads this on init. **All overlay-result clicks need to write `?from=search-overlay` or stay `?from=search`** — same decision as `from_page` above. Apply consistently.

---

## 5. Typeahead changes + `.typeahead-dropdown` entanglement

### Banked refactor recap

The banked `.typeahead-dropdown` triple-duty refactor identified three conceptually distinct uses of the class:

1. **Search typeaheads** — floating dropdown anchored to a search input, live-debounced typeahead query.
2. **State combos** — filterable list anchored to a text input, no API call, filters in-page.
3. **Click combos** — fixed-option list anchored to a button trigger, no API call.

### Search-typeahead instances retired by this work

| Site | Marker | What goes away |
|---|---|---|
| /search inline page typeahead | `#typeahead-dropdown` (inside `.search-bar`) | Floating dropdown retired; live typing now drives the inline `#state-results` renderer. |
| /candidates in-page typeahead | `#search-typeahead` (inside `.search-combo`) | Entire typeahead system on /candidates removed; enter-to-search only. |
| /committees in-page typeahead | `#search-typeahead` (inside `.search-combo`) | Entire typeahead system on /committees removed; enter-to-search only. |
| Global nav typeahead | `#nav-typeahead-dropdown` (every page, inside `.top-nav-search`) | Nav input retires entirely; replaced by button that opens overlay. Dropdown is gone. |

**All four search-typeahead instances of `.typeahead-dropdown` are retired.** The "search" job of the triple-duty class is **fully eliminated as a side effect** of this work.

### What remains using `.typeahead-dropdown`

After this work, `.typeahead-dropdown` is used only by combo dropdowns:

- **/candidates** — `#state-dropdown`, `#office-dropdown`, `#party-dropdown`, `#cycle-dropdown`
- **/committees** — `#state-dropdown`, `#type-dropdown`
- **/races** — `#year-dropdown`, `#office-dropdown`, `#state-dropdown`
- (Other combo consumers, e.g. /race year picker)

These are ALL combo-pattern dropdowns (state combos + click combos), driven by `initComboDropdown` in utils.js. They never make API calls; they filter or select from a fixed list.

### Banked refactor resolution

The banked refactor's stated purpose was to disentangle three conceptually different uses. After this work, **only ONE use remains** (combos). The class is no longer triple-duty; it's single-duty. The disentanglement happens by removal, not by rename.

**What's left of the banked work:** a cosmetic question of whether to rename `.typeahead-dropdown` to something more accurate like `.combo-dropdown` (since the "typeahead" semantic has migrated to the search inline-results region, leaving combo-only behind). This rename is **optional polish**, not a refactor of any architectural value. Banked or done-as-part-of-this-work is a small decision; recommend banking — the class name is now misleading but not harmful, and a rename touches ~50+ markup sites and ~30+ doc references for no functional gain.

### CSS rules retired

```
styles.css lines 767–769:
  .search-bar .typeahead-dropdown,
  .search-combo .typeahead-dropdown,
  .top-nav-search .typeahead-dropdown { max-width:none; max-height:none; }
```

This selector group exists specifically to defeat the default `.typeahead-dropdown` caps for the four search instances. All three selector roots disappear; this rule retires.

### Inner-element classes — additional retire scope

The retire scope is wider than `.typeahead-dropdown` alone. The inner-element classes used inside the four search-typeahead instances are defined in `styles.css` lines 681–712:

| Class | Used by | After this work |
|---|---|---|
| `.typeahead-row` | Search typeaheads AND combo dropdowns (combos render `<div class="typeahead-row" role="option">`) | **Stays** — combos still need it |
| `.typeahead-row-left`, `.typeahead-row-right`, `.typeahead-row-id` | Search typeaheads only (combos use plain text content) | **Retires** |
| `.typeahead-status-dot` (+ `.dot-active`, `.dot-terminated`) | Search typeaheads only (committee result rows) | **Retires**; `.status-dot` (without the typeahead prefix) is the broader shared class used elsewhere and stays |
| `.typeahead-group-label` | `buildTypeaheadHTML` in main.js (nav typeahead "Candidates" / "Committees" group headers) | **Retires** |
| `.typeahead-empty` | Search typeaheads' "No candidates found" empty state | **Retires** (the inline-results region uses `.no-results` instead) |
| `.typeahead-loading` | All four search typeaheads ("Searching…" placeholder) | Could be reused inside the inline-results region for the live-typing loading state; alternatively retire and use a shared `.state-msg` or `.inline-status-msg` |

**Cleanup opportunity:** ~6 CSS rules retire alongside the four `.typeahead-dropdown` instances. Worth doing in the same pass — leaving the dead classes in styles.css would accumulate cruft.

### Total entanglement footprint (grep-verified)

`grep -rn "typeahead-dropdown" --include="*.html" --include="*.js" --include="*.css"` (excluding tests/, dist/, node_modules/) returns **51 references across 13 files**. The breakdown:

- 10 HTML pages × ~1–6 markup sites each (every page mounts `#nav-typeahead-dropdown`; browse pages add combo + search instances)
- `styles.css` — ~15 selector references
- `main.js` — 6 references (showNavTypeahead, hideNavTypeahead, doNavTypeahead, etc.)
- `utils.js` — 3 references (initComboDropdown contract docs)
- `design-system.html` — demo card
- `process-log.html` — incidental (carries the global nav)

The "4 instances retire" framing is true at the instance level, but the actual code/markup/CSS touchpoint count is meaningfully larger. Worth budgeting for the sweep.

---

## 6. "View all #" count cost

### Verified from source: the count is free

`search.html:247-248`:
```javascript
var cTotal  = (results[0].pagination && results[0].pagination.count) || cands.length;
var coTotal = (results[1].pagination && results[1].pagination.count) || comms.length;
```

The count comes from `pagination.count` on the **same** `apiFetch('/candidates/', { q: query, per_page: 5, sort: '-receipts' })` response that returns the 5 displayed results. The FEC API returns `pagination.count` regardless of `per_page` (verified by current production behavior — search.html shows "172 candidates" against per_page=5).

**No extra API call required.** No per-keystroke cost. The overlay's live typeahead can show "View all 172 →" immediately on every debounced query.

### Conclusion

The count is structurally free; the cheap-option fallback (count only on /candidates and /committees pages, not live in overlay results) is **unnecessary**. Sloane's stated openness to deferring the count is not load-bearing — the live count comes at zero marginal cost.

The only consideration: when the result count is 0–5, no "View all" affordance renders (current behavior on /search). The overlay should keep this rule.

---

## 7. Cost tier + incremental path + bug-risk areas

### Cost tier

**Order of days, not weeks.** Concrete estimate: **3–5 working days** for a well-scoped landing, including test updates. The work decomposes:

| Component | Effort | Notes |
|---|---|---|
| Overlay chrome markup + CSS | 0.5 day | Standard modal pattern. Mobile + desktop variants. |
| Overlay open/close + focus management | 1 day | New territory; needs focus trap, Escape, restore-focus-on-close, aria-hidden background. |
| History/popstate integration | 0.5–1 day | New territory; needs careful coordination with profile-page hashchange listeners. Highest bug risk. |
| Shared inline-results renderer (extract from /search) | 0.5 day | Lift `doSearch`, `renderCandidateGroup`, `renderCommitteeGroup` into main.js or utils.js. |
| /search page-mode updates | 0.25 day | Wire live typing into inline results; retire #typeahead-dropdown. |
| /candidates + /committees typeahead retire | 0.5 day | Remove typeahead DOM + JS; rewire Enter-to-search; remove `Typeahead Result Clicked` event. |
| Nav input → button retire | 0.25 day | Replace input markup; rewire submit; retire `doNavTypeahead`, `bindSearchForm`, `__navSearchHandler`. |
| Amplitude wiring | 0.25 day | Add `Search Opened` (+ optional `Search Queried`); update from_page values consistently. |
| Test updates | 0.75–1 day | ~40+ test assertions touch `.typeahead-dropdown` across 4 search sites; rewrite/remove. Add new overlay-open/-close/popstate tests. |
| **Total** | **3.5–5 days** | |

### Incremental path

**Three-phase landing is viable.** Each phase ships independently and leaves the site in a coherent state:

**Phase 1 — `/search` inline-results consolidation (1 day)**
- /search page-mode: drop `#typeahead-dropdown`; live typing pushes results into `#state-results` directly.
- Isolates the shared-renderer extraction.
- No overlay yet. No nav changes. /candidates and /committees untouched.
- Ships a small, observable improvement (one less floating element on /search).

**Phase 2 — Overlay launch (2–3 days)**
- Build overlay chrome + open/close + focus management + popstate integration.
- Replace nav input with nav button.
- Add `Search Opened` event.
- Retire `#nav-typeahead-dropdown` + `doNavTypeahead`.
- /candidates and /committees still have their own in-page typeahead at this point (unchanged from today).

**Phase 3 — `/candidates` + `/committees` typeahead retire (0.5–1 day)**
- Remove in-page typeahead from both.
- Enter-to-search only.
- Retire `Typeahead Result Clicked` event for both.
- Tests cleaned up.

**Atomic vs. incremental trade-off:**
- Atomic: ships all the conceptual changes together; one user-facing event.
- Incremental: lower risk per landing; each phase observable in production before the next; can pause between phases if a problem surfaces.
- **Recommend incremental.** Phase 1 is structurally low-risk and proves the inline-results renderer pattern before the overlay depends on it.

### Highest bug-risk areas

In order of severity:

1. **popstate + profile-page hashchange interaction.**
   The codebase has zero `popstate` handlers today. Profile pages (candidate.html, committee.html) have `hashchange` listeners that drive `view.switchTo`. If the overlay's pushState changes the URL fragment, hashchange fires AND popstate fires on back, potentially in undefined order. Mitigation: overlay's URL strategy must NOT touch the URL fragment on profile pages (use the URL exactly as-is + state-only pushState, OR replace path entirely to `/search?q=...`). Easy to get wrong; needs explicit test coverage.
   **Listener location:** the popstate listener should live in `main.js` (one listener, every page loads main.js). It must guard with a state token (`pushState({overlay: true}, ...)`) so it ignores popstate events that aren't overlay-close transitions — otherwise it would close-the-overlay-which-is-already-closed on every browser back across any page, which is harmless but adds a spurious code path. Profile pages' hashchange listener stays put and is independent.

2. **Focus management.**
   - On open: focus moves to overlay input.
   - On close: focus restored to the nav button.
   - While open: Tab cycles through overlay elements only (focus trap).
   - aria-hidden on background page elements (or `inert` if browser support is acceptable).
   - Escape closes overlay.
   - Click outside overlay closes overlay (matches existing committees modal pattern).
   The committees modal in candidate.html has NONE of this today (no Escape, no focus trap, no aria-hidden). This is greenfield accessibility territory. Easy to ship a regression; needs Playwright a11y coverage.

3. **Mobile chrome question.**
   Today's mobile chrome has a dedicated `#top-nav-mobile-search` panel (separate from desktop) with its own input and submit. Under the overlay model, mobile gets the same overlay as desktop. The dedicated mobile-search-panel markup retires. The mobile search-toggle icon (`#top-nav-search-toggle`) stays as the icon-only affordance in the nav and becomes "open overlay" on tap. The mobile-nav drawer (Races + Feed) is unaffected. **Asymmetry note:** desktop replaces the existing `<input>` with a new icon + "Search" labeled button (consistent with the rest of the desktop nav links which use text); mobile keeps its existing icon-only toggle (consistent with mobile nav minimalism). Both fire the same overlay-open. **Risk:** iOS Safari virtual-keyboard behavior on an overlay-open input is its own pile of edge cases (URL bar resize, viewport units shifting, `100vh` height bugs). Untested in scope; will need manual mobile validation. Probable mobile shape: full-bleed overlay (covers global banner + nav), `body { overflow: hidden }` while open to prevent background scroll, dynamic viewport height (`100dvh` not `100vh`).

4. **Two-presentation conditional drift.**
   The shared inline-results renderer needs to render the same data into two different containers (overlay's body and /search's `#state-results`). If the markup contracts drift, the visual output diverges. Mitigation: shared renderer takes a container element as argument; both call sites pass their own.

5. **The "nav search button on /search page" oddity.**
   /search page-mode is the page-presentation of search. The nav has a search-button. Clicking it would open the overlay on top of /search-page. That's two search UIs on screen. Mitigations: hide the button on /search page-mode, OR show it but disable it ("Search" as current/disabled nav item, as the prompt language suggests). Tied to the broader "current/disabled nav item" question — no CSS rule exists today (`.nav-link.active` was retired). Needs a fresh visual treatment.

6. **Stale-response guard for overlay-typing-then-close.**
   User types "marie", a 300ms-debounced fetch fires, user closes overlay before the fetch resolves. The resolved Promise lands in a closed overlay. Mitigation: track a token (similar to the fetch-race token in `initViewSwitcher`); when token mismatches on resolve, discard. Small but easy to forget.

### Bug-risk areas NOT material

- **Result click → real navigation.** Standard `<a href>` clicks. Browser handles overlay-closing implicitly because new page loads. No mitigation needed.
- **View all → /candidates or /committees navigation.** Same as above.
- **API call shape.** No FEC API changes. Existing endpoints + concurrency queue handle this fine.
- **Count display.** Free from existing pagination response. Zero cost.

---

## 8. Open decisions for Sloane

### Decision 1: URL strategy on overlay open

What URL appears in the address bar when the overlay is open?

| Option | URL while open | Behavior on refresh | Trade-off |
|---|---|---|---|
| **(a) State-only pushState** | URL unchanged (e.g. `/candidate/X#2024#summary` stays) | Reloads current page; overlay closed | Conservative; no shareable "user was searching" link; back button still closes overlay |
| **(b) Push `/search?q=foo`** | URL becomes `/search?q=foo` | Loads /search page-mode | Shareable search URL; back goes to underlying page (one extra entry); URL ↔ visible state more honest |
| **(c) Append `?overlay=1`** | URL becomes e.g. `/candidate/X?overlay=1` | Re-opens overlay on cold load | **Reject** — produces orphan-style state on cold load |

**Recommended for surfacing:** (a) is the safest minimal change; (b) is more honest about state but adds history entries and complicates popstate logic. (c) is structurally problematic; flag and skip.

### Decision 2: `from_page` value for overlay-result clicks

Today's values include `'search'`, `'candidates'`, `'candidates_search'`, `'race'`, `'candidate-modal'`, etc.

Options:
- **(a)** Collapse: overlay and /search page-mode both use `from_page: 'search'`. Telemetry simpler; loses overlay vs page-mode distinction.
- **(b)** Distinguish: overlay uses `'search-overlay'`, /search page uses `'search-page'` (rename current `'search'`). More precise; historical continuity broken (existing `'search'` records become ambiguous).
- **(c)** Collapse with property: `from_page: 'search'` on both, plus a `presentation: 'overlay'|'page'` property. Cleanest; backward-compatible.

**Recommended for surfacing:** (c) is the most flexible, but (a) is the simplest and likely sufficient.

### Decision 3: Overlay-open event semantics

When does Amplitude get notified that the user is searching?

Options:
- **(a)** `Search Opened` event on overlay open. Properties: `from_page`. No per-query event.
- **(b)** `Search Opened` + `Search Queried` (per debounced query, with `query`). More granular but noisier.
- **(c)** Reuse `Page Viewed { page: 'search' }` on overlay open. **Reject** — corrupts the meaning of Page Viewed.

**Recommended for surfacing:** (a) for the launch; (b) can be added later if typing-pattern data becomes meaningful.

### Decision 4: Nav search-button visibility on `/search`, `/candidates`, `/committees`

The nav search-button replaces the nav input on every page by default. But:

- On `/search` page-mode: clicking the button would open the overlay on top of /search-page. Both UIs visible.
- On `/candidates` / `/committees`: clicking the button opens the overlay with empty input. User then searches in overlay, while the underlying page already has its own search/filter UI. Two search UIs simultaneously.

Options:
- **(a)** Always show the nav button. Accept the redundancy on `/search`, `/candidates`, `/committees`. Simple, consistent.
- **(b)** Hide the nav button on `/search`, `/candidates`, `/committees`. Each page's own search UI is the only affordance there. More principled, but breaks the "Search is always accessible from the nav" pattern that's been the project's discovery model.
- **(c)** Show as visually-current/disabled on `/search` (echoing the prompt's "Search shown as the current/disabled nav item"); show normally on `/candidates` and `/committees`. Hybrid.

**Recommended for surfacing:** (c) matches the prompt's stated intent for `/search`. The `/candidates` and `/committees` question is open — Sloane's prompt is silent on it. **Worth an explicit decision** before implementation.

### Decision 5: Pre-populate overlay input from underlying page state

If the user is on `/candidates?q=marie` and opens the overlay, should the overlay's input pre-populate with "marie"?

Options:
- **(a)** Always empty. Simpler; user always types fresh. The plan implies this.
- **(b)** Pre-populate from URL `?q=` if present (works on `/search`, `/candidates`, `/committees`, otherwise empty).
- **(c)** Pre-populate from the underlying page's in-memory search state (also covers cases where user typed but didn't push to URL).

**Recommended for surfacing:** (a) is the cleanest and what the rest of the plan implies. (b) is a small extension if Sloane wants it. (c) is genuinely cross-surface state coupling and would undermine the "overlay is independent" simplification. Strong recommend against (c).

### Decision 6: `.typeahead-dropdown` rename

After this work, `.typeahead-dropdown` is single-duty (combos only). The name is slightly misleading. Rename to `.combo-dropdown` (or similar)?

Options:
- **(a)** Bank as future polish. The current name is misleading but not harmful; the rename touches ~50+ markup sites + tests + docs for no functional gain.
- **(b)** Rename in this work. Atomic disentanglement.

**Recommended for surfacing:** (a). The triple-duty refactor's stated value was disentanglement; it's been achieved by retiring the search use. The remaining rename is cosmetic.

---

## 9. Additional risks, concerns, gaps, and questions not in the original prompt

Surfaced during investigation; worth flagging before scoping implementation.

### Accessibility

1. **No prior art for modal focus management.** The candidate.html committees modal has no focus trap, no Escape handler, no aria-hidden. Building this for the overlay is greenfield. Recommend a deliberate accessibility pass with Playwright a11y assertions; without it, the overlay will ship a regression vs. the in-flow nav search input it replaces (input is keyboard-accessible by default).
2. **`aria-controls="typeahead-dropdown"`** on `#search-input` (search.html line 94) needs updating when the typeahead retires. Easy miss.
3. **Screen-reader announcement of overlay open.** Modal needs `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (overlay header) + focus moved to input. None of this exists today.

### Mobile / cross-device

4. **iOS Safari virtual keyboard + overlay interaction.** Opening an input inside a fixed-position overlay on iOS causes Safari to scroll the input into view, resizing visible viewport. Whether the overlay's chrome (X button, results region) stays usable is untested. Needs manual mobile validation.
5. **Mobile-search-panel (`#top-nav-mobile-search`) retirement.** Today's mobile chrome has a dedicated mobile search panel separate from the overlay model. This retires under the overlay change. The mobile-search-toggle icon becomes "open overlay" on tap. Test coverage today asserts the mobile panel exists; needs rewriting.
6. **Mobile-nav drawer scope.** The drawer currently has only Races + Feed. Does "Search" appear in the drawer as an explicit menu item, or is it only reachable via the dedicated nav search-button? The prompt is silent on this.

### Tests + CI

7. **Test surface impact (grep-verified).** `grep -cn "typeahead-dropdown|search-typeahead|nav-typeahead" tests/*.js` returns **27 referencing lines across 3 spec files** (search.spec.js: 13, pages.spec.js: 12, shared.spec.js: 2). Many lines contain multiple assertions; gross assertion count is somewhat higher. Many of these tests are structural (assert presence + interaction); rewriting them is mechanical but bulk. Adding overlay-open/-close/popstate/focus-trap tests adds new test surface. Net test count effect: probably +5 to +20 (tests added > tests retired, given new accessibility coverage). The session before this one took the count from 593 to 573 by retiring `.nav-link.active`-related coverage. Worth budgeting time.
8. **Smoke tests against live FEC API** (npm run test:smoke) likely unaffected — they test API responses, not page chrome. Worth confirming.

### Performance / API behavior

9. **Stale-response guard inside overlay.** A 300ms-debounced fetch can land in a closed overlay. Need a token-based discard, matching the pattern in `initViewSwitcher`. Easy to forget; small bug surface.
10. **Concurrent typeahead fetches across overlay open/close cycles.** `apiFetch` has a MAX_CONCURRENT=4 queue. Repeatedly opening + typing + closing the overlay could queue stale fetches behind fresh ones. The queue itself handles this fine, but the staleness guard above must apply at the Promise resolution boundary.
11. **The 300ms debounce + the "5 candidates + 5 committees" parallel pair = 2 concurrent API calls per query.** Same as today's behavior. No new pressure.

### History API specifics

12. **`pushState` state object usage.** Currently `pushState({}, '', url)` and `pushState(null, '', url)` are both used. The overlay should pass a state token like `pushState({overlay: true}, '', url)` so the popstate handler can distinguish overlay-close pops from other pops (e.g. a profile-page hash navigation that also triggered pushState somewhere). This is a small detail that prevents popstate handlers from misfiring on unrelated history transitions.
13. **`history.scrollRestoration` interaction.** Profile pages set `history.scrollRestoration = 'manual'` (candidate.html:2232) so cycle clicks don't reset scroll. The overlay-close popstate fires after `scrollRestoration` settings have been applied; need to confirm the overlay open/close doesn't accidentally disturb scroll position on the underlying page. Likely fine, but worth a Playwright test.

### Conceptual / product

14. **Empty overlay state.** When overlay opens with empty input, what's shown? Current /search empty state was retired this past session (#state-empty wrapper removed). Today /search with no query renders the search bar and nothing below. The overlay can do the same — but this is also the moment to decide if the overlay should show a hint, recent searches, popular committees, or stay intentionally bare. The prompt is silent.
15. **Result-row hover style inside overlay.** /search currently renders results with the shared `candidateCardHTML` and `committeeRowHTML` helpers, which carry `:hover { background:var(--surface2) }`. Inside the overlay (which may have a different background), the hover style might need scoping. Small CSS detail.
16. **"Search" semantic on the nav-button.** Current pattern is the search-icon SVG + "Search" placeholder text in an input. The button replacement needs a label that reads as actionable without an input affordance. Icon-only is rare in this codebase; icon + "Search" text is more consistent with the rest of the nav.
17. **The /search page-mode "Search shown as the current/disabled nav item" treatment.** No `.nav-link.active` rule exists post-2026-05-20 retirement. This change re-introduces a need for "current section" visual treatment. Designing this is in scope of the overlay arc, not banked. Small but real.
18. **Telemetry shifts in `Page Viewed`.** Once the overlay ships, `Page Viewed { page:'search' }` will fire much less often (only on direct /search loads). Downstream reports filtering on this event need to know the volume shift is structural, not behavioral.
19. **Browser back from a search-result-clicked profile page back to the overlay state.** User opens overlay on /candidate/X → searches "marie" → clicks Marie Gluesenkamp Perez → lands on /candidate/H2WA03217 → hits back. Expected behavior? Goes back to... the overlay still open with "marie" in input on /candidate/X? Just /candidate/X with overlay closed? This depends on URL strategy (decision 1) and whether result clicks pushState or replaceState. Worth specifying.

### Documentation

20. **The CLAUDE.md "Navigation and IA architecture" + "Nav search typeahead" sections** describe today's behavior in detail. Both need substantial rewriting after this lands. ia.md's nav structure diagram needs updating. design-system.html's typeahead component card needs a major revision (or retirement). Doc work is non-trivial; ~half a day.

---

## 10. Decision points summary

Before implementation can be scoped, Sloane to resolve:

| # | Decision | Recommended default for surfacing |
|---|---|---|
| 1 | URL strategy on overlay open (state-only vs `/search?q=`) | (a) state-only — safer, smaller behavioral change |
| 2 | `from_page` for overlay-result clicks | (a) collapse to `'search'` — simplest |
| 3 | Overlay-open event semantics | (a) new `Search Opened` event; keep `Candidate Searched` for /search page-mode |
| 4 | Nav search-button visibility on `/search` / `/candidates` / `/committees` | (c) current/disabled on /search; visible on /candidates and /committees |
| 5 | Pre-populate overlay input from underlying page state | (a) always empty |
| 6 | `.typeahead-dropdown` rename | (a) bank as future polish |
| 7 | Empty overlay state (§9.14) | Stay bare for launch; revisit |
| 8 | Mobile-nav drawer "Search" menu item (§9.6) | No — nav-search-button is the affordance |
| 9 | Back-from-result-click destination (§9.19) | URL strategy decides this; reconfirm post-decision-1 |
| 10 | Result-click pushState vs replaceState in overlay context | Standard `<a href>` navigation (pushState by browser); no override |

Open question with no recommendation: **how does the overlay coexist with the in-page search/filter UI on /candidates and /committees?** The plan keeps both. That is the simplifying call that makes everything else clean. But it does ask the user to pick one of two search affordances on those pages. Worth confirming this is intentional before implementation.
