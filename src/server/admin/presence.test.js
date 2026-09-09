// src/server/admin/presence.test.js — ADMIN-1 job 1
//
// The one write ADMIN-1 adds to the product, and the two things that have to
// be true of it: it is throttled to one a minute per owner, and it can never
// fail the request it is riding on.
//
// Spawned in a scratch cwd by src/test/helpers/runScript.js, so data/app.db is
// a throwaway and owner_activity is under test too. The clock is injected;
// nothing here waits on wall-clock time.

// TEST-2: a suite whose result depends on the developer's shell is not a test.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.ADMIN_KEY;

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { touch, ownerOf, presenceMiddleware, _resetPresence, TOUCH_EVERY_MS } from './presence.js';
import { readOwnerActivity, adminDb } from '../store.js';

const T0 = Date.UTC(2026, 8, 9, 12, 0, 0);

let seq = 0;
const owner = () => `pres-${++seq}`;

const rowsFor = (id) => readOwnerActivity(id);

// ── The throttle ─────────────────────────────────────────────────────────────

test('ADMIN-1: two requests in one minute make one write', () => {
  _resetPresence();
  const me = owner();

  assert.equal(touch(me, { now: T0 }), true, 'the first is written');
  assert.equal(touch(me, { now: T0 + 30_000 }), false, 'the second, half a minute later, is not');

  const rows = rowsFor(me);
  assert.equal(rows.length, 1, 'one day, one row');
  assert.equal(rows[0].opens, 1, 'and one open — not two');
  assert.equal(rows[0].firstSeen, T0);
  assert.equal(rows[0].lastSeen, T0);
});

test('ADMIN-1: a minute later it writes again, and only last_seen moves', () => {
  _resetPresence();
  const me = owner();

  touch(me, { now: T0 });
  assert.equal(touch(me, { now: T0 + TOUCH_EVERY_MS }), true);

  const rows = rowsFor(me);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].opens, 2);
  assert.equal(rows[0].firstSeen, T0, 'first_seen is written once and never again');
  assert.equal(rows[0].lastSeen, T0 + TOUCH_EVERY_MS);
});

test('ADMIN-1: last_seen never moves backwards', () => {
  _resetPresence();
  const me = owner();

  touch(me, { now: T0 + 5 * TOUCH_EVERY_MS });
  _resetPresence();                       // a restart, and a clock that lies
  touch(me, { now: T0 });

  assert.equal(rowsFor(me)[0].lastSeen, T0 + 5 * TOUCH_EVERY_MS);
});

test('ADMIN-1: a new UTC day is a new row', () => {
  _resetPresence();
  const me = owner();
  const DAY = 24 * 60 * 60 * 1000;

  touch(me, { now: T0 });
  touch(me, { now: T0 + DAY });

  assert.deepEqual(rowsFor(me).map((r) => r.day), ['2026-09-09', '2026-09-10']);
});

test('ADMIN-1: two owners are throttled independently', () => {
  _resetPresence();
  const a = owner();
  const b = owner();

  assert.equal(touch(a, { now: T0 }), true);
  assert.equal(touch(b, { now: T0 }), true, "one owner's poll does not silence another's");
  assert.equal(touch(a, { now: T0 + 1_000 }), false);
});

test('ADMIN-1: nobody is not activity', () => {
  _resetPresence();
  assert.equal(touch(null, { now: T0 }), false);
  assert.equal(touch('', { now: T0 }), false);
  assert.equal(touch(undefined, { now: T0 }), false);
});

// ── Who a request belongs to ─────────────────────────────────────────────────

test('ADMIN-1: keyless, the claimed userId is the owner — the same rule isOwner follows', () => {
  assert.equal(ownerOf({ params: { userId: 'u1' }, headers: {} }), 'u1');
  assert.equal(ownerOf({ query: { userId: 'u2' }, headers: {} }), 'u2');
  assert.equal(ownerOf({ body: { userId: 'u3' }, headers: {} }), 'u3');
  assert.equal(ownerOf({ headers: {} }), null, 'a public route belongs to nobody');
});

test('ADMIN-1: with a bot token, an unverified credential is not an owner', () => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token';
  try {
    assert.equal(ownerOf({ headers: { 'x-telegram-init-data': 'user=%7B%22id%22%3A7%7D&hash=deadbeef' }, query: {} }), null);
    assert.equal(ownerOf({ headers: {}, query: { userId: '7' } }), null,
      'and a query parameter cannot stand in for one on a configured deployment');
  } finally {
    delete process.env.TELEGRAM_BOT_TOKEN;
  }
});

// ── It never fails the request ───────────────────────────────────────────────

test('ADMIN-1: the middleware calls next() even when identifying the owner throws', () => {
  _resetPresence();
  let called = false;
  const hostile = { get headers() { throw new Error('boom'); } };
  presenceMiddleware()(hostile, {}, () => { called = true; });
  assert.equal(called, true);
});

test('ADMIN-1: the middleware records the owner it found', () => {
  _resetPresence();
  const me = owner();
  let called = false;
  presenceMiddleware({ now: () => T0 })({ headers: {}, query: { userId: me } }, {}, () => { called = true; });
  assert.equal(called, true);
  assert.equal(rowsFor(me).length, 1);
});

// ── The shape the dashboard reads ────────────────────────────────────────────

test('ADMIN-1: distinct active owners in a window is one statement', () => {
  _resetPresence();
  const a = owner();
  const b = owner();
  touch(a, { now: T0 });
  touch(b, { now: T0 });

  const n = adminDb()
    .prepare('SELECT COUNT(DISTINCT owner_id) AS n FROM owner_activity WHERE last_seen >= ?')
    .get(T0 - 1).n;
  assert.ok(n >= 2, `expected at least the two just touched, got ${n}`);
});
