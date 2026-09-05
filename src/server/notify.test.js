// src/server/notify.test.js — NOTIFY-1
//
// The budget is the design, so the budget is what gets asserted. Four suites,
// one per rule the ref board makes checkable: the ladder, the daily cap, the
// quiet window, and the mute.
//
// The bot is a fake that records what it was handed. The store is the REAL
// SQLite store — this file is spawned in a scratch cwd by
// src/test/helpers/runScript.js, so `data/app.db` is a throwaway, and running
// against the real thing means the notifications table is under test too.
//
// The clock is injected. Nothing here waits on wall-clock time; `_flushNow`
// runs the flush a timer would have run.

// TEST-2: a suite whose result depends on the developer's shell is not a test.
// auth.js reads these at call time, so a laptop with a bot token exported would
// 401 the mute route here and pass in CI. They are gone before anything loads.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
delete process.env.NOTIFY_TZ_OFFSET_MIN;

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import { attachNotify, detachNotify, notifyEvent, _flushNow, LADDER, BUDGET } from './notify.js';
import { listNotificationHolds, saveProfile } from './store.js';

// ── The fake bot ─────────────────────────────────────────────────────────────

function fakeBot() {
  const sent = [];
  return {
    sent,
    async sendMessage(chatId, text, opts = {}) {
      sent.push({ chatId, text, opts });
      return true;
    },
  };
}

// ── Clock ────────────────────────────────────────────────────────────────────
// Owner-local is UTC+2 in every test, which is the documented default. A local
// hour is therefore UTC hour + 2.

const TZ = 120;
const utc = (day, h, m = 0) => Date.UTC(2026, 8, day, h, m, 0, 0); // September 2026
const localAt = (day, h, m = 0) => utc(day, h - 2, m);             // the same instant, named in local time

let clock = localAt(2, 10, 0);
let bot;

function attach({ muted = () => false } = {}) {
  bot = fakeBot();
  return attachNotify({
    bot,
    now: () => clock,
    tzOffsetFor: () => TZ,
    muted,
  });
}

const types = () => bot.sent.map((s) => s.text);

after(() => detachNotify());

// ── 1. The ladder ────────────────────────────────────────────────────────────
//
// Four events qualify overnight, the window opens, and three slots exist.
// The order out is the ladder's, not the order in — and the one that loses is
// the bottom rung, dropped rather than queued to tomorrow.

test('the ladder decides the order, and the bottom rung is the one dropped', async () => {
  const owner = 'ladder-owner';
  clock = localAt(2, 23, 30);   // inside the quiet window
  attach();

  // Deliberately emitted bottom-up, so passing cannot be an accident of order.
  await notifyEvent('biggest_pot',   { ownerId: owner, agentId: 'a1', agentName: 'Grinder', pot: 840, handNumber: 37 });
  await notifyEvent('tilted',        { ownerId: owner, agentId: 'a1', agentName: 'Grinder', heat: 74, cause: 'two rivers as favourite' });
  await notifyEvent('busted',        { ownerId: owner, agentId: 'a2', agentName: 'Value Bot', buyIn: 2000, hands: 61, endedAt: clock });
  await notifyEvent('session_ended', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', opener: 'Long one. I sat out.', pnl: 340, hands: 38, endedAt: clock });

  assert.equal(bot.sent.length, 0, 'nothing sends inside the quiet window');
  assert.equal(listNotificationHolds(owner).length, 4, 'all four are held, not cancelled');

  // The window opens. One goes; the rest re-hold on the 30-minute gap.
  clock = localAt(3, 8, 0);
  await _flushNow(owner);
  assert.equal(bot.sent.length, 1);

  clock = localAt(3, 8, 30);
  await _flushNow(owner);
  clock = localAt(3, 9, 0);
  await _flushNow(owner);
  clock = localAt(3, 9, 30);
  await _flushNow(owner);

  assert.equal(bot.sent.length, 3, 'three a day, and the fourth is not a fourth message');
  assert.match(types()[0], /Long one\. I sat out\./, 'the recap wins every tie');
  assert.match(types()[1], /Value Bot/,               'the bust is second');
  assert.match(types()[2], /tilted|steaming|gone quiet/, 'tilt is third');
  assert.ok(!types().some((t) => /biggest pot/i.test(t)), 'the biggest pot is the rung that loses');
  assert.equal(listNotificationHolds(owner).length, 0, 'a budget loss is dropped, never queued to tomorrow');

  detachNotify();
});

// The ladder is a stated order, not an emergent one. If someone renumbers it,
// the assertions above stop meaning what they say — so the numbers are asserted.
test('the recap outranks every other rung', () => {
  assert.equal(LADDER.session_ended, 1);
  assert.ok(LADDER.busted > LADDER.session_ended);
  assert.ok(LADDER.tilted > LADDER.busted);
  assert.ok(LADDER.biggest_pot > LADDER.tilted);
});

// ── 2. The budget ────────────────────────────────────────────────────────────

test('three per owner per day, and never two inside thirty minutes', async () => {
  const owner = 'budget-owner';
  clock = localAt(4, 10, 0);
  attach();

  const pot = (n) => notifyEvent('biggest_pot', {
    ownerId: owner, agentId: 'a1', agentName: 'Grinder', pot: 100 * n, handNumber: n,
  });

  await pot(1);
  assert.equal(bot.sent.length, 1);

  // Ten minutes later: inside the gap, so it waits rather than jumping the queue.
  clock = localAt(4, 10, 10);
  await pot(2);
  assert.equal(bot.sent.length, 1, 'two inside thirty minutes is a burst, cap or no cap');
  assert.equal(listNotificationHolds(owner).length, 1);

  clock = localAt(4, 10, 30);
  await _flushNow(owner);
  assert.equal(bot.sent.length, 2, 'the gap is a delay, not a drop');

  clock = localAt(4, 12, 0);
  await pot(3);
  assert.equal(bot.sent.length, 3);

  // Fourth of the day, well clear of the gap: this one is gone.
  clock = localAt(4, 14, 0);
  await pot(4);
  assert.equal(bot.sent.length, 3, `${BUDGET.maxPerDay} is the cap`);
  assert.equal(listNotificationHolds(owner).length, 0, 'over budget is dropped, not held');

  // The cap is per local day, so the next morning starts clean.
  clock = localAt(5, 9, 0);
  await pot(5);
  assert.equal(bot.sent.length, 4, 'a new local day is a new budget');

  detachNotify();
});

// ── 3. Quiet hours ───────────────────────────────────────────────────────────
//
// 23:00–08:00 owner-local holds. The message that finally arrives still names
// the time it describes — which is why an eight-hour delay does not read as a
// bug to the person receiving it.

test('quiet hours hold rather than cancel, and the message still names its cause', async () => {
  const owner = 'quiet-owner';
  const endedAt = localAt(6, 2, 14);   // 02:14 local — deep inside the window
  clock = endedAt;
  attach();

  await notifyEvent('session_ended', {
    ownerId: owner, agentId: 'a1', agentName: 'Grinder',
    opener: 'Rough deck. Want to go through it?', pnl: 340, hands: 38, endedAt,
  });

  assert.equal(bot.sent.length, 0);
  const holds = listNotificationHolds(owner);
  assert.equal(holds.length, 1);
  assert.equal(holds[0].deliverAt, localAt(6, 8, 0), 'held until the window opens at 08:00 local');

  clock = localAt(6, 8, 0);
  await _flushNow(owner);

  assert.equal(bot.sent.length, 1);
  const msg = bot.sent[0];
  assert.match(msg.text, /Rough deck\. Want to go through it\?/, 'the opener is the message text');
  assert.match(msg.text, /02:14/, 'it describes 02:14 and says so');
  assert.match(msg.text, /\$340/, 'and names the number');
  assert.equal(msg.chatId, owner);

  // A recap has a decision behind it, so it carries exactly one button, and the
  // button deep-links to this agent's thread rather than the home screen.
  const rows = msg.opts.reply_markup?.inline_keyboard;
  assert.equal(rows?.length, 1);
  assert.equal(rows[0].length, 1);
  assert.match(rows[0][0].url, /startapp=agent_a1$/);

  detachNotify();
});

test('23:00 is inside the window and 22:59 is not', async () => {
  const owner = 'edge-owner';
  clock = localAt(7, 22, 59);
  attach();
  await notifyEvent('tilted', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', heat: 74, cause: null });
  assert.equal(bot.sent.length, 1, '22:59 local is still open');

  clock = localAt(7, 23, 0);
  await notifyEvent('busted', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', buyIn: 2000, hands: 12, endedAt: clock });
  assert.equal(bot.sent.length, 1, '23:00 local is shut');
  assert.equal(listNotificationHolds(owner).length, 1);

  detachNotify();
});

// A ping with no button must not carry one — a flavour message with a
// call-to-action is a growth mechanic in costume, which the ref board forbids.
test('tilt and the biggest pot carry no button', async () => {
  const owner = 'nobutton-owner';
  clock = localAt(8, 10, 0);
  attach();

  await notifyEvent('tilted', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', heat: 74, cause: 'two rivers as favourite' });
  clock = localAt(8, 11, 0);
  await notifyEvent('biggest_pot', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', pot: 840, handNumber: 37 });

  // Filtered by owner: attaching also flushes whatever the previous test left
  // held, which is the restart behaviour asserted below.
  const mine = bot.sent.filter((s) => s.chatId === owner);
  assert.equal(mine.length, 2);
  for (const s of mine) assert.equal(s.opts.reply_markup, undefined);

  detachNotify();
});

// Held, not cancelled, survives a restart: a hold written before the process
// went down is flushed by the next attachNotify rather than sitting there
// forever waiting on a timer that died with it.
test('attaching flushes a hold left behind by a previous process', async () => {
  const owner = 'restart-owner';
  clock = localAt(11, 23, 30);
  attach();
  await notifyEvent('tilted', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', heat: 74, cause: null });
  assert.equal(listNotificationHolds(owner).length, 1);
  detachNotify();               // the process goes away, timer and all

  clock = localAt(12, 9, 0);    // it comes back the next morning
  attach();
  await new Promise((r) => setImmediate(r));
  await _flushNow(owner);
  assert.equal(bot.sent.filter((s) => s.chatId === owner).length, 1);
  assert.equal(listNotificationHolds(owner).length, 0);

  detachNotify();
});

// ── 4. Mute ──────────────────────────────────────────────────────────────────

test('a muted agent sends nothing and spends nothing', async () => {
  const owner = 'mute-owner';
  clock = localAt(9, 10, 0);
  attach({ muted: (agentId) => agentId === 'quiet-one' });

  await notifyEvent('busted', { ownerId: owner, agentId: 'quiet-one', agentName: 'Grinder', buyIn: 2000, hands: 12, endedAt: clock });
  assert.equal(bot.sent.length, 0, 'muted means silent');
  assert.equal(listNotificationHolds(owner).length, 0, 'and leaves nothing behind to flush later');

  // Muting one agent must not cost his stablemates their budget.
  await notifyEvent('busted', { ownerId: owner, agentId: 'loud-one', agentName: 'Value Bot', buyIn: 2000, hands: 12, endedAt: clock });
  assert.equal(bot.sent.length, 1);

  detachNotify();
});

// ── The mute route ───────────────────────────────────────────────────────────
//
// POST /api/agents/:agentId/notify. Seeded through the store rather than
// through the creation chat, because that path costs a model call and this
// route does not care how the agent came to exist.

async function withRouteServer(fn) {
  saveProfile('route-owner', { agents: [{ id: 'agent-1', name: 'Grinder' }], chat: [] });

  const app = express();
  app.use(express.json());
  clock = localAt(10, 10, 0);
  bot = fakeBot();
  attachNotify({ bot, app, now: () => clock, tzOffsetFor: () => TZ });   // real mute lookup

  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;

  const post = (agentId, body) => fetch(`${base}/api/agents/${agentId}/notify?userId=route-owner`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(async (res) => ({ status: res.status, body: await res.json() }));

  try {
    await fn(post);
  } finally {
    detachNotify();
    await new Promise((r) => server.close(r));
  }
}

test('POST /api/agents/:id/notify toggles the mute, and the notifier obeys it', async () => {
  await withRouteServer(async (post) => {
    const on = await post('agent-1', { muted: true });
    assert.equal(on.status, 200);
    assert.equal(on.body.muted, true);

    await notifyEvent('busted', { ownerId: 'route-owner', agentId: 'agent-1', agentName: 'Grinder', buyIn: 2000, hands: 12, endedAt: clock });
    assert.equal(bot.sent.length, 0, 'the route and the notifier read the same flag');

    const off = await post('agent-1', { muted: false });
    assert.equal(off.status, 200);
    assert.equal(off.body.muted, false);

    await notifyEvent('busted', { ownerId: 'route-owner', agentId: 'agent-1', agentName: 'Grinder', buyIn: 2000, hands: 12, endedAt: clock });
    assert.equal(bot.sent.length, 1, 'unmuting is heard immediately');
  });
});

test('the mute route rejects a missing agent and a non-boolean', async () => {
  await withRouteServer(async (post) => {
    assert.equal((await post('nope', { muted: true })).status, 404);
    assert.equal((await post('agent-1', { muted: 'yes' })).status, 400);
    assert.equal((await post('agent-1', {})).status, 400);
  });
});
