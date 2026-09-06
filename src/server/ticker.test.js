// src/server/ticker.test.js — EVENTS-3
//
// The channel's four promises, asserted one suite each: it says the right
// sentence, it never says an owner's name, it obeys the window, and it only
// ever attaches a picture somebody already chose to share.
//
// The bot is a fake that records what it was handed and the clock is injected,
// so nothing here talks to Telegram and nothing waits on wall-clock time.

// TEST-2: a suite whose result depends on the developer's shell is not a test.
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.TICKER_ENABLED;
delete process.env.TICKER_CHANNEL_ID;

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';

import { emitCasinoEvent, EventType, resetEvents, bus } from './events.js';
import {
  attachTicker, detachTicker, tickerLine, inDollars, cardUrlFor, tickerDecide,
  tickerBudget, BUDGET, POSTED_TYPES, _resetBudget, isAttached,
} from './ticker.js';

// ── Fixtures ─────────────────────────────────────────────────────────────────

function fakeBot() {
  const posts = [];
  return {
    posts,
    texts: () => posts.map((p) => p.text),
    async sendMessage(chatId, text) {
      posts.push({ chatId, text, photo: null });
      return true;
    },
    async sendPhoto(chatId, photo, opts = {}) {
      posts.push({ chatId, text: opts.caption ?? '', photo });
      return true;
    },
  };
}

// The floor is $10/$20, upstairs $25/$50, the back room $50/$100 (rooms.js).
const tablesAt = (bigBlind) => ({ getTable: () => (bigBlind == null ? null : { bigBlind }) });

let clock = Date.UTC(2026, 8, 6, 20, 0, 0);
const now = () => clock;
let bot;

function attach(opts = {}) {
  bot = fakeBot();
  return attachTicker({
    bot,
    chatId: '@agenticpoker',
    enabled: true,
    now,
    liveTables: tablesAt(100),
    shares: () => [],
    ...opts,
  });
}

beforeEach(() => {
  detachTicker();
  resetEvents();
  _resetBudget();
  clock = Date.UTC(2026, 8, 6, 20, 0, 0);
});

after(() => detachTicker());

// ── The voice ────────────────────────────────────────────────────────────────

test('EVENTS-3: the house speaks in dollars, names the room, and closes with one word', () => {
  attach();
  emitCasinoEvent({
    type: EventType.COOLER,
    tableId: 't-9',
    agentIds: ['a1', 'a2'],
    headline: 'Granite coolered Bluff Master for 90bb',
    pot: 4180,
    handNumber: 12,
  });

  assert.equal(bot.posts.length, 1);
  assert.equal(bot.posts[0].chatId, '@agenticpoker');
  assert.equal(
    bot.posts[0].text,
    'Granite coolered Bluff Master for $4,180 in the back room. Cooler.',
  );
});

test('EVENTS-3: bb is read back in money, and a headline with no bb figure is left alone', () => {
  assert.equal(inDollars('coolered him for 90bb', 4180), 'coolered him for $4,180');
  assert.equal(inDollars('Granite is out of chips', 0), 'Granite is out of chips');
  assert.equal(inDollars('Granite is out of chips', 500), 'Granite is out of chips');
  // Only the felt's own figure moves; a name with digits in it does not.
  assert.equal(inDollars('Agent 7 played a 75bb pot', 1500), 'Agent 7 played a $1,500 pot');
});

test('EVENTS-3: every posted type gets its verdict, and a big pot gets none', () => {
  const line = (type, headline, pot = 4180) =>
    tickerLine({ type, headline, pot, handNumber: 1 }, { room: null });

  assert.equal(line(EventType.BIG_POT, 'Granite and Marlow played a 90bb pot'),
    'Granite and Marlow played a $4,180 pot.');
  assert.equal(line(EventType.BUST, 'Granite is out of chips', 0),
    'Granite is out of chips. Busted.');
  assert.equal(line(EventType.HEATER, 'Granite has won 5 of the last 6', 0),
    'Granite has won 5 of the last 6. Heater.');
  assert.equal(line(EventType.NEMESIS_SEATED, 'Granite sits down across from Marlow', 0),
    'Granite sits down across from Marlow. Grudge.');
});

test('EVENTS-3: a table at no rung, or one already gone, loses the room and keeps the line', () => {
  attach({ liveTables: tablesAt(null) });
  emitCasinoEvent({
    type: EventType.BUST, tableId: 't-9', agentIds: ['a1'],
    headline: 'Granite is out of chips', pot: 0, handNumber: 4,
  });
  assert.deepEqual(bot.texts(), ['Granite is out of chips. Busted.']);
});

test('EVENTS-3: `hot` is not channel news — it has a deadline the window cannot keep', () => {
  attach();
  emitCasinoEvent({
    type: EventType.HOT, tableId: 't-9', agentIds: ['a1'],
    headline: '40bb on the river, Granite and Marlow still live', pot: 800, handNumber: 3,
  });
  assert.equal(bot.posts.length, 0);
  assert.ok(!POSTED_TYPES.includes(EventType.HOT), 'and it is not in the posted set');
});

// ── What may never travel ────────────────────────────────────────────────────

test('EVENTS-3: an owner never reaches the channel — the ticker reads headlines, not details', () => {
  // Other modules (agentProfiles, and notify.js once attached) DO listen on the
  // private channel; the claim here is that attaching the ticker adds nothing
  // to it, so the count is compared against itself rather than against zero.
  const privateListenersBefore = bus.listenerCount('detail');
  attach();
  emitCasinoEvent({
    type: EventType.BUST,
    tableId: 't-9',
    agentIds: ['a1'],
    headline: 'Granite is out of chips',
    pot: 0,
    handNumber: 8,
    // NOTIFY-2's private half of the same fact. It rides a separate bus
    // channel and this file does not subscribe to it.
    detail: [{ type: 'busted', ownerId: '77123456', agentName: 'Granite', buyIn: 2000 }],
  });

  assert.equal(bot.posts.length, 1);
  const text = bot.posts[0].text;
  assert.ok(!text.includes('77123456'), 'no owner id');
  assert.ok(!text.includes('2000'), 'and no buy-in either');
  assert.equal(bus.listenerCount('detail'), privateListenersBefore,
    'and the ticker subscribed to nothing on the private channel');
});

// ── The window ───────────────────────────────────────────────────────────────

test('EVENTS-3: never two inside five minutes', () => {
  attach();
  const shout = (n) => emitCasinoEvent({
    type: EventType.COOLER, tableId: 't-9', agentIds: ['a1'],
    headline: `hand ${n} for 10bb`, pot: 100 * n, handNumber: n,
  });

  shout(1);
  clock += 60_000;
  shout(2);
  clock += 3 * 60_000;         // four minutes since the first
  shout(3);
  assert.equal(bot.posts.length, 1, 'both of those landed inside the gap');

  clock += 60_001;             // five minutes and a millisecond
  shout(4);
  assert.equal(bot.posts.length, 2);
  assert.deepEqual(bot.texts(), [
    'hand 1 for $100 in the back room. Cooler.',
    'hand 4 for $400 in the back room. Cooler.',
  ], 'and the two it dropped were dropped, not queued behind the fourth');
});

test('EVENTS-3: six an hour, and the seventh waits for the first to age out', () => {
  attach();
  const shout = (n) => emitCasinoEvent({
    type: EventType.HEATER, tableId: 't-9', agentIds: [`a${n}`],
    headline: `agent ${n} has won 5 of the last 6`, pot: 0, handNumber: n,
  });

  const first = clock;
  for (let i = 1; i <= 8; i++) {
    shout(i);
    clock += BUDGET.minGapMs + 1000;   // always outside the gap
  }
  assert.equal(bot.posts.length, BUDGET.maxPerHour, 'the hourly cap held even with the gap respected');
  assert.equal(tickerBudget(clock).postedThisHour, BUDGET.maxPerHour);

  // The seventh slot opens exactly when the first send leaves the window.
  clock = first + BUDGET.windowMs + 1;
  shout(9);
  assert.equal(bot.posts.length, BUDGET.maxPerHour + 1);
});

test('EVENTS-3: the budget says why it refused', () => {
  _resetBudget();
  assert.deepEqual(tickerDecide(1_000_000), { post: true });
  attach();
  emitCasinoEvent({
    type: EventType.BUST, tableId: 't', agentIds: ['a1'],
    headline: 'Granite is out of chips', pot: 0, handNumber: 1,
  });
  const refusal = tickerDecide(clock + 60_000);
  assert.equal(refusal.drop, 'gap');
  assert.equal(refusal.nextAt, clock + BUDGET.minGapMs);
});

// ── The picture ──────────────────────────────────────────────────────────────

const card = (over = {}) => ({
  id: 'a'.repeat(32), ownerId: '77123456', agentId: 'a1', handId: '12',
  caption: 'whatever the owner sent', createdAt: 1,
  ...over,
});

test('EVENTS-3: a card already prepared for THIS hand is attached, with the house caption', () => {
  attach({ shares: () => [card()] });
  emitCasinoEvent({
    type: EventType.BIG_POT, tableId: 't-9', agentIds: ['a1', 'a2'],
    headline: 'Granite and Marlow played a 90bb pot', pot: 4180, handNumber: 12,
  });

  assert.equal(bot.posts.length, 1);
  assert.match(bot.posts[0].photo, /^https?:\/\/.*\/share\/a{32}\.png$/);
  assert.equal(bot.posts[0].text, 'Granite and Marlow played a $4,180 pot in the back room.',
    'the caption is ours — never the owner\'s, which quotes his reasoning');
});

test('EVENTS-3: a card for another hand, another agent, or no hand at all is text only', () => {
  const ev = {
    type: EventType.COOLER, agentIds: ['a1'], headline: 'coolered him for 90bb',
    pot: 4180, handNumber: 12,
  };
  assert.equal(cardUrlFor(ev, { shares: () => [card({ handId: '11' })] }), null, 'wrong hand');
  assert.equal(cardUrlFor(ev, { shares: () => [card({ agentId: 'a9' })] }), null, 'wrong agent');
  assert.equal(cardUrlFor({ ...ev, handNumber: 0 }, { shares: () => [card()] }), null, 'no hand to match');
  assert.equal(cardUrlFor({ ...ev, agentIds: [] }, { shares: () => [card()] }), null, 'nobody to match');
  assert.ok(cardUrlFor(ev, { shares: () => [card()] }), 'and the exact hand does match');

  attach({ shares: () => [card({ handId: '11' })] });
  emitCasinoEvent({ ...ev, tableId: 't-9' });
  assert.equal(bot.posts[0].photo, null, 'so the channel posts the line on its own');
});

test('EVENTS-3: a share store that blows up costs the picture, not the post', () => {
  attach({ shares: () => { throw new Error('index.json is a directory'); } });
  emitCasinoEvent({
    type: EventType.BUST, tableId: 't-9', agentIds: ['a1'],
    headline: 'Granite is out of chips', pot: 0, handNumber: 2,
  });
  assert.deepEqual(bot.texts(), ['Granite is out of chips in the back room. Busted.']);
});

// ── Wiring ───────────────────────────────────────────────────────────────────

test('EVENTS-3: off unless both the switch and the channel are set', () => {
  assert.equal(attachTicker({ bot: fakeBot(), enabled: false, chatId: '@x' }), null);
  assert.equal(isAttached(), false);
  assert.equal(attachTicker({ bot: fakeBot(), enabled: true, chatId: '' }), null);
  assert.equal(isAttached(), false);

  const silent = fakeBot();
  attachTicker({ bot: silent, enabled: false, chatId: '@x' });
  emitCasinoEvent({ type: EventType.BUST, tableId: 't', headline: 'nobody hears this', pot: 0 });
  assert.equal(silent.posts.length, 0);
});

test('EVENTS-3: attaching twice does not post twice', () => {
  attach();
  attachTicker({ bot, chatId: '@agenticpoker', enabled: true, now, liveTables: tablesAt(100), shares: () => [] });
  emitCasinoEvent({
    type: EventType.BUST, tableId: 't-9', agentIds: ['a1'],
    headline: 'Granite is out of chips', pot: 0, handNumber: 1,
  });
  assert.equal(bot.posts.length, 1);
  assert.equal(bus.listenerCount('event'), 1);
});

test('EVENTS-3: a bot that throws does not take the hand down with it', () => {
  const angry = {
    sendMessage() { throw new Error('telegram is down'); },
    async sendPhoto() { throw new Error('telegram is down'); },
  };
  attachTicker({ bot: angry, chatId: '@x', enabled: true, now, liveTables: tablesAt(100), shares: () => [] });
  const ev = emitCasinoEvent({
    type: EventType.BUST, tableId: 't-9', agentIds: ['a1'],
    headline: 'Granite is out of chips', pot: 0, handNumber: 1,
  });
  assert.equal(ev.headline, 'Granite is out of chips', 'the event is on the wire regardless');

  // And a rejected promise is nobody's unhandled rejection.
  const rejecting = { async sendMessage() { throw new Error('429'); }, async sendPhoto() { return false; } };
  detachTicker();
  _resetBudget();
  attachTicker({ bot: rejecting, chatId: '@x', enabled: true, now, liveTables: tablesAt(100), shares: () => [] });
  emitCasinoEvent({
    type: EventType.BUST, tableId: 't-9', agentIds: ['a1'],
    headline: 'Granite is out of chips again', pot: 0, handNumber: 2,
  });
});
