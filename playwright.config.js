// @ts-check
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests',

  // smoke.spec.js is excluded from the default test run — it hits the live FEC API.
  // Run smoke tests explicitly: npx playwright test tests/smoke.spec.js
  // See TESTING.md for full details on Track 1 vs Track 2.
  testIgnore: /smoke\.spec\./,

  use: {
    baseURL: 'http://localhost:8080',
    headless: true,
    viewport: { width: 1280, height: 800 },
    // Capture screenshot only on failure
    screenshot: 'only-on-failure',
    // Capture trace only on retry
    trace: 'on-first-retry',
  },

  // Automatically start the local dev server when running tests
  webServer: {
    command: 'python3 -m http.server 8080',
    port: 8080,
    reuseExistingServer: true,
    timeout: 10000,
  },

  // Keep test output clean
  reporter: [['list'], ['html', { open: 'never' }]],

  // Smoke tests hit a real API and need more time
  timeout: 15000,
});
