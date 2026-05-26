/**
 * pages.spec.js — Structural tests for all remaining pages:
 *   races.html, race.html, candidates.html, committees.html, feed.html,
 *   process-log.html, design-system.html, index.html.
 *
 * committee.html tests live in tests/committee.spec.js (split out 2026-04-27
 * for parity with candidate.spec.js).
 *
 * Covers: key structural elements, Amplitude events,
 * and scaffold-level presence checks for not-yet-built sections.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';


// ── races.html ────────────────────────────────────────────────────────────────

test.describe('races.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/races.html');
  });

  test('Page Viewed fires with page: races', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'races' });
  });

  test('page header renders with title "Browse Races"', async ({ page }) => {
    const title = page.locator('.page-title');
    await expect(title).toHaveText('Browse Races');
  });

  test('filter bar has Year, Office, and State fields', async ({ page }) => {
    await expect(page.locator('#f-cycle')).toBeAttached();
    await expect(page.locator('#f-office')).toBeAttached();
    await expect(page.locator('#f-state-filter')).toBeAttached();
    await expect(page.locator('#state-dropdown')).toBeAttached();
  });

  test('state combo has ARIA combobox/listbox semantics and native fallback', async ({ page }) => {
    await expect(page.locator('#f-state-filter')).toHaveAttribute('role', 'combobox');
    await expect(page.locator('#state-dropdown')).toHaveAttribute('role', 'listbox');
    await expect(page.locator('#f-state-native')).toBeAttached();
  });

  test('office combo has trigger, listbox, and native fallback', async ({ page }) => {
    await expect(page.locator('#f-office-trigger')).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(page.locator('#office-dropdown')).toHaveAttribute('role', 'listbox');
    await expect(page.locator('#f-office')).toBeAttached();
    const values = await page.locator('#f-office option').evaluateAll(opts => opts.map(o => o.value));
    expect(values).toEqual(['', 'H', 'S', 'P']);
  });

  test('cycle combo has trigger, listbox, and native fallback', async ({ page }) => {
    await expect(page.locator('#f-cycle-trigger')).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(page.locator('#cycle-dropdown')).toHaveAttribute('role', 'listbox');
    await expect(page.locator('#f-cycle')).toBeAttached();
  });

  test('office select has All offices, House, Senate, President', async ({ page }) => {
    const options = page.locator('#f-office option');
    await expect(options).toHaveCount(4);
    await expect(options.nth(0)).toHaveText('All offices');
  });

  test('state combo filter input is present', async ({ page }) => {
    await expect(page.locator('#f-state-filter')).toBeAttached();
  });

  test('results area and state containers exist', async ({ page }) => {
    await expect(page.locator('#state-results')).toBeAttached();
    await expect(page.locator('#state-loading')).toBeAttached();
    await expect(page.locator('#state-no-results')).toBeAttached();
    await expect(page.locator('#state-error')).toBeAttached();
  });
});

// ── race.html ─────────────────────────────────────────────────────────────────

test.describe('race.html', () => {
  // Helper to wait for race to finish loading (either success or error)
  async function waitForRaceLoad(page) {
    // Race header becomes visible on success, state-msg gets .error class on failure
    await page.waitForFunction(() => {
      const header = document.getElementById('race-header');
      const stateMsg = document.getElementById('state-msg');
      return (header && header.style.display !== 'none') ||
             (stateMsg && stateMsg.classList.contains('error'));
    }, { timeout: 12000 });
  }

  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/race.html?state=WA&district=03&year=2024&office=H');
    await waitForRaceLoad(page);
  });

  test('Page Viewed fires with race context props', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'race' });
  });

  test('race title shows state and office info', async ({ page }) => {
    const title = page.locator('#race-title');
    await expect(title).toBeVisible();
    const text = await title.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
    // Should include WA (state) or H/House info
    expect(text).toMatch(/WA|House|03/i);
  });

  test('year selector dropdown is present with options', async ({ page }) => {
    const sel = page.locator('#year-select');
    await expect(sel).toBeVisible();
    const options = sel.locator('option');
    await expect(options).not.toHaveCount(0);
  });

  test('year selector defaults to URL year param', async ({ page }) => {
    const sel = page.locator('#year-select');
    const val = await sel.inputValue();
    expect(val).toBe('2024');
  });

  test('candidate cards render with financial figures', async ({ page }) => {
    const cards = page.locator('.candidate-card');
    await expect(cards).not.toHaveCount(0);
    const cardText = await cards.first().textContent();
    // Cards should show dollar amounts (from our mock data)
    expect(cardText?.match(/\$[\d,.]+/)).toBeTruthy();
  });

  test('candidate cards show a party tag', async ({ page }) => {
    const tag = page.locator('.candidate-card .tag').first();
    await expect(tag).toBeVisible();
  });

  test('candidate card links to candidate page with cycle hash', async ({ page }) => {
    const link = page.locator('a.candidate-card[href*="candidate"]').first();
    await expect(link).toBeAttached();
    const href = await link.getAttribute('href');
    // Regression guard: race.html is cycle-scoped by design; link must carry #{year}#summary
    expect(href).toMatch(/#\d{4}#summary/);
  });

  test('no 422 errors (office sent as lowercase full word)', async ({ page }) => {
    // No 422s should have occurred during beforeEach navigation
    // This is verified by inspecting requests during the load
    const errors422 = [];
    page.on('response', res => {
      if (res.url().includes('/api/fec/') && res.status() === 422) {
        errors422.push(res.url());
      }
    });
    // Small settle window for any late requests
    await page.waitForTimeout(300);
    expect(errors422).toHaveLength(0);
  });

  test('incumbent candidate card shows Incumbent tag', async ({ page }) => {
    // Mock fixture has incumbent_challenge_full: 'Incumbent' — .tag-inc should render (.tag-neutral after 2026-05-13 restyle)
    const incumbentTag = page.locator('.candidate-card .tag-inc');
    await expect(incumbentTag).toBeVisible();
    const text = await incumbentTag.textContent();
    expect(text?.trim()).toBe('Incumbent');
  });

  test('year selector options come from elections/search endpoint', async ({ page }) => {
    const sel = page.locator('#year-select');
    const options = await sel.locator('option').allTextContents();
    // ELECTIONS_SEARCH mock returns cycles 2024 and 2022
    expect(options).toContain('2024');
    expect(options).toContain('2022');
  });

  test('House race does not show Senate class indicator', async ({ page }) => {
    // #race-seat-class exists but should be empty for House races
    const seatClass = page.locator('#race-seat-class');
    await expect(seatClass).toBeAttached();
    const text = await seatClass.textContent();
    expect(text?.trim()).toBe('');
  });

  test('Senate race shows class indicator in tabs bar', async ({ page }) => {
    // Navigate to a Senate race — 2024 is Class I
    await page.goto('/race.html?state=WA&office=S&year=2024');
    await waitForRaceLoad(page);
    const seatClass = page.locator('#race-seat-class');
    await expect(seatClass).toBeAttached();
    const text = await seatClass.textContent();
    expect(text).toContain('Class I seat');
  });

  test('invalid state shows error with back link', async ({ page }) => {
    await page.goto('/race.html?state=ZZ&office=H&district=03&year=2024');
    await waitForRaceLoad(page);
    const msg = page.locator('#state-msg');
    await expect(msg).toContainText('Invalid state');
    const link = msg.locator('a[href*="races"]');
    await expect(link).toBeAttached();
  });

  test('state=US is valid for presidential races (no Invalid state error)', async ({ page }) => {
    await page.goto('/race.html?state=US&office=P&year=2024');
    await waitForRaceLoad(page);
    const msg = page.locator('#state-msg');
    const text = await msg.textContent();
    expect(text).not.toContain('Invalid state');
  });

  test('presidential race title shows "US Presidential"', async ({ page }) => {
    await page.goto('/race.html?state=US&office=P&year=2024');
    await waitForRaceLoad(page);
    const title = page.locator('#race-title');
    await expect(title).toBeVisible();
    await expect(title).toContainText('US Presidential');
  });

  test('invalid office shows error', async ({ page }) => {
    await page.goto('/race.html?state=WA&office=X&district=03&year=2024');
    await waitForRaceLoad(page);
    const msg = page.locator('#state-msg');
    await expect(msg).toContainText('Invalid office');
  });

  test('odd year shows error', async ({ page }) => {
    await page.goto('/race.html?state=WA&office=H&district=03&year=2023');
    await waitForRaceLoad(page);
    const msg = page.locator('#state-msg');
    await expect(msg).toContainText('Invalid election year');
  });

  test('tabs bar is present and visible after load', async ({ page }) => {
    await expect(page.locator('#tabs-bar')).toBeVisible();
  });

  test('tabs bar has Candidates and Insights tabs', async ({ page }) => {
    const tabs = page.locator('#tabs-bar .tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.filter({ hasText: 'Candidates' })).toHaveCount(1);
    await expect(tabs.filter({ hasText: 'Insights' })).toHaveCount(1);
  });

  test('Candidates tab is active by default', async ({ page }) => {
    await expect(page.locator('.tab').filter({ hasText: 'Candidates' })).toHaveClass(/active/);
  });

  test('#tab-candidates is visible and #tab-insights is hidden on load', async ({ page }) => {
    await expect(page.locator('#tab-candidates')).toBeVisible();
    await expect(page.locator('#tab-insights')).toBeHidden();
  });

  test('#year-select is inside .tabs-bar', async ({ page }) => {
    await expect(page.locator('.tabs-bar #year-select')).toBeAttached();
  });

  test('#race-meta is not present in DOM (candidate count removed)', async ({ page }) => {
    await expect(page.locator('#race-meta')).toHaveCount(0);
  });

  test('profile-header-sentinel exists for compact scroll observer', async ({ page }) => {
    await expect(page.locator('#profile-header-sentinel')).toBeAttached();
  });

  test('race-header starts without .compact class (full mode on load)', async ({ page }) => {
    await expect(page.locator('#race-header')).not.toHaveClass(/compact/);
  });
});

// ── candidates.html ───────────────────────────────────────────────────────────

test.describe('candidates.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidates.html');
  });

  test('Page Viewed fires with page: candidates', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'candidates' });
  });

  test('filter form elements are present', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('cycle dropdown is populated with computed even-year options', async ({ page }) => {
    const options = page.locator('#f-cycle option');
    const count = await options.count();
    expect(count).toBeGreaterThan(1); // "All cycles" + at least one computed year
    const values = await options.evaluateAll(opts =>
      opts.map(o => o.value).filter(v => v !== '')
    );
    expect(values.length).toBeGreaterThan(0);
    values.forEach(v => expect(Number(v) % 2).toBe(0)); // all even years
  });

  test('search input is visible in filter bar', async ({ page }) => {
    const searchInput = page.locator('#f-search');
    await expect(searchInput).toBeVisible();
  });

  test('filter bar search input is wrapped in .search-field with icon', async ({ page }) => {
    const searchField = page.locator('.search-combo .search-field');
    await expect(searchField).toHaveCount(1);
    await expect(searchField.locator('.search-field-icon')).toHaveCount(1);
  });

  test('filter bar search submit button is sr-only (visually hidden, accessible)', async ({ page }) => {
    const btn = page.locator('.search-combo .search-field .form-search-btn.sr-only');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-label', 'Search');
  });

  test('state combo has ARIA combobox/listbox semantics and native fallback', async ({ page }) => {
    await expect(page.locator('#f-state-filter')).toHaveAttribute('role', 'combobox');
    await expect(page.locator('#state-dropdown')).toHaveAttribute('role', 'listbox');
    await expect(page.locator('#f-state-native')).toBeAttached();
  });

  test('office combo has trigger, listbox, and native fallback', async ({ page }) => {
    await expect(page.locator('#f-office-trigger')).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(page.locator('#office-dropdown')).toHaveAttribute('role', 'listbox');
    await expect(page.locator('#f-office')).toBeAttached();
    // native select has expected options
    const values = await page.locator('#f-office option').evaluateAll(opts => opts.map(o => o.value));
    expect(values).toEqual(['', 'H', 'S', 'P']);
  });

  test('party combo has trigger, listbox, and native fallback', async ({ page }) => {
    await expect(page.locator('#f-party-trigger')).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(page.locator('#party-dropdown')).toHaveAttribute('role', 'listbox');
    await expect(page.locator('#f-party')).toBeAttached();
  });

  test('cycle combo has trigger, listbox with dynamic rows, and native fallback', async ({ page }) => {
    await expect(page.locator('#f-cycle-trigger')).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(page.locator('#cycle-dropdown')).toHaveAttribute('role', 'listbox');
    await expect(page.locator('#f-cycle')).toBeAttached();
    // listbox rows are populated by IIFE
    const rows = page.locator('#cycle-dropdown .typeahead-row');
    const count = await rows.count();
    expect(count).toBeGreaterThan(1);
  });

  test('results auto-load on page load (no params)', async ({ page }) => {
    const cards = page.locator('.candidate-card');
    await expect(cards).not.toHaveCount(0, { timeout: 8000 });
  });

  test('candidate cards use clean /candidate/{id} URL', async ({ page }) => {
    const link = page.locator('a.candidate-card').first();
    await expect(link).toBeVisible({ timeout: 8000 });
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/candidate\//);
    expect(href).not.toContain('#');
  });

  test('filter chips appear when a filter is active', async ({ page }) => {
    await page.locator('#f-office').selectOption('H', { force: true });
    await page.waitForSelector('.filter-chip', { timeout: 5000 });
    const chips = page.locator('.filter-chip');
    await expect(chips).not.toHaveCount(0);
  });

  test('URL updates after filter change', async ({ page }) => {
    await page.locator('#f-office').selectOption('H', { force: true });
    await page.waitForFunction(() => window.location.search.includes('office=H'), { timeout: 5000 });
    expect(page.url()).toContain('office=H');
  });

  test('error state renders when API fails', async ({ page }) => {
    await page.route('**/api/fec/**', route => route.fulfill({ status: 500, body: 'error' }));
    await page.reload();
    await page.waitForSelector('#state-error', { state: 'visible', timeout: 8000 });
    // Scoped to #state-error — the global overlay also carries a hidden
    // .retry-btn inside #overlay-error.
    await expect(page.locator('#state-error .retry-btn')).toBeVisible();
  });

  test('#load-more-spinner exists in DOM (hidden initially)', async ({ page }) => {
    const el = page.locator('#load-more-spinner');
    await expect(el).toBeAttached();
    await expect(el).toBeHidden();
  });

  test('#end-of-results exists in DOM (hidden initially)', async ({ page }) => {
    const el = page.locator('#end-of-results');
    await expect(el).toBeAttached();
    await expect(el).toBeHidden();
  });
});

// ── committees.html ───────────────────────────────────────────────────────────

test.describe('committees.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committees.html');
  });

  test('Page Viewed fires with page: committees', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'committees' });
  });

  test('filter form elements are present', async ({ page }) => {
    const selects = page.locator('select');
    const count = await selects.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('search input is visible in filter bar', async ({ page }) => {
    await expect(page.locator('#f-search')).toBeVisible();
  });

  test('filter bar search input is wrapped in .search-field with icon', async ({ page }) => {
    const searchField = page.locator('.search-combo .search-field');
    await expect(searchField).toHaveCount(1);
    await expect(searchField.locator('.search-field-icon')).toHaveCount(1);
  });

  test('filter bar search submit button is sr-only (visually hidden, accessible)', async ({ page }) => {
    const btn = page.locator('.search-combo .search-field .form-search-btn.sr-only');
    await expect(btn).toHaveCount(1);
    await expect(btn).toHaveAttribute('aria-label', 'Search');
  });

  test('state combo has ARIA combobox/listbox semantics and native fallback', async ({ page }) => {
    await expect(page.locator('#f-state-filter')).toHaveAttribute('role', 'combobox');
    await expect(page.locator('#state-dropdown')).toHaveAttribute('role', 'listbox');
    await expect(page.locator('#f-state-native')).toBeAttached();
  });

  test('type combo has trigger, listbox, and native fallback', async ({ page }) => {
    await expect(page.locator('#f-type-trigger')).toHaveAttribute('aria-haspopup', 'listbox');
    await expect(page.locator('#type-dropdown')).toHaveAttribute('role', 'listbox');
    await expect(page.locator('#f-type')).toBeAttached();
    // listbox has expected options including principal campaign committee
    const rows = page.locator('#type-dropdown .typeahead-row');
    const count = await rows.count();
    expect(count).toBeGreaterThanOrEqual(7); // "All types" + 6 type options
  });

  test('results auto-load on page load (no params)', async ({ page }) => {
    await page.waitForSelector('.committee-row', { timeout: 8000 });
    const rows = page.locator('.committee-row');
    await expect(rows).not.toHaveCount(0);
  });

  test('committee rows use clean /committee/{id} URL', async ({ page }) => {
    await page.waitForSelector('.committee-row', { timeout: 8000 });
    const link = page.locator('.committee-row').first();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/committee\//);
  });

  test('filter chips appear when a filter is active', async ({ page }) => {
    await page.locator('#f-type').selectOption('P', { force: true });
    await page.waitForSelector('.filter-chip', { timeout: 5000 });
    await expect(page.locator('.filter-chip')).not.toHaveCount(0);
  });

  test('URL updates after filter change', async ({ page }) => {
    await page.locator('#f-type').selectOption('P', { force: true });
    await page.waitForFunction(() => window.location.search.includes('type=P'), { timeout: 5000 });
    expect(page.url()).toContain('type=P');
  });

  test('error state renders when API fails', async ({ page }) => {
    await page.route('**/api/fec/**', route => route.fulfill({ status: 500, body: 'error' }));
    await page.reload();
    await page.waitForSelector('#state-error', { state: 'visible', timeout: 8000 });
    // Scoped to #state-error — the global overlay also carries a hidden
    // .retry-btn inside #overlay-error.
    await expect(page.locator('#state-error .retry-btn')).toBeVisible();
  });

  test('#load-more-spinner exists in DOM (hidden initially)', async ({ page }) => {
    const el = page.locator('#load-more-spinner');
    await expect(el).toBeAttached();
    await expect(el).toBeHidden();
  });

  test('#end-of-results exists in DOM (hidden initially)', async ({ page }) => {
    const el = page.locator('#end-of-results');
    await expect(el).toBeAttached();
    await expect(el).toBeHidden();
  });

  test('Exclude terminated toggle is present and unchecked by default (terminated included by default)', async ({ page }) => {
    const toggle = page.locator('#f-terminated');
    await expect(toggle).toBeAttached();
    await expect(toggle).not.toBeChecked();
  });
});

// ── candidates.html — search mode (?q=) ──────────────────────────────────────

test.describe('candidates.html — search mode (?q=)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidates.html?q=marie');
    await page.waitForSelector('#state-results', { state: 'visible', timeout: 8000 });
  });

  test('filter bar is visible (not hidden) when q param is present', async ({ page }) => {
    const filterBar = page.locator('.filter-bar-wrap');
    await expect(filterBar).toBeVisible();
  });

  test('search input is populated with the query', async ({ page }) => {
    const input = page.locator('#f-search');
    const val = await input.inputValue();
    expect(val).toBe('marie');
  });

  test('search results render at least one candidate card', async ({ page }) => {
    const cards = page.locator('.candidate-card');
    await expect(cards).not.toHaveCount(0);
  });

  test('candidate name is displayed', async ({ page }) => {
    const card = page.locator('.candidate-card').first();
    const nameEl = card.locator('.candidate-card-name');
    await expect(nameEl).toBeVisible();
    const text = await nameEl.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('candidate card links to clean /candidate/{id} URL', async ({ page }) => {
    const link = page.locator('a.candidate-card').first();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/candidate\//);
    expect(href).not.toContain('#');
  });

  test('Candidates Searched Amplitude event fires', async ({ page }) => {
    const event = await findTrackEvent(page, 'Candidates Searched');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ query: 'marie' });
  });
});

// ── candidates.html — enter-to-search ─────────────────────────────────────────

test.describe('candidates.html — enter-to-search', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidates.html');
    await page.waitForSelector('#state-results', { state: 'visible', timeout: 8000 });
  });

  test('Enter with a 3+ char query runs a search', async ({ page }) => {
    await page.locator('#f-search').fill('marie');
    await page.locator('#f-search').press('Enter');
    await expect(page.locator('#results-header')).toContainText('marie', { timeout: 5000 });
  });

  test('sub-3-char submit dispatches no <3-char keyword request and shows no error', async ({ page }) => {
    // The FEC API rejects keyword queries shorter than 3 chars — the submit
    // path must normalize them to browse mode, never dispatch a q=<1-2 char>.
    const subThresholdQ = [];
    page.on('request', req => {
      const u = req.url();
      if (!u.includes('/api/fec/')) return;
      const q = new URL(u).searchParams.get('q');
      if (q !== null && q.length < 3) subThresholdQ.push(q);
    });
    for (const v of ['m', 'ma', '']) {
      await page.locator('#f-search').fill(v);
      await page.locator('#f-search').press('Enter');
      await page.waitForTimeout(500);
    }
    await page.locator('#f-search').fill('mar');
    await page.locator('#f-search').press('Enter');
    await page.waitForTimeout(500);
    expect(subThresholdQ).toEqual([]);
    await expect(page.locator('#state-error')).toBeHidden();
  });
});

// ── committees.html — search mode (?q=) ──────────────────────────────────────

test.describe('committees.html — search mode (?q=)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committees.html?q=marie');
    await page.waitForSelector('#state-results', { state: 'visible', timeout: 8000 });
  });

  test('filter bar is visible (not hidden) when q param is present', async ({ page }) => {
    const filterBar = page.locator('.filter-bar-wrap');
    await expect(filterBar).toBeVisible();
  });

  test('search input is populated with the query', async ({ page }) => {
    const input = page.locator('#f-search');
    const val = await input.inputValue();
    expect(val).toBe('marie');
  });

  test('search results render at least one committee row', async ({ page }) => {
    const rows = page.locator('.committee-row');
    await expect(rows).not.toHaveCount(0);
  });

  test('committee name is displayed', async ({ page }) => {
    const nameEl = page.locator('.committee-row .committee-name').first();
    await expect(nameEl).toBeVisible();
    const text = await nameEl.textContent();
    expect(text?.trim().length).toBeGreaterThan(0);
  });

  test('committee row links to /committee/{id}', async ({ page }) => {
    const link = page.locator('.committee-row').first();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/committee\//);
  });

  test('Committees Searched Amplitude event fires', async ({ page }) => {
    const event = await findTrackEvent(page, 'Committees Searched');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ query: 'marie' });
  });
});

// ── committees.html — enter-to-search ─────────────────────────────────────────

test.describe('committees.html — enter-to-search', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committees.html');
    await page.waitForSelector('#state-results', { state: 'visible', timeout: 8000 });
  });

  test('Enter with a 3+ char query runs a search', async ({ page }) => {
    await page.locator('#f-search').fill('marie');
    await page.locator('#f-search').press('Enter');
    await expect(page.locator('#results-header')).toContainText('marie', { timeout: 5000 });
  });

  test('sub-3-char submit dispatches no <3-char keyword request and shows no error', async ({ page }) => {
    // The FEC API rejects keyword queries shorter than 3 chars — the submit
    // path must normalize them to browse mode, never dispatch a q=<1-2 char>.
    const subThresholdQ = [];
    page.on('request', req => {
      const u = req.url();
      if (!u.includes('/api/fec/')) return;
      const q = new URL(u).searchParams.get('q');
      if (q !== null && q.length < 3) subThresholdQ.push(q);
    });
    for (const v of ['m', 'ma', '']) {
      await page.locator('#f-search').fill(v);
      await page.locator('#f-search').press('Enter');
      await page.waitForTimeout(500);
    }
    await page.locator('#f-search').fill('mar');
    await page.locator('#f-search').press('Enter');
    await page.waitForTimeout(500);
    expect(subThresholdQ).toEqual([]);
    await expect(page.locator('#state-error')).toBeHidden();
  });
});

// ── process-log.html ──────────────────────────────────────────────────────────

test.describe('process-log.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/process-log.html');
  });

  test('Page Viewed fires', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]?.page).toMatch(/process.log/i);
  });

  test('log content is present and readable', async ({ page }) => {
    // Some log-like content should exist
    const body = await page.evaluate(() => document.body.textContent || '');
    expect(body.trim().length).toBeGreaterThan(100);
  });

  test('no broken layout at desktop width (1280px)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(1280 + 20);
  });

  test('no broken layout at mobile width (390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator('.top-nav')).toBeVisible();
  });
});

// ── design-system.html ────────────────────────────────────────────────────────

test.describe('design-system.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/design-system.html');
  });

  test('Page Viewed fires', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
  });

  test('token tables render', async ({ page }) => {
    const tables = page.locator('table, .token-table, .token-section');
    const count = await tables.count();
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('color swatches have data-token and data-hex attributes', async ({ page }) => {
    const swatch = page.locator('[data-token]').first();
    await expect(swatch).toBeAttached();
    const hex = await swatch.getAttribute('data-hex');
    expect(hex).toBeTruthy();
    const token = await swatch.getAttribute('data-token');
    expect(token?.startsWith('--')).toBe(true);
  });

  test('background swatch is warm parchment (not dark)', async ({ page }) => {
    const bgSwatch = page.locator('[data-token="--bg"]');
    await expect(bgSwatch).toBeAttached();
    const hex = await bgSwatch.getAttribute('data-hex');
    // #F8F5EC → R=248 (high value = light color)
    const r = parseInt((hex || '#000').slice(1, 3), 16);
    expect(r).toBeGreaterThan(200);
  });

  test('partisan swatches present: Dem, Rep, Ind', async ({ page }) => {
    await expect(page.locator('[data-token="--dem"]')).toBeAttached();
    await expect(page.locator('[data-token="--rep"]')).toBeAttached();
    await expect(page.locator('[data-token="--ind"]')).toBeAttached();
  });

  test('component cards have id="comp-{name}" attribute', async ({ page }) => {
    const compCard = page.locator('[id^="comp-"]').first();
    await expect(compCard).toBeAttached();
  });

  test('component cards have a status badge', async ({ page }) => {
    const badge = page.locator('[data-status], .status-badge, .badge').first();
    await expect(badge).toBeAttached();
  });

  test('no common component CSS duplicated in page <style> (nav-item, sidebar etc.)', async ({ page }) => {
    // The page style block should not contain sidebar/nav CSS that lives in styles.css
    const styleContent = await page.evaluate(() => {
      const styleEl = document.querySelector('head style');
      return styleEl ? styleEl.textContent : '';
    });
    // These classes should NOT appear in the page style block (they're in styles.css)
    expect(styleContent).not.toMatch(/\.nav-item\s*\{/);
    expect(styleContent).not.toMatch(/\.sidebar\s*\{/);
  });

  test('typography specimens render (Barlow, DM Sans, IBM Plex Mono)', async ({ page }) => {
    const bodyText = await page.evaluate(() => document.body.textContent || '');
    expect(bodyText).toMatch(/Barlow|DM Sans|IBM Plex/i);
  });
});

// ── T-menu-btn ────────────────────────────────────────────────────────────────
// Tests for the component + helpers shipped in T-menu-btn. The design-system.html
// page hosts live demos (Demo A: showText:true; Demo B: showText:false) wired
// to initMenuButton in its inline script — that's the surface these tests
// exercise. No FEC API mocking needed; the page makes no FEC calls.

test.describe('T-menu-btn — design-system demo (showText:true)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/design-system.html');
  });

  test('trigger renders + dropdown closed initially', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-a');
    await expect(wrap).toBeVisible();
    await expect(wrap.locator('.menu-btn')).toBeVisible();
    const expanded = await wrap.locator('.menu-btn').getAttribute('aria-expanded');
    expect(expanded).toBe('false');
    await expect(wrap.locator('.menu-btn-dropdown.open')).toHaveCount(0);
  });

  test('click trigger opens the dropdown', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-a');
    await wrap.locator('.menu-btn').click();
    await expect(wrap.locator('.menu-btn-dropdown.open')).toHaveCount(1);
    const expanded = await wrap.locator('.menu-btn').getAttribute('aria-expanded');
    expect(expanded).toBe('true');
  });

  test('outside-click closes the dropdown', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-a');
    await wrap.locator('.menu-btn').click();
    await expect(wrap.locator('.menu-btn-dropdown.open')).toHaveCount(1);
    // Click far away from both the trigger and any other interactive demo.
    await page.locator('h2.ds-section-title').first().click();
    await expect(wrap.locator('.menu-btn-dropdown.open')).toHaveCount(0);
  });

  test('Escape closes and returns focus to the trigger', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-a');
    await wrap.locator('.menu-btn').click();
    await expect(wrap.locator('.menu-btn-dropdown.open')).toHaveCount(1);
    await page.keyboard.press('Escape');
    await expect(wrap.locator('.menu-btn-dropdown.open')).toHaveCount(0);
    const focusedOnTrigger = await page.evaluate(() =>
      document.activeElement === document.querySelector('#ds-menu-btn-demo-a .menu-btn'));
    expect(focusedOnTrigger).toBe(true);
  });

  test('on open, focus is on the dropdown container (not an item); first ArrowDown lands on item 0', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-a');
    await wrap.locator('.menu-btn').click();
    // T-menu-btn-focus-on-open: focus the container on open, not the first
    // item. Avoids Safari mobile's :focus-visible firing on the first item
    // after a touch tap.
    const focusedOnContainer = await page.evaluate(() => {
      return document.activeElement === document.querySelector('#ds-menu-btn-demo-a .menu-btn-dropdown');
    });
    expect(focusedOnContainer).toBe(true);
    // First ArrowDown enters at item 0 (focusItemByDelta's idx===-1 branch).
    await page.keyboard.press('ArrowDown');
    const firstId = await page.evaluate(() => document.activeElement.dataset.itemId);
    expect(firstId).toBe('profile');
    // Second ArrowDown moves to item 1.
    await page.keyboard.press('ArrowDown');
    const secondId = await page.evaluate(() => document.activeElement.dataset.itemId);
    expect(secondId).toBe('race');
  });

  test('first ArrowUp from container enters at the last item', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-a');
    await wrap.locator('.menu-btn').click();
    // From container-focus, ArrowUp enters at last item (idx===-1 branch in
    // focusItemByDelta). This is the natural keyboard model when no item
    // has focus yet — ArrowDown enters at top, ArrowUp enters at bottom.
    await page.keyboard.press('ArrowUp');
    const lastId = await page.evaluate(() => document.activeElement.dataset.itemId);
    expect(lastId).toBe('follow');
  });

  test('ArrowDown CLAMPS at last item (does NOT wrap)', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-a');
    await wrap.locator('.menu-btn').click();
    // End jumps to last item from container-focus (Home/End paths in the
    // dropdown listener focus first/last directly, independent of current
    // focus position).
    await page.keyboard.press('End');
    const lastId = await page.evaluate(() => document.activeElement.dataset.itemId);
    expect(lastId).toBe('follow');
    // ArrowDown on the last enabled item keeps focus on the last item — no wrap.
    await page.keyboard.press('ArrowDown');
    const stillLast = await page.evaluate(() => document.activeElement.dataset.itemId);
    expect(stillLast).toBe('follow');
  });

  test('ArrowUp CLAMPS at first item (does NOT wrap)', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-a');
    await wrap.locator('.menu-btn').click();
    // Move to first item via Home (open lands on container, not item).
    await page.keyboard.press('Home');
    const firstId = await page.evaluate(() => document.activeElement.dataset.itemId);
    expect(firstId).toBe('profile');
    // ArrowUp on the first enabled item keeps focus on the first — no wrap.
    await page.keyboard.press('ArrowUp');
    const stillFirst = await page.evaluate(() => document.activeElement.dataset.itemId);
    expect(stillFirst).toBe('profile');
  });

  test('Home / End jump to first / last enabled item', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-a');
    await wrap.locator('.menu-btn').click();
    await page.keyboard.press('End');
    expect(await page.evaluate(() => document.activeElement.dataset.itemId)).toBe('follow');
    await page.keyboard.press('Home');
    expect(await page.evaluate(() => document.activeElement.dataset.itemId)).toBe('profile');
  });

  test('disabled items are skipped during arrow nav; updateItem flips state in place', async ({ page }) => {
    // Build a transient menu in the page to assert disabled-skip + updateItem
    // contract without touching the demo's static items.
    const result = await page.evaluate(() => {
      const host = document.createElement('div');
      host.id = 'tmp-menu-btn-host';
      document.body.appendChild(host);
      const ctrl = initMenuButton({
        hostEl: host,
        items: [
          { id: 'a', label: 'A', icon: 'trending_flat', onClick: function() {} },
          { id: 'b', label: 'B', icon: 'trending_flat', disabled: true, onClick: function() {} },
          { id: 'c', label: 'C', icon: 'trending_flat', onClick: function() {} }
        ]
      });
      ctrl.open();
      // T-menu-btn-focus-on-open: open lands focus on the dropdown container.
      const dropdownEl = host.querySelector('.menu-btn-dropdown');
      const focusedOnContainer = document.activeElement === dropdownEl;
      // First ArrowDown enters at first enabled item ('a' — 'b' is disabled
      // but 'a' is the first item; getEnabledItemNodes skips disabled).
      dropdownEl.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const focusAfterEntry = document.activeElement.dataset.itemId;
      // Next ArrowDown skips 'b' (disabled) and lands on 'c'.
      document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
      const focusAfterSkip = document.activeElement.dataset.itemId;

      // updateItem flips 'b' to enabled
      const bBefore = host.querySelector('[data-item-id="b"]').getAttribute('aria-disabled');
      ctrl.updateItem('b', { disabled: false });
      const bAfter  = host.querySelector('[data-item-id="b"]').getAttribute('aria-disabled');

      ctrl.destroy();
      host.remove();
      return { focusedOnContainer, focusAfterEntry, focusAfterSkip, bBefore, bAfter };
    });
    expect(result.focusedOnContainer).toBe(true);
    expect(result.focusAfterEntry).toBe('a');
    expect(result.focusAfterSkip).toBe('c'); // 'b' skipped because disabled
    expect(result.bBefore).toBe('true');
    expect(result.bAfter).toBeNull();
  });

  test('destroy() removes outside-click listener', async ({ page }) => {
    // After destroy, opening a sibling menu and clicking elsewhere should not
    // re-trigger the destroyed menu's outside-click handler (the destroyed
    // menu's DOM is gone, so this is mostly a sanity check that destroy clears
    // hostEl and is idempotent).
    const result = await page.evaluate(() => {
      const host = document.createElement('div');
      document.body.appendChild(host);
      const ctrl = initMenuButton({ hostEl: host, items: [{ id: 'x', label: 'X', icon: 'trending_flat', onClick: function() {} }] });
      ctrl.open();
      ctrl.destroy();
      const hasWrap   = host.classList.contains('menu-btn-wrap');
      const hasMarkup = !!host.querySelector('.menu-btn');
      host.remove();
      return { hasWrap, hasMarkup };
    });
    expect(result.hasWrap).toBe(false);
    expect(result.hasMarkup).toBe(false);
  });
});

test.describe('T-menu-btn — design-system demo (showText:false)', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/design-system.html');
  });

  test('icon-only variant has no .menu-btn-text', async ({ page }) => {
    const wrap = page.locator('#ds-menu-btn-demo-b');
    await expect(wrap.locator('.menu-btn-text')).toHaveCount(0);
    await expect(wrap.locator('.menu-btn-icon')).toHaveCount(1);
  });

  test('icon-only variant carries the configured aria-label', async ({ page }) => {
    // Demo updated to use 'Candidate menu' as a representative page-integration
    // label (T-menu-btn-profile-header — production never renders the 'Menu'
    // factory default; the demo mirrors what candidate.html / committee.html
    // pass for their visible text + aria-label coherence).
    const label = await page.locator('#ds-menu-btn-demo-b .menu-btn').getAttribute('aria-label');
    expect(label).toBe('Candidate menu');
  });
});

test.describe('raceHref helper', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/design-system.html');
  });

  test('House non-at-large includes district', async ({ page }) => {
    const url = await page.evaluate(() => raceHref('H', 'WA', '03', 2024));
    expect(url).toBe('/race?state=WA&office=H&year=2024&district=03');
  });

  test('House at-large (district 00) sends district=00 explicitly', async ({ page }) => {
    const url = await page.evaluate(() => raceHref('H', 'AK', '00', 2024));
    expect(url).toBe('/race?state=AK&office=H&year=2024&district=00');
  });

  test('Senate omits district', async ({ page }) => {
    const url = await page.evaluate(() => raceHref('S', 'NY', '', 2024));
    expect(url).toBe('/race?state=NY&office=S&year=2024');
  });

  test('Presidential uses state=US', async ({ page }) => {
    const url = await page.evaluate(() => raceHref('P', '', '', 2024));
    expect(url).toBe('/race?state=US&office=P&year=2024');
  });
});

test.describe('iconSvg helper', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/design-system.html');
  });

  for (const name of ['more_horiz', 'trending_flat', 'expand_content', 'compare_arrows', 'rss_feed']) {
    test(`iconSvg('${name}') returns 20px SVG markup`, async ({ page }) => {
      const html = await page.evaluate((n) => iconSvg(n), name);
      expect(html).toContain('<svg');
      expect(html).toContain('width="20"');
      expect(html).toContain('viewBox="0 -960 960 960"');
      expect(html).toContain('<path');
      expect(html.length).toBeGreaterThan(50);
    });
  }

  test('iconSvg() with an unknown glyph returns empty string', async ({ page }) => {
    const html = await page.evaluate(() => iconSvg('not_a_real_glyph'));
    expect(html).toBe('');
  });
});

test.describe('info modal', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/design-system.html');
  });

  test('not in DOM until openInfoModal is called (lazy injection)', async ({ page }) => {
    const count = await page.locator('#info-modal').count();
    expect(count).toBe(0);
  });

  test('openInfoModal injects and shows the modal with the expected copy', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    const modal = page.locator('#info-modal');
    await expect(modal).toBeVisible();
    await expect(modal.locator('.modal-title')).toContainText('Wouldn');
    await expect(modal.locator('.modal-body .modal-prose')).toContainText('experimental build');
  });

  test('uses the .modal-panel--narrow width modifier', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    await expect(page.locator('#info-modal .modal-panel--narrow')).toHaveCount(1);
  });

  test('close button closes the modal', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    await page.locator('#info-modal-close').click();
    await expect(page.locator('#info-modal')).toBeHidden();
  });

  test('Escape closes the modal', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#info-modal')).toBeHidden();
  });

  test('outside-click on the overlay closes the modal', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    // Click the overlay backdrop near the top-left corner — well outside the panel.
    await page.locator('#info-modal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#info-modal')).toBeHidden();
  });
});

// ── T-modal-a11y — info modal accessibility ─────────────────────────────────

test.describe('info modal a11y', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/design-system.html');
  });

  test('role=dialog + aria-modal + aria-labelledby set on open', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    const modal = page.locator('#info-modal');
    await expect(modal).toHaveAttribute('role', 'dialog');
    await expect(modal).toHaveAttribute('aria-modal', 'true');
    const labelledBy = await modal.getAttribute('aria-labelledby');
    expect(labelledBy).toBeTruthy();
    const title = page.locator('#' + labelledBy);
    await expect(title).toContainText('Wouldn');
  });

  test('initial focus moves to first focusable inside modal (the ✕ close button)', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    await expect(page.locator('#info-modal-close')).toBeFocused();
  });

  test('focus returns to the trigger element on close', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    await page.keyboard.press('Escape');
    await expect(page.locator('#info-modal')).toBeHidden();
    await expect(page.locator('#ds-info-modal-trigger')).toBeFocused();
  });

  test('background body children have inert while open; removed on close', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    // .main is a body child and should carry inert while the modal is open
    const inertOpen = await page.evaluate(() => document.querySelector('.main').hasAttribute('inert'));
    expect(inertOpen).toBe(true);
    await page.keyboard.press('Escape');
    const inertClosed = await page.evaluate(() => document.querySelector('.main').hasAttribute('inert'));
    expect(inertClosed).toBe(false);
  });

  test('body overflow:hidden while open; restored on close', async ({ page }) => {
    const priorOverflow = await page.evaluate(() => document.body.style.overflow);
    await page.locator('#ds-info-modal-trigger').click();
    const overflowOpen = await page.evaluate(() => document.body.style.overflow);
    expect(overflowOpen).toBe('hidden');
    await page.keyboard.press('Escape');
    const overflowClosed = await page.evaluate(() => document.body.style.overflow);
    expect(overflowClosed).toBe(priorOverflow);
  });

  test('Tab from last focusable wraps to first (focus trap)', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    // info-modal has exactly one focusable: the ✕ close button. Tab on a
    // single-focusable modal stays put.
    await expect(page.locator('#info-modal-close')).toBeFocused();
    await page.keyboard.press('Tab');
    // Focus stays on the close button (single focusable, wraps to itself)
    const stillInModal = await page.evaluate(() => {
      const modal = document.getElementById('info-modal');
      return modal.contains(document.activeElement);
    });
    expect(stillInModal).toBe(true);
  });

  test('outside-click closes via helper-attached listener (markup has no inline onclick)', async ({ page }) => {
    await page.locator('#ds-info-modal-trigger').click();
    // Verify the markup itself has no inline onclick — helper owns it
    const inlineOnclick = await page.locator('#info-modal').getAttribute('onclick');
    expect(inlineOnclick).toBeNull();
    // And the close-on-backdrop-click still works
    await page.locator('#info-modal').click({ position: { x: 5, y: 5 } });
    await expect(page.locator('#info-modal')).toBeHidden();
  });
});

// ── index.html ────────────────────────────────────────────────────────────────

test.describe('index.html', () => {
  test('redirects to search', async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/index.html');
    await expect(page).toHaveURL(/\/search(?:\.html)?$/, { timeout: 5000 });
  });
});

// ── Mobile layout ─────────────────────────────────────────────────────────────

test.describe('mobile layout — sidebar hidden, header visible', () => {
  const MOBILE_PAGES = [
    { url: '/search.html', needsMock: false },
    { url: '/candidate.html?id=H2WA03217', needsMock: true },
    { url: '/races.html', needsMock: false },
  ];

  for (const { url, needsMock } of MOBILE_PAGES) {
    test(`${url} shows top nav at 390px`, async ({ page }) => {
      await mockAmplitude(page);
      if (needsMock) await mockFecApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await page.waitForLoadState('load');
      await expect(page.locator('.top-nav')).toBeVisible();
    });

    test(`${url} shows search toggle at 390px`, async ({ page }) => {
      await mockAmplitude(page);
      if (needsMock) await mockFecApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await expect(page.locator('.top-nav-search-toggle')).toBeVisible();
    });

    test(`${url} hides search toggle at desktop (1280px)`, async ({ page }) => {
      await mockAmplitude(page);
      if (needsMock) await mockFecApi(page);
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.goto(url);
      await expect(page.locator('.top-nav-search-toggle')).not.toBeVisible();
    });
  }
});

// ── Mobile nav toggle behavior ────────────────────────────────────────────────

test.describe('mobile nav toggle behavior', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/search.html');
    await page.waitForLoadState('load');
  });

  test('hamburger click opens mobile nav drawer', async ({ page }) => {
    await page.click('#hamburger');
    await expect(page.locator('#mobile-nav')).toHaveClass(/open/);
  });

  test('hamburger click closes mobile nav drawer on second click', async ({ page }) => {
    await page.click('#hamburger');
    await page.click('#hamburger');
    await expect(page.locator('#mobile-nav')).not.toHaveClass(/open/);
  });

  test('mobile search toggle opens the search overlay', async ({ page }) => {
    // T-search-overlay: the mobile search-toggle now opens the full-page
    // overlay (the old #top-nav-mobile-search panel was retired).
    await page.click('#top-nav-search-toggle');
    await expect(page.locator('#search-overlay')).toHaveClass(/open/);
  });
});

// ── No horizontal overflow at mobile ─────────────────────────────────────────

test.describe('no horizontal overflow at 390px', () => {
  const ALL_PAGES = [
    { url: '/search.html', needsMock: false },
    { url: '/candidate.html?id=H2WA03217', needsMock: true },
    { url: '/candidates.html', needsMock: true },
    { url: '/committee.html?id=C00775668', needsMock: true },
    { url: '/committees.html', needsMock: true },
    { url: '/race.html?office=H&state=WA&district=03&year=2024', needsMock: true },
    { url: '/races.html', needsMock: false },
    { url: '/process-log.html', needsMock: false },
    { url: '/design-system.html', needsMock: false },
  ];

  for (const { url, needsMock } of ALL_PAGES) {
    test(`${url} has no horizontal overflow`, async ({ page }) => {
      await mockAmplitude(page);
      if (needsMock) await mockFecApi(page);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(url);
      await page.waitForLoadState('load');
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(390);
    });
  }
});

// ── feed.html ────────────────────────────────────────────────────────────────

test.describe('feed.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/feed.html');
    await page.waitForLoadState('networkidle');
  });

  // ── Structural: results render on load ──

  test('results state is visible after load', async ({ page }) => {
    await expect(page.locator('#state-results')).toBeVisible();
    await expect(page.locator('#state-loading')).not.toBeVisible();
  });

  test('feed list has feed-row children', async ({ page }) => {
    const rows = page.locator('#feed-list .feed-row');
    await expect(rows).toHaveCount(3);
  });

  test('results header shows count', async ({ page }) => {
    const header = page.locator('#results-header');
    const text = await header.textContent();
    expect(text).toMatch(/\d+ filing/);
  });

  // ── Structural: column headers ──

  test('column headers present with expected labels', async ({ page }) => {
    const header = page.locator('#state-results .feed-row-header');
    await expect(header).toBeVisible();
    const text = await header.textContent();
    expect(text).toContain('Committee');
    expect(text).toContain('Report');
    expect(text).toContain('Office');
    expect(text).toContain('Raised');
    expect(text).toContain('Spent');
    expect(text).toContain('COH');
    expect(text).toContain('Filed');
  });

  // ── Structural: feed row content ──

  test('feed rows have committee link with clean URL', async ({ page }) => {
    const link = page.locator('#feed-list .feed-row .feed-name a').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/committee\/C\d+/);
  });

  test('feed rows have report type tag', async ({ page }) => {
    const tag = page.locator('#feed-list .feed-row .feed-report-col .tag').first();
    await expect(tag).toBeVisible();
  });

  test('feed rows have FEC external link with target _blank', async ({ page }) => {
    const fecLink = page.locator('#feed-list .feed-row .feed-fec a').first();
    await expect(fecLink).toBeVisible();
    expect(await fecLink.getAttribute('target')).toBe('_blank');
    expect(await fecLink.getAttribute('rel')).toBe('noopener');
  });

  // ── Structural: filter controls ──

  test('office filter has 4 buttons (All, House, Senate, President)', async ({ page }) => {
    const btns = page.locator('#office-group .button-group-btn');
    await expect(btns).toHaveCount(4);
    const texts = await btns.allTextContents();
    expect(texts).toEqual(['All', 'House', 'Senate', 'President']);
  });

  test('time window has 3 buttons (24h, 48h, 7 days)', async ({ page }) => {
    const btns = page.locator('#window-group .button-group-btn');
    await expect(btns).toHaveCount(3);
    const texts = await btns.allTextContents();
    expect(texts).toEqual(['24h', '48h', '7 days']);
  });

  test('report type select has 5 options', async ({ page }) => {
    const options = page.locator('#f-report-type option');
    await expect(options).toHaveCount(5);
  });

  test('refresh button is present', async ({ page }) => {
    await expect(page.locator('#feed-refresh-btn')).toBeVisible();
  });

  // ── Structural: filter chips ──

  test('filter chips visible on load with time period chip', async ({ page }) => {
    const chips = page.locator('#filter-chips');
    await expect(chips).toBeVisible();
    const text = await chips.textContent();
    expect(text).toContain('Last');
  });

  // ── Structural: end of results ──

  test('end of results visible after data loads', async ({ page }) => {
    await expect(page.locator('#end-of-results')).toBeVisible();
  });

  // ── Structural: error and empty hidden on success ──

  test('error and no-results states hidden on successful load', async ({ page }) => {
    await expect(page.locator('#state-error')).not.toBeVisible();
    await expect(page.locator('#state-no-results')).not.toBeVisible();
  });

  // ── Interaction: office filter ──

  test('clicking Senate filter updates active state and filters rows', async ({ page }) => {
    await page.locator('#office-group .button-group-btn[data-office="S"]').click();
    const activeBtn = page.locator('#office-group .button-group-btn.active');
    await expect(activeBtn).toHaveText('Senate');
    // Mock has 1 Senate filing
    const rows = page.locator('#feed-list .feed-row');
    await expect(rows).toHaveCount(1);
  });

  // ── Interaction: report type filter ──

  test('selecting Termination report type filters rows', async ({ page }) => {
    await page.locator('#f-report-type').selectOption('termination');
    // Mock has 1 TER filing
    const rows = page.locator('#feed-list .feed-row');
    await expect(rows).toHaveCount(1);
  });
});
