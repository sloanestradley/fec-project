/**
 * tooltip.spec.js — Structural + behavioral tests for the Tooltip component
 * (T-tooltip-component). Tests run against /design-system.html — the only
 * surface that currently mounts .tooltip markup; component is self-contained
 * and needs no API mocking.
 *
 * Two demos are in scope:
 *   - .ds-tooltip-demo-row #1 ("Short content")
 *   - .ds-tooltip-demo-row #2 ("Long content with link · ~47-word stress case")
 *
 * For positioning / dynamic-content / warning tests, we inject .tooltip markup
 * at runtime via page.evaluate and re-run initTooltips().
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude } from './helpers/amp-mock.js';

const PAGE = '/design-system.html';

// Helper: count visible (rendered, non-zero size) trigger buttons inside the
// comp-tooltip card after init.
async function firstTrigger(page) {
  return page.locator('#comp-tooltip .ds-tooltip-demo-row').first().locator('.tooltip-trigger');
}
async function secondTrigger(page) {
  return page.locator('#comp-tooltip .ds-tooltip-demo-row').nth(1).locator('.tooltip-trigger');
}

test.describe('tooltip — structure + aria contract', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto(PAGE);
  });

  test('initTooltips wires both demo hosts into trigger buttons', async ({ page }) => {
    await expect(page.locator('#comp-tooltip .tooltip-trigger')).toHaveCount(2);
  });

  test('trigger has aria-haspopup, aria-expanded=false, aria-label preserved', async ({ page }) => {
    const btn = await firstTrigger(page);
    await expect(btn).toHaveAttribute('aria-haspopup', 'true');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(btn).toHaveAttribute('aria-label', 'About raised-to-spent ratio');
  });

  test('outlined icon visible by default; filled hidden', async ({ page }) => {
    const btn = await firstTrigger(page);
    const outline = btn.locator('.tooltip-icon-outline');
    const filled  = btn.locator('.tooltip-icon-filled');
    await expect(outline).toBeVisible();
    await expect(filled).toBeHidden();
  });

  test('host loses its aria-label (transferred to the button)', async ({ page }) => {
    const host = page.locator('#comp-tooltip .ds-tooltip-demo-row').first().locator('.tooltip');
    const labelOnHost = await host.getAttribute('aria-label');
    expect(labelOnHost).toBeNull();
  });
});

test.describe('tooltip — open / close interactions', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto(PAGE);
  });

  test('hover opens the popup with role=tooltip after ~100ms; icon flips to filled', async ({ page }) => {
    const btn = await firstTrigger(page);
    await btn.hover();
    // Wait for hover delay + popup creation. Use longer timeout for slow CI.
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible({ timeout: 2000 });
    await expect(popup).toHaveAttribute('role', 'tooltip');
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect(btn.locator('.tooltip-icon-outline')).toBeHidden();
    await expect(btn.locator('.tooltip-icon-filled')).toBeVisible();
  });

  test('aria-describedby on trigger matches popup id', async ({ page }) => {
    const btn = await firstTrigger(page);
    await btn.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    const popupId = await popup.getAttribute('id');
    const describedby = await btn.getAttribute('aria-describedby');
    expect(describedby).toBe(popupId);
  });

  test('click tap-toggle: first opens, second closes', async ({ page }) => {
    const btn = await firstTrigger(page);
    await btn.click();
    await expect(page.locator('.tooltip-popup')).toBeVisible();
    await btn.click();
    await expect(page.locator('.tooltip-popup')).toHaveCount(0);
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
  });

  test('Escape closes the popup and returns focus to the trigger', async ({ page }) => {
    const btn = await firstTrigger(page);
    await btn.focus();
    await btn.click();
    await expect(page.locator('.tooltip-popup')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tooltip-popup')).toHaveCount(0);
    const focusedClass = await page.evaluate(() => document.activeElement && document.activeElement.className);
    expect(focusedClass).toContain('tooltip-trigger');
  });

  test('outside pointerdown closes the popup', async ({ page }) => {
    const btn = await firstTrigger(page);
    await btn.click();
    await expect(page.locator('.tooltip-popup')).toBeVisible();
    // Click on a benign part of the page well away from the trigger + popup.
    await page.locator('h1').first().click();
    await expect(page.locator('.tooltip-popup')).toHaveCount(0);
  });

  test('opening tooltip B closes already-open tooltip A (singleton)', async ({ page }) => {
    const a = await firstTrigger(page);
    const b = await secondTrigger(page);
    await a.click();
    await expect(page.locator('.tooltip-popup')).toHaveCount(1);
    await b.click();
    await expect(page.locator('.tooltip-popup')).toHaveCount(1);
    // The one open popup should now be the one described by B.
    const popupId = await page.locator('.tooltip-popup').getAttribute('id');
    await expect(b).toHaveAttribute('aria-describedby', popupId);
    await expect(a).toHaveAttribute('aria-expanded', 'false');
  });

  test('scroll closes the popup', async ({ page }) => {
    const btn = await firstTrigger(page);
    await btn.click();
    await expect(page.locator('.tooltip-popup')).toBeVisible();
    // scroll/resize listeners are rAF-deferred in __tt_openFor to avoid
    // Playwright's auto-scroll-into-view scroll event closing the popup
    // immediately on open. Give the rAF a frame to fire before triggering.
    await page.waitForTimeout(50);
    await page.evaluate(() => window.scrollBy(0, 100));
    await expect(page.locator('.tooltip-popup')).toHaveCount(0);
  });

  test('resize closes the popup', async ({ page }) => {
    const btn = await firstTrigger(page);
    await btn.click();
    await expect(page.locator('.tooltip-popup')).toBeVisible();
    await page.waitForTimeout(50);   // give rAF-deferred resize listener time to attach
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('.tooltip-popup')).toHaveCount(0);
  });

  test('cursor handoff to popup keeps it open (combined hover region)', async ({ page }) => {
    const btn = await firstTrigger(page);
    await btn.hover();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible({ timeout: 2000 });
    // Move cursor from trigger directly onto the popup. The bridge is the
    // 100ms close-timer that the popup's mouseenter cancels.
    await popup.hover();
    await page.waitForTimeout(300);
    await expect(popup).toBeVisible();
  });

  test('Tab + Enter via keyboard opens; :focus-visible alone keeps icon outlined', async ({ page }) => {
    const btn = await firstTrigger(page);
    await btn.focus();
    // Trigger is focused but popup is not yet revealed.
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect(btn.locator('.tooltip-icon-outline')).toBeVisible();
    await expect(btn.locator('.tooltip-icon-filled')).toBeHidden();
    await page.keyboard.press('Enter');
    await expect(page.locator('.tooltip-popup')).toBeVisible();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
  });
});

test.describe('tooltip — positioning', () => {
  test.beforeEach(async ({ page }) => {
    await mockAmplitude(page);
    await page.goto(PAGE);
  });

  test('default placement: popup top edge contiguous with trigger bottom edge (zero gap)', async ({ page }) => {
    const btn = await firstTrigger(page);
    // Scroll trigger near top of viewport so there's plenty of space below.
    await btn.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -200));
    await btn.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    const gap = await page.evaluate(() => {
      const t = document.querySelector('#comp-tooltip .tooltip-trigger');
      const p = document.querySelector('.tooltip-popup');
      return p.getBoundingClientRect().top - t.getBoundingClientRect().bottom;
    });
    // Sub-pixel tolerance for fractional rect rounding; intent is zero gap.
    expect(Math.abs(gap)).toBeLessThan(1);
  });

  test('flips above when there is no room below', async ({ page }) => {
    // Inject a tooltip near the very bottom of the viewport and re-init.
    await page.evaluate(() => {
      const host = document.createElement('span');
      host.className = 'tooltip';
      host.id = 'flip-test-tooltip';
      host.setAttribute('aria-label', 'Flip-test tooltip');
      host.innerHTML = 'Flip-test content.';
      const wrap = document.createElement('div');
      wrap.style.position = 'fixed';
      wrap.style.bottom = '8px';
      wrap.style.left = '50%';
      wrap.style.zIndex = '1';
      wrap.appendChild(host);
      document.body.appendChild(wrap);
      initTooltips();
    });
    const btn = page.locator('#flip-test-tooltip .tooltip-trigger');
    await btn.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    const flipped = await page.evaluate(() => {
      const t = document.querySelector('#flip-test-tooltip .tooltip-trigger');
      const p = document.querySelector('.tooltip-popup');
      return p.getBoundingClientRect().bottom <= t.getBoundingClientRect().top + 1;
    });
    expect(flipped).toBe(true);
  });

  test('shifts horizontally when popup would clip the right edge', async ({ page }) => {
    await page.evaluate(() => {
      const host = document.createElement('span');
      host.className = 'tooltip';
      host.id = 'shift-test-tooltip';
      host.setAttribute('aria-label', 'Shift-test tooltip');
      host.innerHTML = 'Some content with enough text to make the popup take its full max-width so the right-edge clamp matters.';
      const wrap = document.createElement('div');
      wrap.style.position = 'fixed';
      wrap.style.top = '120px';
      wrap.style.right = '4px';
      wrap.style.zIndex = '1';
      wrap.appendChild(host);
      document.body.appendChild(wrap);
      initTooltips();
    });
    const btn = page.locator('#shift-test-tooltip .tooltip-trigger');
    await btn.click();
    const popup = page.locator('.tooltip-popup');
    await expect(popup).toBeVisible();
    const fitsViewport = await page.evaluate(() => {
      const p = document.querySelector('.tooltip-popup');
      const r = p.getBoundingClientRect();
      return r.right <= window.innerWidth - 7;   // EDGE=8px; tolerate rounding
    });
    expect(fitsViewport).toBe(true);
  });
});

test.describe('tooltip — reduced motion + warnings', () => {
  test.use({ reducedMotion: 'reduce' });

  test('reveal is instant under prefers-reduced-motion', async ({ page }) => {
    await mockAmplitude(page);
    await page.goto(PAGE);
    const btn = await firstTrigger(page);
    await btn.hover();
    // Under reduced-motion, hover delay is 0. Wait a single frame, then assert.
    await page.waitForTimeout(30);
    await expect(page.locator('.tooltip-popup')).toBeVisible();
  });

  test('missing aria-label on host triggers console.warn and skips render', async ({ page }) => {
    await mockAmplitude(page);
    const warnings = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    await page.goto(PAGE);
    await page.evaluate(() => {
      const host = document.createElement('span');
      host.className = 'tooltip';
      host.id = 'no-label-tooltip';
      host.textContent = 'Should not be wired';
      document.body.appendChild(host);
      initTooltips();
    });
    // Host stays in DOM with literal content; no trigger button injected.
    await expect(page.locator('#no-label-tooltip .tooltip-trigger')).toHaveCount(0);
    expect(warnings.some(w => /aria-label/.test(w))).toBe(true);
  });

  test('nested <button> ancestor triggers console.warn (wiring proceeds)', async ({ page }) => {
    await mockAmplitude(page);
    const warnings = [];
    page.on('console', msg => {
      if (msg.type() === 'warning') warnings.push(msg.text());
    });
    await page.goto(PAGE);
    await page.evaluate(() => {
      const outerBtn = document.createElement('button');
      outerBtn.type = 'button';
      outerBtn.id = 'nested-outer';
      const host = document.createElement('span');
      host.className = 'tooltip';
      host.setAttribute('aria-label', 'Inner');
      host.textContent = 'Inner content';
      outerBtn.appendChild(host);
      document.body.appendChild(outerBtn);
      initTooltips();
    });
    // Wiring still proceeded (warning is dev-time signal, not enforcement).
    await expect(page.locator('#nested-outer .tooltip-trigger')).toHaveCount(1);
    expect(warnings.some(w => /nested/i.test(w) || /button/i.test(w))).toBe(true);
  });
});
