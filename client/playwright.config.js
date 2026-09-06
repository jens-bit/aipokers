// client/playwright.config.js — HOME-1
//
// Visual checks only, and deliberately outside `npm test` and outside CI. See
// the header of e2e/home.spec.js for why: everything with a rule behind it is
// asserted in vitest, and Playwright is not a dependency of this repo — it is
// run with `npx playwright test` when somebody wants to LOOK at the room.
//
//   cd client && npx playwright test
//
// The dev server is started for the run and torn down after it, so there is one
// command and nothing to remember to stop.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  // A picture is not a gate: a flake here must never be read as a failure of
  // the product, so there are no retries dressing one up as a pass.
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
