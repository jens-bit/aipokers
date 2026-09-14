// src/server/ownerHands.test.js — LIFE-1 job 6
//
// The agent-side unit tests are in src/agent/ownerHands.test.js. This is the
// half that has to be true at a real table: the owner takes a seat at his own
// kitchen game, a hand is played out, and afterwards the hand is on his
// agent's record with the owner's real actions in it and a line about how he
// played them has reached the felt.
//
// The failure this is written against: table.js's hand-completion loop skips
// `recordHandResult` for home tables, so the one hand an owner most wants
// talked about — the one he was IN — was the only hand in the product that
// left no trace at all.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-ownerhands-'));
_closeForTests();
process.chdir(dir);
process.on('exit', () => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const { saveProfile, loadProfile } = await import('./store.js');
saveProfile('kitchen', {
  userId: 'kitchen',
  chat: [],
  agents: [{
    id: 'stone', name: 'Stone', status: 'idle', nature: { name: 'Rock' },
    strategy: 'Wait for a good hand.',
    attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    pocket: { balance: 5000, mode: 'auto', cap: 5000, ledger: [] },
  }],
});

const { Table } = await import('./table.js');
const { Actions } = await import('../engine/game.js');
const { setPersistEnabled } = await import('./opponentStats.js');
const { buildAgentChatSystem } = await import('./agentProfiles.js');
setPersistEnabled(false);

function fakeWs() {
  return {
    readyState: 1, OPEN: 1, received: [],
    send(payload) { this.received.push(JSON.parse(payload)); },
    of(type) { return this.received.filter((m) => m.type === type); },
  };
}

let seq = 0;

// His own kitchen table, with HIM in one chair and the owner in the other.
// The owner's seat is the one with no agent behind it, which is exactly how
// _recordOwnerHands finds it.
function kitchenTable() {
  const table = new Table({
    tableId: `home-kitchen-${seq++}`, smallBlind: 10, bigBlind: 20, maxSeats: 2,
    home: true, homeOwnerId: 'kitchen',
  });
  const agentWs = fakeWs();
  table.seatPlayer(agentWs, { playerId: 'a0', buyIn: 2000, displayName: 'Stone' });
  table.agentIds[0] = 'stone';
  table.agentUserIds[0] = 'kitchen';

  const ownerWs = fakeWs();
  table.seatPlayer(ownerWs, { playerId: 'kitchen:me', buyIn: 2000, displayName: 'Jens' });
  return { table, agentWs, ownerWs };
}

// Drive the hand with an explicit choice per seat, so the owner's actions are
// the ones the assertions are about rather than whatever a helper picked.
function play(table, choose) {
  const before = table.handsThisSession;
  let safety = 200;
  while (table.game && table.handsThisSession === before && safety-- > 0) {
    const seat = table.game.toAct;
    if (seat === null || seat === undefined) break;
    const legal = table.game.legalActions(seat);
    const want = choose(seat, table.game.street, legal);
    const pick = legal.find((a) => a.type === want)
      ?? legal.find((a) => a.type === Actions.CHECK)
      ?? legal.find((a) => a.type === Actions.CALL)
      ?? { type: Actions.FOLD };
    table.applyAction(table.connections[seat], { type: pick.type });
  }
}

const stored = () => loadProfile('kitchen').agents[0];

test('LIFE-1: a hand the owner played is on his agent\'s record afterwards', () => {
  const { table } = kitchenTable();
  table.maybeStartHand({ clientDriven: true });
  // Owner (seat 1) folds at his first opportunity; the agent takes it down.
  play(table, (seat) => (seat === 1 ? Actions.FOLD : Actions.CHECK));

  const hands = stored().ownerHands ?? [];
  assert.equal(hands.length, 1, 'the hand he was IN left a trace');
  const h = hands[0];
  assert.equal(h.ownerName, 'Jens');
  assert.ok(h.ownerActions.length > 0, 'and it carries what the owner actually did');
  assert.equal(h.ownerFolded, true);
  assert.equal(h.iWon, true);
  assert.ok(Array.isArray(h.mine) && h.mine.length === 2, 'and what the agent was holding');
});

test('LIFE-1: the owner\'s real actions are recorded, street by street', () => {
  const { table } = kitchenTable();
  table.maybeStartHand({ clientDriven: true });
  play(table, () => Actions.CHECK);   // checked down to showdown by both

  const h = (stored().ownerHands ?? [])[0];
  assert.ok(h, 'the hand was filed');
  for (const a of h.ownerActions) {
    assert.ok(['preflop', 'flop', 'turn', 'river'].includes(a.street), a.street);
    assert.ok(typeof a.type === 'string' && a.type.length, JSON.stringify(a));
  }
  assert.equal(h.showdown, true, 'a checked-down hand reaches showdown');
});

test('LIFE-1: a card nobody turned over is never stored', () => {
  const { table } = kitchenTable();
  table.maybeStartHand({ clientDriven: true });
  play(table, (seat) => (seat === 1 ? Actions.FOLD : Actions.CHECK));
  const h = (stored().ownerHands ?? [])[0];
  assert.equal(h.ownerShowed, null, 'he folded, so his cards were never seen');
});

test('LIFE-1: he says something about how the owner played it, at the table', () => {
  const { table, ownerWs } = kitchenTable();
  table.maybeStartHand({ clientDriven: true });
  // A fold after the flop is the case that earns a line — a fold preflop is
  // deliberately not an event.
  play(table, (seat, street) => {
    if (seat === 1 && street !== 'preflop') return Actions.FOLD;
    return Actions.CHECK;
  });

  const chat = ownerWs.of('chat');
  const lines = chat.map((m) => m.text ?? m.message ?? '').filter(Boolean);
  assert.ok(lines.length >= 1, `nothing was said: ${JSON.stringify(chat.slice(0, 3))}`);
  assert.ok(lines.some((l) => /fold|had|chips|hope you had it/i.test(l)),
    `no line about the owner's play: ${lines.join(' | ')}`);
});

test('LIFE-1: and he can be asked about it later, in a conversation', () => {
  const { table } = kitchenTable();
  table.maybeStartHand({ clientDriven: true });
  play(table, (seat, street) => (seat === 1 && street !== 'preflop' ? Actions.FOLD : Actions.CHECK));

  const him = stored();
  const prompt = buildAgentChatSystem(him, { recentChat: [], said: 'why did I lose that one?' });
  assert.match(prompt, /HANDS YOU HAVE PLAYED AGAINST YOUR OWNER/);
  assert.match(prompt, /at your kitchen table/);
  assert.match(prompt, /HE played it:/);
  assert.match(prompt, /talk\s+about HIS play in it/);
});

test('LIFE-1: a kitchen game with no owner in a chair writes nothing', () => {
  // Two of his own agents playing each other is not a hand between you, and
  // the owner-hand book must not fill up with them.
  const table = new Table({
    tableId: `home-kitchen-${seq++}`, smallBlind: 10, bigBlind: 20, maxSeats: 2,
    home: true, homeOwnerId: 'kitchen',
  });
  ['stone', 'other'].forEach((id, i) => {
    table.seatPlayer(fakeWs(), { playerId: `a${i}`, buyIn: 2000, displayName: id });
    table.agentIds[i] = id;
    table.agentUserIds[i] = 'kitchen';
  });
  const before = (stored().ownerHands ?? []).length;
  table.maybeStartHand({ clientDriven: true });
  play(table, () => Actions.CHECK);
  assert.equal((stored().ownerHands ?? []).length, before, 'no owner, no hand between you');
});
