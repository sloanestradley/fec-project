/**
 * search.spec.js — Structural tests for search.html.
 *
 * Uses mocked FEC API and Amplitude.
 * Tests cover: initial hero state, typeahead dropdown, two-group results
 * preview, no-results state, and Amplitude events.
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

  test('#search-input has combobox ARIA attributes', async ({ page }) => {
    const input = page.locator('#search-input');
    await expect(input).toHaveAttribute('role', 'combobox');
    await expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(input).toHaveAttribute('aria-expanded', 'false');
    await expect(input).toHaveAttribute('aria-controls', 'typeahead-dropdown');
    await expect(input).toHaveAttribute('aria-autocomplete', 'list');
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

  test('search hero / empty state is visible without a query', async ({ page }) => {
    await expect(page.locator('#state-empty .page-header')).toBeVisible();
  });

  test('Amplitude Page Viewed fires with page: search', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'search' });
  });

  test('no nav link is active (search is not in top nav)', async ({ page }) => {
    const activeLinks = page.locator('.top-nav .nav-link.active');
    await expect(activeLinks).toHaveCount(0);
  });
});

// ── Typeahead dropdown ────────────────────────────────────────────────────────

test.describe('search.html — typeahead dropdown', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html');
  });

  test('fewer than 2 chars does not show typeahead', async ({ page }) => {
    await page.locator('#search-input').fill('g');
    await page.waitForTimeout(400);
    await expect(page.locator('#typeahead-dropdown')).not.toBeVisible();
  });

  test('2+ chars shows typeahead dropdown', async ({ page }) => {
    await page.locator('#search-input').fill('gl');
    await expect(page.locator('#typeahead-dropdown')).toBeVisible({ timeout: 2000 });
  });

  test('dropdown shows Candidates group label', async ({ page }) => {
    await page.locator('#search-input').fill('gl');
    await page.locator('#typeahead-dropdown').waitFor({ state: 'visible', timeout: 2000 });
    const labels = await page.locator('.typeahead-group-label').allTextContents();
    const upper = labels.map(t => t.toUpperCase());
    expect(upper.some(t => t.includes('CANDIDATES'))).toBe(true);
  });

  test('dropdown shows Committees group label', async ({ page }) => {
    await page.locator('#search-input').fill('gl');
    await page.locator('#typeahead-dropdown').waitFor({ state: 'visible', timeout: 2000 });
    const labels = await page.locator('.typeahead-group-label').allTextContents();
    const upper = labels.map(t => t.toUpperCase());
    expect(upper.some(t => t.includes('COMMITTEES'))).toBe(true);
  });

  test('candidate row links to /candidate/{id}', async ({ page }) => {
    await page.locator('#search-input').fill('gl');
    await page.locator('#typeahead-dropdown').waitFor({ state: 'visible', timeout: 2000 });
    const link = page.locator('.typeahead-row[href*="/candidate/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/candidate\/[A-Z0-9]+/);
  });

  test('committee row links to /committee/{id}', async ({ page }) => {
    await page.locator('#search-input').fill('gl');
    await page.locator('#typeahead-dropdown').waitFor({ state: 'visible', timeout: 2000 });
    const link = page.locator('.typeahead-row[href*="/committee/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/committee\/[A-Z0-9]+/);
  });

  test('Escape key closes the dropdown', async ({ page }) => {
    await page.locator('#search-input').fill('gl');
    await page.locator('#typeahead-dropdown').waitFor({ state: 'visible', timeout: 2000 });
    await page.locator('#search-input').press('Escape');
    await expect(page.locator('#typeahead-dropdown')).not.toBeVisible();
  });

  test('Enter key closes dropdown and runs search', async ({ page }) => {
    await page.locator('#search-input').fill('gluesenkamp');
    await page.locator('#typeahead-dropdown').waitFor({ state: 'visible', timeout: 2000 });
    await page.locator('#search-input').press('Enter');
    await expect(page.locator('#typeahead-dropdown')).not.toBeVisible();
    await expect(page.locator('#candidates-list')).toBeVisible({ timeout: 5000 });
  });

  test('clicking outside closes the dropdown', async ({ page }) => {
    await page.locator('#search-input').fill('gl');
    await page.locator('#typeahead-dropdown').waitFor({ state: 'visible', timeout: 2000 });
    await page.mouse.click(10, 400);
    await expect(page.locator('#typeahead-dropdown')).not.toBeVisible();
  });
});

// ── Two-group results ─────────────────────────────────────────────────────────

test.describe('search.html — two-group results', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/search.html');
    await page.locator('#search-input').fill('gluesenkamp');
    await page.locator('#search-input').press('Enter');
    await page.waitForSelector('#candidates-list', { timeout: 5000 });
  });

  test('Candidates group is visible after submit', async ({ page }) => {
    await expect(page.locator('#group-candidates')).toBeVisible();
  });

  test('Committees group is visible after submit', async ({ page }) => {
    await expect(page.locator('#group-committees')).toBeVisible();
  });

  test('candidate results link to /candidate/{id}', async ({ page }) => {
    const link = page.locator('#candidates-list a[href*="/candidate/"]').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/candidate\/[A-Z0-9]+/);
  });

  test('committee results link to /committee/{id}', async ({ page }) => {
    const link = page.locator('#committees-list a[href*="/committee/"]').first();
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
  test('"View all candidates" link contains /candidates?q= when count > 5', async ({ page }) => {
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
    await page.locator('#search-input').press('Enter');
    await page.waitForSelector('#candidates-list', { timeout: 5000 });
    const viewAll = page.locator('#candidates-view-all');
    await expect(viewAll).toBeVisible();
    const href = await viewAll.getAttribute('href');
    expect(href).toContain('/candidates?q=');
  });

  test('"View all committees" link contains /committees?q= when count > 5', async ({ page }) => {
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
    await page.locator('#search-input').press('Enter');
    await page.waitForSelector('#committees-list', { timeout: 5000 });
    const viewAll = page.locator('#committees-view-all');
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
    await expect(page.locator('#candidates-list')).toBeVisible({ timeout: 5000 });
  });
});

// ── No-results state ──────────────────────────────────────────────────────────

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
});
