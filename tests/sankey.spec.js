// Unit tests for sankey.js buildSankeyModel — the pure data adapter (Sankey Step 1).
// The adapter has no DOM/echarts/token dependency, so it's injected standalone via
// addScriptTag and exercised in page.evaluate. renderSankey (ECharts) is verified
// visually in Step 2, not here.
//
// Fixtures are real /totals/ records (leaf values verified live 2026-06-08, see
// strategy/sankey-data-model.md verify-set). The conservation assertions reconcile
// receipt + disbursement node-sums to the reported totals to the penny.
import { test, expect } from '@playwright/test';

// Row 3 — candidate self-funder (Form 3). Exercises self-funding grouping, the
// contributions no-double-count rule, external-only Loans, and Form-3 loan_repayments.
const SAP = {
  receipts: 1417733.96, disbursements: 1363358.22, last_cash_on_hand_end_period: 54375.74,
  last_debts_owed_by_committee: 635000,
  individual_itemized_contributions: 362788.15, individual_unitemized_contributions: 0,
  other_political_committee_contributions: 7750, political_party_committee_contributions: 2500,
  candidate_contribution: 83451.34, loans_made_by_candidate: 600000,
  transfers_from_other_authorized_committee: 311133.95, all_other_loans: 50050,
  offsets_to_operating_expenditures: 60, other_receipts: 0.52,
  operating_expenditures: 1249258.40, loan_repayments: 50050,
  contribution_refunds: 12549.82, other_disbursements: 51500,
  transfers_to_other_authorized_committee: 0,
};

// Row 4 — party committee (Form 3X), fed-only (fed_* ≡ total → NOT gated). Exercises
// the Form-3X field names + committee-only nodes (IE / coordinated / contributions-out).
const DCCC = {
  receipts: 339935852.88, fed_receipts: 339935852.88,
  disbursements: 331933274.36, fed_disbursements: 331933274.36,
  last_cash_on_hand_end_period: 24232592.09, last_debts_owed_by_committee: 20000000,
  individual_itemized_contributions: 174592917.63, individual_unitemized_contributions: 0,
  other_political_committee_contributions: 60327399.69, political_party_committee_contributions: 0,
  transfers_from_affiliated_party: 28229645.27, all_loans_received: 20000000,
  offsets_to_operating_expenditures: 1438483.38, fed_candidate_contribution_refunds: 1554.65,
  other_fed_receipts: 55345852.26,
  operating_expenditures: 192363224.57, independent_expenditures: 74258192.57,
  coordinated_expenditures_by_party_committee: 5357092.52, fed_candidate_committee_contributions: 604424.67,
  transfers_to_affiliated_committee: 23919995.61, loan_repayments_made: 18000000,
  contribution_refunds: 1056971.02, other_disbursements: 16373373.40,
};

// Row 7 — dual-account committee (Dem Party of Wisconsin Fed, C00019331 / 2024, Form 3X).
// Gate 1 was LIFTED in Step 5 (2026-06-10): this now builds a conserving model. Full live
// record (verified 2026-06-10) — the non-fed transfers fold into "Transfers in" and FEA is
// itemized, so receipts/disbursements reconcile to $0.00 via the remainder catch-alls.
const WISCONSIN = {
  receipts: 63427392.68, fed_receipts: 51325830.95,
  disbursements: 61697041.92, fed_disbursements: 46403630.95,
  last_cash_on_hand_end_period: 2134722.70,
  individual_itemized_contributions: 18252118.75, individual_unitemized_contributions: 7673600.31,
  other_political_committee_contributions: 1236875.75, political_party_committee_contributions: 21412.31,
  transfers_from_affiliated_party: 23541495.63, other_fed_receipts: 115361.71,
  transfers_from_nonfed_account: 12088940.37, transfers_from_nonfed_levin: 12621.36,
  offsets_to_operating_expenditures: 484966.49,
  operating_expenditures: 29411929.43, fed_election_activity: 27437582.17,
  coordinated_expenditures_by_party_committee: 9760, transfers_to_affiliated_committee: 287956.86,
  contribution_refunds: 151788.80, other_disbursements: 4398024.66,
};

// Row 9 — THE residual case (Texas Democratic Party, C00099267 / 2024, Form 3X dual-account).
// Named spent leaves miss $17,063.22 in NO exposed field → proves the remainder catch-all is
// mandatory: a named-leaf-only model would under-sum the disbursement side by that amount.
const TEXAS = {
  receipts: 14928744.44, fed_receipts: 13513132.90,
  disbursements: 14944835.38, fed_disbursements: 12842194.58,
  last_cash_on_hand_end_period: 99322.88, last_debts_owed_by_committee: 109456.91,
  individual_itemized_contributions: 1021498.20, individual_unitemized_contributions: 918249.86,
  other_political_committee_contributions: 529275, transfers_from_affiliated_party: 9589098.55,
  transfers_from_nonfed_account: 1201975.96, transfers_from_nonfed_levin: 213635.58,
  offsets_to_operating_expenditures: 30949.46, other_fed_receipts: 1406998.61,
  operating_expenditures: 3178686.33, fed_election_activity: 7965909.06, independent_expenditures: 5600,
  transfers_to_affiliated_committee: 3496083.14, contribution_refunds: 13319.64, other_disbursements: 268173.99,
};

// Presidential — modern privately-funded (Harris 2024, P00009423, candidate election_full / Form 3P).
// Conserves under the current adapter (the transfers_from_affiliated_committee coalesce closed the
// $534M JFC-transfer; no exempt-spend fields). Tested with isPresidential:false so the adapter is
// exercised even though the production presidential gate is still on (Step 5 Gate-2 deferred flip).
const HARRIS = {
  receipts: 1175903792.49, disbursements: 1176074620.47,
  last_cash_on_hand_end_period: 1762056.63, last_debts_owed_by_committee: 934179.58,
  individual_itemized_contributions: 401731729, individual_unitemized_contributions: 211825627,
  other_political_committee_contributions: 152322.23, political_party_committee_contributions: 2090,
  transfers_from_affiliated_committee: 534274769.74, offsets_to_operating_expenditures: 26364908.86,
  other_receipts: 1552344.80, operating_expenditures: 1155198573.69,
  transfers_to_other_authorized_committee: 67904.42, contribution_refunds: 9343705.57,
  other_disbursements: 11464436.79,
};

// Presidential — publicly-financed (McCain 2008, P80002801, Form 3P). The Gate-2 spend-side blocker:
// fundraising_disbursements + exempt_legal_accounting_disbursement ($6.82M + $1.16M) — without these
// nodes the spend side under-sums by ~$8M. WITH them it conserves to the penny. NOTE: McCain's $21M
// loan is in `loans_received` (a Form-3P name the adapter's Loans node does NOT read), so it lands in
// the Other-receipts remainder — a documented Gate-2 production-flip prerequisite (raised-side Form-3P
// loan-field resolution, incl. the loans_received / other_loans_received alias de-dup vs all_loans_received).
const MCCAIN = {
  receipts: 401537140.35, disbursements: 375159299.94,
  last_cash_on_hand_end_period: 26377840.41, last_debts_owed_by_committee: 1603973.83,
  federal_funds: 84103800, fundraising_disbursements: 6816640.80, exempt_legal_accounting_disbursement: 1158123.71,
  individual_itemized_contributions: 149877443, individual_unitemized_contributions: 51056537,
  other_political_committee_contributions: 1569616.41, political_party_committee_contributions: 16197.25,
  transfers_from_affiliated_committee: 47871997.94, offsets_to_operating_expenditures: 21706861.29,
  other_receipts: 18679221.82, loans_received: 20998577.20,
  operating_expenditures: 285683215.97, transfers_to_other_authorized_committee: 15912254.28,
  loan_repayments_made: 20998577.20, contribution_refunds: 7320332.79, other_disbursements: 37270155.19,
};

async function loadAdapter(page) {
  await page.goto('/design-system.html');
  await page.addScriptTag({ path: 'sankey.js' });
}
const sumVals = (arr) => arr.reduce((a, x) => a + x.value, 0);

test.describe('sankey.js — buildSankeyModel adapter', () => {
  test('candidate self-funder: conserves both sides + source-based grouping (no contributions double-count)', async ({ page }) => {
    await loadAdapter(page);
    const m = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'candidate', hubName: 'Michael Sapraicone' }), SAP);
    expect(m.gated).toBe(false);
    // Conservation to the penny.
    expect(await page.evaluate((s) => s.reduce((a, x) => a + x.value, 0), m.sources)).toBeCloseTo(1417733.96, 2);
    expect(await page.evaluate((u) => u.reduce((a, x) => a + x.value, 0), m.uses)).toBeCloseTo(1363358.22, 2);
    // Self-funding = own gift + own loan; Loans is external-only.
    expect(m.sources.find(s => s.name === 'Candidate self-funding').value).toBeCloseTo(683451.34, 2);
    expect(m.sources.find(s => s.name === 'Loans').value).toBeCloseTo(50050, 2);
    // Contributions group sums the three leaves ONLY (excludes the $83,451 gift).
    const contribSum = m.sources.filter(s => s.group === 'contributions').reduce((a, s) => a + s.value, 0);
    expect(contribSum).toBeCloseTo(373038.15, 2);
    // Loan repayments reads the Form-3 field name (loan_repayments).
    expect(m.uses.find(u => u.name === 'Loan repayments').value).toBeCloseTo(50050, 2);
    // cohStart is DERIVED (end + disb − receipts) — here 0.
    expect(m.cohStart).toBeCloseTo(0, 2);
    expect(m.cohEnd).toBeCloseTo(54375.74, 2);
  });

  test('party committee (Form 3X, fed-only): conserves + resolves the 3X field names; not gated', async ({ page }) => {
    await loadAdapter(page);
    const m = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'committee', hubName: 'DCCC' }), DCCC);
    expect(m.gated).toBe(false);
    expect(sumVals(m.sources)).toBeCloseTo(339935852.88, 1);
    expect(sumVals(m.uses)).toBeCloseTo(331933274.36, 1);
    // Form-3X receipt names resolved.
    expect(m.sources.find(s => s.name === 'Transfers in').value).toBeCloseTo(28229645.27, 1);
    expect(m.sources.find(s => s.name === 'Loans').value).toBeCloseTo(20000000, 1);
    expect(m.sources.find(s => s.name === 'Other receipts').value).toBeCloseTo(55345852.26, 1);
    // Committee-only disbursement nodes present.
    expect(m.uses.find(u => u.name === 'Independent expenditures').value).toBeCloseTo(74258192.57, 1);
    expect(m.uses.find(u => u.name === 'Coordinated party expenditures').value).toBeCloseTo(5357092.52, 1);
    expect(m.uses.find(u => u.name === 'Contributions to candidates').value).toBeCloseTo(604424.67, 1);
    // No "Candidate self-funding" node on a committee.
    expect(m.sources.find(s => s.name === 'Candidate self-funding')).toBeUndefined();
    // Offsets folds in fed_candidate_contribution_refunds (2026-06-10): the node = the three
    // offset variants + the refund (1438483.38 + 1554.65), and there is NO separate
    // "Candidate-contribution refunds" node — so "Offsets" denotes the same field-set as the
    // donut "Offsets" wedge across all three viz.
    expect(m.sources.find(s => s.name === 'Offsets').value).toBeCloseTo(1440038.03, 1);
    expect(m.sources.find(s => s.name === 'Candidate-contribution refunds')).toBeUndefined();
    // cohStart derived equals the (here) reported beginning balance.
    expect(m.cohStart).toBeCloseTo(16230013.57, 1);
    expect(m.debt).toBeCloseTo(20000000, 1);
  });

  test('a Form-3 PCC rendered via entity:committee still resolves Form-3 fields + self-funding (form-agnostic coalesce)', async ({ page }) => {
    await loadAdapter(page);
    // committee.html serves candidate PCCs too (e.g. /committee/C00806174). The adapter
    // must coalesce the form-name pairs + push self-funding by presence, NOT hard-switch
    // to Form-3X names on entity:committee — else a PCC under-sums (the bug this guards).
    const m = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'committee', hubName: 'PCC' }), SAP);
    expect(m.gated).toBe(false);
    expect(sumVals(m.sources)).toBeCloseTo(1417733.96, 2);   // conserves under entity:committee
    expect(sumVals(m.uses)).toBeCloseTo(1363358.22, 2);
    expect(m.sources.find(s => s.name === 'Transfers in').value).toBeCloseTo(311133.95, 2);      // Form-3 name read
    expect(m.sources.find(s => s.name === 'Candidate self-funding').value).toBeCloseTo(683451.34, 2); // shown by presence
    expect(m.uses.find(u => u.name === 'Loan repayments').value).toBeCloseTo(50050, 2);          // Form-3 loan_repayments
  });

  test('Transfers in coalesces transfers_from_affiliated_committee (Form-3P JFC transfers)', async ({ page }) => {
    await loadAdapter(page);
    // Synthetic NON-gated committee record whose only transfer-in is the Form-3P field
    // (mutually exclusive with the other two — verified 2026-06-09). The coalesce must
    // include it or a presidential record under-sums (it's gated in the Sankey, but the
    // adapter must be correct for the Step 5 un-gating + the donut fallback shares this logic).
    const rec = { receipts: 1000000, disbursements: 800000, last_cash_on_hand_end_period: 200000,
      individual_itemized_contributions: 400000, transfers_from_affiliated_committee: 600000,
      operating_expenditures: 800000 };
    const m = await page.evaluate((r) => window.buildSankeyModel(r, { entity: 'committee' }), rec);
    expect(m.gated).toBe(false);
    expect(m.sources.find(s => s.name === 'Transfers in').value).toBeCloseTo(600000, 2);
    expect(sumVals(m.sources)).toBeCloseTo(1000000, 2);
  });

  // ── Step 5 Gate-1 un-gate (2026-06-10): dual-account committees now build a conserving model. ──
  test('Gate 1 lifted — dual-account committee (WI) conserves; FEA itemized + non-fed commingled into Transfers in', async ({ page }) => {
    await loadAdapter(page);
    const m = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'committee', hubName: 'Dem Party of WI' }), WISCONSIN);
    expect(m.gated).toBe(false);
    // Conserves to the penny on BOTH sides (the remainder catch-alls absorb anything unexposed).
    expect(sumVals(m.sources)).toBeCloseTo(63427392.68, 1);
    expect(sumVals(m.uses)).toBeCloseTo(61697041.92, 1);
    // Federal Election Activity itemized (WI's single largest use, 44.5%) — was buried in Other. FEA is a
    // commingled parent (its own non-fed child stays inside it); itemizing it is NOT a fed/non-fed split.
    expect(m.uses.find(u => u.name === 'Federal election activity').value).toBeCloseTo(27437582.17, 1);
    // Non-fed-account transfers ($12.1M) are COMMINGLED into Transfers in per representation (a) — soft
    // money stays unsplit (the dedicated hard/soft viz is separate, scoped work), mirroring how the FEA
    // parent keeps its non-fed child inside it. So Transfers in = affiliated $23.5M + non-fed $12.1M.
    expect(m.sources.find(s => s.name === 'Transfers in').value).toBeCloseTo(35643057.36, 1);
    expect(m.sources.find(s => s.name === 'Transfers from non-federal account')).toBeUndefined();
    // Other receipts is the REMAINDER; here it equals named other_fed_receipts (no raised-side residual).
    expect(m.sources.find(s => s.name === 'Other receipts').value).toBeCloseTo(115361.71, 1);
  });

  test('Gate 1 lifted — TX residual case: the Other-disbursements remainder absorbs the $17,063.22 unexposed spend', async ({ page }) => {
    await loadAdapter(page);
    const m = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'committee', hubName: 'Texas Dem Party' }), TEXAS);
    expect(m.gated).toBe(false);
    // Conserves on both sides DESPITE $17,063.22 of spend sitting in no exposed field.
    expect(sumVals(m.sources)).toBeCloseTo(14928744.44, 1);
    expect(sumVals(m.uses)).toBeCloseTo(14944835.38, 1);
    // Other disbursements = named other_disbursements ($268,173.99) + the $17,063.22 residual.
    // A named-leaf-only model would read $268,173.99 here and under-sum the disbursement total.
    expect(m.uses.find(u => u.name === 'Other disbursements').value).toBeCloseTo(285237.21, 1);
  });

  // ── Step 5 Gate-2 ADAPTER (presidential): the production gate is still ON (deferred flip), so
  // these call the adapter with isPresidential:false to verify the model is correct + ready. ──
  test('Gate 2 adapter — modern presidential (Harris) conserves on both sides; no exempt-spend nodes', async ({ page }) => {
    await loadAdapter(page);
    const m = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'candidate', hubName: 'Harris', isPresidential: false }), HARRIS);
    expect(m.gated).toBe(false);
    expect(sumVals(m.sources)).toBeCloseTo(1175903792.49, 0);
    expect(sumVals(m.uses)).toBeCloseTo(1176074620.47, 0);
    // The $534M JFC transfer resolves via the affiliated-committee coalesce.
    expect(m.sources.find(s => s.name === 'Transfers in').value).toBeCloseTo(534274769.74, 1);
    // Modern campaign → exempt-spend leaves are 0 → no nodes.
    expect(m.uses.find(u => u.name === 'Fundraising')).toBeUndefined();
    expect(m.uses.find(u => u.name === 'Exempt legal & accounting')).toBeUndefined();
  });

  test('Gate 2 adapter — publicly-financed presidential (McCain) conserves; exempt-spend nodes present', async ({ page }) => {
    await loadAdapter(page);
    const m = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'candidate', hubName: 'McCain', isPresidential: false }), MCCAIN);
    expect(m.gated).toBe(false);
    // Spend side conserves to the penny ONLY because the two exempt nodes are modeled (else −$8M).
    expect(sumVals(m.uses)).toBeCloseTo(375159299.94, 0);
    expect(m.uses.find(u => u.name === 'Fundraising').value).toBeCloseTo(6816640.80, 1);
    expect(m.uses.find(u => u.name === 'Exempt legal & accounting').value).toBeCloseTo(1158123.71, 1);
    // federal_funds (public financing) renders as a receipt source.
    expect(m.sources.find(s => s.name === 'Federal funds').value).toBeCloseTo(84103800, 1);
    // Raised side still conserves via the remainder — McCain's $21M loan (loans_received, a Form-3P
    // name the Loans node doesn't read yet) lands in Other receipts. Documented Gate-2-flip prereq.
    expect(sumVals(m.sources)).toBeCloseTo(401537140.35, 0);
    expect(m.sources.find(s => s.name === 'Loans')).toBeUndefined();
  });

  test('presidential is STILL gated in production (Gate 2 detector unchanged); dual-account is NOT', async ({ page }) => {
    await loadAdapter(page);
    // Production gate: isPresidential still returns 'presidential' (donut fallback).
    const pres = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'candidate', isPresidential: true }), HARRIS);
    expect(pres.gated).toBe(true);
    expect(pres.reason).toBe('presidential');
    // Gate 1 lifted: a committee with receipts !== fed_receipts is no longer gated.
    const dual = await page.evaluate((rec) => window.sankeyGateReason(rec, { entity: 'committee' }), WISCONSIN);
    expect(dual).toBeNull();
    // Candidate (no fed_receipts) never gated.
    const cand = await page.evaluate((rec) => window.sankeyGateReason(rec, { entity: 'candidate' }), SAP);
    expect(cand).toBeNull();
  });

  test('sankeyHeight is content-adaptive (clamped 320–560; gated compact 120)', async ({ page }) => {
    await loadAdapter(page);
    // 1 source + 1 use → well under the min → clamps to 320 (sibling-timeline rhythm).
    const tiny = await page.evaluate(() => window.sankeyHeight(window.buildSankeyModel(
      { receipts: 100, disbursements: 100, last_cash_on_hand_end_period: 0,
        individual_itemized_contributions: 100, operating_expenditures: 100 }, { entity: 'candidate' })));
    expect(tiny).toBe(320);
    // Dense committee → taller, capped at 560.
    const dccc = await page.evaluate((rec) => window.sankeyHeight(window.buildSankeyModel(rec, { entity: 'committee' })), DCCC);
    expect(dccc).toBeGreaterThan(320);
    expect(dccc).toBeLessThanOrEqual(560);
    // Gated (presidential — the surviving gate) → compact message box.
    const gated = await page.evaluate((rec) => window.sankeyHeight(window.buildSankeyModel(rec, { entity: 'candidate', isPresidential: true })), SAP);
    expect(gated).toBe(120);
  });
});
