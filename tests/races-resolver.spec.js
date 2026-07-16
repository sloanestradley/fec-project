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

  // ── raceSeatStatus — the seat-status contract (STRUCTURED as of 2026-07-16;
  // returns { kind, name? }, not a display string — see races-resolver.js) ──
  test('seat status: no candidates → kind "none"', async ({ page }) => {
    expect(await page.evaluate(() => window.raceSeatStatus([]))).toEqual({ kind: 'none' });
  });

  test('seat status: candidates, zero incumbents → kind "open"', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'DOE, JANE', incumbent_challenge_full: 'Challenger' },
      { candidate_name: 'ROE, JOHN', incumbent_challenge: 'C' },
    ]));
    expect(s).toEqual({ kind: 'open' });
  });

  test('seat status: one incumbent → kind "incumbent" + formatted name (kept for future render)', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'WILLIAMS, NIKEMA', incumbent_challenge_full: 'Incumbent' },
      { candidate_name: 'DOE, JANE', incumbent_challenge_full: 'Challenger' },
    ]));
    expect(s).toEqual({ kind: 'incumbent', name: 'Nikema Williams' });
  });

  test('seat status: dual-field incumbent detection (short code I)', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'PEREZ, MARIE', incumbent_challenge: 'I' },
    ]));
    expect(s).toEqual({ kind: 'incumbent', name: 'Marie Perez' });
  });

  test('seat status: same person, two candidate_ids → "incumbent", not "multiple"', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'SMITH, PAT', incumbent_challenge_full: 'Incumbent' },
      { candidate_name: 'Smith, Pat', incumbent_challenge_full: 'Incumbent' },  // dupe, different case
    ]));
    expect(s).toEqual({ kind: 'incumbent', name: 'Pat Smith' });
  });

  test('seat status: two distinct incumbents → kind "multiple" (no names)', async ({ page }) => {
    const s = await page.evaluate(() => window.raceSeatStatus([
      { candidate_name: 'PERDUE, DAVID', incumbent_challenge_full: 'Incumbent' },
      { candidate_name: 'LOEFFLER, KELLY', incumbent_challenge_full: 'Incumbent' },
    ]));
    expect(s).toEqual({ kind: 'multiple' });
  });

  // ── raceTileHTML — mark-the-exception render (2026-07-16) ──
  const tile = (kind, total) => ({ office: 'S', state: 'WA', district: null,
    seatStatus: { kind, name: 'Marie Gluesenkamp Perez' }, total, cycle: 2026 });

  test('tile: incumbent renders NO seat span — the total stands alone', async ({ page }) => {
    const html = await page.evaluate((t) => window.raceTileHTML(t), tile('incumbent', 15400000));
    expect(html).not.toContain('race-tile-seat');
    expect(html).not.toContain('Marie');          // the name never reaches the card
    expect(html).toContain('$15.4M raised');
    expect(html).toContain('data-seat-kind="incumbent"');
  });

  test('tile: open seat renders a .tag-neutral chip', async ({ page }) => {
    const html = await page.evaluate((t) => window.raceTileHTML(t), tile('open', 14200000));
    expect(html).toContain('<span class="tag tag-neutral race-tile-seat">Open seat</span>');
    expect(html).toContain('data-seat-kind="open"');
  });

  test('tile: multiple incumbents renders a .tag-neutral chip', async ({ page }) => {
    const html = await page.evaluate((t) => window.raceTileHTML(t), tile('multiple', 9000000));
    expect(html).toContain('<span class="tag tag-neutral race-tile-seat">Multiple incumbents</span>');
    expect(html).toContain('data-seat-kind="multiple"');
  });

  test('tile: no filings renders plain text (NOT a tag) and omits the $0 total', async ({ page }) => {
    const html = await page.evaluate((t) => window.raceTileHTML(t), tile('none', 0));
    expect(html).toContain('<span class="race-tile-seat">No candidate filings</span>');
    expect(html).not.toContain('tag-neutral');    // absence of data ≠ a race attribute
    expect(html).not.toContain('raised');         // $0 suppressed
  });

  test('tile: loading (seatStatus null) renders skeletons and NO data-seat-kind', async ({ page }) => {
    const html = await page.evaluate(() => window.raceTileHTML(
      { office: 'S', state: 'TN', district: null, seatStatus: null, cycle: 2026 }));
    expect(html).toContain('skeleton');
    expect(html).not.toContain('data-seat-kind');  // → click logs seat_status null
    expect(html).not.toContain('race-tile-seat');
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
