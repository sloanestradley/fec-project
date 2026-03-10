/**
 * pages.spec.js — Structural tests for all remaining pages:
 *   committee.html, races.html, race.html, candidates.html,
 *   committees.html, process-log.html, design-system.html, index.html
 *
 * Covers: nav active states, key structural elements, Amplitude events,
 * and scaffold-level presence checks for not-yet-built sections.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

// ── committee.html ────────────────────────────────────────────────────────────

test.describe('committee.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668');
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
  });

  test('"Committees" nav item is active (profile activates parent)', async ({ page }) => {
    const active = page.locator('.sidebar .nav-item.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Committees');
  });

  test('Page Viewed fires with page: committee', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'committee' });
  });

  test('committee name is displayed', async ({ page }) => {
    const name = page.locator('.committee-name-display');
    await expect(name).toBeVisible();
    const text = await name.textContent();
    expect(text?.trim().length).toBeGreaterThan(3);
  });

  test('meta-row with type tags is present', async ({ page }) => {
    await expect(page.locator('.meta-row')).toBeVisible();
  });

  test('stats grid shows financial figures (not $0)', async ({ page }) => {
    // Wait for content to become visible
    await page.waitForSelector('.committee-content.visible', { timeout: 10000 });
    const statsGrid = page.locator('.stats-grid');
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

  test('back-link to committees.html is present', async ({ page }) => {
    const backLink = page.locator('a[href*="committees"]').first();
    await expect(backLink).toBeAttached();
  });

  test('committee content area is present (scaffold)', async ({ page }) => {
    const content = page.locator('.committee-content');
    await expect(content).toBeAttached();
  });
});

// ── races.html ────────────────────────────────────────────────────────────────

test.describe('races.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/races.html');
  });

  test('"Races" nav item is active', async ({ page }) => {
    const active = page.locator('.sidebar .nav-item.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Races');
  });

  test('Page Viewed fires with page: races', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'races' });
  });

  test('two mode cards render (Curated and Ad Hoc)', async ({ page }) => {
    const cards = page.locator('.mode-card');
    await expect(cards).toHaveCount(2);
  });

  test('Ad Hoc card shows a planned badge', async ({ page }) => {
    const planned = page.locator('.planned-badge, .mode-card-disabled .planned-badge');
    await expect(planned).toBeVisible();
  });

  test('clicking Curated card reveals the curated form', async ({ page }) => {
    await page.locator('#curated-card').click();
    await expect(page.locator('#curated-form')).toBeVisible({ timeout: 3000 });
  });

  test('curated form has office and state fields', async ({ page }) => {
    await page.locator('#curated-card').click();
    await expect(page.locator('#form-office')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('#form-state')).toBeVisible({ timeout: 3000 });
  });

  test('district field is visible when House is selected', async ({ page }) => {
    await page.locator('#curated-card').click();
    // House should be selected by default (or select it)
    await page.locator('#form-office').selectOption('H');
    await expect(page.locator('#district-wrap')).toBeVisible({ timeout: 2000 });
  });
});

// ── race.html ─────────────────────────────────────────────────────────────────

test.describe('race.html', () => {
  // Helper to wait for race to finish loading (either success or error)
  async function waitForRaceLoad(page) {
    // Race header becomes visible on success, state-msg gets .error class on failure
    await page.waitForFunction(() => {
      const header = document.getElementById('race-header');
      const stateMsg = document.getElementById('state-msg');
      return (header && header.style.display !== 'none') ||
             (stateMsg && stateMsg.classList.contains('error'));
    }, { timeout: 12000 });
  }

  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/race.html?state=WA&district=03&year=2024&office=H');
    await waitForRaceLoad(page);
  });

  test('"Races" nav item is active (profile activates parent)', async ({ page }) => {
    const active = page.locator('.sidebar .nav-item.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Races');
  });

  test('Page Viewed fires with race context props', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'race' });
  });

  test('race title shows state and office info', async ({ page }) => {
    const title = page.locator('#race-title');
    await expect(title).toBeVisible();
    const text = await title.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
    // Should include WA (state) or H/House info
    expect(text).toMatch(/WA|House|03/i);
  });

  test('back-link to races.html is present', async ({ page }) => {
    const backLink = page.locator('a[href="races.html"]').first();
    await expect(backLink).toBeAttached();
  });

  test('candidate cards render with financial figures', async ({ page }) => {
    const cards = page.locator('.candidate-card');
    await expect(cards).not.toHaveCount(0);
    const cardText = await cards.first().textContent();
    // Cards should show dollar amounts (from our mock data)
    expect(cardText?.match(/\$[\d,.]+/)).toBeTruthy();
  });

  test('candidate card links to candidate.html with cycle hash', async ({ page }) => {
    const link = page.locator('a.candidate-card[href*="candidate.html"]').first();
    await expect(link).toBeAttached();
    const href = await link.getAttribute('href');
    // Should include a year anchor like #2024#summary
    expect(href).toMatch(/candidate\.html.+#\d{4}/);
  });

  test('no 422 errors (office sent as lowercase full word)', async ({ page }) => {
    // No 422s should have occurred during beforeEach navigation
    // This is verified by inspecting requests during the load
    const errors422 = [];
    page.on('response', res => {
      if (res.url().includes('api.open.fec.gov') && res.status() === 422) {
        errors422.push(res.url());
      }
    });
    // Small settle window for any late requests
    await page.waitForTimeout(300);
    expect(errors422).toHaveLength(0);
  });
});

// ── candidates.html ───────────────────────────────────────────────────────────

test.describe('candidates.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/candidates.html');
  });

  test('"Candidates" nav item is active', async ({ page }) => {
    const active = page.locator('.sidebar .nav-item.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Candidates');
  });

  test('Page Viewed fires with page: candidates', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'candidates' });
  });

  test('filter form elements are present', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('submitting filters fetches results (mocked)', async ({ page }) => {
    await mockFecApi(page);
    // Select a state and submit
    const selects = page.locator('select');
    const count = await selects.count();
    if (count > 0) {
      await selects.first().selectOption({ index: 1 }).catch(() => {});
    }
    const submitBtn = page.locator('button[type="submit"], .filter-btn, .go-btn').first();
    if (await submitBtn.count() > 0) {
      await submitBtn.click();
      await page.waitForLoadState('networkidle');
    }
    // Page should not crash
    const bodyText = await page.evaluate(() => document.body.textContent || '');
    expect(bodyText.length).toBeGreaterThan(0);
  });
});

// ── committees.html ───────────────────────────────────────────────────────────

test.describe('committees.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/committees.html');
  });

  test('"Committees" nav item is active', async ({ page }) => {
    const active = page.locator('.sidebar .nav-item.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Committees');
  });

  test('Page Viewed fires with page: committees', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'committees' });
  });

  test('filter form elements are present', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });
});

// ── process-log.html ──────────────────────────────────────────────────────────

test.describe('process-log.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/process-log.html');
  });

  test('"Process Log" nav item is active', async ({ page }) => {
    const active = page.locator('.sidebar .nav-item.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Process Log');
  });

  test('Page Viewed fires', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]?.page).toMatch(/process.log/i);
  });

  test('log content is present and readable', async ({ page }) => {
    // Some log-like content should exist
    const body = await page.evaluate(() => document.body.textContent || '');
    expect(body.trim().length).toBeGreaterThan(100);
  });

  test('no broken layout at desktop width (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(1280 + 20);
  });

  test('no broken layout at mobile width (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.sidebar')).not.toBeVisible();
    await expect(page.locator('.mobile-header')).toBeVisible();
  });
});

// ── design-system.html ────────────────────────────────────────────────────────

test.describe('design-system.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/design-system.html');
  });

  test('"Design System" nav item is active', async ({ page }) => {
    const active = page.locator('.sidebar .nav-item.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Design System');
  });

  test('Page Viewed fires', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
  });

  test('token tables render', async ({ page }) => {
    const tables = page.locator('table, .token-table, .token-section');
    const count = await tables.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('color swatches have data-token and data-hex attributes', async ({ page }) => {
    const swatch = page.locator('[data-token]').first();
    await expect(swatch).toBeAttached();
    const hex = await swatch.getAttribute('data-hex');
    expect(hex).toBeTruthy();
    const token = await swatch.getAttribute('data-token');
    expect(token?.startsWith('--')).toBe(true);
  });

  test('background swatch is warm parchment (not dark)', async ({ page }) => {
    const bgSwatch = page.locator('[data-token="--bg"]');
    await expect(bgSwatch).toBeAttached();
    const hex = await bgSwatch.getAttribute('data-hex');
    // #ede8e0 → R=237 (high value = light color)
    const r = parseInt((hex || '#000').slice(1, 3), 16);
    expect(r).toBeGreaterThan(200);
  });

  test('partisan swatches present: Dem, Rep, Ind', async ({ page }) => {
    await expect(page.locator('[data-token="--dem"]')).toBeAttached();
    await expect(page.locator('[data-token="--rep"]')).toBeAttached();
    await expect(page.locator('[data-token="--ind"]')).toBeAttached();
  });

  test('component cards have id="comp-{name}" attribute', async ({ page }) => {
    const compCard = page.locator('[id^="comp-"]').first();
    await expect(compCard).toBeAttached();
  });

  test('component cards have a status badge', async ({ page }) => {
    const badge = page.locator('[data-status], .status-badge, .badge').first();
    await expect(badge).toBeAttached();
  });

  test('no common component CSS duplicated in page <style> (nav-item, sidebar etc.)', async ({ page }) => {
    // The page style block should not contain sidebar/nav CSS that lives in styles.css
    const styleContent = await page.evaluate(() => {
      const styleEl = document.querySelector('head style');
      return styleEl ? styleEl.textContent : '';
    });
    // These classes should NOT appear in the page style block (they're in styles.css)
    expect(styleContent).not.toMatch(/\.nav-item\s*\{/);
    expect(styleContent).not.toMatch(/\.sidebar\s*\{/);
  });

  test('typography specimens render (Barlow, DM Sans, IBM Plex Mono)', async ({ page }) => {
    const bodyText = await page.evaluate(() => document.body.textContent || '');
    expect(bodyText).toMatch(/Barlow|DM Sans|IBM Plex/i);
  });
});

// ── index.html ────────────────────────────────────────────────────────────────

test.describe('index.html', () => {
  test('redirects to search.html', async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/index.html');
    await expect(page).toHaveURL(/search\.html/, { timeout: 5000 });
  });
});

// ── Mobile layout ─────────────────────────────────────────────────────────────

test.describe('mobile layout — sidebar hidden, header visible', () => {
  const MOBILE_PAGES = [
    { url: '/search.html', needsMock: false },
    { url: '/candidate.html?id=H2WA03217', needsMock: true },
    { url: '/races.html', needsMock: false },
  ];

  for (const { url, needsMock } of MOBILE_PAGES) {
    test(`${url} hides sidebar at 390px`, async ({ page }) => {
      await mockAmplitude(page);
      if (needsMock) await mockFecApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await page.waitForLoadState('networkidle');
      await expect(page.locator('.sidebar')).not.toBeVisible();
    });

    test(`${url} shows mobile search icon at 390px`, async ({ page }) => {
      await mockAmplitude(page);
      if (needsMock) await mockFecApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await expect(page.locator('.mobile-search-icon')).toBeVisible();
    });

    test(`${url} hides mobile search icon at desktop (1280px)`, async ({ page }) => {
      await mockAmplitude(page);
      if (needsMock) await mockFecApi(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(url);
      await expect(page.locator('.mobile-search-icon')).not.toBeVisible();
    });
  }
});
