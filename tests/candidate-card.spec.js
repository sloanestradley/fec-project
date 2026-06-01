/**
 * candidate-card.spec.js — Unit-style coverage of candidateCardHTML(c, opts)
 * via page.evaluate. Tests run against /design-system.html — any page that
 * loads utils.js works; design-system needs no API mocking.
 *
 * T-card-builder-consolidation (2026-06-01). Locks the opts surface that
 * three prior surfaces depend on (candidates+search 'meta' default, race.html
 * 'inline'+stats+incumbent+cycleHashYear, committee.html assoc-card 'meta'
 * with trackEvent:null). Prevents a future "simplify back to one fixed
 * layout" from silently breaking any of the three.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude } from './helpers/amp-mock.js';

const PAGE = '/design-system.html';

const TRUMP = {
  candidate_id: 'P00000001',
  name: 'TRUMP, DONALD J.',
  party: 'REP',
  party_full: 'REPUBLICAN PARTY',
  office: 'P',
  state: 'US',
  district: '00',
  election_years: [2020, 2024],
  incumbent_challenge: 'I',
  incumbent_challenge_full: 'Incumbent',
  total_receipts: 50000000,
  total_disbursements: 45000000,
  cash_on_hand_end_period: 5000000
};

// Helper: render the card and return parsed structural facts via page.evaluate.
// `rawHtml` is the unparsed string from candidateCardHTML — use it for onclick
// inspection because the embedded JSON.stringify output's inner quotes
// terminate the attribute when the browser parses it (getAttribute('onclick')
// returns a truncated value, which is fine in production where the click
// handler still fires correctly but breaks string assertions in tests).
async function render(page, c, opts) {
  return page.evaluate(({ c, opts }) => {
    const html = candidateCardHTML(c, opts || {});
    const wrap = document.createElement('div');
    wrap.innerHTML = html;
    const a = wrap.querySelector('a.candidate-card');
    const nameEl = a.querySelector('.candidate-card-name');
    const metaEl = a.querySelector('.candidate-card-meta');
    const statsEl = a.querySelector('.candidate-card-stats');
    const tagsInName = nameEl ? Array.from(nameEl.querySelectorAll('.tag')).map(t => t.className + '|' + t.textContent) : [];
    const tagsInMeta = metaEl ? Array.from(metaEl.querySelectorAll('.tag')).map(t => t.className + '|' + t.textContent) : [];
    return {
      rawHtml: html,
      href: a.getAttribute('href'),
      hasOnclickAttr: a.hasAttribute('onclick'),
      nameText: nameEl ? nameEl.firstChild.textContent.trim() : '',
      hasMeta: !!metaEl,
      hasStats: !!statsEl,
      hasIncumbent: !!a.querySelector('.tag-inc'),
      tagsInName,
      tagsInMeta
    };
  }, { c, opts });
}

test.beforeEach(async ({ page }) => {
  await mockAmplitude(page);
  await page.goto(PAGE);
});

// ── Default 'meta' layout (candidates+search shape) ──────────────────────────

test.describe('candidateCardHTML — default meta layout', () => {
  test('default opts → 3-tag meta block (office + cycle + party), no stats, no incumbent', async ({ page }) => {
    const r = await render(page, TRUMP);
    expect(r.hasMeta).toBe(true);
    expect(r.hasStats).toBe(false);
    expect(r.hasIncumbent).toBe(false);
    expect(r.tagsInName).toEqual([]);
    expect(r.tagsInMeta.length).toBe(3);  // office + cycle + party
    expect(r.tagsInMeta[2]).toMatch(/tag-rep/);
    expect(r.tagsInMeta[2]).toContain('Republican');
  });

  test('href includes ?from=fromPage', async ({ page }) => {
    const r = await render(page, TRUMP, { fromPage: 'candidates' });
    expect(r.href).toBe('/candidate/P00000001?from=candidates');
  });

  test('onclick fires Amplitude track with default event name + candidate_name', async ({ page }) => {
    const r = await render(page, TRUMP);
    expect(r.rawHtml).toContain('Candidate Result Clicked');
    expect(r.rawHtml).toContain('candidate_name');
  });
});

// ── 'inline' layout (race.html shape) ────────────────────────────────────────

test.describe('candidateCardHTML — inline layout (race.html shape)', () => {
  test('layoutVariant inline + opts → tags inline in name, stats row, no meta block', async ({ page }) => {
    const r = await render(page, TRUMP, {
      layoutVariant: 'inline',
      showOffice: false,
      showLatestCycle: false,
      showIncumbent: true,
      showStats: true,
      cycleHashYear: 2024,
      fromPage: 'race',
      includeName: false,
      extraTrackProps: { race_year: 2024 }
    });
    expect(r.hasMeta).toBe(false);
    expect(r.hasStats).toBe(true);
    expect(r.hasIncumbent).toBe(true);
    expect(r.tagsInName.length).toBe(2);  // party + incumbent
    expect(r.tagsInName[0]).toMatch(/tag-rep/);
    expect(r.tagsInName[1]).toMatch(/tag-inc/);
  });

  test('cycleHashYear appends #year#summary to href', async ({ page }) => {
    const r = await render(page, TRUMP, { cycleHashYear: 2024, fromPage: 'race' });
    expect(r.href).toBe('/candidate/P00000001?from=race#2024#summary');
  });

  test('includeName:false omits candidate_name from amplitude payload', async ({ page }) => {
    const r = await render(page, TRUMP, { fromPage: 'race', includeName: false });
    expect(r.rawHtml).not.toContain('candidate_name');
  });

  test('extraTrackProps merges into amplitude payload', async ({ page }) => {
    const r = await render(page, TRUMP, { fromPage: 'race', extraTrackProps: { race_year: 2024 } });
    expect(r.rawHtml).toContain('race_year');
    expect(r.rawHtml).toContain('2024');
  });

  test('showStats:true with no totals → stats row omitted (defensive)', async ({ page }) => {
    const { total_receipts, total_disbursements, ...noTotals } = TRUMP;
    const c = { ...noTotals, total_receipts: null, total_disbursements: null };
    const r = await render(page, c, { layoutVariant: 'inline', showStats: true });
    expect(r.hasStats).toBe(false);
  });
});

// ── 'meta' layout, opted-out trackEvent (committee assoc-card shape) ─────────

test.describe('candidateCardHTML — committee assoc-card shape', () => {
  test('showLatestCycle:false → cycle tag omitted; meta block has office + party only', async ({ page }) => {
    const r = await render(page, TRUMP, { showLatestCycle: false, trackEvent: null, fromPage: 'committee-assoc' });
    expect(r.tagsInMeta.length).toBe(2);   // office + party (no cycle)
  });

  test('trackEvent:null → no onclick handler at all', async ({ page }) => {
    const r = await render(page, TRUMP, { trackEvent: null });
    expect(r.hasOnclickAttr).toBe(false);
    expect(r.rawHtml).not.toContain('onclick');
  });
});

// ── Robust id + name extraction ──────────────────────────────────────────────

test.describe('candidateCardHTML — robust extraction', () => {
  test('candidate_ids[0] fallback when candidate_id missing (race.html /elections/ shape)', async ({ page }) => {
    const c = { ...TRUMP, candidate_id: null, candidate_ids: ['P00000001'] };
    const r = await render(page, c);
    expect(r.href).toContain('/candidate/P00000001');
  });

  test('candidate_name fallback when name missing (race.html shape)', async ({ page }) => {
    const c = { ...TRUMP, name: null, candidate_name: 'TRUMP, DONALD J.' };
    const r = await render(page, c);
    expect(r.nameText).toBe('Donald J. Trump');
  });

  test('both fields missing → href is # placeholder, no broken /candidate/ link', async ({ page }) => {
    const c = { ...TRUMP, candidate_id: null, candidate_ids: null };
    const r = await render(page, c);
    expect(r.href).toBe('#');
  });
});
