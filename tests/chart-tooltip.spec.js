/**
 * chart-tooltip.spec.js — Unit-style coverage of externalChartTooltip (the
 * shared Chart.js `external` HTML tooltip handler) and the .viz-tt surface.
 * Runs against /design-system.html — any page that loads utils.js + styles.css
 * works. Canvas hover is not simulated (fragile); the handler's HTML build +
 * the .viz-tt label/body color rule are tested directly.
 *
 * T-chart-tooltip-improvements (2026-06-01).
 */

import { test, expect } from '@playwright/test';
import { mockAmplitude } from './helpers/amp-mock.js';

const PAGE = '/design-system.html';

// A synthetic Chart.js tooltip context: real DOM (so offsetWidth/Height work),
// fake canvas rect + caret.
function fakeContext(tooltip) {
  return {
    chart: { canvas: { getBoundingClientRect: () => ({ left: 100, top: 100 }) } },
    tooltip,
  };
}

test.beforeEach(async ({ page }) => {
  await mockAmplitude(page);
  await page.goto(PAGE);
});

test.describe('externalChartTooltip', () => {
  test('builds a #chart-tt with .viz-tt-label for the title and .viz-tt-body for the body', async ({ page }) => {
    const out = await page.evaluate((mk) => {
      const ctx = eval('(' + mk + ')')({
        opacity: 1, caretX: 20, caretY: 20,
        title: ['Individuals (itemized)'],
        body: [{ lines: [' $5.2M (44%)'] }],
      });
      externalChartTooltip(ctx);
      const el = document.getElementById('chart-tt');
      return {
        exists: !!el,
        cls: el.className,
        display: el.style.display,
        labels: Array.from(el.querySelectorAll('.viz-tt-label')).map(n => n.textContent),
        bodies: Array.from(el.querySelectorAll('.viz-tt-body')).map(n => n.textContent),
      };
    }, fakeContext.toString());
    expect(out.exists).toBe(true);
    expect(out.cls).toBe('viz-tt');
    expect(out.display).toBe('block');
    expect(out.labels).toEqual(['Individuals (itemized)']);
    expect(out.bodies).toEqual(['$5.2M (44%)']); // leading space trimmed
  });

  test('renders multiple body rows (timeline index mode), all as .viz-tt-body', async ({ page }) => {
    const bodies = await page.evaluate((mk) => {
      const ctx = eval('(' + mk + ')')({
        opacity: 1, caretX: 5, caretY: 5,
        title: ['Mar 31, 2024'],
        body: [{ lines: [' Raised: $5.2M'] }, { lines: [' Spent: $3.1M'] }, { lines: [' Cash on hand: $2.1M'] }],
      });
      externalChartTooltip(ctx);
      const el = document.getElementById('chart-tt');
      return Array.from(el.querySelectorAll('.viz-tt-body')).map(n => n.textContent);
    }, fakeContext.toString());
    expect(bodies).toEqual(['Raised: $5.2M', 'Spent: $3.1M', 'Cash on hand: $2.1M']);
  });

  test('opacity 0 hides the tooltip', async ({ page }) => {
    const display = await page.evaluate((mk) => {
      const mkFn = eval('(' + mk + ')');
      externalChartTooltip(mkFn({ opacity: 1, caretX: 5, caretY: 5, title: ['X'], body: [{ lines: ['y'] }] }));
      externalChartTooltip(mkFn({ opacity: 0 }));
      return document.getElementById('chart-tt').style.display;
    }, fakeContext.toString());
    expect(display).toBe('none');
  });

  test('.viz-tt-label and .viz-tt-body carry different colors (label var(--muted), body var(--text))', async ({ page }) => {
    const colors = await page.evaluate(() => {
      const wrap = document.createElement('div');
      wrap.className = 'viz-tt';
      wrap.innerHTML = '<div class="viz-tt-label">L</div><div class="viz-tt-body">B</div>';
      document.body.appendChild(wrap);
      const label = getComputedStyle(wrap.querySelector('.viz-tt-label')).color;
      const body = getComputedStyle(wrap.querySelector('.viz-tt-body')).color;
      const fam = getComputedStyle(wrap.querySelector('.viz-tt-body')).fontFamily;
      wrap.remove();
      return { label, body, fam };
    });
    expect(colors.label).not.toBe(colors.body); // label (--muted) and body (--text) are distinct
    expect(colors.fam).toContain('IBM Plex Sans'); // body text style, not Mono
  });
});
