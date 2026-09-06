// playwright.home2.config.js — HOME-2
//
// The phone, at 390×844, and nothing else. The queue that produced this wave
// asks for a browser check on four of its jobs — no bottom bar, the fixtures on
// the walls, carrying an agent to a fixture, and the one sheet the table opens
// — and every one of them is a claim about LAYOUT AND GESTURE that jsdom cannot
// answer: jsdom performs no layout, so "nothing overlaps his name pill" and
// "the door sign is fully visible" are measurements it reports as zeroes.
//
// Separate from playwright.smoke.config.js on purpose. That one is CI-2's gate
// and walks both shells to prove the shipped bundle mounts; this one is a
// ruler. Sharing a config would make one red run mean two different things.
//
// Same assumption as the smoke config: a server is ALREADY running and serving
// a built client.
//
//   npm start            # in one terminal
//   npm run test:home2   # in another
//
// Point it elsewhere with SMOKE_BASE_URL.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './scripts',
  testMatch: 'home2.spec.js',

  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,

  use: {
    ...devices['Desktop Chrome'],
    // The Mini App's phone. Every assertion in the spec is against this box.
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    baseURL: process.env.SMOKE_BASE_URL ?? 'http://127.0.0.1:8765',
    trace: 'retain-on-failure',
  },

  outputDir: process.env.HOME2_SHOT_DIR
    ? `${process.env.HOME2_SHOT_DIR}/trace`
    : 'home2-shots/trace',
});
