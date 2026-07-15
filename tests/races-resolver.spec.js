// Unit tests for races-resolver.js — the pure /races FEC-layer functions
// (raceSeatStatus, raceTotalReceipts, isIncumbentRow, planRaces). Injected
// standalone via addScriptTag over a page that already loads utils.js (needed for
// formatCandidateName), then exercised in page.evaluate — no FEC/geocod mock, no
// DOM render (sankey.spec.js pattern). fetchRaceSummary (async, hits /elections/)
// and the render/grouping path are covered by the 2e mocked-flow spec, not here.
import { test, expect } from '@playwright/test';

test.describe('races-resolver — pure functions', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/design-system.html');          // loads utils.js (formatCandidateName, etc.)
    await page.addScriptTag({ path: 'races-resolver.js' });
  });

  // ── raceSeatStatus — the seat-status contract (2c-final) ──
  test('seat status: no candidates → "No candidates reported"', async ({ page }) => {
    expect(await page.evaluate(() => window.raceSeatStatus([]))).toBe('No candidates reported');
  });

  test('seat status: candidates, zero incumbents → "Open seat"', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'DOE, JANE', incumbent_challenge_full: 'Challenger' },
      { candidate_name: 'ROE, JOHN', incumbent_challenge: 'C' },
    ]));
    expect(s).toBe('Open seat');
  });

  test('seat status: one incumbent → "Incumbent: First Last" (reordered + title-cased)', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'WILLIAMS, NIKEMA', incumbent_challenge_full: 'Incumbent' },
      { candidate_name: 'DOE, JANE', incumbent_challenge_full: 'Challenger' },
    ]));
    expect(s).toBe('Incumbent: Nikema Williams');
  });

  test('seat status: dual-field incumbent detection (short code I)', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'PEREZ, MARIE', incumbent_challenge: 'I' },
    ]));
    expect(s).toBe('Incumbent: Marie Perez');
  });

  test('seat status: same person, two candidate_ids → "Incumbent: X", not "Multiple"', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'SMITH, PAT', incumbent_challenge_full: 'Incumbent' },
      { candidate_name: 'Smith, Pat', incumbent_challenge_full: 'Incumbent' },  // dupe, different case
    ]));
    expect(s).toBe('Incumbent: Pat Smith');
  });

  test('seat status: two distinct incumbents → "Multiple incumbents" (no names)', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'PERDUE, DAVID', incumbent_challenge_full: 'Incumbent' },
      { candidate_name: 'LOEFFLER, KELLY', incumbent_challenge_full: 'Incumbent' },
    ]));
    expect(s).toBe('Multiple incumbents');
  });

  // ── raceTotalReceipts — un-deduped sum, $0 + null tolerant ──
  test('race total sums total_receipts un-deduped (incl. $0 filers + null)', async ({ page }) => {
    const t = await page.evaluate(() => window.raceTotalReceipts([
      { total_receipts: 1000 }, { total_receipts: 0 }, { total_receipts: 2500.5 }, { total_receipts: null },
    ]));
    expect(t).toBe(3500.5);
  });

  // ── planRaces — geo → the /elections/ call list ──
  test('planRaces: House per district + Senate per state + President in a presidential cycle', async ({ page }) => {
    const plan = await page.evaluate(() => window.planRaces(
      { states: ['GA'], districts: [{ state: 'GA', number: '05' }], flags: {} }, 2024));
    expect(plan).toEqual([
      { office: 'H', state: 'GA', district: '05' },
      { office: 'S', state: 'GA', district: null },
      { office: 'P', state: 'US', district: null },
    ]);
  });

  test('planRaces: non-presidential cycle omits President', async ({ page }) => {
    const offices = await page.evaluate(() => window.planRaces(
      { states: ['GA'], districts: [{ state: 'GA', number: '05' }], flags: {} }, 2026).map(i => i.office));
    expect(offices).toEqual(['H', 'S']);
  });

  test('planRaces: DC skipped for Senate → President-only in a presidential cycle', async ({ page }) => {
    const plan = await page.evaluate(() => window.planRaces(
      { states: ['DC'], districts: [], flags: { dc: true } }, 2024));
    expect(plan).toEqual([{ office: 'P', state: 'US', district: null }]);
  });

  test('planRaces: territory / geo error → empty plan', async ({ page }) => {
    const [terr, err] = await page.evaluate(() => [
      window.planRaces({ flags: { territory: true }, states: ['PR'], districts: [] }, 2024),
      window.planRaces({ error: 'not_found' }, 2024),
    ]);
    expect(terr).toEqual([]);
    expect(err).toEqual([]);
  });
});
