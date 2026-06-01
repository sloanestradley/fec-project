/**
 * party-helpers.spec.js — Unit-style coverage of partyClass + partyLabel via
 * page.evaluate. Tests run against /design-system.html — any page that loads
 * utils.js works; design-system needs no API mocking and has the most stable
 * init path.
 *
 * T-party-helpers-dual-field-rewrite (2026-06-01). Locks the dual-field
 * contract in test coverage so a future "simplify back to primary" refactor
 * can't silently regress it. Covers all the failure modes that motivated the
 * rewrite (PPP / DFL / UNAFFILIATED cross-surface cases) plus the full
 * dual-field decision table.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude } from './helpers/amp-mock.js';

const PAGE = '/design-system.html';

// Helper to call both party helpers in one round-trip via page.evaluate.
async function call(page, p, party_full) {
  return page.evaluate(({ p, pf }) => ({
    label: partyLabel(p, pf),
    cls:   partyClass(p, pf)
  }), { p, pf: party_full });
}

test.beforeEach(async ({ page }) => {
  await mockAmplitude(page);
  await page.goto(PAGE);
});

// ── Mainstream parties — short code, full name only, both set ────────────────

test.describe('partyHelpers — mainstream parties', () => {
  test('DEM short code → Democrat + tag-dem', async ({ page }) => {
    const r = await call(page, 'DEM', null);
    expect(r).toEqual({ label: 'Democrat', cls: 'tag-dem' });
  });

  test('DEMOCRATIC PARTY full name only → Democrat + tag-dem', async ({ page }) => {
    const r = await call(page, null, 'DEMOCRATIC PARTY');
    expect(r).toEqual({ label: 'Democrat', cls: 'tag-dem' });
  });

  test('DEM + DEMOCRATIC PARTY both set → Democrat + tag-dem (cross-surface invariant)', async ({ page }) => {
    const r = await call(page, 'DEM', 'DEMOCRATIC PARTY');
    expect(r).toEqual({ label: 'Democrat', cls: 'tag-dem' });
  });

  test('REP short code → Republican + tag-rep', async ({ page }) => {
    const r = await call(page, 'REP', null);
    expect(r).toEqual({ label: 'Republican', cls: 'tag-rep' });
  });

  test('REPUBLICAN PARTY full name only → Republican + tag-rep', async ({ page }) => {
    const r = await call(page, null, 'REPUBLICAN PARTY');
    expect(r).toEqual({ label: 'Republican', cls: 'tag-rep' });
  });

  test('LIB / GRE / IND short codes → mapped labels + tag-ind', async ({ page }) => {
    expect(await call(page, 'LIB', null)).toEqual({ label: 'Libertarian', cls: 'tag-ind' });
    expect(await call(page, 'GRE', null)).toEqual({ label: 'Green Party', cls: 'tag-ind' });
    expect(await call(page, 'IND', null)).toEqual({ label: 'Independent', cls: 'tag-ind' });
  });

  test('lowercase short code still resolves (toUpperCase)', async ({ page }) => {
    const r = await call(page, 'dem', null);
    expect(r).toEqual({ label: 'Democrat', cls: 'tag-dem' });
  });
});

// ── N/A bucket — every short code + every verified full-name form ────────────

test.describe('partyHelpers — N/A bucket', () => {
  const shortCodes = ['NNE', 'NON', 'UNK', 'OTH', 'NPA', 'UN', 'W', 'O'];
  const fullNames  = ['NONE', 'NON-PARTY', 'UNKNOWN', 'OTHER', 'NO PARTY AFFILIATION', 'UNAFFILIATED', 'WRITE-IN'];

  for (const sc of shortCodes) {
    test(`short code ${sc} → Party N/A + tag-neutral`, async ({ page }) => {
      const r = await call(page, sc, null);
      expect(r).toEqual({ label: 'Party N/A', cls: 'tag-neutral' });
    });
  }

  for (const fn of fullNames) {
    test(`full name "${fn}" only → Party N/A + tag-neutral`, async ({ page }) => {
      const r = await call(page, null, fn);
      expect(r).toEqual({ label: 'Party N/A', cls: 'tag-neutral' });
    });
  }

  test('UN + UNAFFILIATED both set → Party N/A (Macruari H0NY02291 case)', async ({ page }) => {
    const r = await call(page, 'UN', 'UNAFFILIATED');
    expect(r).toEqual({ label: 'Party N/A', cls: 'tag-neutral' });
  });

  test('empty both → Party N/A + tag-neutral (Kanye case)', async ({ page }) => {
    expect(await call(page, null, null)).toEqual({ label: 'Party N/A', cls: 'tag-neutral' });
    expect(await call(page, '',   '')).toEqual({ label: 'Party N/A', cls: 'tag-neutral' });
  });
});

// ── Variant Democratic/Republican affiliates ─────────────────────────────────

test.describe('partyHelpers — variant affiliates (DFL et al.)', () => {
  test('DFL short + DEMOCRATIC-FARMER-LABOR full → full name preserved + tag-dem (Feehan H8MN01279 case)', async ({ page }) => {
    const r = await call(page, 'DFL', 'DEMOCRATIC-FARMER-LABOR');
    expect(r).toEqual({ label: 'DEMOCRATIC-FARMER-LABOR', cls: 'tag-dem' });
  });

  test('DEMOCRATIC-FARMER-LABOR full name only → full name preserved + tag-dem (race.html-side of Feehan)', async ({ page }) => {
    const r = await call(page, null, 'DEMOCRATIC-FARMER-LABOR');
    expect(r).toEqual({ label: 'DEMOCRATIC-FARMER-LABOR', cls: 'tag-dem' });
  });

  test('hypothetical Republican-affiliate variant → full name preserved + tag-rep', async ({ page }) => {
    const r = await call(page, null, 'REPUBLICAN PARTY OF FLORIDA');
    expect(r).toEqual({ label: 'REPUBLICAN PARTY OF FLORIDA', cls: 'tag-rep' });
  });

  test('asymmetric rule (partyLabel exact / partyClass startsWith) — DFL does NOT collapse to "Democrat"', async ({ page }) => {
    // The deliberate asymmetry that motivated the structural rewrite. partyLabel
    // must preserve variant identity (exact match against fullMap, never startsWith).
    const r = await call(page, 'DFL', 'DEMOCRATIC-FARMER-LABOR');
    expect(r.label).not.toBe('Democrat');
    expect(r.cls).toBe('tag-dem');
  });
});

// ── Other unmapped third parties (with party_full) ───────────────────────────

test.describe('partyHelpers — other unmapped third parties', () => {
  test('AIP + AMERICAN INDEPENDENT PARTY → full name + tag-ind', async ({ page }) => {
    const r = await call(page, 'AIP', 'AMERICAN INDEPENDENT PARTY');
    expect(r).toEqual({ label: 'AMERICAN INDEPENDENT PARTY', cls: 'tag-ind' });
  });

  test('full name only (no short code) → full name + tag-ind', async ({ page }) => {
    const r = await call(page, null, 'CONSTITUTION PARTY');
    expect(r).toEqual({ label: 'CONSTITUTION PARTY', cls: 'tag-ind' });
  });
});

// ── Cryptic unmapped short code without party_full (PPP case) ────────────────

test.describe('partyHelpers — cryptic short code without party_full', () => {
  test('PPP short code, null full → Party N/A + tag-neutral (Ross H0NY03067 case)', async ({ page }) => {
    const r = await call(page, 'PPP', null);
    expect(r).toEqual({ label: 'Party N/A', cls: 'tag-neutral' });
  });

  test('arbitrary cryptic code, null full → Party N/A + tag-neutral', async ({ page }) => {
    const r = await call(page, 'XYZ', null);
    expect(r).toEqual({ label: 'Party N/A', cls: 'tag-neutral' });
  });
});

// ── Cross-surface invariant ──────────────────────────────────────────────────
// The whole point of the dual-field rewrite: the same candidate, fed by
// different endpoints (with different field-population patterns), must
// produce the same label and color.

test.describe('partyHelpers — cross-surface invariant', () => {
  const cases = [
    // [description, candidatePageInput, racePageInput]
    ['Trump-style Republican',          ['REP', 'REPUBLICAN PARTY'],         [null, 'REPUBLICAN PARTY']],
    ['Marie-style Democrat',            ['DEM', 'DEMOCRATIC PARTY'],         [null, 'DEMOCRATIC PARTY']],
    ['Feehan H8MN01279 (DFL)',          ['DFL', 'DEMOCRATIC-FARMER-LABOR'],  [null, 'DEMOCRATIC-FARMER-LABOR']],
    ['Macruari H0NY02291 (UN)',         ['UN',  'UNAFFILIATED'],             [null, 'UNAFFILIATED']],
    ['Ross H0NY03067 (PPP, null full)', ['PPP', null],                       [null, null]],
    ['Kanye-style (both null)',         [null,  null],                       [null, null]],
  ];

  for (const [desc, candidateInput, raceInput] of cases) {
    test(`${desc} — same label + class on both surfaces`, async ({ page }) => {
      const fromCandidate = await call(page, candidateInput[0], candidateInput[1]);
      const fromRace      = await call(page, raceInput[0],      raceInput[1]);
      expect(fromRace).toEqual(fromCandidate);
    });
  }
});
