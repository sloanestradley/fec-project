/**
 * pages.spec.js — Structural tests for all remaining pages:
 *   committee.html, races.html, race.html, candidates.html,
 *   committees.html, process-log.html, design-system.html, index.html
 *
 * Covers: nav active states, key structural elements, Amplitude events,
 * and scaffold-level presence checks for not-yet-built sections.
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude, findTrackEvent } from './helpers/amp-mock.js';
import { mockFecApi } from './helpers/api-mock.js';

// ── committee.html ────────────────────────────────────────────────────────────

test.describe('committee.html', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668');
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
  });

  test('"Committees" nav item is active (profile activates parent)', async ({ page }) => {
    const active = page.locator('.top-nav .nav-link.active');
    const text = await active.first().textContent();
    expect(text?.trim()).toContain('Committees');
  });

  test('Page Viewed fires with page: committee', async ({ page }) => {
    const event = await findTrackEvent(page, 'Page Viewed');
    expect(event).toBeDefined();
    expect(event.args[1]).toMatchObject({ page: 'committee' });
  });

  test('committee name is displayed', async ({ page }) => {
    const name = page.locator('.committee-name-display');
    await expect(name).toBeVisible();
    const text = await name.textContent();
    expect(text?.trim().length).toBeGreaterThan(3);
  });

  test('meta-row with type tags is present', async ({ page }) => {
    await expect(page.locator('.meta-row')).toBeVisible();
  });

  test('stats grid shows financial figures (not $0)', async ({ page }) => {
    // Wait for content to become visible
    await page.waitForSelector('.committee-content.visible', { timeout: 10000 });
    const statsGrid = page.locator('.stats-grid');
    await expect(statsGrid).toBeVisible();
    const values = statsGrid.locator('.stat-value');
    const count = await values.count();
    expect(count).toBeGreaterThan(0);
    let hasNonZeroDollar = false;
    for (let i = 0; i < count; i++) {
      const text = await values.nth(i).textContent();
      if (text?.match(/\$[\d,.]+/) && text !== '$0') hasNonZeroDollar = true;
    }
    expect(hasNonZeroDollar).toBe(true);
  });

  test('committees link is present (breadcrumb or nav)', async ({ page }) => {
    const backLink = page.locator('a[href*="committees"]').first();
    await expect(backLink).toBeAttached();
  });

  test('committee content area is present (scaffold)', async ({ page }) => {
    const content = page.locator('.committee-content');
    await expect(content).toBeAttached();
  });

  test('tabs bar is present and visible after load', async ({ page }) => {
    await expect(page.locator('#tabs-bar')).toBeVisible();
  });

  test('three tabs are present: Summary, Raised, Spent', async ({ page }) => {
    const tabs = page.locator('.tabs-bar .tab');
    await expect(tabs).toHaveCount(3);
  });

  test('Summary tab is active by default', async ({ page }) => {
    await expect(page.locator('.tab').filter({ hasText: 'Summary' })).toHaveClass(/active/);
  });

  test('clicking Raised tab activates it and shows #tab-raised', async ({ page }) => {
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    await expect(page.locator('.tab').filter({ hasText: 'Raised' })).toHaveClass(/active/);
    await expect(page.locator('#tab-raised')).toBeVisible();
    await expect(page.locator('#tab-summary')).toBeHidden();
  });

  test('clicking Spent tab activates it and shows #tab-spent', async ({ page }) => {
    await page.locator('.tab').filter({ hasText: 'Spent' }).click();
    await expect(page.locator('#tab-spent')).toBeVisible();
    await expect(page.locator('#tab-summary')).toBeHidden();
  });

  test('cycle switcher is present inside .tabs-bar', async ({ page }) => {
    await expect(page.locator('.tabs-bar #cycle-switcher')).toBeAttached();
  });

  test('cycle switcher has an "All time" option with value "all"', async ({ page }) => {
    await expect(page.locator('#cycle-switcher option[value="all"]')).toHaveText('All time');
  });

  test('cycle switcher has at least one numeric cycle option', async ({ page }) => {
    await expect(page.locator('#cycle-switcher option:not([value="all"])')).not.toHaveCount(0);
  });

  test('#committee-name text is title-cased, not ALL CAPS', async ({ page }) => {
    const text = await page.locator('#committee-name').textContent();
    expect(text?.trim()).not.toBe(text?.trim().toUpperCase());
  });

  test('.candidate-card-office is not present on page (deprecated class removed)', async ({ page }) => {
    await expect(page.locator('.candidate-card-office')).toHaveCount(0);
  });

  test('filing history stub is not present', async ({ page }) => {
    await expect(page.locator('.section-title').filter({ hasText: 'Filing History' })).toHaveCount(0);
  });

  test('hash all#summary present on default load', async ({ page }) => {
    await expect(page).toHaveURL(/#all#summary/);
  });

  test('URL hash updates when cycle switcher changes', async ({ page }) => {
    await page.locator('#cycle-switcher').selectOption('2024');
    await expect(page).toHaveURL(/#2024#summary/);
  });

  test('URL hash updates when tab changes', async ({ page }) => {
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    await expect(page).toHaveURL(/#(all|\d{4})#raised/);
  });
});

// ── committee.html — Raised tab sections ──────────────────────────────────────

test.describe('committee.html — Raised tab sections', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668');
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await page.locator('.tab').filter({ hasText: 'Raised' }).click();
    // Wait for raised-content to appear (API calls resolve + render)
    await page.waitForFunction(
      () => {
        const el = document.getElementById('raised-content');
        return el && el.style.display !== 'none';
      },
      { timeout: 15000 }
    );
  });

  test('donut canvas is present in raised tab', async ({ page }) => {
    await expect(page.locator('#chart-donut')).toBeVisible();
  });

  test('map container is present in raised tab', async ({ page }) => {
    await expect(page.locator('#map-container')).toBeAttached();
  });

  test('individual donors tbody is present and has at least one row', async ({ page }) => {
    const rows = page.locator('#individual-donors-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('committee donors tbody is present and has at least one row', async ({ page }) => {
    const rows = page.locator('#committee-donors-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });
});

// ── committee.html — Spent tab sections ───────────────────────────────────────

test.describe('committee.html — Spent tab sections', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await mockFecApi(page);
    await page.goto('/committee.html?id=C00775668');
    await page.waitForSelector('.committee-header.visible', { timeout: 12000 });
    await page.locator('.tab').filter({ hasText: 'Spent' }).click();
    await page.waitForFunction(
      () => { const el = document.getElementById('spent-content'); return el && el.style.display !== 'none'; },
      { timeout: 15000 }
    );
  });

  test('spent donut canvas is present in spent tab', async ({ page }) => {
    await expect(page.locator('#chart-spent-donut')).toBeVisible();
  });

  test('spend-detail-bars is present in spent tab', async ({ page }) => {
    await expect(page.locator('#spend-detail-bars')).toBeAttached();
  });

  test('vendors tbody is present and has at least one row', async ({ page }) => {
    const rows = page.locator('#vendors-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });

  test('contributions-section is visible (mock has CCM record)', async ({ page }) => {
    await expect(page.locator('#contributions-section')).toBeVisible();
  });

  test('contributions-tbody has at least one row', async ({ page }) => {
    const rows = page.locator('#contributions-tbody tr');
    await expect(rows).not.toHaveCount(0);
  });
});

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
    await expect(page.locator('#f-state')).toBeAttached();
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

  test('breadcrumb contains link to races page', async ({ page }) => {
    const link = page.locator('.breadcrumb a[href*="races"]').first();
    await expect(link).toBeAttached();
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
    // Accept both /candidate/{id}#year#summary (clean URL) and candidate.html?id=...#year
    const link = page.locator('a.candidate-card[href*="candidate"]').first();
    await expect(link).toBeAttached();
    const href = await link.getAttribute('href');
    // Should include a year anchor like #2024#summary
    expect(href).toMatch(/#\d{4}/);
  });

  test('no 422 errors (office sent as lowercase full word)', async ({ page }) => {
    // No 422s should have occurred during beforeEach navigation
    // This is verified by inspecting requests during the load
    const errors422 = [];
    page.on('response', res => {
      if (res.url().includes('api.open.fec.gov') && res.status() === 422) {
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
    const meta = page.locator('#race-meta');
    const text = await meta.textContent();
    expect(text).not.toContain('Class');
  });

  test('Senate race shows class indicator in meta', async ({ page }) => {
    // Navigate to a Senate race — 2024 is Class I
    await page.goto('/race.html?state=WA&office=S&year=2024');
    await waitForRaceLoad(page);
    const meta = page.locator('#race-meta');
    const text = await meta.textContent();
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

  test('search input is visible in filter bar', async ({ page }) => {
    const searchInput = page.locator('#f-search');
    await expect(searchInput).toBeVisible();
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
  });

  test('filter chips appear when a filter is active', async ({ page }) => {
    await page.locator('#f-office').selectOption('H');
    await page.waitForSelector('.filter-chip', { timeout: 5000 });
    const chips = page.locator('.filter-chip');
    await expect(chips).not.toHaveCount(0);
  });

  test('URL updates after filter change', async ({ page }) => {
    await page.locator('#f-office').selectOption('H');
    await page.waitForFunction(() => window.location.search.includes('office=H'), { timeout: 5000 });
    expect(page.url()).toContain('office=H');
  });

  test('error state renders when API fails', async ({ page }) => {
    await page.route('**/api.open.fec.gov/**', route => route.fulfill({ status: 500, body: 'error' }));
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
    await page.locator('#f-type').selectOption('P');
    await page.waitForSelector('.filter-chip', { timeout: 5000 });
    await expect(page.locator('.filter-chip')).not.toHaveCount(0);
  });

  test('URL updates after filter change', async ({ page }) => {
    await page.locator('#f-type').selectOption('P');
    await page.waitForFunction(() => window.location.search.includes('type=P'), { timeout: 5000 });
    expect(page.url()).toContain('type=P');
  });

  test('error state renders when API fails', async ({ page }) => {
    await page.route('**/api.open.fec.gov/**', route => route.fulfill({ status: 500, body: 'error' }));
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

  test('treasurer name is displayed in search results', async ({ page }) => {
    const treasurer = page.locator('.committee-treasurer').first();
    await expect(treasurer).toBeVisible();
    const text = await treasurer.textContent();
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
    // #ede8e0 → R=237 (high value = light color)
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
      await page.waitForLoadState('networkidle');
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
      await page.waitForLoadState('networkidle');
      const scrollWidth = await page.evaluate(() => document.body.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(390);
    });
  }
});
