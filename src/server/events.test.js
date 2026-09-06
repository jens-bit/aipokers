// src/server/events.test.js — EVENT-1
//
// The bus and the ring, on their own. No table, no socket, no model: this file
// asserts the contract that src/server/table.events.test.js then drives real
// hands through.

import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import {
  bus, EventType, EVENT_RING_SIZE, HEATER_WINDOW, HEATER_WINS,
  emitCasinoEvent, eventsSince, lastEventId, ringSize, noteHandWin,
  resetEvents, installEventRoutes, bigPotThresholdBb, hotThresholdBb,
} from './events.js';
import { heatThresholdBb } from './pace.js';
import * as floor from './floorChannel.js';
import { ServerMsg } from './protocol.js';

beforeEach(() => resetEvents());

test('EVENT-1: an event carries exactly the ticker fields, and nothing else', () => {
  const ev = emitCasinoEvent({
    type: EventType.BIG_POT,
    tableId: 'table-9',
    agentIds: ['a1', 'a2', 'a1', null, ''],
    headline: 'Rounder and Taker played a 90bb pot',
    pot: 1800.4,
    handNumber: 12,
  });

  // EVENTS-3 added handNumber. It is an ADDRESS, not a hand: the same counter
  // the felt already shows, carrying no card, no reasoning and no owner. The
  // channel ticker needs it to ask SHARE-2 whether a card exists for exactly
  // this hand instead of matching on a timestamp and hoping.
  assert.deepEqual(Object.keys(ev).sort(),
    ['agentIds', 'handNumber', 'headline', 'id', 'pot', 'tableId', 'ts', 'type'],
    'the shape is { id, ts, type, tableId, agentIds, headline, pot, handNumber } — a headline, not a hand');
  assert.equal(ev.id, 1, 'ids start at 1');
  assert.equal(ev.tableId, 'table-9');
  assert.deepEqual([...ev.agentIds], ['a1', 'a2'], 'agentIds are deduped and blanks dropped');
  assert.equal(ev.pot, 1800, 'the pot is rounded to whole chips');
  assert.equal(ev.handNumber, 12, 'and it says which hand it was about');
  assert.ok(ev.ts > 0, 'it is stamped');
});

test('EVENT-1: an unknown type is refused rather than put on the wire', () => {
  assert.throws(() => emitCasinoEvent({ type: 'jackpot', tableId: 't' }), /unknown event type/);
  assert.equal(ringSize(), 0, 'and nothing was stored');
});

test('EVENT-1: ids are monotonic and `since` returns only what is newer', () => {
  const a = emitCasinoEvent({ type: EventType.BUST, tableId: 't', headline: 'one' });
  const b = emitCasinoEvent({ type: EventType.BUST, tableId: 't', headline: 'two' });
  const c = emitCasinoEvent({ type: EventType.BUST, tableId: 't', headline: 'three' });

  assert.deepEqual([a.id, b.id, c.id], [1, 2, 3]);
  assert.deepEqual(eventsSince(0).map((e) => e.headline), ['one', 'two', 'three']);
  assert.deepEqual(eventsSince(a.id).map((e) => e.headline), ['two', 'three']);
  assert.deepEqual(eventsSince(c.id), [], 'a caught-up client gets nothing');
  assert.equal(lastEventId(), c.id, 'and is told the id to send back next time');
});

test('EVENT-1: the buffer is a ring of the last 200, and the overflowed ids stay gone', () => {
  for (let i = 0; i < EVENT_RING_SIZE + 50; i++) {
    emitCasinoEvent({ type: EventType.HOT, tableId: 't', headline: `hand ${i}` });
  }
  assert.equal(ringSize(), EVENT_RING_SIZE, 'it never grows past 200');

  const all = eventsSince(0);
  assert.equal(all.length, EVENT_RING_SIZE);
  assert.equal(all[0].headline, 'hand 50', 'the oldest 50 fell off the front');
  assert.equal(all[all.length - 1].headline, `hand ${EVENT_RING_SIZE + 49}`);

  // A client that has been away longer than the ring is shown what is
  // happening NOW, not the oldest thing still in memory.
  const recent = eventsSince(0, { limit: 3 });
  assert.deepEqual(recent.map((e) => e.headline),
    [`hand ${EVENT_RING_SIZE + 47}`, `hand ${EVENT_RING_SIZE + 48}`, `hand ${EVENT_RING_SIZE + 49}`]);
});

test('EVENT-1: every emit is pushed to bus listeners', () => {
  const seen = [];
  const listener = (ev) => seen.push(ev.headline);
  bus.on('event', listener);
  try {
    emitCasinoEvent({ type: EventType.COOLER, tableId: 't', headline: 'coolered' });
    emitCasinoEvent({ type: EventType.HEATER, tableId: 't', headline: 'heater' });
  } finally {
    bus.off('event', listener);
  }
  assert.deepEqual(seen, ['coolered', 'heater']);
});

test('EVENT-1: a listener that throws does not take the hand down with it', () => {
  const angry = () => { throw new Error('client bug'); };
  bus.on('event', angry);
  try {
    const ev = emitCasinoEvent({ type: EventType.BUST, tableId: 't', headline: 'still stored' });
    assert.equal(ev.headline, 'still stored');
    assert.equal(ringSize(), 1, 'the event is on the wire even though the listener blew up');
  } finally {
    bus.off('event', angry);
  }
});

test('EVENT-1: the two pot thresholds are derived from PACE_HEAT_BB, not set on their own', () => {
  const before = process.env.PACE_HEAT_BB;
  try {
    process.env.PACE_HEAT_BB = '25';
    assert.equal(hotThresholdBb(), 25, 'hot uses the felt\'s own threshold');
    assert.equal(bigPotThresholdBb(), 75, 'bigPot is three times it');

    process.env.PACE_HEAT_BB = '40';
    assert.equal(heatThresholdBb(), 40);
    assert.equal(hotThresholdBb(), 40, 'retuning the felt retunes the ticker');
    assert.equal(bigPotThresholdBb(), 120, 'one dial, not three');
  } finally {
    if (before === undefined) delete process.env.PACE_HEAT_BB;
    else process.env.PACE_HEAT_BB = before;
  }
});

test('EVENT-1: a heater is 5 of the last 6, and it fires once on the way in', () => {
  const id = 'agent-hot';
  // Four wins and a loss: close, but not yet.
  for (const won of [true, true, true, true, false]) {
    assert.equal(noteHandWin(id, won).hot, false, 'four of five is not a heater');
  }
  const fifth = noteHandWin(id, true);
  assert.equal(fifth.hot, true, `${HEATER_WINS} of the last ${HEATER_WINDOW} is`);
  assert.equal(fifth.crossed, true, 'and this is the hand that crossed the line');
  assert.equal(fifth.wins, 5);
  assert.equal(fifth.hands, HEATER_WINDOW);

  // Still true, but no longer news — a ticker that repeats itself is a ticker
  // nobody reads.
  const sixth = noteHandWin(id, true);
  assert.equal(sixth.hot, true);
  assert.equal(sixth.crossed, false, 'it does not fire again while it stays true');

  // Cool off, and he can earn it again.
  for (let i = 0; i < HEATER_WINDOW; i++) noteHandWin(id, false);
  assert.equal(noteHandWin(id, false).hot, false, 'the window slid off the wins');
  for (let i = 0; i < HEATER_WINS - 1; i++) noteHandWin(id, true);
  assert.equal(noteHandWin(id, true).crossed, true, 'and crossing again is news again');
});

test('EVENT-1: heater windows are per agent, not shared', () => {
  for (let i = 0; i < HEATER_WINS; i++) noteHandWin('agent-a', true);
  const other = noteHandWin('agent-b', true);
  assert.equal(other.hot, false, 'one man\'s run says nothing about the next seat');
  assert.equal(noteHandWin('agent-a', true).hot, true);
  assert.equal(noteHandWin(null, true), null, 'a seat with no agent behind it is not tracked');
});

// ── WS push ─────────────────────────────────────────────────────────────────

test('EVENT-1: every floor subscriber gets the EVENT push, whoever the event is about', () => {
  const mkWs = () => ({ readyState: 1, OPEN: 1, sent: [], send(p) { this.sent.push(JSON.parse(p)); } });
  const mine = mkWs();
  const someoneElses = mkWs();
  floor.configure({ liveTables: null });
  floor.subscribe(mine, { userId: 'owner-a', owner: true });
  floor.subscribe(someoneElses, { userId: 'owner-b', owner: false });
  try {
    const ev = emitCasinoEvent({
      type: EventType.HOT, tableId: 't1', agentIds: ['a1'],
      headline: '40bb on the river, Rounder and Taker still live', pot: 800,
    });

    for (const [who, ws] of [['the owner', mine], ['a stranger', someoneElses]]) {
      const pushed = ws.sent.filter((m) => m.type === ServerMsg.EVENT);
      assert.equal(pushed.length, 1, `${who} was pushed the event`);
      assert.deepEqual(pushed[0].event, ev, 'verbatim, ids and all');
    }
    // The ticker is NOT filtered by owner: an event about somebody else's
    // agent at a table you have never seen is the whole reason it exists.

    floor.unsubscribe(someoneElses);
    emitCasinoEvent({ type: EventType.BUST, tableId: 't1', headline: 'gone' });
    assert.equal(someoneElses.sent.filter((m) => m.type === ServerMsg.EVENT).length, 1,
      'and it stops when the subscription does');
    assert.equal(mine.sent.filter((m) => m.type === ServerMsg.EVENT).length, 2);
  } finally {
    floor.reset();
  }
});

test('EVENT-1: configure() twice does not double up the relay', () => {
  const ws = { readyState: 1, OPEN: 1, sent: [], send(p) { this.sent.push(JSON.parse(p)); } };
  floor.configure({ liveTables: null });
  floor.configure({ liveTables: null });
  floor.configure({ liveTables: null });
  floor.subscribe(ws, { userId: 'owner-a', owner: true });
  try {
    emitCasinoEvent({ type: EventType.HEATER, tableId: 't1', headline: 'once' });
    assert.equal(ws.sent.filter((m) => m.type === ServerMsg.EVENT).length, 1,
      'three servers composed in one process still means one listener');
  } finally {
    floor.reset();
  }
});

// ── GET /api/events ─────────────────────────────────────────────────────────

let server;
let base;

after(() => server?.close());

test('EVENT-1: GET /api/events?since=<id> serves the same ring the socket pushes', async () => {
  const app = express();
  app.use(express.json());
  installEventRoutes(app);
  server = http.createServer(app);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${server.address().port}`;

  const first = emitCasinoEvent({ type: EventType.HOT, tableId: 't1', headline: 'first', pot: 500 });
  const second = emitCasinoEvent({ type: EventType.BIG_POT, tableId: 't1', headline: 'second', pot: 1800 });

  const all = await fetch(`${base}/api/events`).then((r) => r.json());
  assert.deepEqual(all.events.map((e) => e.headline), ['first', 'second'], 'no `since` means the whole ring');
  assert.equal(all.lastId, second.id);

  const tail = await fetch(`${base}/api/events?since=${first.id}`).then((r) => r.json());
  assert.deepEqual(tail.events.map((e) => e.headline), ['second']);

  const garbage = await fetch(`${base}/api/events?since=banana`).then((r) => r.json());
  assert.equal(garbage.events.length, 2, 'a junk cursor is treated as "from the start", not as an error');

  const res = await fetch(`${base}/api/events`);
  assert.equal(res.headers.get('cache-control'), 'no-store', 'a ticker is never cached');
});
