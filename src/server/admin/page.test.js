// src/server/admin/page.test.js — ADMIN-1 job 4
//
// The page is one static file with no build step, so the things that can break
// it are not the things a component test catches: a missing element id, a
// fetch that puts the key in the URL, a cache header that lets a stale floor
// sit in a proxy. This suite asserts on the served bytes and on the contract
// between the page and the three endpoints it reads.
//
// What it deliberately does NOT do is render it — that is what the Playwright
// screenshots at 390 and 1440 are for, and they are not a CI gate.

// TEST-2: a suite whose result depends on the developer's shell is not a test.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.ADMIN_KEY;

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

import { installAdminRoutes } from './index.js';
import { ADMIN_HEADER } from './key.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HTML = fs.readFileSync(path.join(HERE, 'page.html'), 'utf8');

const started = [];
after(() => { for (const s of started) s.close(); });

async function open() {
  const app = express();
  app.use(express.json());
  installAdminRoutes(app);
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  started.push(server);
  const port = server.address().port;
  return (p, headers = {}) => fetch(`http://127.0.0.1:${port}${p}`, { headers });
}

// ── Serving ──────────────────────────────────────────────────────────────────

test('ADMIN-1: with no ADMIN_KEY there is no page either', async () => {
  delete process.env.ADMIN_KEY;
  const get = await open();
  assert.equal((await get('/admin')).status, 404,
    'a deployment with no dashboard does not serve a login box for a door that is not there');
});

test('ADMIN-1: /admin is served, and it is never cached', async () => {
  process.env.ADMIN_KEY = 'page-key';
  try {
    const get = await open();
    const res = await get('/admin');
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('cache-control'), 'no-store',
      'a cached admin page shows last hour’s floor to somebody deciding about this one');
    assert.ok((res.headers.get('content-type') || '').includes('text/html'));
    const body = await res.text();
    assert.ok(body.includes('<title>Railbird · admin</title>'));
    assert.ok(body.includes('id="gateForm"'), 'the login form is what an unauthenticated visitor gets');
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

test('ADMIN-1: the page itself needs no key — every number behind it does', async () => {
  process.env.ADMIN_KEY = 'page-key';
  try {
    const get = await open();
    assert.equal((await get('/admin')).status, 200, 'the form renders without one');
    assert.equal((await get('/api/admin/stats')).status, 403, 'the data does not');
    assert.equal((await get('/api/admin/owners')).status, 403);
    assert.equal((await get('/api/admin/agents/recent')).status, 403);
  } finally {
    delete process.env.ADMIN_KEY;
  }
});

// ── What the file must contain ───────────────────────────────────────────────

test('ADMIN-1: the key travels in a header and is never built into a URL', () => {
  assert.ok(HTML.includes("'x-admin-key': state.key"), 'the fetch sends the header');
  assert.equal(/[?&]key=/.test(HTML), false, 'nothing on this page ever puts the key in a query string');
  assert.ok(HTML.includes('sessionStorage'), 'the key is kept for the tab');
  // The word appears in the comment explaining why it is not used; what must
  // not appear is a call on it.
  assert.equal(/localStorage\s*\./.test(HTML), false,
    'localStorage outlives the tab, and an admin key must not');
});

test('ADMIN-1: no build step and no framework — one file, inline', () => {
  const scripts = HTML.match(/<script[^>]*src=/g) || [];
  assert.deepEqual(scripts, [], 'no external script may be loaded — this page has to work the day the build is broken');
  const styles = HTML.match(/<link[^>]+rel="stylesheet"[^>]*>/g) || [];
  assert.equal(styles.length, 1, 'exactly one stylesheet link, and it is the font');
  assert.ok(styles[0].includes('fonts.googleapis.com'), 'the one link is JetBrains Mono');
  assert.ok(HTML.includes("'JetBrains Mono', ui-monospace"),
    'and it falls back to a real mono stack, so the page reads when the font does not load');
});

test('ADMIN-1: the sparkline is inline SVG, drawn by hand', () => {
  assert.ok(HTML.includes("createElementNS('http://www.w3.org/2000/svg'"));
  assert.equal(/d3|chart\.js|recharts/i.test(HTML), false, 'no chart library');
});

test('ADMIN-1: it refreshes itself once a minute', () => {
  assert.ok(/REFRESH_MS\s*=\s*60000/.test(HTML));
  assert.ok(HTML.includes('setInterval(load, REFRESH_MS)'));
});

test('ADMIN-1: every element the script reaches for exists in the markup', () => {
  const wanted = new Set();
  for (const m of HTML.matchAll(/getElementById\('([^']+)'\)/g)) wanted.add(m[1]);
  assert.ok(wanted.size >= 10, `expected the page to be wired, found ${wanted.size} ids`);
  for (const id of wanted) {
    assert.ok(HTML.includes(`id="${id}"`), `the script reaches for #${id} and the markup has no such element`);
  }
});

test('ADMIN-1: the definition from the server becomes the tile’s hover title', () => {
  assert.ok(HTML.includes("title: label.toUpperCase() + '\\n\\n' + stat.definition"),
    'the whole promise of the page is that nothing on it is a mystery');
});

test('ADMIN-1: it renders at 390 and at 1440', () => {
  assert.ok(HTML.includes('name="viewport"'));
  assert.ok(/@media \(max-width: 430px\)/.test(HTML), 'a phone breakpoint');
  assert.ok(/@media \(min-width: 1100px\)/.test(HTML), 'and a desktop one');
  assert.ok(HTML.includes('minmax(158px, 1fr)'), 'the tiles reflow rather than being laid out at a fixed count');
  assert.ok(HTML.includes('overflow-x: auto'), 'and a wide table scrolls inside itself, never the page');
});

test('ADMIN-1: the problems strip is drawn from the server’s list, not recomputed', () => {
  assert.ok(HTML.includes('problems(s.problems)'),
    '"is anything wrong" has one definition, and it is the server’s');
});

test('ADMIN-1: every section the queue asked for is on the page, in order', () => {
  const order = ['Owners', 'Agents', 'Play', 'Money (chips)', 'Model', 'Notifications', 'System'];
  let at = -1;
  for (const name of order) {
    const next = HTML.indexOf(`section('${name}'`);
    assert.ok(next > -1, `no ${name} section`);
    assert.ok(next > at, `${name} is out of order`);
    at = next;
  }
  assert.ok(HTML.includes('id="cohorts"'), 'the cohort table');
  assert.ok(HTML.includes('id="owners"'), 'the owners table');
  assert.ok(HTML.includes('id="births"'), 'recent births');
  assert.ok(HTML.includes('id="moreOwners"'), 'and the "more" control on the owners table');
});

test('ADMIN-1: the 24h/7d toggle switches the window it asks tiles for', () => {
  assert.ok(HTML.includes("state.window === '7d'"));
  assert.ok(HTML.includes("[['w24', '24h'], ['w7d', '7d']]"),
    'both buttons are wired to ids that exist — the ids are asserted above');
});
