/**
 * shared.spec.js — Structural checks that apply to every page.
 *
 * Mirrors the "Shared — run for every page touched this session" section
 * of test-cases.md. Tests run parameterized over all pages.
 *
 * Pages that auto-fetch API data on load get mocked routes so the page
 * renders correctly without hitting the real FEC API.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

// ── Page manifest ─────────────────────────────────────────────────────────────

/**
 * Each entry describes a page and its expected shared state.
 *
 * needsApiMock: true if the page auto-fetches API data on load.
 */
const PAGES = [
  { name: 'search.html', url: '/search.html', needsApiMock: false },
  { name: 'candidates.html', url: '/candidates.html', needsApiMock: true },
  { name: 'candidate.html', url: '/candidate.html?id=H2WA03217', needsApiMock: true },
  { name: 'committees.html', url: '/committees.html', needsApiMock: true },
  { name: 'committee.html', url: '/committee.html?id=C00775668', needsApiMock: true },
  { name: 'races.html', url: '/races.html', needsApiMock: false },
  { name: 'race.html', url: '/race.html?state=WA&district=03&year=2024&office=H', needsApiMock: true },
  { name: 'feed.html', url: '/feed.html', needsApiMock: true },
  { name: 'process-log.html', url: '/process-log.html', needsApiMock: false },
  { name: 'design-system.html', url: '/design-system.html', needsApiMock: false },
];

// ── Shared test suite ─────────────────────────────────────────────────────────

for (const pageConfig of PAGES) {
  test.describe(`shared: ${pageConfig.name}`, () => {
    test.beforeEach(async ({ page }) => {
      await mockAmplitude(page);
      if (pageConfig.needsApiMock) await mockFecApi(page);
      await page.goto(pageConfig.url);
      // Wait for network to settle (API calls resolve with mock data)
      await page.waitForLoadState('networkidle');
    });

    test('links styles.css', async ({ page }) => {
      const link = page.locator('link[href*="styles.css"]');
      await expect(link).toHaveCount(1);
    });

    test('links main.js', async ({ page }) => {
      const script = page.locator('script[src*="main.js"]');
      await expect(script).toHaveCount(1);
    });

    test('top nav has two main nav links', async ({ page }) => {
      const topNav = page.locator('.top-nav');
      await expect(topNav).toBeVisible();
      // Scope to .top-nav-links (desktop) — mobile nav is inside .top-nav so each link appears twice in total
      const desktopLinks = topNav.locator('.top-nav-links');
      await expect(desktopLinks.locator('a[href*="races"]')).toHaveCount(1);
      await expect(desktopLinks.locator('a[href*="feed"]')).toHaveCount(1);
      // Candidates and Committees removed from nav (T-IA-candidate-committees-nav-removal)
      await expect(desktopLinks.locator('a[href="/candidates"]')).toHaveCount(0);
      await expect(desktopLinks.locator('a[href="/committees"]')).toHaveCount(0);
    });

    test('top nav is present in DOM', async ({ page }) => {
      await expect(page.locator('.top-nav')).toBeAttached();
    });

    test('mobile search toggle is present in DOM', async ({ page }) => {
      const toggle = page.locator('.top-nav-search-toggle');
      await expect(toggle).toBeAttached();
    });

    test('page background is warm parchment (not dark or white)', async ({ page }) => {
      const bgColor = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor
      );
      // --bg: #F8F5EC → rgb(248, 245, 236)
      expect(bgColor).not.toBe('rgb(255, 255, 255)');
      expect(bgColor).not.toBe('rgb(0, 0, 0)');
      // Warm color: red channel > blue channel
      const [r, , b] = bgColor.match(/\d+/g).map(Number);
      expect(r).toBeGreaterThan(b);
    });

    test('Amplitude Page Viewed fires on load', async ({ page }) => {
      const event = await findTrackEvent(page, 'Page Viewed');
      expect(event).toBeDefined();
      expect(event.args[0]).toBe('Page Viewed');
    });

    test('nav logo has .logo-fec and .logo-ledger spans', async ({ page }) => {
      const logo = page.locator('.top-nav .top-nav-logo');
      await expect(logo.locator('.logo-fec')).toHaveCount(1);
      await expect(logo.locator('.logo-ledger')).toHaveCount(1);
    });

    test('mobile nav drawer is a child of .top-nav', async ({ page }) => {
      const result = await page.evaluate(() => {
        const topNav = document.querySelector('.top-nav');
        const mobileNav = document.querySelector('#mobile-nav');
        return !!(topNav && mobileNav && topNav.contains(mobileNav));
      });
      expect(result).toBe(true);
    });

    test('mobile nav has two links', async ({ page }) => {
      const mobileNav = page.locator('#mobile-nav');
      await expect(mobileNav.locator('a[href*="races"]')).toHaveCount(1);
      await expect(mobileNav.locator('a[href*="feed"]')).toHaveCount(1);
      // Candidates and Committees removed from nav (T-IA-candidate-committees-nav-removal)
      await expect(mobileNav.locator('a[href="/candidates"]')).toHaveCount(0);
      await expect(mobileNav.locator('a[href="/committees"]')).toHaveCount(0);
    });

    test('.global-banner precedes .top-nav in the DOM', async ({ page }) => {
      const bannerBeforeNav = await page.evaluate(() => {
        const banner = document.querySelector('.global-banner');
        const nav = document.querySelector('.top-nav');
        if (!banner || !nav) return false;
        // DOCUMENT_POSITION_FOLLOWING (4) is set when nav comes after banner
        return !!(banner.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING);
      });
      expect(bannerBeforeNav).toBe(true);
    });

    test('desktop nav has a search button', async ({ page }) => {
      // T-search-overlay: the nav search input was replaced by a button that
      // opens the full-page search overlay.
      const btn = page.locator('.top-nav-search #nav-search-btn');
      await expect(btn).toHaveCount(1);
      await expect(btn).toHaveAttribute('type', 'button');
    });

    test('no uncaught JS errors on load', async ({ page }) => {
      const errors = [];
      // Listen for any errors that fire after page settled (late errors)
      page.on('pageerror', err => errors.push(err.message));
      await page.waitForTimeout(300);
      const realErrors = errors.filter(msg =>
        !msg.includes('Amplitude snippet has been loaded')
      );
      expect(realErrors).toHaveLength(0);
    });
  });
}
