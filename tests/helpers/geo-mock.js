/**
 * geocod.io geo-resolver mock for Playwright structural tests (2e).
 *
 * Intercepts /api/geo/resolve (the Cloudflare Function that races.html calls) and
 * returns the NORMALIZED resolve object the Function would produce — keyed by the
 * `q` input, computed cycle-faithfully (President only in presidential cycles;
 * future cycles > 2026 degrade to state-only, House dropped). Error inputs return
 * the typed { error } objects.
 *
 * Call mockGeoResolve(page) before page.goto(). Register a page.route() after it
 * to override a specific input for one test (Playwright uses the latest match).
 *
 * The resolved shapes mirror functions/api/geo/[[path]].js normalize(); the raw
 * geocod.io response shapes it's built from live in tests/geo-normalize.spec.js.
 */

const MAX_CONGRESS = 120; // 120th = cycle 2026 (mirror the Function's ceiling)

// Base geographic fixtures keyed by input q. `special` short-circuits office
// computation (dc/territory/error); otherwise offices are derived per cycle.
// The corpus mirrors strategy/location-search-races.md "Test corpus".
const GEO_FIXTURES = {
  // single-state single-district (WA-03) — the flat happy path
  '98604': { states: ['WA'], districts: [{ state: 'WA', number: '03' }] },
  // multi-state, one-result-two-states (Fort Campbell KY/TN) — grouping + Caption A
  '42223': {
    states: ['KY', 'TN'],
    districts: [{ state: 'KY', number: '01' }, { state: 'TN', number: '07' }],
  },
  // multi-district single-state (Chicago) — numerical district order within a flat list
  '60629': {
    states: ['IL'],
    districts: [
      { state: 'IL', number: '07' }, { state: 'IL', number: '01' },
      { state: 'IL', number: '06' }, { state: 'IL', number: '04' },
    ],
  },
  // DC — president-only (offices ['P'] hardcoded in normalize; planRaces gates on cycle)
  '20001': { special: 'dc', states: ['DC'], districts: [], offices: ['P'] },
  // territory (San Juan PR) — no federal races
  '00901': { special: 'territory', states: ['PR'], districts: [] },
  // ungeocodable
  '00000': { special: 'error', error: 'not_found' },
  // address fixtures (keyed by exact typed string)
  '123 MAIN ST, OLYMPIA WA': { states: ['WA'], districts: [{ state: 'WA', number: '03' }], address: true },
  'WASHINGTON': { special: 'error', error: 'low_accuracy' },
};

function buildGeo(fx, type, cycle) {
  const congress = (cycle - 1786) / 2;
  const congressNumber = String(congress) + 'th';
  const base = {
    input_type: type, cycle, congress, congress_number: congressNumber,
    states: fx.states || [], districts: [], offices: [],
    flags: { multi_state: false, multi_district: false, dc: false, territory: false },
  };

  if (fx.special === 'dc') {
    return Object.assign(base, { offices: ['P'], flags: Object.assign(base.flags, { dc: true }) });
  }
  if (fx.special === 'territory') {
    return Object.assign(base, { offices: [], flags: Object.assign(base.flags, { territory: true }) });
  }

  // Future cycle (> 2026): state-only degrade — no districts, no House.
  const future = congress > MAX_CONGRESS;
  const districts = future ? [] : (fx.districts || []);
  const offices = [];
  if (districts.length) offices.push('H');
  offices.push('S');
  if (cycle % 4 === 0) offices.push('P');

  return Object.assign(base, {
    offices, districts,
    flags: Object.assign(base.flags, {
      multi_state: (fx.states || []).length > 1,
      multi_district: districts.length > 1,
    }),
  });
}

export async function mockGeoResolve(page) {
  await page.route('**/api/geo/resolve**', (route) => {
    const { searchParams } = new URL(route.request().url());
    const type = searchParams.get('type');
    const q = (searchParams.get('q') || '').trim().toUpperCase();
    const cycle = parseInt(searchParams.get('cycle'), 10);

    // Out-of-range floor (mirror the Function; races.html floors the picker at 2012
    // but a hand-typed ?year= can reach here).
    const congress = (cycle - 1786) / 2;
    if (!Number.isInteger(congress) || congress < 113) {
      return fulfill(route, { error: 'cycle_out_of_range', cycle });
    }

    const fx = GEO_FIXTURES[q];
    if (!fx) return fulfill(route, { error: 'not_found' });
    if (fx.special === 'error') return fulfill(route, { error: fx.error });

    return fulfill(route, buildGeo(fx, type, cycle));
  });
}

function fulfill(route, body) {
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
}
