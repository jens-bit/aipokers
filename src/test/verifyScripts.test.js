// src/test/verifyScripts.test.js — TEST-1
//
// scripts/verify-*.js are the real regression suites for the server: they
// exercise the house cast, matchmaking, the flagged-hand classifier, the
// notification budget, table talk, the personality layer, multi-seat tables,
// server-side life, the watch payloads and the cache headers. Until now none
// of them ran unless someone remembered to type the filename.
//
// Discovery again: every scripts/verify-*.js is picked up automatically. A
// script is only left out by naming it in EXCLUDED with a reason — the two
// entries below are there because they cannot pass on a clean checkout, not
// because they are slow.
//
// Every script runs in a scratch cwd. Persistence in src/server resolves from
// process.cwd(), so this is what stops the E2E suites from writing test agents
// into the developer's own data/agents.json (they did, until this landed).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { ROOT, runScript, assertPassed } from './helpers/runScript.js';

const SCRIPTS = path.join(ROOT, 'scripts');

const EXCLUDED = new Map([
  // Asserts every stored bankroll against its own ledger in data/agents.json.
  // data/ is gitignored, so on CI there is no file to check and on a laptop it
  // checks whatever that machine happens to hold. That makes it an operational
  // data check, not a regression test — `npm run test:data`.
  ['verify-chips.js', 'asserts against the machine\'s live data/agents.json (gitignored, absent on CI) — run `npm run test:data`'],
]);

// Needs a built client to serve. Skipped rather than excluded: when
// client/dist exists the cache-header contract is worth asserting, and CI
// runs `npm test` before any client build.
const NEEDS_CLIENT_DIST = new Set(['verify-cache-headers.js']);
const hasClientDist = fs.existsSync(path.join(ROOT, 'client', 'dist', 'assets'));

// Boot a real server, deploy agents and play hands. Correct offline (the agent
// handler falls back to check/fold with no API key) but they run for tens of
// seconds, so they are paced two at a time rather than four.
const E2E = new Set([
  'verify-personality-layer.js',
  'verify-multi-seat.js',
  'verify-server-life.js',
  'verify-watch-v2.js',
]);

const files = fs.readdirSync(SCRIPTS)
  .filter((name) => /^verify-.*\.js$/.test(name))
  .sort();

function register(name) {
  const excluded = EXCLUDED.get(name);
  if (excluded) {
    it(`${name} [excluded]`, { skip: excluded }, () => {});
    return;
  }
  if (NEEDS_CLIENT_DIST.has(name) && !hasClientDist) {
    it(`${name} [no client/dist]`, { skip: 'needs a built client — run `npm run build:client` first' }, () => {});
    return;
  }
  it(name, async () => {
    assertPassed(assert, `scripts/${name}`, await runScript(path.join(SCRIPTS, name), {
      isolateCwd: true,
      timeoutMs: 120_000,
    }));
  });
}

describe('scripts/verify-*.js', () => {
  it('discovers the verify scripts', () => {
    assert.ok(files.length >= 8, `only found ${files.length} verify scripts: ${files.join(', ')}`);
  });

  describe('pure + single-boot', { concurrency: 4 }, () => {
    for (const name of files.filter((n) => !E2E.has(n))) register(name);
  });

  // Each of these boots its own server and plays real hands; two at a time
  // keeps the suite inside its time budget without starving them of CPU.
  describe('end-to-end', { concurrency: 2 }, () => {
    for (const name of files.filter((n) => E2E.has(n))) register(name);
  });
});
