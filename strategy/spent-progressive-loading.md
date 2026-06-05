# Spent tab — progressive per-source loading (candidate + committee)

*Planned 2026-06-05. Not yet executed. Tackle in a fresh session. Closes the loading-states arc
(T-raised-loading-states candidate `4bdfbbe` + committee `19e2240`) by bringing the Spent tab onto
the same per-source honesty as the Raised sub-tabs.*

---

## Why

The Spent tab's loading message currently sits **detached below all four sections** (the pre-Raised
"below-the-block" pattern), and **all sections resolve at once** even though they have three different
data timings. The all-at-once is an *implementation artifact*, not a data necessity:

| Section | Data source | Real timing |
|---|---|---|
| Spending by Category (donut, **chart**) | `ALL_TOTALS` / passed-in breakdown — **in memory** | **instant** (both pages) |
| Spending by Purpose (bars, **chart**) | one Schedule B "opex" fetch (≤5 pages) | opex timeline |
| Top Vendors (**table**) | same opex fetch | opex timeline |
| Contributions to Cands & Committees (**table**) | **separate** Schedule B `entity_type=CCM` fetch (≤3 pages) | independent — **committee only** |

`fetchSpentData` does `await Promise.all([opex, ccm])` and `renderSpentIfReady` paints everything in
one pass — and the donut is made to wait on fetches **even though its data is already in memory**.

So: **candidate has 2 timelines** (instant donut + opex), **committee has 3** (+ separate CCM).

## Decisions locked (Sloane, 2026-06-05)

- **Progressive**, not a cosmetic relocate.
- **Message per *table* section** — and "table" = **Top Vendors + Contributions** only. The two
  **charts** (donut, bars) get **no** overlay message: the donut renders instantly; the bars chart
  pulses skeleton-only until opex resolves (it shares the opex timeline with vendors, which carries
  the message).
- Donut → **instant** (no skeleton wait, no message).

## Open confirms (resolve at top of the build session)

1. **Per-source errors** (recommended) — opex failure surfaces on bars+vendors only; CCM failure on
   contributions only; the donut (already rendered) is never blanked. Falls out of the fetch split.
   Alternative: keep one shared error (simpler, but blanks more than its source). **Recommend per-source.**
2. **Copy** — proposing "Tallying spending…this could take a moment." (Vendors) and
   "Tallying contributions…this could take a moment." (Contributions). Mirrors Raised's
   "Tallying contributions…". Wording is Sloane's call.

## Target architecture

Three independent render triggers (candidate: two):
- **Donut** — render synchronously from the in-memory breakdown the moment the Spent section shows
  (exactly how the Raised donut renders from `currentTotalsRecord` in `renderRaisedIfReady`, gated on
  totals not on the fetch). Skeleton hides immediately.
- **Opex tier** (bars + vendors) — renders both when the opex fetch resolves. Vendors shows an
  in-skeleton overlay message while pending; bars pulses skeleton-only.
- **CCM tier** (contributions, committee only) — renders when the CCM fetch resolves; its own
  in-skeleton overlay message.

## Changes (both pages unless noted)

### 1. Donut → instant
- Compute the donut breakdown synchronously (committee: from `ALL_TOTALS[cycle]`; candidate: the
  breakdown is **already passed** into `fetchSpentData` as `currentDisbursementsBreakdown` /
  `currentTotalSpent` — pull that compute out ahead of the fetch).
- Add `renderSpentDonut(breakdown, totalSpent)` call on Spent-section reveal, independent of the
  Schedule B fetches. Hide `#spent-donut-skeleton` immediately.

### 2. Split the fetch per-source
- `fetchSpentData` → `fetchSpentOpex(cycle)` (the opex Schedule B walk → `{transactions, capped}`)
  and, committee-only, `fetchSpentContributions(cycle)` (the CCM walk → `{contributions}`).
- Kick off independently; each resolves → renders its sections. New per-source state vars
  (`spentOpexData`/`spentOpexError`/`spentOpexStillLoading`; committee adds the `spentContrib*` trio)
  and **per-source 10s timers** (replace the single `spentStillLoadingTimer`).
- Keep the `capped` flag on the opex result (drives the "(capped at 500 transactions)" tooltip clause
  on the Spending-by-Purpose title — do not lose it in the split).

### 3. Per-table loading + per-source error UI
- **HTML:** wrap the **Vendors** + **Contributions** skeletons in `.skeleton-overlay-wrap`, add their
  `.skeleton-overlay-msg` overlays (`#spent-vendors-still-loading`, `#spent-contributions-still-loading`).
  Donut + bars get **no** overlay. Add per-source error blocks (`#spent-opex-error` covering
  bars+vendors; `#spent-contributions-error`). **Remove** the detached `#spent-still-loading` and the
  single `#spent-error`.
- **CSS:** generalize `.tab-section-panel .skeleton-overlay-wrap` / `.skeleton-overlay-msg` → drop the
  `.tab-section-panel` prefix (the classes are unique to this overlay pattern; un-scoping is safe and
  leaves the Raised usage unchanged). This is the one shared-CSS edit and it enables Spent.
- **JS:** per-source indicator helpers mirroring `applyRaisedSlowIndicators` — show the table overlay
  message iff that source's 10s flag fired and it's still pending; show the per-source error iff that
  source errored; else hide. Reuse `showTabError` (utils.js) for the error blocks.

### 4. Copy
Per the open confirm above. New family voice; retire "This is taking longer than usual — full
transaction history can take 10–20 seconds…".

## Element ID plan
Keep existing skeleton/content IDs (`#spent-{donut,bars,vendors,contributions}-skeleton` /
`-content`). New: `#spent-vendors-still-loading`, `#spent-contributions-still-loading`,
`#spent-opex-error`, `#spent-contributions-error`. Removed: `#spent-still-loading`, `#spent-error`.

## Test impact
~17 existing spent test refs across `candidate.spec.js` + `committee.spec.js` (mostly `#spent-error`,
plus the skeleton IDs which stay). Rework:
- `#spent-error` → per-source (`#spent-opex-error` / `#spent-contributions-error`).
- New: donut renders **without** waiting on Schedule B (mock a slow opex, assert donut content visible
  while vendors still skeleton); per-table loading; **error isolation** (mock opex 500 → bars/vendors
  error BUT donut + contributions still render).
- The Spent fetch is bounded (≤5 / ≤3 pages) so the real 10s message rarely fires — force-visible the
  overlay (`el.style.display='flex'`) for the geometry/structure guard, same trick as the Raised
  overlay tests.

## Cross-page divergence
- **candidate.html:** 2 sources (instant donut + opex). No Contributions section, no CCM fetch — so no
  `#spent-contributions-*`. `fetchSpentData(committeeId, subCycles, breakdown, totalSpent, covDate)` →
  donut from the passed breakdown + `fetchSpentOpex`.
- **committee.html:** 3 sources. `fetchSpentData(cycleOrAll)` → donut from `ALL_TOTALS` + `fetchSpentOpex`
  + `fetchSpentContributions`.

## Size
Largest of the Spent options — a real refactor of the Spent fetch+render path on both pages (split
fetch, instant donut, per-source render/indicators/errors), ~1.5–2.5h + Track 1 + local visual on both.
Lands Spent on the same per-source honesty as Raised; closes the loading-states arc.

## Reference commits / prior art
- Raised per-panel loading-states: candidate `4bdfbbe`, committee `19e2240` (the pattern to mirror).
- The `.skeleton-overlay-wrap` / `.skeleton-overlay-msg` overlay mechanism + the group-opacity gotcha
  (overlay must be a **sibling** of the skeleton, never a child) — documented in the CLAUDE.md
  "Per-panel Raised slow-tier indicators" note.
