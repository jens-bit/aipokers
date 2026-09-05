// src/test/helpers/runScript.js — TEST-1
//
// Spawns a standalone script as its own `node` process and reports whether it
// passed. This is how `npm test` covers the suites that were written as plain
// assertion scripts (they print "ok"/"PASS" lines and exit non-zero on
// failure) without rewriting a single one of them.
//
// Three rules the wrappers depend on:
//   1. cwd is isolatable. Every persistence path in src/server resolves from
//      process.cwd() ('data/agents.json', 'data/notifications.json', …), so
//      running a script from a scratch directory keeps the E2E suites off the
//      developer's real data/ — which they used to write into.
//   2. No live model calls. ANTHROPIC_API_KEY is stripped from every child's
//      environment by default (TEST-2). getAgentAction falls back to a
//      deterministic check/fold without it; with a key the agents play real
//      hands, the hands differ every run, and verify-multi-seat.js failed
//      intermittently on whichever laptop happened to have the key exported.
//      A suite whose result depends on the developer's shell is not a test.
//   3. stdout+stderr are captured and only attached on failure, so a green run
//      stays readable and a red one tells you exactly what broke.

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

// Runs `node <scriptPath>` and resolves { code, output, ms }.
// isolateCwd:     run in a fresh scratch directory (removed afterwards) so the
//                 script's data/ writes never land in the repo.
// allowLiveModel: keep ANTHROPIC_API_KEY in the child's environment. Off by
//                 default and there is currently no caller that turns it on —
//                 anything that genuinely wants a live model belongs in
//                 `npm run test:live`, not in a suite CI runs.
export function runScript(scriptPath, {
  isolateCwd = false,
  timeoutMs = 120_000,
  env = {},
  allowLiveModel = false,
} = {}) {
  const cwd = isolateCwd
    ? fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-test-'))
    : ROOT;

  const childEnv = { ...process.env, NODE_NO_WARNINGS: '1', ...env };
  if (!allowLiveModel) delete childEnv.ANTHROPIC_API_KEY;

  return new Promise((resolve) => {
    const started = Date.now();
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      env: childEnv,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let output = '';
    const collect = (chunk) => { output += chunk; };
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);

    const killer = setTimeout(() => {
      output += `\n[runScript] timed out after ${timeoutMs}ms — killed\n`;
      child.kill('SIGKILL');
    }, timeoutMs);
    killer.unref?.();

    const finish = (code) => {
      clearTimeout(killer);
      if (isolateCwd) { try { fs.rmSync(cwd, { recursive: true, force: true }); } catch { /* best effort */ } }
      resolve({ code, output, ms: Date.now() - started });
    };

    child.on('error', (err) => { output += `\n[runScript] spawn failed: ${err.message}\n`; finish(1); });
    child.on('close', (code) => finish(code ?? 1));
  });
}

// The assertion every wrapper makes: exit code 0, with the script's own output
// attached when it is not.
export function assertPassed(assert, relPath, result) {
  assert.equal(
    result.code,
    0,
    `${relPath} exited ${result.code} (expected 0) after ${result.ms}ms\n` +
    `${'─'.repeat(70)}\n${result.output.trimEnd()}\n${'─'.repeat(70)}`,
  );
}
