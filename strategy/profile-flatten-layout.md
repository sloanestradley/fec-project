# Profile flatten + re-organize — spec & build plan

> **STATUS: COMPLETE — 9a–9e all EXECUTED & DEPLOYED (2026-06-10). candidate.html + committee.html flattened + breakdown-slot toggle (9a–9c); race.html cold-load comment + diagnosis (9d); cross-cutting verification + closing doc sweep + live-QA sign-off (9e). Remaining work is the banked §11 fast-follows (separate tickets).**
> Candidate + committee profile layout re-organization (and light race-page parity). Research/investigation approved 2026-06-09; **all decisions locked** (see §3 + §4 — §4 resolved 2026-06-10, no caption). The donut↔Sankey scope toggle (a.k.a. "Step 4") shipped folded into **9c** — the breakdown slot is now Money flow XOR the donut pair, mutually exclusive on the gate, with the `breakdown_viz` analytics dimension. No open design questions remain. Commits: 9a/9b on 883-green; 9c `4851c84` (889-green). Remaining: §9d, §9e (+ the banked §11 un-gates / committee timeline).

---

## 1. Why this lands BEFORE Step 4 (sequencing rationale)

Step 4 is the donut↔Sankey **scope toggle**: Money flow shows where it conserves, the donut where it's gated, **mutually exclusive per entity**. The investigation surfaced that this toggle is not a chart change — it's a **layout slot** that swaps its contents. This re-org builds that slot (the "breakdown slot", §5) as part of flattening the page.

**So the ordering is deliberate:** build the breakdown slot here, and Step 4 collapses into a **content swap inside an existing container** rather than a layout change. The slot is keyed on `gated` per entity (not page type), so it also absorbs Step 5 (the dual-account un-gate) with zero rework — a dual-account committee flips donut→Sankey *inside the same slot*. Doing the layout once, now, means Steps 4 and 5 touch only the swap logic, never the grid.

The dependency chain:
- **Track A (donut correctness fix)** — ✅ shipped 2026-06-09 (dual-account donut fix). The donut fallback is now honest, which is what makes the slot's gated state safe to lean on.
- **This work (flatten + re-org)** — ✅ 9a/9b/9c shipped 2026-06-10: the slot + the paired-row structure + the mutually-exclusive toggle.
- **Step 4 (scope toggle) — ✅ shipped folded into 9c.** The mutual-exclusion toggle and the "which viz rendered" analytics dimension (`breakdown_viz`) both landed in 9c, and the skeleton-then-swap question resolved to "no swap" (§8 — the gate is known synchronously, so the slot mounts the right viz directly). There was no separate Step 4 to build — the re-org delivered it. (Kept as a named milestone only for traceability.)
- **Step 5 (dual-account + presidential Sankey un-gates)** — flips Gate-1/Gate-2 entities donut→Sankey **in place inside the slot**; the slot already supports it with zero layout rework (§8/§11). Pending.

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

3. **Timeline: candidate-only, placed as a full-width row directly below the Geographic | Purpose row (before the leaderboards).** It closes the "where money came from / went" viz block before the dense contributor/vendor tables. (Corrected 2026-06-10 — the original "low placement, after the leaderboard row" was a translation slip from Chat; the intended home is below Spending by Purpose.) A committee timeline is a **separate future feature ticket** (new `/committee/{id}/reports/` fetch + chart + tests) — not this work. The flat structure leaves a **matrix-driven timeline slot per page type**, but only candidate populates it now.

4. **Race loading state: keep the plain `.state-msg` loader — NO skeleton swap (revised 2026-06-10).** The original lock was "replace the spinner with candidate-row skeletons"; that was reversed in planning. A fixed-N row skeleton would **mis-preview a variable-length candidate list** (a race can have 2 or 20 declared candidates), so the honest placeholder is the existing spinner + "Fetching race data from FEC…" copy. The real lever is the **cold-load slowness**, which becomes 9d's **primary sub-task** (diagnose; fix only a cheap/safe win in-ticket, else point at the server-side KV-cache architectural-debt item). So 9d is now a **mostly-investigation ticket** — a routing-rationale comment + the slowness diagnosis + a `Page Viewed` verify — with no race loading-state UI change.

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
[ Timeline: Raised · Spent · Cash on Hand ]   (candidate-only — decision 3; full-width, directly below the geo|purpose row; matrix slot per page type)
ROW: [ Top Contributors (full-width) ]                                    (decision 1 — stacked)
     [ Top Vendors (full-width) ]
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

> **PROGRESS (2026-06-10):** 9a ✅ done (tests-first retargets + routing-regression lock, green at current DOM, 881→883). 9b ✅ candidate + committee done (DOM re-org + held-test rewrites; shipped 883 green). **9c ✅ done** — breakdown-slot toggle wired (Money flow XOR donut pair, mutually exclusive on the gate; `applyBreakdownSlot` + `breakdownGated` on both pages), the `breakdown_viz` (+ `breakdown_gate_reason`) analytics dimension landed on `Page Viewed`, and the test suite was migrated to the new semantics (in-scope → Sankey shown / donuts hidden; gated → donut pair / no gate caption; donut-render tests moved to gated fixtures via `routeGatedCandidate` / `routeGatedCommittee`; the two ex-gate-caption tests rewritten to the no-caption donut-pair behavior). **9d ✅ done** — race.html routing-rationale comment (decision 5) + cold-load slowness diagnosis (`/elections/` is the dominant/high-variance call; fix = the KV-cache debt item, out of scope) + `Page Viewed` verify; no UI change, comment-only. 9e ⏳ pending. **Build-time notes:** (1) timeline placement corrected to *directly below the Geographic | Purpose row* (decision 3); (2) committee's **Associated Candidate** section placed **first, before the breakdown slot** (committee context; no header race-context bar) — signed off; (3) the §4 no-caption decision means a gated entity NEVER mounts the money-flow card (so `#sankey-gate` is dead UI in the slot — the gate detector now only *selects* the viz). The candidate gate is office-based (synchronous from `CAND_OFFICE`); the committee gate is record-based, looked up from `ALL_TOTALS` by cycle in `breakdownGateReason(cycle)` so it's correct at `trackPageViewed` time (which fires before `renderStats`).

### 9a. Assertion retargets (tests-first — land before touching DOM)
- [x] candidate.spec.js — 36 `#tab-*` refs → content IDs (`#money-flow-card`, `#donors-card`, `.raised-grid`, `#spent-donut-content`, `#page-note`). Almost all are `.toBeVisible()` "is X in flow?" proxies — **verified no test asserts donut/Sankey *containment* inside a `#tab-*` parent**, so cross-boundary moves don't break containment assertions; the retargets are simple visibility swaps to the content each proxy stood in for.
- [x] committee.spec.js — 37 `#tab-*` refs → same.
- [x] **SEPARATE from the retargets — the flow-order tests are a REWRITE, not a retarget** (review Gap 1): `candidate.spec.js:521` ("sections render in flow order: summary → raised → spent → page-note") and the committee equivalent (`committee.spec.js`, the `['tab-summary','tab-raised','tab-spent','page-note']` `compareDocumentPosition` test) assert the **old order over the now-deleted `#tab-*` ids**. They must be rewritten to assert the **new thematic order** (§7) over the new containers — a logic change, not a selector swap. Land them at the re-org step (9b), not in this retarget batch, since the new order doesn't exist until then.
- [x] Add a routing regression test: deep-link `#2024` lands on detail; back/forward preserved; bare URL → index. (Locks that the flatten didn't touch routing.)
- [x] Confirm green at the *current* DOM (the retargeted visibility assertions must pass before the re-org, against the still-present content; the flow-order rewrites are the exception — they flip with 9b).

### 9b. Per-page DOM moves (one page at a time — independent files)
- [x] **Scope guard:** the **header zone — `#summary-strip` (stats-grid, banner, race-context-bar) — sits OUTSIDE `#content`'s tab divs and is NOT moved.** All moves here are *inside* `#content`.
- [x] **candidate.html:** introduce row containers; move children out of `#tab-summary/-raised/-spent`; delete the 3 wrappers. New order per §7. Reparent money-flow card into the breakdown slot **intact** (keep `#sankey-debt`).
- [x] **The donut moves are surgical, not "move a div":** each donut travels as a unit with its skeleton + legend + center-val + error overlay + tooltip + all IDs. Pull the **raised donut** out of `#tab-raised`'s `.raised-grid` and the **spent donut** out of `#tab-spent`'s `.raised-grid` into the **breakdown slot**; then pair the **map** (was with raised donut) with **Spending by Purpose** (was with spent donut) in a new `.raised-grid`.
- [x] **Timeline is a distinct move (candidate):** it currently sits in `#tab-summary` at position #2 (its `#chart-area` + `#chart-skeleton` + `#chart-error` + `renderChart` timing). Move the whole unit to the new **low** position (after the leaderboards, §7) — not lumped into "move children."
- [x] **Preserve wiring across moves:** `initTabSection` (Top Contributors WAI-ARIA tabs) and committee's `fetchAndRenderAssocSection` render targets must keep their element IDs/structure so the JS still finds them after reparenting.
- [x] **committee.html:** same; plus reparent `#assoc-section` (today in `#tab-summary`) and `Contributions to Candidates` to their §7 positions; no timeline row populated.
- [x] Reuse `.raised-grid` for the compact paired rows; leaderboards full-width (decision 1).
- [x] **Flow-order tests flip here** (from 9a): rewrite them to assert the new §7 order over the new containers.
- [x] `#page-note` stays last inside `#content`.
- [x] **Headings scope (confirm):** this re-org is a **structural reflow only — no new thematic section headings added** (the locked §7 shows none). If section headings are wanted, that's a separate pass — flagged so it isn't ambiguous at build time.

### 9c. Breakdown-slot wiring — **= end the coexist phase + implement the toggle** (review Gap 2)
> Not just reparenting. **Today both viz render** (`renderMoneyFlow` *and* `renderContributorDonut`/`renderSpentDonutNow` all run unconditionally — coexist). 9c makes them **mutually exclusive**, which is the actual donut↔Sankey toggle. **Visible consequence: in-scope entities lose the donuts; gated entities lose the Sankey card.** This is the seam where this work meets Step 4.
- [x] **Prerequisite (ordering):** the **donut correctness fix lands before slot wiring** — so 9c reparents *already-correct* donuts rather than colliding two concurrent edits on the donut code. (Satisfied: the dual-account donut fix shipped 2026-06-09.)
- [x] **Added a gate-conditional guard to the render orchestration** so only one viz mounts: `!gated` → render the money-flow card, do **not** render the donuts; `gated` → render the donut pair, do **not** mount the Sankey card. (Candidate: `renderRaisedIfReady`'s donut block + `renderSpentDonutNow` early-return guarded on `breakdownGated`; `renderMoneyFlow` call gated on `!breakdownGated`. Committee: same shape.)
- [x] One slot container; the four §8 states (loading / in-scope / gated / empty). **Loading resolves directly to the correct viz — no Sankey→donut swap** — `applyBreakdownSlot(breakdownGated)` runs in each page's reset/render path before the await window, and the gate is known synchronously (candidate: office; committee: in-memory record).
- [x] Wire to the existing `gated` signal (`sankeyGateReason`); **not** page type. (`breakdownGateReason()` wraps it per page.)
- [x] **No gated caption** (§4 resolved) — the donut pair stands alone; no `SLOT_GATED_CAPTION` map. A gated entity never mounts the money-flow card, so `#sankey-gate` is simply never shown.
- [x] Both donuts live in the slot's gated state (`#breakdown-donut-grid`); the map pairs with purpose (9b).
- [x] **`exactly-one-Chart-instance-per-canvas` lock:** retargeted to gated fixtures — on a gated entity all expected donut canvases mount ([1,1] committee / [1,1,1] candidate incl. timeline); on in-scope entities the donuts never mount (covered by the slot-toggle tests). No render path draws into an unmounted canvas (the guards short-circuit before `renderContributorDonut`/`renderSpentDonut`).
- [x] **Analytics "which viz" dimension landed in 9c:** `breakdown_viz` (`'sankey'`|`'donut'`) + `breakdown_gate_reason` (reason when `'donut'`, else null) added to `Page Viewed` on both pages, set from `breakdownGateReason()` at emit time. Null on index. Asserted by new spec tests on both pages.

### 9d. ✅ Race cold-load — routing comment + slowness diagnosis (decision 4 revised — NO skeleton swap) — DONE 2026-06-10
> **Scope reversal (2026-06-10):** the skeleton swap is OUT (see decision 4). The plain `.state-msg` spinner + "Fetching race data from FEC…" copy at `race.html:78` **stays as-is** — a fixed-N row skeleton would mis-preview a variable-length candidate list. 9d was a **mostly-investigation ticket**: a routing-rationale comment, the cold-load slowness diagnosis (the real lever), and a `Page Viewed` verify. No race loading-state UI change.

- [x] **Routing comment (decision 5):** added at the `urlWithYear` seam in `race.html` — documents the deliberate divergence (race uses a shareable `?year=` query-param / filter-URL model, NOT the profile pages' in-page `#cycle` hash / view-switch model; **do not unify**). Comment only, no behavior change.
- [x] **Cold-load slowness diagnosis (primary sub-task):** timed both cold-load calls against the **live deployed proxy** (real FEC key, server-side), small (WA-03 House) + large (CA Senate, US President), 2 samples each. **Findings:** `/elections/` (the candidate list) is the **dominant + high-variance** call — payload scales with candidate count (2.9 KB WA-03 → 15 KB CA-Sen → 20 KB President) and latency ran 0.27 s–2.9 s, spiking to ~3 s on President with no caching. `/elections/search/` (fetchCycles) is lighter + steadier (1.4–2.7 KB; ~0.1–0.5 s warm, one 1.1 s cold spike). **Root cause = FEC API latency + the pass-through proxy (no caching layer)** — confirms the documented architecture. **Cold-load total:** the explicit-`?year=` path (the common shared-link case) already runs both calls in **parallel** (`Promise.all`) → total ≈ the `/elections/` call, i.e. already optimal; the no-year path is **sequential by necessity** (needs cycles to pick the default year) → search + elections. **No cheap/safe in-ticket win** — `per_page:50` is right, the no-year serialization is necessary, and a speculative parallel fetch is risky. **The real fix is the existing architectural-debt item:** server-side KV caching of `/elections/` + `/elections/search/` (collapses the FEC variance + the ~3 s spikes into one cold fetch per TTL). Left to that separate ticket.
- [x] **Verified `Page Viewed` fires** on load (`pageViewedPayload(yearParam, 'load')`, `race.html:363`) — covered by existing `tests/pages.spec.js` assertions (`Page Viewed fires with race context props` + `switch fires Page Viewed { year, trigger:cycle-switch }; load is trigger:load`). No change.
- [x] **Context (loader sharing — held for the diagnosis, no change made):** `.state-msg`/`.loader` is shared by the cold-load spinner, the **error state** (`state-msg error`), and the **cycle-switch loader** (`#race-switch-loader`); the empty-cycle state is a separate `.inline-status-msg` in `#race-list`. None changed (no swap).
- [x] **No new tests** — loader unchanged; no cheap fix landed (diagnosis pointed at the KV-cache debt item). Comment-only race.html change; race suite (61 tests in pages.spec) stayed green.

### 9e. ✅ Cross-cutting verification — DONE 2026-06-10
- [x] Full Playwright suite green — 889 effective (one known opex-retry timing flake, passes isolated; unrelated to the arc).
- [x] **Whole-view empty state still toggles:** candidate's `#cycle-empty-state` replaces `#content` on no-data cycles — confirmed (test-covered: `T-cycle-empty-state` describe green; the breakdown gate runs in the reset but `#content` is hidden so it's invisible). Committee no-activity guard + gated round-trip also confirmed via their describes.
- [x] **Live browser check (UI-touching): signed off by Sloane 2026-06-10** — candidate + committee detail at desktop + ≤860px (paired rows collapse); gated committee shows the donut pair, no caption; in-scope shows the Sankey, donuts absent. (Race has no 9d UI change — plain loader unchanged.)
- [x] **Docs synced** — CLAUDE.md (Sankey note: Steps 0–4, coexistence ended, gate caption retired; spent-donut label casing + direction; race cold-load timing in the KV-cache debt note), ia.md (detail-view structure note → mutually-exclusive slot + `breakdown_viz`), design-system.html (Money Flow / breakdown-slot card + spend-bar demo labels), test-cases.md log rows, TESTING.md count.
- [x] **Closing stale-reference sweep (Part D)** — swept CLAUDE.md / ia.md / project-brief.md / design-system.html / utils.js comment / chart-color-palette.html for retired terms (coexist / "not yet modeled" caption / title-case spend labels / "Candidate Contributions"). Fixed A–E. Also cleaned the **test-cases.md manual checklist's tab-era debt** (~25 references from T-remove-profile-tabs predating this arc — the `### Detail view tabs bar`, `### Raised/Spent tab`, PAGE-NOTE, summary-strip, empty-state, index-view, and race-header sections reframed to the flowing single-column view + breakdown slot; append-only log rows left as history).

**Arc complete: 9a–9e all shipped (2026-06-10). Remaining are the banked §11 fast-follows (Step 5 un-gates, committee timeline, debt-on-gated, race KV-cache) — separate tickets, not part of this flatten arc.**

---

## 10. Migration sequence (summary)
1. ✅ **Tests first** — retargeted the visibility assertions to content IDs; added routing regression; confirmed green at current DOM. (Flow-order tests rewritten in step 2.)
2. ✅ **DOM re-org** — candidate, then committee (independent files); dissolved wrappers, built §7 rows; rewrote the flow-order tests to the new order.
3. ✅ **Slot wiring = end coexistence + the toggle** — added the gate-conditional guard (`breakdownGated` + `applyBreakdownSlot`) so only one viz mounts; donuts live in the slot's gated state; the four §8 states resolve directly (no swap — gate is synchronous). No caption (§4). Fired the `breakdown_viz` (+ `breakdown_gate_reason`) analytics dimension in the same change. Test suite migrated to the new semantics (gated fixtures for donut-render tests; in-scope↔gated toggle locks; ex-gate-caption tests rewritten). 883→889 green.
4. ✅ **Race** — NO skeleton swap (decision 4 revised — plain loader stays). 9d shipped: routing-rationale comment + cold-load slowness diagnosis (`/elections/` dominates; fix = KV-cache debt item) + `Page Viewed` verify. Comment-only; no UI change.
5. ✅ **Routing regression** — hash + cycle routing verified intact (the flatten never touched routing; locked by the per-page routing-regression describe added in 9a). Race `?year=` query params unchanged (9d will re-confirm).
6. ⏳ **Docs + live QA.** — docs synced with 9c (CLAUDE.md, design-system.html, TESTING.md, test-cases.md, this doc); the **live browser pass (in-scope → Sankey only; gated → donut pair, no caption; desktop + ≤860px) is owed to Sloane** (flagged in the 9c test-cases row).

No deep links/anchors reference `#tab-*`, so no back-compat shim is needed (unlike the original de-tab's `#cycle#tab` legacy links, which already canonicalize to `#cycle`).

---

## 11. Banked fast-follows (not this work)

- **Presidential (Form 3P) un-gate — interim gate, not permanent.** Form 3P is gated only because **two spend-side exempt leaves** the v1 model doesn't render — `fundraising_disbursements` and `exempt_legal_accounting_disbursement` — are populated on **publicly-financed** campaigns. The **receipt side already conserves** (`federal_funds` is modeled, pushed by presence; zero for 2024 candidates who declined public financing). Fast-follow: **model those two leaves → un-gate Form 3P.** Until then, for the rare publicly-financed campaign that exempt spend lands in the donut's **"Other" remainder — still conserving** — so the gated donut is complete in the meantime (which is exactly why §4 carries no caption). Full detail: `strategy/sankey-data-model.md` §4a Gate 2.

- **Dual-account (Gate 1) un-gate — Step 5.** Recipe documented in `sankey-data-model.md` §4a Gate 1 (FEA node + non-fed source + remainder catch-alls).

- **The slot accommodates both un-gates with zero layout rework.** Because the breakdown slot is keyed on `gated` per entity (§8), both the dual-account un-gate (Step 5) and the presidential fast-follow flip their committees **donut→Sankey in place** — the slot, the paired rows, and everything below are untouched. The flatten is the last layout change either un-gate needs.

- **Committee timeline** — new `/committee/{id}/reports/` fetch + chart + tests (decision 3). The matrix-driven timeline slot already exists per page type; only candidate populates it today.

- **Debt on gated entities — Step 6** (decision 2). `#sankey-debt` is in-scope-only; gated entities show no debt until Step 6 gives it a viz-independent home.

- **Race cold-load slowness — DIAGNOSED 2026-06-10 (9d); fix banked.** The `/elections/` candidate-list call is the dominant + high-variance cold-load cost (payload scales with candidate count; latency 0.27 s–~3 s with no caching); `/elections/search/` is lighter. Root cause is FEC API latency through the pass-through proxy. The explicit-`?year=` path already parallelizes both calls; no cheap in-ticket win exists. **Fix = the server-side KV-cache architectural-debt item** (proxy-level caching of `/elections/` + `/elections/search/`) — same shape as the races.html enrichment-caching note. Build before any real-traffic push.
