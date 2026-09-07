// playwright.smoke.config.js — CI-2
//
// The config for scripts/smoke.spec.js, and only for it. Named rather than
// `playwright.config.js` on purpose: client/playwright.config.js already exists
// for HOME-1's look-at-the-room screenshots, which start their own Vite dev
// server and are deliberately outside CI. These two runs have nothing in common
// but the runner, and a bare `playwright.config.js` at the root would be picked
// up implicitly by anyone typing `npx playwright test` in either place.
//
// This one assumes a server is ALREADY running and serving a built client —
// `npm start` locally, or the workflow's background node — because the whole
// point is to exercise the shipped bundle rather than the dev server.
//
//   npm start                       # in one terminal
//   npm run smoke:browser           # in another
//
// Point it elsewhere with SMOKE_BASE_URL.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  // CASINO-2 joined the smoke in this job. Same config, same CI job, same
  // deploy gate — two files rather than one because they assert different
  // KINDS of thing: the smoke walks every surface and asks only "did it mount
  // and did it stay quiet", and casino2 measures one screen's layout at two
  // widths, which is the half of a design jsdom structurally cannot see.
  //
  // home2.spec.js is NOT here, and adding it is what broke CI #84. It was put
  // in on the premise that no job ran it; the workflow's own "HOME-2 phone
  // layout" step runs it, under playwright.home2.config.js, which is the only
  // box its assertions hold in — 390x844 with touch. This config is Desktop
  // Chrome at 1440x900, where the room is not drawn at all and no long press
  // can lift anybody, so fourteen of its tests went red for a reason none of
  // them was about. The spec now declares that box itself, so a third config
  // picking it up would not repeat this; the reason to leave it out here is
  // the plainer one, that running the same twenty tests twice buys nothing.
  testMatch: /(smoke|casino2)\.spec\.js$/,

  // A gate, so nothing dresses a flake up as a pass. If this suite is red twice
  // in a row for reasons that are not the product, the fix is to make the
  // assertion honest, not to retry it.
  retries: 0,
  workers: 1,
  reporter: [['list']],

  // Each test walks four screens on a live server and sits on the felt for a
  // couple of seconds. The default 30s is not enough; a minute of headroom is.
  timeout: 120_000,

  use: {
    ...devices['Desktop Chrome'],
    // Overridden per shell in the spec — this is only the fallback.
    viewport: { width: 1440, height: 900 },
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8765',
    trace: 'retain-on-failure',
  },

  // Traces and any failure video land beside the screenshots, so the workflow
  // uploads one directory and gets everything a red run needs.
  outputDir: process.env.SMOKE_SHOT_DIR
    ? `${process.env.SMOKE_SHOT_DIR}/trace`
    : 'smoke-shots/trace',
});
