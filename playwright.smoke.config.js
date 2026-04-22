// Playwright config for Track 2 — smoke tests (live FEC API).
// Usage: npx playwright test --config playwright.smoke.config.js
//     or: npm run test:smoke
// Override the default target with SMOKE_BASE_URL=https://example.com npm run test:smoke
// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /smoke\.spec\./,
  timeout: 45000,

  use: {
    baseURL: process.env.SMOKE_BASE_URL || 'https://fecledgerapp.pages.dev',
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
  },

  reporter: [['list'], ['html', { open: 'never' }]],
});
