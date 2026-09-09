// src/server/admin/owners.test.js — ADMIN-1 job 3
//
// The two lists, and the one thing about them that is not a reporting
// question: this is the only surface in the product that shows one owner's
// data to somebody who is not him, so the id is masked and nothing private
// travels. Both are asserted here rather than left to review.

// TEST-2: a suite whose result depends on the developer's shell is not a test.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.ADMIN_KEY;

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import {
  ownerRows, recentBirths, maskOwnerId, OWNER_SORTS, OWNERS_MAX_LIMIT,
} from './owners.js';
import { installAdminRoutes } from './index.js';
import { ADMIN_HEADER } from './key.js';
import { touch, _resetPresence } from './presence.js';
import { FALLBACK_STRATEGIES } from './stats.js';
import { saveProfile, saveWallet, insertGuest, markGuestClaimed, addWatchHand, addModelCall } from '../store.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 8, 9, 12, 30, 0);
const today = new Date(NOW).toISOString().slice(0, 10);

let seq = 0;
const uid = (p) => `${p}-${++seq}`;

// ── Masking ──────────────────────────────────────────────────────────────────

test('ADMIN-1: an owner id is masked to its last four characters, and there is no branch that is not', () => {
  assert.equal(maskOwnerId('123456789'), '…6789');
  assert.equal(maskOwnerId('g_AbCdEfGhIjKl'), '…IjKl', 'a guest id masks the same way as a Telegram one');
  assert.equal(maskOwnerId('99'), '…99', 'a short id is not padded out into something it is not');
  assert.equal(maskOwnerId(null), '…');
});

test('ADMIN-1: no full owner id reaches the owners list', () => {
  const me = `telegram-${uid('long')}-1234567890`;
  saveProfile(me, { userId: me, chat: [{ role: 'user', content: 'a private thing he typed' }], agents: [] });
  saveWallet(me, { balance: 42, earned: 0, ledger: [] });

  const blob = JSON.stringify(ownerRows({ limit: OWNERS_MAX_LIMIT, now: NOW }));
  assert.equal(blob.includes(me), false, 'the whole id must never leave the server');
  assert.equal(blob.includes('a private thing he typed'), false, 'and neither may his creation chat');
  assert.ok(blob.includes('…7890'), 'the masked tail is there so two rows can be told apart');
});

// ── The owner row ────────────────────────────────────────────────────────────

test('ADMIN-1: an owner row carries the eight columns the page renders', () => {
  const me = uid('row');
  saveProfile(me, { userId: me, chat: [], agents: [
    { id: `${me}-a`, name: 'Granite', createdAt: NOW - 3 * DAY, pocket: { balance: 700 } },
    { id: `${me}-b`, name: 'Later', createdAt: NOW - HOUR, pocket: { balance: 300 } },
  ] });
  saveWallet(me, { balance: 2_500, earned: 0, ledger: [] });
  addWatchHand({ day: today, ownerId: me, watched: true, hands: 40 });
  addWatchHand({ day: today, ownerId: me, watched: false, hands: 60 });
  addModelCall({ day: today, ownerId: me, kind: 'decision', model: 'claude-haiku-4-5', calls: 3, usd: 0.25 });
  _resetPresence();
  touch(me, { now: NOW - HOUR });

  const row = ownerRows({ limit: OWNERS_MAX_LIMIT, now: NOW }).find((r) => r.id === maskOwnerId(me));
  assert.ok(row, 'he is in the list');
  assert.equal(row.name, 'Granite', 'the name is his OLDEST agent, the only handle the database holds for him');
  assert.equal(row.agents, 2);
  assert.equal(row.lastSeen, NOW - HOUR);
  assert.equal(row.hands7d, 100, 'watched and unwatched hands are both his hands');
  assert.equal(row.usd7d, 0.25);
  assert.equal(row.chips, 3_500, 'wallet plus every pocket on the roster');
  assert.equal(row.guest, false);
});

test('ADMIN-1: a guest is flagged as one, and stops being one when he claims', () => {
  const guestOwner = `g_${uid('gst')}`;
  const token = uid('tok');
  insertGuest({ token, ownerId: guestOwner, now: NOW });
  saveWallet(guestOwner, { balance: 100, earned: 0, ledger: [] });

  const before = ownerRows({ limit: OWNERS_MAX_LIMIT, now: NOW }).find((r) => r.id === maskOwnerId(guestOwner));
  assert.equal(before.guest, true);
  assert.equal(before.lastSeen, NOW, 'a guest is seen by his own cookie clock, not by presence');

  // Claiming spends the token. The row is KEPT — it is the only record that
  // the two ids were the same person — so "guest" has to mean unclaimed, or
  // every owner who ever arrived through that door stays a guest forever.
  markGuestClaimed(token, uid('tg'), NOW);
  const after = ownerRows({ limit: OWNERS_MAX_LIMIT, now: NOW }).find((r) => r.id === maskOwnerId(guestOwner));
  assert.equal(after.guest, false);
});

test('ADMIN-1: sortable by any column, and an unknown sort is not passed to SQL', () => {
  const rich = uid('sort');
  saveProfile(rich, { userId: rich, chat: [], agents: [] });
  saveWallet(rich, { balance: 9_999_999, earned: 0, ledger: [] });

  for (const key of Object.keys(OWNER_SORTS)) {
    const rows = ownerRows({ sort: key, limit: 10, now: NOW });
    assert.ok(Array.isArray(rows), `sort=${key} did not answer`);
  }
  assert.equal(ownerRows({ sort: 'chips', limit: 1, now: NOW })[0].chips, 9_999_999,
    'sort=chips actually sorts by chips');

  // Rule: the sort never reaches SQL as text the caller wrote.
  const injected = ownerRows({ sort: '1; DROP TABLE agents; --', limit: 5, now: NOW });
  assert.ok(Array.isArray(injected), 'an unknown sort falls back rather than reaching the statement');
});

test('ADMIN-1: limit is clamped at both ends', () => {
  assert.ok(ownerRows({ limit: 0, now: NOW }).length <= OWNERS_MAX_LIMIT);
  assert.ok(ownerRows({ limit: 100_000, now: NOW }).length <= OWNERS_MAX_LIMIT);
  assert.ok(ownerRows({ limit: 'nonsense', now: NOW }).length <= OWNERS_MAX_LIMIT);
});

// ── Recent births ────────────────────────────────────────────────────────────

test('ADMIN-1: recent births are newest first, with the fallback flag and where he is', () => {
  const me = uid('birth');
  saveProfile(me, { userId: me, chat: [], agents: [
    { id: `${me}-fresh`, name: 'Fresh', createdAt: NOW, stats: { handsPlayed: 12 } },
    { id: `${me}-gone`, name: 'Gone', createdAt: NOW - 60_000, archived: true },
    { id: `${me}-out`, name: 'Out', createdAt: NOW - 120_000, visiting: { visitId: 'v1' } },
    { id: `${me}-bad`, name: 'The Grinder', createdAt: NOW - 180_000, strategy: FALLBACK_STRATEGIES[2] },
  ] });

  const rows = recentBirths({ limit: 50 });
  const mine = rows.filter((r) => r.owner === maskOwnerId(me));
  assert.deepEqual(mine.map((r) => r.name), ['Fresh', 'Gone', 'Out', 'The Grinder'], 'newest first');

  assert.equal(mine[0].hands, 12, 'his lifetime hand count comes off agent.stats.handsPlayed');
  assert.equal(mine[0].where, 'home', 'nowhere else, so he is at home');
  assert.equal(mine[1].where, 'retired');
  assert.equal(mine[2].where, 'visiting');
  assert.equal(mine[3].fallback, true, 'BUG-46: the canned strategy is flagged');
  assert.equal(mine[0].fallback, false);
  assert.ok(mine.every((r) => r.owner.startsWith('…')), 'the owner is masked here too');
});

test('ADMIN-1: nothing private travels with a birth', () => {
  const me = uid('priv');
  saveProfile(me, { userId: me, chat: [], agents: [
    { id: `${me}-1`, name: 'Secretive', createdAt: NOW, strategy: 'a bespoke strategy nobody else may read',
      memory: { summary: 'what he thinks about his opponents' }, recentHands: [{ holeCards: ['As', 'Ks'] }] },
  ] });

  const blob = JSON.stringify(recentBirths({ limit: 50 }));
  assert.equal(blob.includes('a bespoke strategy nobody else may read'), false);
  assert.equal(blob.includes('what he thinks about his opponents'), false);
  assert.equal(blob.includes('As'), false, 'and certainly not a hole card');
});

// ── Over the wire ────────────────────────────────────────────────────────────

const started = [];
after(() => { for (const s of started) s.close(); });

async function open() {
  const app = express();
  app.use(express.json());
  installAdminRoutes(app, { now: () => NOW });
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  started.push(server);
  const port = server.address().port;
  return (path, headers = {}) => fetch(`http://127.0.0.1:${port}${path}`, { headers });
}

test('ADMIN-1: both lists are behind ADMIN_KEY and answer with their definition', async () => {
  process.env.ADMIN_KEY = 'list-key';
  try {
    const get = await open();
    const h = { [ADMIN_HEADER]: 'list-key' };

    assert.equal((await get('/api/admin/owners')).status, 403, 'no key, no list');
    assert.equal((await get('/api/admin/agents/recent')).status, 403);

    const owners = await (await get('/api/admin/owners?sort=chips&limit=5', h)).json();
    assert.equal(owners.sort, 'chips');
    assert.ok(owners.sorts.includes('lastSeen'));
    assert.ok(owners.definition.length > 100, 'the list says what its columns mean, like every tile does');
    assert.ok(owners.rows.length <= 5);

    const bad = await (await get('/api/admin/owners?sort=nonsense', h)).json();
    assert.equal(bad.sort, 'lastSeen', 'an unknown sort is reported as the one actually used');

    const births = await (await get('/api/admin/agents/recent', h)).json();
    assert.ok(births.definition.includes('masked'));
    assert.ok(births.rows.length <= 50);
  } finally {
    delete process.env.ADMIN_KEY;
  }
});
