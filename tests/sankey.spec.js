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

// Row 7 — dual-account committee (Form 3X with non-federal account). GATED.
const WISCONSIN = {
  receipts: 63427392.68, fed_receipts: 51325830.95,
  disbursements: 61697041.92, fed_disbursements: 46403630.95,
  last_cash_on_hand_end_period: 2134722.70,
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

  test('Gate 1 — dual-account committee returns {gated, reason:"non-federal"} (no model built)', async ({ page }) => {
    await loadAdapter(page);
    const m = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'committee', hubName: 'Dem Party of WI' }), WISCONSIN);
    expect(m.gated).toBe(true);
    expect(m.reason).toBe('non-federal');
    expect(m.sources).toBeUndefined();
  });

  test('Gate 2 — presidential returns {gated, reason:"presidential"}', async ({ page }) => {
    await loadAdapter(page);
    const m = await page.evaluate((rec) => window.buildSankeyModel(rec, { entity: 'candidate', isPresidential: true }), SAP);
    expect(m.gated).toBe(true);
    expect(m.reason).toBe('presidential');
  });

  test('candidate without a fed_receipts field is NOT gated (detector is committee-only)', async ({ page }) => {
    await loadAdapter(page);
    // SAP has no fed_receipts — the non-federal detector must not misfire on candidates.
    const reason = await page.evaluate((rec) => window.sankeyGateReason(rec, { entity: 'candidate' }), SAP);
    expect(reason).toBeNull();
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
    // Gated → compact message box.
    const gated = await page.evaluate((rec) => window.sankeyHeight(window.buildSankeyModel(rec, { entity: 'committee' })), WISCONSIN);
    expect(gated).toBe(120);
  });
});
