/**
 * candidate.spec.js — Structural tests for candidate.html.
 *
 * Uses mocked FEC API (no real network) and mocked Amplitude.
 * Tests cover: profile header, cycle switcher, stats row, health banner,
 * chart canvas, tab navigation, committees modal, and Amplitude events.
 *
 * Test URL: /candidate.html?id=H2WA03217#2024#summary (detail view; bare URL → index view)
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

// Hash required to land in detail view (bare URL now shows index view — T5/T6 CareerStrip)
const CANDIDATE_URL = '/candidate.html?id=H2WA03217#2024#summary';

// Shared setup: mock + load + wait for profile to render
async function setup(page) {
  await mockAmplitude(page);
  await mockFecApi(page);
  await page.goto(CANDIDATE_URL);
  await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
}

// Wait for content area (stats, chart)
async function setupWithContent(page) {
  await setup(page);
  await page.waitForSelector('#content.visible', { timeout: 12000 });
}

// Open the committees modal via the profile menu-btn (T-menu-btn-profile-header
// replaced the .committees-link trigger). Two clicks: open the menu, click the
// Committees item.
async function openCommittees(page) {
  await page.locator('#profile-menu-btn .menu-btn').click();
  await page.locator('.menu-item[data-item-id="committees"]').click();
}

// 9c (profile flatten — breakdown slot toggle): the slot is Money flow (Sankey)
// XOR the Raised/Spent donut pair, MUTUALLY EXCLUSIVE on the gate. The default
// House fixture is IN-SCOPE → Sankey shown, donut pair hidden. To exercise the
// donut RENDER path (legend/wedges/center/skeleton), the entity must be GATED.
// This override flips candidate metadata → office 'P' (Form 3P → gated), so the
// slot mounts the donut pair; base totals fall through unchanged, so the donut
// renders the same fixture financials in its gated home. Call AFTER mockFecApi,
// BEFORE page.goto (later route registration wins; non-metadata candidate URLs
// fall back to the base mock — same pattern as the presidential gate block).
async function routeGatedCandidate(page) {
  await page.route('**/api/fec/candidate/H2WA03217/**', (route) => {
    const url = route.request().url();
    if (/\/candidate\/H2WA03217\/(?:\?|$)/.test(url)) {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results: [{ candidate_id: 'H2WA03217', name: 'PEREZ, MARIE GLUESENKAMP', party: 'DEM',
          party_full: 'DEMOCRATIC PARTY', office: 'P', office_full: 'President', state: 'US',
          election_years: [2024], incumbent_challenge: 'C', first_file_date: '2023-01-01' }],
        pagination: { count: 1, pages: 1, per_page: 20, page: 1 } }) });
    } else { route.fallback(); }
  });
}

// Gated setup with no extra per-test routes: mock + office-P override + load detail.
async function setupGatedDonuts(page) {
  await mockAmplitude(page);
  await mockFecApi(page);
  await routeGatedCandidate(page);
  await page.goto(CANDIDATE_URL);
  await page.waitForSelector('#content.visible', { timeout: 12000 });
}

// ── Profile header ────────────────────────────────────────────────────────────

test.describe('candidate.html — profile header', () => {
  test('candidate name is displayed and not placeholder', async ({ page }) => {
    await setup(page);
    const name = page.locator('#candidate-name');
    await expect(name).not.toHaveText('—');
    const text = await name.textContent();
    expect(text?.trim().length).toBeGreaterThan(3);
  });

  test('party tag is visible in meta-row', async ({ page }) => {
    await setup(page);
    const metaRow = page.locator('#meta-row');
    await expect(metaRow).toBeVisible();
    const tags = metaRow.locator('.tag');
    await expect(tags).not.toHaveCount(0);
  });

  test('race tag is present in meta-row as a .tag-neutral (between FEC ID and party)', async ({ page }) => {
    await setup(page);
    // Race tag is the second meta-row child after the simplification — a .tag-neutral
    // that is NOT the .fec-id-tag. Content is short-form formatRaceName().
    const raceTag = page.locator('#meta-row > .tag-neutral:not(.fec-id-tag)');
    await expect(raceTag).toHaveCount(1);
    // Test candidate H2WA03217 → House WA-03 → "House • WA-03"
    await expect(raceTag).toContainText('House');
    await expect(raceTag).toContainText('WA');
  });

  test('meta-row has no .candidate-race-label (replaced with .tag-neutral race tag)', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#meta-row .candidate-race-label')).toHaveCount(0);
  });

  test('FEC ID tag renders with candidate ID text', async ({ page }) => {
    await setup(page);
    const fec = page.locator('#meta-row .fec-id-tag');
    await expect(fec).toBeVisible();
    await expect(fec).toHaveText(/FEC ID · H2WA03217/);
  });

  test('meta-row lives inside .title-meta-stack alongside .page-title (T-meta-row-column)', async ({ page }) => {
    // Architectural regression-lock: the meta-row is a descendant of
    // .title-meta-stack (which is itself a child of .profile-header-row),
    // sibling of .page-title. This keeps the meta-row's parent IS the
    // title-zone so its box can't extend into the menu-btn's column.
    await setup(page);
    await expect(page.locator('#profile-header > #meta-row')).toHaveCount(0);
    await expect(page.locator('#profile-header > .profile-header-row > .title-meta-stack > #meta-row')).toHaveCount(1);
    await expect(page.locator('#profile-header > .profile-header-row > .title-meta-stack > #candidate-name')).toHaveCount(1);
  });

  test('meta-row children render in canonical order: FEC ID → race → party → incumbent', async ({ page }) => {
    await setup(page);
    // MGP is the incumbent in the mock fixture; all four children should be present.
    const roles = await page.locator('#meta-row > *').evaluateAll(nodes => nodes.map(n => {
      if (n.classList.contains('fec-id-tag')) return 'fec-id';
      if (n.classList.contains('tag-dem') || n.classList.contains('tag-rep') || n.classList.contains('tag-ind')) return 'party';
      if (n.classList.contains('tag-inc')) return 'incumbent';
      if (n.classList.contains('tag-neutral')) return 'race';
      return 'other:' + n.className;
    }));
    expect(roles).toEqual(['fec-id', 'race', 'party', 'incumbent']);
  });

  test('race-context element is present in meta-row', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#race-context')).toBeAttached();
  });

  test('race-context renders race-context-line with label, text span, and view-race link', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#race-context .race-context-line')).toBeAttached();
    await expect(page.locator('#race-context .race-context-line .race-context-line-label')).toBeAttached();
    await expect(page.locator('#race-context .race-context-line .race-context-line-text')).toBeAttached();
    await expect(page.locator('#race-context .race-context-line a')).toBeAttached();
    // Label content matches formatRaceLabelLong() output for the test candidate (House WA-03)
    await expect(page.locator('#race-context .race-context-line-label')).toContainText('US House');
    await expect(page.locator('#race-context .race-context-line-label')).toContainText('Washington');
  });

  test('profile header sentinel exists for compact observer', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#profile-header-sentinel')).toBeAttached();
  });

  // ── T-menu-btn — race-context link repoint ─────────────────────────────────
  // The race-context-bar "View race →" link previously built its href inline
  // with a broken construction (Presidential → empty state=, at-large House →
  // missing district). Now uses raceHref() which fixes both cases.

  test('race-context "View race →" href is correct for a Presidential candidate (state=US)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Override only the entity endpoint to return a Presidential profile.
    // Regex matches the bare /candidate/{id}/ entity URL (followed by '?' from
    // apiFetch's querystring), not the /totals/ or /history/ sub-paths.
    await page.route(/\/api\/fec\/candidate\/H2WA03217\/\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            candidate_id: 'H2WA03217',
            name: 'GLUESENKAMP PEREZ, MARIE',
            party: 'DEM',
            party_full: 'DEMOCRATIC PARTY',
            office: 'P',
            office_full: 'President',
            state: '',
            district: '',
            election_years: [2024],
            incumbent_challenge: 'C',
            incumbent_challenge_full: 'Challenger',
            first_file_date: '2022-02-22',
          }],
          pagination: { count: 1, pages: 1, per_page: 20, page: 1 },
        }),
      });
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    // Wait for the race-context link to be populated by loadCycle
    await page.waitForSelector('#race-context .race-context-line a', { timeout: 12000 });
    const href = await page.locator('#race-context .race-context-line a').getAttribute('href');
    expect(href).toBe('/race?state=US&office=P&year=2024');
  });

  test('race-context "View race →" href is correct for an at-large House candidate (district=00)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route(/\/api\/fec\/candidate\/H2WA03217\/\?/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            candidate_id: 'H2WA03217',
            name: 'GLUESENKAMP PEREZ, MARIE',
            party: 'DEM',
            party_full: 'DEMOCRATIC PARTY',
            office: 'H',
            office_full: 'House',
            state: 'AK',
            district: '00',          // at-large
            election_years: [2024],
            incumbent_challenge: 'C',
            incumbent_challenge_full: 'Challenger',
            first_file_date: '2022-02-22',
          }],
          pagination: { count: 1, pages: 1, per_page: 20, page: 1 },
        }),
      });
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await page.waitForSelector('#race-context .race-context-line a', { timeout: 12000 });
    const href = await page.locator('#race-context .race-context-line a').getAttribute('href');
    expect(href).toBe('/race?state=AK&office=H&year=2024&district=00');
  });

  test('Cycle card with back chevron renders on cycle-detail view (T14.5)', async ({ page }) => {
    await setup(page); // setup uses #2024#summary URL — detail view
    await expect(page.locator('#summary-strip .stat-card-cycle')).toBeVisible();
    await expect(page.locator('#cycle-back-btn')).toBeVisible();
  });

  test('Cycle card chevron has correct aria-label (T14.5)', async ({ page }) => {
    await setup(page);
    const btn = page.locator('#cycle-back-btn');
    await expect(btn).toHaveAttribute('aria-label', 'Back to all cycles');
  });

  test('Cycle card chevron click on fresh-load detail returns to cycle index (T14.5)', async ({ page }) => {
    // setup() lands directly on detail URL via hash — indexScrollY=0 fallback
    await setup(page);
    await expect(page.locator('#content')).toBeVisible();
    await page.locator('#cycle-back-btn').click();
    await expect(page.locator('#cycle-index')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#content')).toBeHidden();
    expect(new URL(page.url()).hash).toBe('');
  });

  test('#stat-cycle shows election year on detail view (T-cycle-semantics, was T14.5)', async ({ page }) => {
    await setupWithContent(page);
    const cycleText = await page.locator('#stat-cycle').textContent();
    expect(cycleText?.trim()).toMatch(/^\d{4}$/);
  });

  test('Cycle card is hidden in cycle-index state (T14.5)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217'); // bare URL → index view
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#summary-strip')).toBeHidden();
    await expect(page.locator('#cycle-back-btn')).toBeHidden();
  });

  test('scrolling down adds .compact to profile header', async ({ page }) => {
    await setupWithContent(page);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(200); // wait past suppressUntil (100ms)
    await expect(page.locator('#profile-header')).toHaveClass(/compact/);
  });

  test('scrolling back to top removes .compact from profile header', async ({ page }) => {
    await setupWithContent(page);
    await page.evaluate(() => window.scrollTo(0, 200));
    // 300ms covers the 250ms suppression window so the second scrollTo
    // isn't dropped (bumped from 200ms in T-profile-header-transition).
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await expect(page.locator('#profile-header')).not.toHaveClass(/compact/);
  });

  test('.main has paddingBottom set when compact is active', async ({ page }) => {
    await setupWithContent(page);
    await page.evaluate(() => window.scrollTo(0, 200));
    await page.waitForTimeout(200);
    const pb = await page.locator('.main').evaluate(el => el.style.paddingBottom);
    const val = parseInt(pb);
    expect(val).toBeGreaterThan(0);
    expect(val).toBeLessThanOrEqual(80);
  });

  test('.main paddingBottom is cleared when compact disengages', async ({ page }) => {
    await setupWithContent(page);
    await page.evaluate(() => window.scrollTo(0, 200));
    // 300ms covers the 250ms suppression window so the second scrollTo
    // isn't dropped (bumped from 200ms in T-profile-header-transition).
    await page.waitForTimeout(300);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    const pb = await page.locator('.main').evaluate(el => el.style.paddingBottom);
    expect(pb).toBe('');
  });

  test('incumbent tag shown for incumbent candidate', async ({ page }) => {
    await setup(page);
    const tag = page.locator('#meta-row .tag-inc');
    await expect(tag).toBeVisible({ timeout: 5000 });
    await expect(tag).toHaveText('Incumbent');
  });

  test('profile menu-btn is revealed, ready immediately', async ({ page }) => {
    await setup(page);
    // T-menu-btn-profile-header: the .committees-link trigger was retired in
    // favor of the profile menu-btn. T11's committees fetch is still deferred
    // to modal-open — exercised by the openCommittees helper. Here we just
    // assert the menu-btn host is visible and renders the Committees item
    // (no count parenthetical, T11 behavior preserved).
    const host = page.locator('#profile-menu-btn');
    await expect(host).toBeVisible({ timeout: 8000 });
    await host.locator('.menu-btn').click();
    const item = page.locator('.menu-item[data-item-id="committees"]');
    await expect(item).toBeVisible();
    const text = await item.locator('.menu-item-label').textContent();
    expect(text?.trim()).toBe('Committees');
    expect(text).not.toMatch(/\(\d+\)/);
  });
});

// ── Stats row ────────────────────────────────────────────────────────────────

test.describe('candidate.html — stats row', () => {
  test('Raised shows a dollar amount (not $0 or placeholder)', async ({ page }) => {
    await setupWithContent(page);
    const raised = page.locator('#stat-raised');
    await expect(raised).not.toHaveText('—');
    const text = await raised.textContent();
    expect(text).toMatch(/\$[\d,.]+/);
    expect(text).not.toBe('$0');
  });

  test('Spent shows a dollar amount', async ({ page }) => {
    await setupWithContent(page);
    const spent = page.locator('#stat-spent');
    await expect(spent).not.toHaveText('—');
    const text = await spent.textContent();
    expect(text).toMatch(/\$[\d,.]+/);
  });

  test('Cash on Hand shows a dollar amount', async ({ page }) => {
    await setupWithContent(page);
    const coh = page.locator('#stat-coh');
    await expect(coh).not.toHaveText('—');
    const text = await coh.textContent();
    expect(text).toMatch(/\$[\d,.]+/);
  });

  test('Raised:Spent ratio shows a value', async ({ page }) => {
    await setupWithContent(page);
    const ratio = page.locator('#stat-ratio');
    await expect(ratio).not.toHaveText('—');
    const text = await ratio.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('Raised:Spent ratio label mounts the C4.d tooltip (absolute, no layout impact)', async ({ page }) => {
    await setupWithContent(page);
    const card = page.locator('.stat-card--has-info');
    await expect(card).toHaveCount(1);
    // Host is absolutely positioned (out of flow) so it can't grow the card / grid row.
    await expect(card.locator('> .tooltip')).toHaveCSS('position', 'absolute');
    const trigger = card.locator('.tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About the Raised:Spent ratio');
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Total receipts ÷ total disbursements');
  });
});

// ── Health banner ─────────────────────────────────────────────────────────────

test.describe('candidate.html — health banner', () => {
  test('banner-label has content', async ({ page }) => {
    await setupWithContent(page);
    const label = page.locator('#banner-label');
    await expect(label).not.toHaveText('—');
  });

  test('banner-desc has content', async ({ page }) => {
    await setupWithContent(page);
    const desc = page.locator('#banner-desc');
    const text = await desc.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  // T-remove-profile-tabs: detail view is a single flow — Summary/Raised/Spent
  // content all visible at once, no tabs to click. The summary-strip (persistent
  // stats + banner) sits above the flow and is always visible on detail.
  test('summary-strip (banner + stats) is visible on the flowing detail view', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .banner')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
  });

  test('first stat card is Election (T-cycle-semantics, was T14)', async ({ page }) => {
    await setupWithContent(page);
    const firstLabel = page.locator('#summary-strip .stats-grid .stat-card').first().locator('.stat-label');
    await expect(firstLabel).toHaveText('Election');
  });

  // T-remove-profile-tabs: #tabs-bar is gone; #summary-strip now precedes the
  // flowing #content directly.
  test('#summary-strip precedes #content in the DOM', async ({ page }) => {
    await setupWithContent(page);
    const stripBeforeContent = await page.evaluate(() => {
      const strip = document.querySelector('#summary-strip');
      const content = document.querySelector('#content');
      if (!strip || !content) return false;
      return !!(strip.compareDocumentPosition(content) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(stripBeforeContent).toBe(true);
  });

  test('#tabs-bar no longer exists on the page (T-remove-profile-tabs)', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#tabs-bar')).toHaveCount(0);
  });

  test('inside #summary-strip, .stats-grid precedes #banner (T21 banner inversion)', async ({ page }) => {
    await setupWithContent(page);
    const statsBeforeBanner = await page.evaluate(() => {
      const stats = document.querySelector('#summary-strip .stats-grid');
      const banner = document.querySelector('#summary-strip #banner');
      if (!stats || !banner) return false;
      return !!(stats.compareDocumentPosition(banner) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(statsBeforeBanner).toBe(true);
  });

  test('#race-context-bar is a descendant of #summary-strip (T21 follow-up)', async ({ page }) => {
    await setupWithContent(page);
    const isDescendant = await page.evaluate(() => {
      const strip = document.querySelector('#summary-strip');
      const bar = document.querySelector('#race-context-bar');
      if (!strip || !bar) return false;
      return strip.contains(bar);
    });
    expect(isDescendant).toBe(true);
  });
});

// ── Closed-cycle debt tail (debt fixed as a fact; removed from the health signal) ──
// The default candidate is cycle 2024 = closed (isCycleActive(2024) is false at the
// real current date), so #2024 lands on the closed banner branch. Debt is sourced
// from totalsRec.last_debts_owed_by_committee (was the always-undefined
// loans_received + debts_owed_by_committee, which made every closed cycle read
// "no outstanding debt").

test.describe('candidate.html — closed-cycle debt tail', () => {
  test('zero debt → "no outstanding debt reported"', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#banner-label')).toHaveText('Cycle Complete');
    await expect(page.locator('#banner-desc')).toContainText('no outstanding debt reported');
  });

  test('positive debt → "$X in outstanding debt" (sourced from last_debts_owed_by_committee)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Override the detail-view election_full totals call with a record carrying
    // last_debts_owed_by_committee > 0; fmt(39444) → "$39K".
    await page.route('**/api/fec/candidate/H2WA03217/totals/**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('election_full') === 'true') {
        route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({
            results: [{
              receipts: 11856001, disbursements: 11895854,
              last_cash_on_hand_end_period: 26460, coverage_end_date: '2024-12-31T00:00:00',
              cycle: 2024, last_debts_owed_by_committee: 39444,
            }],
            pagination: { count: 1 },
          }),
        });
      } else { route.fallback(); }
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await expect(page.locator('#banner-label')).toHaveText('Cycle Complete');
    await expect(page.locator('#banner-desc')).toContainText('in outstanding debt');
    await expect(page.locator('#banner-desc')).toContainText('$39K');
  });

  // Regression lock: the debt-driven red copy is gone from the health signal.
  test('the removed "Debt exceeds cash on hand" copy never renders', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#banner-desc')).not.toContainText('Debt exceeds cash on hand');
  });
});

// ── Chart ─────────────────────────────────────────────────────────────────────

test.describe('candidate.html — chart', () => {
  test('chart canvas is present', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#chart-timeline')).toBeVisible();
  });

  test('chart-legend items are present', async ({ page }) => {
    await setupWithContent(page);
    const legend = page.locator('.chart-legend .legend-item');
    await expect(legend).not.toHaveCount(0);
  });

  test('does not call /reporting-dates/ or /election-dates/', async ({ page }) => {
    const forbidden = [];
    page.on('request', req => {
      const url = req.url();
      if (/\/reporting-dates\//.test(url) || /\/election-dates\//.test(url)) {
        forbidden.push(url);
      }
    });
    await setupWithContent(page);
    expect(forbidden).toHaveLength(0);
  });
});

// ── Single flowing detail view (T-remove-profile-tabs) ──────────────────────────

test.describe('candidate.html — flowing detail view', () => {
  test('no outer tabs bar is rendered', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('.tabs-bar')).toHaveCount(0);
    await expect(page.locator('.tab')).toHaveCount(0);
  });

  test('all three sections (summary/raised/spent) are visible at once, no tab clicks', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#money-flow-card')).toBeVisible();
    await expect(page.locator('#raised-tab-section')).toBeVisible();
    await expect(page.locator('#spent-purpose-title')).toBeVisible();
  });

  test('sections render in thematic flow order (profile flatten): breakdown → geo|purpose → timeline → contributors → vendors → page-note', async ({ page }) => {
    await setupWithContent(page);
    const ordered = await page.evaluate(() => {
      // One stable anchor per thematic row, in expected document order (post-flatten):
      // breakdown slot → geographic|purpose row (map) → timeline (full-width, below that
      // row) → Top Contributors → Top Vendors → page-note.
      const ids = ['breakdown-slot', 'map-container', 'chart-timeline', 'raised-tab-section', 'vendors-tbody', 'page-note'];
      const els = ids.map(id => document.getElementById(id));
      if (els.some(e => !e)) return false;
      for (let i = 0; i < els.length - 1; i++) {
        if (!(els[i].compareDocumentPosition(els[i + 1]) & Node.DOCUMENT_POSITION_FOLLOWING)) return false;
      }
      return true;
    });
    expect(ordered).toBe(true);
  });

  // 9c breakdown-slot toggle — in-scope (default House) → Money flow Sankey owns the
  // slot; the donut pair is hidden (mutually exclusive, no longer coexisting).
  test('breakdown slot (in-scope): Money flow shown, donut pair hidden', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#money-flow-card')).toBeVisible();
    await expect(page.locator('#sankey-chart svg')).toBeVisible({ timeout: 12000 });
    // Donut pair is hidden (its grid is display:none); donuts never mount.
    await expect(page.locator('#breakdown-donut-grid')).toBeHidden();
    await expect(page.locator('#raised-donut-content')).toBeHidden();
    await expect(page.locator('#spent-donut-content')).toBeHidden();
  });

  // 9c breakdown-slot toggle — gated (presidential here) → the donut PAIR owns the
  // slot; the Money flow card is hidden and shows NO gate caption (§4: the donut
  // pair is a complete first-class view, not a consolation prize).
  test('breakdown slot (gated): donut pair shown, Money flow card hidden, no caption', async ({ page }) => {
    await setupGatedDonuts(page);
    await expect(page.locator('#raised-donut-content')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#spent-donut-content')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#money-flow-card')).toBeHidden();
    await expect(page.locator('#sankey-gate')).toBeHidden();
  });

  // A2 regression lock: the Spent donut must read `loan_repayments` (the Form-3
  // candidate field), NOT `loan_repayments_made` (the Form-3X name the prior code
  // used, which is null on candidate totals — so candidate loan repayments rendered
  // as $0). The TOTALS fixture carries loan_repayments: 150000; this asserts the
  // wedge surfaces it. Verified live 2026-06-08 against S4NY00404.
  test('Spent donut "Loan repayments" wedge reads loan_repayments (Form-3 field name)', async ({ page }) => {
    await setupGatedDonuts(page);  // 9c: donut only renders when the slot is gated
    await expect(page.locator('#spent-donut-content')).toBeVisible({ timeout: 12000 });
    const row = page.locator('#spent-donut-legend .donut-row', {
      has: page.locator('.donut-lbl', { hasText: 'Loan repayments' }),
    });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.donut-val')).toHaveText('$150K');
  });

  // Standing single-instantiation lock (T-remove-profile-tabs): removing the
  // tab-active render gate means renderRaisedIfReady + the Spent render triggers
  // fire on data-resolve and can be re-entered (fast then slow tier). This guards that
  // each chart canvas holds exactly one Chart.js instance after load AND after a
  // cycle round-trip (destroy-before-recreate + *Rendered render-once guards),
  // so the ungated render never double-instantiates / leaks a chart.
  // 9c: uses the GATED fixture so all three Chart.js canvases mount (timeline +
  // both donuts) — keeping the [1,1,1] / total-3 invariant meaningful. On an
  // in-scope entity the donuts don't mount at all (Sankey is ECharts, not Chart.js),
  // which is its own correctness lock covered by the breakdown-slot toggle tests.
  test('exactly one Chart.js instance per canvas, surviving a cycle round-trip', async ({ page }) => {
    await setupGatedDonuts(page);
    await expect(page.locator('#raised-donut-content')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#spent-donut-content')).toBeVisible({ timeout: 12000 });
    const probe = () => page.evaluate(() => {
      const ids = ['chart-timeline', 'chart-donut', 'chart-spent-donut'];
      return {
        perCanvas: ids.map(id => {
          const c = document.getElementById(id);
          return c && window.Chart.getChart(c) ? 1 : 0;
        }),
        total: window.Chart && window.Chart.instances
          ? Object.keys(window.Chart.instances).length : -1
      };
    });
    let r = await probe();
    expect(r.perCanvas).toEqual([1, 1, 1]);   // each canvas → one chart
    expect(r.total).toBe(3);                   // no orphaned/leaked instances

    // Round-trip: index → back to detail forces a full re-render of all 3 charts.
    await page.locator('#cycle-back-btn').click();
    await page.waitForSelector('#cycle-index.visible', { timeout: 12000 });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await expect(page.locator('#raised-donut-content')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#spent-donut-content')).toBeVisible({ timeout: 12000 });
    r = await probe();
    expect(r.perCanvas).toEqual([1, 1, 1]);
    expect(r.total).toBe(3);                   // still 3 — old instances destroyed, not leaked
  });

  // Out-of-scope regression locks: the nested Raised sub-tabs and the committees
  // modal are NOT part of the outer-tab system and must keep working post-de-tab.
  test('nested Raised sub-tabs (Committees ↔ Conduits) still switch', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'true');
    await page.locator('#raised-tab-btn-conduits').click();
    await expect(page.locator('#raised-tab-btn-conduits')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'false');
  });

  test('committees modal Active ↔ History tabs still switch', async ({ page }) => {
    await setupWithContent(page);
    await openCommittees(page);
    await page.waitForSelector('.modal-tabs', { state: 'visible', timeout: 8000 });
    const historyBtn = page.locator('.modal-tab-btn[data-tab="history"]');
    await historyBtn.click();
    await expect(historyBtn).toHaveClass(/active/);
    await expect(page.locator('#modal-history-list')).toBeVisible();
  });
});

// ── Raised tab: geography heatmap + contributor table ────────────────────────

test.describe('candidate.html — Raised tab sections', () => {
  test.beforeEach(async ({ page }) => {
    // T-remove-profile-tabs: Raised content is always visible in the flow — no
    // tab click. Wait for the slow-tier donors content to render — signal that
    // both fast and slow tiers have resolved.
    await setupWithContent(page);
    await page.waitForFunction(
      () => {
        const c = document.getElementById('donors-content');
        return c && c.style.display === 'block';
      },
      { timeout: 12000 }
    );
  });

  test('geography heatmap SVG renders inside map-container', async ({ page }) => {
    const svg = page.locator('#map-container svg');
    await expect(svg).toBeVisible();
  });

  test('top committee contributors table has at least one data row', async ({ page }) => {
    const rows = page.locator('#donors-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('top conduit sources table exists and renders the mocked memo row', async ({ page }) => {
    // Conduits is a non-default tab — click the Conduits tab to reveal the panel
    await page.locator('#raised-tab-btn-conduits').click();
    const card = page.locator('#conduits-card');
    await expect(card).toBeVisible();
    const rows = page.locator('#conduits-tbody tr');
    await expect(rows).not.toHaveCount(0);
    // The mock includes one ActBlue row with memo_code='X'; it must land in the conduit table
    await expect(page.locator('#conduits-tbody')).toContainText(/Actblue/i);
  });

  test('raised breakdown cell title reads "Raised breakdown"', async ({ page }) => {
    await expect(page.locator('.raised-cell-title').first()).toHaveText('Raised breakdown');
  });

  test('choropleth section title mounts the geography tooltip (with candidate-parity amendment caveat)', async ({ page }) => {
    const title = page.locator('.raised-cell-title--has-info', {
      hasText: 'Where Individual Contributions Come From',
    });
    await expect(title).toHaveCount(1);
    const trigger = title.locator('.tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About the contribution geography map');
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Reflects itemized individual contributions by state.');
    // 2b candidate-parity: the amendment caveat now appears on candidate too.
    await expect(popup).toContainText('State totals may differ from summary figures due to FEC amendment processing.');
  });

  test('C8.d retired: raised footer element removed, Conduits header mounts the conduit tooltip', async ({ page }) => {
    // The whole raised-tab footer was retired 2026-06-01 — #raised-data-note is gone.
    await expect(page.locator('#raised-data-note')).toHaveCount(0);
    // C8.d (conduit explanation) now lives on the Conduits column header tooltip.
    await page.locator('#raised-tab-btn-conduits').click();
    const trigger = page.locator('#raised-tab-panel-conduits thead .tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About conduit sources');
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('forward contributions from individual donors');
  });

  test('top committee contributor rows are whole-row links to /committee/{id}', async ({ page }) => {
    // Mock data carries contributor_committee_id → row should render as .donors-link-row
    // with .donors-link-anchor pointing at /committee/{id}.
    const linkRow = page.locator('#donors-tbody tr.donors-link-row').first();
    await expect(linkRow).toBeAttached();
    const anchor = linkRow.locator('a.donors-link-anchor');
    await expect(anchor).toHaveAttribute('href', /^\/committee\/C\d{8}$/);
  });

  test('top conduit source rows are whole-row links when committee_id is present', async ({ page }) => {
    await page.locator('#raised-tab-btn-conduits').click();
    // ActBlue row in mock carries contributor_committee_id — should render as link
    const linkRow = page.locator('#conduits-tbody tr.donors-link-row').first();
    await expect(linkRow).toBeAttached();
    const anchor = linkRow.locator('a.donors-link-anchor');
    await expect(anchor).toHaveAttribute('href', /^\/committee\/C\d{8}$/);
  });
});

// ── Donut center labels + viz-tt tooltip surface (T-chart-tooltip-improvements) ─

test.describe('candidate.html — donut center labels + viz-tt surface', () => {
  test.beforeEach(async ({ page }) => { await setupWithContent(page); });

  test('Raised donut center label reads "Raised" (dropped "Total")', async ({ page }) => {
    const lbl = page.locator('.donut-center', { has: page.locator('#donut-center-val') })
      .locator('.donut-center-lbl');
    await expect(lbl).toHaveText('Raised');
  });

  test('Spent donut center label reads "Spent" (dropped "Total")', async ({ page }) => {
    const lbl = page.locator('.donut-center', { has: page.locator('#spent-donut-center-val') })
      .locator('.donut-center-lbl');
    await expect(lbl).toHaveText('Spent');
  });

  test('choropleth tooltip #map-tt adopts the shared .viz-tt classes', async ({ page }) => {
    await expect(page.locator('#map-tt')).toHaveClass(/\bviz-tt\b/);
    await expect(page.locator('#map-tt-name')).toHaveClass(/\bviz-tt-label\b/);
    await expect(page.locator('#map-tt-val')).toHaveClass(/\bviz-tt-body\b/);
  });
});

// The donut LEGEND only renders when the breakdown slot is gated (9c) — the donut
// pair owns the slot. Uses the gated (presidential) fixture so renderContributorDonut
// runs and the legend's tooltip wiring is present to assert.
test.describe('candidate.html — donut legend tooltip (gated slot)', () => {
  test.beforeEach(async ({ page }) => { await setupGatedDonuts(page); });

  test('donut legend "Candidate authorized committees" wedge mounts the tooltip component', async ({ page }) => {
    await expect(page.locator('#raised-donut-content')).toBeVisible({ timeout: 12000 });
    const row = page.locator('#donut-legend .donut-row', {
      has: page.locator('.donut-lbl-text', { hasText: 'Candidate authorized committees' }),
    });
    await expect(row).toHaveCount(1);
    // initTooltips wired the .tooltip host into a trigger button with the
    // host's aria-label transferred; legacy .donut-info/title= is gone.
    const trigger = row.locator('.tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About candidate authorized committees');
    await expect(row.locator('.donut-info')).toHaveCount(0);
    // Popup surfaces the verbatim methodology copy on open.
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText(
      'Money transferred in from committees authorized by the same candidate.'
    );
  });
});

// ── Committees modal ──────────────────────────────────────────────────────────

test.describe('candidate.html — committees modal', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#profile-menu-btn', { state: 'visible', timeout: 10000 });
    await openCommittees(page);
    // Modal opens by setting display:flex on #committees-modal
    await page.waitForFunction(
      () => {
        const el = document.getElementById('committees-modal');
        return el && el.style.display === 'flex';
      },
      { timeout: 5000 }
    );
  });

  test('modal is visible after clicking trigger', async ({ page }) => {
    const modal = page.locator('#committees-modal');
    await expect(modal).toBeVisible();
  });

  test('modal has Active tab button', async ({ page }) => {
    const activeTab = page.locator('.modal-tab-btn').filter({ hasText: 'Active' });
    await expect(activeTab).toBeVisible();
  });

  test('modal history tab is labeled "Terminated" not "History"', async ({ page }) => {
    const btn = page.locator('#modal-history-tab-btn');
    await expect(btn).toBeAttached();
    const text = await btn.textContent();
    expect(text).toContain('Terminated');
    expect(text).not.toContain('History');
  });

  test('committee rows are present', async ({ page }) => {
    // Rows are rendered as .committee-row or inside the modal body
    const body = page.locator('.modal-body');
    await expect(body).toBeVisible();
    const content = await body.textContent();
    // Should have committee name content (not empty)
    expect(content?.trim().length).toBeGreaterThan(5);
  });

  test('modal closes on Escape key', async ({ page }) => {
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => {
        const el = document.getElementById('committees-modal');
        return el && el.style.display === 'none';
      },
      { timeout: 3000 }
    );
    const modal = page.locator('#committees-modal');
    await expect(modal).not.toBeVisible();
  });

  // Committee-row consolidation regression — locks in the shared shape from utils.js
  // (committeeRowHTML helper used by modal + /committees + /search). Catches drift if
  // someone reverts to the deprecated 3-column div or the .committee-result-row variant.
  test('modal rows render canonical .committee-row shape (no .committee-result-row, no .committee-name-link)', async ({ page }) => {
    const firstRow = page.locator('#committees-modal .committee-row').first();
    await expect(firstRow).toBeVisible();
    // <a> not <div>
    const tagName = await firstRow.evaluate(el => el.tagName.toLowerCase());
    expect(tagName).toBe('a');
    // Canonical children
    await expect(firstRow.locator('.committee-name')).toBeVisible();
    await expect(firstRow.locator('.committee-card-meta')).toBeVisible();
    // Deprecated classes must be gone everywhere
    await expect(page.locator('.committee-result-row')).toHaveCount(0);
    await expect(page.locator('.committee-name-link')).toHaveCount(0);
  });
});

// ── T12.5/skeleton arc regression locks (2026-05-06) ─────────────────────────

test.describe('candidate.html — title-always-visible during loading', () => {
  test('Raised section title visible at the same time as the active panel skeleton', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Delay the slow tier so skeletons stay visible at click time
    await page.route('**/api/fec/schedules/schedule_a/?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        await new Promise(r => setTimeout(r, 3000));
      }
      route.fallback();
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    // Active (default = Committees) panel's skeleton visible
    await expect(page.locator('#raised-donors-skeleton')).toBeVisible();
    // Section title (single source for the section) visible at the same time —
    // title-always-visible pattern, now at section level rather than per-card.
    await expect(page.locator('#raised-tab-section-title')).toBeVisible();
    await expect(page.locator('#raised-tab-section-title')).toContainText(/Top Contributors by type/);
    // Switching tabs reveals the other panel's skeleton; section title stays put
    await page.locator('#raised-tab-btn-conduits').click();
    await expect(page.locator('#raised-conduits-skeleton')).toBeVisible();
    await expect(page.locator('#raised-tab-section-title')).toBeVisible();
    // Raised breakdown title (above the donut) also visible
    await expect(page.locator('.raised-cell-title').first()).toContainText('Raised breakdown');
  });
});

test.describe('candidate.html — off-office PCC tag (*Active from a prior candidacy)', () => {
  // Mock a Rubio-shape committees response: one PCC matching MGP's office (H) and one
  // presidential PCC (committee_type='P'). The detection rule fires only on the off-
  // office row.
  async function mockOffOfficeCommittees(page) {
    await page.route('**/api/fec/candidate/H2WA03217/committees/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            // Off-office presidential PCC (intentionally listed FIRST in the mock to
            // verify the intra-group sort moves it AFTER the true-office row)
            {
              committee_id: 'C00111111',
              name: 'TEST FOR PRESIDENT',
              committee_type: 'P',
              committee_type_full: 'Presidential',
              designation: 'P',
              filing_frequency: 'Q',
              filing_frequency_full: 'Quarterly',
            },
            // True-office House PCC
            {
              committee_id: 'C00222222',
              name: 'TEST FOR CONGRESS',
              committee_type: 'H',
              committee_type_full: 'House',
              designation: 'P',
              filing_frequency: 'Q',
              filing_frequency_full: 'Quarterly',
            },
          ],
          pagination: { count: 2 },
        }),
      });
    });
  }

  test('off-office PCC row carries the tag; true-office PCC does not', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await mockOffOfficeCommittees(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await openCommittees(page);
    await page.waitForSelector('#committees-modal .committee-row', { timeout: 8000 });
    const rows = page.locator('#committees-modal #modal-active-list .committee-row');
    await expect(rows).toHaveCount(2);
    // True-office row (TEST FOR CONGRESS — committee_type='H') — no off-office tag
    const trueRow = rows.filter({ hasText: 'TEST FOR CONGRESS' });
    await expect(trueRow.locator('.tag.tag-transparent')).toHaveCount(0);
    // Off-office row (TEST FOR PRESIDENT — committee_type='P') — has the tag with the correct copy
    const offRow = rows.filter({ hasText: 'TEST FOR PRESIDENT' });
    await expect(offRow.locator('.tag.tag-transparent')).toHaveCount(1);
    await expect(offRow.locator('.tag.tag-transparent')).toHaveText('*Active from a prior candidacy');
  });

  test('off-office PCC sorts AFTER true-office PCC (regardless of API order)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await mockOffOfficeCommittees(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await openCommittees(page);
    await page.waitForSelector('#committees-modal .committee-row', { timeout: 8000 });
    // The mock returns the off-office PCC FIRST; the intra-group sort should swap them
    // so the true-office row renders first in DOM order.
    const rowNames = await page.locator('#committees-modal #modal-active-list .committee-row .committee-name').allTextContents();
    expect(rowNames.length).toBe(2);
    expect(rowNames[0]).toContain('TEST FOR CONGRESS');   // true-office (H) — first
    expect(rowNames[1]).toContain('TEST FOR PRESIDENT');  // off-office (P) — after
  });

});

test.describe('candidate.html — committees modal always-paired tabs + empty states', () => {
  // Mock: only-active candidate (no terminated) — exercises the empty-state on
  // the Terminated panel, the always-visible Terminated tab, and the (0) count.
  async function mockOnlyActive(page) {
    await page.route('**/api/fec/candidate/H2WA03217/committees/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { committee_id: 'C00200001', name: 'MGP FOR CONGRESS', committee_type: 'H', designation: 'P', filing_frequency: 'Q', filing_frequency_full: 'Quarterly' },
          ],
          pagination: { count: 1 },
        }),
      });
    });
  }

  // Mock: only-terminated candidate (no active) — exercises the symmetric empty-
  // state on the Active panel.
  async function mockOnlyTerminated(page) {
    await page.route('**/api/fec/candidate/H2WA03217/committees/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { committee_id: 'C00200002', name: 'OLD COMMITTEE', committee_type: 'H', designation: 'A', filing_frequency: 'T', filing_frequency_full: 'Terminated' },
          ],
          pagination: { count: 1 },
        }),
      });
    });
  }

  test('Terminated tab shows empty state when no terminated committees exist', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await mockOnlyActive(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await openCommittees(page);
    await page.waitForSelector('#committees-modal .committee-row', { timeout: 8000 });
    // Click into the Terminated tab and confirm the empty-state copy renders.
    await page.locator('#modal-history-tab-btn').click();
    const emptyMsg = page.locator('#modal-history-list .state-msg');
    await expect(emptyMsg).toBeVisible();
    await expect(emptyMsg).toHaveText('No terminated committees');
  });

  test('both tab buttons are visible after fetch (regardless of terminated count)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await mockOnlyActive(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await openCommittees(page);
    await page.waitForSelector('#committees-modal .committee-row', { timeout: 8000 });
    // Both tab buttons should be visible (the Terminated tab is no longer
    // conditionally hidden when there are no terminated committees).
    const activeTab = page.locator('#committees-modal .modal-tab-btn[data-tab="active"]');
    const historyTab = page.locator('#modal-history-tab-btn');
    await expect(activeTab).toBeVisible();
    await expect(historyTab).toBeVisible();
  });

  test('count badges show counts after fetch, including (0)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await mockOnlyActive(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await openCommittees(page);
    await page.waitForSelector('#committees-modal .committee-row', { timeout: 8000 });
    // Active label has the count; Terminated label explicitly carries (0).
    const activeLabel = await page.locator('#committees-modal .modal-tab-btn[data-tab="active"]').textContent();
    const historyLabel = await page.locator('#modal-history-tab-btn').textContent();
    expect(activeLabel).toContain('(1)');
    expect(historyLabel).toContain('(0)');
  });

  test('Active panel shows empty state when no active committees', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await mockOnlyTerminated(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await openCommittees(page);
    // Wait for tabs to reveal (the natural post-fetch signal — terminated rows
    // exist but live inside the hidden Terminated panel until the user clicks).
    await page.waitForFunction(
      () => getComputedStyle(document.querySelector('#committees-modal .modal-tabs')).display !== 'none',
      { timeout: 8000 }
    );
    // The Active panel should carry the symmetric empty-state copy.
    const activeEmpty = page.locator('#modal-active-list .state-msg');
    await expect(activeEmpty).toBeVisible();
    await expect(activeEmpty).toHaveText('No active committees');
  });

  test('tabs are hidden during loading, revealed after fetch resolves', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Delay the committees endpoint response so the loading state has a real window.
    await page.route('**/api/fec/candidate/H2WA03217/committees/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { committee_id: 'C00200003', name: 'MGP FOR CONGRESS', committee_type: 'H', designation: 'P', filing_frequency: 'Q', filing_frequency_full: 'Quarterly' },
          ],
          pagination: { count: 1 },
        }),
      });
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await openCommittees(page);
    // Immediately after click — tab bar should be hidden (mid-load).
    const tabsDisplayDuringLoad = await page.locator('#committees-modal .modal-tabs').evaluate(el => getComputedStyle(el).display);
    expect(tabsDisplayDuringLoad).toBe('none');
    // Wait for committees to render — fetch resolved.
    await page.waitForSelector('#committees-modal .committee-row', { timeout: 8000 });
    const tabsDisplayAfter = await page.locator('#committees-modal .modal-tabs').evaluate(el => getComputedStyle(el).display);
    expect(tabsDisplayAfter).not.toBe('none');
  });

  test('data-note is hidden during loading and visible after fetch resolves', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/candidate/H2WA03217/committees/**', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 500));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [
            { committee_id: 'C00200004', name: 'MGP FOR CONGRESS', committee_type: 'H', designation: 'P', filing_frequency: 'Q', filing_frequency_full: 'Quarterly' },
          ],
          pagination: { count: 1 },
        }),
      });
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await openCommittees(page);
    const noteDisplayDuringLoad = await page.locator('#committees-modal .modal-body .data-note').evaluate(el => getComputedStyle(el).display);
    expect(noteDisplayDuringLoad).toBe('none');
    await page.waitForSelector('#committees-modal .committee-row', { timeout: 8000 });
    const noteDisplayAfter = await page.locator('#committees-modal .modal-body .data-note').evaluate(el => getComputedStyle(el).display);
    expect(noteDisplayAfter).not.toBe('none');
  });
});

test.describe('candidate.html — modal section-title spacing (adjacent sibling combinator)', () => {
  test('second .section-title in modal has top margin; first does not', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Per-test override: return a leadership PAC via /committees/?sponsor_candidate_id= so
    // the modal renders 2 groups (Principal Committee + Leadership PAC)
    await page.route('**/api/fec/committees/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('sponsor_candidate_id')) {
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [{
              committee_id: 'C00999999',
              name: 'TEST LEADERSHIP PAC',
              committee_type: 'D',
              committee_type_full: 'Leadership PAC',
              filing_frequency: 'Q',
              filing_frequency_full: 'Quarterly',
              leadership_pac: true,
            }],
            pagination: { count: 1 },
          }),
        });
      } else {
        route.fallback();
      }
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await openCommittees(page);
    await page.waitForSelector('#committees-modal .committee-row', { timeout: 8000 });
    const titleMargins = await page.locator('#committees-modal .modal-body .section-title').evaluateAll(els =>
      els.map(el => parseFloat(getComputedStyle(el).marginTop))
    );
    expect(titleMargins.length).toBeGreaterThanOrEqual(2);
    expect(titleMargins[0]).toBe(0);
    expect(titleMargins[1]).toBeGreaterThan(0);
  });
});

// ── Committees modal network behavior (T11 — deferred fetch) ──────────────────
//
// These tests do NOT use the parent describe block's beforeEach (which auto-
// opens the modal). Each test installs a request listener BEFORE setup() so
// it captures any committees-related requests fired during cycle load.

test.describe('candidate.html — committees modal network (T11 deferral)', () => {
  function attachCommitteesListener(page, capturedArr) {
    page.on('request', req => {
      const url = req.url();
      // Match only the MODAL fetches: /candidate/{id}/committees/?per_page=50 (no cycle)
      // and /committees/?sponsor_candidate_id=. The cycle-scoped /candidate/.../
      // committees/?cycle=YYYY call inside loadCycle() is a separate concern (used
      // by Raised/Spent tabs for the principal committee lookup) and is NOT what
      // T11 defers — T12 will handle that path when Raised/Spent fetches go lazy.
      if (/\/candidate\/[^/]+\/committees\/.*per_page=50/.test(url) ||
          /sponsor_candidate_id=/.test(url)) {
        capturedArr.push(url);
      }
    });
  }

  test('no committees calls fire on cycle load', async ({ page }) => {
    const captured = [];
    await mockAmplitude(page);
    await mockFecApi(page);
    attachCommitteesListener(page, captured);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    // Allow any in-flight calls to settle (none expected post-T11)
    await page.waitForTimeout(500);
    expect(captured).toEqual([]);
  });

  test('first modal open fires both committees calls', async ({ page }) => {
    const captured = [];
    await mockAmplitude(page);
    await mockFecApi(page);
    attachCommitteesListener(page, captured);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-menu-btn', { state: 'visible', timeout: 12000 });
    expect(captured).toEqual([]);
    await openCommittees(page);
    await page.waitForSelector('.committee-row', { timeout: 8000 });
    expect(captured.some(u => /\/candidate\/[^/]+\/committees\//.test(u))).toBe(true);
    expect(captured.some(u => /sponsor_candidate_id=/.test(u))).toBe(true);
  });

  test('second modal open does not re-fire (cache hit)', async ({ page }) => {
    const captured = [];
    await mockAmplitude(page);
    await mockFecApi(page);
    attachCommitteesListener(page, captured);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-menu-btn', { state: 'visible', timeout: 12000 });
    await openCommittees(page);
    await page.waitForSelector('.committee-row', { timeout: 8000 });
    const firstCount = captured.length;
    expect(firstCount).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => document.getElementById('committees-modal').style.display === 'none',
      { timeout: 3000 }
    );
    await openCommittees(page);
    await page.waitForFunction(
      () => document.getElementById('committees-modal').style.display === 'flex',
      { timeout: 3000 }
    );
    await page.waitForTimeout(300);
    expect(captured.length).toBe(firstCount);
  });

  test('page reload re-fires committees calls on first open', async ({ page }) => {
    const captured = [];
    await mockAmplitude(page);
    await mockFecApi(page);
    attachCommitteesListener(page, captured);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-menu-btn', { state: 'visible', timeout: 12000 });
    await openCommittees(page);
    await page.waitForSelector('.committee-row', { timeout: 8000 });
    const firstCount = captured.length;
    await page.reload();
    await page.waitForSelector('#profile-menu-btn', { state: 'visible', timeout: 12000 });
    await openCommittees(page);
    await page.waitForSelector('.committee-row', { timeout: 8000 });
    expect(captured.length).toBeGreaterThan(firstCount);
  });
});

// ── URL hash back-compat (T-remove-profile-tabs) ────────────────────────────────

test.describe('candidate.html — legacy #cycle#tab back-compat', () => {
  // Old shared/bookmarked links carry a #tab segment. Post-de-tab the cycle is
  // honored and the tab segment is ignored; the URL canonicalizes to bare #cycle.
  test('legacy #2022#raised lands on the 2022 detail flow and canonicalizes to #2022', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2022#raised');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    // Detail flow rendered (no tabs), and the Raised section is visible in-flow.
    await expect(page.locator('.tabs-bar')).toHaveCount(0);
    await expect(page.locator('#raised-tab-section')).toBeVisible();
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#2022');
  });

  test('legacy #2024#summary lands on the 2024 detail flow and canonicalizes to #2024', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#2024');
  });
});

// ── Amplitude events ──────────────────────────────────────────────────────────

test.describe('candidate.html — Amplitude events', () => {
  test('Page Viewed fires with page property', async ({ page }) => {
    await setup(page);
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    const props = event.args[1];
    expect(props).toMatchObject({ page: expect.any(String) });
  });

  // T-remove-profile-tabs: the outer tabs (and the Tab Switched event) were
  // retired. Page Viewed { view:'detail', cycle } is the replacement signal.
  test('Tab Switched no longer fires (outer tabs retired)', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#content.visible', { timeout: 8000 });
    const event = await findTrackEvent(page, 'Tab Switched');
    expect(event).toBeUndefined();
  });

  test('Committees Modal Opened fires on trigger click', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#profile-menu-btn', { state: 'visible', timeout: 8000 });
    await openCommittees(page);
    const event = await findTrackEvent(page, 'Committees Modal Opened');
    expect(event).toBeDefined();
  });

  test('Page Viewed fires with view: detail when URL has cycle hash', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ view: 'detail' });
  });

  // 9c: breakdown_viz captures which viz the slot mounted (lands with the toggle so
  // coexistence never ends uncaptured). In-scope (default House) → 'sankey', no reason.
  test('Page Viewed carries breakdown_viz:sankey on an in-scope (House) detail view', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event.args[1]).toMatchObject({ view: 'detail', breakdown_viz: 'sankey', breakdown_gate_reason: null });
  });

  // Gated (presidential) → 'donut' + the gate reason.
  test('Page Viewed carries breakdown_viz:donut + gate reason on a gated (presidential) detail view', async ({ page }) => {
    await setupGatedDonuts(page);
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event.args[1]).toMatchObject({ view: 'detail', breakdown_viz: 'donut', breakdown_gate_reason: 'presidential' });
  });

  // Index view (bare URL) has no breakdown slot → breakdown_viz is null.
  test('Page Viewed carries breakdown_viz:null on the index view', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event.args[1]).toMatchObject({ view: 'index', breakdown_viz: null });
  });
});

// ── API correctness ───────────────────────────────────────────────────────────

test.describe('candidate.html — API correctness', () => {
  test('no 422 errors (office param check)', async ({ page }) => {
    const errors422 = [];
    page.on('response', res => {
      if (res.url().includes('/api/fec/') && res.status() === 422) {
        errors422.push(res.url());
      }
    });
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForLoadState('networkidle');
    expect(errors422).toHaveLength(0);
  });
});

// ── Landing state — index view (T5/T6) ───────────────────────────────────────

test.describe('candidate.html — landing state (index view)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217'); // bare URL → index view
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
  });

  test('bare URL renders CareerStrip and cycle index, not detail content or summary-strip', async ({ page }) => {
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#cycle-index')).toBeVisible();
    await expect(page.locator('#content')).not.toBeVisible();
    await expect(page.locator('#summary-strip')).not.toBeVisible();
  });

  test('#cycles hash also renders index view', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#cycles');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#cycle-index')).toBeVisible();
    await expect(page.locator('#content')).not.toBeVisible();
  });

  test('CareerStrip renders three cells with expected labels (T14)', async ({ page }) => {
    const labels = await page.locator('#career-strip .stat-label').allTextContents();
    expect(labels).toContain('History');
    expect(labels).toContain('Career Raised');
    expect(labels).toContain('Career Spent');
  });

  test('CareerStrip History cell shows a year or year-range (T14)', async ({ page }) => {
    const val = await page.locator('#cstat-history').textContent();
    // Either bare year ("2022") or year-range ("2022–2024")
    expect(val?.trim()).toMatch(/^\d{4}([–\-]\d{4})?$/);
  });

  test('cycle index renders one row per cycle from /history/ fixture', async ({ page }) => {
    // CANDIDATE_HISTORY fixture has cycles: [2022, 2024] → 2 navigable rows
    const rows = page.locator('#cycle-index a.cycle-row');
    await expect(rows).toHaveCount(2);
  });

  test('Page Viewed fires with view: index', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ view: 'index' });
  });

  test('cycle row href is bare #{year} (no #tab segment — T-remove-profile-tabs)', async ({ page }) => {
    const row = page.locator('#cycle-index a.cycle-row').first();
    const href = await row.getAttribute('href');
    expect(href).toMatch(/^#\d{4}$/);
  });

  test('cycle row labels contain a single election year (T-cycle-semantics)', async ({ page }) => {
    const label = await page.locator('#cycle-index a.cycle-row .cycle-row-label').first().textContent();
    expect(label?.trim()).toMatch(/^\d{4}$/);
  });

  test('#profile-menu-btn is visible in index view', async ({ page }) => {
    await expect(page.locator('#profile-menu-btn')).toBeVisible();
  });
});

// ── Landing state regression — detail view unchanged ─────────────────────────

test.describe('candidate.html — landing state regression (detail view unchanged)', () => {
  test('#{year} URL renders detail view, not index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    // Positive assertion: detail-view elements are visible (proves the detail path ran)
    await expect(page.locator('#content')).toBeVisible();
    await expect(page.locator('#summary-strip')).toBeVisible();
    // Negative assertions: index-view elements are absent
    await expect(page.locator('#career-strip')).not.toBeVisible();
    await expect(page.locator('#cycle-index')).not.toBeVisible();
  });
});

// ── Archive threshold — House pre-2008 ────────────────────────────────────────

test.describe('candidate.html — archive threshold (House pre-2008)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // T-history-retire (2026-05-19) — cycle list is sourced from entity.election_years
    // now (was /history/.election_years pre-retirement). Override the entity response
    // to inject a pre-2008 cycle for archive-threshold testing.
    await page.route(/\/api\/fec\/candidate\/[^/]+\/(?!.*\/)/, route => {
      // Match /candidate/{id}/ (entity), not /candidate/{id}/totals/, /committees/, etc.
      // The lookahead (?!.*\/) excludes URLs with further path segments after the id.
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            candidate_id: 'H2WA03217',
            name: 'GLUESENKAMP PEREZ, MARIE',
            office: 'H',
            state: 'WA',
            district: '03',
            party: 'DEM',
            party_full: 'Democratic Party',
            election_years: [2024, 2006],
            cycles: [2024, 2006],
            first_file_date: '2004-01-01',
            last_file_date: '2024-10-15',
            active_through: 2024,
          }],
          pagination: { count: 1 },
        }),
      });
    });
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
  });

  test('pre-threshold rows render as non-navigable divs (not anchors)', async ({ page }) => {
    // 2006 < 2008 House threshold → archive row; 2024 ≥ 2008 → navigable anchor
    const archiveRows = page.locator('#cycle-index div.cycle-row--archive');
    await expect(archiveRows).toHaveCount(1);
    const anchors = page.locator('#cycle-index a.cycle-row');
    await expect(anchors).toHaveCount(1); // only 2024
  });

  test('archive rows are not keyboard-focusable (tabindex=-1)', async ({ page }) => {
    const archiveRow = page.locator('#cycle-index div.cycle-row--archive').first();
    await expect(archiveRow).toHaveAttribute('tabindex', '-1');
  });

  test('archive divider is present before archive rows', async ({ page }) => {
    const divider = page.locator('#cycle-index .cycle-archive-divider');
    await expect(divider).toBeVisible();
    const text = await divider.textContent();
    // Inline label is "Archived elections (totals only)"; the methodology
    // explanation now lives in the C12.b tooltip (stashed off the visible text).
    expect(text).toContain('Archived elections (totals only)');
    expect(text).not.toContain('FEC coverage begins');
  });

  test('archive divider mounts the C12.b methodology tooltip', async ({ page }) => {
    const trigger = page.locator('#cycle-index .cycle-archive-divider .tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About archived elections');
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    // H2WA03217 is House → "House races", threshold 2008.
    await expect(popup).toContainText('No detail view available for House races prior to 2008');
  });
});

// ── In-place transitions — index ↔ detail ─────────────────────────────────────

test.describe('candidate.html — in-place transitions', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    // T-load-4a: career-strip visibility fires BEFORE hydration (scaffold-then-
    // hydrate). Wait for the index data to settle before tests trigger cycle
    // switches — keeps timing pre-conditions stable for race-condition tests.
    await page.waitForSelector('#cycle-index a.cycle-row .skeleton', { state: 'detached', timeout: 12000 });
  });

  test('no page reload on cycle row click', async ({ page }) => {
    await page.evaluate(() => { document.body.dataset.loadId = '1'; });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    const loadId = await page.evaluate(() => document.body.dataset.loadId);
    expect(loadId).toBe('1');
  });

  test('#profile-header is the same DOM node after index → detail transition', async ({ page }) => {
    await page.evaluate(() => { document.getElementById('profile-header').dataset.mark = 'x'; });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    const mark = await page.evaluate(() => document.getElementById('profile-header').dataset.mark);
    expect(mark).toBe('x');
  });

  test('index view elements hidden after transition to detail', async ({ page }) => {
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).not.toBeVisible();
    await expect(page.locator('#cycle-index')).not.toBeVisible();
  });

  test('chevron + cycle-row round-trip re-enters detail flow with all sections visible (T-remove-profile-tabs)', async ({ page }) => {
    // The pre-de-tab version of this test locked restoreTab's panel reset. With
    // the outer tabs gone there are no panels to reset — re-entry just lands on
    // the flowing detail view with summary/raised/spent all visible and a bare
    // #cycle URL.
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    // Leave via the chevron → cycle index.
    await page.locator('#cycle-back-btn').click();
    await page.waitForSelector('#cycle-index.visible', { timeout: 5000 });
    // Re-enter detail via a row click.
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    // Bare #cycle URL; all three sections visible in the flow.
    await expect(page).toHaveURL(/#\d{4}$/);
    await expect(page.locator('#money-flow-card')).toBeVisible();
    await expect(page.locator('#raised-tab-section')).toBeVisible();
    await expect(page.locator('#spent-purpose-title')).toBeVisible();
  });

  test('back button returns to index view', async ({ page }) => {
    // No pre-scroll — indexScrollY=0, so compact should NOT be active after back
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#content')).not.toBeVisible();
    await expect(page.locator('#profile-header')).not.toHaveClass(/compact/);
  });

  test('back button → index re-engages compact when restored scroll is past threshold', async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 500); // past compact threshold
    });
    // Wait for compact to engage before clicking
    await expect(page.locator('#profile-header')).toHaveClass(/compact/, { timeout: 3000 });
    // Use hash navigation via evaluate — Playwright's click() would scroll the element
    // into view first, resetting window.scrollY before switchView() can read it.
    await page.evaluate(() => { window.location.hash = '#2024#summary'; });
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    // indexScrollY was 500 (past threshold) — compact should re-engage
    await expect(page.locator('#profile-header')).toHaveClass(/compact/, { timeout: 3000 });
  });

  test('back button → index does not re-fetch history or all-totals', async ({ page }) => {
    let historyRequests = 0;
    let allTotalsRequests = 0;
    page.on('request', req => {
      const url = req.url();
      if (url.includes('/history/')) historyRequests++;
      if (url.includes('/totals/') && url.includes('per_page=100')) allTotalsRequests++;
    });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    expect(historyRequests).toBe(0);
    expect(allTotalsRequests).toBe(0);
  });

  test('index → detail scroll: compact-engaged index enters detail at compact threshold', async ({ page }) => {
    // Inflate INDEX content only (cycle-index padding) so user can scroll past
    // compact threshold. Detail content stays naturally short — that's the
    // condition that exposes scroll-clamp regressions when minHeight is cleared
    // before natural detail content has filled the document. Earlier scaffolding
    // via body.minHeight=3000px masked this class of bug by keeping document
    // height permanently inflated; index-only inflation matches the realistic
    // flow. See committee.spec.js for the second instance + utils.js floor fix.
    await page.evaluate(() => {
      document.getElementById('cycle-index').style.paddingBottom = '2000px';
      window.scrollTo(0, 500);
    });
    // Use hash navigation via evaluate — Playwright's click() would scroll the element
    // into view first, resetting window.scrollY before switchTo() can read it.
    await page.evaluate(() => { window.location.hash = '#2024#summary'; });
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    // Allow scroll listener cooldown + any clamp to settle
    await page.waitForTimeout(200);
    const threshold = await page.evaluate(() => window.compactThreshold);
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeGreaterThanOrEqual(Math.max(0, threshold - 2));
    expect(scrollY).toBeLessThanOrEqual(threshold + 10);
    await expect(page.locator('#profile-header')).toHaveClass(/compact/);
  });

  test('index → detail scroll: non-compact index enters detail at scrollY 0', async ({ page }) => {
    // No scroll before click — index is not compact
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY).toBeLessThanOrEqual(5);
    await expect(page.locator('#profile-header')).not.toHaveClass(/compact/);
  });

  test('compact header engages on index view (no prior detail visit required)', async ({ page }) => {
    await page.evaluate(() => {
      document.body.style.minHeight = '3000px';
      window.scrollTo(0, 400);
    });
    await expect(page.locator('#profile-header')).toHaveClass(/compact/, { timeout: 3000 });
  });

  test('fetch race condition: last-clicked cycle wins', async ({ page }) => {
    // Override cycle-specific totals: delay 2024 by 500ms, fulfill 2022 immediately.
    // Other totals requests (per_page=100 all-totals already cached from beforeEach) fall through.
    await page.route('**/api/fec/candidate/**totals**', async route => {
      const url = route.request().url();
      if (url.includes('cycle=2024')) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ results: [{ receipts: 2400000, disbursements: 2100000, last_cash_on_hand_end_period: 300000, coverage_end_date: '2024-12-31T00:00:00', cycle: 2024 }], pagination: { count: 1 } }),
        });
      } else if (url.includes('cycle=2022')) {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify({ results: [{ receipts: 2200000, disbursements: 1900000, last_cash_on_hand_end_period: 310000, coverage_end_date: '2022-12-31T00:00:00', cycle: 2022 }], pagination: { count: 1 } }),
        });
      } else {
        await route.fallback();
      }
    });
    // Trigger 2024 then immediately 2022 — the 500ms delay on 2024's totals fetch means
    // 2022 resolves first; the fetch-race token ensures 2024's stale response is discarded.
    await page.evaluate(() => { window.location.hash = '#2024#summary'; });
    await page.evaluate(() => { window.location.hash = '#2022#summary'; });
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    // Wait for actual money value (e.g. "$2.2M"), not just "not dash". After
    // T-load-3 + T-load-4a, cycle-switch reset path inserts a skeleton span
    // into #stat-raised — textContent is "" during that window, which the
    // older "!== '—'" predicate matched truthy, causing flaky failures under
    // heavy parallel load (2026-05-19).
    await page.waitForFunction(
      () => { const el = document.getElementById('stat-raised'); return el && /\$/.test(el.textContent); },
      { timeout: 12000 }
    );
    const raisedText = await page.locator('#stat-raised').textContent();
    expect(raisedText).toContain('2.2');    // 2022 data: $2.2M
    expect(raisedText).not.toContain('2.4'); // not 2024 stale data: $2.4M
  });
});

// ── Path-segment URL ID extraction (regression: trailing slash) ──────────────

test.describe('candidate.html — path-segment URL ID extraction', () => {
  // /candidate/{id} and /candidate/{id}/ both serve candidate.html via the
  // Cloudflare Pages Function at functions/candidate/[[catchall]].js. ID
  // extraction uses .split('/').filter(Boolean) (fix from T5/T6 era; same
  // pattern now mirrored to committee.html). Route-intercept here mirrors
  // what the production Function does, since Playwright's webServer is
  // python3 -m http.server (no Pages Function support).
  async function routeCandidatePath(page) {
    await page.route(/\/candidate\/[A-Z0-9]+\/?$/i, async route => {
      const response = await page.context().request.get('http://localhost:8080/candidate.html');
      const body = await response.text();
      await route.fulfill({ status: 200, contentType: 'text/html', body });
    });
  }

  test('/candidate/{id} (no trailing slash) extracts ID and renders index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await routeCandidatePath(page);
    await page.goto('/candidate/H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    const fecIdTag = await page.locator('.fec-id-tag').textContent();
    expect(fecIdTag).toContain('H2WA03217');
  });

  test('/candidate/{id}/ (trailing slash) extracts ID and renders index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await routeCandidatePath(page);
    await page.goto('/candidate/H2WA03217/');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    const fecIdTag = await page.locator('.fec-id-tag').textContent();
    expect(fecIdTag).toContain('H2WA03217');
    const stateMsg = page.locator('#state-msg');
    await expect(stateMsg).not.toBeVisible();
  });

  test('/candidate (no ID, clean URL) shows friendly error with Browse candidates link', async ({ page }) => {
    await mockAmplitude(page);
    await page.route(/\/candidate\/?$/, async route => {
      const response = await page.context().request.get('http://localhost:8080/candidate.html');
      const body = await response.text();
      await route.fulfill({ status: 200, contentType: 'text/html', body });
    });
    await page.goto('/candidate');
    const stateMsg = page.locator('#state-msg');
    await expect(stateMsg).toContainText('No candidate ID provided');
    const link = stateMsg.locator('a');
    await expect(link).toHaveAttribute('href', '/candidates');
    await expect(link).toContainText('Browse candidates');
  });

  test('/candidate.html (no ?id= param) shows friendly error with Browse candidates link', async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/candidate.html');
    const stateMsg = page.locator('#state-msg');
    await expect(stateMsg).toContainText('No candidate ID provided');
    const link = stateMsg.locator('a');
    await expect(link).toHaveAttribute('href', '/candidates');
  });

  test('non-existent cycle year (e.g. #1999#summary) falls through to index view', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#1999#summary');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#content')).not.toBeVisible();
    await expect(page.locator('#summary-strip')).not.toBeVisible();
  });

  test('legacy trailing segment (e.g. #2024#bogus) is ignored; lands on #2024 detail flow', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#bogus');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    // Detail flow rendered; the trailing segment is dropped — URL canonicalizes to bare #2024.
    await expect(page.locator('#money-flow-card')).toBeVisible();
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#2024');
  });
});

// ── T12: Raised/Spent loading-state behavior ─────────────────────────────────

test.describe('candidate.html — Raised/Spent loading states (T12)', () => {
  test('Raised: donut renders synchronously, skeletons visible while slow tier in flight', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // 9c: the donut only mounts when the slot is gated — use the presidential fixture
    // so #chart-donut renders. The slow-tier (Top Contributors) skeleton behavior under
    // test is independent of the breakdown slot.
    await routeGatedCandidate(page);
    // Delay slow-tier (is_individual=false) Schedule A so skeletons stay visible at click time
    await page.route('**/api/fec/schedules/schedule_a/?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        await new Promise(r => setTimeout(r, 3000));
      }
      route.fallback();
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    // Donut canvas renders synchronously from totals (gated slot)
    await expect(page.locator('#chart-donut')).toBeVisible({ timeout: 2000 });
    // Active panel (Committees default) skeleton visible while in flight
    await expect(page.locator('#raised-donors-skeleton')).toBeVisible();
    // Conduits panel skeleton is in DOM but hidden (parent panel has [hidden])
    await expect(page.locator('#raised-conduits-skeleton')).toBeHidden();
    await expect(page.locator('#raised-conduits-skeleton')).toBeAttached();
  });

  test('Raised: no skeleton flash when fetch already resolved before tab click', async ({ page }) => {
    await setup(page);
    await page.waitForTimeout(800); // give the eager fetch time to resolve through mocks
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    await page.waitForTimeout(400);
    // Active panel skeleton should be hidden because data was already in memory
    await expect(page.locator('#raised-donors-skeleton')).toBeHidden();
    await expect(page.locator('#donors-card')).toBeVisible();
  });

  test('Raised: slow-tier failure renders error with retry button', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        route.abort('failed');
      } else {
        route.fallback();
      }
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    const err = page.locator('#raised-donors-error');
    await expect(err).toBeVisible({ timeout: 8000 });
    await expect(err.locator('.tab-retry-btn')).toBeVisible();
    // T-raised-loading-states: both sub-tabs derive from the one slow crawl, so the
    // error must surface inline on each panel — switch to Conduits and confirm.
    await page.locator('#raised-tab-btn-conduits').click();
    const conduitErr = page.locator('#raised-conduits-error');
    await expect(conduitErr).toBeVisible({ timeout: 8000 });
    await expect(conduitErr.locator('.tab-retry-btn')).toBeVisible();
  });

  test('Raised: per-panel still-loading is hidden once slow tier resolves (not unconditional)', async ({ page }) => {
    await setup(page);
    await page.waitForTimeout(800); // eager fetch resolves through mocks
    await expect(page.locator('#raised-tab-section')).toBeVisible();
    // T-raised-loading-states: each panel owns its still-loading element; it must be
    // hidden once data resolves (post-de-tab it no longer shows unconditionally).
    await expect(page.locator('#raised-donors-still-loading')).toBeHidden();
    await page.locator('#raised-tab-btn-conduits').click();
    await expect(page.locator('#raised-conduits-still-loading')).toBeHidden();
    // The old detached indicators were removed in favor of per-panel ones.
    await expect(page.locator('#raised-still-loading')).toHaveCount(0);
    await expect(page.locator('#raised-slow-error')).toHaveCount(0);
  });

  test('Raised: still-loading message overlays the skeleton footprint as a sibling (not a child)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Hold the slow tier in flight so the skeleton stays visible while we inspect.
    await page.route('**/api/fec/schedules/schedule_a/?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        await new Promise(r => setTimeout(r, 4000));
      }
      route.fallback();
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-donors-skeleton')).toBeVisible();
    // Force the message visible (the real 10s timer is too slow for a unit test); the
    // CSS owns the centering, so display:flex is all that's needed.
    await page.locator('#raised-donors-still-loading').evaluate(el => { el.style.display = 'flex'; });
    const skelBox = await page.locator('#raised-donors-skeleton').boundingBox();
    const msgBox  = await page.locator('#raised-donors-still-loading').boundingBox();
    // The message overlays the skeleton's vertical span — it does NOT sit below it.
    expect(msgBox.y).toBeGreaterThanOrEqual(skelBox.y - 1);
    expect(msgBox.y).toBeLessThan(skelBox.y + skelBox.height);
    // Critical: it must be a SIBLING inside .skeleton-overlay-wrap, never a DOM child
    // of the .skeleton element (whose group-opacity pulse would dim the text).
    const insideWrap = await page.locator('#raised-donors-still-loading')
      .evaluate(el => !!el.closest('.skeleton-overlay-wrap'));
    expect(insideWrap).toBe(true);
    const childOfSkeleton = await page.locator('#raised-donors-still-loading')
      .evaluate(el => !!el.closest('#raised-donors-skeleton'));
    expect(childOfSkeleton).toBe(false);
  });

  test('Raised: heavy candidate (>100 pages) bails to KV committees + high-volume conduits', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // is_individual=false page-1 reports >100 pages → all-or-nothing bail.
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ results: [], pagination: { count: 19714, pages: 198 } }) });
      } else { route.fallback(); }
    });
    // top_committees KV hit so Committees renders from the precomputed slot.
    await page.route('**/api/aggregations/top-committees**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ source: 'bulk', results: [
          { name: 'DIGIDEMS PAC', entity_type: 'ORG', committee_id: 'C00679191', total: 20050 }
        ] }) });
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible();
    // Committees from KV (merged) — instant, no crawl
    await expect(page.locator('#donors-tbody')).toContainText(/digidems/i, { timeout: 8000 });
    // Conduits → honest high-volume bail (parity with committee.html copy)
    await expect(page.locator('#conduits-tbody')).toContainText(/high transaction volume/i);
  });

  test('Raised: skeleton container has substantive height (scroll-clamp guard)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', async (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        await new Promise(r => setTimeout(r, 5000));
      }
      route.fallback();
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    // Active panel's skeleton has substantive height. Inactive panel skeletons
    // collapse with their hidden parent — measure each by activating its tab.
    const donorsHeight = await page.locator('#raised-donors-skeleton').evaluate(el => el.getBoundingClientRect().height);
    expect(donorsHeight).toBeGreaterThanOrEqual(200);
    await page.locator('#raised-tab-btn-conduits').click();
    const conduitsHeight = await page.locator('#raised-conduits-skeleton').evaluate(el => el.getBoundingClientRect().height);
    expect(conduitsHeight).toBeGreaterThanOrEqual(200);
  });

  // spent-progressive-loading: the opex Schedule B walk feeds Purpose bars + Top
  // Vendors; its failure surfaces a per-source error on BOTH (#spent-bars-error +
  // #spent-vendors-error). The breakdown viz renders from memory and is never blanked
  // (9c: the in-scope default mounts the Money flow card — independent of Schedule B).
  test('Spent: opex failure renders per-source error with retry button', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_b/**', (route) => route.abort('failed'));
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#spent-purpose-title')).toBeVisible(); // T-remove-profile-tabs: Spent section always in-flow (no tab click)
    const err = page.locator('#spent-vendors-error');
    await expect(err).toBeVisible({ timeout: 8000 });
    await expect(err.locator('.tab-retry-btn')).toBeVisible();
    await expect(page.locator('#spent-bars-error')).toBeVisible();
    // Breakdown viz renders synchronously from totals — never blanked by the opex
    // failure (in-scope mounts the Money flow card; it doesn't read Schedule B).
    await expect(page.locator('#money-flow-card')).toBeVisible();
  });

  test('Spent: opex retry click re-fires fetch and renders content', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    let abortNext = true;
    await page.route('**/api/fec/schedules/schedule_b/**', (route) => {
      if (abortNext) route.abort('failed');
      else route.fallback();
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#spent-purpose-title')).toBeVisible(); // T-remove-profile-tabs: Spent section always in-flow (no tab click)
    await expect(page.locator('#spent-vendors-error')).toBeVisible({ timeout: 8000 });
    abortNext = false;
    await page.locator('#spent-vendors-error .tab-retry-btn').click();
    // Wait for spent vendors content to flip to block (post-refactor signal)
    await page.waitForFunction(
      () => document.getElementById('spent-vendors-content').style.display === 'block',
      { timeout: 10000 }
    );
    await expect(page.locator('#spent-vendors-content')).toBeVisible();
    await expect(page.locator('#spent-vendors-error')).toBeHidden();
    await expect(page.locator('#spent-bars-error')).toBeHidden();
  });

  // Breakdown viz is instant — it renders synchronously from totals even while the
  // opex Schedule B walk is still pending (slow-network response held open). 9c: the
  // in-scope default mounts the Money flow card (Sankey), which doesn't read Schedule B.
  test('Spent: breakdown viz renders instantly while opex tier still loading', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    let releaseB;
    const heldB = new Promise((res) => { releaseB = res; });
    await page.route('**/api/fec/schedules/schedule_b/**', async (route) => {
      await heldB;            // hold the opex/CCM walk open
      route.fallback();
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#spent-purpose-title')).toBeVisible();
    // Money flow Sankey visible while Vendors is still a skeleton (Schedule B held open).
    await expect(page.locator('#sankey-chart svg')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#spent-vendors-skeleton')).toBeVisible();
    await expect(page.locator('#spent-vendors-content')).toBeHidden();
    releaseB();
  });

  // The Vendors overlay "still loading" message is a SIBLING of the skeleton inside
  // .skeleton-overlay-wrap — never a DOM child (the .skeleton group-opacity pulse
  // would dim a descendant). Structural guard; force-visible since the bounded
  // (≤5 page) fetch rarely trips the real 10s timer.
  test('Spent: Vendors overlay message is a sibling inside .skeleton-overlay-wrap', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#content.visible', { timeout: 8000 });
    const inWrap = await page.locator('#spent-vendors-still-loading')
      .evaluate(el => !!el.closest('.skeleton-overlay-wrap'));
    expect(inWrap).toBe(true);
    const isChildOfSkeleton = await page.locator('#spent-vendors-still-loading')
      .evaluate(el => el.parentElement.classList.contains('skeleton'));
    expect(isChildOfSkeleton).toBe(false);
  });
});

test.describe('candidate.html — Spent tab footer (vendor note cut)', () => {
  test('spent footer is empty/hidden — vendor dedup note cut (C10.d, §5.j)', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#content.visible', { timeout: 8000 });
    await expect(page.locator('#spent-purpose-title')).toBeVisible(); // T-remove-profile-tabs: Spent section always in-flow (no tab click)
    await page.waitForFunction(
      () => { const el = document.getElementById('spent-vendors-content'); return el && el.style.display === 'block'; },
      { timeout: 12000 }
    );
    const footer = page.locator('#spent-data-note');
    await expect(footer).toBeHidden();
    await expect(footer).not.toContainText('deduplicated by recipient');
  });
});

test.describe('candidate.html — Spending by Purpose tooltip (C9 + cap)', () => {
  async function gotoSpent(page) {
    await page.waitForSelector('#content.visible', { timeout: 8000 });
    await expect(page.locator('#spent-purpose-title')).toBeVisible(); // T-remove-profile-tabs: Spent section always in-flow (no tab click)
    await page.waitForFunction(
      () => { const el = document.getElementById('spent-vendors-content'); return el && el.style.display === 'block'; },
      { timeout: 12000 }
    );
  }

  test('title mounts the methodology tooltip with the candidate sub-cycle sentence', async ({ page }) => {
    await setup(page);
    await gotoSpent(page);
    const trigger = page.locator('#spent-purpose-title .tooltip-trigger');
    await expect(trigger).toHaveCount(1);
    await expect(trigger).toHaveAttribute('aria-label', 'About spending by purpose');
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('Categories estimated from disbursement descriptions using keyword matching.');
    await expect(popup).toContainText('Covers most recent sub-cycle only.');
    await expect(popup).not.toContainText('capped at 500 transactions');
    // The old inline note under the bars is gone.
    await expect(page.locator('#spent-bars-content .data-note')).toHaveCount(0);
  });

  test('tooltip appends the cap fragment when Schedule B caps (C10.b)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Force the Schedule B walk to cap (>5 pages + a cursor on every page).
    await page.route('**/schedules/schedule_b/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{ disbursement_description: 'DIGITAL ADVERTISING', disbursement_amount: 1000, recipient_name: 'VENDOR A' }],
          pagination: { pages: 10, last_indexes: { last_index: '123', last_disbursement_amount: '1' } },
        }),
      })
    );
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await gotoSpent(page);
    const trigger = page.locator('#spent-purpose-title .tooltip-trigger');
    await expect(trigger).toBeAttached({ timeout: 15000 });
    await trigger.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    await expect(popup).toContainText('(capped at 500 transactions)');
  });
});

// ── T12.5: 429-aware error UI + init-stage failure bridging ──────────────────

test.describe('candidate.html — 429-aware error UI (T12.5)', () => {
  // Init-stage 429 — mock 429 on /candidate/{id}/totals/ (loadCycle's eager init
  // sequence). Without bridging, kickoffs never fire and skeletons hold forever.
  test('init-stage 429 → tab-error rate-limit copy on Raised + Spent', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // /committees/?cycle= is the eager-init fetch in loadCycle that surfaces to the
    // outer catch (per-cycle /totals/ calls have inner .catch that swallow errors
    // silently). 429 here triggers the T12.5 bridging.
    await page.route('**/api/fec/candidate/H2WA03217/committees/**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('cycle')) {
        route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
      } else {
        route.fallback();
      }
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    // Click Raised — error UI should render with rate-limit copy
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    await expect(page.locator('#raised-donors-error')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#raised-donors-error .tab-error-msg')).toHaveText(/rate limit reached/i);
    await expect(page.locator('#raised-donors-error .tab-retry-btn')).toBeHidden();
    // Skeletons should be hidden — not stuck
    await expect(page.locator('#raised-donors-skeleton')).toBeHidden();
    await expect(page.locator('#raised-conduits-skeleton')).toBeHidden();
    // Spent tab — init-stage error bridges to the opex tier's per-source error
    // (spent-progressive-loading: spentOpexError surfaces on bars + vendors).
    await expect(page.locator('#spent-purpose-title')).toBeVisible(); // T-remove-profile-tabs: Spent section always in-flow (no tab click)
    await expect(page.locator('#spent-vendors-error')).toBeVisible();
    await expect(page.locator('#spent-vendors-error .tab-error-msg')).toHaveText(/rate limit reached/i);
    await expect(page.locator('#spent-vendors-error .tab-retry-btn')).toBeHidden();
  });

  test('init-stage non-429 (500) → tab-error init-failure copy on Raised + Spent', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/candidate/H2WA03217/committees/**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('cycle')) {
        route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      } else {
        route.fallback();
      }
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    await expect(page.locator('#raised-donors-error')).toBeVisible({ timeout: 8000 });
    // Init-failure copy is distinct from rate-limit copy
    await expect(page.locator('#raised-donors-error .tab-error-msg')).toHaveText(/Couldn['’]t load this page/i);
    await expect(page.locator('#raised-donors-error .tab-error-msg')).not.toHaveText(/rate limit/i);
    await expect(page.locator('#raised-donors-error .tab-retry-btn')).toBeHidden();
  });

  test('tab-fetch 429 → rate-limit copy with retry button hidden', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
      } else {
        route.fallback();
      }
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    await expect(page.locator('#raised-donors-error')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#raised-donors-error .tab-error-msg')).toHaveText(/rate limit reached/i);
    await expect(page.locator('#raised-donors-error .tab-retry-btn')).toBeHidden();
  });

  test('tab-fetch non-429 (regression) → existing copy + retry button visible', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (url.searchParams.get('is_individual') === 'false') {
        route.abort('failed');
      } else {
        route.fallback();
      }
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    await expect(page.locator('#raised-donors-error')).toBeVisible({ timeout: 8000 });
    // Existing T12 copy unchanged
    await expect(page.locator('#raised-donors-error .tab-error-msg')).toHaveText(/Could not load top contributors/);
    await expect(page.locator('#raised-donors-error .tab-error-msg')).not.toHaveText(/rate limit/i);
    await expect(page.locator('#raised-donors-error .tab-retry-btn')).toBeVisible();
  });

  test('cycle switch via Cycle card chevron after 429 clears error and renders new cycle (T16)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    let block429 = true;
    await page.route('**/api/fec/schedules/schedule_a/?**', (route) => {
      const url = new URL(route.request().url());
      if (block429 && url.searchParams.get('is_individual') === 'false') {
        route.fulfill({ status: 429, contentType: 'application/json', body: '{}' });
      } else {
        route.fallback();
      }
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    await expect(page.locator('#raised-donors-error')).toBeVisible({ timeout: 8000 });
    // Lift the block, switch cycle via the Cycle card chevron → cycle index → row click.
    // T16 retired the in-tabs-bar switcher; this exercises the new cycle-change path.
    block429 = false;
    await page.locator('#cycle-back-btn').click();
    await page.waitForSelector('#cycle-index.visible', { timeout: 5000 });
    // Click a different cycle row than the one we just left (#2024 in setup; pick the other).
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    // Error UI clears, donor card eventually visible on the new cycle
    await expect(page.locator('#donors-card')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#raised-donors-error')).toBeHidden();
  });

  test('Raised donut skeleton: present in DOM, hidden once donut renders', async ({ page }) => {
    // 9c: the donut only renders when the breakdown slot is gated — use the
    // presidential fixture so renderContributorDonut runs and resolves the skeleton.
    await setupGatedDonuts(page);
    await expect(page.locator('#raised-donut-skeleton')).toBeAttached();
    // renderRaisedIfReady runs → donut renders synchronously from currentTotalsBreakdown
    // (set during loadCycle, in memory) → skeleton hides, content shows.
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
    await page.waitForFunction(
      () => document.getElementById('raised-donut-content').style.display === 'block',
      { timeout: 8000 }
    );
    await expect(page.locator('#raised-donut-skeleton')).toBeHidden();
  });
});

// ── Tab section: WAI-ARIA tabs for top contributors ──────────────────────────

test.describe('candidate.html — tab section (top contributors)', () => {
  // Raised tab content is display:none until user clicks Raised — every test
  // here clicks Raised before asserting on the tab section markup.
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await expect(page.locator('#raised-tab-section')).toBeVisible(); // T-remove-profile-tabs: Raised section always in-flow (no tab click)
  });

  test('tablist and tabs render with correct ARIA roles', async ({ page }) => {
    await expect(page.locator('#raised-tab-section [role="tablist"]')).toHaveCount(1);
    await expect(page.locator('#raised-tab-section [role="tab"]')).toHaveCount(2);
    const committees = page.locator('#raised-tab-btn-committees');
    await expect(committees).toHaveAttribute('aria-selected', 'true');
    await expect(committees).toHaveAttribute('aria-controls', 'raised-tab-panel-committees');
    const conduits = page.locator('#raised-tab-btn-conduits');
    await expect(conduits).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#raised-tab-panel-committees')).toBeVisible();
    await expect(page.locator('#raised-tab-panel-conduits')).toHaveAttribute('hidden', '');
  });

  test('clicking Conduits tab switches active panel and aria-selected state', async ({ page }) => {
    await page.locator('#raised-tab-btn-conduits').click();
    await expect(page.locator('#raised-tab-btn-conduits')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'false');
    await expect(page.locator('#raised-tab-panel-conduits')).toBeVisible();
    await expect(page.locator('#raised-tab-panel-committees')).toHaveAttribute('hidden', '');
  });

  test('keyboard arrow navigation moves between tabs', async ({ page }) => {
    await page.locator('#raised-tab-btn-committees').focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#raised-tab-btn-conduits')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(page.locator('#raised-tab-btn-committees')).toHaveAttribute('aria-selected', 'true');
  });

  test('section title carries the cycle range', async ({ page }) => {
    await expect(page.locator('#raised-tab-section-title')).toHaveText(
      /Top Contributors by type · 20\d\d–20\d\d/, { timeout: 15000 }
    );
  });
});

// ── T-load-1: skeleton profile-header + page-level loading timers ─────────
// Verifies the skeleton is structurally present in the served HTML (visible
// from first paint), hydrates cleanly when the entity call resolves, and
// the page-level timers (10s "still loading" + 30s retry) don't fire on
// normal loads (clear-path locked structurally).
test.describe('candidate.html — T-load-1 skeleton header', () => {
  test('skeleton spans present in initial HTML for candidate-name and meta-row', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/candidate.html');
    const html = await response.text();
    expect(html).toMatch(/<div class="page-title" id="candidate-name"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/<div class="meta-row" id="meta-row"><span class="skeleton"[^>]*><\/span><\/div>/);
  });

  test('skeleton spans replaced by real content after entity resolves', async ({ page }) => {
    await setup(page);
    // Real name in candidate-name (no skeleton span left)
    await expect(page.locator('#candidate-name')).toContainText(/[A-Za-z]+/);
    await expect(page.locator('#candidate-name .skeleton')).toHaveCount(0);
    // Real tags in meta-row (no skeleton span left)
    await expect(page.locator('#meta-row .skeleton')).toHaveCount(0);
    await expect(page.locator('#meta-row .fec-id-tag')).toBeVisible();
  });

  test('state-msg stays hidden on successful load — 10s/30s timers cleared on entity resolve', async ({ page }) => {
    await setup(page);
    // No "still loading" / retry message under the header during a normal load
    await expect(page.locator('#state-msg')).not.toBeVisible();
    // Re-check after a tick to be sure no async path reveals it
    await page.waitForTimeout(500);
    await expect(page.locator('#state-msg')).not.toBeVisible();
    await expect(page.locator('#state-msg')).toBeEmpty();
  });

  test('profile-header has no display:none in initial HTML — skeleton visible from first paint', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/candidate.html');
    const html = await response.text();
    // The reveal-display-toggle dance retired in T-load-1; ensure no
    // display:none lingers on #profile-header in the served HTML.
    expect(html).not.toMatch(/id="profile-header"[^>]*style="display:none/);
  });

  test('name skeleton renders at non-zero width during load window (T-load-header-title-skeleton regression lock)', async ({ page }) => {
    // Was a latent bug: width:60% inside .page-title (flex item, no flex-basis)
    // resolved to 0 via CSS circular-percentage-ref. Fix changed to width:8em
    // (proportional to title font-size). This test asserts the skeleton
    // actually has visible dimensions during the entity-fetch await window.
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/**', async (route) => {
      await new Promise(r => setTimeout(r, 2000));
      await route.fallback();
    });
    await page.goto('/candidate.html?id=H2WA03217', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(200);
    const dims = await page.evaluate(() => {
      const skel = document.querySelector('#candidate-name .skeleton');
      if (!skel) return null;
      const r = skel.getBoundingClientRect();
      return { width: r.width, height: r.height };
    });
    expect(dims).not.toBeNull();
    expect(dims.width).toBeGreaterThan(100);
    expect(dims.height).toBeGreaterThan(20);
  });
});

// ── T-load-3: skeleton stats-grid placeholders ─────────────────────────────
// Verifies skeletons are structurally present in the served HTML for both
// cycle-detail and cycle-index stat cells, hydrate cleanly after their
// respective resolves, and the cycle-switch reset path re-seeds skeletons
// during the loadCycle await window.
test.describe('candidate.html — T-load-3 stats-grid skeletons', () => {
  test('cycle-detail stat cells have skeleton spans in initial HTML (#stat-cycle excluded — sync hash-write)', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/candidate.html');
    const html = await response.text();
    // #stat-cycle has no skeleton — value derivable sync from URL hash (T-cycle-semantics)
    expect(html).not.toMatch(/id="stat-cycle"><span class="skeleton"/);
    expect(html).toMatch(/id="stat-cycle">—<\/div>/);
    expect(html).toMatch(/id="stat-raised"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/id="stat-spent"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/id="stat-coh"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/id="stat-ratio"><span class="skeleton"[^>]*><\/span><\/div>/);
  });

  test('#stat-cycle is hydrated synchronously from URL hash (T-cycle-semantics)', async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await expect(page.locator('#stat-cycle .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-cycle')).toHaveText('2024');
  });

  test('cycle-detail stat cells replaced by real values after loadCycle resolves', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#stat-cycle .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-raised .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-spent .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-coh .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-ratio .skeleton')).toHaveCount(0);
    await expect(page.locator('#stat-cycle')).toHaveText(/^\d{4}$/);
    await expect(page.locator('#stat-raised')).toHaveText(/\$[\d,.]+[MK]?/);
  });

  test('cycle-index career cells have skeleton spans in initial HTML', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/candidate.html');
    const html = await response.text();
    expect(html).toMatch(/id="cstat-history"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/id="cstat-career-raised"><span class="skeleton"[^>]*><\/span><\/div>/);
    expect(html).toMatch(/id="cstat-career-spent"><span class="skeleton"[^>]*><\/span><\/div>/);
  });

  test('cycle-index career cells replaced by real values after index resolves', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#cstat-history .skeleton')).toHaveCount(0);
    await expect(page.locator('#cstat-career-raised .skeleton')).toHaveCount(0);
    await expect(page.locator('#cstat-career-spent .skeleton')).toHaveCount(0);
    await expect(page.locator('#cstat-history')).toHaveText(/^\d{4}([–\-]\d{4})?$/);
  });
});

// ── T-load-4a: progressive cycle-index hydration ──────────────────────────────
// Architectural shift — index strips show with skeletons before /totals/
// resolves; hydrate after. Real cycle-row year labels at scaffold time (T-cycle-
// semantics); skeleton financial cells until /totals/ lands; partial-data retry
// UI on /totals/ failure with retry button refire.
test.describe('candidate.html — T-load-4a progressive cycle-index', () => {
  test('cycle-index scaffold renders with real year labels + skeleton financial cells during /totals/ fetch', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Delay /totals/?per_page=100 to keep the scaffold visible
    await page.route('**/api/fec/candidate/*/totals/?per_page=100**', async (route) => {
      await new Promise(r => setTimeout(r, 1500));
      await route.fallback();
    });
    await page.goto('/candidate.html?id=H2WA03217');
    // Scaffold should be visible while /totals/ is still in flight
    await page.waitForSelector('#cycle-index.visible', { timeout: 1000 });
    // Year labels are real (no skeleton on year column)
    const firstRowLabel = page.locator('#cycle-index a.cycle-row .cycle-row-label').first();
    await expect(firstRowLabel).toHaveText(/^\d{4}$/);
    // Financial cells are skeletons
    const firstRowSkeletons = page.locator('#cycle-index a.cycle-row').first().locator('.skeleton');
    await expect(firstRowSkeletons).toHaveCount(3); // raised, spent, coh
  });

  test('cycle-index financial cells replace skeletons with values after /totals/ resolves', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#cycle-index.visible', { timeout: 12000 });
    // After hydration, no skeletons remain in cycle rows
    await expect(page.locator('#cycle-index a.cycle-row .skeleton')).toHaveCount(0);
    // Financial cells have either dollar values or dashes
    const firstRowStats = page.locator('#cycle-index a.cycle-row').first().locator('.cycle-row-stat');
    await expect(firstRowStats.first()).toHaveText(/\$[\d,.]+[MK]?|—/);
  });

  test('back navigation to index does not refire /totals/ (cached promise reuse)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    let totalsRequestCount = 0;
    page.on('request', (req) => {
      if (/\/api\/fec\/candidate\/[^/]+\/totals\/\?per_page=100/.test(req.url())) {
        totalsRequestCount++;
      }
    });
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#cycle-index.visible', { timeout: 12000 });
    const initialCount = totalsRequestCount;
    expect(initialCount).toBeGreaterThanOrEqual(1);
    // Navigate to detail then back to index
    await page.evaluate(() => { window.location.hash = '#2024#summary'; });
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await page.evaluate(() => { history.replaceState('', '', location.pathname); window.dispatchEvent(new HashChangeEvent('hashchange')); });
    await page.waitForSelector('#cycle-index.visible', { timeout: 12000 });
    // Cached promise — no additional /totals/ request
    expect(totalsRequestCount).toBe(initialCount);
  });

  test('partial-data /totals/ failure renders .tab-error with retry button + dashed financial cells', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/candidate/*/totals/?per_page=100**', (route) => {
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#cycle-index .tab-error', { timeout: 12000 });
    // Retry button visible
    await expect(page.locator('#cycle-index .tab-error .tab-retry-btn')).toBeVisible();
    // Career-strip cells resolved to dashes
    await expect(page.locator('#cstat-history')).toHaveText('—');
    await expect(page.locator('#cstat-career-raised')).toHaveText('—');
    await expect(page.locator('#cstat-career-spent')).toHaveText('—');
    // Cycle row labels still present + financial cells dashed
    await expect(page.locator('#cycle-index a.cycle-row .cycle-row-label').first()).toHaveText(/^\d{4}$/);
  });

  test('partial-data retry click refires /totals/ and hydrates on success', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // First request fails; subsequent requests fall through to the mock (success)
    let totalsRequestCount = 0;
    await page.route('**/api/fec/candidate/*/totals/?per_page=100**', (route) => {
      totalsRequestCount++;
      if (totalsRequestCount === 1) {
        return route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      }
      return route.fallback();
    });
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#cycle-index .tab-error', { timeout: 12000 });
    // Click retry
    await page.locator('#cycle-index .tab-error .tab-retry-btn').click();
    // Tab-error gone, real values hydrated
    await page.waitForSelector('#cycle-index .tab-error', { state: 'detached', timeout: 12000 });
    await expect(page.locator('#cstat-career-raised')).not.toHaveText('—');
  });
});

// ── T-history-retire: /candidate/{id}/history/ is no longer called ─────────
// Architectural retirement (strategy/history-retirement.md). Verified that
// every field candidate.html previously read from /history/ is also returned
// by the entity endpoint with identical values across the sample (including
// Gillibrand's 2010 special-election cycle). These tests lock the absence of
// the /history/ call so a future regression that reintroduces it gets caught.
test.describe('candidate.html — T-history-retire regression lock', () => {
  test('/candidate/{id}/history/ is NOT called on cycle-index landing', async ({ page }) => {
    let historyCalled = false;
    page.on('request', (req) => {
      if (/\/api\/fec\/candidate\/[^/]+\/history\//.test(req.url())) historyCalled = true;
    });
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#cycle-index.visible', { timeout: 12000 });
    expect(historyCalled).toBe(false);
  });

  test('/candidate/{id}/history/ is NOT called on cycle-detail landing', async ({ page }) => {
    let historyCalled = false;
    page.on('request', (req) => {
      if (/\/api\/fec\/candidate\/[^/]+\/history\//.test(req.url())) historyCalled = true;
    });
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    expect(historyCalled).toBe(false);
  });
});

// ── T-loadcycle-single-fetch: loadCycle fires one totals call, not N ─────
// Architectural simplification. Was N parallel /totals/?cycle={sc} calls
// iterated and summed client-side (1 for H, 2 for P, 3 for S). Now a single
// /totals/?cycle={cycle}&election_full=true call returns FEC's pre-aggregated
// record. Data parity verified across H/S/P samples on 2026-05-19; this test
// locks the architectural decision.
test.describe('candidate.html — T-loadcycle-single-fetch regression lock', () => {
  test('cycle-detail fires exactly one /totals/?cycle= call (election_full=true)', async ({ page }) => {
    let totalsCalls = 0;
    page.on('request', (req) => {
      // Match cycle-specific totals call (e.g. /totals/?cycle=2024&election_full=true);
      // excludes the index view's /totals/?per_page=100 (no cycle param).
      if (/\/api\/fec\/candidate\/[^/]+\/totals\/\?.*\bcycle=/.test(req.url())) totalsCalls++;
    });
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    expect(totalsCalls).toBe(1);
  });
});

// ── T-load-4b: chart-card skeleton + error overlay ────────────────────────
// Skeleton overlays the canvas during cycle-detail loading; hidden by
// renderChart on resolve. Cycle-switch reset path re-overlays during the new
// cycle's await window. Catch branch resolves to inline "Unable to load chart"
// message rather than leaving the skeleton pulsing forever.
test.describe('candidate.html — T-load-4b chart-card skeleton', () => {
  test('chart-skeleton + chart-error overlays present in initial HTML; chart-legend hidden; canvas in normal flow', async ({ page }) => {
    const response = await page.context().request.get('http://localhost:8080/candidate.html');
    const html = await response.text();
    expect(html).toMatch(/id="chart-area"[^>]*height:320px/);
    expect(html).toMatch(/id="chart-skeleton" class="skeleton"/);
    expect(html).toMatch(/id="chart-error"[^>]*display:none/);
    // chart-legend hidden initially — swatches reference data not yet rendered
    expect(html).toMatch(/class="chart-legend" style="display:none"/);
  });

  test('chart-skeleton hidden after renderChart resolves; canvas + chart-legend visible', async ({ page }) => {
    await setupWithContent(page);
    // renderChart fires at the end of loadCycle; wait for skeleton hide
    await page.waitForFunction(() => {
      const sk = document.getElementById('chart-skeleton');
      return sk && sk.style.display === 'none';
    }, { timeout: 12000 });
    await expect(page.locator('#chart-timeline')).toBeVisible();
    await expect(page.locator('#chart-error')).toBeHidden();
    await expect(page.locator('.chart-legend')).toBeVisible();
    // chart-area's inline height:320px floor cleared (Chart.js sizes canvas naturally)
    const areaHeight = await page.locator('#chart-area').evaluate(el => el.style.height);
    expect(areaHeight).toBe('');
  });

  test('loadCycle catch resolves chart-skeleton to "Unable to load chart"', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Force loadCycle's catch branch by failing /committees/?cycle= (not /totals/,
    // which has its own .catch fallback inside the Promise.all and doesn't trigger).
    await page.route(/\/api\/fec\/candidate\/[^/]+\/committees\/\?cycle=/, route => {
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
    });
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    // Wait for chart-error overlay to become visible — the user-facing signal
    // that loadCycle's catch fired. The chart-error overlay owns chart-card
    // failure messaging.
    await page.waitForSelector('#chart-error', { state: 'visible', timeout: 12000 });
    // Skeleton hidden, error visible with the inline-status-msg copy.
    // Legend stays hidden — there's no chart for the swatches to reference.
    await expect(page.locator('#chart-skeleton')).toBeHidden();
    await expect(page.locator('#chart-error')).toContainText('Unable to load chart');
    await expect(page.locator('.chart-legend')).toBeHidden();
  });
});

// ── T-menu-btn-profile-header — profile menu-btn integration ─────────────────

test.describe('candidate.html — profile menu-btn', () => {
  test('menu-btn is visible after profile-header reveal', async ({ page }) => {
    await setup(page);
    const host = page.locator('#profile-menu-btn');
    await expect(host).toBeVisible();
    await expect(host.locator('.menu-btn')).toBeVisible();
    const expanded = await host.locator('.menu-btn').getAttribute('aria-expanded');
    expect(expanded).toBe('false');
  });

  test('menu-btn text label reads "Candidate" (page-specific override)', async ({ page }) => {
    await setup(page);
    const text = await page.locator('#profile-menu-btn .menu-btn-text').textContent();
    expect(text?.trim()).toBe('Candidate');
  });

  test('dropdown has 5 items in canonical order', async ({ page }) => {
    await setup(page);
    await page.locator('#profile-menu-btn .menu-btn').click();
    const ids = await page.locator('#profile-menu-btn .menu-item').evaluateAll(
      nodes => nodes.map(n => n.dataset.itemId)
    );
    expect(ids).toEqual(['profile', 'race', 'committees', 'compare', 'follow']);
  });

  test('Profile item is <button> with no href; enabled on detail view', async ({ page }) => {
    // Regression lock: Profile's destination is a view state of the current
    // page, not a navigation. It must render as <button> (onClick handler)
    // not <a href> — an href would trigger a full document reload instead
    // of the chevron's in-place view.switchTo path.
    await setup(page);  // setup uses #2024#summary → detail view
    await page.locator('#profile-menu-btn .menu-btn').click();
    const profile = page.locator('.menu-item[data-item-id="profile"]');
    const tag = await profile.evaluate(el => el.tagName);
    expect(tag).toBe('BUTTON');
    const href = await profile.getAttribute('href');
    expect(href).toBeNull();
    const disabled = await profile.getAttribute('aria-disabled');
    expect(disabled).toBeNull();
  });

  test('Profile item triggers in-place view.switchTo (no full reload)', async ({ page }) => {
    // Regression lock for the menu-btn-arc follow-up: clicking Profile in
    // detail view must mirror the cycle-back-btn chevron — clear the hash
    // via history.replaceState + call view.switchTo(false, NaN) — NOT
    // navigate via <a href>. Sentinel survives an in-place swap and would
    // be wiped by a full document reload.
    await setup(page);  // #2024#summary → detail view
    await page.evaluate(() => { window.__noReloadSentinel = 'kept'; });
    await page.locator('#profile-menu-btn .menu-btn').click();
    await page.locator('.menu-item[data-item-id="profile"]').click();
    await expect(page.locator('#cycle-index')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('#content')).toBeHidden();
    expect(new URL(page.url()).hash).toBe('');
    const sentinel = await page.evaluate(() => window.__noReloadSentinel);
    expect(sentinel).toBe('kept');
  });

  test('Profile item is aria-disabled on index view (bare URL)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217');   // bare URL → index
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await page.locator('#profile-menu-btn .menu-btn').click();
    const profile = page.locator('.menu-item[data-item-id="profile"]');
    await expect(profile).toHaveAttribute('aria-disabled', 'true');
  });

  test('Race item label and href reflect the viewed cycle on detail view', async ({ page }) => {
    await setup(page);  // #2024#summary
    await page.locator('#profile-menu-btn .menu-btn').click();
    const race = page.locator('.menu-item[data-item-id="race"]');
    const label = await race.locator('.menu-item-label').textContent();
    expect(label?.trim()).toBe('Race (2024)');
    await expect(race).toHaveAttribute('href', '/race?state=WA&office=H&year=2024&district=03');
  });

  test('Race item uses defaultCycle on index view (bare URL)', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await page.locator('#profile-menu-btn .menu-btn').click();
    const race = page.locator('.menu-item[data-item-id="race"]');
    // ALL_CYCLES = [2022, 2024] from the mock; defaultCycle = most-recent
    // non-future = 2024.
    const label = await race.locator('.menu-item-label').textContent();
    expect(label?.trim()).toBe('Race (2024)');
    await expect(race).toHaveAttribute('href', '/race?state=WA&office=H&year=2024&district=03');
  });

  test('Cycle change via hashchange updates Race item label + href', async ({ page }) => {
    await setup(page);  // #2024#summary
    // Direct within-detail hashchange — verifies trackPageViewed fires
    // (Verification A from the investigation report).
    await page.evaluate(() => { window.location.hash = '#2022#summary'; });
    // Wait for the menu updater to run — checked via the rendered label.
    await page.waitForFunction(() => {
      const lbl = document.querySelector('.menu-item[data-item-id="race"] .menu-item-label');
      return lbl && lbl.textContent.trim() === 'Race (2022)';
    }, { timeout: 5000 });
    await page.locator('#profile-menu-btn .menu-btn').click();
    const race = page.locator('.menu-item[data-item-id="race"]');
    await expect(race).toHaveAttribute('href', '/race?state=WA&office=H&year=2022&district=03');
  });

  test('Committees item opens the existing committees modal', async ({ page }) => {
    await setup(page);
    await openCommittees(page);
    await expect(page.locator('#committees-modal')).toBeVisible();
  });

  test('Compare item opens the info modal', async ({ page }) => {
    await setup(page);
    await page.locator('#profile-menu-btn .menu-btn').click();
    await page.locator('.menu-item[data-item-id="compare"]').click();
    await expect(page.locator('#info-modal')).toBeVisible();
  });

  test('Follow item opens the info modal', async ({ page }) => {
    await setup(page);
    await page.locator('#profile-menu-btn .menu-btn').click();
    await page.locator('.menu-item[data-item-id="follow"]').click();
    await expect(page.locator('#info-modal')).toBeVisible();
  });

  test('menu-btn is icon-only at ≤860px viewport', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#profile-menu-btn .menu-btn-text')).toHaveCount(0);
    await expect(page.locator('#profile-menu-btn .menu-btn-icon')).toHaveCount(1);
  });

  test('resize ≤860 → desktop preserves "Candidate" label (setShowText re-reads config text)', async ({ page }) => {
    // Start at mobile to trigger initial showText:false render.
    await page.setViewportSize({ width: 390, height: 800 });
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#profile-menu-btn .menu-btn-text')).toHaveCount(0);
    // Resize to desktop — matchMedia fires → setShowText(true) → renderTriggerInner
    // re-injects the stored text value. If setShowText hardcoded 'Menu', the
    // label would revert.
    await page.setViewportSize({ width: 1280, height: 800 });
    const text = await page.locator('#profile-menu-btn .menu-btn-text').textContent();
    expect(text?.trim()).toBe('Candidate');
  });

  test('menu-btn stays visible in compact header (CSS rule, not scroll listener)', async ({ page }) => {
    await setup(page);
    // Apply .compact class directly — the test verifies the CSS rule (or
    // absence of any .compact-keyed hide rule), not the scroll listener.
    await page.evaluate(() => {
      document.getElementById('profile-header').classList.add('compact');
    });
    await expect(page.locator('#profile-menu-btn')).toBeVisible();
  });
});

// ── T-modal-a11y — committees modal accessibility ───────────────────────────

test.describe('candidate.html — committees modal a11y', () => {
  test('role=dialog + aria-modal + aria-labelledby set on open', async ({ page }) => {
    await setup(page);
    await openCommittees(page);
    const modal = page.locator('#committees-modal');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    const labelledBy = await modal.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    // Referenced element exists and is the modal title
    const title = page.locator('#' + labelledBy);
    await expect(title).toHaveText('Associated Committees');
  });

  test('initial focus moves to first focusable inside modal (the ✕ close button)', async ({ page }) => {
    await setup(page);
    await openCommittees(page);
    await expect(page.locator('#committees-modal .modal-close')).toBeFocused();
  });

  test('focus returns to the menu-btn trigger on close', async ({ page }) => {
    await setup(page);
    await openCommittees(page);
    await page.keyboard.press('Escape');
    await expect(page.locator('#committees-modal')).not.toBeVisible();
    await expect(page.locator('#profile-menu-btn .menu-btn')).toBeFocused();
  });

  test('background .main has inert while open; removed on close', async ({ page }) => {
    await setup(page);
    await openCommittees(page);
    const inertOpen = await page.evaluate(() => document.querySelector('.main').hasAttribute('inert'));
    expect(inertOpen).toBe(true);
    await page.keyboard.press('Escape');
    const inertClosed = await page.evaluate(() => document.querySelector('.main').hasAttribute('inert'));
    expect(inertClosed).toBe(false);
  });

  test('body overflow:hidden while open; restored on close', async ({ page }) => {
    await setup(page);
    const priorOverflow = await page.evaluate(() => document.body.style.overflow);
    await openCommittees(page);
    const overflowOpen = await page.evaluate(() => document.body.style.overflow);
    expect(overflowOpen).toBe('hidden');
    await page.keyboard.press('Escape');
    const overflowClosed = await page.evaluate(() => document.body.style.overflow);
    expect(overflowClosed).toBe(priorOverflow);
  });

  test('Shift+Tab from first focusable wraps to last (focus trap)', async ({ page }) => {
    await setup(page);
    await openCommittees(page);
    // Wait for the lazy fetch to resolve — modal-tabs become visible AND
    // committee-row links render. Without this wait, only the ✕ button is
    // focusable and the focus-trap wrap is degenerate (stays on it).
    await expect(page.locator('#committees-modal .modal-tabs')).toBeVisible();
    await expect(page.locator('#committees-modal .committee-row').first()).toBeVisible();
    // Initial focus is the ✕ close button (first focusable in DOM order).
    await expect(page.locator('#committees-modal .modal-close')).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    // Focus should have moved off the close button to the last focusable
    // inside the modal — and stayed inside the modal.
    const focusedInModal = await page.evaluate(() => {
      const modal = document.getElementById('committees-modal');
      return modal.contains(document.activeElement);
    });
    expect(focusedInModal).toBe(true);
    const stillOnClose = await page.evaluate(() => {
      return document.activeElement === document.querySelector('#committees-modal .modal-close');
    });
    expect(stillOnClose).toBe(false);
  });

  test('outside-click on the overlay backdrop closes the modal', async ({ page }) => {
    await setup(page);
    await openCommittees(page);
    // Click at the top-left of the overlay where the backdrop is exposed
    await page.locator('#committees-modal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#committees-modal')).not.toBeVisible();
  });
});

// ── T-cycle-empty-state — whole-view empty state for cycles with no filings ──
// When a cycle has no financial filings, candidate.html replaces the tabs bar +
// tabbed content with a single whole-view empty state below the summary strip.
// The C5 string from the audit ("No financial filings for {cycle} cycle") lives
// in this surface, not in #data-note. Banner is also hidden in this case (the
// active-cycle "No Data" variant from assessHealth() and the closed-cycle
// "Cycle Complete · no outstanding debt reported" framing both read oddly on a
// no-data cycle). Summary strip (stats grid em-dashes + race context bar) stays.
test.describe('candidate.html — T-cycle-empty-state', () => {

  // Setup: add 2026 to the candidate's election_years (so #2026#summary lands
  // in detail view rather than falling through to the index via NaN routing),
  // and mock the cycle-detail /totals/?cycle=2026&election_full=true fetch to
  // return an empty results array — matches the real API shape for a
  // no-financial-filings cycle (verified against
  // /api/fec/candidate/H6WA03309/totals/?cycle=2026&election_full=true which
  // returns {results: [], pagination: {count: 0, pages: 0, …}}).
  async function emptyCycleSetup(page) {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Override the candidate entity to add 2026 to election_years so ALL_CYCLES
    // includes it and #2026#summary routes to detail view.
    await page.route(/\/api\/fec\/candidate\/H2WA03217\/(?!.*\/)/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            candidate_id: 'H2WA03217',
            name: 'GLUESENKAMP PEREZ, MARIE',
            party: 'DEM', party_full: 'DEMOCRATIC PARTY',
            office: 'H', office_full: 'House',
            state: 'WA', district: '03',
            election_years: [2022, 2024, 2026],
            incumbent_challenge: 'I', incumbent_challenge_full: 'Incumbent',
            first_file_date: '2022-02-22',
          }],
          pagination: { count: 1, pages: 1, per_page: 20, page: 1 },
        }),
      });
    });
    // Override the cycle-detail totals fetch for cycle=2026 to return empty.
    // The default mock returns TOTALS (which has data) for any cycle param;
    // we narrow to cycle=2026 here.
    await page.route(/\/api\/fec\/candidate\/H2WA03217\/totals\/.*cycle=2026/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [],
          pagination: { count: 0, pages: 0, per_page: 20, page: 1 },
        }),
      });
    });
    await page.goto('/candidate.html?id=H2WA03217#2026#summary');
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    // Wait for #cycle-empty-state to become visible — signal that loadCycle's
    // empty branch fired and the visibility swap landed.
    await page.waitForSelector('#cycle-empty-state', { state: 'visible', timeout: 12000 });
  }

  test('empty-state element is visible and contains the C5 copy', async ({ page }) => {
    await emptyCycleSetup(page);
    const emptyState = page.locator('#cycle-empty-state');
    await expect(emptyState).toBeVisible();
    await expect(emptyState).toHaveText('No financial filings for 2026 cycle.');
  });

  test('flowing detail content is hidden on empty cycle (T-remove-profile-tabs)', async ({ page }) => {
    await emptyCycleSetup(page);
    await expect(page.locator('#content')).toBeHidden();
  });

  test('#banner is hidden on empty cycle (no "No Data" / "Cycle Complete" copy renders)', async ({ page }) => {
    await emptyCycleSetup(page);
    await expect(page.locator('#banner')).toBeHidden();
    // Defensive: confirm the now-dead "No Data" string from assessHealth() and
    // the closed-cycle "Cycle Complete" string don't slip into the live DOM.
    await expect(page.locator('#banner-label')).not.toHaveText('No Data');
    await expect(page.locator('#banner-label')).not.toHaveText('Cycle Complete');
  });

  test('#summary-strip stays visible on empty cycle with em-dashed stats', async ({ page }) => {
    await emptyCycleSetup(page);
    await expect(page.locator('#summary-strip')).toBeVisible();
    // Stats resolve to em-dash on empty cycle (T-load-3 dash semantic — absence
    // of filings, not $0).
    await expect(page.locator('#stat-raised')).toHaveText('—');
    await expect(page.locator('#stat-spent')).toHaveText('—');
    await expect(page.locator('#stat-coh')).toHaveText('—');
    await expect(page.locator('#stat-ratio')).toHaveText('—');
  });

  test('cycle-switch from empty cycle to data-present cycle re-shows content/banner and hides empty-state', async ({ page }) => {
    // Land on 2026 (empty) first to set the "no-data state" baseline.
    await emptyCycleSetup(page);
    await expect(page.locator('#cycle-empty-state')).toBeVisible();
    await expect(page.locator('#content')).toBeHidden();
    // Switch cycle via location.hash mutation — fires hashchange handler which
    // calls view.switchTo(true, 2024) → loadCycle(2024). This exercises the
    // real cycle-switch path (not just a synthetic display toggle); the reset
    // block at the top of loadCycle is what restores content/banner visibility,
    // so this test asserts the reset-block contract. (Legacy #2024#summary form
    // also exercises tab-segment back-compat.)
    await page.evaluate(() => { location.hash = '#2024#summary'; });
    // Wait for the flowing content to come back — signal that the data-present
    // cycle's loadCycle reset block + Step 4 banner gate ran.
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await expect(page.locator('#cycle-empty-state')).toBeHidden();
    await expect(page.locator('#content')).toBeVisible();
    await expect(page.locator('#banner')).toBeVisible();
  });

  // T-cycle-empty-state-jump-mitigation (2026-05-28) — banner deferred reveal.
  // On initial detail-view entry, #banner stays hidden through the loadCycle
  // fetch window and appears only at Step 4's data-present branch. Locks the
  // HTML default (style="display:none") + reset-block omission that defers
  // banner reveal so race-context-bar doesn't shift upward during the fetch
  // wait. Mock totals fetch with a delay long enough for Playwright to observe
  // the hidden state before resolve.
  test('banner is hidden during the loadCycle fetch window on a data-present cycle, revealed after data resolves', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Delay the cycle-detail /totals/?cycle= fetch by 1000ms so Playwright can
    // observe banner hidden during the window. Bumped to 1000ms (over the 500ms
    // baseline from the plan) for headroom against Playwright's poll cycle.
    await page.route(/\/api\/fec\/candidate\/H2WA03217\/totals\/.*cycle=2024/, async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            receipts: 3500000,
            disbursements: 3100000,
            last_cash_on_hand_end_period: 450000,
            coverage_end_date: '2024-12-31T00:00:00',
            cycle: 2024,
          }],
          pagination: { count: 1 },
        }),
      });
    });
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    // Wait for the profile header to reveal — signal that init/entity resolved
    // and view.switchTo fired. At this moment, #summary-strip is visible (stats
    // skeletons + race-context-bar) but the cycle-detail fetch is still
    // pending. #banner should be hidden via the HTML default.
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#banner')).toBeHidden();
    // Wait for the cycle-detail fetch to resolve and Step 4 to populate
    // banner-label with non-placeholder content — signal that the data branch
    // ran. Banner should now be visible.
    await expect(page.locator('#banner-label')).not.toHaveText('—', { timeout: 12000 });
    await expect(page.locator('#banner')).toBeVisible();
  });
});

// ── Phase 2 PAGE-NOTE — page-level data note on candidate detail ──────────────
// Shipped 2026-05-29. #page-note carries Source line + Coverage stamp + ≤$200
// caveat at page level (Source-first ordering, FEC linked to www.fec.gov). Lives
// inside #content, after #tab-spent — visible across all tab views. Hidden on
// no-data cycles via #content's display:none (T-cycle-empty-state inheritance).

test.describe('candidate.html — Phase 2 PAGE-NOTE', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    // Wait for content reveal — signals loadCycle's data branch ran and Step
    // 3 populated #page-note.
    await page.waitForSelector('#content', { state: 'visible', timeout: 12000 });
  });

  test('#page-note exists and is visible on data-present cycle', async ({ page }) => {
    const pn = page.locator('#page-note');
    await expect(pn).toBeVisible();
  });

  test('#page-note carries Source line + Coverage stamp + ≤$200 caveat', async ({ page }) => {
    const pn = page.locator('#page-note');
    // Source-first ordering per design call.
    await expect(pn).toContainText('Source: FEC.');
    // Coverage stamp (mock fixture has 2024-12-31 covDate).
    await expect(pn).toContainText('Coverage through');
    // ≤$200 caveat (moved from raised-data-note to PAGE-NOTE in this commit).
    await expect(pn).toContainText('Individual contributions of $200 or less are not itemized.');
  });

  test('#page-note FEC link → fec.gov (consumer site)', async ({ page }) => {
    const link = page.locator('#page-note a[href="https://www.fec.gov/"]');
    await expect(link).toHaveText('FEC');
  });

  test('#page-note is the last child of #content (visible across the whole flow)', async ({ page }) => {
    // Post-flatten the #tab-* wrappers are gone; #page-note is a direct child of
    // #content and the LAST one, so it sits below every section in the single flow.
    const placement = await page.evaluate(() => {
      const note = document.getElementById('page-note');
      const content = document.getElementById('content');
      return {
        directChild: note && note.parentElement === content,
        isLast: content && content.lastElementChild === note,
      };
    });
    expect(placement.directChild).toBe(true);
    expect(placement.isLast).toBe(true);
  });

  test('#page-note retired strings are gone', async ({ page }) => {
    // C1 retired earlier; C4.a, C4.c (in summary footer), C4.d, C4.e all
    // retired in Phase 2. The full sentence the old #data-note carried
    // should not appear in #page-note.
    const pn = page.locator('#page-note');
    await expect(pn).not.toContainText('Source: FEC — Candidate ID');
    await expect(pn).not.toContainText('Raised-to-spent = total receipts');
    await expect(pn).not.toContainText('Data updated nightly by FEC');
  });
});

// ── Money flow (Sankey) mount — 9c: owns the breakdown slot on IN-SCOPE entities
// (the default House fixture); the donut pair is mutually exclusive (gated only). ──
test.describe('candidate.html — Money flow (Sankey) mount', () => {
  test('renders an ECharts SVG on a data-present cycle; skeleton clears', async ({ page }) => {
    await setupWithContent(page);
    await expect(page.locator('#money-flow-card')).toBeVisible();
    // ECharts SVG renderer → an <svg> inside the chart container once the model renders.
    await expect(page.locator('#sankey-chart svg')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#sankey-skeleton')).toBeHidden();
    await expect(page.locator('#sankey-gate')).toBeHidden();
  });

  test('Money flow title mounts the cohStart-derivation info-tooltip', async ({ page }) => {
    await setupWithContent(page);
    // initTooltips replaces the static .tooltip span with a .tooltip-trigger button.
    await expect(page.locator('#money-flow-title .tooltip-trigger')).toHaveCount(1);
  });

  test('no "Debt at close" caption on a zero-debt cycle (base fixture)', async ({ page }) => {
    await setupWithContent(page);
    // Base fixture has last_debts_owed_by_committee: 0 → model.debt === 0 → caption hidden.
    await expect(page.locator('#sankey-chart svg')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#sankey-debt')).toBeHidden();
  });
});

// #sankey-debt is a conditional render (shows only when model.debt > 0). The base
// fixture's debt is 0, so this gap needs a positive-debt route override to cover.
test.describe('candidate.html — Money flow debt caption', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // Data-present, non-gated, conserving record with positive end-of-cycle debt.
    await page.route('**/api/fec/candidate/H2WA03217/totals/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results: [{ cycle: 2024, candidate_election_year: 2024, election_full: true,
          receipts: 1000000, disbursements: 800000, last_cash_on_hand_end_period: 200000,
          last_debts_owed_by_committee: 250000, coverage_end_date: '2024-12-31T00:00:00',
          individual_itemized_contributions: 400000, transfers_from_other_authorized_committee: 600000,
          operating_expenditures: 800000 }],
        pagination: { count: 1 } }) });
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#content.visible', { timeout: 12000 });
  });

  test('renders "Debt at close: $X" when end-of-cycle debt > 0', async ({ page }) => {
    await expect(page.locator('#sankey-chart svg')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#sankey-debt')).toBeVisible();
    await expect(page.locator('#sankey-debt')).toContainText('Debt at close:');
    await expect(page.locator('#sankey-debt')).toContainText('$250K');  // fmt(250000)
  });
});

// 9c: presidential (Form 3P → gated) no longer shows the Sankey gate caption — the
// breakdown slot mounts the donut PAIR instead, and the Money flow card is hidden
// entirely (§4: the donut pair is a complete first-class view, not a consolation
// prize, so there is NO "not yet modeled" caption). The gate DETECTOR still fires;
// it just selects the donut viz rather than driving a visible message.
test.describe('candidate.html — breakdown slot: presidential is gated → donut pair (9c)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await routeGatedCandidate(page);  // office 'P' override; base totals fall through
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#content.visible', { timeout: 12000 });
  });

  test('presidential mounts the donut pair, hides the Money flow card, shows no gate caption', async ({ page }) => {
    await expect(page.locator('#raised-donut-content')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#spent-donut-content')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#money-flow-card')).toBeHidden();
    await expect(page.locator('#sankey-gate')).toBeHidden();
  });
});

// transfers_from_affiliated_committee (Form-3P) — a presidential candidate's joint-
// fundraising transfers; the donut (presidential fallback) must include it in the
// "Candidate authorized committees" wedge (verified mutually exclusive, 2026-06-09).
test.describe('candidate.html — donut transfers wedge includes Form-3P transfers', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/candidate/H2WA03217/totals/**', (route) => {
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        results: [{ cycle: 2024, receipts: 1000000, disbursements: 800000, last_cash_on_hand_end_period: 200000,
          coverage_end_date: '2024-12-31T00:00:00', candidate_election_year: 2024,
          individual_itemized_contributions: 400000, transfers_from_affiliated_committee: 600000,
          operating_expenditures: 800000 }],
        pagination: { count: 1 } }) });
    });
    // 9c: transfers_from_affiliated_committee is the Form-3P JFC transfer, so the
    // entity must be presidential — which also gates the slot (Form 3P), mounting the
    // donut pair so the wedge is assertable. Registered last → metadata returns office
    // 'P'; the totals route above still serves the custom transfers fixture (fallback).
    await routeGatedCandidate(page);
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#raised-donut-content', { state: 'visible', timeout: 12000 });
  });
  test('Raised donut "Candidate authorized committees" wedge reads transfers_from_affiliated_committee', async ({ page }) => {
    const row = page.locator('#donut-legend .donut-row', { has: page.locator('.donut-lbl-text', { hasText: 'Candidate authorized committees' }) });
    await expect(row).toHaveCount(1);
    await expect(row.locator('.donut-val')).toHaveText('$600K');
  });
});

// Routing regression lock (profile flatten, 9a): the #cycle hash routing is independent
// of the inert #tab-* wrapper divs, so dissolving them in 9b must not change it. Bundles
// the three invariants as one named lock — passes at the current DOM, guards the 9b re-org.
test.describe('candidate.html — routing intact (flatten regression lock)', () => {
  test('bare URL → index; #cycle → detail (canonicalized); back → index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    // bare URL → index view (career strip + cycle index; detail content hidden)
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#cycle-index')).toBeVisible();
    await expect(page.locator('#content')).toBeHidden();
    // deep-link #cycle → detail; content visible; URL canonicalized to bare #2024
    await page.goto('/candidate.html?id=H2WA03217#2024');
    await page.waitForSelector('#content.visible', { timeout: 12000 });
    await expect(page.locator('#money-flow-card')).toBeVisible();
    await expect(page).toHaveURL(/#2024$/);
    // browser back → index restored
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#cycle-index')).toBeVisible();
  });
});
