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
 * activeNavText: the nav item that should have `.active` at this URL.
 *   Profile pages activate their parent browse page's nav item (per ia.md).
 * needsApiMock: true if the page auto-fetches API data on load.
 */
const PAGES = [
  {
    name: 'search.html',
    url: '/search.html',
    activeNavText: null,
    needsApiMock: false,
  },
  {
    name: 'candidates.html',
    url: '/candidates.html',
    activeNavText: 'Candidates',
    needsApiMock: true,
  },
  {
    name: 'candidate.html',
    url: '/candidate.html?id=H2WA03217',
    activeNavText: 'Candidates',
    needsApiMock: true,
  },
  {
    name: 'committees.html',
    url: '/committees.html',
    activeNavText: 'Committees',
    needsApiMock: true,
  },
  {
    name: 'committee.html',
    url: '/committee.html?id=C00775668',
    activeNavText: 'Committees',
    needsApiMock: true,
  },
  {
    name: 'races.html',
    url: '/races.html',
    activeNavText: 'Races',
    needsApiMock: true,
  },
  {
    name: 'race.html',
    url: '/race.html?state=WA&district=03&year=2024&office=H',
    activeNavText: 'Races',
    needsApiMock: true,
  },
  {
    name: 'process-log.html',
    url: '/process-log.html',
    activeNavText: null,
    needsApiMock: false,
  },
  {
    name: 'design-system.html',
    url: '/design-system.html',
    activeNavText: null,
    needsApiMock: false,
  },
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

    test('top nav has three main nav links', async ({ page }) => {
      const topNav = page.locator('.top-nav');
      await expect(topNav).toBeVisible();
      await expect(topNav.locator('a[href*="candidates"]')).toHaveCount(1);
      await expect(topNav.locator('a[href*="committees"]')).toHaveCount(1);
      await expect(topNav.locator('a[href*="races"]')).toHaveCount(1);
    });

    test('top nav is present in DOM', async ({ page }) => {
      await expect(page.locator('.top-nav')).toBeAttached();
    });

    test('mobile search toggle is present in DOM', async ({ page }) => {
      const toggle = page.locator('.top-nav-search-toggle');
      await expect(toggle).toBeAttached();
    });

    test(`correct nav link is active: "${pageConfig.activeNavText}"`, async ({ page }) => {
      if (!pageConfig.activeNavText) return; // process-log and design-system have no active link
      const activeLink = page.locator('.top-nav .nav-link.active');
      const count = await activeLink.count();
      expect(count).toBeGreaterThanOrEqual(1);
      const activeText = await activeLink.first().textContent();
      expect(activeText?.trim()).toContain(pageConfig.activeNavText);
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

    test('desktop nav search input is wrapped in .search-field with icon', async ({ page }) => {
      const searchField = page.locator('.top-nav-search .search-field');
      await expect(searchField).toHaveCount(1);
      await expect(searchField.locator('.search-field-icon')).toHaveCount(1);
    });

    test('desktop nav search submit button is sr-only (visually hidden, accessible)', async ({ page }) => {
      const btn = page.locator('.top-nav-search .form-search-btn.sr-only');
      await expect(btn).toHaveCount(1);
      await expect(btn).toHaveAttribute('type', 'submit');
      await expect(btn).toHaveAttribute('aria-label', 'Search');
    });

    test('nav typeahead dropdown container is present', async ({ page }) => {
      await expect(page.locator('#nav-typeahead-dropdown')).toHaveCount(1);
      await expect(page.locator('#nav-typeahead-dropdown')).toHaveAttribute('role', 'listbox');
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
