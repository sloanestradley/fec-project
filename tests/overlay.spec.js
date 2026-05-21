/**
 * overlay.spec.js — Structural tests for the global search overlay.
 *
 * T-search-overlay Commit A (dormant chrome): the overlay is injected hidden
 * on every nav page and wired to initSearchPanel. The open/close machinery,
 * nav-button trigger, focus management, and history integration land in
 * Commit B — behavioral tests join this file then.
 *
 * Tests run on /process-log.html — a representative nav page with no API
 * dependency (the dormant overlay fires no fetch).
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude } from './helpers/amp-mock.js';

test.describe('search overlay — dormant chrome (Commit A)', () => {
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
