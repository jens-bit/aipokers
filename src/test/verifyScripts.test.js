// src/test/verifyScripts.test.js — TEST-1, split in TEST-2
//
// The fast half of scripts/verify-*.js: pure-function suites (house cast,
// matchmaking, flagged-hand classifier, notification budget, table talk,
// attributes) plus the one that boots a server briefly to read cache headers.
// This runs in `npm test`, which has to stay under 15s so that running it
// before every commit is never a chore.
//
// The suites that boot a server and play hands to completion live in
// src/test/e2e.test.js (`npm run test:e2e`, required before merging to main).
//
// Discovery, not a list: every scripts/verify-*.js is picked up here unless
// verifyGroups.js names it as E2E or EXCLUDED, with a reason.

import { describe } from 'node:test';

import { E2E, assertDiscovery, listVerifyScripts, registerScript } from './helpers/verifyGroups.js';

const files = listVerifyScripts();
const fast = files.filter((name) => !E2E.has(name));

assertDiscovery(files, { minimum: 8 });

describe('scripts/verify-*.js — fast', { concurrency: 4 }, () => {
  for (const name of fast) registerScript(name, { timeoutMs: 60_000 });
});
