// FIRST-HOUSE-1: the casino can start heads-up without waiting for viewers or
// another owner. Exercise its real scheduler and engine with deterministic
// owner actions; the AI turn driver is paused so no policy/model is involved.
delete process.env.ANTHROPIC_API_KEY;

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Actions, Streets } from '../engine/game.js';
import { createDeck } from '../engine/deck.js';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-casino-start-'));
const store = await import('./store.js');
store._closeForTests();
process.chdir(scratch);
const { Table } = await import('./table.js');
const profiles = await import('./agentProfiles.js');
const { STAKES } = await import('./wallet.js');
const tables = new Set();

test.afterEach(() => {
  for (const table of tables) table.closeTable('test over');
  tables.clear();
});
test.after(() => {
  store._closeForTests();
  process.chdir(originalCwd);
  fs.rmSync(scratch, { recursive: true, force: true });
});

// A queued agent: the record says he is on his way to this table, and the WATCH
// that follows is what actually puts him in the chair.
//
// MONEY-2 job 1: his pocket has to hold a buy-in for the top rung this file
// plays, because WATCH now takes one. It used to be zero and the seat was free
// — chargeSeatBuyIn read `activeTableId`, which the queue route writes without
// spending anything, and concluded he had already paid. That was the third
// faucet, and a fixture that stays at zero would be asserting it is still open.
function resident(tableId, suffix = 'hero') {
  const owner = `${tableId}-${suffix}-owner`;
  const agent = { id: `${tableId}-${suffix}`, name: suffix, status: 'playing', activeTableId: tableId,
    strategy: 'Play patiently.', profile: { tightness: 75, aggression: 55, bluffFreq: 15, discipline: 80 },
    pocket: { balance: 10_000, mode: 'allowance', cap: null, realised: 0, ledger: [] },
    mood: { state: 'neutral', heat: 30, losingRun: 0 }, stats: { handsPlayed: 0, handsWon: 0 } };
  store.saveProfile(owner, { userId: owner, chat: [], agents: [agent] });
  store.saveWallet(owner, { ownerId: owner, balance: 0, ledger: [] });
  profiles.reloadOwners(owner);
  return { agentId: agent.id, userId: owner, displayName: agent.name, strategy: agent.strategy, agentProfile: agent.profile };
}
function createTable(name, options = {}) {
  const table = new Table({ tableId: name, smallBlind: 50, bigBlind: 100, maxSeats: 6, ...options });
  table._maybeRunAiTurn = async () => {};
  tables.add(table);
  return table;
}
function socket() {
  return { OPEN: 1, readyState: 1, messages: [], send(raw) { this.messages.push(JSON.parse(raw)); }, close() {} };
}
function watch(table, owner, ws = socket()) {
  const seat = table.addSpectator(ws, owner);
  table.maybeStartHand({ clientDriven: true });
  return { ws, seat };
}
const houseIds = table => table.pending.filter(p => p?.playerId.startsWith('house_')).map(p => p.playerId);

for (const stakes of STAKES) test(`FIRST-HOUSE-1: first queued WATCH at ${stakes.label} is immediately heads-up and server-driven`, t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const table = createTable(`first-${stakes.rung}`, stakes);
  const owner = resident(table.tableId);
  const { ws } = watch(table, owner);
  assert.equal(table.liveSeatCount(), 2, 'one ready House opponent, with four chairs still free');
  assert.equal(houseIds(table).length, 1);
  assert.equal(table.autoPlay, true, 'the server owns the first deal');
  assert.equal(table._houseFallbackTimer, null, 'there is no longer a five-second dependency on a viewer');
  assert.deepEqual(table.pending.filter(Boolean).map(p => p.buyIn), [stakes.buyIn, stakes.buyIn]);
  assert.equal(table.game, null, 'watching schedules a deal rather than dealing synchronously');
  t.mock.timers.tick(250);
  assert.equal(table.game.street, Streets.PREFLOP);
  assert.equal(table.game.seats.length, 2);
  assert.equal(table.game.bigBlind, stakes.bigBlind);
  assert.equal(table.game.pot + table.game.seats.reduce((sum, seat) => sum + seat.stack, 0), stakes.buyIn * 2);
  assert.ok(ws.messages.some(m => m.type === 'hand_start'));
});

test('FIRST-HOUSE-1: disconnect during the former fallback window cannot strand a queued agent', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const table = createTable('disconnect');
  const owner = resident(table.tableId);
  const { ws } = watch(table, owner);
  table.removeConnection(ws);
  assert.equal(table.spectators.length, 0);
  t.mock.timers.tick(5001);
  assert.equal(table.liveSeatCount(), 2, 'the House arrives even though nobody is watching');
  assert.equal(table.autoPlay, true);
  assert.equal(table.game?.handNumber, 1, 'the server dealt without needing a second WATCH');
  const before = table.pending.filter(Boolean).map(p => p.playerId);
  watch(table, owner);
  assert.deepEqual(table.pending.filter(Boolean).map(p => p.playerId), before, 'reconnect keeps the same seats');
});

test('FIRST-HOUSE-1: an already stranded legacy agent recovers on reattachment without duplicate House seats', () => {
  const table = createTable('legacy');
  const owner = resident(table.tableId);
  table.seatAI(owner);
  watch(table, owner);
  watch(table, owner);
  assert.equal(table.autoPlay, true);
  assert.equal(table.liveSeatCount(), 2);
  assert.equal(houseIds(table).length, 1);
});

test('FIRST-HOUSE-1: another owner can join the heads-up table and enter the next hand', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const table = createTable('join');
  const hero = resident(table.tableId);
  watch(table, hero);
  t.mock.timers.tick(250);
  assert.equal(table.game?.seats.length, 2);
  const newcomer = resident(table.tableId, 'newcomer');
  const seat = table.joinAgentSession(newcomer);
  assert.equal(seat, 2, 'the House does not take the remaining chairs');
  assert.equal(table.waitingForNextHand(seat), true);
  assert.equal(table.game.seats.length, 2, 'joining cannot change a live deal');
  table.game.act(table.game.toAct, { type: Actions.FOLD });
  table._handCompleted();
  t.mock.timers.tick(table._dealPauseMs());
  assert.equal(table.game.handNumber, 2);
  assert.equal(table.game.seats.length, 3);
  assert.equal(table.waitingForNextHand(seat), false);
  assert.equal(houseIds(table).length, 1);
});

function houseBusted(table) {
  const owner = resident(table.tableId);
  table.startAgentSession(owner);
  table._clearTimers();
  table._reconcileSeats();
  // Hero KK beats House QQ at showdown. The real engine awards the full pot.
  const prefix = ['Qh', 'Kh', 'Qd', 'Kd', '2c', 'Ks', '7c', '2h', '3c', '7h', '4c', '9c'];
  table.game.startHand([...prefix, ...createDeck().filter(card => !prefix.includes(card))]);
  table.game.act(0, { type: Actions.RAISE, amount: table.defaultBuyIn() });
  table.game.act(1, { type: Actions.CALL });
  assert.equal(table.game.street, Streets.COMPLETE);
  assert.deepEqual(table.game.seats.map(s => s.stack), [table.defaultBuyIn() * 2, 0]);
  return owner;
}

test('FIRST-HOUSE-1: a House bust gets one funded replacement before the normal next-deal pause', t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const table = createTable('bust');
  const owner = houseBusted(table);
  const sessionId = table.sessionIdFor(owner.agentId);
  table._handCompleted();
  assert.equal(table.closed, false);
  assert.equal(table.liveSeatCount(), 2, 'the winner is never parked alone for the 20-second repair');
  assert.equal(houseIds(table).length, 1);
  assert.equal(table._lonelyTimer, null);
  assert.equal(table.sessionIdFor(owner.agentId), sessionId, 'opponent replacement keeps the same owned session');
  // MONEY-2 job 3: the engine awards the whole pot and the house then takes its
  // cut off the winner's stack, so what he carries into the next hand is the
  // award less the rake. `houseBusted` moved both buy-ins into one seat.
  const cut = table.seatRakePaid(0);
  assert.ok(cut > 0, 'a 20,000 all-in pot is raked');
  assert.equal(table.seatStack(0), 20_000 - cut,
    'the winner keeps the engine-awarded stack, less the house cut');
  assert.equal(table.seatStack(1), 10_000, 'the replacement has the table buy-in');
  assert.ok(table._nextHandTimer, 'normal server pacing schedules the next deal');
  t.mock.timers.tick(table._dealPauseMs());
  assert.equal(table.game.handNumber, 2);
  assert.equal(table.game.seats.length, 2);
});

test('FIRST-HOUSE-1: a House bust at the session cap closes normally instead of extending the session', () => {
  const table = createTable('capped');
  houseBusted(table);
  table.maxHands = 1;
  table._handCompleted();
  assert.equal(table.closed, true, 'opponent readiness must not bypass the existing hand cap');
});

test('FIRST-HOUSE-1: a held showdown finishes displaying its original seats before House replacement', () => {
  const table = createTable('held-bust');
  const owner = houseBusted(table);
  const original = table.game;
  table.addSpectator(socket(), owner);
  table._handCompleted();
  assert.ok(table._pendingPaceResult, 'the all-in award has a staged visual hold');
  assert.equal(table.game, original);
  assert.equal(table.seatStack(1), 0, 'the busted player still belongs to this visible showdown');
  table._finishPaceHold();
  assert.equal(table.liveSeatCount(), 2);
  assert.equal(table.seatStack(1), 10_000);
  assert.equal(table._pendingPaceResult, null);
});

test('FIRST-HOUSE-1: readiness leaves home, human and full tables alone', () => {
  const home = createTable('home', { home: true });
  watch(home, resident(home.tableId));
  assert.equal(home.liveSeatCount(), 1);
  assert.equal(houseIds(home).length, 0);
  assert.equal(home.autoPlay, false);
  const human = createTable('human');
  human.seatPlayer(socket(), { playerId: 'person', buyIn: 10_000 });
  human.maybeStartHand({ clientDriven: true });
  assert.equal(human.seatedCount(), 1);
  assert.equal(houseIds(human).length, 0);
  assert.equal(human.autoPlay, false);
  const broke = createTable('broke');
  broke.seatAI({ ...resident(broke.tableId), buyIn: 0 });
  broke.maybeStartHand({ clientDriven: true });
  assert.equal(houseIds(broke).length, 0, 'an empty owned stack cannot create a House-only session');
  assert.equal(broke.autoPlay, false);
  const full = createTable('full', { maxSeats: 2 });
  full.seatAI({ displayName: 'A' }); full.seatAI({ displayName: 'B' });
  full.maybeStartHand({ clientDriven: true });
  assert.equal(full.seatedCount(), 2);
  assert.equal(houseIds(full).length, 0);
});
