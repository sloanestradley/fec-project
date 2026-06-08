/**
 * committee.spec.js — Structural tests for committee.html.
 *
 * Uses mocked FEC API (no real network) and mocked Amplitude.
 * Tests cover:
 *   - Index view landing state (CareerStrip + cycle index, bare URL routing)
 *   - Detail view (cycle-anchored hash; existing summary/raised/spent surface)
 *   - Archive threshold (pre-2008 cycles render as non-navigable rows)
 *   - All-time removal regressions
 *   - Terminated committee branch
 *   - Raised tab sections + unavailable-state copy
 *   - Spent tab sections
 *   - Associated-candidate section link
 *
 * Test URLs: bare URL → index view; #{year}#{tab} → detail view.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

// Hash required to land in detail view (bare URL → index view; T8 parity with candidate.html)
const COMMITTEE_DETAIL_URL = '/committee.html?id=C00775668#2024#summary';
const COMMITTEE_INDEX_URL  = '/committee.html?id=C00775668';

// Shared setup: mock + load detail view + wait for profile to render
async function setupDetail(page) {
  await mockAmplitude(page);
  await mockFecApi(page);
  await page.goto(COMMITTEE_DETAIL_URL);
  await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
}

// Setup for index view (bare URL → CareerStrip + cycle index)
async function setupIndex(page) {
  await mockAmplitude(page);
  await mockFecApi(page);
  await page.goto(COMMITTEE_INDEX_URL);
  await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
}

// ── Detail view: profile header + structural ─────────────────────────────────

test.describe('committee.html — detail view', () => {
  test.beforeEach(async ({ page }) => { await setupDetail(page); });

  test('Page Viewed fires with page: committee and view: detail', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'committee', view: 'detail' });
  });

  test('committee name is displayed', async ({ page }) => {
    const name = page.locator('#committee-name');
    await expect(name).toBeVisible();
    const text = await name.textContent();
    expect(text?.trim().length).toBeGreaterThan(3);
  });

  test('meta-row with type tags is present', async ({ page }) => {
    await expect(page.locator('.meta-row')).toBeVisible();
  });

  test('FEC ID tag renders with committee ID text', async ({ page }) => {
    const fec = page.locator('#meta-row .fec-id-tag');
    await expect(fec).toBeVisible();
    await expect(fec).toHaveText(/FEC ID · C00775668/);
  });

  test('meta-row lives inside .title-meta-stack alongside .page-title (T-meta-row-column)', async ({ page }) => {
    // Architectural regression-lock: the meta-row is a descendant of
    // .title-meta-stack (which is itself a child of .profile-header-row),
    // sibling of .page-title. This keeps the meta-row's parent IS the
    // title-zone so its box can't extend into the menu-btn's column.
    await expect(page.locator('#committee-header > #meta-row')).toHaveCount(0);
    await expect(page.locator('#committee-header > .profile-header-row > .title-meta-stack > #meta-row')).toHaveCount(1);
    await expect(page.locator('#committee-header > .profile-header-row > .title-meta-stack > #committee-name')).toHaveCount(1);
  });

  test('Cycle card with back chevron renders on cycle-detail view (T14.5)', async ({ page }) => {
    await expect(page.locator('#summary-strip .stat-card-cycle')).toBeVisible();
    await expect(page.locator('#cycle-back-btn')).toBeVisible();
  });

  test('Cycle card chevron has correct aria-label (T14.5)', async ({ page }) => {
    const btn = page.locator('#cycle-back-btn');
    await expect(btn).toHaveAttribute('aria-label', 'Back to all cycles');
  });

  test('Cycle card chevron click on fresh-load detail returns to cycle index (T14.5)', async ({ page }) => {
    // setupDetail() lands directly on detail URL via hash — indexScrollY=0 fallback
    await page.locator('#cycle-back-btn').click();
    await expect(page.locator('#cycle-index')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#committee-content')).toBeHidden();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('#stat-cycle shows cycle year-range on detail view (T14.5)', async ({ page }) => {
    const cycleText = await page.locator('#stat-cycle').textContent();
    expect(cycleText?.trim()).toMatch(/^\d{4}[–\-]\d{4}$/);
  });

  test('stats grid shows financial figures (not $0)', async ({ page }) => {
    await page.waitForSelector('.profile-content.visible', { timeout: 10000 });
    // Scope to #summary-strip; #career-strip also has a .stats-grid (hidden in detail view).
    const statsGrid = page.locator('#summary-strip .stats-grid');
    await expect(statsGrid).toBeVisible();
    const values = statsGrid.locator('.stat-value');
    const count = await values.count();
    expect(count).toBeGreaterThan(0);
    let hasNonZeroDollar = false;
    for (let i = 0; i < count; i++) {
      const text = await values.nth(i).textContent();
      if (text?.match(/\$[\d,.]+/) && text !== '$0') hasNonZeroDollar = true;
    }
    expect(hasNonZeroDollar).toBe(true);
  });

  test('committee content area is present', async ({ page }) => {
    const content = page.locator('.profile-content');
    await expect(content).toBeAttached();
  });

  // T-remove-profile-tabs: detail view is a single flowing column — no outer tabs.
  test('no outer tabs bar is rendered', async ({ page }) => {
    await expect(page.locator('.tabs-bar')).toHaveCount(0);
    await expect(page.locator('.tab')).toHaveCount(0);
  });

  test('all three sections (summary/raised/spent) are in-flow at once, no tab clicks', async ({ page }) => {
    // #tab-summary is in flow but can be zero-height on committee (the assoc-section
    // is hidden in the mock; the overspend callout was retired 2026-06-05), so
    // assert it's not display:none rather than "visible". Raised/Spent carry content.
    await expect(page.locator('#tab-summary')).not.toHaveCSS('display', 'none');
    await expect(page.locator('#tab-raised')).toBeVisible();
    await expect(page.locator('#tab-spent')).toBeVisible();
  });

  test('sections render in flow order: summary → raised → spent → page-note', async ({ page }) => {
    const ordered = await page.evaluate(() => {
      const ids = ['tab-summary', 'tab-raised', 'tab-spent', 'page-note'];
      const els = ids.map(id => document.getElementById(id));
      if (els.some(e => !e)) return false;
      for (let i = 0; i < els.length - 1; i++) {
        if (!(els[i].compareDocumentPosition(els[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      }
      return true;
    });
    expect(ordered).toBe(true);
  });

  test('summary-strip stats are visible on the flowing detail view', async ({ page }) => {
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
  });

  test('Raised donut + Spent donut both render in flow without interaction', async ({ page }) => {
    await expect(page.locator('#raised-donut-content')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#spent-donut-content')).toBeVisible({ timeout: 12000 });
  });

  // Standing single-instantiation lock (mirrors candidate; committee has no
  // timeline chart, so 2 expected canvases). Guards the ungated render path
  // against double-instantiation / leaked Chart instances across a cycle round-trip.
  test('exactly one Chart.js instance per canvas, surviving a cycle round-trip', async ({ page }) => {
    await expect(page.locator('#raised-donut-content')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#spent-donut-content')).toBeVisible({ timeout: 12000 });
    const probe = () => page.evaluate(() => {
      const ids = ['chart-donut', 'chart-spent-donut'];
      return {
        perCanvas: ids.map(id => {
          const c = document.getElementById(id);
          return c && window.Chart.getChart(c) ? 1 : 0;
        }),
        total: window.Chart && window.Chart.instances
          ? Object.keys(window.Chart.instances).length : -1
      };
    });
    let r = await probe();
    expect(r.perCanvas).toEqual([1, 1]);
    expect(r.total).toBe(2);
    // Round-trip: index → back to detail forces a full re-render of both donuts.
    await page.locator('#cycle-back-btn').click();
    await page.waitForSelector('#cycle-index.visible', { timeout: 12000 });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    await expect(page.locator('#raised-donut-content')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#spent-donut-content')).toBeVisible({ timeout: 12000 });
    r = await probe();
    expect(r.perCanvas).toEqual([1, 1]);
    expect(r.total).toBe(2);
  });

  // Out-of-scope regression lock: the nested Raised sub-tabs are NOT part of the
  // outer-tab system and must keep working post-de-tab (3-way on committee).
  test('nested Raised sub-tabs (Committees ↔ Conduits ↔ Individuals) still switch', async ({ page }) => {
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'true');
    await page.locator('#raised-tab-btn-individuals').click();
    await expect(page.locator('#raised-tab-btn-individuals')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'false');
  });

  test('first stat card is Cycle (T14)', async ({ page }) => {
    const firstLabel = page.locator('#summary-strip .stats-grid .stat-card').first().locator('.stat-label');
    await expect(firstLabel).toHaveText('Cycle');
  });

  // T-remove-profile-tabs: #tabs-bar is gone; #summary-strip precedes #committee-content.
  test('#summary-strip precedes #committee-content in the DOM', async ({ page }) => {
    const stripBeforeContent = await page.evaluate(() => {
      const strip = document.querySelector('#summary-strip');
      const content = document.querySelector('#committee-content');
      if (!strip || !content) return false;
      return !!(strip.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(stripBeforeContent).toBe(true);
  });

  test('#committee-name text is title-cased, not ALL CAPS', async ({ page }) => {
    const text = await page.locator('#committee-name').textContent();
    expect(text?.trim()).not.toBe(text?.trim().toUpperCase());
  });

  test('.candidate-card-office is not present on page (deprecated class removed)', async ({ page }) => {
    await expect(page.locator('.candidate-card-office')).toHaveCount(0);
  });

  test('#back-link-area is not present in committee header (removed on redesign branch)', async ({ page }) => {
    await expect(page.locator('#back-link-area')).toHaveCount(0);
  });

  test('#assoc-section is present in the DOM', async ({ page }) => {
    await expect(page.locator('#assoc-section')).toBeAttached();
  });

  test('filing history stub is not present', async ({ page }) => {
    await expect(page.locator('.section-title').filter({ hasText: 'Filing History' })).toHaveCount(0);
  });

  // T-remove-profile-tabs: detail URL is bare #cycle (no #tab segment).
  test('detail URL is bare #cycle (no #tab segment)', async ({ page }) => {
    await expect(page).toHaveURL(/#\d{4}$/);
  });

  test('profile-header-sentinel exists for compact scroll observer', async ({ page }) => {
    await expect(page.locator('#profile-header-sentinel')).toBeAttached();
  });

  test('committee-header starts without .compact class (full mode on load)', async ({ page }) => {
    await expect(page.locator('#committee-header')).not.toHaveClass(/compact/);
  });

  test('index-view elements are hidden in detail view', async ({ page }) => {
    await expect(page.locator('#career-strip')).toBeHidden();
    await expect(page.locator('#cycle-index')).toBeHidden();
  });

  test('summary-strip and flowing content are visible in detail view', async ({ page }) => {
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#committee-content')).toBeVisible();
  });
});

// ── Index view: landing state ────────────────────────────────────────────────

test.describe('committee.html — index view landing state', () => {
  test.beforeEach(async ({ page }) => { await setupIndex(page); });

  test('bare URL renders #career-strip and #cycle-index', async ({ page }) => {
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#cycle-index')).toBeVisible();
  });

  test('detail-view elements (#summary-strip, #committee-content) are hidden in index view', async ({ page }) => {
    await expect(page.locator('#summary-strip')).toBeHidden();
    await expect(page.locator('#committee-content')).toBeHidden();
  });

  test('Cycle card is hidden on cycle index view (T14.5)', async ({ page }) => {
    await expect(page.locator('#summary-strip')).toBeHidden();
    await expect(page.locator('#cycle-back-btn')).toBeHidden();
  });

  test('#cycles hash also renders index view (NaN routing)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668#cycles');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#summary-strip')).toBeHidden();
  });

  test('CareerStrip has 3 cells with expected labels (T14)', async ({ page }) => {
    const labels = page.locator('#career-strip .stat-label');
    await expect(labels).toHaveCount(3);
    await expect(labels.nth(0)).toHaveText('History');
    await expect(labels.nth(1)).toHaveText('Lifetime Raised');
    await expect(labels.nth(2)).toHaveText('Lifetime Spent');
  });

  test('History cell shows year-range from first_file_date and last_file_date (T14)', async ({ page }) => {
    // Mock fixture: first_file_date = '2020-04-24', last_file_date = '2026-04-15' → "2020–2026"
    await expect(page.locator('#cstat-history')).toHaveText(/^2020[–\-]2026$/);
  });

  test('Lifetime Raised matches summed receipts across all COMMITTEE_TOTALS rows', async ({ page }) => {
    // Mock totals: 2026=1.8M + 2024=3.7M + 2022=2.1M = $7.6M
    const text = await page.locator('#cstat-career-raised').textContent();
    expect(text?.trim()).toBe('$7.6M');
  });

  test('Lifetime Spent matches summed disbursements', async ({ page }) => {
    // Mock totals: 2026=600k + 2024=3.1M + 2022=1.95M = $5.65M; fmt() rounds to $5.7M
    const text = await page.locator('#cstat-career-spent').textContent();
    expect(text?.trim()).toBe('$5.7M');
  });

  test('#cycle-index renders one row per cycle from c.cycles', async ({ page }) => {
    const rows = page.locator('#cycle-index .cycle-row');
    // 3 cycles: 2026, 2024, 2022
    await expect(rows).toHaveCount(3);
  });

  test('cycle rows are sorted descending (most recent first)', async ({ page }) => {
    const labels = page.locator('#cycle-index .cycle-row .cycle-row-label');
    await expect(labels.nth(0)).toContainText('2026');
    await expect(labels.nth(1)).toContainText('2024');
    await expect(labels.nth(2)).toContainText('2022');
  });

  test('cycle row labels contain a year range with en-dash from coverage_start_date', async ({ page }) => {
    const firstLabel = await page.locator('#cycle-index .cycle-row .cycle-row-label').nth(0).textContent();
    // 2026 row's coverage_start_date is 2025-01-01 → "2025–2026"
    expect(firstLabel).toBe('2025–2026');
  });

  test('clicking a cycle row navigates to bare #{year} and renders detail view', async ({ page }) => {
    // Bare URL goto first — beforeEach already did, but assert state
    await expect(page).toHaveURL(/\/committee\.html\?id=C00775668$/);
    // Click the 2024 row (second row, index 1) — fires hashchange → in-place switchTo
    await page.locator('#cycle-index a.cycle-row').nth(1).click();
    // T-remove-profile-tabs: cycle-row href is bare #2024 (no #summary segment).
    await expect(page).toHaveURL(/#2024$/);
    await page.waitForSelector('#summary-strip.visible', { timeout: 12000 });
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#career-strip')).toBeHidden();
  });

  test('Page Viewed fires with view: index', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'committee', view: 'index' });
  });

  test('committee header is still visible on index view', async ({ page }) => {
    await expect(page.locator('#committee-header')).toBeVisible();
  });
});

// ── Archive threshold ────────────────────────────────────────────────────────

test.describe('committee.html — archive threshold', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Override the metadata + totals endpoints to inject a pre-2008 cycle
    await page.route('**/api/fec/committee/C00775668/**', (route) => {
      const url = route.request().url();
      if (/\/committee\/C00775668\/totals\//.test(url)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [
              { cycle: 2024, receipts: 1000000, disbursements: 800000, last_cash_on_hand_end_period: 200000,
                coverage_start_date: '2023-01-01T00:00:00', coverage_end_date: '2024-12-31T00:00:00' },
              { cycle: 2006, receipts: 200000, disbursements: 180000, last_cash_on_hand_end_period: 20000,
                coverage_start_date: '2005-01-01T00:00:00', coverage_end_date: '2006-12-31T00:00:00' },
            ],
            pagination: { count: 2 },
          }),
        });
      } else if (/\/committee\/C00775668\/(?:\?|$)/.test(url)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{
              committee_id: 'C00775668',
              name: 'MARIE FOR CONGRESS',
              committee_type: 'H',
              designation: 'P',
              filing_frequency: 'Q',
              state: 'WA',
              cycles: [2024, 2006],
              first_file_date: '2005-04-24',
              last_file_date:  '2024-10-15',
            }],
            pagination: { count: 1 },
          }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(COMMITTEE_INDEX_URL);
    await page.waitForSelector('#cycle-index.visible', { timeout: 12000 });
  });

  test('pre-2008 cycle renders as div.cycle-row--archive (non-navigable)', async ({ page }) => {
    await expect(page.locator('#cycle-index div.cycle-row--archive')).toHaveCount(1);
    await expect(page.locator('#cycle-index a.cycle-row[href="#2006#summary"]')).toHaveCount(0);
  });

  test('archive rows have tabindex="-1" (not keyboard-focusable)', async ({ page }) => {
    const archive = page.locator('#cycle-index div.cycle-row--archive').first();
    await expect(archive).toHaveAttribute('tabindex', '-1');
  });

  test('archive divider precedes archive rows with inline label', async ({ page }) => {
    const divider = page.locator('#cycle-index .cycle-archive-divider');
    await expect(divider).toHaveCount(1);
    const text = await divider.textContent();
    // Inline label is "Archived cycles (totals only)"; the methodology
    // explanation now lives in the K17.b tooltip (stashed off the visible text).
    expect(text).toContain('Archived cycles (totals only)');
    expect(text).not.toContain('FEC coverage begins');
  });

  test('archive divider mounts the K17.b methodology tooltip', async ({ page }) => {
    const trigger = page.locator('#cycle-index .cycle-archive-divider .tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About archived cycles');
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('No detail view available for cycles prior to 2008');
  });

  test('post-2008 cycles render as navigable a.cycle-row', async ({ page }) => {
    await expect(page.locator('#cycle-index a.cycle-row[href="#2024"]')).toHaveCount(1);
  });
});

// ── A2: Form-3X raised-donut field resolution ───────────────────────────────────

test.describe('committee.html — A2 Form-3X raised donut field resolution', () => {
  // Regression lock for the A2 committee raised-donut bug. committee.html serves BOTH
  // Form-3 candidate PCCs (the default COMMITTEE fixture, MARIE FOR CONGRESS) and
  // Form-3X PACs/parties. The donut previously read ONLY the Form-3 receipt names
  // (transfers_from_other_authorized_committee / all_other_loans / other_receipts),
  // which are null on a Form-3X record — silently dropping ~$103M of transfers/loans/
  // other on real PACs/parties (e.g. DCCC). The fix coalesces both form-name variants.
  // This serves a Form-3X totals record (only the *_affiliated_party / all_loans_received
  // / other_fed_receipts names populated); under the old code these three wedges would
  // be $0 and drop out. (Metadata stays the base PCC fixture — the donut is form-
  // agnostic and reads only totals field names, which is exactly what this exercises.)
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/committee/C00775668/totals/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results: [{
          cycle: 2024, receipts: 5000000, disbursements: 4000000,
          last_cash_on_hand_end_period: 1000000,
          coverage_start_date: '2023-01-01T00:00:00', coverage_end_date: '2024-12-31T00:00:00',
          individual_itemized_contributions: 2000000,
          individual_unitemized_contributions: 500000,
          other_political_committee_contributions: 800000,
          political_party_committee_contributions: 0,
          transfers_from_affiliated_party: 1200000,   // Form-3X name — fix must read this
          all_loans_received: 400000,                  // Form-3X name
          other_fed_receipts: 100000,                  // Form-3X name
          operating_expenditures: 3500000,
          transfers_to_affiliated_committee: 200000,
          loan_repayments_made: 100000,
          contribution_refunds: 50000,
          other_disbursements: 150000,
        }],
        pagination: { count: 1 },
      })});
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('#raised-donut-content', { state: 'visible', timeout: 12000 });
  });

  test('Transfers in wedge reads transfers_from_affiliated_party (Form-3X)', async ({ page }) => {
    const row = page.locator('#donut-legend .donut-row', {
      has: page.locator('.donut-lbl-text', { hasText: 'Transfers in' }),
    });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.donut-val')).toHaveText('$1.2M');
  });

  test('Loans + Other receipts wedges read the Form-3X field names', async ({ page }) => {
    const loans = page.locator('#donut-legend .donut-row', {
      has: page.locator('.donut-lbl-text', { hasText: /^Loans$/ }),
    });
    await expect(loans.locator('.donut-val')).toHaveText('$400K');
    const other = page.locator('#donut-legend .donut-row', {
      has: page.locator('.donut-lbl-text', { hasText: 'Other receipts' }),
    });
    await expect(other.locator('.donut-val')).toHaveText('$100K');
  });
});

// ── Legacy #cycle#tab back-compat (T-remove-profile-tabs) ───────────────────────

test.describe('committee.html — legacy #cycle#tab back-compat', () => {
  // Old shared/bookmarked links carry a #tab segment. Post-de-tab the cycle is
  // honored, the tab segment ignored, and the URL canonicalizes to bare #cycle.
  test('legacy #2024#summary lands on the 2024 detail flow and canonicalizes to #2024', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668#2024#summary');
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    await expect(page.locator('.tabs-bar')).toHaveCount(0);
    await expect(page.locator('#tab-raised')).toBeVisible();
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#2024');
  });

  test('legacy #2022#raised lands on the 2022 detail flow and canonicalizes to #2022', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668#2022#raised');
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#2022');
  });
});

// ── All-time removal regressions ─────────────────────────────────────────────

test.describe('committee.html — All-time removal regressions', () => {

  test('old #all#summary bookmarks land on the index view (NaN fallthrough)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668#all#summary');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#summary-strip')).toBeHidden();
  });
});

// ── Terminated committee branch ──────────────────────────────────────────────

test.describe('committee.html — terminated committee', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Override the single /committee/:id/ endpoint to flip filing_frequency to 'T'.
    // All other endpoints fall through to the default mocks.
    await page.route('**/api/fec/committee/C00775668/**', (route) => {
      const url = route.request().url();
      if (/\/committee\/C00775668\/(?:\?|$)/.test(url)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{
              committee_id: 'C00775668',
              name: 'MARIE FOR CONGRESS',
              committee_type: 'H',
              committee_type_full: 'House',
              designation: 'P',
              designation_full: 'Principal campaign committee',
              filing_frequency: 'T',
              state: 'WA',
              organization_type_full: null,
              cycles: [2022, 2024, 2026],
              first_file_date: '2020-04-24',
              last_file_date:  '2026-04-15',
            }],
            pagination: { count: 1 },
          }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
  });

  test('FEC ID tag still renders on terminated committee', async ({ page }) => {
    const fec = page.locator('#meta-row .fec-id-tag');
    await expect(fec).toBeVisible();
    await expect(fec).toHaveText(/FEC ID · C00775668/);
  });
});

// ── Raised tab sections ──────────────────────────────────────────────────────

test.describe('committee.html — Raised tab sections', () => {
  test.beforeEach(async ({ page }) => {
    await setupDetail(page);
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    // Wait for slow-tier Top Conduit Sources content to render — signal that
    // both fast and slow tiers have resolved. (.conduits-card is now inside a
    // tab panel; its style.display is no longer the load-state signal.)
    await page.waitForFunction(
      () => {
        const c = document.getElementById('conduits-content');
        return c && c.style.display === 'block';
      },
      { timeout: 15000 }
    );
  });

  test('donut canvas is present in raised tab', async ({ page }) => {
    await expect(page.locator('#chart-donut')).toBeVisible();
  });

  test('raised breakdown cell title reads "Raised breakdown"', async ({ page }) => {
    await expect(page.locator('.raised-cell-title').first()).toHaveText('Raised breakdown');
  });

  test('donut legend "Candidate contributions & loans" wedge mounts the tooltip component', async ({ page }) => {
    const row = page.locator('#donut-legend .donut-row', {
      has: page.locator('.donut-lbl-text', { hasText: 'Candidate contributions & loans' }),
    });
    await expect(row).toHaveCount(1);
    // initTooltips wired the .tooltip host into a trigger button with the
    // host's aria-label transferred; legacy .donut-info/title= is gone.
    const trigger = row.locator('.tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About candidate contributions & loans');
    await expect(row.locator('.donut-info')).toHaveCount(0);
    // Popup surfaces the verbatim methodology copy on open.
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(
      'Direct contributions and loans from the candidate to this committee.'
    );
  });

  test('choropleth section title mounts the geography tooltip (geography + amendment caveat)', async ({ page }) => {
    const title = page.locator('.raised-cell-title--has-info', {
      hasText: 'Where Individual Contributions Come From',
    });
    await expect(title).toHaveCount(1);
    const trigger = title.locator('.tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About the contribution geography map');
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Reflects itemized individual contributions by state.');
    await expect(popup).toContainText('State totals may differ from summary figures due to FEC amendment processing.');
  });

  test('K8 retired: raised footer element removed, Conduits header mounts the conduit tooltip', async ({ page }) => {
    // The whole raised-tab footer was retired 2026-06-01 — #raised-data-note is gone.
    await expect(page.locator('#raised-data-note')).toHaveCount(0);
    // K8 (conduit explanation) now lives on the Conduits column header tooltip.
    await page.locator('#raised-tab-btn-conduits').click();
    const trigger = page.locator('#raised-tab-panel-conduits thead .tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About conduit sources');
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('forward contributions from individual donors');
  });

  test('map container is present in raised tab', async ({ page }) => {
    await expect(page.locator('#map-container')).toBeAttached();
  });

  test('individual donors tbody is present and has at least one row', async ({ page }) => {
    const rows = page.locator('#individual-donors-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('committee donors card is visible on a specific cycle', async ({ page }) => {
    await expect(page.locator('#committee-donors-card')).toBeVisible();
    const rows = page.locator('#committee-donors-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('conduits card is visible and populated on a specific cycle', async ({ page }) => {
    // Conduits is a non-default tab — click to reveal its panel
    await page.locator('#raised-tab-btn-conduits').click();
    await expect(page.locator('#conduits-card')).toBeVisible();
    const rows = page.locator('#conduits-tbody tr');
    await expect(rows).not.toHaveCount(0);
    await expect(page.locator('#conduits-tbody')).toContainText(/Actblue/i);
  });

  test('Tab section title carries cycle label (no "Most recent cycle" copy)', async ({ page }) => {
    const title = page.locator('#raised-tab-section-title');
    // Wait for the dynamic title update — it lands AFTER raised-content becomes
    // visible because renderRaisedIfReady continues writing to the DOM after
    // revealing contentEl. The cycle range is now on the section title (single
    // source) rather than per-card heads.
    await expect(title).toHaveText(/Top Contributors by type · 20\d\d–20\d\d/, { timeout: 15000 });
    const text = await title.textContent();
    expect(text).not.toContain('Most recent cycle');
  });

  test('top committee contributor rows are whole-row links to /committee/{id}', async ({ page }) => {
    // KV-bulk path carries committee_id directly; live-API fallback now also
    // preserves committee_id from the contributor_committee_id field.
    const linkRow = page.locator('#committee-donors-tbody tr.donors-link-row').first();
    await expect(linkRow).toBeAttached();
    const anchor = linkRow.locator('a.donors-link-anchor');
    await expect(anchor).toHaveAttribute('href', /^\/committee\/C\d{8}$/);
  });

  test('top conduit source rows are whole-row links when committee_id is present', async ({ page }) => {
    await page.locator('#raised-tab-btn-conduits').click();
    const linkRow = page.locator('#conduits-tbody tr.donors-link-row').first();
    await expect(linkRow).toBeAttached();
    const anchor = linkRow.locator('a.donors-link-anchor');
    await expect(anchor).toHaveAttribute('href', /^\/committee\/C\d{8}$/);
  });
});

// ── Raised tab: unavailable-state copy ───────────────────────────────────────

test.describe('committee.html — Raised tab unavailable-state copy', () => {
  test('individual contributors tbody shows "Data not available due to high transaction volume." when Schedule A is over the page threshold', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);

    // Override Schedule A calls with is_individual=true to return a high
    // pagination.pages count — triggers the `topIndividualsSource = 'unavailable'`
    // branch in fetchRaisedData(). For non-matching calls, fall through.
    await page.route('**/api/fec/schedules/schedule_a/**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'true') {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [],
            pagination: { count: 50000, pages: 500, per_page: 100, page: 1 },
          }),
        });
      } else {
        route.fallback();
      }
    });

    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    // Wait for the unavailable copy to land in the Individuals tbody — signal
    // that slow tier resolved with the topIndividualsSource = 'unavailable' branch.
    // (Individuals is a non-default tab, but the tbody renders regardless of
    // panel visibility — content rendering is the load signal here, not tab activation.)
    const tbody = page.locator('#individual-donors-tbody');
    await expect(tbody).toContainText('Data not available due to high transaction volume.', { timeout: 15000 });
  });
});

// ── Spent tab sections ───────────────────────────────────────────────────────

// ── Donut center labels + viz-tt tooltip surface (T-chart-tooltip-improvements) ─

test.describe('committee.html — donut center labels + viz-tt surface', () => {
  test.beforeEach(async ({ page }) => { await setupDetail(page); });

  test('Raised donut center label reads "Raised" (dropped "Total")', async ({ page }) => {
    const lbl = page.locator('.donut-center', { has: page.locator('#donut-center-val') })
      .locator('.donut-center-lbl');
    await expect(lbl).toHaveText('Raised');
  });

  test('Spent donut center label reads "Spent" (dropped "Total")', async ({ page }) => {
    const lbl = page.locator('.donut-center', { has: page.locator('#spent-donut-center-val') })
      .locator('.donut-center-lbl');
    await expect(lbl).toHaveText('Spent');
  });

  test('choropleth tooltip #map-tt adopts the shared .viz-tt classes', async ({ page }) => {
    await expect(page.locator('#map-tt')).toHaveClass(/\bviz-tt\b/);
    await expect(page.locator('#map-tt-name')).toHaveClass(/\bviz-tt-label\b/);
    await expect(page.locator('#map-tt-val')).toHaveClass(/\bviz-tt-body\b/);
  });
});

test.describe('committee.html — Spent tab sections', () => {
  test.beforeEach(async ({ page }) => {
    await setupDetail(page);
    await expect(page.locator('#tab-spent')).toBeVisible(); // T-remove-profile-tabs: Spent always in-flow
    // Wait for spent vendors content to render (signal that fetch resolved + render ran)
    await page.waitForFunction(
      () => { const el = document.getElementById('spent-vendors-content'); return el && el.style.display !== 'none'; },
      { timeout: 15000 }
    );
  });

  test('spent donut canvas is present in spent tab', async ({ page }) => {
    await expect(page.locator('#chart-spent-donut')).toBeVisible();
  });

  test('spend-detail-bars is present in spent tab', async ({ page }) => {
    await expect(page.locator('#spend-detail-bars')).toBeAttached();
  });

  test('vendors tbody is present and has at least one row', async ({ page }) => {
    const rows = page.locator('#vendors-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('spent footer is empty/hidden — vendor dedup note cut (K16.d, §5.j)', async ({ page }) => {
    const footer = page.locator('#spent-data-note');
    await expect(footer).toBeHidden();
    await expect(footer).not.toContainText('deduplicated by recipient');
  });

  test('Spending by Purpose title mounts the methodology tooltip (K14)', async ({ page }) => {
    const trigger = page.locator('#spent-purpose-title .tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About spending by purpose');
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Categories estimated from disbursement descriptions using keyword matching.');
    // Committee omits the candidate-only "Covers most recent sub-cycle" sentence.
    await expect(popup).not.toContainText('Covers most recent sub-cycle');
    // Default mock doesn't paginate → not capped → no cap fragment.
    await expect(popup).not.toContainText('capped at 500 transactions');
    // The old inline note under the bars is gone.
    await expect(page.locator('#spent-bars-content .data-note')).toHaveCount(0);
  });

  test('contributions-section is visible (mock has CCM record)', async ({ page }) => {
    await expect(page.locator('#contributions-section')).toBeVisible();
  });

  test('contributions-tbody has at least one row', async ({ page }) => {
    const rows = page.locator('#contributions-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('contributions rows with recipient_committee_id render as whole-row links', async ({ page }) => {
    // Mock includes Friend for Congress (C00123456) — should render as .donors-link-row
    // with /committee/{id} href on .donors-link-anchor.
    const linkRow = page.locator('#contributions-tbody tr.donors-link-row').first();
    await expect(linkRow).toBeAttached();
    const anchor = linkRow.locator('a.donors-link-anchor');
    await expect(anchor).toHaveAttribute('href', /^\/committee\/C\d{8}$/);
  });

  test('vendors header shows cycle range (no "All time" label)', async ({ page }) => {
    const head = page.locator('#vendors-head');
    const text = await head.textContent();
    expect(text).toMatch(/Top Vendors · 20\d\d–20\d\d/);
    expect(text).not.toContain('All time');
  });
});

// ── Spending by Purpose cap fragment (K16.b) ─────────────────────────────────

test.describe('committee.html — Spending by Purpose cap fragment', () => {
  test('tooltip appends "(capped at 500 transactions)" when Schedule B caps', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Force the Schedule B walk to cap: every page reports >5 pages + a cursor,
    // so fetchSpentOpex hits MAX_PAGES and sets capped=true.
    await page.route('**/schedules/schedule_b/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ disbursement_description: 'DIGITAL ADVERTISING', disbursement_amount: 1000, recipient_name: 'VENDOR A' }],
          pagination: { pages: 10, last_indexes: { last_index: '123', last_disbursement_amount: '1' } },
        }),
      })
    );
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-spent')).toBeVisible(); // T-remove-profile-tabs: Spent always in-flow
    const trigger = page.locator('#spent-purpose-title .tooltip-trigger');
    await expect(trigger).toBeAttached({ timeout: 15000 });
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('(capped at 500 transactions)');
  });
});

// ── Associated-candidate section ─────────────────────────────────────────────

test.describe('committee.html — assoc section candidate link', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/committee/C00775668/**', route => {
      const url = route.request().url();
      if (/\/committee\/C00775668\/(?:\?|$)/.test(url)) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{
              committee_id: 'C00775668',
              name: 'MARIE FOR CONGRESS',
              committee_type: 'H',
              designation: 'P',
              filing_frequency: 'Q',
              state: 'WA',
              cycles: [2022, 2024],
              first_file_date: '2020-04-24',
              last_file_date:  '2024-10-15',
              candidate_ids: ['H2WA03217'],
            }],
            pagination: { count: 1 },
          }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
  });

  test('assoc section candidate link is bare URL (no hash anchor)', async ({ page }) => {
    const link = page.locator('#assoc-list a.candidate-card').first();
    await expect(link).toBeVisible({ timeout: 8000 });
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/candidate\//);
    expect(href).not.toContain('#');
  });
});

// ── In-place transitions (T10 — mirrors candidate.spec.js's in-place block) ──

test.describe('committee.html — in-place transitions', () => {
  test.beforeEach(async ({ page }) => { await setupIndex(page); });

  test('no page reload on cycle row click', async ({ page }) => {
    await page.evaluate(() => { document.body.dataset.loadId = '1'; });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    const loadId = await page.evaluate(() => document.body.dataset.loadId);
    expect(loadId).toBe('1');
  });

  test('#committee-header is the same DOM node after index → detail transition', async ({ page }) => {
    await page.evaluate(() => { document.getElementById('committee-header').dataset.mark = 'x'; });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    const mark = await page.evaluate(() => document.getElementById('committee-header').dataset.mark);
    expect(mark).toBe('x');
  });

  test('chevron + cycle-row round-trip re-enters detail flow with all sections visible (T-remove-profile-tabs)', async ({ page }) => {
    // The pre-de-tab version locked restoreTab's panel reset. With the outer tabs
    // gone there are no panels to reset — re-entry lands on the flowing detail
    // view (summary/raised/spent all visible) with a bare #cycle URL.
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    // Leave via the chevron → cycle index.
    await page.locator('#cycle-back-btn').click();
    await page.waitForSelector('#cycle-index.visible', { timeout: 5000 });
    // Re-enter detail via a row click.
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    await expect(page).toHaveURL(/#\d{4}$/);
    await expect(page.locator('#tab-summary')).not.toHaveCSS('display', 'none');
    await expect(page.locator('#tab-raised')).toBeVisible();
    await expect(page.locator('#tab-spent')).toBeVisible();
  });

  test('back button returns to index view', async ({ page }) => {
    // No pre-scroll — indexScrollY=0, so compact should NOT be active after back
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#committee-content')).not.toBeVisible();
    await expect(page.locator('#committee-header')).not.toHaveClass(/compact/);
  });

  test('back button → index does not re-fetch metadata or all-totals', async ({ page }) => {
    let metaRequests = 0;
    let allTotalsRequests = 0;
    page.on('request', req => {
      const url = req.url();
      // /committee/{id}/  (metadata) — distinct from /committee/{id}/totals/
      if (/\/committee\/C00775668\/(\?|$)/.test(url) || /\/committee\/C00775668$/.test(url)) metaRequests++;
      if (url.includes('/committee/') && url.includes('/totals/') && url.includes('per_page=100')) allTotalsRequests++;
    });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    expect(metaRequests).toBe(0);
    expect(allTotalsRequests).toBe(0);
  });

  test('index → detail scroll: compact-engaged index enters detail at compact threshold', async ({ page }) => {
    // Inflate INDEX content only (cycle-index padding) so user can scroll past
    // compact threshold. Detail content stays naturally short — that's the
    // condition that exposes scroll-clamp regressions when minHeight is cleared
    // before natural detail content has filled the document. Earlier scaffolding
    // via body.minHeight=3000px masked this class of bug by keeping document
    // height permanently inflated; index-only inflation simulates the real flow.
    await page.evaluate(() => {
      document.getElementById('cycle-index').style.paddingBottom = '2000px';
      window.scrollTo(0, 500);
    });
    await expect(page.locator('#committee-header')).toHaveClass(/compact/, { timeout: 3000 });
    // Hash navigation via evaluate — Playwright's click() would scroll the element
    // into view first, resetting window.scrollY before switchTo() can read it.
    await page.evaluate(() => { window.location.hash = '#2024#summary'; });
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    // Allow scroll listener cooldown + any clamp to settle
    await page.waitForTimeout(200);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThan(0);
    await expect(page.locator('#committee-header')).toHaveClass(/compact/);
  });

  test('index → detail scroll: non-compact index enters detail at scrollY 0', async ({ page }) => {
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThanOrEqual(5);
    await expect(page.locator('#committee-header')).not.toHaveClass(/compact/);
  });

  test('compact header engages on index view (no prior detail visit required)', async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 400);
    });
    await expect(page.locator('#committee-header')).toHaveClass(/compact/, { timeout: 3000 });
  });

  test('rapid cycle hash navigation: last cycle wins in summary stats', async ({ page }) => {
    // Committee renderStats reads from pre-cached ALL_TOTALS synchronously, so summary
    // stats don't have an async race the way candidate's loadCycle does. This test
    // verifies the URL-routing flow is robust under rapid hashchanges: regardless of
    // intermediate hash flips, the final visible cycle in the URL is what renders.
    // Pre-T16 this also asserted the in-tabs-bar #cycle-switcher value tracked; with
    // the switcher retired, the stat-raised value is the authoritative signal — the
    // same fetch-race-token machinery (view.claimToken / isCurrentToken in renderStats)
    // protects this code path regardless of how the cycle change was triggered.
    // Legacy #cycle#summary forms also exercise tab-segment back-compat; the URL
    // canonicalizes to bare #cycle after renderStats runs.
    await page.evaluate(() => { window.location.hash = '#2024#summary'; });
    await page.evaluate(() => { window.location.hash = '#2022#summary'; });
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    // Wait for actual money value (e.g. "$2.1M"), not just "not dash". After
    // T-load-3 + T-load-4a, cycle-switch reset path inserts a skeleton span
    // into #stat-raised — textContent is "" during that window, which the
    // older "!== '—'" predicate matched truthy.
    await page.waitForFunction(
      () => { const el = document.getElementById('stat-raised'); return el && /\$/.test(el.textContent); },
      { timeout: 12000 }
    );
    await expect(page).toHaveURL(/#2022$/);
    const raisedText = await page.locator('#stat-raised').textContent();
    // 2022 fixture: receipts=2,100,000 → "$2.1M". 2024 fixture: 3,700,000 → "$3.7M"
    expect(raisedText).toContain('2.1');
    expect(raisedText).not.toContain('3.7');
    // T-remove-profile-tabs: all sections flow together now — no per-tab panel
    // display state to assert. The stat value above is the authoritative signal.
  });
});

// ── Path-segment URL ID extraction (regression: trailing slash) ──────────────

test.describe('committee.html — path-segment URL ID extraction', () => {
  // In production, /committee/{id} and /committee/{id}/ both serve committee.html
  // via the Cloudflare Pages Function at functions/committee/[[catchall]].js.
  // The init script extracts the committee ID from window.location.pathname.
  // Earlier (T8 era) the extraction used .split('/').pop() which returned ''
  // for trailing-slash URLs, triggering the "No committee specified" error
  // state. Same class of bug as the candidate.html trailing-slash fix from
  // the T5/T6 era. Fixed by switching to .split('/').filter(Boolean) before
  // taking the last segment.
  //
  // Playwright's webServer is python3 -m http.server which can't run Pages
  // Functions, so we route-intercept the path-segment URLs and serve
  // committee.html directly (mirrors what the production Function does).
  async function routeCommitteePath(page) {
    await page.route(/\/committee\/[A-Z0-9]+\/?$/i, async route => {
      const response = await page.context().request.get('http://localhost:8080/committee.html');
      const body = await response.text();
      await route.fulfill({ status: 200, contentType: 'text/html', body });
    });
  }

  test('/committee/{id} (no trailing slash) extracts ID and renders index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await routeCommitteePath(page);
    await page.goto('/committee/C00775668');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    const fecIdTag = await page.locator('.fec-id-tag').textContent();
    expect(fecIdTag).toContain('C00775668');
  });

  test('/committee/{id}/ (trailing slash) extracts ID and renders index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await routeCommitteePath(page);
    await page.goto('/committee/C00775668/');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    const fecIdTag = await page.locator('.fec-id-tag').textContent();
    expect(fecIdTag).toContain('C00775668');
    // Verify the "no committee specified" error state is NOT present
    const stateMsg = page.locator('#state-msg');
    await expect(stateMsg).not.toBeVisible();
  });

  test('/committee (no ID, clean URL) shows friendly error with Browse committees link', async ({ page }) => {
    await mockAmplitude(page);
    // Intercept the bare /committee path (no ID segment)
    await page.route(/\/committee\/?$/, async route => {
      const response = await page.context().request.get('http://localhost:8080/committee.html');
      const body = await response.text();
      await route.fulfill({ status: 200, contentType: 'text/html', body });
    });
    await page.goto('/committee');
    // Friendly message should render, with a link to /committees
    const stateMsg = page.locator('#state-msg');
    await expect(stateMsg).toContainText('No committee ID provided');
    const link = stateMsg.locator('a');
    await expect(link).toHaveAttribute('href', '/committees');
    await expect(link).toContainText('Browse committees');
  });

  test('/committee.html (no ?id= param) shows friendly error with Browse committees link', async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/committee.html');
    const stateMsg = page.locator('#state-msg');
    await expect(stateMsg).toContainText('No committee ID provided');
    const link = stateMsg.locator('a');
    await expect(link).toHaveAttribute('href', '/committees');
  });

  test('non-existent cycle year (e.g. #1999#summary) falls through to index view', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668#1999#summary');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    // Index view rendered, detail elements hidden
    await expect(page.locator('#committee-content')).not.toBeVisible();
    await expect(page.locator('#summary-strip')).not.toBeVisible();
  });

  test('legacy trailing segment (e.g. #2024#bogus) is ignored; lands on #2024 detail flow', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668#2024#bogus');
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    // T-remove-profile-tabs: trailing segment dropped — URL canonicalizes to bare #2024.
    await expect(page.locator('#tab-summary')).not.toHaveCSS('display', 'none');
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#2024');
  });
});

// ── T12: Raised/Spent loading-state behavior ─────────────────────────────────

test.describe('committee.html — Raised/Spent loading states (T12)', () => {
  test('Raised: donut renders synchronously, slow-tier skeletons visible while in flight', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        await new Promise(r => setTimeout(r, 3000));
      }
      route.fallback();
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    // Donut canvas renders synchronously from totals
    await expect(page.locator('#chart-donut')).toBeVisible({ timeout: 2000 });
    // Active panel (Committees default) skeleton visible while in flight
    await expect(page.locator('#raised-comm-skeleton')).toBeVisible();
    // Other panels' skeletons attached to DOM but hidden (parent panels [hidden])
    await expect(page.locator('#raised-conduits-skeleton')).toBeAttached();
    await expect(page.locator('#raised-conduits-skeleton')).toBeHidden();
    await expect(page.locator('#raised-indiv-skeleton')).toBeAttached();
    await expect(page.locator('#raised-indiv-skeleton')).toBeHidden();
  });

  test('Raised: no skeleton flash when fetch already resolved before tab click', async ({ page }) => {
    await setupDetail(page);
    await page.waitForTimeout(800);
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    await page.waitForTimeout(400);
    // Active panel skeleton hidden because data was already in memory
    await expect(page.locator('#raised-comm-skeleton')).toBeHidden();
    // Switch to Conduits tab — content rendered, no skeleton flash
    await page.locator('#raised-tab-btn-conduits').click();
    await expect(page.locator('#raised-conduits-skeleton')).toBeHidden();
    await expect(page.locator('#conduits-card')).toBeVisible();
  });

  test('Raised: slow-tier failure renders error with retry button', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        route.abort('failed');
      } else {
        route.fallback();
      }
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    const err = page.locator('#raised-comm-error');
    await expect(err).toBeVisible({ timeout: 8000 });
    await expect(err.locator('.tab-retry-btn')).toBeVisible();
  });

  test('Raised: skeleton has substantive height (scroll-clamp guard)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        await new Promise(r => setTimeout(r, 5000));
      }
      route.fallback();
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    // Active panel's skeleton has substantive height. Inactive panel skeletons
    // collapse with their hidden parent — measure each by activating its tab.
    const commHeight = await page.locator('#raised-comm-skeleton').evaluate(el => el.getBoundingClientRect().height);
    expect(commHeight).toBeGreaterThanOrEqual(200);
    await page.locator('#raised-tab-btn-conduits').click();
    const conduitsHeight = await page.locator('#raised-conduits-skeleton').evaluate(el => el.getBoundingClientRect().height);
    expect(conduitsHeight).toBeGreaterThanOrEqual(200);
  });

  // spent-progressive-loading: aborting all Schedule B fails BOTH the opex tier
  // (bars + vendors) and the CCM tier (contributions); each surfaces its own
  // per-source error. The donut renders from ALL_TOTALS and is never blanked.
  test('Spent: per-source failures render their own errors; donut survives', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_b/**', (route) => route.abort('failed'));
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-spent')).toBeVisible(); // T-remove-profile-tabs: Spent always in-flow
    await expect(page.locator('#spent-vendors-error')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#spent-vendors-error .tab-retry-btn')).toBeVisible();
    await expect(page.locator('#spent-bars-error')).toBeVisible();
    await expect(page.locator('#spent-contributions-error')).toBeVisible();
    // Donut renders from ALL_TOTALS — never blanked by Schedule B failure.
    await expect(page.locator('#spent-donut-content')).toBeVisible();
  });

  test('Spent: opex retry click re-fires fetch and renders content', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    let abortNext = true;
    await page.route('**/api/fec/schedules/schedule_b/**', (route) => {
      if (abortNext) route.abort('failed');
      else route.fallback();
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-spent')).toBeVisible(); // T-remove-profile-tabs: Spent always in-flow
    await expect(page.locator('#spent-vendors-error')).toBeVisible({ timeout: 8000 });
    abortNext = false;
    await page.locator('#spent-vendors-error .tab-retry-btn').click();
    // Wait for spent vendors content to flip to block (post-refactor signal)
    await page.waitForFunction(
      () => document.getElementById('spent-vendors-content').style.display === 'block',
      { timeout: 10000 }
    );
    await expect(page.locator('#spent-vendors-content')).toBeVisible();
    await expect(page.locator('#spent-vendors-error')).toBeHidden();
    await expect(page.locator('#spent-bars-error')).toBeHidden();
  });

  // Error isolation — a CCM-only failure must NOT blank opex (bars + vendors) or the
  // donut; only the Contributions section errors. (entity_type=CCM is the CCM walk's
  // distinguishing param; the opex walk omits it.)
  test('Spent: CCM-only failure isolates to Contributions; opex + donut render', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_b/**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('entity_type') === 'CCM') route.abort('failed');
      else route.fallback();
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-spent')).toBeVisible();
    await expect(page.locator('#spent-contributions-error')).toBeVisible({ timeout: 8000 });
    // Opex sections + donut unaffected.
    await expect(page.locator('#spent-vendors-content')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#spent-donut-content')).toBeVisible();
    await expect(page.locator('#spent-vendors-error')).toBeHidden();
    await expect(page.locator('#spent-bars-error')).toBeHidden();
  });

  // Donut is instant — renders from ALL_TOTALS even while both Schedule B walks
  // are still pending (held open).
  test('Spent: donut renders instantly while opex + CCM tiers still loading', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    let releaseB;
    const heldB = new Promise((res) => { releaseB = res; });
    await page.route('**/api/fec/schedules/schedule_b/**', async (route) => {
      await heldB;
      route.fallback();
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-spent')).toBeVisible();
    await expect(page.locator('#spent-donut-content')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#spent-vendors-skeleton')).toBeVisible();
    await expect(page.locator('#spent-contributions-skeleton')).toBeVisible();
    releaseB();
  });

  // Overlay "still loading" messages are SIBLINGS of their skeletons inside
  // .skeleton-overlay-wrap — never DOM children (the .skeleton group-opacity pulse
  // would dim a descendant). Structural guard for both table sections.
  test('Spent: Vendors + Contributions overlays are siblings inside .skeleton-overlay-wrap', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    for (const id of ['spent-vendors-still-loading', 'spent-contributions-still-loading']) {
      const inWrap = await page.locator('#' + id).evaluate(el => !!el.closest('.skeleton-overlay-wrap'));
      expect(inWrap).toBe(true);
      const isChildOfSkeleton = await page.locator('#' + id)
        .evaluate(el => el.parentElement.classList.contains('skeleton'));
      expect(isChildOfSkeleton).toBe(false);
    }
  });
});

// ── T12.5: 429-aware error UI + init-stage failure handling ──────────────────
//
// committee.html init failures are handled at the page level (state-msg.error)
// rather than via tab-error bridging — when /committee/{id}/ or /totals/ fails,
// the committee header never reveals, so tab-error UI is never the right surface.
// The init-stage tests below confirm that decision (no bridging) hasn't drifted.

test.describe('committee.html — 429-aware error UI (T12.5)', () => {
  test('init-stage 429 on /committee/{id}/totals/ → page-level state-msg, tabs not revealed', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/committee/C00775668/totals/**', (route) => {
      route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    // state-msg with error class shows the failure inline
    const stateMsg = page.locator('#state-msg.error');
    await expect(stateMsg).toBeVisible({ timeout: 12000 });
    await expect(stateMsg).toHaveText(/Could not load committee/);
    // committee header stays hidden — no tab-error UI involved
    await expect(page.locator('#committee-header')).toBeHidden();
  });

  test('init-stage non-429 on /committee/{id}/totals/ → page-level state-msg', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/committee/C00775668/totals/**', (route) => {
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    const stateMsg = page.locator('#state-msg.error');
    await expect(stateMsg).toBeVisible({ timeout: 12000 });
    await expect(stateMsg).toHaveText(/Could not load committee/);
  });

  test('tab-fetch 429 → rate-limit copy with retry button hidden', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
      } else {
        route.fallback();
      }
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    await expect(page.locator('#raised-comm-error')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#raised-comm-error .tab-error-msg')).toHaveText(/rate limit reached/i);
    await expect(page.locator('#raised-comm-error .tab-retry-btn')).toBeHidden();
  });

  test('tab-fetch non-429 (regression) → existing copy + retry button visible', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        route.abort('failed');
      } else {
        route.fallback();
      }
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    await expect(page.locator('#raised-comm-error')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#raised-comm-error .tab-error-msg')).toHaveText(/Could not load top contributors/);
    await expect(page.locator('#raised-comm-error .tab-error-msg')).not.toHaveText(/rate limit/i);
    await expect(page.locator('#raised-comm-error .tab-retry-btn')).toBeVisible();
  });

  test('cycle switch via Cycle card chevron after tab-fetch 429 clears error and renders new cycle (T16)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    let block429 = true;
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (block429 && url.searchParams.get('is_individual') === 'false') {
        route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
      } else {
        route.fallback();
      }
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    await expect(page.locator('#raised-comm-error')).toBeVisible({ timeout: 8000 });
    block429 = false;
    // T16: switch cycle via the Cycle card chevron → cycle index → row click.
    // The cycle-switcher in the tabs-bar retired.
    await page.locator('#cycle-back-btn').click();
    await page.waitForSelector('#cycle-index.visible', { timeout: 5000 });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#committee-content.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    // Active (Committees default) panel renders on new cycle, slow error clears
    await expect(page.locator('#committee-donors-card')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#raised-comm-error')).toBeHidden();
    // Switching to Conduits panel reveals the populated conduits card
    await page.locator('#raised-tab-btn-conduits').click();
    await expect(page.locator('#conduits-card')).toBeVisible();
  });

  test('Raised donut skeleton: visible before Raised tab visit, hidden once donut renders', async ({ page }) => {
    await setupDetail(page);
    // User lands on Summary initially; Raised tab content not yet rendered.
    // Skeleton element is in the DOM with display:block from renderStats's reset
    // (it's hidden visually only because parent #tab-raised is display:none).
    const skel = page.locator('#raised-donut-skeleton');
    await expect(skel).toBeAttached();
    // Click Raised → renderRaisedIfReady runs → donut renders synchronously from
    // ALL_TOTALS-derived breakdown → skeleton swaps to content
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    await page.waitForFunction(
      () => document.getElementById('raised-donut-content').style.display === 'block',
      { timeout: 8000 }
    );
    await expect(skel).toBeHidden();
    await expect(page.locator('#raised-donut-content')).toBeVisible();
  });
});

// ── T12.5/skeleton arc regression locks (2026-05-06) ─────────────────────────

test.describe('committee.html — title-always-visible during loading', () => {
  test('Raised section title visible at the same time as the active panel skeleton', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        await new Promise(r => setTimeout(r, 3000));
      }
      route.fallback();
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    // Active panel (Committees default) skeleton visible
    await expect(page.locator('#raised-comm-skeleton')).toBeVisible();
    // Section title (single source) visible alongside — title-always-visible
    // pattern, now at section level rather than per-card.
    await expect(page.locator('#raised-tab-section-title')).toBeVisible();
    await expect(page.locator('#raised-tab-section-title')).toContainText(/Top Contributors by type/);
    // Switch tabs — section title persists, other panels' skeletons reveal
    await page.locator('#raised-tab-btn-conduits').click();
    await expect(page.locator('#raised-conduits-skeleton')).toBeVisible();
    await expect(page.locator('#raised-tab-section-title')).toBeVisible();
    await page.locator('#raised-tab-btn-individuals').click();
    await expect(page.locator('#raised-indiv-skeleton')).toBeVisible();
    await expect(page.locator('#raised-tab-section-title')).toBeVisible();
    // Raised breakdown title (above the donut) also visible
    await expect(page.locator('.raised-cell-title').first()).toContainText('Raised breakdown');
  });
});

test.describe('committee.html — committee-row consolidation regression', () => {
  test('search.html / committees.html / modal share the canonical .committee-row shape', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Spot-check via /committees/ browse page — the third caller of committeeRowHTML.
    // (Search results parity is checked by candidate.spec.js modal test asserting
    // .committee-result-row count is 0 site-wide; this test confirms /committees uses
    // the same shape too.)
    await page.goto('/committees.html');
    await page.waitForSelector('.committee-row', { timeout: 12000 });
    const firstRow = page.locator('.committee-row').first();
    const tagName = await firstRow.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('a');
    await expect(firstRow.locator('.committee-name')).toBeVisible();
    await expect(firstRow.locator('.committee-card-meta')).toBeVisible();
    // Deprecated class must be gone everywhere
    await expect(page.locator('.committee-result-row')).toHaveCount(0);
  });
});

// ── Tab section: WAI-ARIA tabs for top contributors ──────────────────────────

test.describe('committee.html — tab section (top contributors)', () => {
  // Raised tab content is display:none until user clicks Raised — every test
  // here clicks Raised before asserting on the tab section markup. Conduit
  // committee + cycle-range tests have their own setup and don't use this hook.
  async function gotoRaised(page) {
    await setupDetail(page);
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
  }

  test('tablist renders with three tabs and correct ARIA roles on a non-conduit committee', async ({ page }) => {
    await gotoRaised(page);
    await expect(page.locator('#raised-tab-section [role="tablist"]')).toHaveCount(1);
    await expect(page.locator('#raised-tab-section [role="tab"]')).toHaveCount(3);
    // Default active = Committees
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#raised-tab-btn-conduits')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#raised-tab-btn-individuals')).toHaveAttribute('aria-selected', 'false');
    // Default panel visible; others hidden
    await expect(page.locator('#raised-tab-panel-committees')).toBeVisible();
    await expect(page.locator('#raised-tab-panel-conduits')).toHaveAttribute('hidden', '');
    await expect(page.locator('#raised-tab-panel-individuals')).toHaveAttribute('hidden', '');
  });

  test('clicking a tab switches active panel and aria-selected state', async ({ page }) => {
    await gotoRaised(page);
    await page.locator('#raised-tab-btn-individuals').click();
    await expect(page.locator('#raised-tab-btn-individuals')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#raised-tab-panel-individuals')).toBeVisible();
    await expect(page.locator('#raised-tab-panel-committees')).toHaveAttribute('hidden', '');
  });

  test('keyboard arrow navigation cycles between tabs', async ({ page }) => {
    await gotoRaised(page);
    await page.locator('#raised-tab-btn-committees').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#raised-tab-btn-conduits')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#raised-tab-btn-individuals')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight'); // wrap to first
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.locator('#raised-tab-btn-individuals')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'true');
  });

  test('Conduits tab is removed on a conduit committee (topCommitteesIsConduit)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Mock Schedule A is_individual=false to return a count > 500000 — that's
    // the conduit detection threshold in fetchRaisedSlowData (committee.html).
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            results: [],
            pagination: { count: 11000000, pages: 110000, last_indexes: {} }
          })
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    // Wait for slow-tier resolve to remove the Conduits tab
    await page.waitForFunction(
      () => !document.getElementById('raised-tab-btn-conduits'),
      { timeout: 15000 }
    );
    // Two tabs remain: Committees + Individuals
    await expect(page.locator('#raised-tab-section [role="tab"]')).toHaveCount(2);
    await expect(page.locator('#raised-tab-btn-committees')).toBeVisible();
    await expect(page.locator('#raised-tab-btn-individuals')).toBeVisible();
    // The conduit panel is also gone
    await expect(page.locator('#raised-tab-panel-conduits')).toHaveCount(0);
  });

  test('section title carries the cycle range', async ({ page }) => {
    await gotoRaised(page);
    await expect(page.locator('#raised-tab-section-title')).toHaveText(
      /Top Contributors by type · 20\d\d–20\d\d/, { timeout: 15000 }
    );
  });

  test('slow-tier error surfaces per-panel on every KV-miss tab incl. Individuals (no active-tab suppression)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);  // KV always misses → all three panels are slow-tier-fed
    // is_individual=false 429s → fetchRaisedSlowData rejects → raisedSlowError set
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
      } else {
        route.fallback();
      }
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible(); // T-remove-profile-tabs: Raised always in-flow
    // Committees (default) — per-panel error visible
    await expect(page.locator('#raised-comm-error')).toBeVisible({ timeout: 8000 });
    // Individuals — THE HEADLINE FIX (T-raised-loading-states): a KV-miss Individuals panel
    // IS slow-tier-fed, so the error surfaces here too. The retired active-tab gate
    // silent-blanked this panel (assumed Individuals was always KV-fed).
    await page.locator('#raised-tab-btn-individuals').click();
    await expect(page.locator('#raised-indiv-error')).toBeVisible();
    await expect(page.locator('#raised-indiv-error .tab-error-msg')).toHaveText(/rate limit reached/i);
    // Conduits — always slow-tier-fed, error too
    await page.locator('#raised-tab-btn-conduits').click();
    await expect(page.locator('#raised-conduits-error')).toBeVisible();
    // The old detached shared indicators are gone.
    await expect(page.locator('#raised-still-loading')).toHaveCount(0);
    await expect(page.locator('#raised-slow-error')).toHaveCount(0);
  });

  test('Raised: still-loading message overlays the skeleton footprint as a sibling (not a child)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Hold the slow tier in flight so the skeleton stays visible while we inspect.
    await page.route('**/api/fec/schedules/schedule_a/?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        await new Promise(r => setTimeout(r, 4000));
      }
      route.fallback();
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-comm-skeleton')).toBeVisible();
    // Force the message visible (the real 10s timer is too slow for a unit test); the
    // CSS owns the centering, so display:flex is all that's needed.
    await page.locator('#raised-comm-still-loading').evaluate(el => { el.style.display = 'flex'; });
    const skelBox = await page.locator('#raised-comm-skeleton').boundingBox();
    const msgBox  = await page.locator('#raised-comm-still-loading').boundingBox();
    expect(msgBox.y).toBeGreaterThanOrEqual(skelBox.y - 1);
    expect(msgBox.y).toBeLessThan(skelBox.y + skelBox.height);
    const insideWrap = await page.locator('#raised-comm-still-loading')
      .evaluate(el => !!el.closest('.skeleton-overlay-wrap'));
    expect(insideWrap).toBe(true);
    const childOfSkeleton = await page.locator('#raised-comm-still-loading')
      .evaluate(el => !!el.closest('#raised-comm-skeleton'));
    expect(childOfSkeleton).toBe(false);
  });

  test('Raised: Individuals panel owns a sibling overlay + still-loading hidden on resolve', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);  // KV miss → Individuals is slow-tier-fed
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#tab-raised')).toBeVisible();
    await expect(page.locator('#raised-comm-still-loading')).toBeHidden();
    await page.locator('#raised-tab-btn-individuals').click();
    await expect(page.locator('#raised-indiv-still-loading')).toBeHidden();
    // The headline panel's overlay is a sibling inside the wrap, never a child of the
    // pulsing skeleton (the group-opacity gotcha).
    const insideWrap = await page.locator('#raised-indiv-still-loading')
      .evaluate(el => !!el.closest('.skeleton-overlay-wrap'));
    expect(insideWrap).toBe(true);
    const childOfSkeleton = await page.locator('#raised-indiv-still-loading')
      .evaluate(el => !!el.closest('#raised-indiv-skeleton'));
    expect(childOfSkeleton).toBe(false);
  });
});

// ── T-load-1: skeleton committee-header + page-level loading timers ───────
// Verifies skeleton is structurally present in served HTML, hydrates on
// entity-resolve, page-level timers don't fire on normal load (clear-path
// locked). Plus: Promise.all split — committee-header reveals after
// /committee/{id}/ resolves, independent of /totals/.
test.describe('committee.html — T-load-1 skeleton header', () => {
  test('skeleton spans present in initial HTML for committee-name and meta-row', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/committee.html');
    const html = await response.text();
    expect(html).toMatch(/<div class="page-title" id="committee-name"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/<div class="meta-row" id="meta-row"><span class="skeleton"[^>]*><\/span><\/div>/);
  });

  test('skeleton spans replaced by real content after entity resolves', async ({ page }) => {
    await setupDetail(page);
    await expect(page.locator('#committee-name')).toContainText(/[A-Za-z]+/);
    await expect(page.locator('#committee-name .skeleton')).toHaveCount(0);
    await expect(page.locator('#meta-row .skeleton')).toHaveCount(0);
    await expect(page.locator('#meta-row .fec-id-tag')).toBeVisible();
  });

  test('state-msg stays hidden on successful load — 10s/30s timers cleared on entity resolve', async ({ page }) => {
    await setupDetail(page);
    await expect(page.locator('#state-msg')).not.toBeVisible();
    await page.waitForTimeout(500);
    await expect(page.locator('#state-msg')).not.toBeVisible();
    await expect(page.locator('#state-msg')).toBeEmpty();
  });

  test('committee-header has no display:none in initial HTML — skeleton visible from first paint', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/committee.html');
    const html = await response.text();
    expect(html).not.toMatch(/id="committee-header"[^>]*style="display:none/);
  });

  test('committee-header reveals after /committee/{id}/ resolves, independent of /totals/ (Promise.all split)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Delay /totals/ by 1500ms — committee-header should reveal well before that
    // since the Promise.all split lets the entity call hydrate the header
    // independently. With the prior coupling this test would time out.
    await page.route('**/api/fec/committee/*/totals/**', async (route) => {
      await new Promise(r => setTimeout(r, 1500));
      await route.fallback();
    });
    const t0 = Date.now();
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 1000 });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(1500);
    // Committee name is hydrated (no skeleton remains)
    await expect(page.locator('#committee-name .skeleton')).toHaveCount(0);
    await expect(page.locator('#committee-name')).not.toHaveText('—');
  });

  test('name skeleton renders at non-zero width during load window (T-load-header-title-skeleton regression lock)', async ({ page }) => {
    // Was a latent bug: width:60% inside .page-title (flex item, no flex-basis)
    // resolved to 0 via CSS circular-percentage-ref. Fix changed to width:8em
    // (proportional to title font-size). This test asserts the skeleton
    // actually has visible dimensions during the entity-fetch await window.
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/**', async (route) => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fallback();
    });
    await page.goto('/committee.html?id=C00775668', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const dims = await page.evaluate(() => {
      const skel = document.querySelector('#committee-name .skeleton');
      if (!skel) return null;
      const r = skel.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(dims).not.toBeNull();
    expect(dims.width).toBeGreaterThan(100);
    expect(dims.height).toBeGreaterThan(20);
  });
});

// ── T-load-3: skeleton stats-grid placeholders ─────────────────────────────
// Verifies skeletons are structurally present in the served HTML for the
// raised/spent/coh detail cells and the career-strip index cells. #stat-cycle
// is excluded from skeleton seeding — it gets a sync URL-hash write in init()
// before any await, so the cell renders with its real value at first paint.
test.describe('committee.html — T-load-3 stats-grid skeletons', () => {
  test('cycle-detail stat cells (raised/spent/coh) have skeleton spans in initial HTML', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/committee.html');
    const html = await response.text();
    expect(html).toMatch(/id="stat-raised"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/id="stat-spent"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/id="stat-coh"><span class="skeleton"[^>]*><\/span><\/div>/);
  });

  test('#stat-cycle has no skeleton in initial HTML (sync URL-hash write)', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/committee.html');
    const html = await response.text();
    expect(html).not.toMatch(/id="stat-cycle"><span class="skeleton"/);
    // Initial HTML still carries literal '—'; overwritten sync in init() before any await
    expect(html).toMatch(/id="stat-cycle">—<\/div>/);
  });

  test('#stat-cycle hydrates synchronously from URL hash (cycle value present without awaiting any fetch)', async ({ page }) => {
    await setupDetail(page);
    await expect(page.locator('#stat-cycle .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-cycle')).toHaveText('2023–2024');
  });

  test('cycle-detail stat cells replaced by real values after totals resolve', async ({ page }) => {
    await setupDetail(page);
    await expect(page.locator('#stat-raised .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-spent .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-coh .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-raised')).toHaveText(/\$[\d,.]+[MK]?|—/);
  });

  test('cycle-index career cells have skeleton spans in initial HTML', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/committee.html');
    const html = await response.text();
    expect(html).toMatch(/id="cstat-history"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/id="cstat-career-raised"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/id="cstat-career-spent"><span class="skeleton"[^>]*><\/span><\/div>/);
  });

  test('cycle-index career cells replaced by real values after index resolves', async ({ page }) => {
    await setupIndex(page);
    await expect(page.locator('#cstat-history .skeleton')).toHaveCount(0);
    await expect(page.locator('#cstat-career-raised .skeleton')).toHaveCount(0);
    await expect(page.locator('#cstat-career-spent .skeleton')).toHaveCount(0);
    await expect(page.locator('#cstat-history')).toHaveText(/^\d{4}([–\-]\d{4})?$/);
  });
});

// ── T-load-4a: progressive cycle-index hydration ──────────────────────────────
// committee.html — cstat-history is entity-hydrated immediately at scaffold time
// (no /totals/ dependency). Career raised/spent cells use skeletons until
// /totals/ resolves. Empty-cycle case (c.cycles=[]) renders inline-status-msg
// "No filing cycles on record." instead of cycle-row scaffold.
test.describe('committee.html — T-load-4a progressive cycle-index', () => {
  test('cstat-history is hydrated from entity at scaffold time (no skeleton, real text)', async ({ page }) => {
    await setupIndex(page);
    // cstat-history rendered from entity dates (committee data is in scope before any await on /totals/)
    await expect(page.locator('#cstat-history .skeleton')).toHaveCount(0);
    await expect(page.locator('#cstat-history')).toHaveText(/^\d{4}([–\-]\d{4})?$/);
  });

  test('career-strip raised/spent cells replace skeletons with values after /totals/ resolves', async ({ page }) => {
    await setupIndex(page);
    await expect(page.locator('#cstat-career-raised .skeleton')).toHaveCount(0);
    await expect(page.locator('#cstat-career-spent .skeleton')).toHaveCount(0);
    await expect(page.locator('#cstat-career-raised')).toHaveText(/\$[\d,.]+[MK]?|—/);
  });

  test('empty-cycle committee (c.cycles=[]) renders "No filing cycles on record." inside #cycle-index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Override /committee/{id}/ to return a committee with empty cycles array
    await page.route('**/api/fec/committee/C00775668/?**', (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            committee_id: 'C00775668',
            name: 'TEST EMPTY-CYCLES COMMITTEE',
            committee_type: 'H',
            designation: 'P',
            filing_frequency: 'Q',
            state: 'WA',
            cycles: [],
            first_file_date: '2026-01-15',
            last_file_date: '2026-01-15',
          }],
          pagination: { count: 1 },
        }),
      });
    });
    await page.goto(COMMITTEE_INDEX_URL);
    await page.waitForSelector('#cycle-index.visible', { timeout: 12000 });
    // Empty-state copy rendered inside #cycle-index
    const emptyMsg = page.locator('#cycle-index .inline-status-msg');
    await expect(emptyMsg).toBeVisible();
    await expect(emptyMsg).toHaveText('No filing cycles on record.');
    // No cycle-row elements
    await expect(page.locator('#cycle-index a.cycle-row')).toHaveCount(0);
  });
});

// ── T-committee-init-defer-totals: per-path totals await ──────────────────────
// init() awaits only entityP; totalsP is awaited on the detail-view branch
// (renderStats needs ALL_TOTALS sync), not on the index branch (helper's
// fetchIndexData re-uses the cached promise). A totalsP.then() populator
// sets ALL_TOTALS as soon as it lands AND re-fires renderStats when the user
// clicked a cycle row during a cold-cache totals load.
test.describe('committee.html — T-committee-init-defer-totals per-path totals await', () => {
  test('cycle-index scaffold renders independent of /totals/ (init awaits only entity on index path)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Delay /totals/ by 1500ms — scaffold (career-strip + cycle-index) should
    // be visible well before that since init() no longer awaits totalsP on the
    // index path. With the prior eager await this test would time out.
    await page.route('**/api/fec/committee/*/totals/**', async (route) => {
      await new Promise(r => setTimeout(r, 1500));
      await route.fallback();
    });
    const t0 = Date.now();
    await page.goto(COMMITTEE_INDEX_URL);
    await page.waitForSelector('#cycle-index.visible', { timeout: 1200 });
    const elapsed = Date.now() - t0;
    expect(elapsed).toBeLessThan(1500);
    // cstat-history is entity-hydrated and present immediately on scaffold
    await expect(page.locator('#cstat-history')).toHaveText(/^\d{4}([–\-]\d{4})?$/);
    // Career raised/spent cells still skeletoned during the await window
    await expect(page.locator('#cstat-career-raised .skeleton')).toHaveCount(1);
    // After totals resolves, career cells hydrate
    await expect(page.locator('#cstat-career-raised .skeleton')).toHaveCount(0, { timeout: 3000 });
  });

  test('cycle-row click during /totals/ load shows stat skeletons until totals resolves, then hydrates', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Delay /totals/ — gives the test a window to click a cycle row before
    // ALL_TOTALS is populated.
    await page.route('**/api/fec/committee/*/totals/**', async (route) => {
      await new Promise(r => setTimeout(r, 1500));
      await route.fallback();
    });
    await page.goto(COMMITTEE_INDEX_URL);
    await page.waitForSelector('#cycle-index.visible', { timeout: 1200 });
    // Click a cycle row while totals is still pending
    await page.locator('a.cycle-row[href="#2024"]').click();
    // Detail view entered — summary-strip is visible, but renderStats short-
    // circuited via the empty-ALL_TOTALS guard. T-load-3 skeleton still
    // occupies #stat-raised.
    await page.waitForSelector('#summary-strip', { state: 'visible', timeout: 1000 });
    await expect(page.locator('#stat-raised .skeleton')).toHaveCount(1);
    // After totals resolves, the totalsP.then() populator re-fires renderStats
    // and the cell hydrates to a real value.
    await expect(page.locator('#stat-raised')).toHaveText(/\$/, { timeout: 3000 });
    await expect(page.locator('#stat-raised .skeleton')).toHaveCount(0);
  });

  test('detail-URL cold load still awaits totals before view.switchTo (no dashed stats)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Delay /totals/ — on the detail path init must still await totalsP, so
    // when summary-strip becomes visible, ALL_TOTALS is populated and
    // renderStats hydrates real values (not dashes from an empty array).
    await page.route('**/api/fec/committee/*/totals/**', async (route) => {
      await new Promise(r => setTimeout(r, 800));
      await route.fallback();
    });
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('#summary-strip', { state: 'visible', timeout: 3000 });
    // #stat-raised resolves to the mocked money value, not dashes from
    // empty ALL_TOTALS (which would indicate init didn't await on the detail path).
    await expect(page.locator('#stat-raised')).toHaveText(/\$/, { timeout: 2000 });
  });
});

// ── T-menu-btn-profile-header — profile menu-btn integration ─────────────────

test.describe('committee.html — profile menu-btn', () => {
  test('menu-btn is visible after committee-header reveal', async ({ page }) => {
    await setupDetail(page);
    const host = page.locator('#committee-menu-btn');
    await expect(host).toBeVisible();
    await expect(host.locator('.menu-btn')).toBeVisible();
  });

  test('menu-btn text label reads "Committee" (page-specific override)', async ({ page }) => {
    await setupDetail(page);
    const text = await page.locator('#committee-menu-btn .menu-btn-text').textContent();
    expect(text?.trim()).toBe('Committee');
  });

  test('dropdown has 3 items only — no Race, no Committees', async ({ page }) => {
    await setupDetail(page);
    await page.locator('#committee-menu-btn .menu-btn').click();
    const ids = await page.locator('#committee-menu-btn .menu-item').evaluateAll(
      nodes => nodes.map(n => n.dataset.itemId)
    );
    expect(ids).toEqual(['profile', 'compare', 'follow']);
    // Defensive: explicitly assert the absent items are absent
    await expect(page.locator('.menu-item[data-item-id="race"]')).toHaveCount(0);
    await expect(page.locator('.menu-item[data-item-id="committees"]')).toHaveCount(0);
  });

  test('Profile item is <button> with no href; enabled on detail view', async ({ page }) => {
    // Regression lock: Profile's destination is a view state of the current
    // page, not a navigation. It must render as <button> (onClick handler)
    // not <a href> — an href would trigger a full document reload instead
    // of the chevron's in-place view.switchTo path.
    await setupDetail(page);
    await page.locator('#committee-menu-btn .menu-btn').click();
    const profile = page.locator('.menu-item[data-item-id="profile"]');
    const tag = await profile.evaluate(el => el.tagName);
    expect(tag).toBe('BUTTON');
    const href = await profile.getAttribute('href');
    expect(href).toBeNull();
    const disabled = await profile.getAttribute('aria-disabled');
    expect(disabled).toBeNull();
  });

  test('Profile item triggers in-place view.switchTo (no full reload)', async ({ page }) => {
    // Regression lock for the menu-btn-arc follow-up: clicking Profile in
    // detail view must mirror the cycle-back-btn chevron — clear the hash
    // via history.replaceState + call view.switchTo(false, NaN) — NOT
    // navigate via <a href>. Sentinel survives an in-place swap and would
    // be wiped by a full document reload.
    await setupDetail(page);
    await page.evaluate(() => { window.__noReloadSentinel = 'kept'; });
    await page.locator('#committee-menu-btn .menu-btn').click();
    await page.locator('.menu-item[data-item-id="profile"]').click();
    await expect(page.locator('#cycle-index')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#content')).toBeHidden();
    expect(new URL(page.url()).hash).toBe('');
    const sentinel = await page.evaluate(() => window.__noReloadSentinel);
    expect(sentinel).toBe('kept');
  });

  test('Profile item is aria-disabled on index view (bare URL)', async ({ page }) => {
    await setupIndex(page);
    await page.locator('#committee-menu-btn .menu-btn').click();
    const profile = page.locator('.menu-item[data-item-id="profile"]');
    await expect(profile).toHaveAttribute('aria-disabled', 'true');
  });

  test('Compare item opens the info modal', async ({ page }) => {
    await setupDetail(page);
    await page.locator('#committee-menu-btn .menu-btn').click();
    await page.locator('.menu-item[data-item-id="compare"]').click();
    await expect(page.locator('#info-modal')).toBeVisible();
  });

  test('Follow item opens the info modal', async ({ page }) => {
    await setupDetail(page);
    await page.locator('#committee-menu-btn .menu-btn').click();
    await page.locator('.menu-item[data-item-id="follow"]').click();
    await expect(page.locator('#info-modal')).toBeVisible();
  });

  test('menu-btn is icon-only at ≤860px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#committee-menu-btn .menu-btn-text')).toHaveCount(0);
    await expect(page.locator('#committee-menu-btn .menu-btn-icon')).toHaveCount(1);
  });

  test('resize ≤860 → desktop preserves "Committee" label (setShowText re-reads config text)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto(COMMITTEE_DETAIL_URL);
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await expect(page.locator('#committee-menu-btn .menu-btn-text')).toHaveCount(0);
    await page.setViewportSize({ width: 1280, height: 800 });
    const text = await page.locator('#committee-menu-btn .menu-btn-text').textContent();
    expect(text?.trim()).toBe('Committee');
  });

  test('menu-btn stays visible in compact header', async ({ page }) => {
    await setupDetail(page);
    await page.evaluate(() => {
      document.getElementById('committee-header').classList.add('compact');
    });
    await expect(page.locator('#committee-menu-btn')).toBeVisible();
  });
});

// ── Phase 2 PAGE-NOTE — page-level data note on committee detail ──────────────
// Shipped 2026-05-29. Mirrors candidate.html: #page-note carries Source line +
// Coverage stamp + ≤$200 caveat at page level, Source-first ordering, FEC link
// to www.fec.gov. Lives inside #committee-content after #tab-spent.

test.describe('committee.html — Phase 2 PAGE-NOTE', () => {
  test.beforeEach(async ({ page }) => {
    await setupDetail(page);
  });

  test('#page-note exists and is visible on data-present cycle', async ({ page }) => {
    const pn = page.locator('#page-note');
    await expect(pn).toBeVisible();
  });

  test('#page-note carries Source line + Coverage stamp + ≤$200 caveat', async ({ page }) => {
    const pn = page.locator('#page-note');
    await expect(pn).toContainText('Source: FEC.');
    await expect(pn).toContainText('Coverage through');
    await expect(pn).toContainText('Individual contributions of $200 or less are not itemized.');
  });

  test('#page-note FEC link → fec.gov (consumer site)', async ({ page }) => {
    const link = page.locator('#page-note a[href="https://www.fec.gov/"]');
    await expect(link).toHaveText('FEC');
  });

  test('#page-note is OUTSIDE the three #tab-* panels', async ({ page }) => {
    const isOutsideTabs = await page.evaluate(() => {
      const note = document.getElementById('page-note');
      const summary = document.getElementById('tab-summary');
      const raised = document.getElementById('tab-raised');
      const spent = document.getElementById('tab-spent');
      return note && !summary.contains(note) && !raised.contains(note) && !spent.contains(note);
    });
    expect(isOutsideTabs).toBe(true);
  });

  test('#page-note retired strings are gone', async ({ page }) => {
    // K1.a / K1.c / K1.d all retired in Phase 2. The full sentence the old
    // #committee-meta-note carried should not appear in #page-note.
    const pn = page.locator('#page-note');
    await expect(pn).not.toContainText('Source: FEC — Committee ID');
    await expect(pn).not.toContainText('Data updated nightly by FEC');
  });
});
