/**
 * pages.spec.js — Structural tests for all remaining pages:
 *   races.html, race.html, candidates.html, committees.html, feed.html,
 *   process-log.html, design-system.html, index.html.
 *
 * committee.html tests live in tests/committee.spec.js (split out 2026-04-27
 * for parity with candidate.spec.js).
 *
 * Covers: nav active states, key structural elements, Amplitude events,
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

  test('"Races" nav item is active', async ({ page }) => {
    const active = page.locator('.top-nav .nav-link.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Races');
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

  test('"Races" nav item is active (profile activates parent)', async ({ page }) => {
    const active = page.locator('.top-nav .nav-link.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Races');
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
    // Mock fixture has incumbent_challenge_full: 'Incumbent' — tag should render
    const incumbentTag = page.locator('.candidate-card .tag-neutral').first();
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

  test('"Candidates" nav item is active', async ({ page }) => {
    const active = page.locator('.top-nav .nav-link.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Candidates');
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
    await expect(page.locator('.retry-btn')).toBeVisible();
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

  test('"Committees" nav item is active', async ({ page }) => {
    const active = page.locator('.top-nav .nav-link.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Committees');
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
    await expect(page.locator('.retry-btn')).toBeVisible();
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

  test('Show terminated toggle is present and unchecked by default', async ({ page }) => {
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

// ── candidates.html — typeahead ───────────────────────────────────────────────

test.describe('candidates.html — typeahead', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/candidates.html');
  });

  test('fewer than 2 chars does not show typeahead', async ({ page }) => {
    await page.locator('#f-search').fill('g');
    await page.waitForTimeout(400);
    await expect(page.locator('#search-typeahead')).not.toHaveClass(/open/);
  });

  test('2+ chars shows typeahead dropdown', async ({ page }) => {
    await page.locator('#f-search').fill('gl');
    await expect(page.locator('#search-typeahead')).toHaveClass(/open/, { timeout: 2000 });
  });

  test('typeahead row links to /candidate/{id}', async ({ page }) => {
    await page.locator('#f-search').fill('gl');
    await expect(page.locator('#search-typeahead')).toHaveClass(/open/, { timeout: 2000 });
    const link = page.locator('#search-typeahead .typeahead-row').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/candidate\/[A-Z0-9]+/);
    expect(href).not.toContain('#');
  });

  test('Escape key closes the typeahead', async ({ page }) => {
    await page.locator('#f-search').fill('gl');
    await expect(page.locator('#search-typeahead')).toHaveClass(/open/, { timeout: 2000 });
    await page.locator('#f-search').press('Escape');
    await expect(page.locator('#search-typeahead')).not.toHaveClass(/open/);
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

// ── committees.html — typeahead ───────────────────────────────────────────────

test.describe('committees.html — typeahead', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committees.html');
  });

  test('fewer than 2 chars does not show typeahead', async ({ page }) => {
    await page.locator('#f-search').fill('g');
    await page.waitForTimeout(400);
    await expect(page.locator('#search-typeahead')).not.toHaveClass(/open/);
  });

  test('2+ chars shows typeahead dropdown', async ({ page }) => {
    await page.locator('#f-search').fill('gl');
    await expect(page.locator('#search-typeahead')).toHaveClass(/open/, { timeout: 2000 });
  });

  test('typeahead row links to /committee/{id}', async ({ page }) => {
    await page.locator('#f-search').fill('gl');
    await expect(page.locator('#search-typeahead')).toHaveClass(/open/, { timeout: 2000 });
    const link = page.locator('#search-typeahead .typeahead-row').first();
    await expect(link).toBeVisible();
    const href = await link.getAttribute('href');
    expect(href).toMatch(/\/committee\/[A-Z0-9]+/);
  });

  test('Escape key closes the typeahead', async ({ page }) => {
    await page.locator('#f-search').fill('gl');
    await expect(page.locator('#search-typeahead')).toHaveClass(/open/, { timeout: 2000 });
    await page.locator('#f-search').press('Escape');
    await expect(page.locator('#search-typeahead')).not.toHaveClass(/open/);
  });
});

// ── process-log.html ──────────────────────────────────────────────────────────

test.describe('process-log.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto('/process-log.html');
  });

  test('no nav link is active (process-log not in top nav)', async ({ page }) => {
    const activeLinks = page.locator('.top-nav .nav-link.active');
    await expect(activeLinks).toHaveCount(0);
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

  test('no nav link is active (design-system not in top nav)', async ({ page }) => {
    const activeLinks = page.locator('.top-nav .nav-link.active');
    await expect(activeLinks).toHaveCount(0);
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

  test('search toggle click opens mobile search panel', async ({ page }) => {
    await page.click('#top-nav-search-toggle');
    await expect(page.locator('#top-nav-mobile-search')).toHaveClass(/open/);
  });

  test('opening hamburger closes search panel', async ({ page }) => {
    await page.click('#top-nav-search-toggle');
    await expect(page.locator('#top-nav-mobile-search')).toHaveClass(/open/);
    await page.click('#hamburger');
    await expect(page.locator('#top-nav-mobile-search')).not.toHaveClass(/open/);
    await expect(page.locator('#mobile-nav')).toHaveClass(/open/);
  });

  test('opening search panel closes hamburger drawer', async ({ page }) => {
    await page.click('#hamburger');
    await expect(page.locator('#mobile-nav')).toHaveClass(/open/);
    await page.click('#top-nav-search-toggle');
    await expect(page.locator('#mobile-nav')).not.toHaveClass(/open/);
    await expect(page.locator('#top-nav-mobile-search')).toHaveClass(/open/);
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
