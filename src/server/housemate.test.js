// src/server/housemate.test.js — AGENT-5 job G
//
// HE NOTICES HIS HOUSEMATE.
//
// Job E lets two of one owner's agents share a casino felt. What makes that
// worth having is not that it is permitted but that he KNOWS: a man who sits
// down opposite somebody he lives with and plays the hand as though it were a
// stranger is the Tamagotchi failing at the one thing it is for.
//
// Four things are asserted, and the last two are the ones that rot:
//   · he says it, in his own voice, out of NATURE_WANT_LINES
//   · ONCE per session — the man arriving is a moment, not a state of affairs
//   · never at the kitchen table, where his household plays each other by
//     definition and noticing it is noticing that he is in his own kitchen
//   · never about a stranger, and never about himself

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { NATURE_WANT_LINES } from '../agent/wantVoice.js';
import { Streets } from '../engine/game.js';

const OWNER = 'housemate-owner';
const ORIGINAL_CWD = process.cwd();

let dir;
let store;
let Table;

const agent = (id, natureName) => ({
  id,
  name: id.toUpperCase(),
  status: 'idle',
  activeTableId: null,
  nature: { name: natureName },
  // The BIRTH nature lives on `attrs`, which is what getAgentAttributes reads
  // and therefore what the greeting reads (BUG-170's path).
  attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  stamina: { left: 100, at: Date.now() },
});

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-housemate-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);
  store.saveProfile(OWNER, {
    userId: OWNER,
    chat: [],
    agents: [agent('rocky', 'Rock'), agent('flash', 'Showman'), agent('nameless', null)],
  });
  store.saveProfile('other-owner', { userId: 'other-owner', chat: [], agents: [agent('stranger', 'Shark')] });
  ({ Table } = await import('./table.js'));
});

after(() => {
  process.chdir(ORIGINAL_CWD);
  try { store?._closeForTests?.(); } catch { /* best effort */ }
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

// A table that deals on demand and says nothing of its own accord.
function table(opts = {}) {
  const t = new Table({ tableId: 'mate-t', smallBlind: 10, bigBlind: 20, maxSeats: 4, ...opts });
  t._scheduleNextHand = () => {};
  t.startSessionLoop = () => {};
  t._maybeRunAiTurn = async () => {};   // nothing here plays a hand out
  // And no long timers left behind it: the stall watchdog and the AI
  // inactivity timer both hold the process open for a minute after the last
  // assertion, which turns a 3ms suite into a 60s one.
  t._resetStallWatchdog = () => {};
  t._resetAiInactivityTimer = () => {};
  return t;
}

const linesAt = (t, seat) => t.chatHistory.filter((c) => c.seat === seat).map((c) => c.text);

// Deal one hand. NOT `clientDriven` — maybeStartHand hands an AI-only table
// straight back to the session loop on that path and deals nothing, which is
// WV2-1's rule and not this file's business. The street is walked to COMPLETE
// between deals so the next call is not refused as "a hand is in progress";
// nothing here cares what the cards did.
function deal(t) {
  t.maybeStartHand();
  if (t.game) t.game.street = Streets.COMPLETE;
}

test('AGENT-5 job G: the second man says something, in his own voice', () => {
  const t = table();
  t.seatAI({ agentId: 'rocky', userId: OWNER, displayName: 'ROCKY', buyIn: 2_000 });
  t.seatAI({ agentId: 'flash', userId: OWNER, displayName: 'FLASH', buyIn: 2_000 });
  deal(t);

  const said = t.chatHistory.map((c) => c.text);
  assert.ok(said.includes(NATURE_WANT_LINES.Showman.housemate),
    `the Showman said nothing about his housemate: ${JSON.stringify(said)}`);
  // And the first one notices him back — the flag is per seat, so both are
  // entitled to their line. What is capped is one bubble per seat per hand.
  assert.ok(said.includes(NATURE_WANT_LINES.Rock.housemate));
});

test('AGENT-5 job G: once per session, not once per hand', () => {
  const t = table({ tableId: 'mate-once' });
  t.seatAI({ agentId: 'rocky', userId: OWNER, displayName: 'ROCKY', buyIn: 2_000 });
  t.seatAI({ agentId: 'flash', userId: OWNER, displayName: 'FLASH', buyIn: 2_000 });

  for (let n = 0; n < 4; n++) deal(t);
  const mate = NATURE_WANT_LINES.Showman.housemate;
  assert.equal(t.chatHistory.filter((c) => c.text === mate).length, 1,
    'four hands, one greeting');
});

test('AGENT-5 job G: a stranger is not a housemate', () => {
  const t = table({ tableId: 'mate-stranger' });
  t.seatAI({ agentId: 'rocky', userId: OWNER, displayName: 'ROCKY', buyIn: 2_000 });
  t.seatAI({ agentId: 'stranger', userId: 'other-owner', displayName: 'STRANGER', buyIn: 2_000 });
  deal(t);

  const said = t.chatHistory.map((c) => c.text);
  assert.ok(!said.includes(NATURE_WANT_LINES.Rock.housemate), JSON.stringify(said));
  assert.ok(!said.includes(NATURE_WANT_LINES.Shark.housemate), JSON.stringify(said));
});

test('AGENT-5 job G: a man alone with the House greets nobody', () => {
  const t = table({ tableId: 'mate-alone' });
  t.seatAI({ agentId: 'rocky', userId: OWNER, displayName: 'ROCKY', buyIn: 2_000 });
  t.seatAI({ displayName: 'DOYLE', buyIn: 2_000 });   // no agentId, no owner
  deal(t);
  assert.deepEqual(linesAt(t, 0), [], 'he is not his own housemate');
});

test('AGENT-5 job G: not at the kitchen table', () => {
  // Where his household plays each other by definition. Noticing it there is
  // noticing that he is standing in his own kitchen.
  const t = table({ tableId: 'home-housemate', home: true, homeOwnerId: OWNER });
  t.seatAI({ agentId: 'rocky', userId: OWNER, displayName: 'ROCKY', buyIn: 200 });
  t.seatAI({ agentId: 'flash', userId: OWNER, displayName: 'FLASH', buyIn: 200 });
  deal(t);
  assert.deepEqual(t.chatHistory.map((c) => c.text), []);
});

test('AGENT-5 job G: an agent with no nature is given no borrowed voice', () => {
  // wantVoice's own rule, and the reason natureWantLine returns null rather
  // than a default. He says nothing, and nothing retries it every hand.
  const t = table({ tableId: 'mate-nameless' });
  t.seatAI({ agentId: 'nameless', userId: OWNER, displayName: 'NAMELESS', buyIn: 2_000 });
  t.seatAI({ agentId: 'rocky', userId: OWNER, displayName: 'ROCKY', buyIn: 2_000 });
  deal(t);

  assert.deepEqual(linesAt(t, 0), [], 'no nature, no line');
  assert.ok(t._housemateNoted[0], 'and it is not retried on every hand');
  assert.deepEqual(linesAt(t, 1), [NATURE_WANT_LINES.Rock.housemate],
    'his housemate still speaks');
});
