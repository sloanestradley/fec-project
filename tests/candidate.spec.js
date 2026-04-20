/**
 * candidate.spec.js — Structural tests for candidate.html.
 *
 * Uses mocked FEC API (no real network) and mocked Amplitude.
 * Tests cover: profile header, cycle switcher, stats row, health banner,
 * chart canvas, tab navigation, committees modal, and Amplitude events.
 *
 * Test URL: /candidate.html?id=H2WA03217 (Marie Gluesenkamp Perez, WA-03)
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

const CANDIDATE_URL = '/candidate.html?id=H2WA03217';

// Shared setup: mock + load + wait for profile to render
async function setup(page) {
  await mockAmplitude(page);
  await mockFecApi(page);
  await page.goto(CANDIDATE_URL);
  await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
}

// Wait for content area (stats, chart)
async function setupWithContent(page) {
  await setup(page);
  await page.waitForSelector('#content.visible', { timeout: 12000 });
}

// ── Profile header ────────────────────────────────────────────────────────────

test.describe('candidate.html — profile header', () => {
  test('candidate name is displayed and not placeholder', async ({ page }) => {
    await setup(page);
    const name = page.locator('#candidate-name');
    await expect(name).not.toHaveText('—');
    const text = await name.textContent();
    expect(text?.trim().length).toBeGreaterThan(3);
  });

  test('party tag is visible in meta-row', async ({ page }) => {
    await setup(page);
    const metaRow = page.locator('#meta-row');
    await expect(metaRow).toBeVisible();
    const tags = metaRow.locator('.tag');
    await expect(tags).not.toHaveCount(0);
  });

  test('#race-label is present in the profile header', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#race-label')).toBeAttached();
  });

  test('#race-label contains a link to the race page', async ({ page }) => {
    await setup(page);
    const link = page.locator('#race-label a');
    await expect(link).toBeAttached();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/race\?state=/);
  });

  test('meta-row has no .tag-neutral race tag (race tag removed on redesign branch)', async ({ page }) => {
    await setup(page);
    // incumbent tag uses .tag-neutral too — check there's no non-incumbent .tag-neutral
    await expect(page.locator('#meta-row .tag-neutral:not(.incumbent-tag)')).toHaveCount(0);
  });

  test('race-context element is present in meta-row', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#race-context')).toBeAttached();
  });

  test('race-context renders tag-context with text span and view-race link', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#race-context .tag-context')).toBeAttached();
    await expect(page.locator('#race-context .tag-context .tag-context-text')).toBeAttached();
    await expect(page.locator('#race-context .tag-context a')).toBeAttached();
  });

  test('profile header sentinel exists for compact observer', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#profile-header-sentinel')).toBeAttached();
  });

  test('compact sep is inside profile header and hidden in full mode', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#profile-header .compact-sep')).toBeAttached();
    await expect(page.locator('#profile-header')).not.toHaveClass(/compact/);
  });

  test('scrolling down adds .compact to profile header', async ({ page }) => {
    await setupWithContent(page);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(200); // wait past suppressUntil (100ms)
    await expect(page.locator('#profile-header')).toHaveClass(/compact/);
  });

  test('scrolling back to top removes .compact from profile header', async ({ page }) => {
    await setupWithContent(page);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    await expect(page.locator('#profile-header')).not.toHaveClass(/compact/);
  });

  test('.main has paddingBottom set when compact is active', async ({ page }) => {
    await setupWithContent(page);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(200);
    const pb = await page.locator('.main').evaluate(el => el.style.paddingBottom);
    const val = parseInt(pb);
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThanOrEqual(80);
  });

  test('.main paddingBottom is cleared when compact disengages', async ({ page }) => {
    await setupWithContent(page);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const pb = await page.locator('.main').evaluate(el => el.style.paddingBottom);
    expect(pb).toBe('');
  });

  test('incumbent tag shown for incumbent candidate', async ({ page }) => {
    await setup(page);
    const tag = page.locator('#meta-row .incumbent-tag');
    await expect(tag).toBeVisible({ timeout: 5000 });
    await expect(tag).toHaveText('Incumbent');
  });

  test('cycle switcher renders as select with options', async ({ page }) => {
    await setup(page);
    const switcher = page.locator('select#cycle-switcher');
    await expect(switcher).toBeVisible();
    const options = switcher.locator('option');
    await expect(options).not.toHaveCount(0);
  });

  test('committees trigger shows count immediately', async ({ page }) => {
    await setup(page);
    // Committees are fetched eagerly at init — trigger shows count right away
    const trigger = page.locator('#committees-trigger');
    await expect(trigger).toBeVisible({ timeout: 8000 });
    const btn = trigger.locator('.committees-link');
    const text = await btn.textContent();
    // Should show "Committees (N) →" with a number
    expect(text).toMatch(/Committees\s*\(\d+\)/);
  });
});

// ── Stats row ────────────────────────────────────────────────────────────────

test.describe('candidate.html — stats row', () => {
  test('Total Raised shows a dollar amount (not $0 or placeholder)', async ({ page }) => {
    await setupWithContent(page);
    const raised = page.locator('#stat-raised');
    await expect(raised).not.toHaveText('—');
    const text = await raised.textContent();
    expect(text).toMatch(/\$[\d,.]+/);
    expect(text).not.toBe('$0');
  });

  test('Total Spent shows a dollar amount', async ({ page }) => {
    await setupWithContent(page);
    const spent = page.locator('#stat-spent');
    await expect(spent).not.toHaveText('—');
    const text = await spent.textContent();
    expect(text).toMatch(/\$[\d,.]+/);
  });

  test('Cash on Hand shows a dollar amount', async ({ page }) => {
    await setupWithContent(page);
    const coh = page.locator('#stat-coh');
    await expect(coh).not.toHaveText('—');
    const text = await coh.textContent();
    expect(text).toMatch(/\$[\d,.]+/);
  });

  test('Raised-to-Spent Ratio shows a value', async ({ page }) => {
    await setupWithContent(page);
    const ratio = page.locator('#stat-ratio');
    await expect(ratio).not.toHaveText('—');
    const text = await ratio.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });
});

// ── Health banner ─────────────────────────────────────────────────────────────

test.describe('candidate.html — health banner', () => {
  test('banner-label has content', async ({ page }) => {
    await setupWithContent(page);
    const label = page.locator('#banner-label');
    await expect(label).not.toHaveText('—');
  });

  test('banner-desc has content', async ({ page }) => {
    await setupWithContent(page);
    const desc = page.locator('#banner-desc');
    const text = await desc.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('summary-strip (banner + stats) persists across Summary/Raised/Spent tabs', async ({ page }) => {
    await setupWithContent(page);
    // Summary tab (default): both visible
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .banner')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
    // Raised tab
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .banner')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
    // Spent tab
    await page.locator('.tab').filter({ hasText: 'Spent' }).click();
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .banner')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
  });

  test('first stat card is Raised-to-Spent Ratio', async ({ page }) => {
    await setupWithContent(page);
    const firstLabel = page.locator('.stats-grid .stat-card').first().locator('.stat-label');
    await expect(firstLabel).toHaveText('Raised-to-Spent Ratio');
  });
});

// ── Chart ─────────────────────────────────────────────────────────────────────

test.describe('candidate.html — chart', () => {
  test('chart canvas is present', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#chart-timeline')).toBeVisible();
  });

  test('chart-legend items are present', async ({ page }) => {
    await setupWithContent(page);
    const legend = page.locator('.chart-legend .legend-item');
    await expect(legend).not.toHaveCount(0);
  });
});

// ── Tab navigation ────────────────────────────────────────────────────────────

test.describe('candidate.html — tab navigation', () => {
  test('three tabs are visible: Summary, Raised, Spent', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });
    const tabs = page.locator('.tabs-bar .tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText('Summary');
    await expect(tabs.nth(1)).toHaveText('Raised');
    await expect(tabs.nth(2)).toHaveText('Spent');
  });

  test('Summary tab is active by default', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });
    const summaryTab = page.locator('.tabs-bar .tab').filter({ hasText: 'Summary' });
    await expect(summaryTab).toHaveClass(/active/);
  });

  test('clicking Raised tab activates it', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    const raisedTab = page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' });
    await expect(raisedTab).toHaveClass(/active/);
  });
});

// ── Raised tab: geography heatmap + contributor table ────────────────────────

test.describe('candidate.html — Raised tab sections', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    // Wait for raised-content to become visible (data loaded + rendered)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('raised-content');
        return el && el.style.display !== 'none';
      },
      { timeout: 12000 }
    );
  });

  test('geography heatmap SVG renders inside map-container', async ({ page }) => {
    const svg = page.locator('#map-container svg');
    await expect(svg).toBeVisible();
  });

  test('top committee contributors table has at least one data row', async ({ page }) => {
    const rows = page.locator('#donors-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('top conduit sources table exists and renders the mocked memo row', async ({ page }) => {
    const card = page.locator('#conduits-card');
    await expect(card).toBeVisible();
    const rows = page.locator('#conduits-tbody tr');
    await expect(rows).not.toHaveCount(0);
    // The mock includes one ActBlue row with memo_code='X'; it must land in the conduit table
    await expect(page.locator('#conduits-tbody')).toContainText(/Actblue/i);
  });

  test('top individual contributors table renders with API-fallback data', async ({ page }) => {
    const tbody = page.locator('#individual-donors-tbody');
    await expect(tbody).toBeVisible();
    const rows = tbody.locator('tr');
    await expect(rows).not.toHaveCount(0);
    // Mock aggregations endpoint always misses, so the fallback fetches
    // SCHEDULE_A_INDIVIDUALS — Smith and Doe should land in the table.
    await expect(tbody).toContainText(/Smith, John/i);
  });

  test('raised breakdown cell title reads "Raised breakdown"', async ({ page }) => {
    await expect(page.locator('.raised-cell-title').first()).toHaveText('Raised breakdown');
  });
});

// ── Committees modal ──────────────────────────────────────────────────────────

test.describe('candidate.html — committees modal', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#committees-trigger', { timeout: 10000 });
    await page.locator('.committees-link').click();
    // Modal opens by setting display:flex on #committees-modal
    await page.waitForFunction(
      () => {
        const el = document.getElementById('committees-modal');
        return el && el.style.display === 'flex';
      },
      { timeout: 5000 }
    );
  });

  test('modal is visible after clicking trigger', async ({ page }) => {
    const modal = page.locator('#committees-modal');
    await expect(modal).toBeVisible();
  });

  test('modal has Active tab button', async ({ page }) => {
    const activeTab = page.locator('.modal-tab-btn').filter({ hasText: 'Active' });
    await expect(activeTab).toBeVisible();
  });

  test('modal history tab is labeled "Terminated" not "History"', async ({ page }) => {
    const btn = page.locator('#modal-history-tab-btn');
    await expect(btn).toBeAttached();
    const text = await btn.textContent();
    expect(text).toContain('Terminated');
    expect(text).not.toContain('History');
  });

  test('committee rows are present', async ({ page }) => {
    // Rows are rendered as .committee-row or inside the modal body
    const body = page.locator('.modal-body');
    await expect(body).toBeVisible();
    const content = await body.textContent();
    // Should have committee name content (not empty)
    expect(content?.trim().length).toBeGreaterThan(5);
  });

  test('modal closes on Escape key', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('committees-modal');
        return el && el.style.display === 'none';
      },
      { timeout: 3000 }
    );
    const modal = page.locator('#committees-modal');
    await expect(modal).not.toBeVisible();
  });
});

// ── URL hash pre-selection ────────────────────────────────────────────────────

test.describe('candidate.html — URL hash pre-selection', () => {
  test('hash #2022#raised pre-selects Raised tab', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2022#raised');
    await page.waitForSelector('#tabs-bar', { timeout: 12000 });
    const raisedTab = page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' });
    await expect(raisedTab).toHaveClass(/active/);
  });
});

// ── Amplitude events ──────────────────────────────────────────────────────────

test.describe('candidate.html — Amplitude events', () => {
  test('Page Viewed fires with page property', async ({ page }) => {
    await setup(page);
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    const props = event.args[1];
    expect(props).toMatchObject({ page: expect.any(String) });
  });

  test('Tab Switched fires on tab click (not on page init)', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });

    // Confirm it hasn't fired yet
    let event = await findTrackEvent(page, 'Tab Switched');
    expect(event).toBeUndefined();

    // Click a tab
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();

    event = await findTrackEvent(page, 'Tab Switched');
    expect(event).toBeDefined();
  });

  test('Committees Modal Opened fires on trigger click', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#committees-trigger', { timeout: 8000 });
    await page.locator('.committees-link').click();
    const event = await findTrackEvent(page, 'Committees Modal Opened');
    expect(event).toBeDefined();
  });
});

// ── Nav active state ──────────────────────────────────────────────────────────

test.describe('candidate.html — nav active state', () => {
  test('"Candidates" nav item is active (profile activates parent browse)', async ({ page }) => {
    await setup(page);
    const activeItem = page.locator('.top-nav .nav-link.active');
    const text = await activeItem.first().textContent();
    expect(text?.trim()).toContain('Candidates');
  });
});

// ── API correctness ───────────────────────────────────────────────────────────

test.describe('candidate.html — API correctness', () => {
  test('no 422 errors (office param check)', async ({ page }) => {
    const errors422 = [];
    page.on('response', res => {
      if (res.url().includes('/api/fec/') && res.status() === 422) {
        errors422.push(res.url());
      }
    });
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForLoadState('networkidle');
    expect(errors422).toHaveLength(0);
  });
});
