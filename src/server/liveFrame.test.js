// src/server/liveFrame.test.js — SERVER-4 job 6
//
// What the card can say about a man who is out.
//
// The floor's live frame carried a stack and a board and nothing to read them
// against. Three things are added here, and each one closes a question the
// client had to guess at or leave blank:
//
//   net             his chips now minus what he sat down with. `heroStack`
//                   alone cannot be turned into "+340" without remembering a
//                   buy-in from a message that may never have arrived.
//   hot             is this table on fire. The same flag the lobby's rooms
//                   carry, read from the same window, so the frame on his card
//                   and the flame on his room can never disagree.
//   location.room   where he is walking to. A QUEUED agent has a table id and
//                   no table — the felt does not exist until an opponent turns
//                   up — so the derived room was null and the card could only
//                   say "at the casino, somewhere".

delete process.env.ANTHROPIC_API_KEY;

import test, { after } from 'node:test';
import assert from 'node:assert/strict';

import { Table } from './table.js';
import { locationFor, Where } from './home.js';
import { emitCasinoEvent, EventType, resetEvents, HOT_RECENT_MS } from './events.js';

const BUY_IN = 1_000;

// ── net ─────────────────────────────────────────────────────────────────────

test('SERVER-4: the live frame says what the stay is worth so far', () => {
  const table = mkTable('frame-net');
  const seat = seatAgent(table, 'him');

  // Nothing has happened yet. Zero, not null: a client drawing a P&L needs a
  // number on the first frame, and "he is level" is the honest one.
  assert.equal(frame(table, 'him').net, 0);

  // He is up 340.
  table.seatStacks[seat] = BUY_IN + 340;
  assert.equal(frame(table, 'him').net, 340);

  // And down 200.
  table.seatStacks[seat] = BUY_IN - 200;
  assert.equal(frame(table, 'him').net, -200);

  table.closeTable('test over', { recap: 'test over' });
});

test('SERVER-4: it is the same arithmetic the ceremony closes the stay with', () => {
  const table = mkTable('frame-agree');
  const seat = seatAgent(table, 'him');
  table.seatStacks[seat] = BUY_IN + 555;

  // SESSION_END's `net` is final stack minus buy-in. A frame that measured the
  // same stay differently would make the ceremony look like it disagreed with
  // the card the owner had been watching all evening.
  const ending = table._sessionEndFor(seat, {
    reason: 'stopped',
    finalStack: table._seatFinalStack(seat),
    buyIn: table._seatBuyIn(seat),
    sessionHands: 10,
  });
  assert.equal(frame(table, 'him').net, ending.net);

  table.closeTable('test over', { recap: 'test over' });
});

// ── hot ─────────────────────────────────────────────────────────────────────

test('SERVER-4: the frame knows whether the table is on fire', () => {
  resetEvents();
  const table = mkTable('frame-hot');
  seatAgent(table, 'him');

  assert.equal(frame(table, 'him').hot, false, 'a quiet table is not hot');

  emitCasinoEvent({
    type: EventType.HOT, tableId: 'frame-hot', agentIds: ['him'],
    headline: 'a big pot on the river', pot: 4_000,
  });
  assert.equal(frame(table, 'him').hot, true);

  // A flag on a clock: the whole value of it is that there is still time to go
  // and watch, so it must not outlive the window rooms.js reads it over.
  assert.ok(HOT_RECENT_MS > 0);

  // Somebody else's table catching fire is not his.
  const other = mkTable('frame-cold');
  seatAgent(other, 'her');
  assert.equal(frame(other, 'her').hot, false);

  table.closeTable('test over', { recap: 'test over' });
  other.closeTable('test over', { recap: 'test over' });
  resetEvents();
});

// ── location.room, for a man with no table yet ──────────────────────────────

test('SERVER-4: a queued agent is walking somewhere, and the card can say where', () => {
  // The queued case exactly: he has been sent, the felt does not exist yet, so
  // nothing can be derived from a table's blinds.
  const walking = locationFor({ presence: 'resting', tableId: 'tbl-q', room: null, headingTo: 'upstairs' });
  assert.equal(walking.where, Where.CASINO);
  assert.equal(walking.room, 'upstairs');
});

test('SERVER-4: a live table always wins over the room he was sent to', () => {
  // home.js rule 1: location is DERIVED, never declared. `headingTo` is a
  // fallback and nothing else — if it could override a live reading it would
  // be the stale stored flag BUG-16 was about.
  const seated = locationFor({ presence: 'resting', tableId: 'tbl-1', room: 'backroom', headingTo: 'floor' });
  assert.equal(seated.room, 'backroom');

  const playing = locationFor({ presence: 'playing', tableId: 'tbl-1', room: 'backroom', headingTo: 'floor' });
  assert.equal(playing.where, Where.TABLE);
  assert.equal(playing.room, 'backroom');
});

test('SERVER-4: a man at home is on his way nowhere', () => {
  // No table id, so there is no walk in progress and a leftover destination
  // must not put him in a room he is not in.
  const home = locationFor({ presence: 'resting', tableId: null, headingTo: 'backroom' });
  assert.equal(home.where, Where.HOME);
  assert.equal(home.room, null);
});

test('SERVER-4: an agent with nowhere to be still answers, rather than guessing', () => {
  const unknown = locationFor({ presence: 'resting', tableId: 'tbl-gone', room: null, headingTo: null });
  assert.equal(unknown.where, Where.CASINO);
  assert.equal(unknown.room, null, 'his table died under him; the room is unknown and says so');
});

// ── harness ─────────────────────────────────────────────────────────────────

after(() => { resetEvents(); });

function mkTable(tableId) {
  return new Table({ tableId, smallBlind: 10, bigBlind: 20, maxSeats: 6 });
}

// One agent seated on an AI-only table, which is what makes liveGameView answer
// at all (a human-only table correctly reports him as resting).
function seatAgent(table, agentId) {
  const seat = table.seatAI({
    displayName: agentId, strategy: '', agentId, userId: 'u1',
    agentProfile: { tightness: 50, aggression: 50, bluffFreq: 20, discipline: 60 },
    buyIn: BUY_IN,
  });
  table.autoPlay = true;
  return seat;
}

function frame(table, agentId) {
  const view = table.liveGameView(agentId, { includeHole: true });
  assert.ok(view, 'the table should have a frame for a seated agent');
  return view;
}
