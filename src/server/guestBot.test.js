// src/server/guestBot.test.js — GUEST-1 job 5
//
// `/start guest_<token>`, the other end of the claim wall's deep link.
//
// Two things are worth a test file here and neither is the happy path.
//
// The first is that this handler shares ONE poll loop with the share cards.
// Only one process may call getUpdates per bot token, so a handler that can
// throw is a handler that can take inline sharing down with it — and the
// person it breaks for is not the one who tapped the link. So every message
// shape that could plausibly arrive is fed to it, including several that are
// not messages in any useful sense, and none of them may throw.
//
// The second is that a stranger always gets a way in. Every branch answers
// with one sentence and the same button; a status code is not an answer to
// somebody who followed a link.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { startParamOf } from './guestBot.js';

const ORIGINAL_CWD = process.cwd();
let dir;
let store;
let guest;
let profiles;
let bot;
let sent;

const agent = (id) => ({
  id, name: id.toUpperCase(), status: 'idle', activeTableId: null,
  strategy: 'You are a poker player.', style: 'Balanced', risk: 'Medium',
  pocket: { balance: 2_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
  mood: { state: 'neutral', heat: 30, losingRun: 0 },
  attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
});

/** A Telegram message update, as getUpdates delivers it. */
const msg = (text, fromId = 9001) => ({
  message_id: 1,
  chat: { id: fromId, type: 'private' },
  from: { id: fromId, first_name: 'Stranger' },
  text,
});

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-gbot-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);
  delete process.env.TELEGRAM_BOT_TOKEN;
  process.env.GUEST_ENABLED = '1';

  guest = await import('./guest.js');
  profiles = await import('./agentProfiles.js');
  bot = await import('./guestBot.js');

  for (const [ownerId, token] of [['g_bot1', 'tok-bot1'], ['g_bot2', 'tok-bot2'], ['g_bot3', 'tok-bot3']]) {
    store.insertGuest({ token, ownerId, ip: '10.5.5.5' });
    store.saveWallet(ownerId, { ownerId, balance: 900, fridge: {}, ledger: [] });
    store.saveProfile(ownerId, { userId: ownerId, chat: [], agents: [agent(`${ownerId}-man`)] });
  }
});

beforeEach(() => {
  process.env.GUEST_ENABLED = '1';
  sent = [];
});

after(() => {
  delete process.env.GUEST_ENABLED;
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const fakeBot = {
  async sendMessage(chatId, text, opts) { sent.push({ chatId, text, opts }); return true; },
};

const handle = (text, fromId) => bot.handleStart(msg(text, fromId), { bot: fakeBot });

// ── Reading the command ─────────────────────────────────────────────────────

test('GUEST-1: /start is recognised in every shape Telegram sends it', () => {
  assert.equal(startParamOf({ text: '/start guest_abc' }), 'guest_abc');
  assert.equal(startParamOf({ text: '/start' }), '');
  assert.equal(startParamOf({ text: '  /start   guest_abc  ' }), 'guest_abc');
  // In a group Telegram appends the bot's name to the command.
  assert.equal(startParamOf({ text: '/start@AigenicPokerBot guest_abc' }), 'guest_abc');
});

test('GUEST-1: anything that is not /start is not ours', () => {
  assert.equal(startParamOf({ text: 'hello' }), null);
  assert.equal(startParamOf({ text: '/startle' }), null, 'a prefix is not the command');
  assert.equal(startParamOf({ text: '/help' }), null);
  assert.equal(startParamOf({}), null);
  assert.equal(startParamOf(null), null);
});

// ── The claim ───────────────────────────────────────────────────────────────

test('GUEST-1: /start guest_<token> hands him over and says so', async () => {
  assert.equal(profiles.agentsOf('g_bot1').length, 1);

  const out = await handle('/start guest_tok-bot1', 9001);
  assert.equal(out, 'claimed');

  // The rename really happened, and through the same claim the route uses.
  assert.deepEqual(profiles.agentsOf('9001').map((a) => a.id), ['g_bot1-man']);
  assert.deepEqual(profiles.agentsOf('g_bot1'), []);
  assert.equal(store.loadWallet('9001').balance, 900);

  assert.equal(sent.length, 1);
  assert.match(sent[0].text, /yours/i);
  assert.equal(sent[0].chatId, 9001);
});

test('GUEST-1: every reply carries the way back into the app', async () => {
  await handle('/start guest_tok-bot2', 9002);
  const button = sent[0].opts.reply_markup.inline_keyboard[0][0];
  assert.ok(button.url.startsWith('https://t.me/'), button.url);
  assert.ok(button.text.length > 0);
});

test('GUEST-1: tapping the same link twice is a no-op, and it says that too', async () => {
  await handle('/start guest_tok-bot2', 9002);
  sent = [];
  const out = await handle('/start guest_tok-bot2', 9002);
  assert.equal(out, 'alreadyClaimed');
  assert.match(sent[0].text, /already/i);
  // And he did not gain a second copy of the same man.
  assert.equal(profiles.agentsOf('9002').length, 1);
});

test('GUEST-1: somebody else\'s used link gets a sentence, not somebody else\'s agent', async () => {
  await handle('/start guest_tok-bot3', 9003);
  sent = [];
  const out = await handle('/start guest_tok-bot3', 9004);
  assert.equal(out, 'alreadyClaimed');
  assert.deepEqual(profiles.agentsOf('9004'), []);
  assert.match(sent[0].text, /used already/i);
});

test('GUEST-1: a token nobody minted is answered, not ignored', async () => {
  const out = await handle('/start guest_not-a-real-token', 9005);
  assert.equal(out, 'noGuest');
  assert.equal(sent.length, 1);
});

// ── The greeting ────────────────────────────────────────────────────────────

test('GUEST-1: a bare /start is a greeting with the door in it', async () => {
  const out = await handle('/start', 9006);
  assert.equal(out, 'greeted');
  assert.equal(sent.length, 1);
  assert.ok(sent[0].opts.reply_markup);
});

test('GUEST-1: a start param meant for something else is greeted, not claimed', async () => {
  // An agent deep link that landed in the chat rather than the app.
  const out = await handle('/start agent_m3x9q1', 9007);
  assert.equal(out, 'greeted');
});

test('GUEST-1: with the door shut it still answers, and claims nothing', async () => {
  delete process.env.GUEST_ENABLED;
  const out = await handle('/start guest_tok-bot1', 9008);
  assert.equal(out, 'greeted');
  assert.deepEqual(profiles.agentsOf('9008'), []);
});

// ── It shares a loop with the share cards ───────────────────────────────────

test('GUEST-1: nothing that can arrive on the wire takes the poll loop down', async () => {
  const shapes = [
    null,
    {},
    { text: null },
    { text: '/start guest_x' },                          // no chat, no from
    { text: '/start guest_x', from: { id: 7 } },          // no chat
    { text: '/start', chat: { id: 7 } },                  // no from
    { text: 123 },
    { text: '/start ' + 'x'.repeat(5000) },
    msg('not a command'),
  ];
  for (const shape of shapes) {
    // The assertion IS that this returns. A throw here is a throw inside the
    // loop the share cards ride on.
    await bot.handleStart(shape, { bot: fakeBot });
  }
});

test('GUEST-1: a bot that cannot send is not a reason to fail the claim', async () => {
  const out = await bot.handleStart(msg('/start guest_tok-bot1', 9009), {});
  // tok-bot1 is already spent by the first test, so this is the idempotent
  // branch — what matters is that a missing sender did not throw.
  assert.ok(typeof out === 'string');
});
