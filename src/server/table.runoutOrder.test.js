// BUG-144: the terminal STATE already contains the engine's final board.
// Put the held-board PACE on the wire first, so the real client queue cannot
// show the unseen cards during its four-second terminal-state dwell.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createQueue, pushFrame, advance } from '../../client/src/lib/pace.js';

delete process.env.ANTHROPIC_API_KEY;
const { Table } = await import('./table.js');
const { Actions, Streets } = await import('../engine/game.js');
const { holdPlan, seedFor } = await import('./pace.js');
const { Dealer, createDeck } = await import('../engine/deck.js');
const { _closeForTests } = await import('./store.js');
const { readThread, setLineListener } = await import('./thread.js');
after(() => _closeForTests());

const socket = () => ({ OPEN: 1, readyState: 1, sent: [], send(raw) { this.sent.push(JSON.parse(raw)); } });
let sequence = 0;
function onFlop(t, { watched = true, preflop = false } = {}) {
  const table = new Table({ tableId: `bug144-${++sequence}`, home: true,
    smallBlind: 10, bigBlind: 20, maxSeats: 4, handPauseMs: 3000 });
  for (const [seat, buyIn] of [200, 2000, 2000].entries()) {
    table.seatPlayer(socket(), { playerId: `p${seat}`, displayName: `P${seat}`, buyIn });
  }
  table.autoPlay = true;
  table.maybeStartHand();
  const viewer = socket();
  if (watched) table.addSpectator(viewer);
  if (!preflop) {
    while (table.game.street === Streets.PREFLOP) checkOrCall(table);
    assert.equal(table.game.community.length, 3);
  }
  t.after(() => table._clearTimers());
  return { table, viewer };
}

function checkOrCall(table) {
  const seat = table.game.toAct;
  const legal = table.game.legalActions(seat);
  const action = legal.find((a) => a.type === Actions.CHECK) ?? legal.find((a) => a.type === Actions.CALL);
  table.applyAction(table.connections[seat], { type: action.type });
}

function closeWithAllIn(table) {
  // Flop starts at seat 1. One folds with chips left; two contest the all-in.
  // The two deeper stacks survive, so the table can retain its staged result.
  assert.equal(table.game.toAct, 1);
  table.applyAction(table.connections[1], { type: Actions.FOLD });
  checkOrCall(table);
  assert.equal(table.game.toAct, 0);
  const jam = table.game.legalActions(0).find((a) => a.type === Actions.RAISE || a.type === Actions.BET);
  table.applyAction(table.connections[0], { type: jam.type, amount: jam.max });
  assert.equal(table.game.toAct, 2);
}

test('BUG-144: held-board PACE precedes terminal STATE and preserves the award schedule', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  const heldBoard = [...table.game.community];
  closeWithAllIn(table);
  viewer.sent.length = 0;
  checkOrCall(table);
  const terminal = viewer.sent.findIndex((msg) => msg.type === 'state' && msg.state.street === Streets.COMPLETE);
  assert.ok(terminal >= 0, 'the real table sent the final state');
  const priorPace = viewer.sent.slice(0, terminal).filter((msg) => msg.type === 'pace').at(-1);
  assert.deepEqual(priorPace?.board, heldBoard, 'the viewer must know the held board before receiving all five cards');
  assert.equal(priorPace.pace, 'allin');
  assert.equal(viewer.sent[terminal].state.community.length, 5, 'engine state stays complete');
  assert.equal(viewer.sent.some((msg) => msg.type === 'hand_result'), false);
  const plan = holdPlan({ heldBoard, runout: table.game.community.slice(3),
    seed: seedFor(table.tableId, table.game.handNumber), watched: true });
  t.mock.timers.tick(plan.awardAt - 1);
  assert.equal(viewer.sent.some((msg) => msg.type === 'hand_result'), false, 'no early award');
  t.mock.timers.tick(1);
  assert.equal(viewer.sent.filter((msg) => msg.type === 'hand_result').length, 1, 'same authored award time, once');
  assert.equal(viewer.sent.filter((msg) => msg.type === 'pace' && msg.card).length, 2, 'only unseen turn and river stage');
});

test('BUG-144: actual outgoing frames never expose the final board through the client queue before runout', (t) => {
  const { table, viewer } = onFlop(t);
  closeWithAllIn(table);
  let game = table._augmentState(table.game.getPublicState(0), 0);
  let paceFrame = null;
  const q = createQueue({ game, paceFrame }, 0);
  viewer.sent.length = 0;
  checkOrCall(table);
  let now = 100;
  for (const msg of viewer.sent) {
    if (msg.type === 'pace') {
      paceFrame = { pace: msg.pace, board: msg.board ?? null, card: msg.card ?? null };
      game = { ...game, pace: paceFrame.pace, paceFrame };
    } else if (msg.type === 'state') game = msg.state;
    else continue;
    pushFrame(q, { game, paceFrame }, now);
    advance(q, now++);
    const shown = q.shown.paceFrame?.board ?? q.shown.game.community;
    assert.equal(shown.length, 3, 'no release can briefly reveal the unseen turn or river');
  }
  advance(q, 5000);
  assert.equal(q.shown.game.community.length, 5);
  assert.equal(q.shown.paceFrame.board.length, 3, 'the four-second result dwell still shows only the held flop');
});

test('BUG-144: unwatched all-ins keep immediate results without a synthetic held board', (t) => {
  const { table } = onFlop(t, { watched: false });
  closeWithAllIn(table);
  const human = table.connections[2];
  human.sent.length = 0;
  checkOrCall(table);
  assert.equal(human.sent.some((msg) => msg.type === 'pace' && Array.isArray(msg.board)), false);
  assert.equal(human.sent.filter((msg) => msg.type === 'hand_result').length, 1);
});

test('BUG-144: a preflop all-in announces an empty visible board before all five unseen cards', (t) => {
  const { table, viewer } = onFlop(t, { preflop: true });
  const jam = table.game.legalActions(0).find((a) => a.type === Actions.RAISE);
  table.applyAction(table.connections[0], { type: Actions.RAISE, amount: jam.max });
  table.applyAction(table.connections[1], { type: Actions.FOLD });
  viewer.sent.length = 0;
  checkOrCall(table);
  const terminal = viewer.sent.findIndex((msg) => msg.type === 'state' && msg.state.street === Streets.COMPLETE);
  const priorPace = viewer.sent.slice(0, terminal).filter((msg) => msg.type === 'pace').at(-1);
  assert.deepEqual(priorPace.board, []);
  assert.deepEqual(viewer.sent[terminal].state.paceFrame.board, []);
  assert.equal(viewer.sent[terminal].state.community.length, 5);
});

test('BUG-144: an already visible river gets no initial held-board frame', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  while (table.game.street !== Streets.RIVER) checkOrCall(table);
  closeWithAllIn(table);
  viewer.sent.length = 0;
  checkOrCall(table);
  assert.equal(viewer.sent.some((msg) => msg.type === 'pace' && Array.isArray(msg.board)), false);
  assert.equal(table.game.community.length, 5);
  const plan = holdPlan({ heldBoard: table.game.community, runout: [],
    seed: seedFor(table.tableId, table.game.handNumber), watched: true });
  t.mock.timers.tick(plan.awardAt);
  const final = viewer.sent.filter((msg) => msg.type === 'pace').at(-1);
  assert.equal(final.pace, 'showdown', 'a river all-in also leaves the all-in state at award');
  assert.deepEqual(final.board, table.game.community);
  assert.equal(final.card, undefined, 'settling an already visible river does not land another card');
});

test('BUG-144: STATE and late snapshots retain the current staged board until the next deal', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  const heldBoard = [...table.game.community];
  closeWithAllIn(table);
  viewer.sent.length = 0;
  checkOrCall(table);
  const terminal = viewer.sent.find((msg) => msg.type === 'state' && msg.state.street === Streets.COMPLETE);
  assert.deepEqual(terminal.state.paceFrame?.board, heldBoard, 'a consumer of STATE alone sees the held board too');
  const plan = holdPlan({ heldBoard, runout: table.game.community.slice(3),
    seed: seedFor(table.tableId, table.game.handNumber), watched: true });
  t.mock.timers.tick(plan.holdMs);
  const late = socket();
  table.sendSnapshot(late, 0);
  assert.deepEqual(late.sent[0].state.paceFrame.board, table.game.community.slice(0, 4));
  assert.equal(late.sent[0].state.paceFrame.card, table.game.community[3]);
  t.mock.timers.tick(plan.totalMs + 3000 - plan.holdMs);
  assert.equal(table.game.handNumber, 2);
  late.sent.length = 0;
  table.sendSnapshot(late, 0);
  assert.equal(late.sent[0].state.paceFrame, undefined, 'the prior runout does not leak into the next deal');
});

function headsUpBust(t, { stranded = false } = {}) {
  const table = new Table({ tableId: `bug144-hu-${++sequence}`, home: !stranded,
    smallBlind: 10, bigBlind: 20, maxSeats: 4, handPauseMs: 3000 });
  for (const [seat, buyIn] of [200, 2000].entries()) {
    table.seatPlayer(socket(), { playerId: `p${seat}`, displayName: `P${seat}`, buyIn });
  }
  table.autoPlay = true;
  table.maybeStartHand();
  const viewer = socket();
  table.addSpectator(viewer);
  table.game.seats[0].holeCards = ['2c', '3c'];
  table.game.seats[1].holeCards = ['As', 'Ah'];
  const runout = ['4c', '5h', '7d', '9s', '8c', 'Jc', 'Tc', 'Qh'];
  const used = new Set([...runout, ...table.game.seats.flatMap((s) => s.holeCards)]);
  table.game.dealer = new Dealer([...runout, ...createDeck().filter((card) => !used.has(card))]);
  if (stranded) {
    table.agentIds[1] = 'stranded-agent';
    table.agentUserIds[1] = 'stranded-owner';
  }
  t.after(() => table._clearTimers());
  const jam = table.game.legalActions(0).find((a) => a.type === Actions.RAISE);
  table.applyAction(table.connections[0], { type: Actions.RAISE, amount: jam.max });
  checkOrCall(table);
  return { table, viewer };
}

function planFor(table) {
  return holdPlan({ heldBoard: table._boardBeforeAct,
    runout: table.game.community.slice(table._boardBeforeAct.length),
    seed: seedFor(table.tableId, table.game.handNumber), watched: true });
}

function recordResultThread(t, table, viewer) {
  table.agentIds[0] = `thread-agent-${table.tableId}`;
  table.agentUserIds[0] = 'thread-owner';
  table.seatSessionIds[0] = `session-${table.tableId}`;
  const session = table.seatSessionIds[0];
  const spectator = table.spectators.find(entry => entry.ws === viewer);
  if (spectator) spectator.spectatorSeat = 0;
  setLineListener(line => table.deliverThreadLine(line));
  t.after(() => setLineListener(null));
  return () => readThread(session, { owner: true }).filter(line => line.category === 'result');
}

test('BUG-272: live and reloaded result threads wait for the staged award', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  const results = recordResultThread(t, table, viewer);
  closeWithAllIn(table);
  checkOrCall(table);
  const pushed = () => viewer.sent.filter(msg => msg.type === 'thread_line' && msg.line.category === 'result');
  assert.equal(results().length, 0, 'reloading history during the runout cannot reveal the winner');
  assert.equal(pushed().length, 0, 'the live Handlog cannot reveal the winner');
  t.mock.timers.tick(planFor(table).awardAt - 1);
  assert.equal(results().length, 0);
  t.mock.timers.tick(1);
  assert.equal(results().length, 1);
  assert.equal(pushed().length, 1);
  assert.match(results()[0].text, /P[012].*showdown/);
  table._finishPaceHold();
  assert.equal(results().length, 1, 'a repeated finish cannot duplicate the persisted award');
});

test('BUG-272: forced closure publishes one result before clearing the session', t => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  const results = recordResultThread(t, table, viewer);
  closeWithAllIn(table);
  checkOrCall(table);
  assert.equal(results().length, 0);
  table.closeTable('forced during runout');
  assert.equal(results().length, 1);
  const award = viewer.sent.findIndex(msg => msg.type === 'thread_line' && msg.line.category === 'result');
  const close = viewer.sent.findIndex(msg => msg.type === 'table_closed');
  assert.ok(award >= 0 && close > award);
  t.mock.timers.tick(60_000);
  assert.equal(results().length, 1);
});

test('BUG-272: an unwatched result is recorded immediately', t => {
  const { table } = onFlop(t, { watched: false });
  const results = recordResultThread(t, table);
  closeWithAllIn(table);
  checkOrCall(table);
  assert.equal(results().length, 1);
});

function assertFinalBeforeClose(messages) {
  const award = messages.findIndex((msg) => msg.type === 'hand_result');
  const close = messages.findIndex((msg) => msg.type === 'table_closed');
  assert.ok(award >= 0 && close > award, 'the award precedes closure');
  const final = messages.slice(0, award).filter((msg) => msg.type === 'pace').at(-1);
  assert.equal(final.pace, 'showdown');
  assert.equal(final.board.length, 5, 'closure cannot strand a partial board');
  assert.equal(final.card, undefined);
}

test('BUG-144: a watched heads-up bust finishes its runout before naturally closing', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = headsUpBust(t);
  assert.equal(table.closed, false, 'the bust cannot cancel the authored reveal');
  const complete = table.game;
  const plan = planFor(table);
  t.mock.timers.tick(plan.awardAt - 1);
  assert.equal(table.game, complete);
  assert.equal(table.closed, false);
  t.mock.timers.tick(1);
  assert.equal(table.closed, true);
  assertFinalBeforeClose(viewer.sent);
});

test('BUG-144: reaching the session hand cap preserves the final runout and award', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  table.maxHands = 1;
  closeWithAllIn(table);
  checkOrCall(table);
  assert.equal(table.closed, false, 'the session cap waits for the final award');
  const plan = planFor(table);
  t.mock.timers.tick(plan.awardAt);
  assert.equal(table.closed, true);
  assertFinalBeforeClose(viewer.sent);
});

test('BUG-144: a forced close flushes the final board and award exactly once', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  closeWithAllIn(table);
  checkOrCall(table);
  table.closeTable('forced close while revealing');
  assert.equal(table.closed, true);
  assertFinalBeforeClose(viewer.sent);
  t.mock.timers.tick(60_000);
  assert.equal(viewer.sent.filter((msg) => msg.type === 'hand_result').length, 1);
  assert.equal(viewer.sent.filter((msg) => msg.type === 'table_closed').length, 1);
});

test('BUG-144: a stranded winner keeps the completed game until award before roster reconciliation', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = headsUpBust(t, { stranded: true });
  assert.equal(table.game?.street, Streets.COMPLETE, 'the lonely-table path must not erase the reveal');
  const plan = planFor(table);
  t.mock.timers.tick(plan.awardAt);
  assert.equal(viewer.sent.filter((msg) => msg.type === 'hand_result').length, 1);
  assert.equal(table.closed, false, 'the survivor still waits for a new opponent');
  assert.equal(table.seatedCount(), 1);
});

test('BUG-144: a departing seat remains in the result until award and manual DEAL cannot skip it', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  table.game.community = ['5h', '7d', '9s'];
  table.game.seats[0].holeCards = ['As', 'Ah'];
  table.game.seats[1].holeCards = ['Ks', 'Kd'];
  table.game.seats[2].holeCards = ['2c', '3c'];
  const runout = ['8c', 'Jc', 'Tc', 'Qh'];
  const used = new Set([...runout, ...table.game.community, ...table.game.seats.flatMap((s) => s.holeCards)]);
  table.game.dealer = new Dealer([...runout, ...createDeck().filter((card) => !used.has(card))]);
  closeWithAllIn(table);
  table.seatLeaving[1] = true;
  checkOrCall(table);
  assert.equal(table.game?.street, Streets.COMPLETE);
  assert.equal(table.game.seats.length, 3, 'the folded departure keeps its result position during the hold');
  const plan = planFor(table);
  table.maybeStartHand();
  assert.equal(table.game.handNumber, 1, 'even a server-driven deal respects the pending result');
  t.mock.timers.tick(plan.awardAt);
  assert.equal(viewer.sent.filter((msg) => msg.type === 'hand_result').length, 1);
  assert.equal(table.seatedCount(), 2);
});

test('BUG-144: a sit-out requested during the hold waits for the same award', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  closeWithAllIn(table);
  checkOrCall(table);
  const complete = table.game;
  const plan = planFor(table);
  assert.equal(table.sitOutSeat(1).pending, true);
  assert.equal(table.game, complete);
  assert.equal(table.closed, false);
  assert.equal(viewer.sent.some((msg) => msg.type === 'hand_result'), false);
  t.mock.timers.tick(plan.awardAt);
  assert.equal(viewer.sent.filter((msg) => msg.type === 'hand_result').length, 1);
  assert.ok(table.closed || table.pending.every((seat) => seat?.playerId !== 'p1'));
});

test('BUG-144: an explicit seated disconnect flushes before it can compact a held roster', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const { table, viewer } = onFlop(t);
  closeWithAllIn(table);
  checkOrCall(table);
  table.removeConnection(table.connections[1]);
  const award = viewer.sent.findIndex((msg) => msg.type === 'hand_result');
  assert.ok(award >= 0);
  const final = viewer.sent.slice(0, award).filter((msg) => msg.type === 'pace').at(-1);
  assert.equal(final.pace, 'showdown');
  assert.equal(final.board.length, 5);
  assert.equal(table._pendingPaceResult, null);
  t.mock.timers.tick(15_000);
  assert.equal(viewer.sent.filter((msg) => msg.type === 'hand_result').length, 1);
});
