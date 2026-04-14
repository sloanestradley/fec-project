/**
 * FEC API mock for Playwright structural tests.
 *
 * Intercepts all requests to api.open.fec.gov and returns minimal but
 * shape-correct mock data so pages render without real network calls.
 *
 * Call mockFecApi(page) before page.goto() to activate the intercept.
 * Override individual endpoints by calling page.route() after mockFecApi()
 * (Playwright uses the most recently registered matching route).
 */

// ── Fixture data ─────────────────────────────────────────────────────────────

const CANDIDATE = {
  results: [{
    candidate_id: 'H2WA03217',
    name: 'GLUESENKAMP PEREZ, MARIE',
    party: 'DEM',
    party_full: 'DEMOCRATIC PARTY',
    office: 'H',
    office_full: 'House',
    state: 'WA',
    district: '03',
    election_years: [2022, 2024],
    incumbent_challenge: 'I',
    incumbent_challenge_full: 'Incumbent',
  }],
  pagination: { count: 1, pages: 1, per_page: 20, page: 1 },
};

const TOTALS = {
  results: [{
    receipts: 3500000,
    disbursements: 3100000,
    last_cash_on_hand_end_period: 450000,
    coverage_end_date: '2024-12-31T00:00:00',
    cycle: 2024,
  }],
  pagination: { count: 1 },
};

// Committees for a candidate (authorized committee list)
const CANDIDATE_COMMITTEES = {
  results: [{
    committee_id: 'C00775668',
    name: 'MARIE FOR CONGRESS',
    designation: 'P',
    designation_full: 'Principal campaign committee',
    committee_type: 'H',
    committee_type_full: 'House',
    filing_frequency: 'Q',
    leadership_pac: null,
    sponsor_candidate_ids: null,
  }],
  pagination: { count: 1 },
};

// Leadership PACs (sponsor endpoint) — empty for this candidate
const LEADERSHIP_PACS = {
  results: [],
  pagination: { count: 0 },
};

// Single committee metadata
const COMMITTEE = {
  results: [{
    committee_id: 'C00775668',
    name: 'MARIE FOR CONGRESS',
    committee_type: 'H',
    committee_type_full: 'House',
    designation: 'P',
    designation_full: 'Principal campaign committee',
    filing_frequency: 'Q',
    state: 'WA',
    organization_type_full: null,
    cycles: [2022, 2024, 2026],
  }],
  pagination: { count: 1 },
};

// Committee financial totals — 2 records only; 2026 intentionally absent to exercise "no record → show —" path
// Breakdown fields added for Raised and Spent tab donuts.
const COMMITTEE_TOTALS = {
  results: [
    {
      cycle: 2024,
      receipts: 3700000, disbursements: 3100000,
      last_cash_on_hand_end_period: 450000, coverage_end_date: '2024-12-31T00:00:00',
      // Raised breakdown
      individual_itemized_contributions: 2000000,
      individual_unitemized_contributions: 500000,
      other_political_committee_contributions: 750000,
      political_party_committee_contributions: 100000,
      transfers_from_other_authorized_committee: 100000,
      candidate_contribution: 0,
      other_receipts: 50000,
      loans_made_by_candidate: 200000,
      // Spent breakdown
      operating_expenditures: 2500000,
      transfers_to_affiliated_committee: 200000,
      loan_repayments_made: 150000,
      contribution_refunds: 50000,
      other_disbursements: 200000,
    },
    {
      cycle: 2022,
      receipts: 2100000, disbursements: 1950000,
      last_cash_on_hand_end_period: 170000, coverage_end_date: '2022-12-31T00:00:00',
      // Raised breakdown
      individual_itemized_contributions: 1200000,
      individual_unitemized_contributions: 300000,
      other_political_committee_contributions: 500000,
      political_party_committee_contributions: 75000,
      transfers_from_other_authorized_committee: 25000,
      candidate_contribution: 0,
      other_receipts: 0,
      // Spent breakdown
      operating_expenditures: 1600000,
      transfers_to_affiliated_committee: 100000,
      loan_repayments_made: 100000,
      contribution_refunds: 50000,
      other_disbursements: 100000,
    },
  ],
  pagination: { count: 2 },
};

// Per-period filing reports (used for chart data)
// Note: live API returns total_receipts_ytd as a string (FEC API quirk);
// total_disbursements_ytd is a float. parseFloat() in candidate.html handles both.
const REPORTS = {
  results: [
    {
      coverage_start_date: '2024-01-01T00:00:00',
      coverage_end_date:   '2024-03-31T00:00:00',
      total_receipts_ytd:       '1200000.00',
      total_disbursements_ytd:   900000,
      cash_on_hand_end_period:   450000,
      report_form: 'Form 3',
      report_type: 'Q1',
    },
    {
      coverage_start_date: '2024-04-01T00:00:00',
      coverage_end_date:   '2024-06-30T00:00:00',
      total_receipts_ytd:       '2500000.00',
      total_disbursements_ytd:  2000000,
      cash_on_hand_end_period:   600000,
      report_form: 'Form 3',
      report_type: 'Q2',
    },
    {
      coverage_start_date: '2024-07-01T00:00:00',
      coverage_end_date:   '2024-09-30T00:00:00',
      total_receipts_ytd:       '3200000.00',
      total_disbursements_ytd:  2700000,
      cash_on_hand_end_period:   550000,
      report_form: 'Form 3',
      report_type: 'Q3',
    },
  ],
  pagination: { count: 3 },
};

// Filing deadlines
const REPORTING_DATES = {
  results: [{
    report_type:      'Q1',
    report_type_full: 'APRIL QUARTERLY',
    due_date:         '2024-04-15',
  }],
  pagination: { count: 1 },
};

// Election dates
const ELECTION_DATES = {
  results: [{
    election_date:      '2024-08-06',
    election_type_full: 'Primary',
    office_sought:      'H',
    election_state:     'WA',
  }],
  pagination: { count: 1 },
};

// Candidate search results
const SEARCH_RESULTS = {
  results: [{
    candidate_id: 'H2WA03217',
    name:         'GLUESENKAMP PEREZ, MARIE',
    party:        'DEM',
    office:       'H',
    state:        'WA',
    district:     '03',
  }],
  pagination: { count: 1, pages: 1, per_page: 20, page: 1 },
};

// Candidates with totals (/candidates/totals/ endpoint — used by races.html)
const CANDIDATES_TOTALS = {
  results: [
    { candidate_id: 'H2WA03217', name: 'GLUESENKAMP PEREZ, MARIE', office: 'H', state: 'WA', district: '03', party: 'DEM', party_full: 'DEMOCRATIC PARTY', receipts: 3500000, disbursements: 3100000, election_year: 2026 },
    { candidate_id: 'H2WA03218', name: 'KENT, JOE', office: 'H', state: 'WA', district: '03', party: 'REP', party_full: 'REPUBLICAN PARTY', receipts: 2200000, disbursements: 1800000, election_year: 2026 },
    { candidate_id: 'S6WA00000', name: 'MURRAY, PATTY', office: 'S', state: 'WA', district: '00', party: 'DEM', party_full: 'DEMOCRATIC PARTY', receipts: 5000000, disbursements: 4200000, election_year: 2026 },
  ],
  pagination: { count: 3, pages: 1, per_page: 100, page: 1 },
};

// Available election cycles (/elections/search/ endpoint)
const ELECTIONS_SEARCH = {
  results: [
    { cycle: 2024, district: '03', office: 'H', state: 'WA' },
    { cycle: 2022, district: '03', office: 'H', state: 'WA' },
  ],
  pagination: { count: 2 },
};

// Race candidates (/elections/ endpoint)
const ELECTIONS = {
  results: [{
    candidate_id:              'H2WA03217',
    candidate_name:            'GLUESENKAMP PEREZ, MARIE',
    party_full:                'DEMOCRATIC PARTY',
    total_receipts:            3500000,
    total_disbursements:       3100000,
    cash_on_hand_end_period:    450000,
    incumbent_challenge:       'I',
    incumbent_challenge_full:  'Incumbent',
  }],
  pagination: { count: 1 },
};

// Browse committees
const COMMITTEES_LIST = {
  results: [{
    committee_id:   'C00775668',
    name:           'MARIE FOR CONGRESS',
    committee_type: 'H',
    committee_type_full: 'House',
    state:          'WA',
    filing_frequency: 'Q',
    treasurer_name: 'SMITH, JOHN',
  }],
  pagination: { count: 1 },
};

// Committee search results (/committees/?q= search mode and typeahead)
const COMMITTEE_SEARCH_RESULTS = {
  results: [{
    committee_id:   'C00775668',
    name:           'MARIE FOR CONGRESS',
    committee_type: 'H',
    committee_type_full: 'House',
    state:          'WA',
    filing_frequency: 'Q',
    treasurer_name: 'SMITH, JOHN',
  }],
  pagination: { count: 1, pages: 1, per_page: 5, page: 1 },
};

// Disbursements — Schedule B general fetch (opex records for purpose bars + vendor table)
const DISBURSEMENTS = {
  results: [
    { disbursement_description: 'DIGITAL ADVERTISING', disbursement_amount: 150000,
      recipient_name: 'DIGITAL VENDOR LLC', entity_type: 'VEN',
      disbursement_purpose_category: 'OTHER', recipient_committee_id: null },
    { disbursement_description: 'PAYROLL', disbursement_amount: 80000,
      recipient_name: 'CAMPAIGN STAFF', entity_type: 'EMP',
      disbursement_purpose_category: 'OTHER', recipient_committee_id: null },
    { disbursement_description: 'CONSULTING', disbursement_amount: 35000,
      recipient_name: 'CAMPAIGN STRATEGY GROUP', entity_type: 'VEN',
      disbursement_purpose_category: 'OTHER', recipient_committee_id: null },
  ],
  pagination: { count: 3, pages: 1 },
};

// Schedule B contributions — returned when entity_type=CCM is passed (dedicated contributions fetch)
const SCHEDULE_B_CONTRIBUTIONS = {
  results: [
    { disbursement_description: 'CONTRIBUTION', disbursement_amount: 5000,
      recipient_name: 'FRIEND FOR CONGRESS', recipient_committee_id: 'C00123456',
      candidate_name: 'FRIEND, JOHN', candidate_office: 'H', candidate_office_state: 'WA',
      entity_type: 'CCM', disbursement_purpose_category: 'CONTRIBUTIONS' },
  ],
  pagination: { count: 1, pages: 1 },
};

// Schedule A — by_state aggregation (/schedules/schedule_a/by_state/)
// Returns state-level totals, NOT individual contributions.
// Fields: state, state_full, total, count, cycle
const SCHEDULE_A_BY_STATE = {
  results: [
    { committee_id: 'C00775668', cycle: 2024, state: 'WA', state_full: 'Washington', total: 500000, count: 1200 },
    { committee_id: 'C00775668', cycle: 2024, state: 'CA', state_full: 'California',  total: 200000, count:  480 },
    { committee_id: 'C00775668', cycle: 2024, state: 'OR', state_full: 'Oregon',      total:  85000, count:  210 },
  ],
  pagination: { count: 3 },
};

// Schedule A — individual contributors (is_individual=true)
// Fields: contributor_name, contribution_receipt_amount, contributor_city, contributor_state
const SCHEDULE_A_INDIVIDUALS = {
  results: [
    { contributor_name: 'SMITH, JOHN',  contribution_receipt_amount: 2900, contributor_state: 'WA', contributor_city: 'OLYMPIA', contributor_zip: '98501', contributor_employer: 'SELF',  contributor_occupation: 'ENGINEER', entity_type: 'IND' },
    { contributor_name: 'DOE, JANE',    contribution_receipt_amount: 1500, contributor_state: 'CA', contributor_city: 'OAKLAND',  contributor_zip: '94601', contributor_employer: 'ACME',  contributor_occupation: 'TEACHER',  entity_type: 'IND' },
  ],
  pagination: { count: 2 },
};

// Schedule A — committee contributors (is_individual=false)
// Fields: contributor_name, contribution_receipt_amount, entity_type, contributor_committee_id, memo_code
// Includes one memo_code='X' conduit row so both the committee contributors dedup (which
// excludes memos) and the conduit sources dedup (which only includes memos) have coverage.
const SCHEDULE_A_COMMITTEES = {
  results: [
    { contributor_name: 'SEIU POLITICAL EDUCATION ACTION FUND', contribution_receipt_amount: 10000, contributor_committee_id: 'C00004036', entity_type: 'PAC' },
    { contributor_name: 'WASHINGTON STATE DEMOCRATIC CENTRAL COMMITTEE', contribution_receipt_amount: 5000, contributor_committee_id: 'C00106500', entity_type: 'PTY' },
    { contributor_name: 'ACTBLUE', contribution_receipt_amount: 50, contributor_committee_id: 'C00401224', entity_type: 'PAC', memo_code: 'X' },
  ],
  pagination: { count: 3 },
};

// Schedule A — legacy alias (used when no is_individual param; keeps candidate.html tests working)
const SCHEDULE_A = SCHEDULE_A_COMMITTEES;

// Schedule B alias — general opex fixture (routed when no entity_type param)
const SCHEDULE_B = DISBURSEMENTS;

// Filings (/filings/ endpoint — used by feed.html)
const FILINGS = {
  results: [
    {
      file_number: 1234567,
      committee_id: 'C00775668',
      committee_name: 'MARIE FOR CONGRESS',
      committee_type: 'H',
      office: 'H',
      report_type: 'Q1',
      report_type_full: 'APRIL QUARTERLY',
      total_receipts: 1200000,
      total_disbursements: 900000,
      cash_on_hand_end_period: 450000,
      receipt_date: '2026-04-07',
      html_url: 'https://docquery.fec.gov/cgi-bin/forms/C00775668/1234567/',
    },
    {
      file_number: 1234568,
      committee_id: 'C00123456',
      committee_name: 'KENT FOR CONGRESS',
      committee_type: 'H',
      office: 'H',
      report_type: 'TER',
      report_type_full: 'TERMINATION REPORT',
      total_receipts: 800000,
      total_disbursements: 650000,
      cash_on_hand_end_period: 200000,
      receipt_date: '2026-04-06',
      html_url: 'https://docquery.fec.gov/cgi-bin/forms/C00123456/1234568/',
    },
    {
      file_number: 1234569,
      committee_id: 'C00999999',
      committee_name: 'FRIENDS OF SENATE',
      committee_type: 'S',
      office: 'S',
      report_type: 'Q1',
      report_type_full: 'APRIL QUARTERLY',
      total_receipts: 5000000,
      total_disbursements: 4200000,
      cash_on_hand_end_period: 1200000,
      receipt_date: '2026-04-05',
      html_url: 'https://docquery.fec.gov/cgi-bin/forms/C00999999/1234569/',
    },
  ],
  pagination: { count: 3, pages: 1, per_page: 100, page: 1 },
};

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * Register a catch-all route for all FEC API calls.
 * Returns mock data based on URL path pattern matching.
 */
export async function mockFecApi(page) {
  await page.route('**/api.open.fec.gov/**', (route) => {
    const url = route.request().url();
    const { pathname, searchParams } = new URL(url);

    const body = resolveFixture(pathname, searchParams);

    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

function resolveFixture(path, params) {
  // Order matters — more specific patterns first

  // candidate/{id}/totals/
  if (/\/candidate\/[^/]+\/totals\//.test(path)) return TOTALS;

  // candidate/{id}/committees/
  if (/\/candidate\/[^/]+\/committees\//.test(path)) return CANDIDATE_COMMITTEES;

  // candidate/{id}/ (metadata)
  if (/\/candidate\/[^/]+\/$/.test(path) || /\/candidate\/[^/]+$/.test(path)) return CANDIDATE;

  // committee/{id}/totals/
  if (/\/committee\/[^/]+\/totals\//.test(path)) return COMMITTEE_TOTALS;

  // committee/{id}/reports/
  if (/\/committee\/[^/]+\/reports\//.test(path)) return REPORTS;

  // committee/{id}/ (metadata)
  if (/\/committee\/[^/]+\/$/.test(path) || /\/committee\/[^/]+$/.test(path)) return COMMITTEE;

  // reporting-dates/
  if (/\/reporting-dates\//.test(path)) return REPORTING_DATES;

  // election-dates/
  if (/\/election-dates\//.test(path)) return ELECTION_DATES;

  // elections/search/ (available cycles for a race)
  if (/\/elections\/search\//.test(path)) return ELECTIONS_SEARCH;

  // elections/ (race candidates)
  if (/\/elections\//.test(path)) return ELECTIONS;

  // filings/ (feed page)
  if (/\/filings\//.test(path)) return FILINGS;

  // candidates/totals/ (races browse page — aggregated financial data)
  if (/\/candidates\/totals\//.test(path)) return CANDIDATES_TOTALS;

  // candidates/search/
  if (/\/candidates\/search\//.test(path)) return SEARCH_RESULTS;

  // candidates/ (browse or search — check q param)
  if (/\/candidates\//.test(path)) {
    if (params.get('q')) return SEARCH_RESULTS;
    return { results: [CANDIDATE.results[0]], pagination: { count: 1 } };
  }

  // committees/ — q param = search, sponsor_candidate_id = leadership PAC lookup, else browse
  if (/\/committees\//.test(path)) {
    if (params.get('q')) return COMMITTEE_SEARCH_RESULTS;
    if (params.get('sponsor_candidate_id')) return LEADERSHIP_PACS;
    return COMMITTEES_LIST;
  }

  // Schedule A — by_state aggregation (must come before plain schedule_a check)
  if (/\/schedules\/schedule_a\/by_state\//.test(path)) return SCHEDULE_A_BY_STATE;

  // Schedule A — route by is_individual param
  if (/\/schedules\/schedule_a\//.test(path)) {
    if (params.get('is_individual') === 'true')  return SCHEDULE_A_INDIVIDUALS;
    if (params.get('is_individual') === 'false') return SCHEDULE_A_COMMITTEES;
    return SCHEDULE_A; // no param — legacy/candidate page path
  }

  // Schedule B — route by entity_type param
  if (/\/schedules\/schedule_b\//.test(path)) {
    if (params.get('entity_type') === 'CCM') return SCHEDULE_B_CONTRIBUTIONS;
    return SCHEDULE_B;
  }

  // Fallback
  return { results: [], pagination: { count: 0 } };
}
