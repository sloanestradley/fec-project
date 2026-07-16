// Unit tests for the geo Function's normalize() — functions/api/geo/[[path]].js.
// normalize is pure (no fetch/Response/env), exported solely for this spec; we
// import it directly (ESM) and feed RAW geocod.io v2 response shapes, covering the
// branches that were only curl-verified in Stage 1: single/multi district, multi-
// state union, at-large (current + historical), DC, territory, presidential-office,
// and the future-degrade shape (no congressional_districts → no House). The wired
// consumer flow is covered by races.spec.js; the geocode/cache/gate wrapper around
// normalize stays curl-verified (not unit-reachable without the Cloudflare runtime).
import { test, expect } from '@playwright/test';
import { normalize } from '../functions/api/geo/[[path]].js';

// Build one geocod.io result. `cds` entries: { number, state, atLarge, historical }.
function mkResult(stateProvince, cds) {
  return {
    address_components: { state_province: stateProvince, postal_code: '00000' },
    accuracy: 1,
    accuracy_type: 'place',
    fields: {
      congressional_districts: (cds || []).map((c) => {
        if (c.historical) {
          // pre-2018 at-large: null ocd_id, signal is the "(at Large)" name only
          return { district_number: null, congress_number: '116th', ocd_id: null,
            name: (c.state || stateProvince) + ' (at Large)' };
        }
        const st = (c.state || stateProvince).toLowerCase();
        const cd = c.atLarge ? 'at-large' : c.number;
        return {
          district_number: c.atLarge ? 0 : c.number,
          congress_number: c.congress || '119th',
          ocd_id: 'ocd-division/country:us/state:' + st + '/cd:' + cd,
          name: (c.state || stateProvince) + ' District ' + (c.number || 'AL'),
        };
      }),
    },
  };
}
const geoOf = (...results) => ({ results });

test.describe('geo Function — normalize()', () => {
  test('single district, non-presidential cycle → offices [H,S], one district, congress echoed', async () => {
    const g = geoOf(mkResult('WA', [{ number: 3 }]));
    const n = normalize(g, 2026, 120, 'zip');
    expect(n.offices).toEqual(['H', 'S']);
    expect(n.states).toEqual(['WA']);
    expect(n.districts).toEqual([{ state: 'WA', number: '03' }]);
    expect(n.congress_number).toBe('119th');
    expect(n.flags).toMatchObject({ multi_state: false, multi_district: false, dc: false, territory: false });
    expect(n.input_type).toBe('zip');
    expect(n.cycle).toBe(2026);
  });

  test('presidential cycle adds P to offices', async () => {
    const n = normalize(geoOf(mkResult('WA', [{ number: 3 }])), 2024, 119, 'zip');
    expect(n.offices).toEqual(['H', 'S', 'P']);
  });

  test('multi-district single state → multi_district, districts unioned', async () => {
    const g = geoOf(mkResult('IL', [{ number: 7 }, { number: 1 }, { number: 6 }, { number: 4 }]));
    const n = normalize(g, 2026, 120, 'zip');
    expect(n.states).toEqual(['IL']);
    expect(n.districts.map(d => d.number)).toEqual(['07', '01', '06', '04']); // union order, not sorted
    expect(n.flags.multi_district).toBe(true);
    expect(n.flags.multi_state).toBe(false);
  });

  test('multi-state (one result, two states via ocd_id) → multi_state, both states + districts', async () => {
    // 42223-shape: a single result whose district array spans KY + TN
    const g = geoOf(mkResult('KY', [{ number: 1, state: 'KY' }, { number: 7, state: 'TN' }]));
    const n = normalize(g, 2024, 119, 'zip');
    expect(new Set(n.states)).toEqual(new Set(['KY', 'TN']));
    expect(n.flags.multi_state).toBe(true);
    expect(n.districts).toContainEqual({ state: 'KY', number: '01' });
    expect(n.districts).toContainEqual({ state: 'TN', number: '07' });
  });

  test('at-large (current form: district_number 0 + ocd cd:at-large) → "00"', async () => {
    const n = normalize(geoOf(mkResult('WY', [{ atLarge: true, number: 0, state: 'WY' }])), 2026, 120, 'zip');
    expect(n.districts).toEqual([{ state: 'WY', number: '00' }]);
    expect(n.offices).toContain('H');
  });

  test('at-large (historical form: null ocd_id, "(at Large)" name) → "00" with fallback state', async () => {
    const n = normalize(geoOf(mkResult('MT', [{ historical: true, state: 'MT' }])), 2016, 114, 'zip');
    expect(n.districts).toEqual([{ state: 'MT', number: '00' }]);
  });

  test('DC → president-only, dc flag, no districts', async () => {
    // DC carries state_province 'DC' and no standard congressional district
    const g = geoOf({ address_components: { state_province: 'DC', postal_code: '20001' },
      accuracy: 1, accuracy_type: 'place', fields: { congressional_districts: [] } });
    const n = normalize(g, 2024, 119, 'zip');
    expect(n.offices).toEqual(['P']);
    expect(n.states).toEqual(['DC']);
    expect(n.districts).toEqual([]);
    expect(n.flags.dc).toBe(true);
  });

  test('territory (PR) → no offices, territory flag', async () => {
    const g = geoOf({ address_components: { state_province: 'PR', postal_code: '00901' },
      accuracy: 1, accuracy_type: 'place', fields: { congressional_districts: [] } });
    const n = normalize(g, 2026, 120, 'zip');
    expect(n.offices).toEqual([]);
    expect(n.states).toEqual(['PR']);
    expect(n.flags.territory).toBe(true);
  });

  test('future-degrade shape (no congressional_districts) → no House, no districts', async () => {
    // The Function omits the cd field on a future cycle, so geocod returns no
    // districts; normalize must yield districts:[] + offices without 'H'.
    const g = geoOf({ address_components: { state_province: 'WA', postal_code: '98604' },
      accuracy: 1, accuracy_type: 'place', fields: {} });
    const n = normalize(g, 2030, 122, 'zip');
    expect(n.districts).toEqual([]);
    expect(n.offices).toEqual(['S']);           // 2030 non-presidential, no districts → no H
    expect(n.states).toEqual(['WA']);
  });

  test('non-voting delegate district (>= 90) is excluded from House races', async () => {
    // Use a non-territory state_province so the territory branch doesn't pre-empt
    // the delegate guard — a bogus district_number 98 exercises the >= 90 skip alone.
    const g = geoOf(mkResult('WA', [{ number: 98, state: 'WA' }]));
    const n = normalize(g, 2026, 120, 'address');
    expect(n.districts).toEqual([]);            // delegate skipped
    expect(n.offices).not.toContain('H');
  });
});
