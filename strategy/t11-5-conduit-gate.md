# T11.5 — Conditional Schedule A non-individual fetch on committee.html

> **DEFERRED 2026-04-29.** Investigation complete; not shipped. The optimization rolls into T12 (lazy-load Raised tab), which subsumes the savings cleanly for the dominant user path. Doc retained as a banking record — both findings (server-side `memo_code=X` filter ignored by FEC, type-based gate not viable) are durable and worth preserving so a future session doesn't re-investigate.

---

## Context

The committee.html call audit (2026-04-29) flagged Schedule A `is_individual=false` (call #8) as eager-but-not-always-load-bearing: it fires unconditionally on every committee detail-view cycle load, but produces empty Top Conduit Sources tables for committees that aren't conduit destinations. The fetch is dual-purposed — (a) Top Conduit Sources via `memo_code='X'` rows, (b) Top Committee Contributors fallback when KV misses — so it can't be removed outright; the question was whether a gate could skip it for the non-conduit-destination majority.

T11.5 was scoped as diagnostic-first: investigate, then decide. This doc captures the investigation and the close-out.

## Investigation summary

**Sample:** 11 committees across all major types in 2024 cycle, queried via the production proxy (`https://fecledgerapp.pages.dev/api/fec/...`). For each: total `is_individual=false` row count + memo distribution from a 100-row date-sorted page 1 sample (date-sort avoids the documented amount-sort bias at committee.html lines 964–971).

| Committee | Type/Des | Total non-indiv | Date-sort memo % | Outcome |
|---|---|---|---|---|
| Marie for Congress | H/P | 19,714 | 75% | Heavy; bails at PAGE_THRESHOLD=100 today |
| Gillibrand for Senate | S/P | 21,344 | 91% | Heavy; bails today |
| Harris Victory Fund | N/J (JFA) | 599,652 | 99% | Mega; bails today |
| DNC | Y/U | 425,925 | 90% | Heavy; bails today |
| MAGA PAC | Q/U | 1,346 | 56% | Real conduit data; would NOT bail |
| Congressional Leadership Fund | W/U | 1,237 | 98% | Real conduit data; would NOT bail |
| Senate Leadership Fund | O/U | 42 | 2% | 1 memo row — non-empty |
| Timber PAC | N/U (Leadership PAC) | 15 | 27% | 4 memo rows — non-empty |
| AB PAC | V/U (Hybrid) | 9 | 0% | Empty — but committee inactive in 2024 |
| 100-40 PAC | V/U (Hybrid) | 0 | — | Empty — but committee inactive in 2024 |
| Great America PAC | W/U | 2 | 0% | Empty — but committee inactive in 2024 |

## Findings

### 1. FEC API silently ignores `memo_code` as a server-side filter

Marie's `is_individual=false&two_year_transaction_period=2024` returns 19,714 rows whether `memo_code=X` is appended or not. Empty `memo_code=` returns the same. The filter is treated as a no-op rather than a 4xx. This forecloses the cheap one-call existence probe that would otherwise be the cleanest gate shape.

Same gotcha class as `entity_type` on Schedule B (already documented in CLAUDE.md). Memo classification has to happen client-side row-by-row — which is what `fetchRaisedData()` already does in committee.html. Documented in CLAUDE.md alongside the existing silent-ignore entries.

### 2. No safe static type-based gate exists at zero-threshold

The user's threshold for the gate was strict: skip only when we're confident the table will be empty. The data shows that's not achievable per type:

- **H/P, S/P, N/J, Y, Q** are all conduit-heavy (75–99% memo rates). Cannot be skipped.
- **W (Carey-account PAC)** is bimodal — CLF heavy, Great America empty. Same type, opposite outcomes; can't gate on type alone.
- **O (Super PAC)** sampled at SLF showed 1 non-zero memo row — non-empty.
- **N/U (Leadership PAC)** sampled at Timber showed 4 memo rows — small but non-empty.
- **V (Hybrid PAC)** sampled at 100-40 and AB PAC showed 0 memo for 2024 — but both committees were inactive (≤9 total rows). Activity status, not type, drove the empty result. Generalizing risks losing data for any V-type committee that's actively raising.

The only marginally-safe carve-out would be `committee_type === 'V'`, on a 2-committee inactive-only sample. Not worth shipping.

### 3. The expensive cases already bail out via existing logic

The four heaviest-volume committees in the sample (Marie 197 pages, Gillibrand 213, Harris VF 6000+, DNC 4259) all exceed the existing `PAGE_THRESHOLD = 100` short-circuit at committee.html line 953 and currently set `topConduitsTooLarge = true` without paginating beyond page 1. T11.5's hypothetical savings on these committees: **1 call** (the page-1 fetch needed for the bail-out detection itself). All the high-volume cost is already handled.

### 4. The savable cases are cheap and have real data

Committees that fully paginate today have ≤13 pages typically (CLF 12, MAGA 13, Timber 1, SLF 1). Per-committee pagination cost is bounded. And among these, 2 of 4 sampled have meaningful conduit data (CLF 98%, MAGA 56%). Gating these by type would lose real data for users.

## Why T12 subsumes this cleanly

T12's intent (per CLAUDE.md backlog) is to lazy-load Raised and Spent tabs entirely — no Schedule A/B fetches fire until the user actually clicks the Raised or Spent tab. Most committee detail-view visits are Summary-only (default landing tab). For those visits, T12 saves the *entire* Raised tab fetch shape (call #4 by_state, calls #5–#8 individuals/committees/conduits, call #9 topojson) — much bigger than T11.5's 1-page-saved-on-bail-out scenario.

T12 also doesn't require any classification heuristic: lazy = lazy. No edge cases, no false negatives, no per-type tuning. The gate question becomes moot for the common case.

For the uncommon "user landed on Raised tab via deep link" case, the fetch fires. Same as today. T11.5 wouldn't have changed that path either.

## Activity-based future refinement (deferred)

If, after T12 ships, there's still appetite to prune the Schedule A non-individual fetch on Raised-tab visits, **activity status** is a stronger signal than committee type. From the sample, every "empty conduit" outcome was a low-activity committee (≤15 total non-individual rows). A possible refinement: fetch page 1 unconditionally (as today), and skip pagination if `pagination.count` is below some threshold (say 20) — same shape as the existing mega-committee bail-out, just at the small end of the distribution. Cheap and accurate.

But this is a smaller win than T12 and shouldn't precede it. Shelve until T12 ships and we have data on whether residual Raised-tab loads still warrant pruning.

## What's documented elsewhere

- `CLAUDE.md` — added `memo_code=X` silent-ignore entry alongside existing `by_state` cycle and `entity_type` notes.
- `process-log.html` / `claude-to-claude.md` — no entry needed; T11.5 closed without code changes.
- This file is the canonical T11.5 record.

## Status

Closed. No PR, no tests, no code changes. Findings banked for T12 and any future activity-based refinement.
