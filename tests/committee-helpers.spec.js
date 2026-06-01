/**
 * committee-helpers.spec.js — Unit-style coverage of committeeTypeLabel,
 * filingFrequencyLabel, and filingFrequencyDotClass via page.evaluate. Tests
 * run against /design-system.html — any page that loads utils.js works.
 *
 * T-fixture-coverage-tier1-2 (2026-06-01). Closes audit gaps surfaced in
 * strategy/fixture-coverage-audit.md:
 *   - Tier 1 #2: committeeTypeLabel non-H codes (P/J/D/O/Q/N/V/S/Y/I/U)
 *   - Tier 1 #3: filingFrequencyLabel + filingFrequencyDotClass non-Q codes
 *     (A/D/M/T/W; T branch is indirectly covered via terminated-tab
 *     integration tests, but no direct unit assertion exists)
 *
 * Both helpers are pure-data map lookups — these tests double as
 * regression locks against accidental map-entry deletion or rename.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude } from './helpers/amp-mock.js';

const PAGE = '/design-system.html';

test.beforeEach(async ({ page }) => {
  await mockAmplitude(page);
  await page.goto(PAGE);
});

// ── committeeTypeLabel ───────────────────────────────────────────────────────

test.describe('committeeTypeLabel', () => {
  const cases = [
    ['P', 'Principal Campaign Committee'],
    ['J', 'Joint Fundraising Committee'],
    ['D', 'Leadership PAC'],
    ['O', 'Super PAC'],
    ['Q', 'PAC — Qualified'],
    ['N', 'PAC — Non-Qualified'],
    ['V', 'Hybrid PAC'],
    ['H', 'House Candidate Committee'],
    ['S', 'Senate Candidate Committee'],
    ['Y', 'Party Committee'],
    ['I', 'Independent Expenditure (Non-Contribution)'],
    ['U', 'Single Candidate IE'],
  ];

  for (const [code, expected] of cases) {
    test(`code '${code}' → '${expected}'`, async ({ page }) => {
      const r = await page.evaluate(c => committeeTypeLabel(c), code);
      expect(r).toBe(expected);
    });
  }

  test('unmapped code → "Type X" fallback', async ({ page }) => {
    expect(await page.evaluate(() => committeeTypeLabel('X'))).toBe('Type X');
    expect(await page.evaluate(() => committeeTypeLabel('Z'))).toBe('Type Z');
  });

  test('lowercase code is NOT normalized — passes through as-is', async ({ page }) => {
    // Map lookup is case-sensitive; lowercase falls through to "Type {code}".
    // This locks the current behavior (FEC always sends uppercase short codes).
    const r = await page.evaluate(() => committeeTypeLabel('h'));
    expect(r).toBe('Type h');
  });
});

// ── filingFrequencyLabel ─────────────────────────────────────────────────────

test.describe('filingFrequencyLabel', () => {
  const cases = [
    ['A', 'Administratively Terminated'],
    ['D', 'Debt'],
    ['M', 'Monthly Filer'],
    ['Q', 'Quarterly Filer'],
    ['T', 'Terminated'],
    ['W', 'Waived'],
  ];

  for (const [code, expected] of cases) {
    test(`code '${code}' → '${expected}'`, async ({ page }) => {
      const r = await page.evaluate(c => filingFrequencyLabel(c), code);
      expect(r).toBe(expected);
    });
  }

  test('unmapped code → raw fallback (the code itself)', async ({ page }) => {
    expect(await page.evaluate(() => filingFrequencyLabel('X'))).toBe('X');
  });

  test('null/empty/undefined → em-dash fallback', async ({ page }) => {
    expect(await page.evaluate(() => filingFrequencyLabel(null))).toBe('—');
    expect(await page.evaluate(() => filingFrequencyLabel(''))).toBe('—');
    expect(await page.evaluate(() => filingFrequencyLabel(undefined))).toBe('—');
  });
});

// ── filingFrequencyDotClass ──────────────────────────────────────────────────

test.describe('filingFrequencyDotClass', () => {
  test("'T' (Terminated) → 'dot-terminated'", async ({ page }) => {
    expect(await page.evaluate(() => filingFrequencyDotClass('T'))).toBe('dot-terminated');
  });

  test("'A' (Administratively Terminated) → 'dot-terminated'", async ({ page }) => {
    expect(await page.evaluate(() => filingFrequencyDotClass('A'))).toBe('dot-terminated');
  });

  test("'Q' (Quarterly) → 'dot-active'", async ({ page }) => {
    expect(await page.evaluate(() => filingFrequencyDotClass('Q'))).toBe('dot-active');
  });

  test('every non-terminated code → dot-active', async ({ page }) => {
    expect(await page.evaluate(() => filingFrequencyDotClass('D'))).toBe('dot-active');
    expect(await page.evaluate(() => filingFrequencyDotClass('M'))).toBe('dot-active');
    expect(await page.evaluate(() => filingFrequencyDotClass('W'))).toBe('dot-active');
  });

  test('unmapped / null / empty → dot-active (defensive default)', async ({ page }) => {
    expect(await page.evaluate(() => filingFrequencyDotClass('X'))).toBe('dot-active');
    expect(await page.evaluate(() => filingFrequencyDotClass(null))).toBe('dot-active');
    expect(await page.evaluate(() => filingFrequencyDotClass(''))).toBe('dot-active');
  });
});
