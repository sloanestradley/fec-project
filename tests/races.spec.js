// Full mocked resolve→render flow for the /races location search (2e).
//
// geo-mock (/api/geo/resolve) + a races-local /elections/ override (office/state/
// cycle-aware, layered over mockFecApi) + amp-mock drive races.html end to end:
// flat vs grouped layout, President-ungrouped-top, alphabetical states, numerical
// districts, Caption A, single-state silent drop, future degrade, territory/DC/
// error states, URL sync (zip pushes / address writes nothing), and the Amplitude
// events INCLUDING the privacy invariant — no searched location value in any event.
//
// The pure seat-status/planRaces/ordering/caption locks live in races-resolver.spec.js
// + pages.spec.js; this spec covers the wired flow those unit tests can't reach.
import { test, expect } from '@playwright/test';
import { mockAmplitude, getAmplitudeQueue, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';
import { mockGeoResolve } from './helpers/geo-mock.js';

// One /elections/ candidate record (the shape races-resolver reads).
function mkCand(name, incumbent, receipts) {
  return {
    candidate_name: name,
    party_full: 'DEMOCRATIC PARTY',
    total_receipts: receipts,
    total_disbursements: Math.round(receipts * 0.8),
    incumbent_challenge_full: incumbent ? 'Incumbent' : 'Challenger',
    incumbent_challenge: incumbent ? 'I' : 'C',
  };
}

// Office/state/cycle-aware /elections/ override. Registered AFTER mockFecApi so it
// wins for the bare /elections/ path; /elections/search/ falls through (races.html
// never calls it). `emptySenate` lists states whose Senate isn't up (→ null → drop
// or Caption A). President + House always return a non-empty field.
async function mockElections(page, { emptySenate = [] } = {}) {
  await page.route('**/api/fec/elections/**', (route) => {
    const { pathname, searchParams } = new URL(route.request().url());
    if (pathname.includes('/elections/search/')) return route.fallback();

    const office = searchParams.get('office');     // house | senate | president
    const state = searchParams.get('state');
    const district = searchParams.get('district'); // House only

    let results;
    if (office === 'senate' && emptySenate.includes(state)) {
      results = [];                                 // not up this cycle
    } else if (office === 'house' && state === 'WA' && district === '03') {
      results = [mkCand('GLUESENKAMP PEREZ, MARIE', true, 3500000), mkCand('KENT, JOE', false, 2000000)];
    } else {
      results = [mkCand('DOE, JANE', false, 700000), mkCand('ROE, JOHN', false, 400000)];
    }
    route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ results, pagination: { count: results.length } }) });
  });
}

async function setup(page, opts = {}) {
  await mockAmplitude(page);
  await mockFecApi(page);
  await mockGeoResolve(page);
  await mockElections(page, opts);
}

// Wait until progressive resolve has settled: the results state is shown and no
// skeleton meta remains (every tile resolved or dropped).
async function waitForResolve(page) {
  await expect(page.locator('#state-results')).toBeVisible();
  await expect(page.locator('#results-list .skeleton')).toHaveCount(0);
}

test.describe('races.html — location search flow (2e)', () => {
  test('flat single-state result: House + Senate cards, no groups, no President (non-presidential)', async ({ page }) => {
    await setup(page);
    await page.goto('/races.html?zip=98604&year=2026');
    await waitForResolve(page);

    await expect(page.locator('.race-state-group')).toHaveCount(0);           // flat
    await expect(page.locator('.race-card')).toHaveCount(2);                  // H WA-03 + S WA
    await expect(page.locator('.race-card[data-race-key="P|US|"]')).toHaveCount(0);
    // WA-03 House exercises the incumbent seat-status → name normalization end-to-end
    await expect(page.locator('.race-card[data-race-key="H|WA|03"] .race-tile-seat'))
      .toHaveText('Incumbent: Marie Gluesenkamp Perez');
    await expect(page.locator('.race-card[data-race-key="S|WA|"] .race-tile-seat'))
      .toHaveText('Open seat');
  });

  test('multi-state presidential: President ungrouped on top, states alphabetical, Caption A for an absent Senate', async ({ page }) => {
    await setup(page, { emptySenate: ['KY'] });
    await page.goto('/races.html?zip=42223&year=2024');
    await waitForResolve(page);

    // President card is the FIRST child of the list, outside any group
    const first = page.locator('#results-list > *').first();
    await expect(first).toHaveAttribute('data-race-key', 'P|US|');
    await expect(page.locator('#results-list > .race-card[data-race-key="P|US|"]')).toHaveCount(1);

    // State groups alphabetical: Kentucky before Tennessee
    await expect(page.locator('.race-state-header')).toHaveText(['Kentucky', 'Tennessee']);

    // KY group: Senate absent → Caption A note, no Senate card; House KY-01 present
    const ky = page.locator('.race-state-group').filter({ hasText: 'Kentucky' });
    await expect(ky.locator('.race-omit-note')).toHaveText('No Senate race in Kentucky this cycle');
    await expect(ky.locator('.race-card[data-race-key="S|KY|"]')).toHaveCount(0);
    await expect(ky.locator('.race-card[data-race-key="H|KY|01"]')).toHaveCount(1);

    // TN group: Senate present, no omission note
    const tn = page.locator('.race-state-group').filter({ hasText: 'Tennessee' });
    await expect(tn.locator('.race-card[data-race-key="S|TN|"]')).toHaveCount(1);
    await expect(tn.locator('.race-omit-note')).toHaveCount(0);
  });

  test('multi-district single-state: House cards in ascending numerical district order', async ({ page }) => {
    await setup(page);
    await page.goto('/races.html?zip=60629&year=2026');
    await waitForResolve(page);

    const houseKeys = await page.locator('.race-card[data-race-key^="H|IL|"]')
      .evaluateAll(els => els.map(e => e.getAttribute('data-race-key')));
    expect(houseKeys).toEqual(['H|IL|01', 'H|IL|04', 'H|IL|06', 'H|IL|07']);
  });

  test('single-state: an absent Senate is silently dropped (no Caption A off the grouped path)', async ({ page }) => {
    await setup(page, { emptySenate: ['WA'] });
    await page.goto('/races.html?zip=98604&year=2026');
    await waitForResolve(page);

    await expect(page.locator('.race-card[data-race-key="H|WA|03"]')).toHaveCount(1);
    await expect(page.locator('.race-card[data-race-key="S|WA|"]')).toHaveCount(0);
    await expect(page.locator('.race-omit-note')).toHaveCount(0);   // silent, not Caption A
  });

  test('future cycle degrades to state-only: Senate + President, no House card', async ({ page }) => {
    await setup(page);
    await page.goto('/races.html?zip=98604&year=2028');   // 2028 > 2026 ceiling → degrade
    await waitForResolve(page);

    await expect(page.locator('.race-card[data-race-key^="H|"]')).toHaveCount(0);   // no House
    await expect(page.locator('.race-card[data-race-key="S|WA|"]')).toHaveCount(1);
    await expect(page.locator('.race-card[data-race-key="P|US|"]')).toHaveCount(1); // 2028 presidential
  });

  test('territory → "No federal races here" message', async ({ page }) => {
    await setup(page);
    await page.goto('/races.html?zip=00901&year=2026');
    await expect(page.locator('#state-message')).toBeVisible();
    await expect(page.locator('.race-state-title')).toHaveText('No federal races here');
  });

  test('DC → president-only in a presidential cycle, no federal races otherwise', async ({ page }) => {
    await setup(page);
    await page.goto('/races.html?zip=20001&year=2024');
    await waitForResolve(page);
    await expect(page.locator('.race-card')).toHaveCount(1);
    await expect(page.locator('.race-card[data-race-key="P|US|"]')).toHaveCount(1);

    await page.goto('/races.html?zip=20001&year=2026');   // non-presidential
    await expect(page.locator('#state-message')).toBeVisible();
    await expect(page.locator('.race-state-title')).toHaveText('No federal races');
  });

  test('not_found → error message + Location Search Error event', async ({ page }) => {
    await setup(page);
    await page.goto('/races.html?zip=00000&year=2026');
    await expect(page.locator('.race-state-title')).toHaveText('Location not found');
    const ev = await findTrackEvent(page, 'Location Search Error');
    expect(ev.args[1]).toMatchObject({ error_type: 'not_found' });
  });

  test('low-accuracy address → "Address too vague" + Location Search Error event', async ({ page }) => {
    await setup(page);
    await page.goto('/races.html');
    await page.fill('#loc-input', 'Washington');
    await page.locator('#loc-input').press('Enter');   // submit button is .sr-only; Enter is the real path
    await expect(page.locator('.race-state-title')).toHaveText('Address too vague');
    const ev = await findTrackEvent(page, 'Location Search Error');
    expect(ev.args[1]).toMatchObject({ error_type: 'low_accuracy' });
  });

  test('URL sync: a ZIP search pushes ?zip=&year=; an address search writes no params', async ({ page }) => {
    await setup(page);
    // ZIP → shareable URL
    await page.goto('/races.html');
    await page.fill('#loc-input', '98604');
    await page.locator('#loc-input').press('Enter');
    await waitForResolve(page);
    const zipUrl = new URL(page.url());
    expect(zipUrl.searchParams.get('zip')).toBe('98604');
    expect(zipUrl.searchParams.get('year')).toBeTruthy();

    // address → geocode-and-discard extends to the URL (no params)
    await page.fill('#loc-input', '123 Main St, Olympia WA');
    await page.locator('#loc-input').press('Enter');
    await waitForResolve(page);
    expect(new URL(page.url()).search).toBe('');
  });

  test('Amplitude + PRIVACY: Location Search fires with result shape and NO searched location value', async ({ page }) => {
    await setup(page, { emptySenate: ['KY'] });
    await page.goto('/races.html?zip=42223&year=2024');
    await waitForResolve(page);

    const ls = await findTrackEvent(page, 'Location Search');
    expect(ls.args[1]).toMatchObject({
      input_type: 'zip', cycle: 2024, multi_state: true, multi_district: true,
    });
    expect(typeof ls.args[1].result_count).toBe('number');

    // The ZIP value must not appear in ANY event's serialized args (D4 privacy).
    const queue = await getAmplitudeQueue(page);
    expect(JSON.stringify(queue)).not.toContain('42223');
  });

  test('Race Tile Clicked logs the race identity + seat status, never the searched location', async ({ page }) => {
    await setup(page);
    await page.goto('/races.html?zip=98604&year=2026');
    await waitForResolve(page);

    // The card is an <a> to race.html; clicking would navigate away and read the
    // NEW page's (empty) amplitude queue. preventDefault the anchor's navigation —
    // the delegated #results-list handler still fires + tracks (preventDefault does
    // not stop propagation), and the queue read stays on this page.
    const card = page.locator('.race-card[data-race-key="H|WA|03"]');
    await card.evaluate(el => el.addEventListener('click', e => e.preventDefault()));
    await card.click();
    const ev = await findTrackEvent(page, 'Race Tile Clicked');
    expect(ev.args[1]).toMatchObject({
      office: 'H', state: 'WA', district: '03', cycle: 2026,
      seat_status: 'Incumbent: Marie Gluesenkamp Perez',
    });
    const queue = await getAmplitudeQueue(page);
    expect(JSON.stringify(queue)).not.toContain('98604');
  });

  test('progressive render: skeleton tiles paint before resolve, then swap to resolved cards', async ({ page }) => {
    // Hold the /elections/ responses until we've observed the skeleton phase.
    let release;
    const gate = new Promise((r) => { release = r; });
    await mockAmplitude(page);
    await mockFecApi(page);
    await mockGeoResolve(page);
    await page.route('**/api/fec/elections/**', async (route) => {
      const { pathname } = new URL(route.request().url());
      if (pathname.includes('/elections/search/')) return route.fallback();
      await gate;
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ results: [mkCand('DOE, JANE', false, 500000)], pagination: { count: 1 } }) });
    });

    await page.goto('/races.html?zip=98604&year=2026');
    // Skeleton tiles present (race name painted, meta still loading) before resolve
    await expect(page.locator('#results-list .skeleton').first()).toBeVisible();
    await expect(page.locator('.race-card').first()).toBeVisible();
    release();
    await waitForResolve(page);
    await expect(page.locator('#results-list .skeleton')).toHaveCount(0);
    await expect(page.locator('.race-tile-seat').first()).toBeVisible();
  });
});
