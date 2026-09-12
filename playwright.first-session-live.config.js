// Real built-app journeys. Start this worktree's server separately with a
// scratch data directory and all provider keys unset. Run --grep 'development
// owner' with GUEST_ENABLED=0, then --grep 'fresh guest' with GUEST_ENABLED=1.
// Use the root runner: node node_modules/@playwright/test/cli.js test -c playwright.first-session-live.config.js
import { defineConfig } from '@playwright/test';

const baseURL = process.env.FIRST_SESSION_BASE_URL;
if (!baseURL) throw new Error('Set FIRST_SESSION_BASE_URL to the isolated built-app server for this worktree.');

export default defineConfig({
  testDir: './scripts',
  testMatch: 'first-session-live.spec.js',
  outputDir: process.env.FIRST_SESSION_LIVE_OUTPUT_DIR ?? './artifacts/first-session/live-browser',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'phone-390x844', use: { viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'desktop-1440x900', use: { viewport: { width: 1440, height: 900 } } },
  ],
});
