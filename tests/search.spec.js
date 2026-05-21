/**
 * search.spec.js — Structural tests for search.html.
 *
 * Uses mocked FEC API and Amplitude.
 * Tests cover: initial state, live inline results (debounced query rendered
 * in the page body — T-search-inline-results retired the floating
 * #typeahead-dropdown), the submit path, View all links, ?q= auto-search,
 * no-results and error states, and Amplitude events.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

// ── Initial state ─────────────────────────────────────────────────────────────

test.describe('search.html — initial state (no query)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/search.html');
  });

  test('search input is present', async ({ page }) => {
    await expect(page.locator('#search-input')).toBeVisible();
  });

  test('#search-input is a plain search input (no combobox ARIA)', async ({ page }) => {
    // T-search-inline-results: results render inline, not in a popup listbox,
    // so the combobox-with-popup ARIA was dropped.
    const input = page.locator('#search-input');
    await expect(input).toHaveAttribute('type', 'search');
    await expect(input).not.toHaveAttribute('role', 'combobox');
    await expect(input).not.toHaveAttribute('aria-controls', 'typeahead-dropdown');
  });

  test('an aria-live results status region is present', async ({ page }) => {
    // initSearchPanel creates a visually-hidden polite live region for a
    // concise count summary.
    await expect(page.locator('.sr-only[aria-live="polite"]')).toHaveCount(1);
  });

  test('the floating typeahead dropdown is gone', async ({ page }) => {
    await expect(page.locator('#typeahead-dropdown')).toHaveCount(0);
  });

  test('nav search handler is registered on search.html', async ({ page }) => {
    const registered = await page.evaluate(() => typeof window.__navSearchHandler === 'function');
    expect(registered).toBe(true);
  });

  test('page-level search input is wrapped in .search-field with icon', async ({ page }) => {
    const searchField = page.locator('#search-form .search-field');
    await expect(searchField).toHaveCount(1);
    await expect(searchField.locator('.search-field-icon')).toHaveCount(1);
  });

  test('page-level search submit button is sr-only', async ({ page }) => {
    const btn = page.locator('#search-form .form-search-btn.sr-only');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveAttribute('type', 'submit');
  });

  test('Amplitude Page Viewed fires with page: search', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'search' });
  });
});

// ── Live inline results ───────────────────────────────────────────────────────

test.describe('search.html — live inline results', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html');
  });

  test('2-character query fires no fetch and shows no error (FEC requires 3+ chars)', async ({ page }) => {
    // The FEC API rejects keyword queries < 3 chars; initSearchPanel must not
    // fetch below MIN_QUERY_LENGTH. 2 chars stays bare — never #state-error.
    await page.locator('#search-input').fill('ma');
    await page.waitForTimeout(500);
    await expect(page.locator('#state-results')).not.toBeVisible();
    await expect(page.locator('#state-error')).not.toBeVisible();
  });

  test('3+ chars shows inline results in the page body', async ({ page }) => {
    await page.locator('#search-input').fill('glu');
    await expect(page.locator('#state-results')).toBeVisible({ timeout: 2000 });
  });

  test('candidates group renders', async ({ page }) => {
    await page.locator('#search-input').fill('glu');
    await expect(page.locator('.results-group[data-group="candidates"]'))
      .toBeVisible({ timeout: 2000 });
  });

  test('committees group renders', async ({ page }) => {
    await page.locator('#search-input').fill('glu');
    await expect(page.locator('.results-group[data-group="committees"]'))
      .toBeVisible({ timeout: 2000 });
  });

  test('candidate result links to /candidate/{id}', async ({ page }) => {
    await page.locator('#search-input').fill('glu');
    const link = page.locator('.results-group[data-group="candidates"] a[href*="/candidate/"]').first();
    await expect(link).toBeVisible({ timeout: 2000 });
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/candidate\/[A-Z0-9]+/);
    expect(href).not.toContain('#');
  });

  test('committee result links to /committee/{id}', async ({ page }) => {
    await page.locator('#search-input').fill('glu');
    const link = page.locator('.results-group[data-group="committees"] a[href*="/committee/"]').first();
    await expect(link).toBeVisible({ timeout: 2000 });
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/committee\/[A-Z0-9]+/);
  });

  test('Enter after live results does not blank the results', async ({ page }) => {
    await page.locator('#search-input').fill('gluesenkamp');
    await expect(page.locator('.results-group[data-group="candidates"]'))
      .toBeVisible({ timeout: 2000 });
    await page.locator('#search-input').press('Enter');
    // query() dedups on lastQuery, so Enter after live results is a panel
    // no-op — results stay, no flash to the loading/blank state.
    await expect(page.locator('#state-results')).toBeVisible();
    await expect(page.locator('.results-group[data-group="candidates"]')).toBeVisible();
    await expect(page).toHaveURL(/\/search\?q=gluesenkamp/);
  });
});

// ── Submit path ───────────────────────────────────────────────────────────────

test.describe('search.html — submit path', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html');
    await page.locator('#search-input').fill('gluesenkamp');
    await page.locator('#search-input').press('Enter');
    await page.waitForSelector('.results-group[data-group="candidates"]', { timeout: 5000 });
  });

  test('candidate results link to /candidate/{id}', async ({ page }) => {
    const link = page.locator('.results-group[data-group="candidates"] a[href*="/candidate/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/candidate\/[A-Z0-9]+/);
    expect(href).not.toContain('#');
  });

  test('committee results link to /committee/{id}', async ({ page }) => {
    const link = page.locator('.results-group[data-group="committees"] a[href*="/committee/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/committee\/[A-Z0-9]+/);
  });

  test('Amplitude Candidate Searched fires on form submit', async ({ page }) => {
    const event = await findTrackEvent(page, 'Candidate Searched');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ query: expect.any(String) });
  });
});

// ── View all links ────────────────────────────────────────────────────────────

test.describe('search.html — View all links', () => {
  test('"View all" candidates link contains /candidates?q= when count > 5', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Override to return count > 5 for candidate search
    await page.route('**/api/fec/candidates/**', (route) => {
      const url = route.request().url();
      if (url.includes('q=')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{ candidate_id: 'H2WA03217', name: 'GLUESENKAMP PEREZ, MARIE',
              party: 'DEM', office: 'H', state: 'WA', district: '03' }],
            pagination: { count: 10, pages: 2, per_page: 5, page: 1 },
          }),
        });
      } else { route.continue(); }
    });
    await page.goto('/search.html');
    await page.locator('#search-input').fill('gluesenkamp');
    await page.waitForSelector('.results-group[data-group="candidates"]', { timeout: 5000 });
    const viewAll = page.locator('.results-group[data-group="candidates"] .results-view-all');
    await expect(viewAll).toBeVisible();
    const href = await viewAll.getAttribute('href');
    expect(href).toContain('/candidates?q=');
  });

  test('"View all" committees link contains /committees?q= when count > 5', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Override to return count > 5 for committee search
    await page.route('**/api/fec/committees/**', (route) => {
      const url = route.request().url();
      if (url.includes('q=')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{ committee_id: 'C00775668', name: 'MARIE FOR CONGRESS',
              committee_type: 'H', filing_frequency: 'Q' }],
            pagination: { count: 10, pages: 2, per_page: 5, page: 1 },
          }),
        });
      } else { route.continue(); }
    });
    await page.goto('/search.html');
    await page.locator('#search-input').fill('gluesenkamp');
    await page.waitForSelector('.results-group[data-group="committees"]', { timeout: 5000 });
    const viewAll = page.locator('.results-group[data-group="committees"] .results-view-all');
    await expect(viewAll).toBeVisible();
    const href = await viewAll.getAttribute('href');
    expect(href).toContain('/committees?q=');
  });
});

// ── Auto-search from ?q= param ────────────────────────────────────────────────

test.describe('search.html — ?q= auto-search', () => {
  test('?q= param auto-fires search on load', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html?q=gluesenkamp');
    await expect(page.locator('.results-group[data-group="candidates"]'))
      .toBeVisible({ timeout: 5000 });
  });
});

// ── Empty / error states ──────────────────────────────────────────────────────

test.describe('search.html — empty / error states', () => {
  test('query with no results shows no-results state', async ({ page }) => {
    await mockAmplitude(page);
    await page.route('**/api/fec/**', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [], pagination: { count: 0 } }),
      })
    );
    await page.goto('/search.html?q=zzznomatch');
    await expect(page.locator('.no-results')).toBeVisible({ timeout: 5000 });
  });

  test('fetch failure shows the error state with a retry button', async ({ page }) => {
    await mockAmplitude(page);
    await page.route('**/api/fec/**', route =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' })
    );
    await page.goto('/search.html?q=gluesenkamp');
    await expect(page.locator('#state-error')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#state-error .retry-btn')).toBeVisible();
  });
});
