/**
 * race-helpers.spec.js — Unit-style coverage of formatRaceName,
 * formatRaceLabelLong, and toOrdinal via page.evaluate. Tests run against
 * /design-system.html — any page that loads utils.js works.
 *
 * T-fixture-coverage-tier1-2 (2026-06-01). Closes audit gaps surfaced in
 * strategy/fixture-coverage-audit.md:
 *   - Tier 1 #1: toOrdinal teen exception (11th/12th/13th)
 *   - Tier 2 #5: formatRaceName/Long for Presidential
 *   - Tier 2 #6: formatRaceName/Long for at-large House (district='00')
 *
 * raceHref is already covered by pages.spec.js:1107-1129; not duplicated.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude } from './helpers/amp-mock.js';

const PAGE = '/design-system.html';

test.beforeEach(async ({ page }) => {
  await mockAmplitude(page);
  await page.goto(PAGE);
});

// ── formatRaceName ───────────────────────────────────────────────────────────

test.describe('formatRaceName', () => {
  test('Presidential — returns "US President" regardless of state/district', async ({ page }) => {
    const r = await page.evaluate(() => formatRaceName('P', 'US', '00'));
    expect(r).toBe('US President');
  });

  test('Presidential — state and district inputs ignored', async ({ page }) => {
    const r1 = await page.evaluate(() => formatRaceName('P', '', ''));
    const r2 = await page.evaluate(() => formatRaceName('P', 'CA', '12'));
    expect(r1).toBe('US President');
    expect(r2).toBe('US President');
  });

  test('Senate — district suppressed (always "Senate • {state}")', async ({ page }) => {
    const r1 = await page.evaluate(() => formatRaceName('S', 'WA', '00'));
    const r2 = await page.evaluate(() => formatRaceName('S', 'NY', '03'));
    expect(r1).toBe('Senate • WA');
    expect(r2).toBe('Senate • NY');
  });

  test('At-large House (district=00) — no district suffix', async ({ page }) => {
    const r = await page.evaluate(() => formatRaceName('H', 'AK', '00'));
    expect(r).toBe('House • AK');
  });

  test('House with district — formats as "House • {state}-{district}"', async ({ page }) => {
    const r = await page.evaluate(() => formatRaceName('H', 'WA', '03'));
    expect(r).toBe('House • WA-03');
  });

  test('House with teen district — formats with double-digit suffix', async ({ page }) => {
    const r = await page.evaluate(() => formatRaceName('H', 'NY', '11'));
    expect(r).toBe('House • NY-11');
  });
});

// ── formatRaceLabelLong ──────────────────────────────────────────────────────

test.describe('formatRaceLabelLong', () => {
  test('Presidential — returns "US Presidential" regardless of state/district', async ({ page }) => {
    const r = await page.evaluate(() => formatRaceLabelLong('P', '', ''));
    expect(r).toBe('US Presidential');
  });

  test('Senate — "US Senate: {fullStateName}", district suppressed', async ({ page }) => {
    const r1 = await page.evaluate(() => formatRaceLabelLong('S', 'WA', ''));
    const r2 = await page.evaluate(() => formatRaceLabelLong('S', 'NY', '03'));
    expect(r1).toBe('US Senate: Washington');
    expect(r2).toBe('US Senate: New York');
  });

  test('At-large House (district=00) — "US House: {fullStateName}" with no district', async ({ page }) => {
    const r = await page.evaluate(() => formatRaceLabelLong('H', 'AK', '00'));
    expect(r).toBe('US House: Alaska');
  });

  test('At-large House (empty district) — same as district=00', async ({ page }) => {
    const r = await page.evaluate(() => formatRaceLabelLong('H', 'WY', ''));
    expect(r).toBe('US House: Wyoming');
  });

  test('House with district — "US House: {fullStateName}’s {Nth} District"', async ({ page }) => {
    const r = await page.evaluate(() => formatRaceLabelLong('H', 'WA', '03'));
    expect(r).toBe('US House: Washington’s 3rd District');
  });

  test('House with teen district — preserves teen ordinal ("11th", not "11st")', async ({ page }) => {
    const r11 = await page.evaluate(() => formatRaceLabelLong('H', 'NY', '11'));
    const r12 = await page.evaluate(() => formatRaceLabelLong('H', 'CA', '12'));
    const r13 = await page.evaluate(() => formatRaceLabelLong('H', 'TX', '13'));
    expect(r11).toBe('US House: New York’s 11th District');
    expect(r12).toBe('US House: California’s 12th District');
    expect(r13).toBe('US House: Texas’s 13th District');
  });
});

// ── toOrdinal (called by formatRaceLabelLong for House districts) ────────────

test.describe('toOrdinal', () => {
  // Teen exception — the most-likely-to-regress branch
  test('teen exception — 11/12/13 → 11th/12th/13th', async ({ page }) => {
    expect(await page.evaluate(() => toOrdinal(11))).toBe('11th');
    expect(await page.evaluate(() => toOrdinal(12))).toBe('12th');
    expect(await page.evaluate(() => toOrdinal(13))).toBe('13th');
  });

  test('teen exception applies in higher hundreds — 111/112/113 → 111th/112th/113th', async ({ page }) => {
    expect(await page.evaluate(() => toOrdinal(111))).toBe('111th');
    expect(await page.evaluate(() => toOrdinal(112))).toBe('112th');
    expect(await page.evaluate(() => toOrdinal(113))).toBe('113th');
  });

  // Mod-10 = 1
  test('mod-10 = 1 (non-teen) → Nst', async ({ page }) => {
    expect(await page.evaluate(() => toOrdinal(1))).toBe('1st');
    expect(await page.evaluate(() => toOrdinal(21))).toBe('21st');
    expect(await page.evaluate(() => toOrdinal(31))).toBe('31st');
    expect(await page.evaluate(() => toOrdinal(121))).toBe('121st');
  });

  // Mod-10 = 2
  test('mod-10 = 2 (non-teen) → Nnd', async ({ page }) => {
    expect(await page.evaluate(() => toOrdinal(2))).toBe('2nd');
    expect(await page.evaluate(() => toOrdinal(22))).toBe('22nd');
    expect(await page.evaluate(() => toOrdinal(32))).toBe('32nd');
  });

  // Mod-10 = 3
  test('mod-10 = 3 (non-teen) → Nrd', async ({ page }) => {
    expect(await page.evaluate(() => toOrdinal(3))).toBe('3rd');
    expect(await page.evaluate(() => toOrdinal(23))).toBe('23rd');
    expect(await page.evaluate(() => toOrdinal(33))).toBe('33rd');
  });

  // Mod-10 = 0 / 4-9 → Nth
  test('mod-10 = 0 or 4-9 → Nth', async ({ page }) => {
    expect(await page.evaluate(() => toOrdinal(4))).toBe('4th');
    expect(await page.evaluate(() => toOrdinal(5))).toBe('5th');
    expect(await page.evaluate(() => toOrdinal(9))).toBe('9th');
    expect(await page.evaluate(() => toOrdinal(10))).toBe('10th');
    expect(await page.evaluate(() => toOrdinal(20))).toBe('20th');
    expect(await page.evaluate(() => toOrdinal(100))).toBe('100th');
  });

  // String-input tolerance (parseInt) — districts come from FEC as strings
  test('string inputs parsed via parseInt — "03" → "3rd"', async ({ page }) => {
    expect(await page.evaluate(() => toOrdinal('03'))).toBe('3rd');
    expect(await page.evaluate(() => toOrdinal('11'))).toBe('11th');
  });
});
