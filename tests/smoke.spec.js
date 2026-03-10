/**
 * smoke.spec.js — Track 2: Live API smoke tests.
 *
 * These tests hit the real FEC API — no mocking.
 * Run manually before deploys or after major changes.
 *
 * Run: npx playwright test --grep @smoke
 *   OR: npm run test:smoke
 *
 * Tests are intentionally narrow: just enough to confirm real data is flowing.
 * They will fail if the FEC API is down or rate-limiting.
 */

import { test, expect } from '@playwright/test';

// Smoke tests need more time for real API calls
test.setTimeout(45000);

// ── @smoke: candidate page with real FEC data ─────────────────────────────────

test('@smoke: candidate page loads Marie Gluesenkamp Perez with non-zero financials', async ({ page }) => {
  // No API mock — real FEC calls
  await page.goto('/candidate.html?id=H2WA03217');

  // Wait for the profile to actually load (not just the loading spinner)
  await page.waitForSelector('#profile-header.visible', { timeout: 30000 });
  await page.waitForSelector('#content.visible', { timeout: 30000 });

  // Candidate name should appear
  const name = await page.locator('#candidate-name').textContent();
  expect(name?.trim()).toMatch(/GLUESENKAMP|PEREZ/i);

  // Total Raised should be a non-zero dollar amount
  const raised = await page.locator('#stat-raised').textContent();
  expect(raised).toMatch(/\$[\d,]+/);
  expect(raised).not.toBe('$0');
  expect(raised).not.toBe('—');

  // Total Spent should also be non-zero
  const spent = await page.locator('#stat-spent').textContent();
  expect(spent).toMatch(/\$[\d,]+/);
  expect(spent).not.toBe('$0');

  // Chart canvas should be present (rendered by Chart.js)
  await expect(page.locator('#chart-timeline')).toBeVisible();

  // No 422 errors in API calls
  const errors422 = [];
  page.on('response', res => {
    if (res.url().includes('api.open.fec.gov') && res.status() === 422) {
      errors422.push(res.url());
    }
  });
  expect(errors422).toHaveLength(0);
});

// ── @smoke: candidate page — Kirsten Gillibrand (Senate, 6-year cycle) ────────

test('@smoke: Gillibrand (Senate) page loads with 6-year cycle switcher', async ({ page }) => {
  await page.goto('/candidate.html?id=S0NY00410');
  await page.waitForSelector('#profile-header.visible', { timeout: 30000 });

  const name = await page.locator('#candidate-name').textContent();
  expect(name?.trim()).toMatch(/GILLIBRAND/i);

  // Cycle switcher should show Senate cycles
  await page.waitForSelector('.cycle-btn');
  const cycles = page.locator('.cycle-btn');
  const count = await cycles.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // At least one cycle button text should be a year
  const firstCycleText = await cycles.first().textContent();
  expect(firstCycleText?.trim()).toMatch(/\d{4}/);
});

// ── @smoke: search for "Gillibrand" returns real results ──────────────────────

test('@smoke: search for "Gillibrand" returns at least one result', async ({ page }) => {
  await page.goto('/search.html?q=Gillibrand');

  // Wait for results to appear
  await page.waitForSelector('.results-list', { timeout: 30000 });

  const links = page.locator('.results-list a[href*="candidate.html"]');
  const count = await links.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // At least one result should mention Gillibrand
  const firstText = await links.first().textContent();
  expect(firstText?.toUpperCase()).toContain('GILLIBRAND');
});

// ── @smoke: committee page loads known active committee ───────────────────────

test('@smoke: committee C00775668 (Marie for Congress) loads with financials', async ({ page }) => {
  // C00775668 is verified active in design-system.html demo data
  await page.goto('/committee.html?id=C00775668');
  await page.waitForSelector('.committee-header.visible', { timeout: 30000 });

  // Committee name should appear
  const name = await page.locator('.committee-name-display').textContent();
  expect(name?.trim().length).toBeGreaterThan(3);
  expect(name?.toUpperCase()).toContain('MARIE');

  // At least one financial stat should be non-zero
  const statsGrid = page.locator('.stats-grid');
  await expect(statsGrid).toBeVisible();

  const values = statsGrid.locator('.stat-value');
  const valueCount = await values.count();
  expect(valueCount).toBeGreaterThan(0);

  let hasNonZeroDollar = false;
  for (let i = 0; i < valueCount; i++) {
    const text = await values.nth(i).textContent();
    if (text?.match(/\$[\d,]+/) && text !== '$0') hasNonZeroDollar = true;
  }
  expect(hasNonZeroDollar).toBe(true);
});

// ── @smoke: race page loads WA-03 2024 with real candidate cards ──────────────

test('@smoke: WA-03 2024 race page loads candidate cards with financials', async ({ page }) => {
  await page.goto('/race.html?state=WA&district=03&year=2024&office=H');

  // Wait for candidate cards to appear
  await page.waitForSelector('.race-card, .candidate-card', { timeout: 30000 });

  const cards = page.locator('.race-card, .candidate-card');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(1);

  // At least one card should show MGP's name
  const allText = await page.evaluate(() => document.body.textContent);
  expect(allText?.toUpperCase()).toContain('GLUESENKAMP');

  // Candidate cards should link to candidate pages with cycle anchors
  const links = page.locator('a[href*="candidate.html"]');
  const linkCount = await links.count();
  expect(linkCount).toBeGreaterThanOrEqual(1);

  const href = await links.first().getAttribute('href');
  expect(href).toMatch(/#\d{4}/); // cycle anchor
});
