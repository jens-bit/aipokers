// src/test/e2e.test.js — TEST-2
//
// `npm run test:e2e`. The four suites that boot the real stack, deploy agents
// and play hands to completion: multi-seat tables, the personality layer,
// server-side life, and the watch payloads. Together they take ~40s, which is
// why they are no longer part of `npm test` — a pre-commit gate people skip
// protects nothing.
//
// Required before every merge to main, and run in CI on every push and PR.
//
// Determinism: every child is spawned with ANTHROPIC_API_KEY stripped, and
// each script re-checks that for itself at startup. With a key present the
// agents make real model decisions, the hands differ run to run, and
// verify-multi-seat.js failed intermittently — a flaky test is worse than no
// test, because it teaches people to re-run instead of to look.

import { describe } from 'node:test';

import { E2E, assertDiscovery, listVerifyScripts, registerScript } from './helpers/verifyGroups.js';

const files = listVerifyScripts().filter((name) => E2E.has(name));

assertDiscovery(files, { minimum: E2E.size });

// Two at a time: enough parallelism to keep the wall clock near the slowest
// suite, not so much that four servers starve each other of CPU and trip the
// stall watchdogs on a small CI runner.
describe('scripts/verify-*.js — end-to-end', { concurrency: 2 }, () => {
  for (const name of files) registerScript(name, { timeoutMs: 120_000 });
});
