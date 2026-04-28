/**
 * candidate.spec.js — Structural tests for candidate.html.
 *
 * Uses mocked FEC API (no real network) and mocked Amplitude.
 * Tests cover: profile header, cycle switcher, stats row, health banner,
 * chart canvas, tab navigation, committees modal, and Amplitude events.
 *
 * Test URL: /candidate.html?id=H2WA03217#2024#summary (detail view; bare URL → index view)
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

// Hash required to land in detail view (bare URL now shows index view — T5/T6 CareerStrip)
const CANDIDATE_URL = '/candidate.html?id=H2WA03217#2024#summary';

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
    // incumbent tag and fec-id tag use .tag-neutral too — check there's no other .tag-neutral (e.g. a re-introduced race tag)
    await expect(page.locator('#meta-row .tag-neutral:not(.incumbent-tag):not(.fec-id-tag)')).toHaveCount(0);
  });

  test('FEC ID tag renders with candidate ID text', async ({ page }) => {
    await setup(page);
    const fec = page.locator('#meta-row .fec-id-tag');
    await expect(fec).toBeVisible();
    await expect(fec).toHaveText(/FEC ID · H2WA03217/);
  });

  test('First filed prose span renders with year', async ({ page }) => {
    await setup(page);
    const prose = page.locator('#meta-row .meta-prose');
    await expect(prose).toBeVisible();
    await expect(prose).toHaveText(/First filed 2022/);
  });

  test('meta-row is a sibling of .profile-header-row, not a child', async ({ page }) => {
    await setup(page);
    await expect(page.locator('.profile-header-row #meta-row')).toHaveCount(0);
    await expect(page.locator('#profile-header > #meta-row')).toHaveCount(1);
  });

  test('meta-row children render in canonical order: party → incumbent → FEC ID → First filed', async ({ page }) => {
    await setup(page);
    // MGP is the incumbent in the mock fixture; all four children should be present.
    const roles = await page.locator('#meta-row > *').evaluateAll(nodes => nodes.map(n => {
      if (n.classList.contains('tag-dem') || n.classList.contains('tag-rep') || n.classList.contains('tag-ind')) return 'party';
      if (n.classList.contains('incumbent-tag')) return 'incumbent';
      if (n.classList.contains('fec-id-tag')) return 'fec-id';
      if (n.classList.contains('meta-prose')) return 'first-filed';
      return 'other:' + n.className;
    }));
    expect(roles).toEqual(['party', 'incumbent', 'fec-id', 'first-filed']);
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
    const firstLabel = page.locator('#summary-strip .stats-grid .stat-card').first().locator('.stat-label');
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

  test('does not call /reporting-dates/ or /election-dates/', async ({ page }) => {
    const forbidden = [];
    page.on('request', req => {
      const url = req.url();
      if (/\/reporting-dates\//.test(url) || /\/election-dates\//.test(url)) {
        forbidden.push(url);
      }
    });
    await setupWithContent(page);
    expect(forbidden).toHaveLength(0);
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

  test('Page Viewed fires with view: detail when URL has cycle hash', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('.tabs-bar.visible', { timeout: 12000 });
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ view: 'detail' });
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

// ── Landing state — index view (T5/T6) ───────────────────────────────────────

test.describe('candidate.html — landing state (index view)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217'); // bare URL → index view
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
  });

  test('bare URL renders CareerStrip and cycle index, not tabs-bar or summary-strip', async ({ page }) => {
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#cycle-index')).toBeVisible();
    await expect(page.locator('#tabs-bar')).not.toBeVisible();
    await expect(page.locator('#summary-strip')).not.toBeVisible();
  });

  test('#cycles hash also renders index view', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#cycles');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#cycle-index')).toBeVisible();
    await expect(page.locator('#tabs-bar')).not.toBeVisible();
  });

  test('CareerStrip renders four cells with expected labels', async ({ page }) => {
    const labels = await page.locator('#career-strip .stat-label').allTextContents();
    expect(labels).toContain('First Filed');
    expect(labels).toContain('Last Activity');
    expect(labels).toContain('Career Raised');
    expect(labels).toContain('Career Spent');
  });

  test('CareerStrip First Filed cell shows a year', async ({ page }) => {
    const val = await page.locator('#cstat-first-filed').textContent();
    expect(val?.trim()).toMatch(/^\d{4}$/);
  });

  test('cycle index renders one row per cycle from /history/ fixture', async ({ page }) => {
    // CANDIDATE_HISTORY fixture has cycles: [2022, 2024] → 2 navigable rows
    const rows = page.locator('#cycle-index a.cycle-row');
    await expect(rows).toHaveCount(2);
  });

  test('Page Viewed fires with view: index', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ view: 'index' });
  });

  test('clicking a cycle row navigates to #{year}#summary URL', async ({ page }) => {
    const row = page.locator('#cycle-index a.cycle-row').first();
    const href = await row.getAttribute('href');
    expect(href).toMatch(/#\d{4}#summary/);
  });

  test('cycle row labels contain a year range with en-dash', async ({ page }) => {
    const label = await page.locator('#cycle-index a.cycle-row .cycle-row-label').first().textContent();
    expect(label?.trim()).toMatch(/^\d{4}[\u2013\-]\d{4}$/);
  });

  test('#committees-trigger is visible in index view', async ({ page }) => {
    await expect(page.locator('#committees-trigger')).toBeVisible();
  });
});

// ── Landing state regression — detail view unchanged ─────────────────────────

test.describe('candidate.html — landing state regression (detail view unchanged)', () => {
  test('#{year}#{tab} URL renders detail view, not index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('.tabs-bar.visible', { timeout: 12000 });
    // Positive assertion: detail-view elements are visible (proves the detail path ran)
    await expect(page.locator('#tabs-bar')).toBeVisible();
    await expect(page.locator('#summary-strip')).toBeVisible();
    // Negative assertions: index-view elements are absent
    await expect(page.locator('#career-strip')).not.toBeVisible();
    await expect(page.locator('#cycle-index')).not.toBeVisible();
  });
});

// ── Archive threshold — House pre-2008 ────────────────────────────────────────

test.describe('candidate.html — archive threshold (House pre-2008)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Override /history/ to include a pre-2008 cycle
    await page.route('**/api/fec/candidate/**history**', route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            candidate_id: 'H2WA03217',
            cycles: [2024, 2006],
            first_file_date: '2004-01-01',
            last_file_date: '2024-10-15',
          }],
          pagination: { count: 1 },
        }),
      });
    });
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
  });

  test('pre-threshold rows render as non-navigable divs (not anchors)', async ({ page }) => {
    // 2006 < 2008 House threshold → archive row; 2024 ≥ 2008 → navigable anchor
    const archiveRows = page.locator('#cycle-index div.cycle-row--archive');
    await expect(archiveRows).toHaveCount(1);
    const anchors = page.locator('#cycle-index a.cycle-row');
    await expect(anchors).toHaveCount(1); // only 2024
  });

  test('archive rows are not keyboard-focusable (tabindex=-1)', async ({ page }) => {
    const archiveRow = page.locator('#cycle-index div.cycle-row--archive').first();
    await expect(archiveRow).toHaveAttribute('tabindex', '-1');
  });

  test('archive divider is present before archive rows', async ({ page }) => {
    const divider = page.locator('#cycle-index .cycle-archive-divider');
    await expect(divider).toBeVisible();
    const text = await divider.textContent();
    expect(text).toContain('2008');
    expect(text).toContain('House');
  });
});

// ── In-place transitions — index ↔ detail ─────────────────────────────────────

test.describe('candidate.html — in-place transitions', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
  });

  test('no page reload on cycle row click', async ({ page }) => {
    await page.evaluate(() => { document.body.dataset.loadId = '1'; });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    const loadId = await page.evaluate(() => document.body.dataset.loadId);
    expect(loadId).toBe('1');
  });

  test('#profile-header is the same DOM node after index → detail transition', async ({ page }) => {
    await page.evaluate(() => { document.getElementById('profile-header').dataset.mark = 'x'; });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    const mark = await page.evaluate(() => document.getElementById('profile-header').dataset.mark);
    expect(mark).toBe('x');
  });

  test('index view elements hidden after transition to detail', async ({ page }) => {
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).not.toBeVisible();
    await expect(page.locator('#cycle-index')).not.toBeVisible();
  });

  test('back button returns to index view', async ({ page }) => {
    // No pre-scroll — indexScrollY=0, so compact should NOT be active after back
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#tabs-bar')).not.toBeVisible();
    await expect(page.locator('#profile-header')).not.toHaveClass(/compact/);
  });

  test('back button → index re-engages compact when restored scroll is past threshold', async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 500); // past compact threshold
    });
    // Wait for compact to engage before clicking
    await expect(page.locator('#profile-header')).toHaveClass(/compact/, { timeout: 3000 });
    // Use hash navigation via evaluate — Playwright's click() would scroll the element
    // into view first, resetting window.scrollY before switchView() can read it.
    await page.evaluate(() => { window.location.hash = '#2024#summary'; });
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    // indexScrollY was 500 (past threshold) — compact should re-engage
    await expect(page.locator('#profile-header')).toHaveClass(/compact/, { timeout: 3000 });
  });

  test('back button → index does not re-fetch history or all-totals', async ({ page }) => {
    let historyRequests = 0;
    let allTotalsRequests = 0;
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/history/')) historyRequests++;
      if (url.includes('/totals/') && url.includes('per_page=100')) allTotalsRequests++;
    });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    expect(historyRequests).toBe(0);
    expect(allTotalsRequests).toBe(0);
  });

  test('index → detail scroll: compact-engaged index enters detail at compact threshold', async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 500); // well past any reasonable compact threshold
    });
    // Use hash navigation via evaluate — Playwright's click() would scroll the element
    // into view first, resetting window.scrollY before switchView() can read it.
    await page.evaluate(() => { window.location.hash = '#2024#summary'; });
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    const threshold = await page.evaluate(() => window.compactThreshold);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThanOrEqual(Math.max(0, threshold - 2));
    expect(scrollY).toBeLessThanOrEqual(threshold + 10);
    await expect(page.locator('#profile-header')).toHaveClass(/compact/);
  });

  test('index → detail scroll: non-compact index enters detail at scrollY 0', async ({ page }) => {
    // No scroll before click — index is not compact
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThanOrEqual(5);
    await expect(page.locator('#profile-header')).not.toHaveClass(/compact/);
  });

  test('compact header engages on index view (no prior detail visit required)', async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 400);
    });
    await expect(page.locator('#profile-header')).toHaveClass(/compact/, { timeout: 3000 });
  });

  test('fetch race condition: last-clicked cycle wins', async ({ page }) => {
    // Override cycle-specific totals: delay 2024 by 500ms, fulfill 2022 immediately.
    // Other totals requests (per_page=100 all-totals already cached from beforeEach) fall through.
    await page.route('**/api/fec/candidate/**totals**', async route => {
      const url = route.request().url();
      if (url.includes('cycle=2024')) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ results: [{ receipts: 2400000, disbursements: 2100000, last_cash_on_hand_end_period: 300000, coverage_end_date: '2024-12-31T00:00:00', cycle: 2024 }], pagination: { count: 1 } }),
        });
      } else if (url.includes('cycle=2022')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ results: [{ receipts: 2200000, disbursements: 1900000, last_cash_on_hand_end_period: 310000, coverage_end_date: '2022-12-31T00:00:00', cycle: 2022 }], pagination: { count: 1 } }),
        });
      } else {
        await route.fallback();
      }
    });
    // Trigger 2024 then immediately 2022 — the 500ms delay on 2024's totals fetch means
    // 2022 resolves first; the fetch-race token ensures 2024's stale response is discarded.
    await page.evaluate(() => { window.location.hash = '#2024#summary'; });
    await page.evaluate(() => { window.location.hash = '#2022#summary'; });
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    await page.waitForFunction(
      () => { const el = document.getElementById('stat-raised'); return el && el.textContent !== '—'; },
      { timeout: 12000 }
    );
    const raisedText = await page.locator('#stat-raised').textContent();
    expect(raisedText).toContain('2.2');    // 2022 data: $2.2M
    expect(raisedText).not.toContain('2.4'); // not 2024 stale data: $2.4M
  });
});

// ── Path-segment URL ID extraction (regression: trailing slash) ──────────────

test.describe('candidate.html — path-segment URL ID extraction', () => {
  // /candidate/{id} and /candidate/{id}/ both serve candidate.html via the
  // Cloudflare Pages Function at functions/candidate/[[catchall]].js. ID
  // extraction uses .split('/').filter(Boolean) (fix from T5/T6 era; same
  // pattern now mirrored to committee.html). Route-intercept here mirrors
  // what the production Function does, since Playwright's webServer is
  // python3 -m http.server (no Pages Function support).
  async function routeCandidatePath(page) {
    await page.route(/\/candidate\/[A-Z0-9]+\/?$/i, async route => {
      const response = await page.context().request.get('http://localhost:8080/candidate.html');
      const body = await response.text();
      await route.fulfill({ status: 200, contentType: 'text/html', body });
    });
  }

  test('/candidate/{id} (no trailing slash) extracts ID and renders index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await routeCandidatePath(page);
    await page.goto('/candidate/H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    const fecIdTag = await page.locator('.fec-id-tag').textContent();
    expect(fecIdTag).toContain('H2WA03217');
  });

  test('/candidate/{id}/ (trailing slash) extracts ID and renders index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await routeCandidatePath(page);
    await page.goto('/candidate/H2WA03217/');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    const fecIdTag = await page.locator('.fec-id-tag').textContent();
    expect(fecIdTag).toContain('H2WA03217');
    const stateMsg = page.locator('#state-msg');
    await expect(stateMsg).not.toBeVisible();
  });
});
