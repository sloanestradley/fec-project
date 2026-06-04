/**
 * overlay.spec.js — Structural + behavioral tests for the global search overlay.
 *
 * T-search-overlay. The overlay is injected on every nav page and reuses
 * initSearchPanel. Commit B activated it: the nav search button + mobile
 * search-toggle open it; the X, Escape, and browser-back close it.
 *
 * Structure + open/close + focus tests run on /process-log.html — a nav page
 * with no API dependency (the overlay opens with an empty input, fires no
 * fetch). The history-safety test runs on candidate.html.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

// ── Structure ─────────────────────────────────────────────────────────────────

test.describe('search overlay — structure', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/process-log.html');
  });

  test('overlay is injected into the page', async ({ page }) => {
    await expect(page.locator('#search-overlay')).toHaveCount(1);
  });

  test('overlay is hidden by default', async ({ page }) => {
    await expect(page.locator('#search-overlay')).not.toBeVisible();
  });

  test('overlay has dialog role and aria-modal', async ({ page }) => {
    const o = page.locator('#search-overlay');
    await expect(o).toHaveAttribute('role', 'dialog');
    await expect(o).toHaveAttribute('aria-modal', 'true');
  });

  test('overlay contains the initSearchPanel elements', async ({ page }) => {
    await expect(page.locator('#overlay-search-input')).toHaveCount(1);
    await expect(page.locator('#overlay-results')).toHaveCount(1);
    await expect(page.locator('#overlay-loading')).toHaveCount(1);
    await expect(page.locator('#overlay-no-results')).toHaveCount(1);
    await expect(page.locator('#overlay-error')).toHaveCount(1);
  });

  test('overlay has a labelled close button', async ({ page }) => {
    const close = page.locator('#search-overlay-close');
    await expect(close).toHaveCount(1);
    await expect(close).toHaveAttribute('aria-label', 'Close search');
  });
});

// ── Open / close ──────────────────────────────────────────────────────────────

test.describe('search overlay — open / close', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/process-log.html');
  });

  test('nav search button opens the overlay', async ({ page }) => {
    await page.click('#nav-search-btn');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
  });

  test('hero search input in overlay renders at 56px + 1rem (T-search-input-restyle)', async ({ page }) => {
    await page.click('#nav-search-btn');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    const dims = await page.locator('#overlay-search-input').evaluate(el => {
      const cs = window.getComputedStyle(el);
      return { height: cs.height, fontSize: cs.fontSize, paddingLeft: parseFloat(cs.paddingLeft) };
    });
    expect(dims.height).toBe('56px');
    expect(dims.fontSize).toBe('16px');
    expect(dims.paddingLeft).toBe(46);
  });

  test('X button closes the overlay', async ({ page }) => {
    await page.click('#nav-search-btn');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    await page.click('#search-overlay-close');
    await expect(page.locator('#search-overlay')).not.toHaveClass(/open/);
  });

  test('Escape closes the overlay', async ({ page }) => {
    await page.click('#nav-search-btn');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#search-overlay')).not.toHaveClass(/open/);
  });

  test('browser-back closes the overlay', async ({ page }) => {
    await page.click('#nav-search-btn');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    await page.goBack();
    await expect(page.locator('#search-overlay')).not.toHaveClass(/open/);
  });

  test('refresh while open lands with the overlay closed', async ({ page }) => {
    await page.click('#nav-search-btn');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    await page.reload();
    await expect(page.locator('#search-overlay')).not.toHaveClass(/open/);
  });
});

// ── Focus + accessibility ─────────────────────────────────────────────────────

test.describe('search overlay — focus + a11y', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/process-log.html');
  });

  test('focus moves to the overlay input on open', async ({ page }) => {
    await page.click('#nav-search-btn');
    await expect(page.locator('#overlay-search-input')).toBeFocused();
  });

  test('focus is restored to the nav button on close', async ({ page }) => {
    await page.click('#nav-search-btn');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    await page.keyboard.press('Escape');
    await expect(page.locator('#nav-search-btn')).toBeFocused();
  });

  test('Tab from the last focusable wraps to the first (focus trap)', async ({ page }) => {
    await page.click('#nav-search-btn');
    // Empty overlay → focusables are the X button and the input; focus is on
    // the input (last in DOM order). Tab wraps to the X button (first).
    await expect(page.locator('#overlay-search-input')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#search-overlay-close')).toBeFocused();
  });

  test('background is inert while the overlay is open', async ({ page }) => {
    await page.click('#nav-search-btn');
    const inert = await page.evaluate(() =>
      document.querySelector('.main').hasAttribute('inert'));
    expect(inert).toBe(true);
  });

  test('background inert is removed on close', async ({ page }) => {
    await page.click('#nav-search-btn');
    await page.keyboard.press('Escape');
    await expect(page.locator('#search-overlay')).not.toHaveClass(/open/);
    const inert = await page.evaluate(() =>
      document.querySelector('.main').hasAttribute('inert'));
    expect(inert).toBe(false);
  });
});

// ── Events + history safety ───────────────────────────────────────────────────

test.describe('search overlay — events + history safety', () => {
  test('Search Opened Amplitude event fires on open', async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/process-log.html');
    await page.click('#nav-search-btn');
    const event = await findTrackEvent(page, 'Search Opened');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ from_page: expect.any(String) });
  });

  test('opening + closing the overlay on a profile page fires no hashchange', async ({ page }) => {
    // The state-only pushState uses location.href verbatim (fragment included),
    // so overlay open/close never changes the URL — the profile-page
    // hashchange listener (view.switchTo) must stay dormant.
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForLoadState('load');
    await page.evaluate(() => {
      window.__hc = 0;
      window.addEventListener('hashchange', () => { window.__hc++; });
    });
    await page.click('#nav-search-btn');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
    await page.goBack();
    await expect(page.locator('#search-overlay')).not.toHaveClass(/open/);
    const hashchanges = await page.evaluate(() => window.__hc);
    expect(hashchanges).toBe(0);
    // T-remove-profile-tabs: loadCycle canonicalizes the legacy #2024#summary to
    // bare #2024 on load; the overlay open/close still fires no hashchange and
    // leaves the (canonical) URL intact.
    await expect(page).toHaveURL(/#2024$/);
  });
});
