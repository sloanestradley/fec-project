/**
 * spend-helpers.spec.js — Unit-style coverage of purposeBucket (Spent-tab
 * Purpose bars classification) and ENTITY_TYPE_LABELS (Schedule A/B
 * contributor/recipient entity-type lookup) via page.evaluate.
 *
 * T-fixture-coverage-tier1-2 (2026-06-01). Closes audit gaps surfaced in
 * strategy/fixture-coverage-audit.md:
 *   - Tier 1 #4: purposeBucket for 6 untested buckets + Other fallback
 *     (existing fixtures cover only Digital & Online, Staff & Payroll,
 *     and Consulting via DIGITAL ADVERTISING / PAYROLL / CONSULTING
 *     in DISBURSEMENTS mock)
 *   - Tier 2 #7: ENTITY_TYPE_LABELS structure lock (ORG + CAN especially —
 *     ORG appears in dark-money detection per project-brief.md Phase 4)
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude } from './helpers/amp-mock.js';

const PAGE = '/design-system.html';

test.beforeEach(async ({ page }) => {
  await mockAmplitude(page);
  await page.goto(PAGE);
});

// ── purposeBucket ────────────────────────────────────────────────────────────
// Each bucket should match for every keyword in its PURPOSE_MAP entry.
// Pattern-order matters — when a description contains keywords from multiple
// buckets, the bucket listed first in PURPOSE_MAP wins (per CLAUDE.md note:
// "Patterns ordered so more-specific descriptions match before broad ones").

test.describe('purposeBucket — bucket matching', () => {
  test('TV & Radio — all 5 keywords', async ({ page }) => {
    expect(await page.evaluate(() => purposeBucket('TELEVISION COMMERCIAL'))).toBe('TV & Radio');
    expect(await page.evaluate(() => purposeBucket('RADIO ADVERTISING'))).toBe('TV & Radio');
    expect(await page.evaluate(() => purposeBucket('BROADCAST PRODUCTION'))).toBe('TV & Radio');
    expect(await page.evaluate(() => purposeBucket('MEDIA ADVERTISING FEES'))).toBe('TV & Radio');
    expect(await page.evaluate(() => purposeBucket('MEDIA PRODUCTION SERVICES'))).toBe('TV & Radio');
  });

  test('Digital & Online — all 5 keywords', async ({ page }) => {
    expect(await page.evaluate(() => purposeBucket('DIGITAL ADVERTISING'))).toBe('Digital & Online');
    expect(await page.evaluate(() => purposeBucket('ONLINE ADVERTISING SPEND'))).toBe('Digital & Online');
    expect(await page.evaluate(() => purposeBucket('EMAIL CAMPAIGN'))).toBe('Digital & Online');
    expect(await page.evaluate(() => purposeBucket('TEXT MESSAGING SERVICE'))).toBe('Digital & Online');
    expect(await page.evaluate(() => purposeBucket('INTERNET ADVERTISING'))).toBe('Digital & Online');
  });

  test('Direct Mail — all 3 keywords', async ({ page }) => {
    expect(await page.evaluate(() => purposeBucket('DIRECT MAIL CAMPAIGN'))).toBe('Direct Mail');
    expect(await page.evaluate(() => purposeBucket('POSTAGE FEES'))).toBe('Direct Mail');
    expect(await page.evaluate(() => purposeBucket('MAILING SERVICE'))).toBe('Direct Mail');
  });

  test('Printing — keyword', async ({ page }) => {
    expect(await page.evaluate(() => purposeBucket('PRINTING SERVICES'))).toBe('Printing');
    expect(await page.evaluate(() => purposeBucket('CAMPAIGN PRINTING'))).toBe('Printing');
  });

  test('Staff & Payroll — all 4 keywords', async ({ page }) => {
    expect(await page.evaluate(() => purposeBucket('SALARY EXPENSE'))).toBe('Staff & Payroll');
    expect(await page.evaluate(() => purposeBucket('PAYROLL'))).toBe('Staff & Payroll');
    expect(await page.evaluate(() => purposeBucket('STAFF WAGES'))).toBe('Staff & Payroll');
    expect(await page.evaluate(() => purposeBucket('PERSONNEL FEES'))).toBe('Staff & Payroll');
  });

  test('Legal & Compliance — all 3 keywords', async ({ page }) => {
    expect(await page.evaluate(() => purposeBucket('LEGAL FEES'))).toBe('Legal & Compliance');
    expect(await page.evaluate(() => purposeBucket('COMPLIANCE CONSULTING'))).toBe('Legal & Compliance');
    expect(await page.evaluate(() => purposeBucket('ACCOUNTING SERVICES'))).toBe('Legal & Compliance');
  });

  test('Events & Travel — all 8 keywords', async ({ page }) => {
    expect(await page.evaluate(() => purposeBucket('CATERING SERVICES'))).toBe('Events & Travel');
    expect(await page.evaluate(() => purposeBucket('HOTEL LODGING'))).toBe('Events & Travel');
    expect(await page.evaluate(() => purposeBucket('AIR TRAVEL FEES'))).toBe('Events & Travel');
    expect(await page.evaluate(() => purposeBucket('TRAVEL EXPENSE'))).toBe('Events & Travel');
    expect(await page.evaluate(() => purposeBucket('EVENT SUPPLIES'))).toBe('Events & Travel');
    expect(await page.evaluate(() => purposeBucket('SITE RENTAL'))).toBe('Events & Travel');
    expect(await page.evaluate(() => purposeBucket('VENUE BOOKING'))).toBe('Events & Travel');
    expect(await page.evaluate(() => purposeBucket('HOTEL BOOKING'))).toBe('Events & Travel');
  });

  test('Consulting — all 5 keywords', async ({ page }) => {
    expect(await page.evaluate(() => purposeBucket('CONSULTING FEES'))).toBe('Consulting');
    expect(await page.evaluate(() => purposeBucket('CAMPAIGN STRATEGY'))).toBe('Consulting');
    expect(await page.evaluate(() => purposeBucket('CAMPAIGN ADVISOR'))).toBe('Consulting');
    expect(await page.evaluate(() => purposeBucket('POLLING SERVICES'))).toBe('Consulting');
    expect(await page.evaluate(() => purposeBucket('OPPOSITION RESEARCH'))).toBe('Consulting');
  });
});

test.describe('purposeBucket — pattern-order precedence + fallback', () => {
  test('Pattern order — DIGITAL CONSULTING matches Digital & Online (first), not Consulting', async ({ page }) => {
    // CLAUDE.md explicitly calls this out: "DIGITAL CONSULTING → Digital & Online
    // (DIGITAL matches first)". Lock the precedence.
    const r = await page.evaluate(() => purposeBucket('DIGITAL CONSULTING'));
    expect(r).toBe('Digital & Online');
  });

  test('Pattern order — TV ADVERTISING CONSULTING matches TV & Radio (TELEVISION precedes CONSULTING)', async ({ page }) => {
    // Note: 'TV' isn't a keyword; 'TELEVISION' is. Use a description that
    // actually contains the keyword.
    const r = await page.evaluate(() => purposeBucket('TELEVISION CONSULTING'));
    expect(r).toBe('TV & Radio');
  });

  test('Other fallback — no keyword match → "Other"', async ({ page }) => {
    expect(await page.evaluate(() => purposeBucket('OFFICE SUPPLIES'))).toBe('Other');
    expect(await page.evaluate(() => purposeBucket('MISCELLANEOUS'))).toBe('Other');
    expect(await page.evaluate(() => purposeBucket(''))).toBe('Other');
    expect(await page.evaluate(() => purposeBucket(null))).toBe('Other');
    expect(await page.evaluate(() => purposeBucket(undefined))).toBe('Other');
  });

  test('Case insensitivity — lowercase input matches uppercase patterns', async ({ page }) => {
    // PURPOSE_MAP patterns are uppercase; purposeBucket uppercases the input
    // before comparison. Lock this contract — FEC sometimes returns mixed case.
    expect(await page.evaluate(() => purposeBucket('digital advertising'))).toBe('Digital & Online');
    expect(await page.evaluate(() => purposeBucket('Payroll'))).toBe('Staff & Payroll');
  });
});

// ── ENTITY_TYPE_LABELS ───────────────────────────────────────────────────────

test.describe('ENTITY_TYPE_LABELS — structure lock', () => {
  test('every documented FEC entity type maps to its expected label', async ({ page }) => {
    const labels = await page.evaluate(() => ({
      PAC: ENTITY_TYPE_LABELS.PAC,
      PTY: ENTITY_TYPE_LABELS.PTY,
      COM: ENTITY_TYPE_LABELS.COM,
      CCM: ENTITY_TYPE_LABELS.CCM,
      ORG: ENTITY_TYPE_LABELS.ORG,
      CAN: ENTITY_TYPE_LABELS.CAN,
      IND: ENTITY_TYPE_LABELS.IND
    }));
    expect(labels).toEqual({
      PAC: 'PAC',
      PTY: 'Party committee',
      COM: 'Committee',
      CCM: 'Candidate committee',
      ORG: 'Organization',
      CAN: 'Candidate (self)',
      IND: 'Individual'
    });
  });

  test('unmapped entity type returns undefined (consumers use || fallback)', async ({ page }) => {
    // Consumer-side pattern is `ENTITY_TYPE_LABELS[d.entity_type] || 'Committee'`.
    // Lock the undefined return so the fallback path stays predictable.
    const r = await page.evaluate(() => ENTITY_TYPE_LABELS.UNKNOWN_TYPE);
    expect(r).toBeUndefined();
  });
});
