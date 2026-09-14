// client/playwright.shots.config.js — SHOTS-1
//
// The config for e2e/shipped-shots.spec.js, and only for it. Lives in client/
// — unlike playwright.smoke.config.js and playwright.home2.config.js at the
// repo root — because the spec imports `@playwright/test` and `better-sqlite3`
// through Node's ordinary resolution, and running the root's copy of
// Playwright against a test file that resolves client/'s own copy of
// `@playwright/test` throws ("Requiring @playwright/test second time").
// Running from client/, with client's own devDependency, avoids the clash.
//
// Assumes two servers are ALREADY running against a built client — one
// plain, one GUEST_ENABLED=1 — because scripts/shots.js (`npm run shots`) is
// what starts them, seeds the pack, and tears them down again. See the header
// of the spec for what to set by hand if you run this any other way.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: 'shipped-shots.spec.js',

  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,

  use: {
    ...devices['Desktop Chrome'],
    viewport: { width: 390, height: 844 },
    baseURL: process.env.SHOTS_BASE_URL ?? 'http://127.0.0.1:8793',
    trace: 'retain-on-failure',
  },

  outputDir: '../design-refs/shipped/trace',
});
