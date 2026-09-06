// scripts/stress-suites.js — BUG-34
//
// The reproduction harness for the intermittent Windows death.
//
// `npm test` spawns every src/**/*.test.js as its own process, four at a time
// (legacy.test.js, concurrency: 4). Roughly one full test:all run in five came
// back with a child that had exited 3221226505 — STATUS_STACK_BUFFER_OVERRUN,
// the code Windows raises for __fastfail — which is a native abort, not an
// assertion. One run in five is too slow a signal to debug against.
//
// This does exactly what legacy.test.js does and nothing else — same spawn,
// same scratch cwd, same stripped environment, via the same runScript helper —
// but in a loop, so a one-in-N crash shows up in minutes rather than hours.
// It records every non-zero exit with its code and the child's own output.
//
// Not a test. Nothing runs this automatically; it is the tool the bug was
// found with, kept because a flake that comes back needs it again.
//
//   node scripts/stress-suites.js [rounds] [concurrency]
//   node scripts/stress-suites.js 20 4          # the default shape
//   node scripts/stress-suites.js 40 8          # more contention
//
// It covers everything `npm test` spawns: the src/**/*.test.js suites AND the
// fast scripts/verify-*.js group, which is the other half of that command and
// the half that boots servers.

import fs from 'node:fs';
import path from 'node:path';

import { ROOT, runScript } from '../src/test/helpers/runScript.js';
import { E2E, EXCLUDED, SCRIPTS, listVerifyScripts } from '../src/test/helpers/verifyGroups.js';

const rounds = Number(process.argv[2] ?? 20);
const concurrency = Number(process.argv[3] ?? 4);

const SRC = path.join(ROOT, 'src');
const SELF_DIR = path.join(SRC, 'test');
// Needs a real key and a real model — never spawned by `npm test` either.
const LIVE = new Set(['server/agentChat.test.js']);

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

const rel = (f) => path.relative(ROOT, f).split(path.sep).join('/');
const files = [
  ...findTestFiles(SRC).sort()
    .filter((f) => !LIVE.has(path.relative(SRC, f).split(path.sep).join('/'))),
  ...listVerifyScripts()
    .filter((name) => !E2E.has(name) && !EXCLUDED.has(name))
    .map((name) => path.join(SCRIPTS, name)),
];

console.log(`[stress] ${files.length} suite(s) × ${rounds} round(s), ${concurrency} at a time`);

let runs = 0;
const failures = [];

// The same pool shape node:test's `concurrency` gives it: N in flight, a new
// one started as each finishes.
async function pool(tasks, width) {
  let next = 0;
  const workers = Array.from({ length: width }, async () => {
    while (next < tasks.length) {
      const task = tasks[next++];
      await task();
    }
  });
  await Promise.all(workers);
}

for (let round = 1; round <= rounds; round++) {
  const tasks = files.map((file) => async () => {
    const result = await runScript(file, { isolateCwd: true, timeoutMs: 90_000 });
    runs++;
    if (result.code !== 0) {
      failures.push({ round, suite: rel(file), code: result.code, ms: result.ms, output: result.output });
      console.error(`  FAIL round ${round}  ${rel(file)}  exit ${result.code}  (${result.ms}ms)`);
    }
  });
  await pool(tasks, concurrency);
  process.stdout.write(`  round ${round}/${rounds} done — ${failures.length} failure(s) in ${runs} run(s)\n`);
}

console.log(`\n[stress] ${failures.length} failure(s) in ${runs} spawned run(s)`);
for (const f of failures) {
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`round ${f.round}  ${f.suite}  exit ${f.code}  ${f.ms}ms`);
  console.log(f.output.trimEnd().split('\n').slice(-40).join('\n'));
}
process.exitCode = failures.length === 0 ? 0 : 1;
