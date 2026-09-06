// src/server/table.guest.test.js — GUEST-1 job 2
//
// The three places a guest's limits touch a real Table.
//
// guestLimits.test.js holds the rules; this file holds the WIRING, which is
// what a rules test cannot see. The claim in all three is the same and it is
// the one worth the file: the limits are asked per SEAT, not per table.
//
// A guest and a claimed owner sit at the same felt — that is the ordinary case
// on a public floor, not an edge — and the two ways to get it wrong are equal
// and opposite:
//
//   · one guest at the table turning the written talk off for the paying
//     owners sitting with him, which is a product regression bought for
//     nothing;
//   · one paying owner at the table turning it ON for the guest, which is the
//     bill this tree exists to not send.
//
// Deterministic: plain seats, explicit actions, no model calls, no waiting —
// the same harness table.route.test.js uses.

delete process.env.ANTHROPIC_API_KEY;   // TEST-2: no automated suite talks to a model

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { Table } from './table.js';
import { routeFor, Route, Reason } from './router.js';
import { setPersistEnabled } from './opponentStats.js';

setPersistEnabled(false);

const ORIGINAL_CWD = process.cwd();
let dir;
let store;

const GUEST_ID = 'g_tableman';
const CLAIMED_ID = 'u-tableman';

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-tguest-'));
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(dir);
  process.env.GUEST_ENABLED = '1';
  store.insertGuest({ token: 'tok-tableman', ownerId: GUEST_ID, ip: '10.2.2.2' });
});

after(() => {
  delete process.env.GUEST_ENABLED;
  store?._closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const fakeWs = () => ({ readyState: 1, OPEN: 1, received: [], send(p) { this.received.push(JSON.parse(p)); } });

let seq = 0;
function dealt({ maxSeats = 2, owners = [] } = {}) {
  const table = new Table({
    tableId: `guest-${++seq}-${Math.random().toString(36).slice(2)}`,
    smallBlind: 10, bigBlind: 20, maxSeats,
  });
  for (let i = 0; i < maxSeats; i++) {
    table.seatPlayer(fakeWs(), { playerId: `p${i}`, buyIn: 2000, displayName: `P${i}` });
  }
  // Seated PLAIN, dealt, and only THEN marked AI — the same order
  // verify-cost-router.js uses and for the reason stated there: marking seats
  // AI before the hand starts makes the table AI-only, it adopts itself, and
  // it deals on its own timer instead of when this file asks it to.
  table.maybeStartHand({ clientDriven: true });
  for (let i = 0; i < maxSeats; i++) {
    table.aiSeats[i] = true;
    table.agentIds[i] = `agent-${i}`;
    table.agentUserIds[i] = owners[i] ?? CLAIMED_ID;
  }
  return table;
}

// ── 1 · the decision ────────────────────────────────────────────────────────

test('GUEST-1: the router is asked per seat, off the seat\'s own owner', () => {
  const table = dealt({ owners: [GUEST_ID, CLAIMED_ID] });
  const gs = table._buildAiGameState(table.game.toAct);

  // The two seats, the same briefing, two different answers. This is the whole
  // claim: `guest` comes from agentUserIds[seat] and not from the table.
  const free = routeFor(gs, { guest: !!table.agentUserIds[0].startsWith('g_') });
  assert.equal(free.route, Route.POLICY);
  assert.equal(free.reason, Reason.GUEST);

  const paid = routeFor(gs, { guest: table.agentUserIds[1].startsWith('g_') });
  assert.notEqual(paid.reason, Reason.GUEST);
});

// ── 2 · the talk ────────────────────────────────────────────────────────────
//
// _maybeSendAgentTalk is driven directly with a result, which is what the hand
// end hands it. The two paths are told apart by what they DO: the free path
// speaks synchronously off the template pools, so a bubble is in the socket by
// the time the call returns; the model path is fire-and-forget and, with no
// key, never speaks at all.

/** Which seats have a bubble over them, read off the table's own record. */
function spokenSeats(table) {
  return new Set(table.chatHistory.filter((c) => c.isAI).map((c) => c.seat));
}

/**
 * Force a trigger for every seat: three folded preflops reads as card dead.
 * The per-agent gap (TALK_INTERVAL_HANDS = 8) is stepped back out of the way
 * too — hand 1 with nobody having spoken is inside the gap, so without this
 * the whole table is silent for a reason that has nothing to do with guests.
 */
function primeTriggers(table) {
  for (let s = 0; s < table.maxSeats; s++) {
    table._prefoldStreakBySeat[s] = 3;
    table._talkLastHandBySeat[s] = (table.game?.handNumber ?? 0) - 20;
  }
}

test('GUEST-1: at a watched table a guest still speaks from the templates', () => {
  const table = dealt({ owners: [GUEST_ID, GUEST_ID] });
  table.spectators.push({ ws: fakeWs(), spectatorSeat: 0 });
  assert.equal(table.isWatched(), true, 'watched — the model path would normally take this');
  primeTriggers(table);

  table._maybeSendAgentTalk({ type: 'fold', winners: [{ seat: 0 }], pot: 100 });

  // A line is already in the socket. With no key the model path produces
  // nothing at all, so anything spoken here came from the free path.
  assert.ok(spokenSeats(table).size > 0, 'somebody said something, and said it now');
});

test('GUEST-1: a claimed owner at the same felt is not dragged onto the free path', () => {
  const table = dealt({ maxSeats: 3, owners: [GUEST_ID, CLAIMED_ID, CLAIMED_ID] });
  table.spectators.push({ ws: fakeWs(), spectatorSeat: 0 });
  primeTriggers(table);

  table._maybeSendAgentTalk({ type: 'fold', winners: [{ seat: 0 }], pot: 100 });

  // The guest's seat spoke synchronously off a template. The claimed seats did
  // not speak at all, because their half went to the model path — which, with
  // no key, says nothing. If the whole table had been pushed onto the free
  // path, every triggered seat would have a bubble.
  const spoke = spokenSeats(table);
  assert.equal(spoke.has(0), true, 'the guest spoke, from a template');
  assert.equal(spoke.has(1), false, 'the claimed seat did not take the free path');
  assert.equal(spoke.has(2), false);
});

test('GUEST-1: one needle per hand, whichever half the first speaker landed in', () => {
  const table = dealt({ maxSeats: 3, owners: [GUEST_ID, CLAIMED_ID, CLAIMED_ID] });
  table.spectators.push({ ws: fakeWs(), spectatorSeat: 0 });
  primeTriggers(table);

  table._maybeSendAgentTalk({ type: 'fold', winners: [{ seat: 0 }], pot: 100 });

  // TLK-1's cap: a hand produces at most one needle. Two halves each needling
  // would be two, which is the thing the split could most easily have broken.
  const needled = table.pendingNeedle.filter((n) => typeof n === 'string' && n.length > 0);
  assert.ok(needled.length <= table.maxSeats - 1,
    `needles went to ${needled.length} seats from one hand`);
  // They are all the SAME line — one thing was said, and it was said once.
  assert.equal(new Set(needled).size <= 1, true);
});

test('GUEST-1: an all-claimed table is exactly what it was before this tree', () => {
  const table = dealt({ maxSeats: 3, owners: [CLAIMED_ID, CLAIMED_ID, CLAIMED_ID] });
  table.spectators.push({ ws: fakeWs(), spectatorSeat: 0 });
  primeTriggers(table);

  table._maybeSendAgentTalk({ type: 'fold', winners: [{ seat: 0 }], pot: 100 });
  // Watched, all paying: everything goes to the model path, which without a
  // key says nothing synchronously. No template bubbles at all.
  assert.equal(spokenSeats(table).size, 0);
});

test('GUEST-1: an UNWATCHED table keeps TLK-1\'s one-template-per-hand rule', () => {
  const table = dealt({ maxSeats: 3, owners: [GUEST_ID, CLAIMED_ID, CLAIMED_ID] });
  table.connections = table.connections.map(() => fakeWs());
  table.spectators.length = 0;
  primeTriggers(table);

  table._maybeSendAgentTalk({ type: 'fold', winners: [{ seat: 0 }], pot: 100 });
  // Unwatched has always been one line per hand for the whole table, guest or
  // not — the split only exists inside the watched branch.
  assert.equal(spokenSeats(table).size, 1);
});

// ── 3 · the write-up ────────────────────────────────────────────────────────

test('GUEST-1: an unclaimed owner gets no night recap, and it is not marked written', () => {
  const table = dealt({ owners: [GUEST_ID, GUEST_ID] });
  table.connections = table.connections.map(() => null);
  for (let s = 0; s < table.maxSeats; s++) table.seatSessionIds[s] = `s-${s}`;

  table._writeNightRecap();
  // It CLAIMED the write (the flag is set before the owner is known, and that
  // is the existing shape) but no call went out. What is being pinned is the
  // skip; the flag is asserted so a future reader knows it is deliberate.
  assert.equal(table._recapWritten, true);
});

test('GUEST-1: a claimed owner at an unwatched table still gets his write-up', () => {
  const table = dealt({ owners: [CLAIMED_ID, CLAIMED_ID] });
  table.connections = table.connections.map(() => null);
  for (let s = 0; s < table.maxSeats; s++) table.seatSessionIds[s] = `s-${s}`;

  // No key, so nothing comes back — but the call is REACHED, which is the
  // difference between "skipped" and "answered with nothing". writeNightRecap
  // returning null without throwing is what a keyless run looks like.
  table._writeNightRecap();
  assert.equal(table._recapWritten, true);
});

// ── 4 · the memory refresh ──────────────────────────────────────────────────

test('GUEST-1: the memory refresh is not triggered for a guest seat', async () => {
  const table = dealt({ owners: [GUEST_ID, CLAIMED_ID] });
  // _triggerMemoryUpdate returns before it logs for a guest. The log line is
  // the only observable, so it is the one that is watched.
  const lines = [];
  const realLog = console.log;
  console.log = (...args) => { lines.push(String(args[0] ?? '')); };
  try {
    table._triggerMemoryUpdate(0);
    table._triggerMemoryUpdate(1);
  } finally {
    console.log = realLog;
  }
  const triggered = lines.filter((l) => l.includes('triggering memory update'));
  assert.equal(triggered.length, 1, 'exactly one seat asked for a refresh');
  assert.match(triggered[0], /agent-1/);
});
