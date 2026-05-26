### strategy/search-overlay-implementation.md

**Status:** Implementation plan. Sloane review (one pass) before any code.
**Date:** 2026-05-21
**Builds on:** `strategy/search-overlay-feasibility.md` (diagnostic; all 10 open decisions now resolved).
**Scope:** Full-page search overlay. Three incremental tickets. Excludes Races/Feed nav pairing and search-input prominence (banked).

---

## Resolved decisions (carried from feasibility doc)

| # | Decision | Resolution |
|---|---|---|
| 1 | URL strategy on overlay open | **State-only `pushState`** — URL stays the underlying page; one history entry pushed; back closes overlay; refresh closes overlay; no shareable search URL |
| 2 | `from_page` for overlay-result clicks | **`'search'`** — overlay and /search page-mode collapse to one value |
| 3 | Overlay-open event | **`Search Opened`** on open; no per-query event; `Candidate Searched` kept for /search page-mode submits |
| 4 | Nav button visibility | **Current/disabled on /search; visible on /candidates and /committees** (and all other pages) |
| 5 | Overlay input pre-populate | **Always empty** |
| 6 | `.typeahead-dropdown` rename | **Banked** — not in this work |
| 7 | Empty overlay state | **Bare** for launch |
| 8 | Mobile drawer "Search" item | **No** — nav search-button is the affordance |
| 9 | Back-from-result-click | Falls out of #1 — back returns to the underlying page, overlay closed |
| 10 | Result-click navigation | Standard `<a href>`, no override |

**Router-avoiding simplification (restated for implementation):** /candidates and /committees remain normal standalone pages — NOT surfaces rendered inside the overlay. The overlay hosts only /search content. There is no multi-surface internal router. The overlay and the in-page search/filter UI on /candidates and /committees coexist (accepted redundancy per Decision 4).

---

## Ticket structure — recommendation: 3 separate tickets

The three phases ship as **three separate tickets**, not one ticket with phased commits.

**Rationale:**
- Phase 2 alone (overlay + nav swap across 10 files + popstate + focus a11y) is larger than a typical ticket in this project. Bundling all three produces a 3–5 day ticket with a sprawling review surface.
- The project's culture is small tickets (the T-load arc was ~8 discrete tickets). Each phase gets its own scope → review → test → closing-ritual cycle.
- Each phase is independently shippable and leaves the site coherent (verified per-phase below) — the precondition for separate tickets.

**Proposed ticket names:**
- **Ticket 1 — T-search-inline-results** (Phase 1)
- **Ticket 2 — T-search-overlay** (Phase 2)
- **Ticket 3 — T-search-typeahead-retire** (Phase 3)

**Within Ticket 2** (the heavy one), commits should be split for review tractability — proposed: (2a) `initSearchPanel` second consumer + overlay chrome markup/CSS, (2b) nav input → button swap across 10 files, (2c) popstate + focus-management + Amplitude. Each 2x commit leaves the tree green.

---

## Phase 1 — Ticket: T-search-inline-results

**SHIPPED 2026-05-21.** `initSearchPanel` in utils.js + search.html rewired to it; floating `#typeahead-dropdown` retired; `#state-error` added; `.refetching` soft-update indicator. 571/571 Track 1 green. Verified in-session via headless browser against live FEC data (golden path, soft-update, mobile, error). Sub-decisions confirmed as built: `onQuery` omitted; `#state-error` in scope; `.refetching` = 2px traveling-accent bar; `aria-live` polite count-summary region; `inert` deferred to Phase 2 (overlay scope). The factory works cleanly as /search's sole consumer — Phase 2 can build the overlay on it.

**Follow-up fix 2026-05-21:** the query-length threshold is **3, not 2** — the FEC API rejects keyword queries shorter than 3 characters (`q=ma` → "Invalid keyword…"). `MIN_QUERY_LENGTH = 3`; below it, `query()` goes straight to the bare state and fires no fetch. Phase 2's overlay reuses `initSearchPanel` and inherits the corrected threshold for free.

**Goal:** /search page renders live, debounced, as-you-type results inline in the page body (`#state-results`), retiring the floating `#typeahead-dropdown`. Establishes the shared search-panel renderer that Phase 2's overlay reuses.

### The shared factory — `initSearchPanel(config)`

New factory in `utils.js`, consistent with the existing `initComboDropdown` / `initViewSwitcher` / `initTabSection` pattern. Built shared-ready in Phase 1 even though /search is its only consumer until Phase 2.

**Contract (interface only — no implementation here):**

```
initSearchPanel(config) → { query(q), clear(), destroy() }

config:
  inputEl          — the search <input>
  resultsEl        — container for the two result groups (candidates + committees)
  loadingEl        — element shown during a first/cold query (no prior results)
  noResultsEl      — element shown when 0 results
  fromPage         — string for Amplitude from_page + ?from= on result hrefs ('search')
  onQuery          — optional callback(query) for Amplitude (Phase 1 unused)

Behavior:
  - Debounced 300ms input listener (wired internally on inputEl).
  - Each query: parallel fetch /candidates/ + /committees/ (per_page:5, sort:-receipts).
  - Stale-response guard: token incremented per query; resolved responses from a
    superseded token are discarded (matches initViewSwitcher's token pattern).
  - Renders candidate group + committee group via candidateCardHTML / committeeRowHTML.
  - "View all N →" affordance when pagination.count > 5 (count is free — same response).
  - Loading treatment: SOFT-UPDATE — if results are already visible, keep them
    visible during refetch with a subtle indicator (avoids per-keystroke flash).
    Show the full loadingEl only on a cold query (no prior results).
  - <2 chars → clear results, show bare state.
```

`renderCandidateGroup` / `renderCommitteeGroup` logic moves from search.html into this factory (they already depend on `candidateCardHTML` / `committeeRowHTML` in utils.js).

### File changes — Phase 1

| File | Change |
|---|---|
| `search.html` | Remove `#typeahead-dropdown` div + `showTypeahead`/`hideTypeahead`/`doTypeahead` + the click-outside-closes-typeahead listener. Wire `#search-input` to `initSearchPanel`. Keep `handleSubmit` (Enter pushes `/search?q=` for a shareable/reloadable URL — page-mode only). Update `__navSearchHandler` to route through the new path (nav input still exists in Phase 1). |
| `search.html` (a11y) | `#search-input` loses the popup-combobox ARIA (`role="combobox"`, `aria-haspopup`, `aria-expanded`, `aria-controls="typeahead-dropdown"`, `aria-autocomplete`) — the inline-results model is not a combobox-with-popup. `#state-results` gets `aria-live="polite"` so result-count changes are announced. Net: an a11y improvement, not just a port. |
| `utils.js` | Add `initSearchPanel` factory. |
| `styles.css` | Remove `.search-bar` from the `.search-bar .typeahead-dropdown, .search-combo …, .top-nav-search …` selector group (lines 767–769); the other two roots stay until Phase 2/3. Add a small soft-update loading-indicator rule if `.inline-status-msg` doesn't suffice. |
| `tests/search.spec.js` | Rewrite the ~13 typeahead-referencing lines: `#typeahead-dropdown` presence/interaction assertions → inline-results-on-live-typing assertions. |
| Docs | `design-system.html` typeahead card left intact (nav + browse typeaheads still exist); full revision deferred to Phase 3. CLAUDE.md search-architecture note updated. test-cases.md + TESTING.md per the closing ritual. |

### Shippability — Phase 1

/search works as a page with inline live results. Nav still has the old input + nav typeahead (untouched). /candidates, /committees untouched. **Coherent.** Ships a small standalone improvement (one fewer floating element) and de-risks the shared renderer before the overlay depends on it.

**Effort:** ~1 day.

---

## Phase 2 — Ticket: T-search-overlay

**SHIPPED 2026-05-21** in two commits — A (dormant chrome, `066ce34`) + B (activation). The plan's 2a/2b/2c didn't survive the interdependencies; the dormant-chrome → activation seam was used instead. Commit B: nav input→button swap across 10 files; open/close + state-only history (popstate/pageshow); focus management (trap + `inert` + restore); `Search Opened` event; nav-typeahead retirement; `/search` current-state button. `utils.js` added to process-log.html + design-system.html (the overlay needs `initSearchPanel` on every nav page). 565/565 Track 1 green; verified live (desktop open/type/results/close, /search no-op, mobile, profile-page hashchange-safe). Banked follow-ups (Races/Feed nav pairing, search-input prominence) remain out of scope.

**Goal:** Build the overlay; replace the nav search input with a nav button; retire the global nav typeahead. Overlay reuses `initSearchPanel`.

### History model (precise spec)

State-only `pushState`. All close paths route through `history.back()`; the popstate handler is the single close implementation.

```
openOverlay():
  - lastFocused = document.activeElement   (the nav search-button)
  - history.pushState({ overlay: true }, '', location.href)   ← same URL, fragment included
  - show overlay DOM; inert/aria-hidden the background
  - move focus into the search input
  - amplitude.track('Search Opened', { from_page })

close paths — X button, Escape, click-outside:
  - all call history.back()   (they do NOT hide the DOM directly)

popstate handler (main.js):
  window.addEventListener('popstate', e => {
    if (overlayIsOpen() && !(e.state && e.state.overlay)) closeOverlayDOM();
  });

closeOverlayDOM():
  - hide overlay DOM; remove inert/aria-hidden from background
  - restore focus to lastFocused
  - (does NOT touch history — the pop already happened)

pageshow handler (main.js) — bfcache hardening:
  window.addEventListener('pageshow', e => { if (e.persisted) closeOverlayDOM(); });

init: overlay always starts closed; history.state is NOT consulted on load.
  → refresh closes the overlay (satisfies Decision 1).
```

**Why this satisfies the constraints:**
- `pushState` uses `location.href` verbatim — **the URL fragment never changes**. On profile pages, `hashchange` therefore never fires due to overlay activity; the profile-page `hashchange` → `view.switchTo` listener stays dormant. This is the core hashchange-coordination property.
- X / Escape / click-outside / browser-back all produce identical close behavior (all → `history.back()` → popstate → `closeOverlayDOM`).
- Refresh-while-open: init starts closed, `history.state` ignored on load → overlay closed.
- bfcache restore (back from a result page into an overlay-open entry): `pageshow[persisted]` snaps the overlay closed — deterministic regardless of bfcache vs full reload.
- The `{overlay:true}` token gates the popstate handler (per Sloane's instruction); the `overlayIsOpen()` DOM check is the primary guard, the token is the defensive secondary.

### Overlay chrome

- **Markup placement:** injected by `main.js` at DOMContentLoaded (single source, hidden by default), rather than statically duplicated into 10 HTML files. *Sub-decision flagged below — confirm in review.*
- **Structure:** `role="dialog"` + `aria-modal="true"` + `aria-labelledby`; an X close button (`aria-label="Close search"`); the search input; the inline results region (the same shape `initSearchPanel` renders into on /search).
- **Mobile:** full-bleed (covers banner + nav), `body { overflow:hidden }` while open, `100dvh` height (not `100vh` — iOS Safari).
- **UI build uses the `frontend-design` skill** per CLAUDE.md (new component + new nav button + design-system card).

### Nav button swap

- Replace the `.top-nav-search` form + `<input>` with a search **button** (icon + "Search" text on desktop — consistent with the Races/Feed text nav links).
- Mobile: the existing icon-only `#top-nav-search-toggle` stays as-is in markup but rewires to open the overlay; the dedicated `#top-nav-mobile-search` panel markup is removed.
- Decision 4(c): on **/search**, the nav button renders in a **current/disabled** state. No `.nav-link.active` rule exists (retired 2026-05-20) — Phase 2 introduces a fresh "current section" visual treatment (design-system addition).

### File changes — Phase 2

| File | Change |
|---|---|
| All 10 HTML files | Nav markup: `<input>` form → search `<button>`; remove `#nav-typeahead-dropdown`; remove `#top-nav-mobile-search` panel. |
| `search.html` | Nav button in current/disabled state; retire `__navSearchHandler`. |
| `main.js` | Remove `buildTypeaheadHTML`, `showNavTypeahead`, `hideNavTypeahead`, `doNavTypeahead`, `bindSearchForm`, nav-input wiring. Add: overlay inject, `openOverlay`/`closeOverlayDOM`, focus trap, popstate + pageshow handlers, nav-button + mobile-toggle click wiring. Overlay's search panel = `initSearchPanel` (from utils.js) wired to the injected overlay elements with `fromPage:'search'`. |
| `styles.css` | Overlay component CSS; nav search-button CSS; "current section" nav treatment; remove `.top-nav-search .typeahead-dropdown` selector + nav-typeahead inner rules no longer referenced. |
| `design-system.html` | New overlay component card; new nav-button card; "current section" treatment; trim nav-typeahead demo content. |
| `tests/` | New: overlay open/close, popstate-closes-overlay, X/Escape/click-outside parity, refresh-closes-overlay, focus-trap + focus-restore (a11y), `aria-modal` present, overlay-on-profile-page does-not-fire-hashchange. `shared.spec.js`: the 10-page nav assertions update (button not input; no mobile-search panel). Retire nav-typeahead assertions. |
| Docs | CLAUDE.md nav/IA + search sections rewritten; ia.md nav diagram; project-brief MVP nav note. |

### Shippability — Phase 2

Overlay live globally. Nav button everywhere. /search = inline results + current/disabled nav button. /candidates + /committees = nav button opens overlay AND they still carry their own in-page typeahead (untouched until Phase 3 — and this dual-search is the accepted end state per Decision 4). **Coherent.**

**Effort:** ~2–3 days. Highest-risk work (popstate, focus a11y).

---

## Phase 3 — Ticket: T-search-typeahead-retire

**SHIPPED 2026-05-21.** One commit. /candidates + /committees are enter-to-search only — the in-page filter-field typeahead is retired (`#search-typeahead` div, `fetchTypeahead`/`renderTypeahead`/`closeTypeahead`, the debounced `input` listener, the click-outside listener, and the keydown `Escape` branch all removed). Shared `FEC_MIN_KEYWORD_LENGTH = 3` constant added to utils.js (replaces `initSearchPanel`'s local `MIN_QUERY_LENGTH`); both browse pages guard the top of `doFetch` so a sub-3-char `activeQ` normalizes to `''` → browse mode rather than 422-ing. `?q=` pre-fill verified intact (the carried-in non-negotiable — covered by the existing "search input is populated with the query" search-mode tests). Final `.typeahead-dropdown` inner-class CSS sweep done (kept `.typeahead-dropdown` + `.typeahead-row` + `.status-dot` for the combo dropdowns). 561/561 Track 1 green (565 → 561, net −4: 8 typeahead tests → 4 enter-to-search tests). The search-overlay arc is complete.

**Goal:** Remove the in-page typeahead from /candidates and /committees (enter-to-search only). Final `.typeahead-dropdown` inner-class CSS sweep.

### File changes — Phase 3

| File | Change |
|---|---|
| `candidates.html` | Remove `#search-typeahead` div + `fetchTypeahead`/`renderTypeahead`/`closeTypeahead` + the typeahead `input` listener + click-outside-closes listener. Keep `submitSearch` (Enter + `#search-btn` click) — enter-to-search stays. Retire the `Typeahead Result Clicked` event. |
| `committees.html` | Same as candidates.html. |
| `styles.css` | Final sweep — now that all 4 search-typeahead instances are gone, retire the inner classes no longer referenced: `.typeahead-row-left/right/id`, `.typeahead-status-dot` (+ `.dot-active`/`.dot-terminated` variants on it), `.typeahead-group-label`, `.typeahead-empty`, `.typeahead-loading`. **Keep** `.typeahead-row` and `.typeahead-dropdown` (combo dropdowns still use them). `.status-dot` (non-typeahead-prefixed) stays. |
| `design-system.html` | Typeahead component card: revise to reflect combo-dropdown-only usage, or split/retire the search-typeahead portion. |
| `tests/pages.spec.js` | Retire the ~12 typeahead-referencing lines for /candidates + /committees. |
| Docs | CLAUDE.md typeahead notes; test-cases.md; TESTING.md count. |

### Carried-in items — must be verified in Phase 3

Two items folded in from the T-search-overlay follow-up investigation (2026-05-21):

1. **3-char FEC keyword minimum — enter-to-search must enforce it.** The investigation found `fetchTypeahead`'s input listener on /candidates + /committees fires a fetch at **2** characters, but the FEC API rejects keyword queries shorter than **3** (`/committees/?q=ma` → 422, confirmed; 3-char queries → 200). Deleting `fetchTypeahead` removes the live-typing path that exposed this — but Phase 3 keeps **enter-to-search**, and the submit path still needs the guard. Wherever the browse pages' submit handler builds its FEC query (`doFetch` / `submitSearch` setting `params.q = activeQ`), it must not dispatch a request when `activeQ` is 1–2 chars. **Verification:** console clean on /candidates and /committees — zero sub-threshold (<3-char) requests reach `/api/fec/` — tested at 0/1/2/3 characters via the in-page search field's submit and any remaining input path. (Don't let the `MIN_QUERY_LENGTH=3` lesson get dropped just because the typeahead that exposed it is being deleted.)

2. **`?q=` pre-fill on the browse pages — UX continuity.** When the in-page typeahead is removed and /candidates + /committees move to enter-to-search, verify the in-page search field **pre-fills from the `?q=` URL param** on load. A user arriving via a "View all N →" click lands on `/candidates?q=mar` — the field should show "mar". This also covers the overlay back-button asymmetry: a user who opens the overlay, clicks "View all", then presses browser-back lands on the page that was under the overlay (expected — the overlay is ephemeral per Decision 1, not reconstructable). The `?q=` pre-fill is what keeps the browse pages' search visible across that transition rather than silently lost. (The browse pages already read `?q=` into `activeQ` on init — confirm the input element's `.value` is set too, and that this still holds after the typeahead removal.)

### Shippability — Phase 3

/candidates + /committees are enter-to-search only; combo dropdowns unaffected. Final CSS cleaned. **Coherent.**

**Effort:** ~0.5–1 day.

### Approved implementation prompt — T-search-typeahead-retire

*Surfaced + approved 2026-05-21. All three clarifications resolved (below). One commit, no phased split — no interdependencies.*

**Goal:** /candidates + /committees become enter-to-search only; remove the in-page filter typeahead; final `.typeahead-dropdown` inner-class CSS sweep. Touches no shared behavioral code (the overlay / `initSearchPanel` are untouched).

**Confirmed code state (both files structurally identical):** `#search-typeahead` div (line 68); `submitSearch` (515 / 454, calls `closeTypeahead()`); keydown listener — Enter→`submitSearch`, Escape→`closeTypeahead` (522–523 / 461–462); `#search-btn` click→`submitSearch` (525 / 464); debounced `input` listener with `if (val.length < 2)` (534 / 473); `fetchTypeahead` (538 / 477); `renderTypeahead` + the `Typeahead Result Clicked` event (545 / 484); `closeTypeahead` (562 / 503); document click-outside listener (567 / 508); `init()` already pre-fills the field from `?q=` via `f-search').value = activeQ` (613 / 537).

**1. candidates.html + committees.html — identical change to both.** Remove: the `#search-typeahead` div; `typeaheadTimer`; the debounced `input` listener; `fetchTypeahead`; `renderTypeahead` (+ `Typeahead Result Clicked`); `closeTypeahead`; the click-outside listener. Keep: `submitSearch`, the `#search-btn` click listener, the keydown `Enter → submitSearch` branch. Drop the keydown `Escape → closeTypeahead()` branch and the `closeTypeahead()` call inside `submitSearch` (both now dead).

**2. The 3-char FEC keyword guard (carried-in item 1).** The FEC API rejects keyword queries < 3 chars (`/committees/?q=ma` → 422; 3-char → 200). Removing `fetchTypeahead` kills the live-typing path, but enter-to-search still builds an FEC query from `activeQ`, and `?q=` can carry a 1–2 char value. **Resolved (Clarification 1): sub-3-char submit → browse mode.** A 1–2 char `activeQ` is normalized to `''` so `doFetch` goes the browse path (`sort:'name'`, no `params.q`) and chips/header read as "showing all" — *not* "results for 'ma'". No 422, no error UI, no new hint state to design. **Resolved (Clarification 2): add a shared `FEC_MIN_KEYWORD_LENGTH = 3` constant to `utils.js`**, referenced by both `initSearchPanel`'s guard and the browse-page guard — single named source for the FEC rule (it has been the same off-by-one twice). Guard the point where `activeQ` is consumed so it covers both the `submitSearch` path and the `?q=` init path.

**3. `?q=` pre-fill — VERIFY, do not rebuild (carried-in item 2 — the subtlest risk in this ticket).** `init()` on both pages already sets `f-search'.value = activeQ` when `?q=` is present — a "View all N →" arrival at `/candidates?q=mar` shows "mar" in the field today. The failure mode is **mechanical**: that pre-fill line sits in the *same `init()` region* as the typeahead code being removed and can get swept out alongside the deletion because it is adjacent. **Treat the `?q=` pre-fill as a non-negotiable verification item** — if it regresses, the overlay → "View all" → browser-back search continuity silently breaks and nothing else in the ticket catches it. Confirm the `f-search'.value = activeQ` line survives, on both files, and is exercised by a test.

**4. styles.css — final inner-class sweep.** All four search-typeahead instances now gone. Retire: `.typeahead-row-left`, `.typeahead-row-right`, `.typeahead-row-id`, `.typeahead-status-dot` (+ its `.dot-active`/`.dot-terminated` compound selectors — keep the non-prefixed `.status-dot` + variants, used by `committeeRowHTML`), `.typeahead-group-label`, `.typeahead-empty`, `.typeahead-loading`. Keep `.typeahead-row` + the `.typeahead-dropdown` base rule (combo dropdowns still use them). The `.typeahead-dropdown` → `.combo-dropdown` rename stays banked (Decision 6).

**5. design-system.html.** Revise the Typeahead Dropdown card — after this ticket the class is combo-dropdown-only. Retire specimen-list references to the swept inner classes.

**6. Tests.** Retire the `candidates.html — typeahead` / `committees.html — typeahead` describe blocks in `pages.spec.js`. Add: enter-to-search works (3+ chars + Enter → results); the **3-char guard regression-lock** — a 1–2 char submit fires zero `/api/fec/` requests and shows no error, tested at 0/1/2/3 chars; **`?q=` pre-fills the field on load** (the carried-in regression-lock for the pre-fill line).

**7. Verification.** `npx playwright test` green. `npm run dev` browser check on /candidates + /committees: console clean — **zero sub-threshold (<3-char) requests reach `/api/fec/`** at 0/1/2/3 chars via the search field's submit; 3-char fetches + renders; **`?q=mar` URL pre-fills the field (non-negotiable — verify on both pages)**; sub-3-char submit visibly shows browse mode (chips/header say "showing all", not "results for 'ma'"); combo filters (state/office/party/cycle/type) unregressed.

**One commit** (Clarification 3 — no interdependencies, no broken intermediate state). Standard per-commit wrap-up + docs.

---

## The `.typeahead-dropdown` retire sweep — sequenced

The feasibility doc found ~51 references across 13 files + ~6 inner-class CSS rules. The sweep is **sequenced across all three phases** — each phase retires its own instances; the inner-class CSS can only fully retire in Phase 3 because the inner classes are shared across instances that retire at different times:

| Instance | Retired in | Notes |
|---|---|---|
| `#typeahead-dropdown` (/search floating) | Phase 1 | Element + `.search-bar .typeahead-dropdown` selector |
| `#nav-typeahead-dropdown` (×10 pages) | Phase 2 | Element ×10 + `main.js` nav-typeahead fns + `.top-nav-search .typeahead-dropdown` selector |
| `#search-typeahead` (/candidates) | Phase 3 | Element + JS |
| `#search-typeahead` (/committees) | Phase 3 | Element + JS |
| Inner classes (`.typeahead-row-left` etc., ~6 rules) | **Phase 3** | Shared across the above — only fully unreferenced after the last instance goes |
| `.typeahead-dropdown` base rule + `.typeahead-row` | **Kept** | Combo dropdowns (state/office/party/cycle/type/year) still use them |

Each ticket's closing ritual includes a grep to confirm no dangling references to its retired instances.

---

## Cross-phase risks + required test coverage

### popstate / hashchange coordination (Phase 2 — highest risk)

The state-only URL strategy means overlay activity never touches the URL fragment, so `hashchange` never fires from overlay open/close. Required tests:

- **Profile-page test:** load `/candidate/{id}#2024#summary`, open overlay, close via back — assert the cycle/tab did not change and `view.switchTo` was not invoked (overlay activity must not trigger the profile-page hashchange listener).
- popstate closes the overlay (open → simulate back → assert closed).
- X button, Escape, click-outside all close identically (all route through `history.back()`).
- Refresh-while-open → overlay closed on reload.
- Result click is a real navigation; back from the result page lands on the underlying page with the overlay closed (bfcache `pageshow` hardening covered).

### Focus management — greenfield, in-scope (Phase 2)

No prior art — the candidate.html committees modal has no focus trap, no Escape, no `aria-modal`. The accessibility pass is **Phase 2 in-scope work, not a follow-up.** Required:

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` on the overlay.
- Background made inert (`inert` attribute; conceptually `aria-hidden` is the fallback) while open.
- Focus moves to the search input on open.
- Focus trapped within the overlay (Tab from last focusable wraps to first; Shift+Tab reverse).
- Escape closes.
- Focus restored to the nav search-button on close.
- Playwright a11y assertions for each of the above.

### Test-count trajectory

Phase 1: small net change (typeahead assertions rewritten in place). Phase 2: net positive (overlay + a11y tests added > nav-typeahead tests retired). Phase 3: net negative (typeahead assertions retired). Overall likely +5 to +15 from the current 573. Each ticket's closing ritual runs `npx playwright test` and appends a test-log row.

---

## Sub-decisions surfaced during planning (confirm in the review pass)

These are smaller than the 10 resolved decisions but affect the build. Recommendations given; redirect freely.

1. **Overlay markup placement** — recommend **`main.js` injection** (single source; the overlay is purely behavioral and identical everywhere). Alternative: static-duplicate into 10 files (matches the nav's existing duplication pattern but is heavier to maintain). *Recommend injection.*
2. **Live-typing loading treatment** — recommend **soft-update** (keep prior results visible during refetch with a subtle indicator; full loading state only on a cold query). Avoids per-keystroke flash. *Recommend soft-update.*
3. **`#search-input` on /search loses combobox ARIA** — the inline-results model is not a combobox-with-popup; recommend a plain search input + `aria-live="polite"` results region. *Recommend the a11y change as described.*
4. **/search page-mode Enter behavior** — recommend **keep** `handleSubmit` pushing `/search?q=` (the page's URL should reflect its query for reload/share). Overlay Enter is a no-op (results are live; user clicks). *Recommend keep on page, no-op in overlay.*
5. **`inert` vs `aria-hidden`** for the background while overlay open — recommend **`inert`** (baseline-supported; removes from tab order + a11y tree in one attribute).

---

## Open dependency note

`initSearchPanel` is authored in Phase 1 with a deliberately two-consumer contract (container elements passed in), even though only /search consumes it until Phase 2. This avoids a Phase 2 refactor of the renderer. If the review wants the factory contract finalized before Phase 1 starts, that is the one cross-phase coupling worth pinning down up front.
