// src/server/ownerHands.test.js — LIFE-1 job 6
//
// The agent-side unit tests are in src/agent/ownerHands.test.js. This is the
// half that has to be true at a real table: the owner takes a seat at his own
// kitchen game, a hand is played out, and afterwards the hand is on his
// agent's record with the owner's real actions in it and a line about how he
// played them has reached his owner's private thread.
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
const { readThread, setLineListener, OWNER } = await import('./thread.js');
const { ownerHandComment } = await import('../agent/ownerHands.js');
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
function kitchenTable({ visitor = false } = {}) {
  const table = new Table({
    tableId: `home-kitchen-${seq++}`, smallBlind: 10, bigBlind: 20, maxSeats: visitor ? 3 : 2,
    home: true, homeOwnerId: 'kitchen',
  });
  const agentWs = fakeWs();
  table.seatPlayer(agentWs, { playerId: 'a0', buyIn: 2000, displayName: 'Stone' });
  table.agentIds[0] = 'stone';
  table.agentUserIds[0] = 'kitchen';
  table.seatSessionIds[0] = `session-${table.tableId}-stone`;

  const ownerWs = fakeWs();
  table.seatPlayer(ownerWs, { playerId: 'kitchen:me', buyIn: 2000, displayName: 'Jens' });
  if (visitor) {
    table.seatPlayer(fakeWs(), { playerId: 'visiting-agent', buyIn: 2000, displayName: 'Visitor' });
    table.agentIds[2] = 'visitor';
    table.agentUserIds[2] = 'visitor-owner';
    table.seatSessionIds[2] = `session-${table.tableId}-visitor`;
  }
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

test('BUG-257 / LIFE-1: his comment about the owner\'s play reaches only the private owner thread', t => {
  const { table, ownerWs } = kitchenTable({ visitor: true });
  const ownWatch = fakeWs(), visitorWatch = fakeWs(), publicWatch = fakeWs();
  table.spectators.push({ ws: ownWatch, spectatorSeat: 0 }, { ws: visitorWatch, spectatorSeat: 2 },
    { ws: publicWatch, spectatorSeat: -1 });
  setLineListener(line => table.deliverThreadLine(line));
  t.after(() => { setLineListener(null); table._clearTimers(); });
  table.maybeStartHand({ clientDriven: true });
  // A fold after the flop is the case that earns a line — a fold preflop is
  // deliberately not an event.
  play(table, (seat, street) => {
    if (seat === 1 && street !== 'preflop') return Actions.FOLD;
    return Actions.CHECK;
  });

  const hand = stored().ownerHands[0];
  assert.equal(hand.ownerFolded, true);
  assert.ok(hand.ownerActions.some(action => action.type === Actions.FOLD && action.street !== 'preflop'));
  const expected = ownerHandComment(hand);
  assert.ok(expected && /fold|had|chips|hope you had it/i.test(expected), `no comment about the owner's actual play: ${expected}`);
  const lines = readThread(table.seatSessionIds[0], { owner: true });
  const comment = lines.find(line => line.text === expected && line.to === OWNER);
  assert.equal(comment?.from, 'stone', 'the same factual hand comment is retained privately');
  assert.equal(ownWatch.of('thread_line').filter(message => message.line?.text === expected).length, 1);
  for (const socket of [ownerWs, ownWatch, visitorWatch, publicWatch, table.connections[2]]) {
    assert.equal(socket.of('chat').some(message => message.text === expected), false, 'owner hand comments are never public CHAT');
  }
  for (const socket of [visitorWatch, publicWatch, table.connections[2]]) {
    assert.equal(socket.of('thread_line').some(message => message.line?.text === expected), false);
  }
  assert.equal(readThread(table.seatSessionIds[2], { owner: true }).some(line => line.text === expected), false);
  assert.equal(readThread(table.seatSessionIds[0]).some(line => line.text === expected), false);
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
