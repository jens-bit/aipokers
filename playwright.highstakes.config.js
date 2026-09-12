import { defineConfig } from '@playwright/test';

const baseURL = process.env.HIGHSTAKES_BASE_URL;
if (!baseURL) throw new Error('Set HIGHSTAKES_BASE_URL to an isolated, keyless built-app server with GUEST_ENABLED=0.');

export default defineConfig({
  testDir: './scripts',
  testMatch: 'highstakes.spec.js',
  outputDir: process.env.HIGHSTAKES_OUTPUT_DIR ?? './artifacts/first-session/highstakes-browser',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [['list']],
  use: {
    baseURL,
    browserName: 'chromium',
    viewport: { width: 1440, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
