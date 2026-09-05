// src/test/legacy.test.js — TEST-1
//
// Discovery, not a list. `npm test` used to enumerate six test files by hand
// in package.json, which is why src/agent/reads.test.js and
// src/server/agentChat.test.js were never running. This walks src/ and spawns
// every *.test.js it finds, so a test file is covered the moment it exists.
//
// The suites themselves are untouched: they are plain assertion scripts that
// print their own PASS/FAIL lines and exit non-zero on failure, and running
// them as child processes is what lets this file assert on them without
// rewriting any of them. New tests are written in node:test style
// (node:assert/strict) — those also run correctly as `node <file>`, so they
// need no special handling here.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { ROOT, runScript, assertPassed } from './helpers/runScript.js';

const SRC = path.join(ROOT, 'src');

// Suites that call a real model and therefore cost money and need a key.
// They run under `npm run test:live`, never in `npm test` or CI.
// Key: path relative to src/.
const LIVE = new Map([
  ['server/agentChat.test.js', 'needs ANTHROPIC_API_KEY — real model calls; run `npm run test:live`'],
]);

// Everything under src/test/ is this harness itself.
const SELF_DIR = path.join(SRC, 'test');

function findTestFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (full === SELF_DIR || entry.name === 'node_modules') continue;
      findTestFiles(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
      out.push(full);
    }
  }
  return out;
}

const files = findTestFiles(SRC).sort();

describe('src/**/*.test.js', { concurrency: 4 }, () => {
  it('discovers at least the engine suite', () => {
    const rels = files.map((f) => path.relative(SRC, f).split(path.sep).join('/'));
    assert.ok(rels.includes('engine/game.test.js'), `expected engine/game.test.js among: ${rels.join(', ')}`);
  });

  // CI-1: this file runs as a test-runner child, so NODE_TEST_CONTEXT is set
  // here — and used to be inherited by everything we spawn. A node:test suite
  // that inherits it emits v8-serialized bytes instead of readable output and
  // exited 1 on Node 20 (run #37). The parent still has it; the child must not.
  it('CI-1: spawned children do not inherit the test-runner protocol env', async () => {
    const probe = path.join(os.tmpdir(), `aipoker-ci1-${process.pid}.mjs`);
    fs.writeFileSync(probe, 'console.log(JSON.stringify(process.env.NODE_TEST_CONTEXT ?? null));\n', 'utf8');
    try {
      const result = await runScript(probe, { timeoutMs: 20_000 });
      assert.equal(result.code, 0, result.output);
      assert.equal(result.output.trim(), 'null', `child saw NODE_TEST_CONTEXT=${result.output.trim()}`);
    } finally {
      fs.rmSync(probe, { force: true });
    }
  });

  for (const file of files) {
    const rel = path.relative(SRC, file).split(path.sep).join('/');
    const liveReason = LIVE.get(rel);

    if (liveReason) {
      it(`${rel} [live]`, { skip: liveReason }, () => {});
      continue;
    }

    it(rel, async () => {
      assertPassed(assert, `src/${rel}`, await runScript(file, { isolateCwd: true, timeoutMs: 90_000 }));
    });
  }
});
