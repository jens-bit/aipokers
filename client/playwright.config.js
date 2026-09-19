// client/playwright.config.js — HOME-1
//
// Browser behavior, geometry and review captures. The explicit recovery spec
// list in .github/workflows/deploy.yml gates CI; npm test remains Vitest.
// Playwright is installed through the root development dependencies.
//
//   cd client && npx playwright test
//
// The dev server is started for the run and torn down after it, so there is one
// command and nothing to remember to stop.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // Failures stay visible; retries must not turn intermittent defects green.
  retries: 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5199',
    // The Mini App's own size. Every screenshot in this suite is this box.
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    isMobile: false,
    hasTouch: true,
  },
  webServer: {
    command: 'npx vite --port 5199 --strictPort',
    url: 'http://127.0.0.1:5199',
    // NEVER reuse: 5173 is the ordinary dev port and this repo is worked in
    // several git worktrees at once, so "a server is already listening" is not
    // evidence that it is serving THIS tree. A screenshot of somebody else's
    // branch is worse than no screenshot.
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
