# FECLedger — Sankey diagram data model + library research

> **RESEARCH PHASE — UNEXECUTED (2026-06-04).** Initial research only. No code written, no library chosen, no ticket opened. This doc captures the verified FEC data model for a raised→spent Sankey and frames the open decisions to resolve (several flagged for Claude Chat). Pick this up when the Sankey moves from research to build.

*Self-contained; no prior context needed. Prepared from a research-mode session on 2026-06-04.*

---

## Goal

Replace the Raised donut + Spent donut (and, eventually, the Spending-by-Purpose bars) on `candidate.html` and `committee.html` with a single **Sankey diagram** of money flow: receipt sources → the committee → disbursement categories. The motivating insight is that two disconnected donuts hide the relationship between where money comes from and where it goes; a Sankey makes that one continuous picture.

Phasing decision (Sloane, 2026-06-04): **ship a totals-based Sankey first, WITHOUT spending purpose.** Even the totals-only version is a large win over the current donuts. Spending-purpose detail is a separate, harder research track (see §6).

---

## 1. The core finding: receipts and disbursements ARE clean partitions — at the right level

Both sides of the FEC `/totals/` endpoint form a **mutually-exclusive AND collectively-exhaustive partition** — the leaf categories sum *exactly* to the cycle `receipts` / `disbursements` total. This is what makes a conserving Sankey possible at all.

**Verified to the penny against live API (DEMO_KEY, cycle 2024):**

| Committee | `receipts` | leaf-sum check | `disbursements` | leaf-sum check |
|---|---|---|---|---|
| Candidate PCC — Marie for Congress (C00806174) | $11,856,001.72 | exact ✓ | $11,895,854.48 | exact ✓ |
| Super PAC — Senate Majority PAC (C00484642) | $389,968,278.37 | exact ✓ | $391,182,162.25 | exact ✓ |
| Party — DCCC (C00000935) | $339,935,852.88 | exact ✓ | $331,933,274.36 | within rounding (~$3) |
| Conduit — ActBlue (C00401224) | $3,821,173,165.20 | exact ✓ | $3,789,960,310.57 | within rounding |

**The catch:** the same endpoint mixes leaf fields with three classes of trap field. Summing naively double-counts (this caused +$50M / +$192M disbursement overages on the first pass before the traps were identified). The leaf set also **differs by form type** (candidate Form 3/3P vs PAC-party Form 3X).

### Trap fields — DO NOT sum these alongside the leaves

1. **Subtotals / rollups:** `contributions` (= individual + PAC + party), `individual_contributions` (= itemized + unitemized). These are sums of their own children.
2. **Net figures:** `net_contributions` (= contributions − refunds), `net_operating_expenditures` (= operating_exp − offsets). Gross-minus-contra, not categories.
3. **Duplicate aliases — same money under another name** (verified equal in live data): `fed_receipts` ≡ `receipts`; `fed_disbursements` ≡ `disbursements`; `fed_operating_expenditures` ≡ `other_fed_operating_expenditures` ≡ `operating_expenditures`.

---

## 2. Category definitions

**Provenance note:** the OpenFEC swagger (`https://api.open.fec.gov/swagger/?format=openapi`) documents only metadata fields (`committee_type`, `committee_designation`, `filing_frequency`, etc.) — **none of the receipt/disbursement money fields carry a description in the API schema.** Definitions below are sourced from the **FEC report forms themselves** (Form 3 House/Senate, Form 3P presidential, Form 3X PAC/party) and their line-item instructions, then cross-checked against the verified arithmetic above. They are NOT from the API spec — that spec is silent here.

### Receipts — candidate committees (Form 3 / 3P)

| API field | Definition | Line |
|---|---|---|
| `individual_itemized_contributions` | Individual contributions from donors whose cycle total exceeds $200 (name/employer disclosed) | 11(a)(i) |
| `individual_unitemized_contributions` | Small-dollar individual contributions, ≤$200 aggregate (no itemization) | 11(a)(ii) |
| `political_party_committee_contributions` | Contributions from official party committees | 11(b) |
| `other_political_committee_contributions` | Contributions from PACs / other non-party committees | 11(c) |
| `candidate_contribution` | The candidate's own personal funds GIVEN (not loaned) | 11(d) |
| `transfers_from_other_authorized_committee` | Transfers in from the candidate's other authorized committees | 12 |
| `loans_made_by_candidate` | Loans made/guaranteed by the candidate | 13(a) |
| `all_other_loans` | Loans from banks / third parties | 13(b) |
| `offsets_to_operating_expenditures` | Refunds/rebates of prior spending, counted back as a receipt | 14 |
| `offsets_to_fundraising_expenditures` / `offsets_to_legal_accounting` | Same, scoped to fundraising / legal-accounting spend (presidential-relevant) | 14 |
| `federal_funds` | Presidential public-financing matching funds (always 0 for House/Senate) | 3P only |
| `other_receipts` | Dividends, interest, miscellaneous | 15 |

### Receipts — PAC / party committees (Form 3X)

Same individual/PAC/party contribution lines, plus:

| API field | Definition | Line |
|---|---|---|
| `transfers_from_affiliated_party` | Transfers in from affiliated / other party committees | 12 |
| `all_loans_received` | All loans received (this was the $25M line that balanced SMP) | 13 |
| `other_fed_receipts` | Other federal receipts — dividends, interest (3X equivalent of `other_receipts`) | 17 |
| `transfers_from_nonfederal_account` | Non-federal / Levin transfers (party cmtes with allocated activity — verify if a party cmte is in scope) | 18 |

### Disbursements — candidate committees (Form 3)

| API field | Definition | Line |
|---|---|---|
| `operating_expenditures` | ALL operating spend — vendors, staff, media, fundraising, travel — as ONE undifferentiated bucket | 17 |
| `transfers_to_other_authorized_committee` | Transfers out to the candidate's other authorized committees | 18 |
| `loan_repayments` | Repayments of loans (candidate + other) | 19 |
| `contribution_refunds` | Money returned to donors. Splits into `refunded_individual_contributions` / `refunded_political_party_committee_contributions` / `refunded_other_political_committee_contributions` | 20 |
| `other_disbursements` | Miscellaneous | 21 |
| `fundraising_disbursements`, `exempt_legal_accounting_disbursement` | Presidential-specific exempt categories | 3P |

### Disbursements — PAC / party committees (Form 3X)

`operating_expenditures` + `contribution_refunds` + `other_disbursements` as above, plus:

| API field | Definition | Line |
|---|---|---|
| `fed_candidate_committee_contributions` | Money the committee GAVE to federal candidates / their committees (core leadership-PAC activity) | 23 |
| `independent_expenditures` | Spending for/against candidates with no coordination (super PACs, parties) — separate additive leaf, NOT nested in operating_expenditures (verified) | 24 |
| `coordinated_expenditures_by_party_committee` | 441a(d) coordinated party expenditures — party committees only | 25 |
| `transfers_to_affiliated_committee` | Transfers out to affiliated / other party committees | 22 |
| `loan_repayments_made` | Repayments of loans the committee received | 26 |

---

## 3. The hierarchy → responsive depth mapping

The receipt side is a natural 3-level tree, which means **mobile-vs-desktop is not a custom simplification — it's just which depth you render.** The Level-1/Level-2 nodes ARE the subtotal fields (`contributions`, `individual_contributions`), so the collapse is free.

```
receipts
├── contributions                                 ← L1 node "Contributions"
│   ├── individual_contributions                  ← L2 node "Individuals"
│   │   ├── individual_itemized_contributions     ← L3 leaf
│   │   └── individual_unitemized_contributions   ← L3 leaf
│   ├── other_political_committee_contributions   ← L3 leaf "PACs"
│   └── political_party_committee_contributions   ← L3 leaf "Party"
├── transfers_from_*                              ← L1 leaf "Transfers"
├── loans (candidate) / all_loans_received (3X)   ← L1 leaf "Loans"
├── candidate_contribution                        ← L1 leaf "Self-funding"
├── offsets_to_*                                  ← L1 leaf "Offsets"
└── other_receipts / other_fed_receipts           ← L1 leaf "Other"
```

- **Mobile (Level 1):** Contributions · Transfers · Loans · Self-funding · Offsets · Other → **Committee** → Operating · To candidates · IEs · Refunds · Transfers · Other
- **Desktop (Level 3):** explode Contributions → Itemized / Unitemized / PAC / Party; etc.

Disbursements have no comparable depth at the totals level (`operating_expenditures` is one flat bucket) — depth on the spend side only arrives with the purpose layer (§6).

**Existing donut grouping to inherit or override (candidate.html, `renderContributorDonut`, 2026-06-08):** the current raised donut does NOT render the three loan/self fields as three separate wedges. It groups them by **source** (who the money came from), not by instrument:
- **"Candidate self-funding"** wedge = `candidate_contribution` (a gift) **+** `loans_made_by_candidate` (a loan). The candidate's own loan is grouped with their own gift — both are money from the candidate.
- **"Loans"** wedge = `all_other_loans` only (banks / third parties). Tooltip explicitly says "not including candidate self-funding loans."
- (Similarly, the donut merges the three `offsets_to_*` fields into one **"Refunds & offsets"** wedge.)

So the §2 leaf tables list `candidate_contribution` / `loans_made_by_candidate` / `all_other_loans` as three atomic leaves, but the live donut pre-groups them 2+1 by source. **Sankey decision:** keep the donut's source-based grouping (self-funding vs external loans — cleaner story, and lets the candidate's loan sit beside their gift) OR expand to the raw three leaves (more granular, but "Loans" then needs to disambiguate candidate vs bank). Decide deliberately rather than inheriting by accident. This grouping is **candidate.html only** — committee (Form 3X) committees have no `candidate_contribution` / `loans_made_by_candidate` fields, so there's no "Candidate self-funding" wedge there (the candidate↔committee category asymmetry noted in §2 applies here too).

---

## 4. Conservation / reconciliation — left total ≠ right total (by design)

Receipts and disbursements **do not balance**, and that's correct: the difference is absorbed by cash-on-hand and debt.

```
cash_on_hand_beginning_period + receipts − disbursements = last_cash_on_hand_end_period
```

**Open decision (→ Chat, see §8):** whether to make the Sankey *visibly* conserve by adding `Cash on hand (start)` as a left node and `Cash on hand (end)` + `Debt` as right nodes (left-total = right-total, more honest, but +2–3 nodes and needs a clear visual story for "money that didn't move"), or keep it as sources→committee→spend and accept the two ends don't sum.

---

## 5. Contra-flows: offsets + refunds (Sloane's call)

Two categories recirculate — money crosses the in/out boundary:
- `offsets_to_operating_expenditures` is a **receipt** that's really a refund of prior **spending**.
- `contribution_refunds` is a **disbursement** that returns money received as a **contribution**.

**Key clarification (added 2026-06-05):** these two categories are ALREADY full members of the MECE partition (§1) — offsets is a receipt leaf, refunds is a disbursement leaf. **The Sankey totals exactly with no special treatment at all.** "Contra-flow" is not what makes it balance, and not a more *accurate* number — it's a more *expressive* way to draw categories that are represented regardless. There are three distinct treatments, and they are NOT all math-neutral:

| Treatment | What it does | Numbers | Matches Raised/Spent stat cards? |
|---|---|---|---|
| **1. Plain (baseline)** | Offsets = a normal left source; refunds = a normal right sink. Both at gross. | Exact `receipts` / `disbursements` | ✓ Yes |
| **2. Thin recirculating flow** (visual annotation only) | Same as #1 but drawn distinctly (thin/curved/looped/colored) to *signal* "recirculating, not fresh/terminal money" | **Byte-identical to #1** | ✓ Yes |
| **3. Netting** | Net offsets into operating_expenditures and refunds into contributions → shows `net_operating_expenditures` / `net_contributions` | **Totals SHRINK to net figures** (Sankey still balances node-to-node, but headline totals drop) | ✗ **No — would mismatch the stat cards** |

Worked example (Marie 2024): gross receipts $11,856,001.72 / disbursements $11,895,854.48; fully netted → $11,660,957.44 / $11,700,810.20. The receipts−disbursements gap is preserved either way (so cash-on-hand reconciliation survives), but the netted headline no longer matches `#stat-raised`/`#stat-spent`.

**Scale check:** these are small slivers for most committees (Marie: offsets 0.37% of receipts, refunds 1.3% of disbursements), so plain (#1) likely renders as two barely-visible threads.

**Decision (Sloane, 2026-06-04, refined 2026-06-05):** start with **plain, gross (#1)** so the Sankey total matches the stat cards above it. Only reach for the **recirculating visual (#2)** if offsets-reading-as-fundraising actually bothers us against the rendered result — it's a pure legibility call, zero math cost. **Avoid netting (#3)** unless we accept the stat-card mismatch (probably not worth it). The earlier "net them out if they don't read well" framing was imprecise — netting is a real tradeoff with a consistency cost, not a free visual toggle.

---

## 6. Spending purpose — deferred, with an accuracy-flip worth noting

The "purpose" breakdown (media / payroll / fundraising / etc. — today's Spending-by-Purpose bars) is **not in the `/totals/` endpoint.** `operating_expenditures` is one flat bucket. Purpose detail lives only in **Schedule B transaction data** (`disbursement_description` free text → `PURPOSE_MAP` keyword bucketing), which:
- does **not** sum back to `operating_expenditures` (capped 500-txn walk, memo rows, messy descriptions);
- for **Senate / presidential**, is further degraded because the current purpose bars only include **the latest subcycle's** transactions, not the full cycle.

**The flip:** the totals-based Sankey is *more accurate than what it replaces* for multi-subcycle offices, because `/totals/?election_full=true` returns the full-cycle pre-aggregated figures. The purpose layer is the thing that *reintroduces* the subcycle/cap/memo inaccuracy. So "ship totals Sankey first, research purpose later" isn't just easier — it's strictly more correct in the interim.

**Future purpose-layer research questions (not now):**
- Can purpose be a *separate view* (toggle) rather than replacing the totals categories, so the conserving totals Sankey stays the honest default?
- Can the full-cycle Schedule B walk be made to conserve (or get a visible reconciling "Unclassified" flow)?
- Does the subcycle limitation get fixed by iterating all subcycles for Schedule B (the way `/totals/?election_full=true` already does for aggregates)?

---

## 7. Accessibility — accepted reduced scope (Sloane's call)

A11y is normally a stated project priority, but **Sankey accessibility is genuinely hard** (flow geometry doesn't map cleanly to a screen-reader narrative, and most charting libs render to canvas with no semantic tree). **Decision (Sloane, 2026-06-04): this chart may ship without full accessibility features, and that's acceptable for this purpose** — provided there's a reasonable workaround so the data isn't *only* available in the chart.

**Proposed workaround (to validate at build):** pair the Sankey with a visually-hidden (`.sr-only`) or expandable data table that states the same flows in text — "Individual itemized contributions: $7.5M (63% of receipts)" etc. The numbers already exist (they're the node/flow values), so the table is cheap, fully accessible, and doubles as a no-JS / print fallback. This keeps the *information* accessible even if the *visualization* isn't. Consider an `aria-label` summary on the chart container pointing to the table.

---

## 8. Library evaluation

### Hard constraints (rule things in/out)
- **No build step.** Vanilla HTML/CSS/JS, CDN-only `<script>` — no npm/bundler. (Project convention; see CLAUDE.md.)
- **Must be free** for commercial use (possible go-live / paywall). **→ Highcharts removed** (paid commercial license; Sloane's call 2026-06-04).
- **Tooltips must match** the existing `.viz-tt` HTML-tooltip system (`externalChartTooltip` in `utils.js`). **Approach (Sloane's call): style over the library's tooltip, invest in full alignment as a follow-up.** So a lib whose tooltip is CSS-stylable / overridable is preferred over one that bakes its tooltip into a canvas.
- **Themeable** to the parchment palette + `--cat-*` tokens.
- **Low maintenance burden.** Steer away from any option that could get messy/hard to maintain (rules against hand-building, see below).
- A second charting lib alongside Chart.js 4.4.0 is on the table (Chart.js has no Sankey).

### Candidates

| Library | License | Sankey | CDN / no-build | Tooltip stylable | Maintain risk | Notes |
|---|---|---|---|---|---|---|
| **Apache ECharts** | Apache-2.0 (free, incl. commercial) | Native `series.type:'sankey'` | Yes, single CDN file | Yes — `tooltip.formatter` + CSS, or fully custom HTML | Low | Strongest "free + batteries-included" fit. SVG **or** canvas renderer (SVG helps the a11y/print story). Themeable via option object reading our tokens. |
| **D3 + d3-sankey** | ISC/BSD (free) | Plugin computes layout; you render SVG | Yes (d3 CDN) | N/A — you build everything, so total control | **High** ← against Sloane's maintain-simple steer | Max control over theming/a11y/responsive-collapse and tooltip alignment, but you own all rendering, resize, interaction code. Most code to maintain. **Deprioritized** unless a lib proves too rigid. |
| **Plotly.js** | MIT (free) | Native sankey trace | Yes, but large bundle (~3MB+) | Partial — `hovertemplate`; harder to fully match `.viz-tt` | Medium | Works, but heavy for a no-build site already loading Chart.js. Tooltip alignment is the weak spot. |
| **Google Charts** | Free to use, **but** see drawbacks | Native sankey | Loader only — **see below** | Limited / awkward to fully restyle | Medium-High | Significant non-obvious drawbacks → §8.1. |
| ~~Highcharts~~ | ~~Paid commercial license~~ | — | — | — | — | **Removed** — not free for commercial use. |

### 8.1 Google Charts — the remote-loader drawbacks (researched 2026-06-04)

Beyond "it's a Google dependency," there are concrete reasons it fits this project poorly:

- **Self-hosting is prohibited by Google's ToS.** You may NOT download/host `loader.js` or the visualization code on your own servers. Every visitor's browser **must** fetch `https://www.gstatic.com/charts/loader.js` at runtime. ([Google Charts FAQ](https://developers.google.com/chart/interactive/faq))
- **Hard external runtime dependency.** If gstatic is blocked (corporate firewall, CSP, ad-blocker, region), down, or the user is offline, the chart simply doesn't render — for a portfolio piece that's a reliability/quality risk outside your control. CSP issues are a recurring real-world complaint.
- **Privacy posture mismatch.** The chart *data* stays client-side (Google Charts doesn't exfiltrate your dataset), but every page view still pings Google's servers for the loader, revealing usage to Google. The brief explicitly flags harassment/privacy concerns for a politics tool — a no-third-party-pings posture is more defensible.
- **No version pinning on your terms.** You load from Google's CDN under their cadence, not a self-hosted pinned file.
- **Deprecation terms.** Google Charts is currently "actively maintained" and not deprecated, **but** the terms let Google cease a version on notice (and immediately in some cases). A dependency you can't self-host AND can't guarantee longevity of is a poor base for a long-lived portfolio piece. ([Google deprecation policy](https://developers.google.com/terms/deprecation))
- **Tooltip restyling is awkward** — works against the "match `.viz-tt`" goal.

### 8.2 Leaning (not a decision — for the Chat conversation)

**Apache ECharts** looks like the best fit on paper: free + commercial-OK, native sankey, single self-hostable CDN file (no remote-loader ToS trap), SVG renderer that helps the a11y/print fallback, and a stylable/overridable tooltip that makes the "style over the library, align fully as follow-up" plan viable. **D3+d3-sankey** is the fallback if ECharts proves too rigid to theme/collapse — but its maintenance cost cuts against Sloane's "keep it simple to maintain" steer, so it's the second choice, not the first. Validate with a quick prototype of the actual flow + parchment theming before committing.

---

## 9. What to bring to Claude Chat

1. **Library pick.** Confirm Apache ECharts as the default (free, native sankey, self-hostable CDN, SVG, stylable tooltip), with D3+d3-sankey as the documented fallback. Decide whether a quick two-library prototype (ECharts vs Plotly) is worth it before committing, or just commit to ECharts.
2. **Conservation visual (§4).** Show cash-on-hand-start / cash-on-hand-end / debt as nodes so the Sankey visibly balances? Or sources→committee→spend only, two ends don't sum? Affects node count and the visual story for "money that didn't move."
3. **Contra-flows (§5).** Confirm **plain gross (#1) for v1** (offsets/refunds as ordinary source/sink so the total matches the stat cards); recirculating visual (#2) only if offsets-as-fake-fundraising bothers us; netting (#3) ruled out for the stat-card mismatch. Mostly settled — just confirm.
4. **A11y workaround (§7).** Confirm the sr-only / expandable data-table pairing as the accepted accessible fallback, and whether it should be visible-by-default (a "View as table" toggle) or hidden.
5. **Spending-purpose phasing (§6).** Confirm purpose is out of v1; decide whether the eventual purpose layer is a *separate toggle view* (keeping the conserving totals Sankey as the honest default) vs. replacing the totals spend categories.
6. **Scope of replacement.** Does the Sankey replace BOTH donuts (raised + spent) in one chart, on BOTH `candidate.html` and `committee.html`? And does it replace the Spending-by-Purpose bars only once the purpose layer lands, or do the bars stay as a separate section indefinitely?
7. **Tooltip follow-up sequencing.** Agree that v1 ships with a "good enough" styled-over library tooltip and full `.viz-tt` alignment is an explicit, separately-ticketed follow-up — so it doesn't block the first ship.

---

## Appendix — verification commands

```bash
# Candidate (Form 3) — election_full full-cycle aggregate
curl -s "https://api.open.fec.gov/v1/candidate/H2WA03217/totals/?api_key=DEMO_KEY&cycle=2024&election_full=true&per_page=1"
# Candidate PCC (Form 3)
curl -s "https://api.open.fec.gov/v1/committee/C00806174/totals/?api_key=DEMO_KEY&cycle=2024&per_page=1"
# Super PAC (Form 3X, IE-only)
curl -s "https://api.open.fec.gov/v1/committee/C00484642/totals/?api_key=DEMO_KEY&cycle=2024&per_page=1"
# Party (Form 3X)
curl -s "https://api.open.fec.gov/v1/committee/C00000935/totals/?api_key=DEMO_KEY&cycle=2024&per_page=1"
# Conduit / hybrid (Form 3X)
curl -s "https://api.open.fec.gov/v1/committee/C00401224/totals/?api_key=DEMO_KEY&cycle=2024&per_page=1"
# Swagger (confirms money fields are undocumented)
curl -s "https://api.open.fec.gov/swagger/?format=openapi"
```

Conservation method: sum the leaf fields per §2 (excluding all §1 trap fields), compare to `receipts` / `disbursements`. Candidate + super PAC reconcile to the penny; party/conduit to within rounding.

### Test fixtures — candidates exercising the self-funding / loans split (verified live 2026-06-08)

For validating the candidate.html donut grouping (§3) and the future Sankey — candidates with **all three** loan/self fields non-zero (so both the "Candidate self-funding" and "Loans" wedges render, and the self-loan-vs-bank-loan split is exercised). Both have 2024 detail-view pages. Sourced from the FEC bulk candidate-summary file (`weball24`, cols 12/13/14 = CAND_CONTRIB / CAND_LOANS / OTHER_LOANS), cross-checked against `/candidate/{id}/totals/?election_full=true`:

| Candidate | URL | gift (`candidate_contribution`) | self-loan (`loans_made_by_candidate`) | bank loan (`all_other_loans`) | Notes |
|---|---|---|---|---|---|
| **Michael Sapraicone** (S-NY 2024) | `/candidate/S4NY00404#2024` | $83,451 | $600,000 | $50,050 | Most *balanced* all-three; best for showing all three fields as distinct. Senate = 6-yr multi-subcycle. (His `H4NY03184` House id has no election_full record — use the `S4…` id.) |
| **Paul Junge** (H-MI08 2024) | `/candidate/H0MI08141#2024` | $355 | $4,100,000 | $700,000 | Largest ($5.98M receipts), cleanest House 2-yr cycle; both wedges prominent but gift is a token $355. |

Scarcity: only **15 of 3,857** candidates in the 2024 cycle have all three fields > 0 (45 meet the relaxed "(gift OR self-loan) + bank loan"). To regenerate: download `https://www.fec.gov/files/bulk-downloads/2024/weball24.zip` (follow the 302 with `curl -L`) and filter cols 12/13/14.
