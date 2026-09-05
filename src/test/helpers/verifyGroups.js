// src/test/helpers/verifyGroups.js — TEST-2
//
// One place that knows what the scripts/verify-*.js suites are and which group
// each belongs to. Two runners consume it:
//   src/test/verifyScripts.test.js  → `npm test`      (fast group)
//   src/test/e2e.test.js            → `npm run test:e2e` (the slow group)
//
// Discovery still does the work: a new scripts/verify-*.js lands in the fast
// group automatically. A script only moves or disappears by being named here,
// with a reason.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, runScript, assertPassed } from './runScript.js';

export const SCRIPTS = path.join(ROOT, 'scripts');

// Not run by anything automatic. The reason is the whole entry.
export const EXCLUDED = new Map([
  // Asserts every stored bankroll against its own ledger in data/app.db.
  // data/ is gitignored, so on CI there is no database to check and on a laptop
  // it checks whatever that machine happens to hold. That makes it an
  // operational data check, not a regression test — `npm run test:data`.
  ['verify-chips.js', 'asserts against the machine\'s live data/app.db (gitignored, absent on CI) — run `npm run test:data`'],
]);

// Boot a real server, deploy agents and play hands to completion. Each takes
// tens of seconds, which is why they are their own command: `npm test` has to
// stay fast enough that nobody is tempted to skip it before a commit.
// Required before every merge to main.
export const E2E = new Set([
  'verify-multi-seat.js',
  // PACE-1: the staged all-in beat is a real ~11s wall-clock hold (3-5s on the
  // line, 700ms a card, 2s on the finished board). Asserting it means waiting
  // it out, and that belongs in the slow group by definition.
  'verify-pace.js',
  'verify-personality-layer.js',
  'verify-server-life.js',
  'verify-watch-v2.js',
]);

// Needs a built client to serve. Skipped rather than excluded: when
// client/dist exists the cache-header contract is worth asserting, and CI
// runs `npm test` before any client build.
const NEEDS_CLIENT_DIST = new Set(['verify-cache-headers.js']);
const hasClientDist = () => fs.existsSync(path.join(ROOT, 'client', 'dist', 'assets'));

export function listVerifyScripts() {
  return fs.readdirSync(SCRIPTS)
    .filter((name) => /^verify-.*\.js$/.test(name))
    .sort();
}

// Registers one script as a node:test case. Every child is spawned with
// ANTHROPIC_API_KEY stripped — see runScript.js for why.
export function registerScript(name, { timeoutMs = 120_000 } = {}) {
  const excluded = EXCLUDED.get(name);
  if (excluded) {
    it(`${name} [excluded]`, { skip: excluded }, () => {});
    return;
  }
  if (NEEDS_CLIENT_DIST.has(name) && !hasClientDist()) {
    it(`${name} [no client/dist]`, { skip: 'needs a built client — run `npm run build:client` first' }, () => {});
    return;
  }
  it(name, async () => {
    assertPassed(assert, `scripts/${name}`, await runScript(path.join(SCRIPTS, name), {
      isolateCwd: true,
      timeoutMs,
    }));
  });
}

// Both runners open with this, so a rename or a deleted script is caught as a
// failure rather than as a silently smaller suite.
export function assertDiscovery(files, { minimum }) {
  describe('discovery', () => {
    it(`finds at least ${minimum} verify script(s)`, () => {
      assert.ok(files.length >= minimum, `only found ${files.length}: ${files.join(', ')}`);
    });
  });
}
