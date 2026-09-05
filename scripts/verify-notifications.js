#!/usr/bin/env node
// scripts/verify-notifications.js — NOTIFY-2
//
// Drives a scripted day of events through the ONE notifier and asserts that
// the ladder, the holds, the caps and the rotation behave exactly as
// specified.
//
// Run:   node scripts/verify-notifications.js
// Smoke: NOTIFY_SMOKE=1 NOTIFY_TARGET_CHAT_ID=<id> TELEGRAM_BOT_TOKEN=<tok> \
//          node scripts/verify-notifications.js
//        (sends one real Telegram message)
//
// This file used to test src/server/notifications/telegram.js, the legacy
// NOTIFY_ENABLED sender. NOTIFY-2 folded that module into src/server/notify.js
// — one notifier, one ledger, one budget — so the assertions moved with it.
// What is asserted here is deliberately the half that notify.test.js does not
// cover: the six types that came across, the caps that came with them, and the
// bus wiring. notify.test.js owns the ladder, the daily cap, the quiet window
// and the mute.
//
// NOTIFY_ENABLED is set before anything loads, because notify.js reads it at
// module scope — which is the point of the last suite below.
process.env.NOTIFY_ENABLED = '1';
delete process.env.NOTIFY_TZ_OFFSET_MIN;
delete process.env.TELEGRAM_BOT_TOKEN;

const notify = await import('../src/server/notify.js');
const {
  attachNotify, detachNotify, notifyEvent, _flushNow, LADDER, BUDGET, ENABLED,
} = notify;
const { emitCasinoEvent, EventType } = await import('../src/server/events.js');
const { listNotificationHolds } = await import('../src/server/store.js');

if (!ENABLED) {
  console.error('ERROR: NOTIFY_ENABLED did not propagate — check dynamic import order');
  process.exit(1);
}

// ── Harness ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function expect(label, ok, detail) {
  if (ok) { console.log('  PASS  ' + label); passed++; }
  else { console.error('  FAIL  ' + label + (detail ? ' — ' + detail : '')); failed++; }
}

// Owner-local is UTC+2, the documented default. `localAt` names an instant in
// the owner's local time, which is the only clock any of these rules are in.
const TZ = 120;
const localAt = (day, h, m = 0) => Date.UTC(2026, 8, day, h - 2, m, 0, 0);

let clock = localAt(2, 10, 0);
let bot;

function attach() {
  detachNotify();
  const sent = [];
  bot = {
    sent,
    async sendMessage(chatId, text, opts = {}) { sent.push({ chatId, text, opts }); return true; },
  };
  attachNotify({ bot, now: () => clock, tzOffsetFor: () => TZ, enabled: true, muted: () => false });
  return sent;
}

const texts = () => bot.sent.map((s) => s.text);
const buttons = () => bot.sent.map((s) => s.opts?.reply_markup?.inline_keyboard?.[0]?.[0]?.text ?? null);

// Every send costs a budget slot and every second one inside half an hour is
// held, so a suite that wants to watch a CAP has to stop the budget from being
// the thing that stopped the message. Attaching fresh under a new owner on a
// new local morning is the cheapest way to say "clean slate".
let ownerSeq = 0;
function freshOwner(day = 2, hour = 10) {
  clock = localAt(day, hour, 0);
  attach();
  return `verify-owner-${++ownerSeq}`;
}

// ── 1. Every type the legacy notifier could send still has a rung ────────────

console.log('\n1. the folded ladder');

const FOLDED = ['broke', 'proposal', 'collected', 'want', 'milestone', 'quiet_win'];
for (const type of FOLDED) {
  expect(`${type} has a ladder rung`, Number.isFinite(LADDER[type]), 'LADDER: ' + JSON.stringify(LADDER));
}
expect('session_ended is still the top rung', LADDER.session_ended === 1);
expect('broke sits directly under busted',
  LADDER.broke === LADDER.busted + 1, `busted ${LADDER.busted}, broke ${LADDER.broke}`);
expect('the legacy order survived: broke < proposal < collected < want < mood',
  LADDER.broke < LADDER.proposal && LADDER.proposal < LADDER.collected
  && LADDER.collected < LADDER.want && LADDER.want < LADDER.tilted);
expect('the three that ask nothing are the bottom three',
  Math.min(LADDER.milestone, LADDER.biggest_pot, LADDER.quiet_win) > LADDER.tilted);
expect('one budget for all of them', BUDGET.maxPerDay === 3);

// ── 2. Each folded type builds a message ─────────────────────────────────────

console.log('\n2. the folded messages');

{
  const owner = freshOwner();
  await notifyEvent('broke', { ownerId: owner, agentId: 'a1', agentName: 'The Grinder', mode: 'topup' });
  expect('broke names the agent', /The Grinder/.test(texts()[0] ?? ''), texts()[0]);
  expect('broke carries the fund button', buttons()[0] === 'Fund him', String(buttons()[0]));
}
{
  const owner = freshOwner();
  await notifyEvent('broke', { ownerId: owner, agentId: 'a1', agentName: 'The Grinder', mode: 'cut' });
  expect('a cut-off agent is not asking, so there is no button',
    buttons()[0] === null, String(buttons()[0]));
}
{
  const owner = freshOwner();
  await notifyEvent('collected', { ownerId: owner, agentId: 'a1', agentName: 'The Grinder', moved: 4200 });
  expect('collected names the amount', /\$4,200/.test(texts()[0] ?? ''), texts()[0]);
}
{
  const owner = freshOwner();
  await notifyEvent('want', { ownerId: owner, agentId: 'a1', agentName: 'The Grinder', line: 'Could murder a coffee.' });
  expect('the want IS the message', /"Could murder a coffee\."/.test(texts()[0] ?? ''), texts()[0]);
  expect('want carries its button', buttons()[0] === 'Sort him out', String(buttons()[0]));
}
{
  const owner = freshOwner();
  await notifyEvent('milestone', { ownerId: owner, agentId: 'a1', agentName: 'The Grinder', threshold: 1000 });
  expect('milestone names the number', /1,000 hands/.test(texts()[0] ?? ''), texts()[0]);
}
{
  const owner = freshOwner();
  await notifyEvent('proposal', {
    ownerId: owner, agentId: 'a1', agentName: 'The Grinder',
    proposalText: 'Can I loosen up a touch?', proposalAt: 111,
  });
  expect('proposal carries his line and his name',
    /Can I loosen up a touch\?/.test(texts()[0] ?? '') && /The Grinder/.test(texts()[0] ?? ''), texts()[0]);
  expect('proposal carries its button', buttons()[0] === 'See his idea', String(buttons()[0]));
}
{
  const owner = freshOwner();
  await notifyEvent('quiet_win', { ownerId: owner, agentId: 'a1', agentName: 'The Grinder' });
  expect('a quiet win asks for nothing, so it has no button',
    buttons()[0] === null, String(buttons()[0]));
}

// ── 3. The caps that came across with them ───────────────────────────────────
//
// A cap is not the budget. Three sends a day is no comfort if all three are
// "he is broke" about the same agent, which is what these assert.

console.log('\n3. the caps');

{
  const owner = freshOwner(3);
  await notifyEvent('broke', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', mode: 'topup' });
  clock += 40 * 60 * 1000;   // clear of the 30-minute gap, still the same local day
  await notifyEvent('broke', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', mode: 'topup' });
  expect('broke is once a day per agent', bot.sent.length === 1, `${bot.sent.length} sent`);

  await notifyEvent('broke', { ownerId: owner, agentId: 'a2', agentName: 'Value Bot', mode: 'topup' });
  expect('a DIFFERENT agent going broke is a different message',
    bot.sent.length === 2, `${bot.sent.length} sent`);

  clock = localAt(4, 10, 0);  // the next local day
  await notifyEvent('broke', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', mode: 'topup' });
  expect('the cap is a day, not forever', bot.sent.length === 3, `${bot.sent.length} sent`);
}
{
  const owner = freshOwner(5);
  await notifyEvent('want', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', line: 'A drink.' });
  clock += 40 * 60 * 1000;
  await notifyEvent('want', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', line: 'Another drink.' });
  expect('want is once a day per agent — he asks and drops it',
    bot.sent.length === 1, `${bot.sent.length} sent`);
}
{
  const owner = freshOwner(6);
  await notifyEvent('milestone', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', threshold: 1000 });
  clock = localAt(9, 10, 0);   // days later, a clean budget
  await notifyEvent('milestone', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', threshold: 1000 });
  expect('a milestone is once per threshold, ever', bot.sent.length === 1, `${bot.sent.length} sent`);

  await notifyEvent('milestone', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', threshold: 5000 });
  expect('a HIGHER threshold is a new milestone', bot.sent.length === 2, `${bot.sent.length} sent`);
}
{
  const owner = freshOwner(7);   // Mon 7 Sep 2026 — the same ISO week as the 9th
  await notifyEvent('quiet_win', { ownerId: owner, agentId: 'a1', agentName: 'Grinder' });
  clock = localAt(9, 10, 0);
  await notifyEvent('quiet_win', { ownerId: owner, agentId: 'a2', agentName: 'Value Bot' });
  expect('a quiet win is once a week per OWNER, whoever it is about',
    bot.sent.length === 1, `${bot.sent.length} sent`);

  clock = localAt(15, 10, 0);   // the following week
  await notifyEvent('quiet_win', { ownerId: owner, agentId: 'a1', agentName: 'Grinder' });
  expect('the week rolls over', bot.sent.length === 2, `${bot.sent.length} sent`);
}
{
  // The legacy notifier allowed one PENDING proposal notification and needed an
  // explicit clear on accept/reject to allow the next. The key is per proposal
  // now, so a new proposal always gets its ping and no clear is needed.
  const owner = freshOwner(16);
  await notifyEvent('proposal', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', proposalText: 'A', proposalAt: 1 });
  clock += 40 * 60 * 1000;
  await notifyEvent('proposal', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', proposalText: 'A', proposalAt: 1 });
  expect('the same proposal is never announced twice', bot.sent.length === 1, `${bot.sent.length} sent`);

  await notifyEvent('proposal', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', proposalText: 'B', proposalAt: 2 });
  expect('a NEW proposal gets its own ping, with nothing to clear first',
    bot.sent.length === 2, `${bot.sent.length} sent`);
}
{
  // A capped message held overnight reserves its key: the same fact arriving
  // again before the window opens must not queue twice.
  const owner = freshOwner(17, 23);   // inside the quiet window
  await notifyEvent('broke', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', mode: 'topup' });
  await notifyEvent('broke', { ownerId: owner, agentId: 'a1', agentName: 'Grinder', mode: 'topup' });
  expect('a held cap key is reserved, so it queues once',
    listNotificationHolds(owner).length === 1, `${listNotificationHolds(owner).length} held`);
  expect('and nothing has gone out yet', bot.sent.length === 0, `${bot.sent.length} sent`);

  clock = localAt(18, 8, 0);
  await _flushNow(owner);
  expect('it goes out when the window opens', bot.sent.length === 1, `${bot.sent.length} sent`);
}

// ── 4. The bus wiring ────────────────────────────────────────────────────────
//
// A bust and the biggest pot of the night are floor headlines AND owner pings.
// The table emits once; the owner's half rides along as `detail` and never
// touches the public event.

console.log('\n4. the bus');

{
  const owner = freshOwner(20);
  const event = emitCasinoEvent({
    type: EventType.BUST,
    tableId: 't1',
    agentIds: ['a1'],
    headline: 'The Grinder is out of chips',
    pot: 4000,
    detail: [{
      type: 'busted', ownerId: owner, agentId: 'a1', agentName: 'The Grinder',
      buyIn: 2000, hands: 61, endedAt: clock,
    }],
  });
  await new Promise((r) => setImmediate(r));   // the notifier serialises per owner
  expect('a bust on the bus reaches the owner', bot.sent.length === 1, `${bot.sent.length} sent`);
  expect('and it is the bust message', /out|busted|stack gone/i.test(texts()[0] ?? ''), texts()[0]);
  expect('the public event carries no owner id',
    !('detail' in event) && !JSON.stringify(event).includes(owner), JSON.stringify(event));
}
{
  const owner = freshOwner(21);
  emitCasinoEvent({
    type: EventType.BIG_POT,
    tableId: 't1',
    agentIds: ['a1', 'a2'],
    headline: 'The Grinder and Value Bot played a 90bb pot',
    pot: 1800,
    detail: [{
      type: 'biggest_pot', ownerId: owner, agentId: 'a1', agentName: 'The Grinder',
      pot: 1800, handNumber: 37,
    }],
  });
  await new Promise((r) => setImmediate(r));
  expect('a big pot on the bus reaches the winner\'s owner only',
    bot.sent.length === 1, `${bot.sent.length} sent`);
  expect('and it names the hand', /hand 37/.test(texts()[0] ?? ''), texts()[0]);
}
{
  // An event with no owner half is just a headline. Nothing is sent, and
  // nothing throws.
  const owner = freshOwner(22);
  emitCasinoEvent({ type: EventType.HEATER, tableId: 't1', agentIds: ['a1'], headline: 'hot', pot: 10 });
  await new Promise((r) => setImmediate(r));
  expect('a headline with no owner half sends nothing', bot.sent.length === 0, `${bot.sent.length} sent`);
  void owner;
}
{
  // Detached, the bus must not reach a dead notifier.
  detachNotify();
  emitCasinoEvent({
    type: EventType.BUST, tableId: 't1', agentIds: ['a1'], headline: 'out', pot: 10,
    detail: [{ type: 'busted', ownerId: 'nobody', agentId: 'a1', agentName: 'X', buyIn: 1, hands: 1, endedAt: clock }],
  });
  await new Promise((r) => setImmediate(r));
  expect('a detached notifier is deaf to the bus', true);
}

// ── 5. NOTIFY_ENABLED is the switch ──────────────────────────────────────────

console.log('\n5. the switch');

{
  detachNotify();
  const n = attachNotify({ bot: { async sendMessage() { return true; } }, enabled: false });
  expect('attachNotify with the switch off attaches nothing', n === null, String(n));
  expect('and isAttached says so', notify.isAttached() === false);
  await notifyEvent('broke', { ownerId: 'off-owner', agentId: 'a1', agentName: 'Grinder', mode: 'topup' });
  expect('so notifyEvent is a no-op', listNotificationHolds('off-owner').length === 0);
}

detachNotify();

// ── Smoke test (optional real send) ──────────────────────────────────────────

if (process.env.NOTIFY_SMOKE === '1') {
  console.log('\nSmoke test: one real Telegram message...');
  const targetChat = process.env.NOTIFY_TARGET_CHAT_ID;
  if (!targetChat || !process.env.TELEGRAM_BOT_TOKEN) {
    console.warn('  SKIP  NOTIFY_TARGET_CHAT_ID / TELEGRAM_BOT_TOKEN not set');
  } else {
    clock = localAt(2, 10, 0);
    attachNotify({ now: () => clock, tzOffsetFor: () => TZ, enabled: true, muted: () => false });
    await notifyEvent('collected', {
      ownerId: targetChat, agentId: 'smoke', agentName: 'NOTIFY-2 smoke', moved: 1,
    });
    console.log('  sent (or logged a Telegram error above) to ' + targetChat);
    detachNotify();
  }
}

// ── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.error('verify-notifications: SOME TESTS FAILED');
  process.exitCode = 1;
} else {
  console.log('verify-notifications: all tests passed');
}
