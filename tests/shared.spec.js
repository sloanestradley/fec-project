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
    activeNavText: 'Search',
    needsApiMock: false,
  },
  {
    name: 'candidates.html',
    url: '/candidates.html',
    activeNavText: 'Candidates',
    needsApiMock: false,
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
    needsApiMock: false,
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
    needsApiMock: false,
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
    activeNavText: 'Process Log',
    needsApiMock: false,
  },
  {
    name: 'design-system.html',
    url: '/design-system.html',
    activeNavText: 'Design System',
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

    test('sidebar nav has all four main nav links', async ({ page }) => {
      const sidebar = page.locator('.sidebar');
      await expect(sidebar).toBeVisible();
      await expect(sidebar.locator('a[href="candidates.html"]')).toHaveCount(1);
      await expect(sidebar.locator('a[href="committees.html"]')).toHaveCount(1);
      await expect(sidebar.locator('a[href="races.html"]')).toHaveCount(1);
      await expect(sidebar.locator('a[href="search.html"]')).toHaveCount(1);
    });

    test('mobile header is present in DOM', async ({ page }) => {
      await expect(page.locator('.mobile-header')).toBeAttached();
    });

    test('mobile search icon links to search.html', async ({ page }) => {
      const icon = page.locator('.mobile-search-icon');
      await expect(icon).toBeAttached();
      await expect(icon).toHaveAttribute('href', 'search.html');
    });

    test(`correct nav item is active: "${pageConfig.activeNavText}"`, async ({ page }) => {
      const activeItem = page.locator('.sidebar .nav-item.active');
      const count = await activeItem.count();
      expect(count).toBeGreaterThanOrEqual(1);
      const activeText = await activeItem.first().textContent();
      expect(activeText?.trim()).toContain(pageConfig.activeNavText);
    });

    test('page background is warm parchment (not dark or white)', async ({ page }) => {
      const bgColor = await page.evaluate(() =>
        getComputedStyle(document.body).backgroundColor
      );
      // --bg: #ede8e0 → rgb(237, 232, 224)
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
