// scripts/verify-deeplink-routes.js — DEEPLINK-1
//
// One trap, asserted against the real server: src/index.js serves index.html
// for any unmatched GET, so a GET registered after that fallback is answered
// with the SPA rather than with JSON. It fails silently — 200, HTML, and a
// client that quietly decides the deployment has no notifier.
//
// The mute route (POST) survived being registered last because the fallback
// only answers GET. The budget board is a GET. So the ordering is now load
// bearing, and this is what holds it: boot the server with a built client in
// place and demand JSON from the routes the Mini App reads.
//
// Run: node scripts/verify-deeplink-routes.js

import { spawn } from 'node:child_process';
import fs, { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'client', 'dist');
const PORT = 18767;

let passed = 0;
let failed = 0;
let serverProc = null;
let serverCwd = null;

function assert(label, ok, detail = '') {
  if (ok) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
  }
}

if (!existsSync(DIST)) {
  console.error('client/dist not found — run `npm run build` first');
  process.exit(1);
}

function request(method, urlPath) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { hostname: '127.0.0.1', port: PORT, path: urlPath, method },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { body += c; });
        res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'] ?? '', body }));
      },
    );
    req.on('error', reject);
    req.end();
  });
}

async function waitForServer(retries = 25) {
  for (let i = 0; i < retries; i++) {
    try { await request('GET', '/'); return; }
    catch { await new Promise((r) => setTimeout(r, 200)); }
  }
  throw new Error('Server did not start in time');
}

async function run() {
  console.log(`\nStarting server on port ${PORT}…`);
  // Same isolation as verify-cache-headers.js: persistence resolves data/ from
  // cwd, so a server booted at ROOT would write into the developer's own.
  serverCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-deeplink-'));
  // TEST-2: a suite whose result depends on the developer's shell is not a
  // test. TELEGRAM_BOT_TOKEN is the switch that turns isOwner() from "always
  // true" into a real check, so a laptop with one exported would get 401/403
  // here and pass in CI. It goes before the child is spawned.
  const env = { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NODE_NO_WARNINGS: '1' };
  delete env.TELEGRAM_BOT_TOKEN;
  delete env.DEV_API_SECRET;

  serverProc = spawn(
    process.execPath,
    [path.join(ROOT, 'src', 'index.js')],
    { cwd: serverCwd, env, stdio: 'pipe' },
  );
  serverProc.stderr.on('data', () => {});
  serverProc.stdout.on('data', () => {});

  try {
    await waitForServer();
    console.log('Server up.\n');
  } catch (err) {
    console.error('Server failed to start:', err.message);
    serverProc.kill();
    process.exit(1);
  }

  // The fallback is genuinely in the way — if this is HTML, the trap is real
  // and every assertion below is worth something.
  console.log('GET /some/client/route  (the SPA fallback)');
  const spa = await request('GET', '/some/client/route');
  assert('an unmatched GET is answered with the SPA', spa.type.includes('text/html'), `type was ${spa.type}`);

  console.log('\nGET /api/notifications/budget');
  const budget = await request('GET', '/api/notifications/budget?userId=verify-owner');
  assert('is JSON, not index.html', budget.type.includes('application/json'), `type was ${budget.type}`);
  let board = null;
  try { board = JSON.parse(budget.body); } catch { /* asserted below */ }
  assert('parses as an object', board !== null && typeof board === 'object');
  assert('reports the cap', board?.max === 3, `max was ${JSON.stringify(board?.max)}`);
  assert('reports what has been spent', board?.used === 0, `used was ${JSON.stringify(board?.used)}`);

  console.log('\nPOST /api/agents/:id/notify');
  const mute = await request('POST', '/api/agents/nobody/notify?userId=verify-owner');
  assert('is JSON, not index.html', mute.type.includes('application/json'), `type was ${mute.type}`);
  // No body, so a 400: what matters is that the ROUTE answered rather than the
  // fallback. A 404 here would mean the request never reached it.
  assert('the route answered, not the SPA', mute.status === 400, `status was ${mute.status}`);

  console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
}

run()
  .catch((err) => { console.error(err); failed++; })
  .finally(() => {
    if (serverProc) serverProc.kill();
    if (serverCwd) { try { fs.rmSync(serverCwd, { recursive: true, force: true }); } catch { /* best effort */ } }
    process.exit(failed > 0 ? 1 : 0);
  });
