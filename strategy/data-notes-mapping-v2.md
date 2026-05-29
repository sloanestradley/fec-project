# Data notes — mapping pass (v2)

*Companion to the data-notes audit (in claude-to-claude.md, 2026-05-28 session). Inputs: every audit row from /candidate, /committee, /race. Outputs: destination per concept in the new architecture (single-scroll layout + page-level data note + tooltip component).*

*v2 incorporates Sloane's review notes from `data-notes-mapping-withSloaneNotes.md`. All three judgment calls are resolved; several mapping rows updated; the cadence ("data updated nightly") concept is retired in favor of a source-link. Taxonomy expanded with two new buckets (SECTION-NOTE, COMPONENT-LABEL) to fit two cases where neither PAGE-NOTE nor TOOLTIP-* was the right home.*

---

## Resolved decisions (v2)

Three judgment calls from v1 are decided. Decisions are baked into the mapping table.

1. **C1 — "Best-guess assessment · Thresholds to be validated."** **Cut entirely.** No replacement; the financial-health framing on candidate.html does not carry a provisional caveat in the new architecture.
2. **C7 / K2 — Overspend callout.** **Stays as a visible `.callout` near the chart it relates to.** Not absorbed into the data-note family; not converted to a tooltip. Alert semantic, not caveat.
3. **≤$200 itemization caveat (C8.f / K10).** **Lives once at PAGE-NOTE level**, with revised copy: *"Individual contributions of $200 or less are not itemized."* Applies page-wide on candidate and committee.

Three additional cross-cutting decisions emerged from Sloane's notes and apply across the mapping:

- **Cadence framing retired.** Every "Data updated nightly by FEC" surface is replaced by a source line: `"Source: FEC."` with the word *FEC* linked to https://www.fec.gov/. Rationale: cadence framing can be read as "data is always current," when in reality refresh is bounded by FEC reporting deadlines. The source-link is honest about provenance without claiming a freshness contract we don't keep. Coverage-through date (which IS a truthful statement about what window the displayed numbers represent) is retained.
- **Per-tooltip source-endpoint attribution dropped.** The four "Source: FEC totals endpoint" / "Source: FEC totals" donut tooltips (C8.a, C10.c, K3.a, K16.c) are all cut. The page-level source line covers it; per-viz repetition lacks value.
- **Per-page FEC-ID source attribution dropped from PAGE-NOTE.** C4.a and K1.a are cut — the FEC ID is already shown in the meta-row tag, and the new source-link covers attribution. No need to surface the ID twice.

---

## Context — the new architecture (decided)

Profile pages (`/candidate`, `/committee`, `/race`) move from tab-hidden-content to a single-scroll layout. Existing tab buttons become anchors. Two new patterns are available for the kind of text the audit catalogued:

1. **One page-level data note per page** — sits outside the anchor structure, carries page-wide information, renders at first paint.
2. **A designed tooltip component** — anchored to a specific viz / table / stat label, surfaces methodology, caveats, or definitions on demand.

The tooltip component **does not exist yet** — today's `title` attributes don't work on touch and have a ~1s hover delay; not acceptable for content the user needs to interpret the data. The mapping below commits us to building one as a downstream ticket. Spec input for that ticket lives in §3.

### Rules the mapping follows

- **First-paint information = PAGE-NOTE.** Source attribution and broad caveats map to PAGE-NOTE regardless of whether they could conceivably attach to a specific element. Tooltips anchor to viz that may be slow to load (raised-tab content takes 10–20+s); the user needs that information visible immediately. This also fixes a current bug: candidate's raised-tab footer note doesn't render until raised content finishes loading, because it's structurally INSIDE the tab.
- **Hypothesis (held in v2):** the page-level note ends up small (2–3 concepts per page) because most current footer content is genuinely tied to a specific viz / table / stat and moves to tooltips. The hypothesis HOLDS in v2 — page-notes range from 2 to 3 elements after Sloane's decisions.
- **Mapping decides destinations only.** Sequencing (when each piece ships, in what order) is a separate downstream decision.

### Destination taxonomy (v2 — 7 buckets)

- **PAGE-NOTE** — page-level data note (one per page).
- **SECTION-NOTE** — data note at the bottom of a specific section/modal, scoped to that section's content. Used once: C11 Committees modal note.
- **TOOLTIP-VIZ** — tooltip on a viz, table, chart, or section.
- **TOOLTIP-LABEL** — tooltip on a stat label, term, or glossary item.
- **COMPONENT-LABEL** — inline structural label that's part of a component's design rather than a data-note proper. Used for the cycle-index archive divider's section label (C12.a, K17.a).
- **EMPTY-STATE** — in-table empty-cell content (table-cell explanations of why a row isn't available).
- **CUT** — preserved elsewhere in another bucket; the current slot is redundant.

Each audit row gets one assignment, or for compound rows (e.g. K3's 7 conditional append-clauses) splits into one assignment per concept.

---

## 1. Mapping table

Each audit row from the audit (or its component concepts, for compound rows) gets one destination. Compounds use `.a`, `.b`, … suffixes. Sloane's review decisions are baked in; the Sloane-notes column from the review file is absorbed here.

### candidate.html

| Audit ID | Concept (what info it carries) | Destination | Specific attachment point | What's preserved | What's cut / merged with | Complete | Verified |
|---|---|---|---|---|---|---|---|
| C1 | Health-thresholds-not-yet-validated honesty signal (Provisional) | CUT | — | Shipped 2026-05-28 — the "Best-guess assessment · Thresholds to be validated with domain expert" line in candidate.html's Step 4 active-cycle branch (formerly L1980) is removed; banner-note now renders empty on active data-present cycles. The `assessHealth()` "No Data" return at L647 was intentionally retained as a defensive default — the Step 4 banner gate (post-T-cycle-empty-state) makes the path unreachable today; the function-level fallback is cheap insurance against future callers without the upstream guard. | Judgment call resolved: option (c) | ✓ | ✓ |
| C2 | Final coverage date on closed cycle | CUT | — | Shipped 2026-05-28 (Cat A pass) — `note.textContent = covDate ? 'Final coverage: '+fmtDate(covDate) : '';` removed from candidate.html's Step 4 closed-cycle branch. Closed-cycle banner-note now renders empty (parity with C1 retirement on active branch). Coverage date is still visible at `#stat-coh-sub` "As of {date}" on the Cash on Hand card. PAGE-NOTE will add page-wide coverage-through stamp in Phase 2. | Merged with C4.c (Coverage-through), one source of truth | ✓ | ✓ |
| C3 | Empty banner-note (closed cycle, no covDate) | CUT | — | Nothing — the orphan disappears with C2 | C2 | n/a | n/a |
| C4.a | "Source: FEC — Candidate ID {ID}" attribution | CUT | — | Shipped 2026-05-29 (Phase 2 candidate+committee). #data-note inside #tab-summary no longer populated by Step 3's data branch; the old `'Source: FEC — Candidate ID '+CANDIDATE_ID+'.'` clause is gone. The Candidate ID is already shown in the meta-row tag; the new #page-note source line covers attribution at page level. | Merged with .meta-row + C4.e | ✓ | ✓ |
| C4.b | "Cycle {cycle} ({startYear}–{cycle})" framing | CUT | — | Shipped 2026-05-28 (Cat A pass) — clause removed from candidate.html's Step 3 #data-note innerHTML assembly. `cycleStartYear` variable declaration also removed (it was only used by this clause). Election year is shown at `#stat-cycle` per T-cycle-semantics; the sub-cycle range parenthetical was supplementary and not load-bearing. | `#stat-cycle` stat | ✓ | ✓ |
| C4.c | "Coverage through {date}" freshness stamp | PAGE-NOTE | Page-level note | Shipped 2026-05-29 (Phase 2 candidate+committee). Now lives at #page-note inside #content (after #tab-spent). Conditional rendering on `covDate` — clause omitted on cycles with no coverage end date. Consolidates the 4-place duplication that existed pre-Cat A (summary footer + raised footer + spent footer + closed-cycle banner-note); #stat-coh-sub "As of {date}" remains as the inline glance signal on the Cash on Hand card. | Consolidates C2 / C8.e / C10.f duplicates | ✓ | ✓ |
| C4.d | "Raised-to-spent = total receipts ÷ total disbursements" definition | TOOLTIP-LABEL | Raised:Spent Ratio stat label | **Cut now** (2026-05-29 Phase 2 candidate+committee, Option B-style trade per design call) — definition removed from #data-note. Will return as TOOLTIP-LABEL on the Raised:Spent Ratio stat label when the tooltip component ships. Currently absent in production, mirroring C12.b / K17.b / C10.b / K16.b. | — | ✓ | Incomplete, verify later |
| C4.e | Source line (was: "Data updated nightly by FEC" cadence) | PAGE-NOTE | Page-level note | Shipped 2026-05-29 (Phase 2 candidate+committee). Source line lives at #page-note: *"Source: <a href='https://www.fec.gov/'>FEC</a>."* Source-first sentence ordering. FEC link points to consumer site (www.fec.gov) per design-call decision. Cadence concept ("Data updated nightly by FEC") retired entirely — replaced by the source link which is honest about provenance without claiming a freshness contract. | The "data updated nightly" surfaces (here + K4 / K6 on committee) collapse into a single per-page source-link | ✓ | ✓ |
| C5 | "No financial filings found for the {cycle} cycle" | EMPTY-STATE | Cycle-detail whole-view empty state (new `.cycle-empty-state` element, candidate-only) | Revised copy: *"No financial filings for {cycle} cycle."* (dropped "found" and "the"; period retained). Shipped 2026-05-28 in T-cycle-empty-state — element sits inside `.main-inner` alongside `#content`, replaces tabs-bar + tabbed content on no-data cycles, banner is also hidden in this case. | — | ✓ | ✓ |
| C6 | Empty data-note (loadCycle catch branch) | CUT | — | The orphan disappears — chart-error overlay already owns failure messaging | — | n/a | n/a |
| C7 | Overspend callout | (stays as `.callout`) | Near the timeline chart on the summary tab | Concept survives in its current visible-callout form | Judgment call resolved: option (a). Not absorbed into the data-note family. | n/a | n/a |
| C8.a | "Raised breakdown from FEC totals endpoint" source | CUT | — | Shipped 2026-05-28 (Cat A pass) — prefix removed from candidate.html's `renderRaisedIfReady` raised-data-note assembly. "Lacks value" cut. | C4.e | ✓ | ✓ |
| C8.b | "Geography reflects itemized individual contributions by state (Schedule A)" methodology | TOOLTIP-VIZ | Where Individual Contributions Come From map | Methodology scoped to the choropleth. See observation (§5.b) — investigate whether K3.c amendment caveat is also relevant here for candidate-parity. | — | | |
| C8.c | "Top committee contributors…" methodology | TOOLTIP-VIZ | Top Committee Contributors table | Methodology scoped to the table. Revised copy: *"Top committee contributors: complete PAC, party, and other committee contributions across {cycleLabel}, deduplicated by committee ID."* | — | | |
| C8.d | Conduit-source explanation (memo_code=X, individuals' money not platforms') | TOOLTIP-VIZ | Top Conduit Sources table | Methodology + interpretation scoped to the table | — | | |
| C8.e | "Coverage through {date}" (raised footer) | CUT | — | Shipped 2026-05-28 (Cat A pass) — conditional clause removed from `renderRaisedIfReady` raised-data-note assembly. Coverage date is still visible at `#stat-coh-sub` "As of {date}" on the Cash on Hand card. PAGE-NOTE will add page-wide coverage-through stamp in Phase 2. | C4.c | ✓ | ✓ |
| C8.f | "Small-dollar contributions ≤$200 are not itemized" | PAGE-NOTE | Page-level note | Shipped 2026-05-29 (Phase 2 candidate+committee). Sentence moved from #raised-data-note to #page-note (page-level, applies across all individual-contribution surfaces — donut, choropleth, summary totals). Revised copy: *"Individual contributions of $200 or less are not itemized."* | Parity with K10 — same PAGE-NOTE entry across candidate + committee. Judgment call resolved: option (a). | ✓ | ✓ |
| C9 | "Categories estimated from FEC disbursement descriptions using keyword matching. Some transactions may be miscategorized. Covers most recent sub-cycle." | TOOLTIP-VIZ | Spending by Purpose bars | Methodology + completeness scoped to bars. The "most recent sub-cycle" trailing clause is candidate-only (Senate sub-cycle artifact) — surfaced conditionally inside the same tooltip. | Consolidates C10.a — they say the same thing | | |
| C10.a | "Spending by Purpose: keyword mapping…" | CUT | — | Shipped 2026-05-28 (Cat A pass) — sentence (including the conditional cap parenthetical that wrapped C10.b) removed from candidate.html's `renderRaisedIfReady`-spent-data-note assembly. C9's inline note on the purpose card already covers the same methodology. | C9 | ✓ | ✓ |
| C10.b | "(capped at 500 transactions)" conditional clause | TOOLTIP-VIZ | Spending by Purpose bars (conditional content within C9's tooltip) | **Currently absent in production** as of 2026-05-28 (Cat A pass: the cap parenthetical was a sub-clause of C10.a and was cut along with it). Returns inside C9's tooltip when the tooltip component lands. Same shape as C12.b. | C9 (same tooltip, conditional fragment) | |
| C10.c | "Spending by Category: FEC totals endpoint" source | CUT | — | Shipped 2026-05-28 (Cat A pass) — sentence removed from spent-data-note assembly. "Lacks value" cut. | C4.e | ✓ | ✓ |
| C10.d | "Top vendors deduplicated by recipient" methodology | TOOLTIP-VIZ | Top Vendors table | Methodology scoped to the table | — | | |
| C10.e | "Senate category totals aggregated across sub-cycles" conditional | CUT | — | Shipped 2026-05-28 (Cat A pass) — conditional clause removed from spent-data-note assembly. Implied by election-level data. | — | ✓ | ✓ |
| C10.f | "Coverage through {date}" (spent footer) | CUT | — | Shipped 2026-05-28 (Cat A pass) — conditional clause removed from spent-data-note assembly. Coverage date is still visible at `#stat-coh-sub` "As of {date}". PAGE-NOTE will add page-wide coverage-through stamp in Phase 2. | C4.c | ✓ | ✓ |
| C11 | "Reflects committees directly linked… JFA participant gap… F2 pointer" | SECTION-NOTE | Bottom of the Committees modal / section | Caveat survives in its current form — stays as a section-bottom data-note. NOT routed to a tooltip on the section header (Sloane override: works as-is). | — | n/a | n/a |
| C12.a | "Archive · summary-only" structural label | COMPONENT-LABEL | Cycle-index archive divider | Shipped 2026-05-28. Inline label is now exactly *"Archived elections (totals only)"* across all three render sites in candidate.html (renderCycleIndex, renderCycleIndexScaffold, onPartialError). The unused `officeLabel` variable declarations were removed at each site. | — | ✓ | ✓ |
| C12.b | "FEC coverage begins {threshold} for {office} races" explanation | TOOLTIP-VIZ | Cycle-index archive divider (anchored beside C12.a's label) | **Currently absent in production** as of 2026-05-28 (C12.a Option B ship: dropped the explanation entirely rather than carry it as inline text). Returns when the tooltip component lands with the spec'd copy: *"Data for {office} races prior to {threshold} is less complete; no detail view available."* | — | | |
| C13.a | Methodology for "Candidate authorized committees" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Candidate authorized committees" wedge | Production verbatim: *"Money transferred in from committees authorized by the same candidate."* Copy review deferred to downstream swap ticket. | — | | |
| C13.b | Methodology for "Candidate self-funding" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Candidate self-funding" wedge | Production verbatim: *"Direct contributions and loans from the candidate to their own campaign. Contributions are gifts; loans create a debt the committee owes back to the candidate."* Copy review deferred. | — | | |
| C13.c | Methodology for "Other receipts" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Other receipts" wedge | Production verbatim: *"Miscellaneous receipts that don't fit other categories — interest on bank accounts, dividends, and similar incidental income."* Copy review deferred. | — | | |
| C13.d | Methodology for "Loans" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Loans" wedge | Production verbatim: *"Loans from banks or other third parties — not funded by the candidate."* Copy review deferred. | — | | |
| C13.e | Methodology for "Federal funds" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Federal funds" wedge | Production verbatim: *"Public financing from the Presidential Election Campaign Fund. Only available to presidential candidates."* Copy review deferred. **Interpretation-critical** — clarifies that $0 is the expected value on non-presidential candidates (so the wedge reading as "missing" vs "expected 0" matters). See §5.i. | — | | |
| C13.f | Methodology for "Refunds & offsets" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Refunds & offsets" wedge | Production verbatim: *"Vendor refunds, returned deposits, and other amounts credited back to the campaign. These are recorded as receipts by the FEC but don't represent new money raised."* Copy review deferred. **Interpretation-critical** — clarifies that the receipts total isn't all new money (matters for any "total raised" reading). See §5.i. | — | | |

### committee.html

| Audit ID | Concept | Destination | Specific attachment point | What's preserved | What's cut / merged with | Complete | Verified |
|---|---|---|---|---|---|---|---|
| K1.a | "Source: FEC — Committee ID {ID}" attribution | CUT | — | Shipped 2026-05-29 (Phase 2 candidate+committee). #committee-meta-note no longer populated by renderStats; the old `'Source: FEC — Committee ID '+COMMITTEE_ID+'.'` clause is gone. The Committee ID is already shown in the meta-row tag; the new #page-note source line covers attribution at page level. | Merged with .meta-row + K1.d | ✓ | ✓ |
| K1.b | "{startYear}–{cycleOrAll} cycle" framing | CUT | — | Shipped 2026-05-28 (Cat A pass) — clause removed from committee.html's `renderStats` #committee-meta-note assembly. `#stat-cycle` already carries the year-range. | `#stat-cycle` stat | ✓ | ✓ |
| K1.c | "Coverage through {date}" freshness stamp | PAGE-NOTE | Page-level note | Shipped 2026-05-29 (Phase 2 candidate+committee). Now lives at #page-note inside #committee-content (after #tab-spent). Conditional rendering on `coverageDate`. Consolidates K9 / K16.e's coverage-through duplicates (both retired in Cat A pass); #stat-coh-sub "As of {date}" remains as the inline glance signal. | Consolidates K9 / K16.e's coverage-through duplicates | ✓ | ✓ |
| K1.d | Source line (was: "Data updated nightly by FEC" cadence) | PAGE-NOTE | Page-level note | Shipped 2026-05-29 (Phase 2 candidate+committee). Source line lives at #page-note: *"Source: <a href='https://www.fec.gov/'>FEC</a>."* Source-first ordering, FEC linked to consumer site. Cadence concept retired entirely. | Parity with C4.e | ✓ | ✓ |
| K2 | Overspend callout | (stays as `.callout`) | Near the chart on the summary tab | Concept survives in its current visible-callout form | Judgment call resolved: option (a). Parity with C7. | n/a | n/a |
| K3.a | "Raised breakdown from FEC totals endpoint" source | CUT | — | Shipped 2026-05-28 (Cat A pass) — prefix removed from committee.html's `renderRaisedIfReady` raised-data-note assembly. "Lacks value" cut. | K1.d | ✓ | ✓ |
| K3.b | "Geography reflects itemized individual contributions by state (Schedule A)" methodology | TOOLTIP-VIZ | Where Individual Contributions Come From map | Methodology scoped to choropleth | Parity with C8.b — also receives K3.c content | | |
| K3.c | "State totals may differ from summary figures due to FEC amendment processing" caveat | TOOLTIP-VIZ | Where Individual Contributions Come From map (same tooltip as K3.b) | Interpretation caveat scoped to choropleth. **Open follow-up:** investigate whether this caveat is also relevant to the candidate-page choropleth tooltip (C8.b). The amendment behavior on Schedule A applies on both pages; the caveat is currently committee-only. | See §5.b — candidate-parity question | | |
| K4 | "Top individual contributors pre-computed from FEC bulk data, refreshed daily" source | TOOLTIP-VIZ | Top Individual Contributors table | Source attribution scoped to the table — bulk variant; surfaces only when KV-hit | — | | |
| K5 | "Top individual contributors: {cycleLabel}" source (live API variant) | TOOLTIP-VIZ | Top Individual Contributors table | Source attribution scoped to the table — API variant; surfaces only when KV-miss | Same tooltip slot as K4, conditional content | | |
| K6 | "Top committee contributors pre-computed from FEC bulk data (pas2), refreshed daily" source | TOOLTIP-VIZ | Top Committee Contributors table | Source attribution scoped to the table — bulk variant | — | | |
| K7 | "Top committee contributors: complete {cycleLabel} cycle, deduplicated by committee ID" source + methodology (live API variant) | TOOLTIP-VIZ | Top Committee Contributors table | Source + methodology scoped to the table — API variant; surfaces only when KV-miss | Same tooltip slot as K6, conditional content | | |
| K8 | Conduit-source explanation (memo_code=X, individuals' money not platforms') | TOOLTIP-VIZ | Top Conduit Sources table | Methodology + interpretation scoped to the table | Parity with C8.d | | |
| K9 | "Coverage through {date}" (raised footer) | CUT | — | Shipped 2026-05-28 (Cat A pass) — conditional clause + the `covDate` local computation that fed it both removed from `renderRaisedIfReady`. Coverage date still visible at `#stat-coh-sub`. | K1.c | ✓ | ✓ |
| K10 | "Small-dollar contributions ≤$200 are not itemized" | PAGE-NOTE | Page-level note | Shipped 2026-05-29 (Phase 2 candidate+committee). Sentence moved from #raised-data-note to #page-note (page-level). Revised copy: *"Individual contributions of $200 or less are not itemized."* | Parity with C8.f — same PAGE-NOTE entry across candidate + committee. Judgment call resolved: option (a). | ✓ | ✓ |
| K11 | Structural-gap empty state on Top Committee Contributors table | EMPTY-STATE | Top Committee Contributors table empty cell | Revised copy: *"Data not available for this committee type."* (was: *"Committee contribution data is not available for this committee type."*). The "committee contribution" scope is now carried by the table heading. Updated 2026-05-28 with the register-standardization pass. | Was K11 / K12 register inconsistency (§5.a) — resolved. | ✓ | ✓ |
| K12 | Volume-cap empty state on Top Committee Contributors table | EMPTY-STATE | Top Committee Contributors table empty cell | Revised copy: *"Data not available due to high transaction volume."* (was: *"Unable to show due to high transaction volume."*). Updated 2026-05-28. | Parity with K11 / K12.5 / K13 — all four empty states now share the *"Data not available …"* stem. | ✓ | ✓ |
| K12.5 | Volume-cap empty state on Top Individual Contributors table | EMPTY-STATE | Top Individual Contributors table empty cell | Revised copy: *"Data not available due to high transaction volume."* (was: *"Unable to show due to high transaction volume."*). Updated 2026-05-28. | **Audit backfill**: this 4th empty-state cell was missed in the original audit (no K-row assigned at audit time). Captured here under K12.5. Parity with K11 / K12 / K13. | ✓ | ✓ |
| K13 | Volume-cap empty state on Top Conduit Sources table | EMPTY-STATE | Top Conduit Sources table empty cell | Revised copy: *"Data not available due to high transaction volume."* (was: *"Unable to show due to high transaction volume."*). Updated 2026-05-28. | Parity with K11 / K12 / K12.5. | ✓ | ✓ |
| K14 | "Categories estimated from FEC disbursement descriptions using keyword matching. Some transactions may be miscategorized" | TOOLTIP-VIZ | Spending by Purpose bars | Methodology + completeness scoped to bars | Parity with C9 (committee version omits the "most recent sub-cycle" candidate-only clause); consolidates K16.a | | |
| K15 | "Direct contributions to other federal candidates and committees" | CUT | — | Shipped 2026-05-28 — `<p class="data-note">` paragraph removed from committee.html's Contributions to Candidates & Committees section. Option (a): pure removal. Section title "Contributions to Candidates & Committees" (`.donors-head`) carries the necessary context for the table below. No replacement subtitle pattern introduced; if other sections need similar descriptive subtitles in the future, that's a separate component decision. | — | ✓ | ✓ |
| K16.a | "Spending by Purpose: keyword mapping…" | CUT | — | Shipped 2026-05-28 (Cat A pass) — sentence (including the conditional cap parenthetical that wrapped K16.b) removed from committee.html's `renderSpentIfReady` spent-data-note assembly. K14's inline note on the purpose card already covers the same methodology. | K14 | ✓ | ✓ |
| K16.b | "(capped at 500 transactions)" conditional clause | TOOLTIP-VIZ | Spending by Purpose bars (conditional content within K14's tooltip) | **Currently absent in production** as of 2026-05-28 (Cat A pass: the cap parenthetical was a sub-clause of K16.a and was cut along with it). Returns inside K14's tooltip when the tooltip component lands. Parity with C10.b. | K14 (same tooltip, conditional fragment) | | |
| K16.c | "Spending by Category: FEC totals" source | CUT | — | Shipped 2026-05-28 (Cat A pass) — sentence removed from spent-data-note assembly. "Lacks value" cut. | K1.d | ✓ |  ✓ | |
| K16.d | "Top vendors deduplicated by recipient" methodology | TOOLTIP-VIZ | Top Vendors table | Methodology scoped to the table | Parity with C10.d | | |
| K16.e | "Coverage through {date}" (spent footer) | CUT | — | Shipped 2026-05-28 (Cat A pass) — conditional clause removed from spent-data-note assembly. Coverage date still visible at `#stat-coh-sub`. | K1.c | ✓ |  ✓ | |
| K17.a | "Archive · summary-only" structural label | COMPONENT-LABEL | Cycle-index archive divider | Shipped 2026-05-28. Inline label is now exactly *"Archived cycles (totals only)"* across all three render sites in committee.html (renderCycleIndex, renderCycleIndexScaffold, onPartialError). Single string change applied via replace_all. | Parity with C12.a | ✓ | ✓ |
| K17.b | "FEC coverage begins {threshold}" explanation | TOOLTIP-VIZ | Cycle-index archive divider (anchored beside K17.a's label) | **Currently absent in production** as of 2026-05-28 (K17.a Option B ship: dropped the explanation entirely rather than carry it as inline text). Returns when the tooltip component lands with the spec'd copy: *"Data for cycles prior to {threshold} is less complete; no detail view available."* | — | | |
| K18.a | Methodology for "Candidate authorized committees" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Candidate authorized committees" wedge | Production verbatim (identical to C13.a): *"Money transferred in from committees authorized by the same candidate."* Copy review deferred. | Twin of C13.a | | |
| K18.b | Methodology for "Candidate self-funding" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Candidate self-funding" wedge | Production verbatim: *"Direct contributions and loans from the candidate to this committee. Contributions are gifts; loans create a debt the committee owes back to the candidate."* Differs from C13.b on "this committee" vs "their own campaign." Copy review deferred. | Near-twin of C13.b | | |
| K18.c | Methodology for "Other receipts" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Other receipts" wedge | Production verbatim (identical to C13.c): *"Miscellaneous receipts that don't fit other categories — interest on bank accounts, dividends, and similar incidental income."* Copy review deferred. | Twin of C13.c | | |
| K18.d | Methodology for "Loans" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Loans" wedge | Production verbatim (identical to C13.d): *"Loans from banks or other third parties — not funded by the candidate."* Copy review deferred. | Twin of C13.d | | |
| K18.e | Methodology for "Federal funds" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Federal funds" wedge | Production verbatim (identical to C13.e): *"Public financing from the Presidential Election Campaign Fund. Only available to presidential candidates."* Copy review deferred. **Interpretation-critical** — same rationale as C13.e (the wedge expectedly reads as $0 on non-presidential committees). See §5.i. | Twin of C13.e | | |
| K18.f | Methodology for "Refunds & offsets" wedge | TOOLTIP-VIZ | Raised-tab donut legend, "Refunds & offsets" wedge | Production verbatim: *"Vendor refunds, returned deposits, and other amounts credited back to the committee. These are recorded as receipts by the FEC but don't represent new money raised."* Differs from C13.f on "committee" vs "campaign." Copy review deferred. **Interpretation-critical** — same rationale as C13.f. See §5.i. | Near-twin of C13.f | | |

### race.html

| Audit ID | Concept | Destination | Specific attachment point | What's preserved | What's cut / merged with | Complete | Verified |
|---|---|---|---|---|---|---|---|
| R1.a | "as reported to the FEC" loose source attribution | PAGE-NOTE | Page-level note | Shipped 2026-05-28 (Phase 2 race-first prototype). Transformed: *"Source: FEC."* with the word *FEC* linked to **https://www.fec.gov/** (flipped from the v1 api.open.fec.gov decision — fec.gov is the consumer-facing site, more useful destination for casual users). #race-note element relocated OUTSIDE #tab-candidates to a page-level slot inside #race-content (sibling of #tab-candidates / #tab-insights) so it stays visible regardless of which tab is active. | Parity with C4.e / K1.d (forthcoming) | ✓ | ✓ |
| R1.b | "Candidates may not yet have filed for all periods" data-completeness caveat | PAGE-NOTE | Page-level note | Shipped 2026-05-28 (Phase 2 race-first prototype). Sentence preserved verbatim; paired with R1.a's source line in the same paragraph. Source-first ordering. | — | ✓ | ✓ |

### Borderline rows from the audit

| Audit ID | Concept | Destination | Notes | Complete | Verified |
|---|---|---|---|---|---|
| B1 | `.inline-status-msg` per-tab loading text ("large committees can take 30+ seconds…") | (unchanged) | Operational status, not a data note. Stays exactly as-is in its `.inline-status-msg` role. | n/a | n/a |
| B2 | `initPageLoadingTimers` 10s "still loading" message | (unchanged) | Same as B1 — operational. Stays exactly as-is. | n/a | n/a |
| B3 | overspend-note (= C7 / K2) | (stays as `.callout`) | See C7 / K2 row — judgment call #2 resolved: option (a). | n/a | n/a |
| B4 | K15 section-subtitle reading | CUT (= K15) | Already in mapping. | n/a | n/a |

---

## 2. Page-level note content per page

After mapping, here's what each page's PAGE-NOTE actually carries (concept-level, in proposed reading order — not finished copy).

### candidate.html

| Order | Content element |
|---|---|
| 1 | Coverage-through date (page-wide coverage-window stamp) |
| 2 | Source line — *"Source: FEC."* with link to https://www.fec.gov/ |
| 3 | ≤$200 itemization caveat — *"Individual contributions of $200 or less are not itemized."* |

**Total: 3 elements.** Within hypothesis range (2–3). C1 (provisional caveat) is gone; C4.a (FEC ID) is gone; cadence / refresh-rate framing is gone. The candidate page-note is leaner than v1's projection.

### committee.html

| Order | Content element |
|---|---|
| 1 | Coverage-through date (page-wide coverage-window stamp) |
| 2 | Source line — *"Source: FEC."* with link to https://www.fec.gov/ |
| 3 | ≤$200 itemization caveat — *"Individual contributions of $200 or less are not itemized."* |

**Total: 3 elements.** Identical shape to candidate. No FEC ID (handled by meta-row tag); no cadence framing.

### race.html

| Order | Content element |
|---|---|
| 1 | Source line — *"Source: FEC."* with link to https://www.fec.gov/ |
| 2 | Data-completeness caveat — *"Candidates may not yet have filed for all periods"* |

**Total: 2 elements.** Race has no single race-wide coverage-through date (each candidate has their own), and no individual-contributions surface (so no ≤$200 caveat). The source line gives race parity with candidate / committee at the attribution layer.

### Hypothesis check: HOLDS (more strongly than v1)

- Candidate: 3 elements
- Committee: 3 elements
- Race: 2 elements

All within the 2–3 range. Sloane's decisions tightened the page-note further than v1's projection — the per-page source-line replaces both v1's separate "FEC ID" attribution AND the cadence statement, and the C1 honesty signal is cut rather than carried as a tooltip.

**The biggest single win of the architecture move:** four duplicate framings of the same fact (coverage-through date — currently surfaced as `#stat-coh-sub` "As of {date}", summary footer "Coverage through {date}", raised footer "Coverage through {date}", spent footer "Coverage through {date}") collapse to ONE PAGE-NOTE statement. Cadence ("Data updated nightly by FEC" + "refreshed daily" echo) drops out entirely in favor of the source-link.

---

## 3. Tooltip component spec input

Input to the downstream tooltip-component implementation ticket. Based on what the mapping routes to TOOLTIP-VIZ and TOOLTIP-LABEL after Sloane's decisions.

### Attachment-point types

The mapping now routes tooltips to **five** distinct attachment-point types (v1 had six; donut / chart-card tooltips dropped out entirely, section-header tooltips dropped out, and the cycle-index archive-divider type remains):

1. **Map / choropleth title** (Where Individual Contributions Come From — C8.b, K3.b+c)
2. **Spending-by-Purpose horizontal bars** (C9, C10.b, K14, K16.b)
3. **Data-table headers** (Top Committee Contributors, Top Conduit Sources, Top Individual Contributors, Top Vendors — C8.c, C8.d, K4–K8, C10.d, K16.d)
4. **Stat-card labels** (Raised:Spent Ratio — C4.d)
5. **Inline structural labels inside cycle-index** (Archive divider — C12.b, K17.b, anchored beside C12.a / K17.a)

**Dropped from v1:** chart-card / donut tooltips (all four CUT — page-level source-line covers attribution) and section-header tooltips (C11 stays as a SECTION-NOTE, not a tooltip).

### Content-length range

- **Shortest (TOOLTIP-LABEL on stats):** single-sentence definitions, ~10–20 words. E.g. C4.d *"Raised:spent = total receipts ÷ total disbursements"*.
- **Mid-range (most TOOLTIP-VIZ):** 1–2 sentences, ~30–60 words. E.g. C9 / K14 categories caveat (~25 words); K3.c amendment caveat (~15 words); the revised C8.c committee-contributors copy (~25 words).
- **Longest (single TOOLTIP-VIZ outlier):** the conduit-source explanation (C8.d / K8) — ~47 words in one sentence, ending in an em-dash subordinate clause. Two-clause paragraph if broken.

**The component must accommodate content up to ~50 words (single paragraph).** Most tooltips are shorter; the conduit case is the outlier. See §5.c — this is partly a content-design question (the conduit concept is genuinely complex) and partly a component question (can we render a paragraph in a tooltip readably).

### Criticality tiers

Some tooltip content is **interpretation-critical** — the user needs it to read the number correctly. Other content is **definitional / contextual** — useful but not load-bearing.

| Tier | Examples | What it means |
|---|---|---|
| **Interpretation-critical** | C8.d / K8 conduit explanation (without it, users misread ActBlue as a donor); K3.c amendment caveat (without it, users misread choropleth totals); the bulk-vs-API source distinctions in K4–K7 (different scope semantics depending on KV hit) | The user might draw a wrong conclusion if they don't see this. May warrant always-visible captioning near the viz, not just discoverable on hover. |
| **Definitional / contextual** | C4.d raised-to-spent definition; C12.b / K17.b archive-divider "why this cutoff" explanation | Useful gloss; user can read the number correctly without it. Discoverable-on-interaction is fine. |

**Component implication:** the design may want to support both registers — a quiet info-icon affordance for definitional tooltips, and a more visually present affordance (different icon? short caption-with-link?) for interpretation-critical content. The tooltip-component spec ticket should consider whether the same component handles both with a variant, or whether interpretation-critical content needs a different pattern (caption + "Learn more" affordance, for instance).

### Conditional / data-state-driven content

Several tooltips carry content that fires only on certain data conditions. The component must support assembling tooltip content from conditional fragments. Specifically (the v2 list is slightly shorter than v1 — C10.e Senate sub-cycle clause was cut):

- **C10.b / K16.b** — "(capped at 500 transactions)" surfaces only when the Schedule B fetch caps. Otherwise tooltip carries base methodology only.
- **C9** — "Covers most recent sub-cycle" trailing clause is candidate-only (Senate sub-cycle artifact); committee equivalent K14 omits it.
- **K4 vs K5, K6 vs K7** — Top Individual / Top Committee Contributor tooltips swap source-attribution copy based on KV hit (bulk) vs KV miss (live API). The tooltip on the table needs to know which data path served it.

**Component implication:** the tooltip API should accept conditional-content composition (assembled at render time from per-tooltip-instance data state), not just a static string per attachment point.

### What does NOT belong as a tooltip

The overspend callout (C7 / K2) is **data-state-conditional** — fires only when disbursements > receipts. Judgment call #2 resolved to keep it as a visible `.callout`, not a tooltip:

- Conditional tooltip APPEARANCE (the tooltip-icon's presence depending on data shape) is an unusual pattern; users learn to look for tooltips at known surfaces, not at "sometimes-there" affordances.
- The overspend pattern is semantically an ALERT ("you need to know this") rather than a CAVEAT ("info on demand"); the existing `.callout` class is the right shape for that semantic.
- If the design ever wants to surface overspend more quietly than today's callout, that's a callout-component decision, not a tooltip decision.

This is the same logic that informs the tooltip-spec's stance on conditionality: the tooltip's CONTENTS can be conditional (cap clause, bulk-vs-API source), but the tooltip's PRESENCE shouldn't be.

### Planned tooltip copy — consolidated review

All TOOLTIP-VIZ and TOOLTIP-LABEL destinations from §1 compiled in one place for tone/formatting consistency review. Rows numbered by attachment surface (1, 2, 3 …); conditional variants and per-page parity splits use letter suffixes (1a, 1b, …). Conditional variants 3a/3b, 4b/4c, 6c, etc. fire only on certain data states — see Specific attachment point for trigger semantics. Sloane's notes column is intentionally blank for review.

| # | V1? | Tooltip copy | Specific attachment point | Page(s) | Criticality tier | Related audit IDs | Sloane's notes |
|---|---|---|---|---|---|---|---|
| 1 | ✓ | *"Raised:spent = total receipts ÷ total disbursements"* | Raised:Spent Ratio stat-card label (TOOLTIP-LABEL) | candidate | definitional / contextual | C4.d | |
| 2a | ✓ | *"Geography reflects itemized individual contributions by state (Schedule A)."* | Where Individual Contributions Come From map | both | definitional / contextual | C8.b / K3.b | |
| 2b | ✓ | *"State totals may differ from summary figures due to FEC amendment processing."* | Where Individual Contributions Come From map (appended to #2a's tooltip) | committee (candidate parity TBD — §5.b) | interpretation-critical | K3.c | |
| 3a |  | *"Top individual contributors pre-computed from FEC bulk data, refreshed daily."* | Top Individual Contributors table — bulk variant; surfaces only when KV-hit | committee | interpretation-critical (bulk-vs-API scope semantics) | K4 | |
| 3b |  | *"Top individual contributors: {cycleLabel}."* | Top Individual Contributors table — API variant; surfaces only when KV-miss; conditional swap with #3a in same tooltip slot | committee | interpretation-critical (bulk-vs-API scope semantics) | K5 | |
| 4a |  | *"Top committee contributors: complete PAC, party, and other committee contributions across {cycleLabel}, deduplicated by committee ID."* | Top Committee Contributors table on candidate.html | candidate | interpretation-critical (scope + dedup methodology) | C8.c | |
| 4b |  | *"Top committee contributors pre-computed from FEC bulk data (pas2), refreshed daily."* | Top Committee Contributors table on committee.html — bulk variant; surfaces only when KV-hit | committee | interpretation-critical (bulk-vs-API scope semantics) | K6 | |
| 4c |  | *"Top committee contributors: complete {cycleLabel} cycle, deduplicated by committee ID."* | Top Committee Contributors table on committee.html — API variant; conditional swap with #4b | committee | interpretation-critical (bulk-vs-API scope semantics) | K7 | |
| 5 |  | *"Top conduit sources: aggregated from memo entries (memo_code=X) identifying platforms (ActBlue, WinRed, etc.) that forwarded individual contributions — amounts reflect individuals' money, not the platforms' own funds."* | Top Conduit Sources table | both | **interpretation-critical** (the architecture's stress case — without it, users misread platform contributions as platform donations; see §5.c) | C8.d / K8 | |
| 6a | ✓ | *"Categories estimated from FEC disbursement descriptions using keyword matching. Some transactions may be miscategorized. Covers most recent sub-cycle."* — **when the Schedule B fetch caps**, the tooltip appends *"(Capped at 500 transactions.)"* (C10.b conditional fragment; trailing "Covers most recent sub-cycle" is candidate-only Senate sub-cycle artifact) | Spending by Purpose bars on candidate.html | candidate | interpretation-critical (keyword-matching imprecision affects how user reads category totals; the cap append flags incomplete coverage) | C9 + C10.b (conditional) | |
| 6b | ✓ | *"Categories estimated from FEC disbursement descriptions using keyword matching. Some transactions may be miscategorized."* — **when the Schedule B fetch caps**, the tooltip appends *"(Capped at 500 transactions.)"* (K16.b conditional fragment) | Spending by Purpose bars on committee.html | committee | interpretation-critical (keyword-matching imprecision; cap append flags incomplete coverage) | K14 + K16.b (conditional) | |
| 7 | ✓ | *"Top vendors deduplicated by recipient."* | Top Vendors table | both | definitional / contextual | C10.d / K16.d | |
| 8a | ✓ | *"Data for {office} races prior to {threshold} is less complete; no detail view available."* | Cycle-index archive divider, anchored beside C12.a's label | candidate | definitional / contextual | C12.b | |
| 8b | ✓ | *"Data for cycles prior to {threshold} is less complete; no detail view available."* | Cycle-index archive divider, anchored beside K17.a's label | committee | definitional / contextual | K17.b | |

**14 total entries** (8 distinct attachment surfaces). **V1 scope: 8 rows** (1, 2a, 2b, 6a, 6b, 7, 8a, 8b) — surfaces with simpler placement (stat label, choropleth, Spent-tab bars/table without nested sub-tabs, cycle-index archive divider). **Deferred to V2: 6 rows** (3a, 3b, 4a, 4b, 4c, 5) — all inside the Raised → "Top Contributors by type" nested sub-tab section (Committees / Conduits / Individuals); tooltip-on-sub-tab placement is more complex and benefits from its own scoping pass. Variants split into letter suffixes for: choropleth (2a base + 2b committee-only amendment caveat), Top Individuals (3a bulk / 3b API conditional swap), Top Committees (4a candidate / 4b committee bulk / 4c committee API), Spending by Purpose (6a candidate base / 6b committee base — cap conditional merged inline per fragment in each), and archive divider (8a candidate / 8b committee). When the tooltip component lands and these ship, each row's audit ID flips to ✓ in the §1 mapping table.

---

## 4. Race-parity findings

For each major category in the audit, does race need parity with candidate / committee in the new architecture? v2 simplifies this section because cadence is retired and the per-card freshness pattern is not pursued.

| Category | Candidate | Committee | Race today | Race in new architecture | Parity verdict | Complete | Verified |
|---|---|---|---|---|---|---|---|
| **Source attribution** (page-level source line) | Shipped 2026-05-29 (Phase 2 candidate+committee). New PAGE-NOTE source line: *"Source: FEC."* with link to https://www.fec.gov/ | Shipped 2026-05-29. Same source line. | Loose: "as reported to the FEC" | Shipped 2026-05-28 (Phase 2 race-first prototype). Same source-line treatment as candidate / committee. | **Resolved — parity achieved across all three pages.** All three pages now share the identical Source-first / fec.gov-linked treatment. | ✓ | ✓ |
| **Coverage-through (page-level coverage-window stamp)** | Yes (single page-wide date) | Yes (single page-wide date) | None | Race aggregates `/elections/` — each candidate's `coverage_end_date` is per-candidate; there's no single race-wide date. Per-card freshness stamps were proposed in v1 but are not pursued in v2. | **Appropriately absent.** The page-note shape differs by structural necessity. | n/a | n/a |
| **Methodology** (Schedule A walks, keyword-matched purpose, dedup logic, memo-code conduit logic) | Multiple TOOLTIP-VIZ destinations | Multiple TOOLTIP-VIZ destinations | No methodology surfaces — race uses `/elections/`, which is FEC's pre-aggregated record | Race has no viz that need methodology explained. | **Appropriately absent.** Not a gap. | n/a | n/a |
| **Data-completeness caveats** | ≤$200 itemization shipped to PAGE-NOTE 2026-05-29 (Phase 2 candidate+committee); JFA gap (SECTION-NOTE on committees) | ≤$200 itemization shipped to PAGE-NOTE 2026-05-29; volume-cap (EMPTY-STATE) | One caveat: "candidates may not yet have filed for all periods" (R1.b) | R1.b shipped 2026-05-28 (Phase 2 race-first prototype) — sentence preserved, paired with source line in page-level note. The primary-loser-counting caveat (currently banked in project-brief.md) remains an open content question — see §5.e. | R1.b is appropriate parity at the data-completeness layer; primary-loser caveat is a banked-but-open product-honesty question for the designer. | n/a | n/a |
| **Provisional / validation honesty signal** (C1) | Cut entirely (judgment call #1 = c) | None | None | N/A — the concept does not carry forward. | **Decided.** Not a gap; the category is retired across all three pages. | n/a | n/a |

### Summary

Race goes from 1 PAGE-NOTE element today to **2 PAGE-NOTE elements** in the new architecture (source line + completeness caveat). Smaller expansion than v1 projected, because the cadence row is retired and per-card freshness stamps are not pursued. Race is the simplest of the three page-notes by design.

---

## 5. Observations (brief)

Things the mapping surfaced that don't fit cleanly inside the deliverables above, plus a small set of open follow-ups from Sloane's review.

### a. K11 vs K12 register inconsistency — resolved 2026-05-28

K11 ("Committee contribution data is not available for this committee type") and K12 ("Unable to show due to high transaction volume") both EMPTY-STATE on the same table cell, fired by different data conditions. The audit flagged that one read as structural / explanatory and the other as apologetic / capacity-bound. **Resolved 2026-05-28** by standardizing all four Raised-tab empty-state cells (K11, K12, K12.5 Top Individuals — audit backfill, K13) to the *"Data not available …"* stem. Each cell now reads as a neutral statement of fact rather than two different registers. The shipped copy:

- **K11:** *"Data not available for this committee type."*
- **K12, K12.5, K13:** *"Data not available due to high transaction volume."*

The "committee contribution" scoping that K11 lost is now carried implicitly by the table heading (Top Committee Contributors). The whole-view empty-state pattern (C5) is structurally distinct from these in-table cells — see §5.f.

### b. Investigate K3.c amendment caveat on candidate-page choropleth

Sloane's note on K3.c flagged this as a candidate-parity question. The Schedule A amendment behavior described by K3.c ("State totals may differ from summary figures due to FEC amendment processing") applies on both candidate.html and committee.html, but the audit found this caveat only on committee.html (it's absent from C8). When the candidate choropleth tooltip lands, the implementation ticket should verify whether the caveat is also load-bearing for candidate and, if so, add it there.

### c. The conduit-source tooltip is the architecture's stress case

C8.d / K8 is the single longest piece of methodology copy in the audit (~47 words) and the most interpretation-critical (without it, users misread platform contributions as platform donations). The tooltip-component spec (§3) flags this case explicitly — it's both the longest content the component must accommodate AND the strongest case for the criticality-tier distinction. Worth treating this case as a design driver for the tooltip-component ticket rather than an edge case the component has to grudgingly support.

### d. C12 vs K17 archive-divider — Sloane's revised copy normalizes most of the inconsistency

In v1 the divider text differed across pages (candidate carried "for {office} races"; committee did not). Sloane's revised copy normalizes much of this:

- **Inline label (COMPONENT-LABEL) — shipped 2026-05-28:** candidate = *"Archived elections (totals only)"*; committee = *"Archived cycles (totals only)"*. Both use the *"Archived {unit} (totals only)"* shape with appropriate per-page units. **The prior "FEC coverage begins X" explanation was dropped (Option B) rather than carried as inline text.**
- **Tooltip (TOOLTIP-VIZ) — currently absent in production, pending tooltip component:** candidate = *"Data for {office} races prior to {threshold} is less complete; no detail view available."*; committee = *"Data for cycles prior to {threshold} is less complete; no detail view available."*. Same shape, candidate retains the office-specificity that the committee version doesn't need.

This is parity at the shape level rather than the literal-string level — appropriate given the actual per-page domain differences. No further normalization needed. **Interim user-facing trade:** the dropped explanation means users currently see the archive-divider label without the "why this cutoff exists" context. Returns when tooltip ships.

### e. The primary-loser caveat on race is a banked open question

R1.b ("Candidates may not yet have filed for all periods") covers data-completeness for FILING, but doesn't address ROSTER COMPOSITION. The FEC `/elections/` endpoint continues to return all original filers between primary and general — including primary losers — with no field marking them as eliminated. Strategists reading a race page mid-cycle see an inflated count and a padded card lineup. The fix requires a primary-results data source the FEC doesn't provide (project-brief.md marks it "acceptable for now").

A transparency note at PAGE-NOTE level would close the interpretive gap without requiring the data fix. This is a copy decision (out of scope here), but worth flagging as a should-this-be-added question for the designer alongside the v2 race PAGE-NOTE composition. If added, the page-note would expand from 2 to 3 elements on race.

### f. C5 (cycle empty-state) is correctly an EMPTY-STATE but lives outside any table

Routed to "Cycle-detail empty state (whole-view, not a table cell)" — meaning the cycle-detail surface needs an empty-state pattern that's distinct from the in-table empty-state K11 / K12 / K12.5 / K13 are using. Worth flagging to whichever ticket lands the cycle-detail empty-state copy: this is a page-section empty state, not a table-cell empty state. Different design pattern.

### g. Two new buckets emerged from Sloane's review

v2 extends v1's five-bucket taxonomy with two additional buckets:

- **SECTION-NOTE** (C11 only) — data-note content scoped to a section/modal rather than the whole page. Distinct from PAGE-NOTE (per-page) and from TOOLTIP-VIZ (on-demand).
- **COMPONENT-LABEL** (C12.a, K17.a) — inline structural label that's part of a component's visual design, not editorial caveat content. Distinct from a data-note in role even when it might share styling.

Worth flagging: if more notes in future pages route to either bucket, those become real patterns worth documenting in design-system.html. Right now both are single-use.

### h. The page-note consolidation is the biggest win of the architecture move

Coverage-through date duplication (one fact, four surfaces, four cosmetic variants per page) collapses to ONE PAGE-NOTE statement, with `#stat-coh-sub` "As of {date}" remaining as the inline glance signal next to the Cash on Hand stat. Two surfaces, one canonical source.

Cadence framing ("Data updated nightly by FEC" + the echo "refreshed daily" in K4 / K6) is retired entirely in favor of the per-page source-link — the architecture move PLUS Sloane's decision delete a category of duplication rather than just consolidating it. Two existing surfaces per page reduce to ONE source-link, with no claim about refresh frequency.

Not a hypothesis the audit explicitly framed, but it's the biggest single win of the architecture move and worth naming.

### i. Raised-donut wedge tooltips added 2026-05-29 from T-tooltip-audit findings

T-tooltip-audit (2026-05-29) inventoried the project's `title=`-driven tooltips and surfaced two source-of-truth families: the donut-info ⓘ tooltips on Raised donut legend wedges (rows 1 + 2 of the audit) and the party-tag hover tooltip family (row 3). The donut-info family was not in §1 — the v1 mapping covered data-note slots (PAGE-NOTE / SECTION-NOTE / footer-level) and didn't reach affordance-level on-element tooltips that predate v1. T-tooltip-audit-cleanup added them: **C13.a–f on candidate.html and K18.a–f on committee.html — 12 rows total, all destination TOOLTIP-VIZ, all preserving the production tooltip string verbatim** (copy review deferred to the downstream swap ticket). Per the audit, 4 of the 6 strings are byte-identical across candidate / committee; 2 differ on "campaign" vs "this committee" wording (Candidate self-funding and Refunds & offsets — see C13.b / K18.b and C13.f / K18.f). The other 4 Raised-donut wedges (Individuals itemized, Individuals unitemized, PACs & other committees, Party committees) carry no tooltip today and are deliberately out of v2 §1 scope per the swap-6-only decision.

**Interpretation-critical wedges:** Two of the six per page are interpretation-critical rather than purely definitional:
- **Federal funds (C13.e / K18.e):** clarifies that $0 is the expected value on non-presidential candidates / committees. Without it, an empty wedge could read as "missing" rather than "expected."
- **Refunds & offsets (C13.f / K18.f):** clarifies that the wedge represents money credited back to the committee, NOT new money raised. Matters for any "total raised" reading.

The remaining 4 per page (C13.a–d / K18.a–d) are definitional / contextual — they explain what each bucket represents without the same kind of interpretive load.

**Placement:** the donut-info ⓘ lives inside the Raised tab, so the actual swap to the new tooltip component is deferred along with the rest of the Raised-tab placement question (see §3 / Sloane's Raised-tab deferral). The audit + this row addition unblock the V1 scoping; the per-row Complete + Verified columns stay empty until the downstream swap ticket lands.

**Audit family not added to v2 §1 — fully retired:** the party-tag tooltip family (audit row 3) was classified by the audit as "may not need to swap" — small definitional tooltips on a small visible tag where the user-visible label already communicates the info, except the N/A bucket which carried unique info. T-tooltip-audit-cleanup (2026-05-29) resolved the N/A bucket (removed the tooltip; *"Party N/A"* visible label is sufficient) and attempted parity for race.html. **T-party-tag-completeness (2026-05-29) closed the family out entirely**: `partyLabel` and `partyClass` gained a `(p, party_full)` signature so unmapped third parties now show the full party name on every surface (was: a 3-letter FEC short code like "AIP" on candidate.html / committee.html / browse / search); with the visible label now carrying the full party info on every surface, the hover tooltip carried no info the label didn't already convey, and `partyTooltip` was deleted along with the inline-ternary `title=` injection at all 4 prior call sites. **Net result:** no `title=` on any party tag anywhere on the site; visible label is the sole affordance for every surface, every party. Audit row 3 fully closed.
