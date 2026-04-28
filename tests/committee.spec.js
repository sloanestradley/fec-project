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

  test('"Committees" nav item is active (profile activates parent)', async ({ page }) => {
    const active = page.locator('.top-nav .nav-link.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Committees');
  });

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

  test('Active since prose renders with year for active committee', async ({ page }) => {
    const prose = page.locator('#meta-row .meta-prose');
    await expect(prose).toBeVisible();
    await expect(prose).toHaveText(/Active since 2020/);
  });

  test('meta-row is a sibling of .profile-header-row, not a child', async ({ page }) => {
    await expect(page.locator('.profile-header-row #meta-row')).toHaveCount(0);
    await expect(page.locator('#committee-header > #meta-row')).toHaveCount(1);
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

  test('committees link is present in nav', async ({ page }) => {
    const backLink = page.locator('.top-nav a[href*="committees"]').first();
    await expect(backLink).toBeAttached();
  });

  test('committee content area is present', async ({ page }) => {
    const content = page.locator('.profile-content');
    await expect(content).toBeAttached();
  });

  test('tabs bar is present and visible after load', async ({ page }) => {
    await expect(page.locator('#tabs-bar')).toBeVisible();
  });

  test('three tabs are present: Summary, Raised, Spent', async ({ page }) => {
    const tabs = page.locator('.tabs-bar .tab');
    await expect(tabs).toHaveCount(3);
  });

  test('Summary tab is active by default', async ({ page }) => {
    await expect(page.locator('.tab').filter({ hasText: 'Summary' })).toHaveClass(/active/);
  });

  test('clicking Raised tab activates it and shows #tab-raised', async ({ page }) => {
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('.tab').filter({ hasText: 'Raised' })).toHaveClass(/active/);
    await expect(page.locator('#tab-raised')).toBeVisible();
    await expect(page.locator('#tab-summary')).toBeHidden();
  });

  test('clicking Spent tab activates it and shows #tab-spent', async ({ page }) => {
    await page.locator('.tab').filter({ hasText: 'Spent' }).click();
    await expect(page.locator('#tab-spent')).toBeVisible();
    await expect(page.locator('#tab-summary')).toBeHidden();
  });

  test('summary-strip stats persist across Summary/Raised/Spent tabs', async ({ page }) => {
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
    await page.locator('.tab').filter({ hasText: 'Spent' }).click();
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
  });

  test('first stat card is Coverage Through', async ({ page }) => {
    const firstLabel = page.locator('#summary-strip .stats-grid .stat-card').first().locator('.stat-label');
    await expect(firstLabel).toHaveText('Coverage Through');
  });

  test('cycle switcher is present inside .tabs-bar', async ({ page }) => {
    await expect(page.locator('.tabs-bar #cycle-switcher')).toBeAttached();
  });

  test('cycle switcher has at least one numeric cycle option', async ({ page }) => {
    await expect(page.locator('#cycle-switcher option')).not.toHaveCount(0);
  });

  test('cycle switcher has only numeric options (no "All time")', async ({ page }) => {
    await expect(page.locator('#cycle-switcher option[value="all"]')).toHaveCount(0);
    const options = page.locator('#cycle-switcher option');
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const value = await options.nth(i).getAttribute('value');
      expect(value).toMatch(/^\d{4}$/);
    }
  });

  test('cycle switcher value matches URL hash on detail view', async ({ page }) => {
    await expect(page.locator('#cycle-switcher')).toHaveValue('2024');
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

  test('URL hash updates when cycle switcher changes', async ({ page }) => {
    await page.locator('#cycle-switcher').selectOption('2022');
    await expect(page).toHaveURL(/#2022#summary/);
  });

  test('URL hash updates when tab changes', async ({ page }) => {
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    await expect(page).toHaveURL(/#\d{4}#raised/);
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

  test('summary-strip and tabs-bar are visible in detail view', async ({ page }) => {
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#tabs-bar')).toBeVisible();
  });
});

// ── Index view: landing state ────────────────────────────────────────────────

test.describe('committee.html — index view landing state', () => {
  test.beforeEach(async ({ page }) => { await setupIndex(page); });

  test('bare URL renders #career-strip and #cycle-index', async ({ page }) => {
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#cycle-index')).toBeVisible();
  });

  test('detail-view elements (#summary-strip, #tabs-bar, #committee-content) are hidden in index view', async ({ page }) => {
    await expect(page.locator('#summary-strip')).toBeHidden();
    await expect(page.locator('#tabs-bar')).toBeHidden();
    await expect(page.locator('#committee-content')).toBeHidden();
  });

  test('#cycles hash also renders index view (NaN routing)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668#cycles');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#summary-strip')).toBeHidden();
  });

  test('CareerStrip has 4 cells with expected labels', async ({ page }) => {
    const labels = page.locator('#career-strip .stat-label');
    await expect(labels).toHaveCount(4);
    await expect(labels.nth(0)).toHaveText('First Filed');
    await expect(labels.nth(1)).toHaveText('Last Activity');
    await expect(labels.nth(2)).toHaveText('Lifetime Raised');
    await expect(labels.nth(3)).toHaveText('Lifetime Spent');
  });

  test('First Filed cell shows year derived from first_file_date', async ({ page }) => {
    await expect(page.locator('#cstat-first-filed')).toHaveText('2020');
  });

  test('Last Activity cell shows year + sub-date from last_file_date', async ({ page }) => {
    await expect(page.locator('#cstat-last-activity')).toHaveText('2026');
    const sub = await page.locator('#cstat-last-activity-sub').textContent();
    expect(sub?.trim().length).toBeGreaterThan(0);
  });

  test('Lifetime Raised matches summed receipts across all COMMITTEE_TOTALS rows', async ({ page }) => {
    // Mock totals: 2026=1.8M + 2024=3.7M + 2022=2.1M = $7.6M
    const text = await page.locator('#cstat-career-raised').textContent();
    expect(text?.trim()).toBe('$7.6M');
  });

  test('Lifetime Spent matches summed disbursements with % of raised sub-label', async ({ page }) => {
    // Mock totals: 2026=600k + 2024=3.1M + 2022=1.95M = $5.65M; fmt() rounds to $5.7M
    const text = await page.locator('#cstat-career-spent').textContent();
    expect(text?.trim()).toBe('$5.7M');
    // 5.65M / 7.6M = ~74%
    const sub = await page.locator('#cstat-career-spent-sub').textContent();
    expect(sub?.trim()).toMatch(/^\d{1,3}% of raised$/);
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

  test('clicking a cycle row navigates to #{year}#summary and renders detail view', async ({ page }) => {
    // Bare URL goto first — beforeEach already did, but assert state
    await expect(page).toHaveURL(/\/committee\.html\?id=C00775668$/);
    // Click the 2024 row (second row, index 1) — fires hashchange, listener reloads
    await page.locator('#cycle-index a.cycle-row').nth(1).click();
    await expect(page).toHaveURL(/#2024#summary/);
    // After full-page reload, detail view should render (summary-strip visible, career-strip hidden)
    await page.waitForSelector('#summary-strip.visible', { timeout: 12000 });
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#career-strip')).toBeHidden();
    await expect(page.locator('#cycle-switcher')).toHaveValue('2024');
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

  test('archive divider precedes archive rows with threshold copy', async ({ page }) => {
    const divider = page.locator('#cycle-index .cycle-archive-divider');
    await expect(divider).toHaveCount(1);
    const text = await divider.textContent();
    expect(text).toContain('FEC coverage begins 2008');
    // No office reference for committees (vs candidate.html "for House races")
    expect(text).not.toContain('for House');
    expect(text).not.toContain('for Senate');
    expect(text).not.toContain('for Presidential');
  });

  test('post-2008 cycles render as navigable a.cycle-row', async ({ page }) => {
    await expect(page.locator('#cycle-index a.cycle-row[href="#2024#summary"]')).toHaveCount(1);
  });
});

// ── All-time removal regressions ─────────────────────────────────────────────

test.describe('committee.html — All-time removal regressions', () => {
  test('cycle switcher contains zero options with value="all" or text "All time"', async ({ page }) => {
    await setupDetail(page);
    await expect(page.locator('#cycle-switcher option[value="all"]')).toHaveCount(0);
    const options = page.locator('#cycle-switcher option');
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      const text = await options.nth(i).textContent();
      expect(text?.trim()).not.toBe('All time');
    }
  });

  test('old #all#summary bookmarks land on the index view (NaN fallthrough)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668#all#summary');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#summary-strip')).toBeHidden();
  });

  test('renderStats does not produce "All cycles" copy on detail view', async ({ page }) => {
    await setupDetail(page);
    await expect(page.locator('#stat-raised-sub')).not.toHaveText('All cycles');
    await expect(page.locator('#stat-spent-sub')).not.toHaveText('All cycles');
  });

  test('data note does not contain "All-cycle aggregate" copy', async ({ page }) => {
    await setupDetail(page);
    const note = await page.locator('#committee-meta-note').textContent();
    expect(note).not.toContain('All-cycle aggregate');
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

  test('Active since prose is omitted when filing_frequency is T', async ({ page }) => {
    await expect(page.locator('#meta-row .meta-prose')).toHaveCount(0);
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
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    await page.waitForFunction(
      () => {
        const el = document.getElementById('raised-content');
        return el && el.style.display !== 'none';
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

  test('donut legend renders "Candidate contributions & loans" segment with tooltip', async ({ page }) => {
    const row = page.locator('#donut-legend .donut-row', {
      has: page.locator('.donut-lbl', { hasText: 'Candidate contributions & loans' }),
    });
    await expect(row).toHaveCount(1);
    const info = row.locator('.donut-info');
    await expect(info).toHaveCount(1);
    await expect(info).toHaveAttribute(
      'title',
      'Direct contributions and loans from the candidate to this committee. Contributions are gifts; loans create a debt the committee owes back to the candidate.'
    );
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
    await expect(page.locator('#conduits-card')).toBeVisible();
    const rows = page.locator('#conduits-tbody tr');
    await expect(rows).not.toHaveCount(0);
    await expect(page.locator('#conduits-tbody')).toContainText(/Actblue/i);
  });

  test('Top Individual Contributors card header includes cycle label (no "Most recent cycle" copy)', async ({ page }) => {
    const head = page.locator('#individual-donors-tbody').locator('xpath=ancestor::div[contains(@class,"donors-card")]').locator('.donors-head');
    // Wait for the dynamic header update — it lands AFTER raised-content becomes visible
    // because renderRaisedIfReady continues writing to the DOM after revealing contentEl.
    await expect(head).toHaveText(/Top Individual Contributors · 20\d\d–20\d\d/, { timeout: 15000 });
    const text = await head.textContent();
    expect(text).not.toContain('Most recent cycle');
  });
});

// ── Raised tab: unavailable-state copy ───────────────────────────────────────

test.describe('committee.html — Raised tab unavailable-state copy', () => {
  test('individual contributors tbody shows "Unable to show due to high transaction volume." when Schedule A is over the page threshold', async ({ page }) => {
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
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    await page.waitForFunction(
      () => { const el = document.getElementById('raised-content'); return el && el.style.display !== 'none'; },
      { timeout: 15000 }
    );

    const tbody = page.locator('#individual-donors-tbody');
    await expect(tbody).toContainText('Unable to show due to high transaction volume.');
  });
});

// ── Spent tab sections ───────────────────────────────────────────────────────

test.describe('committee.html — Spent tab sections', () => {
  test.beforeEach(async ({ page }) => {
    await setupDetail(page);
    await page.locator('.tab').filter({ hasText: 'Spent' }).click();
    await page.waitForFunction(
      () => { const el = document.getElementById('spent-content'); return el && el.style.display !== 'none'; },
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

  test('contributions-section is visible (mock has CCM record)', async ({ page }) => {
    await expect(page.locator('#contributions-section')).toBeVisible();
  });

  test('contributions-tbody has at least one row', async ({ page }) => {
    const rows = page.locator('#contributions-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('vendors header shows cycle range (no "All time" label)', async ({ page }) => {
    const head = page.locator('#vendors-head');
    const text = await head.textContent();
    expect(text).toMatch(/Top Vendors · 20\d\d–20\d\d/);
    expect(text).not.toContain('All time');
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
