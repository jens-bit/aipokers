// scripts/verify-home-routes.js — BUGS-B/3
//
// The living room's two routes, asserted against the REAL server.
//
// src/index.js serves index.html for any unmatched GET, so a GET registered
// after that fallback comes back as the SPA — 200, HTML, and a client that
// quietly decides the room has no thread. GET /api/home/thread is exactly that
// shape, and POST /api/home/say survives only because the fallback answers GET
// alone; both are load bearing and neither was held by anything.
//
// So: boot src/index.js with a built client in place and demand JSON.
//
// Run: node scripts/verify-home-routes.js

import { spawn } from 'node:child_process';
import fs, { existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'client', 'dist');
const PORT = 18771;

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

function request(method, urlPath, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body === null ? null : JSON.stringify(body);
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: urlPath,
        method,
        headers: payload === null ? {} : {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
      },
      (res) => {
        let out = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { out += c; });
        res.on('end', () => resolve({
          status: res.statusCode,
          type: res.headers['content-type'] ?? '',
          cache: res.headers['cache-control'] ?? '',
          body: out,
        }));
      },
    );
    req.on('error', reject);
    if (payload !== null) req.write(payload);
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

const json = (res) => { try { return JSON.parse(res.body); } catch { return null; } };

async function run() {
  console.log(`\nStarting server on port ${PORT}…`);
  // Persistence resolves data/ from cwd, so a server booted at ROOT would
  // write into the developer's own.
  serverCwd = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-home-'));
  // TEST-2: TELEGRAM_BOT_TOKEN is the switch that turns isOwner() from
  // "always true" into a real check, and ANTHROPIC_API_KEY would put a model
  // call on the fan-out. A suite whose result depends on the developer's shell
  // is not a test.
  const env = { ...process.env, PORT: String(PORT), HOST: '127.0.0.1', NODE_NO_WARNINGS: '1' };
  delete env.TELEGRAM_BOT_TOKEN;
  delete env.DEV_API_SECRET;
  delete env.ANTHROPIC_API_KEY;

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

  // The fallback is genuinely in the way — if this is HTML, every assertion
  // below is worth something.
  console.log('GET /some/client/route  (the SPA fallback)');
  const spa = await request('GET', '/some/client/route');
  assert('an unmatched GET is answered with the SPA', spa.type.includes('text/html'), `type was ${spa.type}`);

  console.log('\nGET /api/home/thread');
  const thread = await request('GET', '/api/home/thread?userId=verify-home');
  assert('is JSON, not index.html', thread.type.includes('application/json'), `type was ${thread.type}`);
  const board = json(thread);
  assert('parses as an object', board !== null && typeof board === 'object');
  assert('names the session it read', typeof board?.sessionId === 'string' && board.sessionId.length > 0,
    `sessionId was ${JSON.stringify(board?.sessionId)}`);
  assert('answers with lines, even when there are none', Array.isArray(board?.lines),
    `lines was ${JSON.stringify(board?.lines)}`);
  // A thread the webview caches is a thread that stops updating.
  assert('is never cached', thread.cache.includes('no-store'), `cache-control was "${thread.cache}"`);

  console.log('\nPOST /api/home/say');
  const said = await request('POST', '/api/home/say', { userId: 'verify-home', text: 'Anyone in?' });
  assert('is JSON, not index.html', said.type.includes('application/json'), `type was ${said.type}`);
  assert('the route answered, not the SPA', said.status === 200, `status was ${said.status}`);
  const body = json(said);
  assert('echoes what was said', body?.said === 'Anyone in?', `said was ${JSON.stringify(body?.said)}`);
  assert('reports how many were in', Number.isInteger(body?.home), `home was ${JSON.stringify(body?.home)}`);
  // An owner with no agents has an empty flat. Nobody to answer is not an
  // error — the line is kept and the replies array is empty rather than absent.
  assert('always returns a replies array', Array.isArray(body?.replies),
    `replies was ${JSON.stringify(body?.replies)}`);

  console.log('\nand what was said is STORED');
  const after = json(await request('GET', '/api/home/thread?userId=verify-home'));
  assert('the line came back out of the thread',
    (after?.lines ?? []).some((l) => l.text === 'Anyone in?'),
    JSON.stringify(after?.lines));
  const line = (after?.lines ?? []).find((l) => l.text === 'Anyone in?');
  assert('addressed by the owner, to the room', line?.from === 'owner' && line?.to === 'all',
    `from/to was ${JSON.stringify([line?.from, line?.to])}`);

  console.log('\nan empty message is refused before anything is spent');
  const empty = await request('POST', '/api/home/say', { userId: 'verify-home', text: '   ' });
  assert('400, and still JSON', empty.status === 400 && empty.type.includes('application/json'),
    `status ${empty.status}, type ${empty.type}`);

  console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
}

run()
  .catch((err) => { console.error(err); failed++; })
  .finally(() => {
    if (serverProc) serverProc.kill();
    if (serverCwd) { try { fs.rmSync(serverCwd, { recursive: true, force: true }); } catch { /* best effort */ } }
    process.exit(failed > 0 ? 1 : 0);
  });
