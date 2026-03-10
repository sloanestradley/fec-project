// Playwright config for Track 2 — smoke tests (live FEC API).
// Usage: npx playwright test --config playwright.smoke.config.js
//     or: npm run test:smoke
// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: /smoke\.spec\./,
  timeout: 45000,

  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
  },

  webServer: {
    command: 'python3 -m http.server 8080',
    port: 8080,
    reuseExistingServer: true,
    timeout: 10000,
  },

  reporter: [['list'], ['html', { open: 'never' }]],
});
