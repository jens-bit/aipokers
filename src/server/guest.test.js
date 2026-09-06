// src/server/guest.test.js — GUEST-1 job 1
//
// The third auth door: a cookie this server minted, standing in for a
// signature Telegram made.
//
// Four things are pinned here and each of them is a way the door could be
// wrong in a way nobody would notice until it mattered:
//
//   1. THE SWITCH IS REAL. With GUEST_ENABLED unset the route 404s, no cookie
//      is read, and `isOwner` behaves exactly as it did before this tree. A
//      feature flag that only hides the button is not a feature flag.
//   2. THE COOKIE IS THE IDENTITY, AND ONLY HIS OWN. A guest asking about
//      another owner's id is refused — including on a keyless dev box, where
//      `isOwner` otherwise returns true for everybody. That last clause is the
//      whole reason the guest branch sits ABOVE the dev-mode return: without
//      it the limits could be walked around by editing a query string.
//   3. FIVE A DAY FROM ONE ADDRESS, AND THE COUNT SURVIVES A RESTART. The cap
//      is rows in a table, not a Map — an in-memory cap is cleared by
//      restarting, which is not a cap.
//   4. A CLAIMED TOKEN IS SPENT. It resolves to nobody, so a stale cookie in
//      an old tab cannot hand back the flat its owner has already moved out of.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ORIGINAL_CWD = process.cwd();
let dir;
let store;
let guest;
let auth;
let server;
let base;

// Every POST below carries its own X-Forwarded-For, because the five-a-day cap
// counts addresses and a file whose tests all share one address is a file whose
// tests fail in the order they were written rather than on what they assert.
let addr = 0;
const freshIp = () => `203.0.113.${(addr++ % 250) + 1}`;

const post = (p, body = null, headers = {}) => fetch(`${base}${p}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-forwarded-for': freshIp(), ...headers },
  body: body === null ? undefined : JSON.stringify(body),
}).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null), setCookie: r.headers.get('set-cookie') }));

const get = (p, headers = {}) => fetch(`${base}${p}`, { headers })
  .then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

/** A fake request carrying one cookie header, for the non-HTTP assertions. */
const withCookie = (value) => ({ headers: { cookie: value } });

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-guest-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);
  delete process.env.TELEGRAM_BOT_TOKEN;
  delete process.env.DEV_API_SECRET;

  auth = await import('./auth.js');
  guest = await import('./guest.js');

  const { default: express } = await import('express');
  const app = express();
  app.use(express.json());
  guest.installGuestRoutes(app);
  // One route that does nothing but report what auth made of the request, so
  // the middleware and the owner check are asserted through the same door a
  // real route uses rather than by calling them with a hand-built object.
  app.get('/probe/:userId', auth.telegramAuthMiddleware, (req, res) => {
    res.json({ owner: auth.isOwner(req, req.params.userId), guest: auth.guestOwnerFrom(req) });
  });

  server = await new Promise((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

beforeEach(() => { process.env.GUEST_ENABLED = '1'; });

after(async () => {
  delete process.env.GUEST_ENABLED;
  if (server) await new Promise((r) => server.close(r));
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// ── The switch ──────────────────────────────────────────────────────────────

test('GUEST-1: off by default — the route 404s and nobody is a guest', async () => {
  delete process.env.GUEST_ENABLED;
  assert.equal(guest.guestsEnabled(), false);

  const made = await post('/api/guest');
  assert.equal(made.status, 404);
  assert.equal(made.body.error, 'guestDisabled');

  // And a cookie minted while it was on resolves to nobody while it is off.
  process.env.GUEST_ENABLED = '1';
  const real = await post('/api/guest');
  delete process.env.GUEST_ENABLED;
  const token = tokenOf(real.setCookie);
  assert.equal(auth.guestOwnerFrom(withCookie(`ap_guest=${token}`)), null);
  assert.equal(guest.isGuestOwner(real.body.ownerId), false);
});

test('GUEST-1: GUEST_ENABLED=1 opens it', () => {
  process.env.GUEST_ENABLED = '1';
  assert.equal(guest.guestsEnabled(), true);
  process.env.GUEST_ENABLED = '0';
  assert.equal(guest.guestsEnabled(), false);
});

// ── The cookie ──────────────────────────────────────────────────────────────

function tokenOf(setCookie) {
  assert.ok(setCookie, 'a Set-Cookie header');
  return guest.parseCookies(String(setCookie).split(';')[0])[guest.GUEST_COOKIE];
}

test('GUEST-1: POST /api/guest mints an owner and an httpOnly cookie', async () => {
  const { status, body, setCookie } = await post('/api/guest');
  assert.equal(status, 200);
  assert.match(body.ownerId, /^g_/);
  assert.equal(body.kind, 'guest');
  assert.equal(body.limits.agents, 1);
  assert.equal(body.limits.sessionsPerDay, 1);
  assert.equal(body.limits.talk, false);
  assert.equal(body.limits.forgottenAfterDays, 30);

  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /SameSite=Lax/);
  assert.match(setCookie, /Path=\//);
  // Thirty days, in seconds.
  assert.match(setCookie, new RegExp(`Max-Age=${30 * 24 * 60 * 60}`));
  // The token in the body is the token in the cookie — the deep link needs it
  // and a page cannot read an httpOnly cookie to build one.
  assert.equal(tokenOf(setCookie), body.token);
});

test('GUEST-1: the token is not derivable from the owner id, and vice versa', async () => {
  const { body } = await post('/api/guest');
  assert.ok(body.token.length >= 40, `token was ${body.token.length} chars`);
  assert.ok(!body.token.includes(body.ownerId.slice(2)));
  assert.ok(!body.ownerId.includes(body.token.slice(0, 8)));
});

test('GUEST-1: parseCookies survives every shape a browser sends', () => {
  assert.deepEqual(guest.parseCookies('a=1; b=2'), { a: '1', b: '2' });
  assert.deepEqual(guest.parseCookies(''), {});
  assert.deepEqual(guest.parseCookies(undefined), {});
  assert.deepEqual(guest.parseCookies('novalue'), {});
  // First wins, so a stale duplicate cannot displace the live one.
  assert.deepEqual(guest.parseCookies('a=1; a=2'), { a: '1' });
  assert.deepEqual(guest.parseCookies('a=%20x%20'), { a: ' x ' });
});

// ── The door ────────────────────────────────────────────────────────────────

test('GUEST-1: the cookie is a credential, and it is only his own', async () => {
  const made = await post('/api/guest');
  const cookie = `${guest.GUEST_COOKIE}=${made.body.token}`;

  const mine = await get(`/probe/${made.body.ownerId}`, { cookie });
  assert.equal(mine.status, 200);
  assert.equal(mine.body.guest, made.body.ownerId);
  assert.equal(mine.body.owner, true);

  // Somebody else's id, on a server with no bot token — where isOwner would
  // otherwise say yes to anybody. This is claim 2, and it is the one that
  // keeps the limits from being a query-string edit away.
  const theirs = await get('/probe/some-other-owner', { cookie });
  assert.equal(theirs.body.owner, false);
});

test('GUEST-1: no cookie leaves both doors exactly as they were', async () => {
  const none = await get('/probe/anybody');
  assert.equal(none.status, 200);
  assert.equal(none.body.guest, null);
  // Keyless dev box: the pre-existing "allow all" is untouched.
  assert.equal(none.body.owner, true);
});

test('GUEST-1: a guest passes the middleware a bot token would 401', async () => {
  const made = await post('/api/guest');
  process.env.TELEGRAM_BOT_TOKEN = 'test-token-not-a-real-one';
  try {
    const blocked = await get('/probe/anybody');
    assert.equal(blocked.status, 401);
    const allowed = await get(`/probe/${made.body.ownerId}`, {
      cookie: `${guest.GUEST_COOKIE}=${made.body.token}`,
    });
    assert.equal(allowed.status, 200);
    assert.equal(allowed.body.owner, true);
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

test('GUEST-1: a garbage cookie is nobody, not an error', async () => {
  const r = await get('/probe/g_nope', { cookie: `${guest.GUEST_COOKIE}=not-a-real-token` });
  assert.equal(r.status, 200);
  assert.equal(r.body.guest, null);
});

test('GUEST-1: a claimed token is spent', async () => {
  const made = await post('/api/guest');
  store.markGuestClaimed(made.body.token, '4242');
  const r = await get(`/probe/${made.body.ownerId}`, {
    cookie: `${guest.GUEST_COOKIE}=${made.body.token}`,
  });
  assert.equal(r.body.guest, null);
});

// ── GET /api/guest/me ───────────────────────────────────────────────────────

test('GUEST-1: /api/guest/me answers who the cookie is, and 404s when it is nobody', async () => {
  const made = await post('/api/guest');
  const me = await get('/api/guest/me', { cookie: `${guest.GUEST_COOKIE}=${made.body.token}` });
  assert.equal(me.status, 200);
  assert.equal(me.body.ownerId, made.body.ownerId);
  assert.equal(me.body.sessionsToday, 0);

  const nobody = await get('/api/guest/me');
  assert.equal(nobody.status, 404);
  assert.equal(nobody.body.error, 'noGuest');
});

// ── The cap ─────────────────────────────────────────────────────────────────

const CAP_IP = '198.51.100.7';

test('GUEST-1: five a day from one address, then 429 guestCap', async () => {
  for (let i = 0; i < guest.GUEST_PER_IP_PER_DAY; i++) {
    const ok = await post('/api/guest', null, { 'x-forwarded-for': CAP_IP });
    assert.equal(ok.status, 200, `guest ${i + 1} of five`);
  }
  const refused = await post('/api/guest', null, { 'x-forwarded-for': CAP_IP });
  assert.equal(refused.status, 429);
  assert.equal(refused.body.error, 'guestCap');
  assert.equal(refused.body.perDay, 5);
  assert.equal(refused.setCookie, null, 'a refused guest gets no cookie');

  // And it is that ADDRESS that is spent, not the route.
  const elsewhere = await post('/api/guest');
  assert.equal(elsewhere.status, 200);
});

test('GUEST-1: the forwarded address is what is counted, not the socket', () => {
  // Claim 3's other half. Every request in this file arrives on 127.0.0.1; if
  // the socket were what counted, the five above would have been spent by the
  // tests before them and CAP_IP would hold nothing.
  assert.equal(store.countGuestsFromIp(CAP_IP, Date.now() - guest.DAY_MS), guest.GUEST_PER_IP_PER_DAY);
  assert.equal(store.countGuestsFromIp('127.0.0.1', Date.now() - guest.DAY_MS), 0);
  assert.equal(guest.clientIp({ headers: { 'x-forwarded-for': '9.9.9.9, 10.0.0.1' } }), '9.9.9.9');
  assert.equal(guest.clientIp({ headers: {}, ip: '127.0.0.1' }), '127.0.0.1');
});

test('GUEST-1: the cap is rows, not memory — it survives a restart', () => {
  // The count the route asks for is a query over the table. Re-opening the
  // handle is as close to a restart as an in-process test gets, and it is
  // exactly the thing an in-memory Map would not survive.
  const before = store.countGuestsFromIp(CAP_IP, Date.now() - guest.DAY_MS);
  assert.equal(before, guest.GUEST_PER_IP_PER_DAY);
  store._closeForTests();
  assert.equal(store.countGuestsFromIp(CAP_IP, Date.now() - guest.DAY_MS), before);
});

test('GUEST-1: yesterday does not count against today', () => {
  const old = Date.now() - 3 * guest.DAY_MS;
  store.insertGuest({ token: 'tok-old', ownerId: 'g_old', ip: '10.0.0.9', now: old });
  assert.equal(store.countGuestsFromIp('10.0.0.9', Date.now() - guest.DAY_MS), 0);
  assert.equal(store.countGuestsFromIp('10.0.0.9', old - 1000), 1);
});
