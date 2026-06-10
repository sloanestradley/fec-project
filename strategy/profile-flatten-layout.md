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
- **Step 4 (scope toggle)** — makes Money-flow / donut mutually exclusive inside the slot; adds the "which viz rendered" analytics dimension.
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
| **loading** | pre-resolve | skeleton — **default**: the Sankey skeleton, then swaps to the donut pair if the entity resolves gated (the Step-4-decided behavior; the gated path's donut skeletons take over after the gate is known) |
| **in-scope** | `!gated` | money-flow card (full-width, **intact incl. its `#sankey-debt` caption** — decision 2) |
| **gated** | `gated` (reason ∈ {`non-federal`, `presidential`}) | `.raised-grid` with raised donut \| spent donut — **no caption** (§4); the donut pair is a complete, first-class view |
| **empty** | no financial activity (committee no-activity guard; candidate empty-cycle) | nothing — slot collapses to **zero height, no pulsing skeleton left behind** |

**Keyed on `gated` per entity, never on page type** — so a Gate-1 committee (Step 5) and a Form-3P committee (§11 fast-follow) each flip from the gated donut pair to the in-scope Sankey card **in place, with zero layout rework.**

**Timing is CC's discretion (no longer an open question):** ship the mutually-exclusive slot whenever it sequences best within the build — it does not need to wait on, or block, any other step. The only hard ordering constraint is 9c-after-donut-fix (§9).

---

## 9. PRE-BUILD CHECKLIST (review this before any code)

### 9a. Assertion retargets (tests-first — land before touching DOM)
- [ ] candidate.spec.js — 36 `#tab-*` refs → content IDs (`#money-flow-card`, `#donors-card`, `.raised-grid`, `#spent-donut-content`, `#page-note`). Each "is X in flow?" proxy retargets to the actual content it was standing in for.
- [ ] committee.spec.js — 37 `#tab-*` refs → same.
- [ ] Add a routing regression test: deep-link `#2024` lands on detail; back/forward preserved; bare URL → index. (Locks that the flatten didn't touch routing.)
- [ ] Confirm green at the *current* DOM (retargeted assertions must pass before the re-org, against the still-present content).

### 9b. Per-page DOM moves (one page at a time — independent files)
- [ ] **candidate.html:** introduce row containers; move children out of `#tab-summary/-raised/-spent`; delete the 3 wrappers. New order per §7. Reparent money-flow card into the breakdown slot **intact** (keep `#sankey-debt`).
- [ ] **committee.html:** same; plus reparent `#assoc-section` (today in `#tab-summary`) and `Contributions to Candidates` to their §7 positions; no timeline row populated.
- [ ] Reuse `.raised-grid` for the compact paired rows; leaderboards full-width (decision 1).
- [ ] `#page-note` stays last inside `#content`.

### 9c. Breakdown-slot wiring
- [ ] **Prerequisite (ordering):** the **donut correctness fix lands before slot wiring** — so 9c reparents *already-correct* donuts rather than colliding two concurrent edits on the donut code. (Satisfied: the dual-account donut fix shipped 2026-06-09; if any further donut correctness work is queued, it precedes 9c.)
- [ ] One slot container; in-scope renders money-flow card, gated renders the donut `.raised-grid`, empty collapses, loading shows the skeleton (all four states, §8).
- [ ] Wire to the existing `gated` signal (`sankeyGateReason`); **not** page type.
- [ ] **No gated caption** (§4 resolved) — the donut pair stands alone; no `SLOT_GATED_CAPTION` map to build.
- [ ] Move both donuts into the slot's gated state (today they're in two separate `.raised-grid`s); the map now pairs with purpose.
- [ ] Verify skeleton behavior matches the decided "gated load shows Sankey skeleton then swaps to donut."

### 9d. Race loading-state swap (decision 4)
- [ ] Replace the `.state-msg` "Fetching race data from FEC…" (`race.html:78`) with candidate-row skeletons.
- [ ] Keep `?year=` routing as-is (decision 5) — add a one-line code comment citing the rationale.
- [ ] **Flagged sub-task (don't block):** diagnose the cold-load slowness (single `/elections/` call vs the enrichment path — verify which is slow). Note findings; separate fix if needed.
- [ ] Confirm `Page Viewed` still fires (`race.html:363`) — already does; no change.

### 9e. Cross-cutting verification
- [ ] Full Playwright suite green after each page's re-org.
- [ ] Live browser check (UI-touching): candidate + committee detail at desktop + ≤860px (paired rows collapse cleanly); gated committee (dual-account) shows donut row + §4 caption; in-scope shows Sankey; race skeleton renders.
- [ ] Docs: update CLAUDE.md (profile structure + the retired `#tab-*` wrappers), ia.md (`#tab-summary` section-ids note), design-system.html if any component shape changed, test-cases.md log row.

---

## 10. Migration sequence (summary)
1. **Tests first** — retarget the 73 assertions to content IDs; add routing regression; confirm green at current DOM.
2. **DOM re-org** — candidate, then committee (independent files); dissolve wrappers, build §7 rows.
3. **Slot wiring** — unify donuts into the slot; wire in-scope/gated/empty; implement §4 caption (after the decision).
4. **Race** — skeleton swap; flag cold-load slowness.
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
