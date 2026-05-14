# T15 follow-up — Back affordance semantics: browser-scoped vs entity-scoped

> **BANKED 2026-05-11.** Investigation complete; decision made (browser-scoped). Implementation waits for T23 (entity cycle-index navigation affordance). Shipping browser-scoped semantics without T23 creates a UX regression for fresh-load users — no way to reach the entity cycle index without knowing the `#cycles` hash. T23 investigation may also surface design considerations that affect this work, so both should be scoped together.

---

## Context

T15 (commit `ba2815d`, 2026-05-11) shipped the back affordance with **entity-scoped semantics**: clicking the chevron always returns to *this entity's* cycle index, regardless of how the user arrived. Implementation branches on `view.wasIndexShown()`:

- **In-session** (user has visited this entity's cycle index this session): `history.back()` — lands on the prior index URL via the existing hashchange listener.
- **Fresh-load** (user landed directly on detail URL): `history.replaceState('', '', location.pathname)` + `view.switchTo(false, NaN)` — direct in-place transition to cycle index.

The aria-label is "Back to all cycles."

This works for the single-entity flow (cycle index → cycle detail → back) but produces a confusing result for cross-entity flows: clicking back lands on the current entity's cycle index, not on the page the user came from.

## Motivating cross-entity flows

Three real cross-entity flows in the product where entity-scoped semantics are wrong:

1. **Race page → candidate detail.** A user bouncing between candidates from a race overview expects back to return to the race page, not to each candidate's cycle index. This was the original prompt's motivating example.

2. **Candidate → committees modal → committee profile.** A user reviewing a candidate clicks into one of their associated committees (the modal surfaces a real navigation, not just disclosure). Today's entity-scoped: clicking back on the committee lands on its cycle index — confusing if the user came from the candidate. Browser-scoped: lands on the candidate, matching mental model.

3. **Committee → associated-candidate section → candidate profile.** Reverse of #2. Common on leadership PAC and authorized-committee profiles. Same dynamic.

All three reinforce the case for browser-scoped semantics.

## Predictability re-frame

Sloane's original framing in T15 investigation was that browser-scoped semantics are *less* predictable than entity-scoped because behavior becomes context-dependent. That framing is backwards — banking the correction here:

The universally-understood semantic for a chevron-left button is "go back to the previous page" — meaning the previous thing the user saw, which is browser-back. **Entity-scoped is the surprising behavior**, not browser-scoped. Today's affordance can take the user somewhere different from what browser-back would do; users have to learn the difference.

Browser-scoped aligns the affordance with the user's existing browser-back mental model. No new mental model required. The "discoverability" goal T15 was buying — surfacing the back navigation in the page chrome — pays off most when the discovered behavior matches what users already expect from browser-back.

## Investigation findings

### Detection signal — `document.referrer` parsed against `location.origin`

```js
var sameOriginReferrer = document.referrer
  && new URL(document.referrer, location.origin).origin === location.origin;
```

`document.referrer` is reliable when the user clicked a same-origin link or navigated within the site. It's empty or external when the user typed the URL, used a bookmark, came from a search engine that strips referrer, came from a social link with `noreferrer`, or used a private-browsing mode that strips referrers. This maps exactly to the "internal vs fresh-load" gate we want. No `sessionStorage` needed for the primary case.

### Edge case: multi-tab open via middle-click

User on race page middle-clicks a candidate → new tab opens with candidate detail. `document.referrer` is populated (race page URL), but `history.length === 1` (only entry in this tab). `history.back()` does nothing visible — silently fails. Fix: gate on `history.length > 1 && sameOriginReferrer`. If either fails, fall back to entity cycle index.

### Edge case: cycle-switch within the same entity

`loadCycle()` uses `history.replaceState`, not `pushState`. Cycle-switching doesn't add history entries; `history.back()` walks across full page navigations only. No history pile-up. Today's behavior survives unchanged.

### Edge case: cycle-row click from index → detail

Anchor click (`<a href="#YYYY#summary">`) creates a real history entry. `history.back()` from detail to index already works (T15's in-session case relies on it). Survives unchanged. **This is the no-regression case for the cycle-index → cycle-detail → back flow that motivated T15 in the first place.**

### Edge case: external entry with third-party referrer

Someone links to FECLedger from a blog. `document.referrer` is the blog. `sameOriginReferrer === false` → falls into the fresh-load branch → entity cycle index. Browser back from this entry would exit the site, but the affordance correctly keeps the user within FECLedger by falling to the entity cycle index. This is a thoughtful divergence from a literal browser-back wrapper.

### History stack: race → candidate A → candidate B → back

`history.back()` walks one entry at a time. From candidate B, back goes to candidate A. From A, back goes to race. This is correct browser-back behavior, and users expect it. The discoverability of the affordance + same behavior as the browser button is exactly the goal — not a different behavior.

### The `wasIndexShown()` flag

The flag we added to `initViewSwitcher` in T15 becomes *secondary* under browser-scoped. The primary signal is `document.referrer`. `wasIndexShown` can stay as a belt-and-suspenders signal for the rare "internal in-tab nav with empty referrer" case (exists in some privacy modes) — or get removed.

**Mild preference: remove.** The referrer + `history.length` check covers the same cases more reliably, and unused API surface in helpers tends to drift. Banked for the implementation pass.

## Decisions

1. **Semantics: browser-scoped.** Detection via `document.referrer` same-origin check + `history.length > 1`. Falls back to entity cycle index when either check fails (matches today's fresh-load behavior).

2. **aria-label: "Back".** Non-optional under browser-scoped semantics; "Back to all cycles" specifies a destination that often won't be true. "Back" matches the universal browser-back semantic without specifying a destination.

3. **Visual treatment: unchanged.** The chevron-left icon is the universally-recognized back signal. No new visual treatment, no hover tooltip, no dynamic aria-label — the user's existing mental model is already correct.

4. **`wasIndexShown()`: remove during implementation.** Banked. If implementation reveals a real edge case the referrer signal misses, retain as backup.

## Dependency: T23

Shipping browser-scoped without T23 creates a UX regression for users who land on cycle detail via a fresh-load (shared URL, external entry, search engine, direct nav). Today's entity-scoped behavior gives those users a one-click path to the cycle index. Browser-scoped gives them a back-to-blog or back-to-search-engine path, with no in-product way to reach the cycle index unless they know the `#cycles` hash.

T23 is the entity cycle-index navigation affordance investigation (banked separately). It needs to land before or with the semantics change so fresh-load users still have a direct path to the entity cycle index.

T23's investigation may also surface design considerations that affect this work (placement of both affordances in the masthead, whether they share a slot or are siblings, how compact-state handles two affordances). Worth scoping together rather than serially.

## Banked: race-page back affordance

T15 only added the back affordance to candidate.html + committee.html. Race.html and the browse pages don't have one. The race → candidate → back motivating flow works as imagined because the affordance lives on the candidate, where the user lands.

Whether to add a back affordance to race.html is a separate scope question, banked for a future race-page ticket (placeholder name "T-RacePage"). Race is currently a cycle-anchored single-view page (no index/detail split), so the affordance would need a different shape than candidate/committee — possibly a "Back to races" or "Back to {origin}" call. Investigation needed; out of scope for T15 follow-up.

## Estimated implementation footprint

When T23 unblocks this:

- **utils.js**: optionally remove `indexShown` flag + `wasIndexShown()` method (~5 lines). Or leave as backup signal.
- **candidate.html + committee.html**: replace click-handler logic with same-origin referrer check + `history.length > 1` gate (~5 lines each). Update `aria-label` markup from "Back to all cycles" → "Back".
- **design-system.html**: Back Affordance card aria-label and notes update.
- **CLAUDE.md**: profile-header description update (~1 sentence) + `initViewSwitcher` description update if removing `wasIndexShown`.
- **Tests**:
  - `candidate.spec.js` + `committee.spec.js`: aria-label assertion updates.
  - Existing "fresh-load detail returns to cycle index" tests still pass (fresh-load case unchanged).
  - Add in-session same-origin case: set up navigation from one page to another in Playwright; assert back goes to first page.
  - ~2-3 new tests per page.

Total: ~30 LOC change + test updates. Smaller footprint than T15 itself.

---

## Code shape

### Today's click handler (candidate.html lines 2213-2220; identical shape at committee.html lines 736-743)

```js
document.getElementById('back-affordance-btn').addEventListener('click', function() {
  if (view.wasIndexShown()) {
    history.back();
  } else {
    history.replaceState('', '', location.pathname);
    view.switchTo(false, NaN);
  }
});
```

### Proposed replacement

```js
document.getElementById('back-affordance-btn').addEventListener('click', function() {
  var sameOriginReferrer = document.referrer
    && new URL(document.referrer, location.origin).origin === location.origin;
  if (sameOriginReferrer && history.length > 1) {
    history.back();
  } else {
    history.replaceState('', '', location.pathname);
    view.switchTo(false, NaN);
  }
});
```

### aria-label change

`candidate.html:116` and `committee.html:114`:
```html
<button class="back-affordance-btn" id="back-affordance-btn" type="button" aria-label="Back to all cycles">
```
→
```html
<button class="back-affordance-btn" id="back-affordance-btn" type="button" aria-label="Back">
```

### `wasIndexShown()` removal mechanics

If removing (mild preference per decisions above):

- `utils.js:544` — delete `var indexShown   = false;`
- `utils.js:599` — delete the `indexShown = true;` line at start of `switchTo`'s else branch (keep the comment-block intent or rewrite to reflect new state)
- `utils.js:624` — delete `wasIndexShown: function() { return indexShown; }` from the return object
- `utils.js:525-528` — update the JSDoc-style return-description comment block to drop `wasIndexShown` and the explanation paragraph beneath it

If retaining (belt-and-suspenders): keep all of the above; treat `wasIndexShown()` as a secondary signal, OR'd with `sameOriginReferrer` in the click handler. Today's tests would still pass.

## Scroll-restoration note

For in-entity back (cycle detail → cycle index on the same entity), the existing `indexScrollY` mechanism in `initViewSwitcher` continues to handle scroll restoration — same path as today. `history.back()` fires hashchange → listener calls `view.switchTo(false, NaN)` → helper's else branch scrolls to `indexScrollY`.

For cross-entity back (race → candidate → back to race, or candidate → committee → back to candidate), `history.back()` triggers a full page navigation. Each page's scroll behavior is governed by its own document's `history.scrollRestoration` setting. Candidate/committee set `'manual'` (so their own popstate doesn't auto-restore). Race.html and the browse pages don't set the property, so they get browser-default behavior — auto-restore — which is what users expect when returning to a list/race overview. No additional scroll-restoration logic needed.

## Verification checklist (manual browser)

Run before declaring the implementation done. Setup: `npm run dev`, open http://127.0.0.1:8788/.

1. **Cross-entity: race → candidate → back to race.** Visit `/race?state=WA&office=H&district=03&year=2026` → click a candidate card → on candidate detail, click back affordance. Expect: race page with the same filters.

2. **Cross-entity: candidate → committees modal → committee → back to candidate.** Visit `/candidate/H2WA03217#2024#summary` → click "Committees →" → click a committee row in the modal → on committee detail, click back affordance. Expect: candidate detail page.

3. **Cross-entity: committee → assoc-candidate → back to committee.** Visit a committee with an associated candidate (e.g. `/committee/C00806174#2024#summary`) → click the associated-candidate card → on candidate detail, click back affordance. Expect: committee detail page.

4. **In-entity, no regression: cycle index → cycle detail → back to cycle index.** Visit `/candidate/H2WA03217` (bare URL → index) → click a cycle row → on cycle detail, click back affordance. Expect: cycle index, scroll position restored to where the cycle row was clicked.

5. **Fresh-load fallback: paste detail URL in new tab → back affordance lands on cycle index.** Open a new tab, paste `/candidate/H2WA03217#2024#summary`, click back affordance. Expect: cycle index for the entity, top of page (history.length === 1 + no internal referrer → fallback fires).

6. **Multi-tab open fallback: middle-click from race to candidate → back lands on cycle index.** Visit race page, middle-click a candidate (new tab opens to detail), click back affordance in the new tab. Expect: cycle index (history.length === 1 even though referrer is same-origin → fallback fires).

7. **aria-label.** DevTools accessibility tree on cycle detail confirms the button announces as "Back" (not "Back to all cycles").

## Reference

- **T15 implementation commit:** `ba2815d` — initial back-affordance ship (entity-scoped).
- **T15 revert commit:** `b6bf7c5` — reverted the `.candidate-race-label` restyle (kept the meta-row relocation).
- **`.candidate-race-label` retired** (commit `36dd48f`, 2026-05-14) — replaced with a short-form `.tag.tag-neutral` race tag in the meta-row, resolving the banked visual mismatch. Independent of T15 back-affordance work; flagged here so the strategy doc stays consistent with current production.
- **T15 compact-height follow-up:** `e97e2fd` — `min-height:48px` on combined `.compact` headers.
- **This doc:** `493d36e` (initial bank) — captures decisions for the eventual implementation pass.

**File:line pointers (current state, post-T15):**

| Surface | File | Line(s) |
|---|---|---|
| Click handler (candidate) | `candidate.html` | 2213-2220 |
| Click handler (committee) | `committee.html` | 736-743 |
| `aria-label` markup (candidate) | `candidate.html` | 116 |
| `aria-label` markup (committee) | `committee.html` | 114 |
| `initViewSwitcher` return-block JSDoc | `utils.js` | 525-528 |
| `indexShown` declaration | `utils.js` | 544 |
| `indexShown = true` set | `utils.js` | 599 |
| `wasIndexShown()` accessor | `utils.js` | 624 |
| Back-affordance tests (candidate) | `tests/candidate.spec.js` | 113-150 |
| Back-affordance tests (committee, detail) | `tests/committee.spec.js` | 81-104 |
| Back-affordance test (committee, index) | `tests/committee.spec.js` | 269-273 |

Line numbers may drift before this is picked up — use the symbol/string anchors (`back-affordance-btn`, `wasIndexShown`, `indexShown`) to re-locate if so.
