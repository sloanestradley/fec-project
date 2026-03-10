/**
 * search.spec.js — Structural tests for search.html.
 *
 * Uses mocked FEC API and Amplitude.
 * Tests cover: initial hero state, search input, auto-search via ?q= param,
 * results rendering, no-results state, and Amplitude events.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

test.describe('search.html — initial state (no query)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/search.html');
  });

  test('search input is present', async ({ page }) => {
    await expect(page.locator('.search-input')).toBeVisible();
  });

  test('search hero / empty state is visible without a query', async ({ page }) => {
    await expect(page.locator('.search-hero')).toBeVisible();
  });

  test('Amplitude Page Viewed fires with page: search', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'search' });
  });

  test('"Search" nav item is active', async ({ page }) => {
    const activeItem = page.locator('.sidebar .nav-item.active');
    const text = await activeItem.first().textContent();
    expect(text?.trim()).toContain('Search');
  });
});

test.describe('search.html — search interaction', () => {
  test('typing and pressing Enter returns results', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html');
    await page.locator('.search-input').fill('gluesenkamp');
    await page.locator('.search-input').press('Enter');
    await expect(page.locator('.results-list')).toBeVisible({ timeout: 5000 });
  });

  test('result card links to candidate.html?id=...', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html');
    await page.locator('.search-input').fill('gluesenkamp');
    await page.locator('.search-input').press('Enter');
    await page.waitForSelector('.results-list', { timeout: 5000 });
    const link = page.locator('.results-list a[href*="candidate.html"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toContain('candidate.html?id=');
  });

  test('?q= param auto-fires search on load', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html?q=gluesenkamp');
    await expect(page.locator('.results-list')).toBeVisible({ timeout: 5000 });
  });

  test('Candidate Searched fires on form submit', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html');
    await page.locator('.search-input').fill('gluesenkamp');
    await page.locator('.search-input').press('Enter');
    await page.waitForSelector('.results-list', { timeout: 5000 });
    const event = await findTrackEvent(page, 'Candidate Searched');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ query: expect.any(String) });
  });

  test('result card has correct onclick wiring and Candidate Result Clicked fires', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html');
    await page.locator('.search-input').fill('gluesenkamp');
    await page.locator('.search-input').press('Enter');
    await page.waitForSelector('.results-list a[href*="candidate.html"]', { timeout: 5000 });

    // Structural check: result card link has onclick attribute calling trackClick
    const onclick = await page.locator('.results-list a[href*="candidate.html"]').first().getAttribute('onclick');
    expect(onclick).toContain('trackClick');

    // Behavioral check: call trackClick() directly — it's a top-level function that calls
    // amplitude.track('Candidate Result Clicked', ...). Calling it directly bypasses navigation.
    const fired = await page.evaluate(() => {
      const qBefore = window.amplitude._q.length;
      if (typeof window.trackClick === 'function') {
        window.trackClick(null, 'TEST_ID', 'Test Name', 0);
      }
      const newItems = window.amplitude._q.slice(qBefore);
      const found = newItems.find(e => e.name === 'track' && e.args?.[0] === 'Candidate Result Clicked');
      return found ? found.args[0] : null;
    });
    expect(fired).toBe('Candidate Result Clicked');
  });
});

test.describe('search.html — empty / error states', () => {
  test('query with no results shows no-results state', async ({ page }) => {
    await mockAmplitude(page);
    // Return empty results for any FEC search
    await page.route('**/api.open.fec.gov/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], pagination: { count: 0 } }),
      })
    );
    await page.goto('/search.html?q=zzznomatch');
    await expect(page.locator('.no-results')).toBeVisible({ timeout: 5000 });
  });
});
