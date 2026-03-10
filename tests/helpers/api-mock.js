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
    office: 'H',
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
    coverage_end_date: '2024-12-31',
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
    leadership_pac: false,
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
    organization_type_full: 'Candidate',
  }],
  pagination: { count: 1 },
};

// Committee financial totals
const COMMITTEE_TOTALS = {
  results: [{
    receipts: 3500000,
    disbursements: 3100000,
    last_cash_on_hand_end_period: 450000,
    coverage_end_date: '2024-12-31',
  }],
  pagination: { count: 1 },
};

// Per-period filing reports (used for chart data)
const REPORTS = {
  results: [
    {
      coverage_start_date: '2024-01-01T00:00:00',
      coverage_end_date:   '2024-03-31T00:00:00',
      total_receipts_ytd:       1200000,
      total_disbursements_ytd:   900000,
      cash_on_hand_end_period:   450000,
      report_form: 'Form 3',
      report_type: 'Q1',
    },
    {
      coverage_start_date: '2024-04-01T00:00:00',
      coverage_end_date:   '2024-06-30T00:00:00',
      total_receipts_ytd:       2500000,
      total_disbursements_ytd:  2000000,
      cash_on_hand_end_period:   600000,
      report_form: 'Form 3',
      report_type: 'Q2',
    },
    {
      coverage_start_date: '2024-07-01T00:00:00',
      coverage_end_date:   '2024-09-30T00:00:00',
      total_receipts_ytd:       3200000,
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

// Race candidates (/elections/ endpoint)
const ELECTIONS = {
  results: [{
    candidate_id:              'H2WA03217',
    candidate_name:            'GLUESENKAMP PEREZ, MARIE',
    party:                     'DEM',
    total_receipts:            3500000,
    total_disbursements:       3100000,
    cash_on_hand_end_period:    450000,
    incumbent_challenge:       'I',
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
  }],
  pagination: { count: 1 },
};

// Disbursements by category (for Spent tab)
const DISBURSEMENTS = {
  results: [
    { disbursement_description: 'DIGITAL ADVERTISING', disbursement_amount: 150000, recipient_name: 'DIGITAL VENDOR LLC', committee_id: 'C00775668' },
    { disbursement_description: 'PAYROLL', disbursement_amount: 80000, recipient_name: 'STAFF', committee_id: 'C00775668' },
  ],
  pagination: { count: 2 },
};

// Schedule A (individual contributions by state/zip)
const SCHEDULE_A = {
  results: [
    { contributor_state: 'WA', contribution_receipt_amount: 500000 },
    { contributor_state: 'CA', contribution_receipt_amount: 200000 },
  ],
  pagination: { count: 2 },
};

// Schedule B (itemized disbursements — same as DISBURSEMENTS shape above)
const SCHEDULE_B = DISBURSEMENTS;

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

  // elections/ (race candidates)
  if (/\/elections\//.test(path)) return ELECTIONS;

  // candidates/search/
  if (/\/candidates\/search\//.test(path)) return SEARCH_RESULTS;

  // candidates/ (browse) — with no search
  if (/\/candidates\//.test(path)) return { results: [CANDIDATE.results[0]], pagination: { count: 1 } };

  // committees/ — leadership PAC lookup uses sponsor_candidate_id param
  if (/\/committees\//.test(path)) {
    if (params.get('sponsor_candidate_id')) return LEADERSHIP_PACS;
    return COMMITTEES_LIST;
  }

  // Schedule A (individual contributions)
  if (/\/schedules\/schedule_a\//.test(path)) return SCHEDULE_A;

  // Schedule B (disbursements)
  if (/\/schedules\/schedule_b\//.test(path)) return SCHEDULE_B;

  // Fallback
  return { results: [], pagination: { count: 0 } };
}
