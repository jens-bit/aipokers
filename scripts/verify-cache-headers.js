// scripts/verify-cache-headers.js — CACHE-2
// Boot the server on an ephemeral port and assert Cache-Control headers for
// index.html (no-store) and hashed /assets/* (immutable).
// Run: node scripts/verify-cache-headers.js

import { execSync, spawn } from 'node:child_process';
import fs, { existsSync, readdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'client', 'dist');
const PORT = 18765; // ephemeral port, won't conflict with real server

let passed = 0;
let failed = 0;
let serverProc = null;
let serverCwd = null;

function assert(label, got, expected) {
  if (got === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}

function assertIncludes(label, haystack, needle) {
  const ok = typeof haystack === 'string' && haystack.toLowerCase().includes(needle.toLowerCase());
  if (ok) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — header was: ${JSON.stringify(haystack)}`);
    failed++;
  }
}

if (!existsSync(DIST)) {
  console.error('client/dist not found — run `npm run build` first');
  process.exit(1);
}

// Find a hashed asset file.
const assetsDir = path.join(DIST, 'assets');
const assetFiles = existsSync(assetsDir) ? readdirSync(assetsDir) : [];
const assetFile = assetFiles.find((f) => f.endsWith('.js') || f.endsWith('.css'));
if (!assetFile) {
  console.error('No hashed asset found in client/dist/assets — run `npm run build`');
  process.exit(1);
}

async function fetchHeaders(urlPath) {
  return new Promise((resolve, reject) => {
    const options = { hostname: '127.0.0.1', port: PORT, path: urlPath, method: 'GET' };
    const req = http.request(options, (res) => {
      res.resume(); // drain body
      resolve({ status: res.statusCode, headers: res.headers });
    });
    req.on('error', reject);
    req.end();
  });
}

async function waitForServer(retries = 20) {
  for (let i = 0; i < retries; i++) {
    try {
      await fetchHeaders('/');
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error('Server did not start in time');
}

async function run() {
  console.log(`\nStarting server on port ${PORT}…`);
  // SQLITE-1: the spawned server must NOT run with cwd=ROOT. Persistence
  // resolves data/ from cwd, so booting the real server here wrote into the
  // developer's own data/ — since the store migrates on boot, that renamed
  // their live agents.json. The script path is absolute so module resolution
  // no longer needs cwd, and client/dist still resolves because index.js takes
  // it from __dirname. Scratch dir removed in cleanup(), same as runScript.js.
  serverCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-cache-'));
  serverProc = spawn(
    process.execPath,
    ['--experimental-vm-modules', path.join(ROOT, 'src', 'index.js')],
    {
      cwd: serverCwd,
      env: { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NODE_NO_WARNINGS: '1' },
      stdio: 'pipe',
    }
  );
  serverProc.stderr.on('data', () => {}); // suppress
  serverProc.stdout.on('data', () => {});

  try {
    await waitForServer();
    console.log('Server up.\n');
  } catch (err) {
    console.error('Server failed to start:', err.message);
    serverProc.kill();
    process.exit(1);
  }

  // ── index.html: no-store ────────────────────────────────────────────────────
  console.log('GET /');
  const root = await fetchHeaders('/');
  assert('/ responds 200', root.status, 200);
  assertIncludes('/ Cache-Control is no-store', root.headers['cache-control'] ?? '', 'no-store');

  console.log('\nGET /index.html');
  const indexHtml = await fetchHeaders('/index.html');
  assertIncludes('/index.html Cache-Control is no-store', indexHtml.headers['cache-control'] ?? '', 'no-store');

  // ── /welcome: no-store ──────────────────────────────────────────────────────
  console.log('\nGET /welcome');
  const welcome = await fetchHeaders('/welcome');
  assert('/welcome responds 200 or 304', welcome.status === 200 || welcome.status === 304, true);
  assertIncludes('/welcome Cache-Control is no-store', welcome.headers['cache-control'] ?? '', 'no-store');

  // ── hashed asset: immutable ─────────────────────────────────────────────────
  const assetPath = `/assets/${assetFile}`;
  console.log(`\nGET ${assetPath}`);
  const asset = await fetchHeaders(assetPath);
  assert(`${assetPath} responds 200`, asset.status, 200);
  assertIncludes(`${assetPath} Cache-Control is immutable`,
    asset.headers['cache-control'] ?? '', 'immutable');
  assertIncludes(`${assetPath} Cache-Control has max-age=31536000`,
    asset.headers['cache-control'] ?? '', 'max-age=31536000');
  assertIncludes(`${assetPath} Cache-Control is public`,
    asset.headers['cache-control'] ?? '', 'public');

  // ── Summary ─────────────────────────────────────────────────────────────────
  console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
}

run()
  .catch((err) => { console.error(err); })
  .finally(() => {
    if (serverProc) serverProc.kill();
    if (serverCwd) { try { fs.rmSync(serverCwd, { recursive: true, force: true }); } catch { /* best effort */ } }
    process.exit(failed > 0 ? 1 : 0);
  });
