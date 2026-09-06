// src/server/homeSit.test.js — SIT-1
//
// THE KITCHEN TABLE KEEPS DEALING WHEN THE OWNER SITS DOWN AT IT.
//
// The bug this file exists for, found by walking SIT-1's own screen in a real
// browser: the owner takes a chair, the JOIN is accepted, the seat is his —
// and the table never deals another hand. His turn never arrives, the four
// verbs stay grey forever, and a minute later the stall watchdog closes the
// game underneath him.
//
// The cause is one condition at the end of `_handCompleted`:
//
//     if (this.isAiOnly()) this._scheduleNextHand(...)
//
// `isAiOnly()` stops being true the instant a human seat exists, and every
// other way of starting a hand is closed to him too — a clientDriven
// `maybeStartHand` backs off while `autoPlay` is set, so DEAL would not have
// helped either. The table was wedged by construction.
//
// THE HOME GAME'S TEMPO IS THE SERVER'S. That is homeGame.js's whole shape:
// a slow deal pause, a hand cap and a cooldown, because nobody is necessarily
// watching. It has to stay the server's with the owner in a chair, which is
// why the fix is `isAiOnly() || home` and not a client that deals for itself.
//
// And the casino is asserted here too, in the other direction: a human seat
// there still stops the auto-deal. That table is somebody else's money and its
// own tree — dealing the next hand under a player who has not asked for one
// would take the table away from him.

// TEST-2 / the testing law: no automated suite talks to a real model.
delete process.env.ANTHROPIC_API_KEY;

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { HOME_BLINDS, HOME_BUYIN } from './homeGame.js';
import { _closeForTests } from './store.js';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-homesit-'));
const savedToken = process.env.TELEGRAM_BOT_TOKEN;

let registry;

before(async () => {
  delete process.env.TELEGRAM_BOT_TOKEN;
  _closeForTests();
  process.chdir(dir);
  registry = await import('./tableRegistry.js');
});

after(() => {
  try { registry?.closeAll?.('test over'); } catch { /* already gone */ }
  process.chdir(ORIGINAL_CWD);
  _closeForTests();
  if (savedToken) process.env.TELEGRAM_BOT_TOKEN = savedToken;
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* windows */ }
});

// A socket the table can hold and write to, and nothing more. Every message it
// is sent is kept, so a test can ask what the seat was actually told.
function fakeSocket() {
  const sent = [];
  return {
    readyState: 1,
    OPEN: 1,
    sent,
    send(raw) { sent.push(JSON.parse(raw)); },
    close() { this.readyState = 3; },
    addEventListener() {},
    removeEventListener() {},
  };
}

/**
 * A table with two AI seats and, optionally, the owner in a third.
 *
 * The seating is the real path — seatAI for the agents, seatPlayer for him —
 * because the whole question is what `_handCompleted` decides about the seats
 * that are actually there.
 */
function standUp(tableId, { home, seatOwner }) {
  const table = registry.getOrCreateTable(tableId, {
    smallBlind: HOME_BLINDS.smallBlind,
    bigBlind: HOME_BLINDS.bigBlind,
    maxSeats: 4,
    home,
  });
  table.seatAI({ displayName: 'The Grinder', buyIn: HOME_BUYIN });
  table.seatAI({ displayName: 'Doyle_v3', buyIn: HOME_BUYIN });
  if (seatOwner) {
    table.seatPlayer(fakeSocket(), { playerId: 'owner-1', buyIn: HOME_BUYIN, displayName: 'You' });
  }
  return table;
}

/** Did the table arm its next deal? The timer is the observable, not a log. */
function dealsAgain(table) {
  // `_handCompleted` is what runs at the end of every hand, and the scheduled
  // timer is the whole of "there will be another hand". Cleared first so the
  // assertion cannot pass on a deal that was already pending.
  if (table._nextHandTimer) { clearTimeout(table._nextHandTimer); table._nextHandTimer = null; }
  table._handCompleted();
  const armed = !!table._nextHandTimer;
  if (table._nextHandTimer) { clearTimeout(table._nextHandTimer); table._nextHandTimer = null; }
  return armed;
}

test('SIT-1: the kitchen table deals again with the owner in a chair', () => {
  const table = standUp('home-sit-1', { home: true, seatOwner: true });
  table.autoPlay = true;
  table.maybeStartHand();

  assert.equal(table.isAiOnly(), false, 'a seated owner is a human seat');
  assert.equal(dealsAgain(table), true,
    'the home game must keep dealing when the owner sits down at it');

  table.closeTable('test over');
});

test('SIT-1: and it still deals when he is only watching it', () => {
  // The regression guard on the other side of the change: the home game with
  // nobody but agents at it behaved correctly before and must still.
  const table = standUp('home-sit-2', { home: true, seatOwner: false });
  table.autoPlay = true;
  table.maybeStartHand();

  assert.equal(table.isAiOnly(), true);
  assert.equal(dealsAgain(table), true);

  table.closeTable('test over');
});

test('SIT-1: a casino table with a human at it still waits for him', () => {
  // Unchanged, and deliberately: in the casino a human seat IS the tempo.
  const table = standUp('casino-sit-1', { home: false, seatOwner: true });
  table.autoPlay = true;
  table.maybeStartHand();

  assert.equal(table.isAiOnly(), false);
  assert.equal(dealsAgain(table), false,
    'the casino must not deal the next hand under a player who has not asked');

  table.closeTable('test over');
});

test('SIT-1: the owner is dealt in, and the table offers him the hand', () => {
  // The other half of "he can play": the seat exists, it holds cards, and the
  // engine hands it legal actions. Without this the deal loop above would be
  // keeping an empty chair warm.
  const table = standUp('home-sit-3', { home: true, seatOwner: true });
  table.autoPlay = true;
  table.maybeStartHand();

  const ownerSeat = table.pending.findIndex((p) => p && p.playerId === 'owner-1');
  assert.ok(ownerSeat >= 0, 'the owner has a seat');
  assert.equal(table.game.seats.length, 3, 'three at the kitchen table');
  assert.equal(table.game.seats[ownerSeat].holeCards.length, 2, 'he is dealt in');

  // Somebody has to be first to act, and whoever it is has real options.
  const toAct = table.game.toAct;
  const legal = table.game.legalActions(toAct).map((a) => a.type);
  assert.ok(legal.includes('fold'), 'the hand is live');

  table.closeTable('test over');
});
