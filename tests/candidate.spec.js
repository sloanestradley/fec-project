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

  test('#race-label is present in the profile header', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#race-label')).toBeAttached();
  });

  test('#race-label contains a link to the race page', async ({ page }) => {
    await setup(page);
    const link = page.locator('#race-label a');
    await expect(link).toBeAttached();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/race\?state=/);
  });

  test('meta-row has no .tag-neutral race tag (race tag removed on redesign branch)', async ({ page }) => {
    await setup(page);
    // incumbent tag and fec-id tag use .tag-neutral too — check there's no other .tag-neutral (e.g. a re-introduced race tag)
    await expect(page.locator('#meta-row .tag-neutral:not(.incumbent-tag):not(.fec-id-tag)')).toHaveCount(0);
  });

  test('FEC ID tag renders with candidate ID text', async ({ page }) => {
    await setup(page);
    const fec = page.locator('#meta-row .fec-id-tag');
    await expect(fec).toBeVisible();
    await expect(fec).toHaveText(/FEC ID · H2WA03217/);
  });

  test('First filed prose span renders with year', async ({ page }) => {
    await setup(page);
    const prose = page.locator('#meta-row .meta-prose');
    await expect(prose).toBeVisible();
    await expect(prose).toHaveText(/First filed 2022/);
  });

  test('meta-row is a sibling of .profile-header-row, not a child', async ({ page }) => {
    await setup(page);
    await expect(page.locator('.profile-header-row #meta-row')).toHaveCount(0);
    await expect(page.locator('#profile-header > #meta-row')).toHaveCount(1);
  });

  test('meta-row children render in canonical order: party → incumbent → FEC ID → First filed', async ({ page }) => {
    await setup(page);
    // MGP is the incumbent in the mock fixture; all four children should be present.
    const roles = await page.locator('#meta-row > *').evaluateAll(nodes => nodes.map(n => {
      if (n.classList.contains('tag-dem') || n.classList.contains('tag-rep') || n.classList.contains('tag-ind')) return 'party';
      if (n.classList.contains('incumbent-tag')) return 'incumbent';
      if (n.classList.contains('fec-id-tag')) return 'fec-id';
      if (n.classList.contains('meta-prose')) return 'first-filed';
      return 'other:' + n.className;
    }));
    expect(roles).toEqual(['party', 'incumbent', 'fec-id', 'first-filed']);
  });

  test('race-context element is present in meta-row', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#race-context')).toBeAttached();
  });

  test('race-context renders tag-context with text span and view-race link', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#race-context .tag-context')).toBeAttached();
    await expect(page.locator('#race-context .tag-context .tag-context-text')).toBeAttached();
    await expect(page.locator('#race-context .tag-context a')).toBeAttached();
  });

  test('profile header sentinel exists for compact observer', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#profile-header-sentinel')).toBeAttached();
  });

  test('compact sep is inside profile header and hidden in full mode', async ({ page }) => {
    await setup(page);
    await expect(page.locator('#profile-header .compact-sep')).toBeAttached();
    await expect(page.locator('#profile-header')).not.toHaveClass(/compact/);
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
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
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
    await page.waitForTimeout(200);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const pb = await page.locator('.main').evaluate(el => el.style.paddingBottom);
    expect(pb).toBe('');
  });

  test('incumbent tag shown for incumbent candidate', async ({ page }) => {
    await setup(page);
    const tag = page.locator('#meta-row .incumbent-tag');
    await expect(tag).toBeVisible({ timeout: 5000 });
    await expect(tag).toHaveText('Incumbent');
  });

  test('cycle switcher renders as select with options', async ({ page }) => {
    await setup(page);
    const switcher = page.locator('select#cycle-switcher');
    await expect(switcher).toBeVisible();
    const options = switcher.locator('option');
    await expect(options).not.toHaveCount(0);
  });

  test('committees trigger shows no count, ready immediately', async ({ page }) => {
    await setup(page);
    // T11: committees fetch is deferred to modal-open. The trigger is revealed
    // unconditionally on init and reads "Committees →" with no parenthetical.
    const trigger = page.locator('#committees-trigger');
    await expect(trigger).toBeVisible({ timeout: 8000 });
    const btn = trigger.locator('.committees-link');
    const text = await btn.textContent();
    expect(text?.trim()).toBe('Committees →');
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

  test('summary-strip (banner + stats) persists across Summary/Raised/Spent tabs', async ({ page }) => {
    await setupWithContent(page);
    // Summary tab (default): both visible
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .banner')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
    // Raised tab
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .banner')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
    // Spent tab
    await page.locator('.tab').filter({ hasText: 'Spent' }).click();
    await expect(page.locator('#summary-strip')).toBeVisible();
    await expect(page.locator('#summary-strip .banner')).toBeVisible();
    await expect(page.locator('#summary-strip .stats-grid')).toBeVisible();
  });

  test('first stat card is Raised:Spent ratio', async ({ page }) => {
    await setupWithContent(page);
    const firstLabel = page.locator('#summary-strip .stats-grid .stat-card').first().locator('.stat-label');
    await expect(firstLabel).toHaveText('Raised:Spent ratio');
  });

  test('#summary-strip precedes #tabs-bar in the DOM (T21 contract)', async ({ page }) => {
    await setupWithContent(page);
    const stripBeforeTabs = await page.evaluate(() => {
      const strip = document.querySelector('#summary-strip');
      const tabs = document.querySelector('#tabs-bar');
      if (!strip || !tabs) return false;
      return !!(strip.compareDocumentPosition(tabs) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(stripBeforeTabs).toBe(true);
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

// ── Tab navigation ────────────────────────────────────────────────────────────

test.describe('candidate.html — tab navigation', () => {
  test('three tabs are visible: Summary, Raised, Spent', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });
    const tabs = page.locator('.tabs-bar .tab');
    await expect(tabs).toHaveCount(3);
    await expect(tabs.nth(0)).toHaveText('Summary');
    await expect(tabs.nth(1)).toHaveText('Raised');
    await expect(tabs.nth(2)).toHaveText('Spent');
  });

  test('Summary tab is active by default', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });
    const summaryTab = page.locator('.tabs-bar .tab').filter({ hasText: 'Summary' });
    await expect(summaryTab).toHaveClass(/active/);
  });

  test('clicking Raised tab activates it', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    const raisedTab = page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' });
    await expect(raisedTab).toHaveClass(/active/);
  });
});

// ── Raised tab: geography heatmap + contributor table ────────────────────────

test.describe('candidate.html — Raised tab sections', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    // Wait for the slow-tier donors content to render — signal that both fast
    // and slow tiers have resolved. (.donors-card is now inside a tab panel;
    // its style.display is no longer the load-state signal — content is.)
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

// ── Committees modal ──────────────────────────────────────────────────────────

test.describe('candidate.html — committees modal', () => {
  test.beforeEach(async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#committees-trigger', { timeout: 10000 });
    await page.locator('.committees-link').click();
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
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
    await page.locator('.committees-link').click();
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
    await page.waitForSelector('#committees-trigger', { timeout: 12000 });
    expect(captured).toEqual([]);
    await page.locator('.committees-link').click();
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
    await page.waitForSelector('#committees-trigger', { timeout: 12000 });
    await page.locator('.committees-link').click();
    await page.waitForSelector('.committee-row', { timeout: 8000 });
    const firstCount = captured.length;
    expect(firstCount).toBeGreaterThanOrEqual(2);
    await page.keyboard.press('Escape');
    await page.waitForFunction(
      () => document.getElementById('committees-modal').style.display === 'none',
      { timeout: 3000 }
    );
    await page.locator('.committees-link').click();
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
    await page.waitForSelector('#committees-trigger', { timeout: 12000 });
    await page.locator('.committees-link').click();
    await page.waitForSelector('.committee-row', { timeout: 8000 });
    const firstCount = captured.length;
    await page.reload();
    await page.waitForSelector('#committees-trigger', { timeout: 12000 });
    await page.locator('.committees-link').click();
    await page.waitForSelector('.committee-row', { timeout: 8000 });
    expect(captured.length).toBeGreaterThan(firstCount);
  });
});

// ── URL hash pre-selection ────────────────────────────────────────────────────

test.describe('candidate.html — URL hash pre-selection', () => {
  test('hash #2022#raised pre-selects Raised tab', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2022#raised');
    await page.waitForSelector('#tabs-bar', { timeout: 12000 });
    const raisedTab = page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' });
    await expect(raisedTab).toHaveClass(/active/);
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

  test('Tab Switched fires on tab click (not on page init)', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#tabs-bar', { timeout: 8000 });

    // Confirm it hasn't fired yet
    let event = await findTrackEvent(page, 'Tab Switched');
    expect(event).toBeUndefined();

    // Click a tab
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();

    event = await findTrackEvent(page, 'Tab Switched');
    expect(event).toBeDefined();
  });

  test('Committees Modal Opened fires on trigger click', async ({ page }) => {
    await setup(page);
    await page.waitForSelector('#committees-trigger', { timeout: 8000 });
    await page.locator('.committees-link').click();
    const event = await findTrackEvent(page, 'Committees Modal Opened');
    expect(event).toBeDefined();
  });

  test('Page Viewed fires with view: detail when URL has cycle hash', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('.tabs-bar.visible', { timeout: 12000 });
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ view: 'detail' });
  });
});

// ── Nav active state ──────────────────────────────────────────────────────────

test.describe('candidate.html — nav active state', () => {
  test('"Candidates" nav item is active (profile activates parent browse)', async ({ page }) => {
    await setup(page);
    const activeItem = page.locator('.top-nav .nav-link.active');
    const text = await activeItem.first().textContent();
    expect(text?.trim()).toContain('Candidates');
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

  test('bare URL renders CareerStrip and cycle index, not tabs-bar or summary-strip', async ({ page }) => {
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#cycle-index')).toBeVisible();
    await expect(page.locator('#tabs-bar')).not.toBeVisible();
    await expect(page.locator('#summary-strip')).not.toBeVisible();
  });

  test('#cycles hash also renders index view', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#cycles');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#cycle-index')).toBeVisible();
    await expect(page.locator('#tabs-bar')).not.toBeVisible();
  });

  test('CareerStrip renders four cells with expected labels', async ({ page }) => {
    const labels = await page.locator('#career-strip .stat-label').allTextContents();
    expect(labels).toContain('First Filed');
    expect(labels).toContain('Last Activity');
    expect(labels).toContain('Career Raised');
    expect(labels).toContain('Career Spent');
  });

  test('CareerStrip First Filed cell shows a year', async ({ page }) => {
    const val = await page.locator('#cstat-first-filed').textContent();
    expect(val?.trim()).toMatch(/^\d{4}$/);
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

  test('clicking a cycle row navigates to #{year}#summary URL', async ({ page }) => {
    const row = page.locator('#cycle-index a.cycle-row').first();
    const href = await row.getAttribute('href');
    expect(href).toMatch(/#\d{4}#summary/);
  });

  test('cycle row labels contain a year range with en-dash', async ({ page }) => {
    const label = await page.locator('#cycle-index a.cycle-row .cycle-row-label').first().textContent();
    expect(label?.trim()).toMatch(/^\d{4}[\u2013\-]\d{4}$/);
  });

  test('#committees-trigger is visible in index view', async ({ page }) => {
    await expect(page.locator('#committees-trigger')).toBeVisible();
  });
});

// ── Landing state regression — detail view unchanged ─────────────────────────

test.describe('candidate.html — landing state regression (detail view unchanged)', () => {
  test('#{year}#{tab} URL renders detail view, not index', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#summary');
    await page.waitForSelector('.tabs-bar.visible', { timeout: 12000 });
    // Positive assertion: detail-view elements are visible (proves the detail path ran)
    await expect(page.locator('#tabs-bar')).toBeVisible();
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
    // Override /history/ to include a pre-2008 cycle
    await page.route('**/api/fec/candidate/**history**', route => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({
          results: [{
            candidate_id: 'H2WA03217',
            cycles: [2024, 2006],
            first_file_date: '2004-01-01',
            last_file_date: '2024-10-15',
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
    expect(text).toContain('2008');
    expect(text).toContain('House');
  });
});

// ── In-place transitions — index ↔ detail ─────────────────────────────────────

test.describe('candidate.html — in-place transitions', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217');
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
  });

  test('no page reload on cycle row click', async ({ page }) => {
    await page.evaluate(() => { document.body.dataset.loadId = '1'; });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    const loadId = await page.evaluate(() => document.body.dataset.loadId);
    expect(loadId).toBe('1');
  });

  test('#profile-header is the same DOM node after index → detail transition', async ({ page }) => {
    await page.evaluate(() => { document.getElementById('profile-header').dataset.mark = 'x'; });
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    const mark = await page.evaluate(() => document.getElementById('profile-header').dataset.mark);
    expect(mark).toBe('x');
  });

  test('index view elements hidden after transition to detail', async ({ page }) => {
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).not.toBeVisible();
    await expect(page.locator('#cycle-index')).not.toBeVisible();
  });

  test('back button returns to index view', async ({ page }) => {
    // No pre-scroll — indexScrollY=0, so compact should NOT be active after back
    await page.locator('#cycle-index a.cycle-row').first().click();
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    await page.goBack();
    await page.waitForSelector('#career-strip.visible', { timeout: 12000 });
    await expect(page.locator('#career-strip')).toBeVisible();
    await expect(page.locator('#tabs-bar')).not.toBeVisible();
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
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
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
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
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
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
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
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
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
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    await page.waitForFunction(
      () => { const el = document.getElementById('stat-raised'); return el && el.textContent !== '—'; },
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
    await expect(page.locator('#tabs-bar')).not.toBeVisible();
    await expect(page.locator('#summary-strip')).not.toBeVisible();
  });

  test('invalid tab hash (e.g. #2024#bogus) defaults to Summary', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidate.html?id=H2WA03217#2024#bogus');
    await page.waitForSelector('#tabs-bar.visible', { timeout: 12000 });
    const summaryTab = page.locator('.tab[href="#summary"]');
    await expect(summaryTab).toHaveClass(/active/);
    const hash = await page.evaluate(() => window.location.hash);
    expect(hash).toBe('#2024#summary');
  });
});

// ── T12: Raised/Spent loading-state behavior ─────────────────────────────────

test.describe('candidate.html — Raised/Spent loading states (T12)', () => {
  test('Raised: donut renders synchronously, skeletons visible while slow tier in flight', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    // Donut canvas renders synchronously from totals
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    const err = page.locator('#raised-slow-error');
    await expect(err).toBeVisible({ timeout: 8000 });
    await expect(err.locator('.tab-retry-btn')).toBeVisible();
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    // Active panel's skeleton has substantive height. Inactive panel skeletons
    // collapse with their hidden parent — measure each by activating its tab.
    const donorsHeight = await page.locator('#raised-donors-skeleton').evaluate(el => el.getBoundingClientRect().height);
    expect(donorsHeight).toBeGreaterThanOrEqual(200);
    await page.locator('#raised-tab-btn-conduits').click();
    const conduitsHeight = await page.locator('#raised-conduits-skeleton').evaluate(el => el.getBoundingClientRect().height);
    expect(conduitsHeight).toBeGreaterThanOrEqual(200);
  });

  test('Spent: failure renders error with retry button', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.route('**/api/fec/schedules/schedule_b/**', (route) => route.abort('failed'));
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Spent' }).click();
    const err = page.locator('#spent-error');
    await expect(err).toBeVisible({ timeout: 8000 });
    await expect(err.locator('.tab-retry-btn')).toBeVisible();
  });

  test('Spent: retry click re-fires fetch and renders content', async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    let abortNext = true;
    await page.route('**/api/fec/schedules/schedule_b/**', (route) => {
      if (abortNext) route.abort('failed');
      else route.fallback();
    });
    await page.goto(CANDIDATE_URL);
    await page.waitForSelector('#profile-header.visible', { timeout: 12000 });
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Spent' }).click();
    await expect(page.locator('#spent-error')).toBeVisible({ timeout: 8000 });
    abortNext = false;
    await page.locator('#spent-error .tab-retry-btn').click();
    // Wait for spent vendors content to flip to block (post-refactor signal)
    await page.waitForFunction(
      () => document.getElementById('spent-vendors-content').style.display === 'block',
      { timeout: 10000 }
    );
    await expect(page.locator('#spent-vendors-content')).toBeVisible();
    await expect(page.locator('#spent-error')).toBeHidden();
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('#raised-slow-error')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#raised-slow-error .tab-error-msg')).toHaveText(/rate limit reached/i);
    await expect(page.locator('#raised-slow-error .tab-retry-btn')).toBeHidden();
    // Skeletons should be hidden — not stuck
    await expect(page.locator('#raised-donors-skeleton')).toBeHidden();
    await expect(page.locator('#raised-conduits-skeleton')).toBeHidden();
    // Spent tab — same rate-limit copy
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Spent' }).click();
    await expect(page.locator('#spent-error')).toBeVisible();
    await expect(page.locator('#spent-error .tab-error-msg')).toHaveText(/rate limit reached/i);
    await expect(page.locator('#spent-error .tab-retry-btn')).toBeHidden();
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('#raised-slow-error')).toBeVisible({ timeout: 8000 });
    // Init-failure copy is distinct from rate-limit copy
    await expect(page.locator('#raised-slow-error .tab-error-msg')).toHaveText(/Couldn['’]t load this page/i);
    await expect(page.locator('#raised-slow-error .tab-error-msg')).not.toHaveText(/rate limit/i);
    await expect(page.locator('#raised-slow-error .tab-retry-btn')).toBeHidden();
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('#raised-slow-error')).toBeVisible({ timeout: 8000 });
    await expect(page.locator('#raised-slow-error .tab-error-msg')).toHaveText(/rate limit reached/i);
    await expect(page.locator('#raised-slow-error .tab-retry-btn')).toBeHidden();
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('#raised-slow-error')).toBeVisible({ timeout: 8000 });
    // Existing T12 copy unchanged
    await expect(page.locator('#raised-slow-error .tab-error-msg')).toHaveText(/Could not load top contributors/);
    await expect(page.locator('#raised-slow-error .tab-error-msg')).not.toHaveText(/rate limit/i);
    await expect(page.locator('#raised-slow-error .tab-retry-btn')).toBeVisible();
  });

  test('cycle switch after 429 clears error and renders new cycle', async ({ page }) => {
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('#raised-slow-error')).toBeVisible({ timeout: 8000 });
    // Lift the block, switch cycle — cycle change resets error states + re-fires fetches
    block429 = false;
    await page.locator('#cycle-switcher').selectOption({ index: 1 });
    // Error UI clears, donor card eventually visible
    await expect(page.locator('#donors-card')).toBeVisible({ timeout: 12000 });
    await expect(page.locator('#raised-slow-error')).toBeHidden();
  });

  test('Raised donut skeleton: present in DOM, hidden once donut renders', async ({ page }) => {
    await setup(page);
    // Skeleton element is in DOM (was display:block in loadCycle reset; hidden visually
    // only because parent #tab-raised is display:none on Summary)
    await expect(page.locator('#raised-donut-skeleton')).toBeAttached();
    // Click Raised → renderRaisedIfReady runs → donut renders synchronously from
    // currentTotalsBreakdown (set during loadCycle, in memory at click time) → skeleton hides
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
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
    await page.locator('.tabs-bar .tab').filter({ hasText: 'Raised' }).click();
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
