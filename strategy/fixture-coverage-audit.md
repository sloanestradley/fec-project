# Fixture coverage audit — `tests/helpers/api-mock.js` vs `utils.js` helpers

**Date:** 2026-06-01
**Trigger:** T-party-helpers-dual-field-rewrite surfaced that mock fixtures only covered mainstream party cases for `partyLabel`/`partyClass` — multiple production bugs (PPP / DFL / UNAFFILIATED) went undetected through the test suite because no fixture exercised the failure paths.

This audit applies the same lens to every other utility helper in `utils.js`. Goal: surface where mock fixtures don't represent real-world FEC data shapes that production users actually encounter, prioritized by likelihood × impact.

**Out of scope:** this is an audit deliverable, not a fix. Each gap below becomes (or doesn't become) a separate scoped follow-up ticket. The triage discipline matters — not every uncovered branch warrants test scaffolding.

---

## 1. Helper-by-helper coverage

### 1.1 `partyClass` / `partyLabel` — ✅ FULLY COVERED

Audited and closed in T-party-helpers-dual-field-rewrite (2026-06-01). 38 unit tests in `tests/party-helpers.spec.js` (page.evaluate against design-system.html) cover every branch: every N/A short code, every verified N/A full name, every mainstream party (short and full forms), variant affiliates (DFL named), cryptic codes (PPP named), empty inputs (Kanye named), and a cross-surface invariant block locking same-input-same-output across 6 real-candidate scenarios.

**No further work needed.**

---

### 1.2 `formatRaceName(office, state, district)` — ⚠️ GAPS

| Branch | Trigger | Fixture coverage |
|---|---|---|
| Presidential | `office='P'` → `'US President'` | ❌ NONE |
| At-large House | `office='H'` + `district='00'` → `'House • {state}'` | ❌ NONE |
| House with district | `office='H'` + `district !== '00'` → `'House • {state}-{district}'` | ✓ H/WA/03 |
| Senate | `office='S'` → `'Senate • {state}'` | ✓ S/WA/00 in CANDIDATES_TOTALS |
| Other / null office | raw fallback | ⚠ unlikely to ever appear in real data |

**Gaps:**
- **Presidential candidates** — every 4 years FEC has thousands of presidential candidates. Race.html supports `/race?state=US&office=P&year=2020`. No fixture exercises the `office='P'` branch.
- **At-large House districts** (7 states: AK/DE/MT/ND/SD/VT/WY) — `district='00'` triggers a distinct output branch. No fixture covers it.

### 1.3 `formatRaceLabelLong(office, state, district)` — ⚠️ SAME GAPS

Mirror of `formatRaceName` — same branches, same fixture coverage. Same gaps (Presidential + at-large House).

### 1.4 `raceHref(office, state, district, year)` — ⚠️ SAME GAPS

Three branches:
- Presidential → `/race?state=US&office=P&year=Y` ❌ NO FIXTURE
- At-large House → `/race?state=X&office=H&year=Y&district=00` ❌ NO FIXTURE
- Other House → `/race?state=X&office=H&year=Y&district=NN` ✓
- Senate → `/race?state=X&office=S&year=Y` (no district) ⚠ only via CANDIDATES_TOTALS

CLAUDE.md explicitly notes that the Presidential and at-large House cases "two cases that the prior inline construction (candidate.html ~1824) got wrong" — i.e., these are KNOWN failure modes that the helper was created to handle. Yet no test fixture exercises them.

---

### 1.5 `toOrdinal(n)` — ⚠️ GAPS (significant)

Used by `formatRaceLabelLong` for House districts.

| Branch | Trigger | Example | Fixture coverage |
|---|---|---|---|
| Teen exception | mod 100 ∈ [11, 13] | 11th/12th/13th | ❌ NONE |
| Mod 10 = 1 | non-teen ending in 1 | 1st, 21st, 31st | ❌ NONE |
| Mod 10 = 2 | non-teen ending in 2 | 2nd, 22nd, 32nd | ❌ NONE |
| Mod 10 = 3 | non-teen ending in 3 | 3rd, 23rd, 33rd | ✓ district '03' → '3rd' |
| Mod 10 = 0/4-9 | everything else | 4th, 10th, 20th | ❌ NONE |

**Real-world likelihood:** every state with 11+ districts has a teen district (CA/TX/FL/NY etc.). Districts 1, 2, 4-9 are even more common. **The 11-13 teen exception branch is the most subtle ordinal rule** (e.g., "11th" vs "11st" — a classic off-by-one bug); a regression there would silently affect every House race in NY-11, CA-12, etc.

---

### 1.6 `committeeTypeLabel(t)` — ⚠️ SIGNIFICANT GAPS

12 mapped codes + fallback.

| Code | Label | Fixture coverage |
|---|---|---|
| P | Principal Campaign Committee | ⚠ implicit via committee_type='H' on PCC (not directly tested) |
| J | Joint Fundraising Committee | ❌ NONE |
| D | Leadership PAC | ❌ NONE |
| O | Super PAC | ❌ NONE |
| Q | PAC — Qualified | ❌ NONE |
| N | PAC — Non-Qualified | ❌ NONE |
| V | Hybrid PAC | ❌ NONE |
| H | House Candidate Committee | ✓ |
| S | Senate Candidate Committee | ❌ NONE |
| Y | Party Committee | ❌ NONE |
| I | Independent Expenditure (Non-Contribution) | ❌ NONE |
| U | Single Candidate IE | ❌ NONE |
| (unmapped) | `'Type ' + t` fallback | ❌ NONE |

**Real-world likelihood:** Q/N (PACs), O (Super PACs), D (Leadership PACs), Y (Party committees), J (JFAs) all appear in browse data daily. The /committees browse page surfaces every type. Currently every test exercises only the H (House Candidate Committee) label.

---

### 1.7 `filingFrequencyLabel(code)` + `filingFrequencyDotClass(code)` — ⚠️ GAPS

`filingFrequencyLabel` branches (6 mapped + fallback):

| Code | Label | DotClass | Fixture coverage |
|---|---|---|---|
| A | Administratively Terminated | dot-terminated | ❌ NONE |
| D | Debt | dot-active | ❌ NONE |
| M | Monthly Filer | dot-active | ❌ NONE |
| Q | Quarterly Filer | dot-active | ✓ |
| T | Terminated | dot-terminated | ❌ NONE |
| W | Waived | dot-active | ❌ NONE |
| (unmapped) | raw or '—' | dot-active | ❌ NONE |

**Real-world likelihood:** T (Terminated) is the second-most-common status after Q. CLAUDE.md notes A (administratively terminated, FEC-initiated) is significant — the committees browse page has an "Exclude terminated" toggle that filters both T and A. No fixture covers either. The dot-class is what drives the visual status indicator on committee rows everywhere — a regression on `dot-terminated` vs `dot-active` would be silent in tests.

---

### 1.8 `purposeBucket(desc)` — ⚠️ GAPS (8 of 9 branches untested)

Used by the Spent tab Purpose bars on candidate.html and committee.html. Keyword-pattern matching against `PURPOSE_MAP`:

| Bucket | Pattern keywords | Fixture coverage |
|---|---|---|
| TV & Radio | TELEVISION, RADIO, BROADCAST, MEDIA ADVERTISING, MEDIA PRODUCTION | ❌ NONE |
| Digital & Online | DIGITAL, ONLINE ADVERTISING, EMAIL, TEXT MESSAGING, INTERNET | ✓ ('DIGITAL ADVERTISING') |
| Direct Mail | DIRECT MAIL, POSTAGE, MAILING | ❌ NONE |
| Printing | PRINTING | ❌ NONE |
| Staff & Payroll | SALARY, PAYROLL, WAGES, PERSONNEL | ✓ ('PAYROLL') |
| Legal & Compliance | LEGAL, COMPLIANCE, ACCOUNTING | ❌ NONE |
| Events & Travel | CATERING, LODGING, AIR TRAVEL, TRAVEL, EVENT SUPPLIES, SITE RENTAL, VENUE, HOTEL | ❌ NONE |
| Consulting | CONSULTING, STRATEGY, ADVISOR, POLLING, RESEARCH | ✓ ('CONSULTING') |
| 'Other' fallback | no match | ❌ NONE |

**Real-world likelihood:** every category appears regularly in production data. The TV & Radio bucket alone is often the largest category for general-election spending. The Spent tab tests pass against fixtures that exercise 3 of 9 buckets — a keyword-matching regression on the other 6 would be silent until a user noticed misclassification.

---

### 1.9 `ENTITY_TYPE_LABELS` (Schedule A/B contributor types) — ⚠️ GAPS

Direct map lookup (7 codes):

| Code | Label | Fixture coverage |
|---|---|---|
| PAC | PAC | ✓ |
| PTY | Party committee | ✓ |
| COM | Committee | ❌ NONE |
| CCM | Candidate committee | ✓ |
| ORG | Organization | ❌ NONE |
| CAN | Candidate (self) | ❌ NONE |
| IND | Individual | ✓ |

Plus unmapped codes (VEN/EMP are in fixtures but not in the labels map — fallback returns 'Committee' via `ENTITY_TYPE_LABELS[d.entity_type] || 'Committee'`).

**Real-world likelihood:** ORG (Organization) is the entity type used for the "dark money" Schedule E flag pattern in project-brief.md Phase 4. CAN (Candidate-to-own-committee) appears in self-funding flows. Both are moderate-likelihood gaps.

---

### 1.10 `STATE_NAMES` — ✅ LOW PRIORITY

50 states + DC defined. Direct map lookup with raw fallback.

Fixture coverage: WA, CA, OR (3 of 51 entries).

**Real-world likelihood:** the lookup is a direct map — same code path for every entry. A missing entry would only surface if `STATE_NAMES` itself dropped a key, which is unlikely without an intentional edit. **Skip** — adding fixtures for the other 48 states would be coverage-for-coverage's-sake without surfacing real bugs.

The one exception worth noting: the map doesn't include 'US' (used for Presidential as `raceHref`'s state). Currently handled correctly in `formatRaceLabelLong` (Presidential branch returns 'US Presidential' before reaching `STATE_NAMES`), so no gap.

---

### 1.11 Simple formatters (`fmt`, `fmtDate`, `toTitleCase`, `formatCandidateName`, `is429`) — ✅ LOW PRIORITY

Small functions with limited branching:
- `fmt(n)` — number formatting; existing tests indirectly cover via every stat-card rendering
- `fmtDate(s)` — date string parsing; coverage via every coverage-end-date assertion
- `toTitleCase` / `formatCandidateName` — string case conversion; indirectly covered
- `is429(err)` — boolean detector; covered by error-state tests

No specific gaps worth surfacing in this audit. Add coverage if a regression appears.

---

## 2. Prioritized gaps

### Tier 1 — high likelihood × high impact (warrant follow-up tickets)

1. **`toOrdinal` teen exception** (11th/12th/13th) — silent regression risk on every House race in CA/TX/FL/NY etc. Tiny test surface (~3 inputs).
2. **`committeeTypeLabel` for non-H types** (Q/N/O/D/Y/J/etc.) — every browse page surfaces committee types that aren't H. A regression on any of these renders mis-labeled committees site-wide. ~10 lines of new fixture data + ~6 spec assertions.
3. **`filingFrequencyLabel` for T (Terminated) + A (Administratively Terminated)** — the most common non-Q states; the "Exclude terminated" toggle on /committees depends on rendering both correctly. The `dot-terminated` class is what visually flags ended committees across the site.
4. **`purposeBucket` for the 6 untested buckets** — TV & Radio especially (typically the largest spend category in a general election). A keyword-matching regression would silently misclassify millions of dollars in the Spent tab.

### Tier 2 — moderate likelihood × moderate impact

5. **`formatRaceName` / `formatRaceLabelLong` / `raceHref` for Presidential** (`office='P'`) — Presidential races happen every 4 years; race.html supports them; no fixture exercises the branch. CLAUDE.md flags `raceHref` Presidential as a previously-broken case the helper was built to fix.
6. **`formatRaceName` / `formatRaceLabelLong` / `raceHref` for at-large House** (`district='00'`) — 7 states. CLAUDE.md flags this as one of the original bugs the `raceHref` helper exists to handle.
7. **`ENTITY_TYPE_LABELS` for ORG + CAN** — appears in Schedule A on third-party / self-funding flows. Moderate likelihood.

### Tier 3 — low priority (accept the gap)

8. **`STATE_NAMES` for the other 48 states** — uniform code path; no benefit beyond coverage theater.
9. **Simple formatters** — `fmt` / `fmtDate` / `toTitleCase` / `is429` are covered indirectly by every rendering test that exercises them.

---

## 3. Recommended next steps

### Option A — single consolidated follow-up ticket

One ticket: **"Mock-fixture Tier-1 + Tier-2 gap closure"**. Add fixture rows + page.evaluate-style unit tests (following the `tests/party-helpers.spec.js` / `tests/candidate-card.spec.js` pattern from T-party-helpers-dual-field-rewrite + T-card-builder-consolidation) for the 7 Tier-1 + Tier-2 gaps. Estimated 90-120 min total. Single commit covering the whole sweep.

### Option B — split by helper family

One ticket per helper or helper family:
- **Card-related helpers** (formatRaceName / formatRaceLabelLong / raceHref / toOrdinal) — 4 helpers, all related to race/district rendering. ~45-60 min.
- **Committee-related helpers** (committeeTypeLabel / filingFrequencyLabel + DotClass) — 2 helpers, browse page surfaces. ~30-40 min.
- **Spent-tab helpers** (purposeBucket + ENTITY_TYPE_LABELS) — 2 helpers, Spent tab surfaces. ~30-40 min.

### Option C — opportunistic

Close gaps only when an adjacent code change exercises the helper. Cheapest in total work but accepts silent regression risk until the next opportunity arises.

### Recommendation

**Option A** for these specific gaps — they're all of a kind (helpers with decision trees against FEC data), they're all small to test, and consolidating the work into one structured pass surfaces any patterns that span multiple helpers (e.g. the at-large House district = '00' case touches 3 helpers; better to close them together).

The 90-120 min investment buys:
- Lock against future "helper change silently breaks production" cases (the pattern that motivated this audit)
- Test scaffolding (page.evaluate unit tests against helpers in design-system.html) becomes the standard for utility-function coverage going forward — a fourth precedent after party-helpers + candidate-card + tooltip
- Per-helper unit-test files (`tests/race-name.spec.js` / `tests/committee-helpers.spec.js` / `tests/spend-purpose.spec.js`) become the durable spec for what each helper guarantees

---

## 4. Out of scope for this audit

- **Code changes to helpers themselves.** This audit assumes the helpers are correct; the work is verifying coverage, not refactoring.
- **Adding fixtures without exercising them.** Fixture rows without spec assertions are dead weight (per the scope adjustment in T-party-helpers-dual-field-rewrite). Any fixture added in follow-up should pair with an assertion.
- **CSS / visual regression coverage.** Out of scope — this is a behavioral / data-transformation audit.
- **Live FEC API coverage gaps.** Out of scope — this audit is about mock fixtures vs production data shapes. Live-API gaps are a separate concern (and are partly handled by the existing Track 2 smoke suite).

---

## 5. Lineage

This audit is the deliverable for follow-up "I" in the post-T-party-tag-completeness related-refactor scan (2026-06-01). It does not itself fix gaps; it surfaces the picture so gap closure can be scoped and prioritized.
