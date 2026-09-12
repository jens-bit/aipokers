// Start a built client from this worktree on an explicitly chosen private
// port. Reusing an unknown listener can silently test another builder's code.
// Run with: node client/node_modules/@playwright/test/cli.js test -c playwright.first-session.config.js
// Use the client's runner: this repository installs Playwright separately at
// root and client, and the spec/fixtures resolve the latter.
const baseURL = process.env.FIRST_SESSION_BASE_URL;
if (!baseURL) throw new Error('Set FIRST_SESSION_BASE_URL to this worktree\'s built-client server before running this check.');

export default {
  testDir: './client/e2e',
  testMatch: 'first-session.spec.js',
  outputDir: './artifacts/first-session/browser',
  workers: 1,
  retries: 0,
  timeout: 40_000,
  expect: { timeout: 7_000 },
  reporter: [['list']],
  use: {
    baseURL,
    viewport: { width: 390, height: 844 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
};
