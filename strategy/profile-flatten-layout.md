# Profile flatten + re-organize — spec & build plan

> **STATUS: PLANNED — not executed. Pre-build checklist below gets reviewed before any code lands.**
> Candidate + committee profile layout re-organization (and light race-page parity). Research/investigation approved 2026-06-09; **all decisions locked** (see §3 + §4 — §4 resolved 2026-06-10, no caption). Timing of the mutually-exclusive slot is CC's discretion (§8). No open design questions remain.

---

## 1. Why this lands BEFORE Step 4 (sequencing rationale)

Step 4 is the donut↔Sankey **scope toggle**: Money flow shows where it conserves, the donut where it's gated, **mutually exclusive per entity**. The investigation surfaced that this toggle is not a chart change — it's a **layout slot** that swaps its contents. This re-org builds that slot (the "breakdown slot", §5) as part of flattening the page.

**So the ordering is deliberate:** build the breakdown slot here, and Step 4 collapses into a **content swap inside an existing container** rather than a layout change. The slot is keyed on `gated` per entity (not page type), so it also absorbs Step 5 (the dual-account un-gate) with zero rework — a dual-account committee flips donut→Sankey *inside the same slot*. Doing the layout once, now, means Steps 4 and 5 touch only the swap logic, never the grid.

The dependency chain:
- **Track A (donut correctness fix)** — shipped 2026-06-09 (dual-account donut fix). The donut fallback is now honest, which is what makes the slot's gated state safe to lean on.
- **This work (flatten + re-org)** — builds the slot + the paired-row structure.
- **Step 4 (scope toggle) — effectively folded into this work.** The mutual-exclusion toggle (9c) and the "which viz rendered" analytics dimension (`breakdown_viz`, also 9c) both land here, and the skeleton-then-swap question resolved to "no swap" (§8). So there is no separate Step 4 left to build — this re-org delivers it. (Kept as a named milestone only for traceability.)
- **Step 5 (dual-account Sankey un-gate)** — flips Gate-1 committees donut→Sankey; the slot already supports it.

---

## 2. Scope reframe — the tabs are already flat

T-remove-profile-tabs (2026-06-03/04) already retired the Summary/Raised/Spent tabs into a single flowing column. What remains is three **inert wrapper divs** — `#tab-summary`, `#tab-raised`, `#tab-spent` — kept as section hooks for "a future section-headings pass." This is that pass.

Verified against source: those divs have **zero** show/hide JS, **zero** CSS layout rules (one stale comment, `styles.css:372`), are **not** part of routing, and are **not** scroll/anchor targets. So:
- **Part A — dissolve the three wrappers.** Nearly free in production; expensive only in tests (§5 blast radius).
- **Part B — re-organize** from "raised section → spent section" into **thematic raised|spent paired rows** (§6). This is the real change.

---

## 3. Locked decisions

1. **Leaderboard row (Top Contributors | Top Vendors): stacked full-width.** No `>1200px`-paired breakpoint. The paired raised|spent rhythm applies to the **compact viz rows** (breakdown slot, geographic | purpose); the data tables — which carry internal sub-tabs (2 on candidate, 3 on committee) and ranked rows — get full width.

2. **Debt: DEFERRED to a Step 6 ticket — out of scope here.** Do **not** relocate `#sankey-debt`. It stays inside the money-flow card caption, shown **in-scope only**; gated entities continue to not show debt. That is a known, tracked gap Step 6 closes — not solved in this re-org. **Practical implication:** when the breakdown slot hosts the money-flow card (in-scope), keep the card **intact with its debt caption** — just reparent it. The slot's gated (donut) state carries no debt.

3. **Timeline: candidate-only, low placement (after the leaderboard row), unchanged.** A committee timeline is a **separate future feature ticket** (new `/committee/{id}/reports/` fetch + chart + tests) — not this work. The flat structure leaves a **matrix-driven timeline slot per page type**, but only candidate populates it now.

4. **Race loading state: in scope.** Replace the bare "Fetching race data from FEC…" `.state-msg` (`race.html:78`) with the **skeleton pattern** (candidate-row skeletons). The **cold-load slowness** rides along as a **flagged sub-task** — note it, don't block the re-org on it.

5. **Race routing: keep `?year=` divergent from the profile `#cycle` hash.** Different interaction models — in-page view switch (hash) vs shareable filter URL (query param). Documented here as deliberate; **do not unify.**

---

## 4. The gated-state caption — RESOLVED (2026-06-10): no caption

The investigation flagged a fourth, finer slot state — *gated-with-message*: today (coexist phase) a gated entity renders the money-flow card with `#sankey-gate` showing `sankeyGateCopy(reason)` **and** the donuts below it. After the slot makes them mutually exclusive, the money-flow card is *replaced* by donuts, so that gate caption needs a fate.

**DECISION: the gated state shows NO caption.** The donut is a **complete, conserving, first-class view** for gated entities — not a consolation prize. Captioning a complete view as "flow not available" would frame it as degraded, which it isn't:
- **Gate 1 (dual-account, `non-federal`)** — after the donut correctness fix, the donuts are honest and complete (FEA wedge + non-fed wedge + true-receipts %). No caption.
- **Gate 2 (presidential)** — the receipt side conserves (`federal_funds` is modeled, pushed by presence — and is zero for 2024 candidates who declined public financing), and the spend side conserves via the catch-all "Other" remainder. The donut is complete. No caption.

So the slot's gated state is simply **the donut pair, standing on its own.** No `SLOT_GATED_CAPTION` map, no per-reason copy, nothing to keep in sync with `sankeyGateReason`.

**Consequence for the in-scope path:** `sankeyGateReason` / `sankeyGateCopy` and the `#sankey-gate` element remain only as the **in-scope card's** internal gate handling during any coexist window; once the slot is mutually exclusive, a gated entity never mounts the money-flow card at all (it mounts the donut pair instead), so `#sankey-gate` is simply never shown. The gate *detector* (`sankeyGateReason`) still does its job — deciding **which** the slot renders (Sankey vs donuts) — it just no longer drives any visible caption.

(See §11 — presidential is *interim*-gated; when the fast-follow models the two exempt spend leaves, Form 3P flips to the Sankey in the same slot. The no-caption decision means there's no caption to retire when that happens.)

---

## 5. Reference audit / blast radius (carried from investigation)

| Surface | Reads `#tab-*`? | Breakage on removal |
|---|---|---|
| Production CSS (`styles.css`) | 1 comment (line 372) | none |
| Production JS (candidate/committee) | comments + 1 populate-guard (`candidate.html:2185`) | none functional |
| Routing (`#cycle` hash, hashchange/replaceState) | **no** — cycle-only | **none** (routing never referenced tabs) |
| In-page anchors / scroll nav | none | none |
| Analytics (`Page Viewed {view, cycle}`) | no (`Tab Switched` already retired) | none |
| **Tests** | **73 assertions** (36 candidate.spec + 37 committee.spec) | **the entire blast radius** |

**The only real cost is the 73 test assertions** — almost all `expect('#tab-raised').toBeVisible()`-style "content in flow?" proxies. They **retarget** to stable content IDs (`#money-flow-card`, `#donors-card`, `.raised-grid`, `#spent-donut-content`, `#page-note`), which is *stronger* coverage (asserts content, not an empty wrapper). The 3 wrapper divs are inert and get dissolved.

---

## 6. Per-page-type chart matrix (drives the structure — parameterized, not hard-coded)

| Section | Candidate | Committee | Race | Condition |
|---|---|---|---|---|
| Header: stat cards | ✓ | ✓ | title + cycle selector | always |
| Health banner | ✓ (only) | ✗ | ✗ | active/closed cycle |
| Race-context line | ✓ | ✗ | ✗ | always |
| **Breakdown slot** | ✓ | ✓ | ✗ | in-scope→Sankey; gated→donut(s) |
| Geographic map | ✓ | ✓ | ✗ | has itemized indiv |
| Spending by Purpose | ✓ | ✓ | ✗ | has opex |
| Top Contributors (tabs) | 2 tabs | 3 tabs | ✗ | always |
| Top Vendors | ✓ (most-recent sub-cycle) | ✓ (full cycle) | ✗ | has opex |
| Timeline | ✓ | ✗ (no reports fetch) | ✗ | candidate-only (decision 3) |
| Contributions to Candidates | ✗ | ✓ | ✗ | committee-only |
| `#page-note` | ✓ | ✓ | ✗ | always |
| Candidate-comparison list | ✗ | ✗ | ✓ | the race page *is* this |

Race is a different column: no chart rows; its body is the comparison list. The flat structure is **parameterized by page type** — a per-page matrix decides which rows render, not one hard-coded order.

---

## 7. Proposed flat structure (profiles)

```
[ header zone: stat cards · (banner — candidate) · (race-context — candidate) ]   ← unchanged
─────────────────────────────────────────────────────────────────────────────
BREAKDOWN SLOT  (one swappable container, full content width)
   in-scope : Money flow (Sankey) card, full-width  — intact, incl. its #sankey-debt caption (decision 2)
   gated    : [ Raised breakdown donut | Spending by category donut ]   (.raised-grid 1fr 1fr)
              no caption — the donut pair is a complete, first-class view (§4)
   empty    : nothing (collapses; rows below show their own empty states)
─────────────────────────────────────────────────────────────────────────────
ROW: [ Where Individual Contributions Come From | Spending by Purpose ]   (.raised-grid)
ROW: [ Top Contributors (full-width) ]                                    (decision 1 — stacked)
     [ Top Vendors (full-width) ]
[ Timeline: Raised · Spent · Cash on Hand ]   (candidate-only — decision 3; matrix slot per page type)
[ Contributions to Candidates & Committees ]  (committee-only, full-width)
[ #page-note ]
```

Each compact row is **raised-side | spent-side**. The CSS primitive already exists: `.raised-grid` (`grid-template-columns:1fr 1fr; gap:var(--space-64)`, collapses to `1fr` ≤860px, `styles.css:541`/`1357`). Every paired row reuses it. **The leaderboards are full-width (decision 1), not a `.raised-grid`.**

**Today → target reshape (the substantive part):** the page currently groups by *raised then spent* — `#tab-raised` holds `[raised donut | map]` + Top Contributors; `#tab-spent` holds `[spent donut | purpose]` + Top Vendors. The target **interleaves by theme**: both donuts move into the **breakdown slot** (paired with *each other*), the map pairs with purpose, Top Contributors pairs-by-stacking with Top Vendors. This is why the old "grid reflow when the donut is hidden" problem **dissolves** — the donuts only ever live in the slot; they never reflow against the always-present geographic/purpose row.

---

## 8. Breakdown slot — full state spec (all four states)

| State | Trigger | Renders |
|---|---|---|
| **loading** | pre-resolve | a single skeleton that **resolves directly to the correct viz — no swap.** The gate is known *synchronously* (`sankeyGateReason` reads the in-memory totals record at render time), so the slot mounts the right skeleton→viz directly; there is no intermediate Sankey-skeleton→donut hand-off. (Supersedes the earlier "Sankey skeleton then swap" framing — per review Gap 2.) |
| **in-scope** | `!gated` | money-flow card (full-width, **intact incl. its `#sankey-debt` caption** — decision 2) |
| **gated** | `gated` (reason ∈ {`non-federal`, `presidential`}) | `.raised-grid` with raised donut \| spent donut — **no caption** (§4); the donut pair is a complete, first-class view |
| **empty** | no financial activity (committee no-activity guard; candidate empty-cycle) | nothing — slot collapses to **zero height, no pulsing skeleton left behind** |

**Keyed on `gated` per entity, never on page type** — so a Gate-1 committee (Step 5) and a Form-3P committee (§11 fast-follow) each flip from the gated donut pair to the in-scope Sankey card **in place, with zero layout rework.**

**Timing is CC's discretion (no longer an open question):** ship the mutually-exclusive slot whenever it sequences best within the build — it does not need to wait on, or block, any other step. The only hard ordering constraint is 9c-after-donut-fix (§9).

---

## 9. PRE-BUILD CHECKLIST (review this before any code)

### 9a. Assertion retargets (tests-first — land before touching DOM)
- [ ] candidate.spec.js — 36 `#tab-*` refs → content IDs (`#money-flow-card`, `#donors-card`, `.raised-grid`, `#spent-donut-content`, `#page-note`). Almost all are `.toBeVisible()` "is X in flow?" proxies — **verified no test asserts donut/Sankey *containment* inside a `#tab-*` parent**, so cross-boundary moves don't break containment assertions; the retargets are simple visibility swaps to the content each proxy stood in for.
- [ ] committee.spec.js — 37 `#tab-*` refs → same.
- [ ] **SEPARATE from the retargets — the flow-order tests are a REWRITE, not a retarget** (review Gap 1): `candidate.spec.js:521` ("sections render in flow order: summary → raised → spent → page-note") and the committee equivalent (`committee.spec.js`, the `['tab-summary','tab-raised','tab-spent','page-note']` `compareDocumentPosition` test) assert the **old order over the now-deleted `#tab-*` ids**. They must be rewritten to assert the **new thematic order** (§7) over the new containers — a logic change, not a selector swap. Land them at the re-org step (9b), not in this retarget batch, since the new order doesn't exist until then.
- [ ] Add a routing regression test: deep-link `#2024` lands on detail; back/forward preserved; bare URL → index. (Locks that the flatten didn't touch routing.)
- [ ] Confirm green at the *current* DOM (the retargeted visibility assertions must pass before the re-org, against the still-present content; the flow-order rewrites are the exception — they flip with 9b).

### 9b. Per-page DOM moves (one page at a time — independent files)
- [ ] **Scope guard:** the **header zone — `#summary-strip` (stats-grid, banner, race-context-bar) — sits OUTSIDE `#content`'s tab divs and is NOT moved.** All moves here are *inside* `#content`.
- [ ] **candidate.html:** introduce row containers; move children out of `#tab-summary/-raised/-spent`; delete the 3 wrappers. New order per §7. Reparent money-flow card into the breakdown slot **intact** (keep `#sankey-debt`).
- [ ] **The donut moves are surgical, not "move a div":** each donut travels as a unit with its skeleton + legend + center-val + error overlay + tooltip + all IDs. Pull the **raised donut** out of `#tab-raised`'s `.raised-grid` and the **spent donut** out of `#tab-spent`'s `.raised-grid` into the **breakdown slot**; then pair the **map** (was with raised donut) with **Spending by Purpose** (was with spent donut) in a new `.raised-grid`.
- [ ] **Timeline is a distinct move (candidate):** it currently sits in `#tab-summary` at position #2 (its `#chart-area` + `#chart-skeleton` + `#chart-error` + `renderChart` timing). Move the whole unit to the new **low** position (after the leaderboards, §7) — not lumped into "move children."
- [ ] **Preserve wiring across moves:** `initTabSection` (Top Contributors WAI-ARIA tabs) and committee's `fetchAndRenderAssocSection` render targets must keep their element IDs/structure so the JS still finds them after reparenting.
- [ ] **committee.html:** same; plus reparent `#assoc-section` (today in `#tab-summary`) and `Contributions to Candidates` to their §7 positions; no timeline row populated.
- [ ] Reuse `.raised-grid` for the compact paired rows; leaderboards full-width (decision 1).
- [ ] **Flow-order tests flip here** (from 9a): rewrite them to assert the new §7 order over the new containers.
- [ ] `#page-note` stays last inside `#content`.
- [ ] **Headings scope (confirm):** this re-org is a **structural reflow only — no new thematic section headings added** (the locked §7 shows none). If section headings are wanted, that's a separate pass — flagged so it isn't ambiguous at build time.

### 9c. Breakdown-slot wiring — **= end the coexist phase + implement the toggle** (review Gap 2)
> Not just reparenting. **Today both viz render** (`renderMoneyFlow` *and* `renderContributorDonut`/`renderSpentDonutNow` all run unconditionally — coexist). 9c makes them **mutually exclusive**, which is the actual donut↔Sankey toggle. **Visible consequence: in-scope entities lose the donuts; gated entities lose the Sankey card.** This is the seam where this work meets Step 4.
- [ ] **Prerequisite (ordering):** the **donut correctness fix lands before slot wiring** — so 9c reparents *already-correct* donuts rather than colliding two concurrent edits on the donut code. (Satisfied: the dual-account donut fix shipped 2026-06-09; any further donut correctness work precedes 9c.)
- [ ] **Add a gate-conditional guard to the render orchestration** so only one viz mounts: `!gated` → render the money-flow card, do **not** render the donuts; `gated` → render the donut pair, do **not** mount the Sankey card. (This is the behavior change — the current unconditional render of both must become conditional.)
- [ ] One slot container; the four §8 states (loading / in-scope / gated / empty). **Loading resolves directly to the correct viz — no Sankey→donut swap** (gate is known synchronously; see §8).
- [ ] Wire to the existing `gated` signal (`sankeyGateReason`); **not** page type.
- [ ] **No gated caption** (§4 resolved) — the donut pair stands alone; no `SLOT_GATED_CAPTION` map to build.
- [ ] Move both donuts into the slot's gated state (today they're in two separate `.raised-grid`s); the map now pairs with purpose (done in 9b's DOM move).
- [ ] **`exactly-one-Chart-instance-per-canvas` lock:** ending coexistence means on in-scope entities the donut canvases never mount (and vice-versa). Verify no render path tries to draw into a now-unmounted canvas, and that the existing one-instance-per-canvas test still holds (retarget/extend it for the conditional mount).
- [ ] **Analytics "which viz" dimension — LANDS IN 9c (locked 2026-06-10):** add a `breakdown_viz` property (`'sankey'` | `'donut'`; include the gate reason when `'donut'`) to the existing `Page Viewed` event, set when the slot mounts its viz. It lands in the **same change that ends coexistence**, so there is never a window where "which viz rendered" goes uncaptured. Both profile pages.

### 9d. Race loading-state swap (decision 4)
- [ ] Replace **only the cold-load** `.state-msg` "Fetching race data from FEC…" (`race.html:78`) with candidate-row skeletons.
- [ ] **Scope guard (review Gap 3):** `.state-msg`/`.loader` is **shared** by three things — the cold-load text, the **error state** (`state-msg error`), and the **cycle-switch loader** (`#race-switch-loader`). The skeleton swap must touch **only the cold-load path** and leave the error state + switch-loader intact. (The empty-cycle `.inline-status-msg` state is also unchanged.)
- [ ] Keep `?year=` routing as-is (decision 5) — add a one-line code comment citing the rationale.
- [ ] **Flagged sub-task (don't block):** diagnose the cold-load slowness (single `/elections/` call vs the enrichment path — verify which is slow). Note findings; separate fix if needed.
- [ ] Confirm `Page Viewed` still fires (`race.html:363`) — already does; no change.

### 9e. Cross-cutting verification
- [ ] Full Playwright suite green after each page's re-org.
- [ ] **Whole-view empty state still toggles:** candidate's `#cycle-empty-state` replaces `#content` on no-data cycles — confirm that toggle still works after `#content`'s children are restructured (it hides `#content`, so it should, but verify).
- [ ] Live browser check (UI-touching): candidate + committee detail at desktop + ≤860px (paired rows collapse cleanly); gated committee (dual-account) shows the **donut pair, no caption** (§4); in-scope shows Sankey, donuts absent (coexistence ended, 9c); race skeleton renders.
- [ ] Docs: update CLAUDE.md (profile structure + the retired `#tab-*` wrappers + the end of donut/Sankey coexistence), ia.md (`#tab-summary` section-ids note), **design-system.html — add a Money-flow/breakdown-slot component card (the slot is a new component shape, not "if changed")**, test-cases.md log row.

---

## 10. Migration sequence (summary)
1. **Tests first** — retarget the visibility assertions to content IDs; add routing regression; confirm green at current DOM. (The flow-order tests are a *rewrite*, deferred to step 2 — they can't pass until the new order exists.)
2. **DOM re-org** — candidate, then committee (independent files); dissolve wrappers, build §7 rows; rewrite the flow-order tests to the new order.
3. **Slot wiring = end coexistence + the toggle** — add the gate-conditional guard so only one viz mounts; unify donuts into the slot; wire all four §8 states (loading resolves directly, no swap). No caption (§4 resolved). Fire the analytics "which viz" `breakdown_viz` dimension here (locked — lands with the toggle so coexistence never ends uncaptured).
4. **Race** — cold-load skeleton swap (leave error + switch-loader); flag cold-load slowness.
5. **Routing regression** — verify hash + race query params intact.
6. **Docs + live QA.**

No deep links/anchors reference `#tab-*`, so no back-compat shim is needed (unlike the original de-tab's `#cycle#tab` legacy links, which already canonicalize to `#cycle`).

---

## 11. Banked fast-follows (not this work)

- **Presidential (Form 3P) un-gate — interim gate, not permanent.** Form 3P is gated only because **two spend-side exempt leaves** the v1 model doesn't render — `fundraising_disbursements` and `exempt_legal_accounting_disbursement` — are populated on **publicly-financed** campaigns. The **receipt side already conserves** (`federal_funds` is modeled, pushed by presence; zero for 2024 candidates who declined public financing). Fast-follow: **model those two leaves → un-gate Form 3P.** Until then, for the rare publicly-financed campaign that exempt spend lands in the donut's **"Other" remainder — still conserving** — so the gated donut is complete in the meantime (which is exactly why §4 carries no caption). Full detail: `strategy/sankey-data-model.md` §4a Gate 2.

- **Dual-account (Gate 1) un-gate — Step 5.** Recipe documented in `sankey-data-model.md` §4a Gate 1 (FEA node + non-fed source + remainder catch-alls).

- **The slot accommodates both un-gates with zero layout rework.** Because the breakdown slot is keyed on `gated` per entity (§8), both the dual-account un-gate (Step 5) and the presidential fast-follow flip their committees **donut→Sankey in place** — the slot, the paired rows, and everything below are untouched. The flatten is the last layout change either un-gate needs.

- **Committee timeline** — new `/committee/{id}/reports/` fetch + chart + tests (decision 3). The matrix-driven timeline slot already exists per page type; only candidate populates it today.

- **Debt on gated entities — Step 6** (decision 2). `#sankey-debt` is in-scope-only; gated entities show no debt until Step 6 gives it a viz-independent home.

- **Race cold-load slowness** (decision 4, flagged sub-task) — diagnose whether the single `/elections/` call or the enrichment path is slow; fix separately if warranted.
