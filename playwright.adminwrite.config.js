// playwright.adminwrite.config.js — ADMIN-2
//
// The one browser check of the write panel. Same family as
// playwright.smoke.config.js and playwright.home2.config.js: assumes a
// server is ALREADY running, and is not part of CI — page.test.js's own
// header says why for the read panel ("that is what the Playwright
// screenshots... are for, and they are not a CI gate"), and the same holds
// for this one. A picture of a form submitting is not a correctness gate;
// the correctness is opsRoutes.test.js's job.
//
//   ADMIN_KEY=check-key NOTIFY_ENABLED=0 RATE_LIMIT_MAX=100000 \
//     RATE_LIMIT_CHAT_MAX=100000 node src/index.js   # in one terminal
//   ADMIN_KEY=check-key npx playwright test -c playwright.adminwrite.config.js

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  testMatch: 'admin-write.spec.js',

  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60_000,

  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8765',
    trace: 'retain-on-failure',
  },
});
