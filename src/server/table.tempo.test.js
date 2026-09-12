// BUG-141: a visible game should deal again while the last result is still
// fresh. Exercise the actual completion scheduler, including the all-in hold.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { once } from 'node:events';
import WebSocket from 'ws';

delete process.env.ANTHROPIC_API_KEY;
delete process.env.HAND_PAUSE_MS;
delete process.env.HOME_PAUSE_MS;
delete process.env.UNWATCHED_HAND_PAUSE_MS;
delete process.env.TELEGRAM_BOT_TOKEN;
delete process.env.DEV_API_SECRET;
process.env.NOTIFY_ENABLED = '0';

const { Table } = await import('./table.js');
const { HOME_PAUSE_MS } = await import('./homeGame.js');
const { Actions, Streets } = await import('../engine/game.js');
const { holdPlan, seedFor } = await import('./pace.js');
const { Dealer, createDeck } = await import('../engine/deck.js');
const { _closeForTests } = await import('./store.js');
after(() => _closeForTests());

const socket = () => ({ OPEN: 1, readyState: 1, sent: [], send(raw) { this.sent.push(JSON.parse(raw)); } });
let sequence = 0;
function tableFor(t, { home = false, homeOwnerId = null, stacks = [2000, 2000], watched = true } = {}) {
  const table = new Table({ tableId: `bug141-${++sequence}`, home, homeOwnerId, smallBlind: 10, bigBlind: 20, maxSeats: 4 });
  if (home) table.handPauseMs = HOME_PAUSE_MS; // homeGame.sync's real wiring
  for (const [seat, buyIn] of stacks.entries()) {
    table.seatPlayer(socket(), { playerId: `p${seat}`, displayName: `P${seat}`, buyIn });
  }
  table.maybeStartHand();
  table.autoPlay = true;
  if (!home) {
    // A casino table watched by its owner; prevent asynchronous AI decisions
    // because actions below are deliberately controlled by this test.
    table.aiSeats.fill(true);
    table.connections.fill(null);
    table._maybeRunAiTurn = async () => {};
  }
  if (watched) table.spectators.push({ ws: socket(), spectatorSeat: 0 });
  t.after(() => table._clearTimers());
  return table;
}

function finishByFolding(table) {
  while (table.game.street !== Streets.COMPLETE) {
    table.game.act(table.game.toAct, { type: Actions.FOLD });
  }
  table._handCompleted();
}

test('BUG-141: a watched casino hand deals again after three seconds', (t) => {
  const table = tableFor(t);
  finishByFolding(table);
  assert.equal(table._nextHandTimer?._idleTimeout, 3000);
});

test('BUG-141: a human at home gets the next hand after three seconds, not thirty', (t) => {
  const table = tableFor(t, { home: true });
  finishByFolding(table);
  assert.equal(table._nextHandTimer?._idleTimeout, 3000);
});

test('BUG-141: whisper context describes the result pause as between hands', (t) => {
  const table = tableFor(t, { home: true });
  table.agentIds[0] = 'whispering-agent';
  const live = table.whisperContext('whispering-agent');
  assert.equal(live.inHand, true);
  assert.equal(live.holeCards.length, 2);
  while (table.game.street !== Streets.COMPLETE) {
    table.game.act(table.game.toAct, { type: Actions.FOLD });
  }
  const complete = table.whisperContext('whispering-agent');
  assert.equal(complete.inHand, false, 'the hand is already over');
  assert.equal(complete.street, Streets.WAITING);
  assert.deepEqual(complete.board, []);
  assert.deepEqual(complete.holeCards, []);
  assert.equal(complete.yourTurn, false);
  assert.equal(complete.toAct, null);
  table.game.street = Streets.WAITING;
  assert.equal(table.whisperContext('whispering-agent').inHand, false);
});

test('BUG-141: unwatched casino hands keep the deliberate cost throttle', (t) => {
  const table = tableFor(t, { watched: false });
  finishByFolding(table);
  assert.equal(table._nextHandTimer?._idleTimeout, 25_000);
});

test('BUG-141: the faster next deal still waits for the entire staged all-in result', (t) => {
  const table = tableFor(t, { stacks: [200, 2000, 2000] });
  let acted = false;
  while (table.game.street !== Streets.COMPLETE) {
    const seat = table.game.toAct;
    const legal = table.game.legalActions(seat);
    const raise = legal.find((action) => action.type === Actions.RAISE);
    const call = legal.find((action) => action.type === Actions.CALL);
    table._boardBeforeAct = [...table.game.community];
    if (seat === 0 && !acted && raise) {
      table.game.act(seat, { type: Actions.RAISE, amount: raise.max });
      acted = true;
    } else if (seat === 1) {
      table.game.act(seat, { type: Actions.FOLD });
    } else {
      table.game.act(seat, { type: call ? Actions.CALL : Actions.CHECK });
    }
  }
  const plan = holdPlan({
    heldBoard: table._boardBeforeAct,
    runout: table.game.community.slice(table._boardBeforeAct.length),
    seed: seedFor(table.tableId, table.game.handNumber), watched: true,
  });
  assert.equal(table._boardBeforeAct.length, 0);
  assert.equal(table.game.community.length, 5, 'the all-in runs out all five unseen cards');
  table._handCompleted();
  assert.ok(plan.totalMs >= 5000, 'the authored all-in beat still has time to finish');
  assert.equal(table._nextHandTimer?._idleTimeout, plan.totalMs + 3000);
});

test('BUG-141: arriving during an unwatched gap brings the next deal forward without dealing on WATCH', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const table = tableFor(t, { watched: false });
  finishByFolding(table);
  const completedHand = table.game.handNumber;
  t.mock.timers.tick(1000);
  table.addSpectator(socket());
  assert.equal(table.game.handNumber, completedHand, 'WATCH itself never deals');
  t.mock.timers.tick(1999);
  assert.equal(table.game.handNumber, completedHand, 'keep three seconds for the result');
  t.mock.timers.tick(1);
  assert.equal(table.game.handNumber, completedHand + 1, 'do not inherit the old twenty-five second timer');
});

test('BUG-141: explicit environment and constructor pauses remain exact', () => {
  const source = `
    const { Table } = await import(${JSON.stringify(new URL('./table.js', import.meta.url).href)});
    const { HOME_PAUSE_MS } = await import(${JSON.stringify(new URL('./homeGame.js', import.meta.url).href)});
    const a = new Table({tableId:'env'}); a.autoPlay = true;
    const b = new Table({tableId:'ctor',handPauseMs:475}); b.autoPlay = true;
    console.log(JSON.stringify({hand:a._dealPauseMs(),home:HOME_PAUSE_MS,constructor:b._dealPauseMs()}));
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '--eval', source], {
    encoding: 'utf8', env: { ...process.env, HAND_PAUSE_MS: '650', HOME_PAUSE_MS: '725' },
  });
  assert.deepEqual(JSON.parse(output.trim().split('\n').at(-1)), { hand: 650, home: 725, constructor: 475 });
});

test('SHOW-2: a watched automatic table caps a long explicitly configured pause at three seconds', (t) => {
  const table = tableFor(t);
  table.handPauseMs = 18000;
  table._handPauseNamed = true;
  finishByFolding(table);
  assert.equal(table._nextHandTimer?._idleTimeout, 3000);
});

test('SHOW-2: a public visitor arriving late in an explicit pause deals next tick and never resets the wait', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const table = tableFor(t, { watched: false });
  table.handPauseMs = 18000;
  table._handPauseNamed = true;
  finishByFolding(table);
  const hand = table.game.handNumber;
  t.mock.timers.tick(10000);
  table.addSpectator(socket(), { publicOnly: true });
  table.addSpectator(socket(), { publicOnly: true });
  assert.equal(table.game.handNumber, hand, 'attaching never deals synchronously');
  t.mock.timers.tick(1);
  assert.equal(table.game.handNumber, hand + 1, 'the old eighteen-second setting cannot strand an arrival');
});

test('SHOW-2: public arrivals preserve the remaining authored runout before the capped pause', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_000_000 });
  const table = tableFor(t, { watched: false });
  table.handPauseMs = 18000;
  table._handPauseNamed = true;
  while (table.game.street !== Streets.COMPLETE) table.game.act(table.game.toAct, { type: Actions.FOLD });
  table._scheduleNextHand(26000, { resultAt: Date.now() + 8000 });
  table.addSpectator(socket(), { publicOnly: true });
  const hand = table.game.handNumber;
  t.mock.timers.tick(10999);
  assert.equal(table.game.handNumber, hand, 'all eight seconds of the runout plus the result beat remain');
  t.mock.timers.tick(1);
  assert.equal(table.game.handNumber, hand + 1);
});

test('SHOW-2: watching a manually dealt human casino table never starts an automatic next hand', (t) => {
  const table = tableFor(t, { home: true });
  table.home = false;
  table.autoPlay = false;
  finishByFolding(table);
  table.addSpectator(socket(), { publicOnly: true });
  assert.equal(table._nextHandTimer, null, 'the human still owns the deal button at a manual casino table');
});

test('BUG-141: a human joining mid-hand immediately sees public play and joins the next deal', async (t) => {
  const { createServer } = await import('./wsServer.js');
  const { wss, tables } = createServer({ port: 0, host: '127.0.0.1' });
  await once(wss, 'listening');
  // BUG-155: this direct Table fixture must supply the household identity
  // that homeGame normally stamps when creating a private kitchen.
  const table = tableFor(t, { home: true, homeOwnerId: 'late-owner' });
  tables.set(table.tableId, table);
  const ws = new WebSocket(`ws://127.0.0.1:${wss.address().port}`);
  const messages = [];
  ws.on('message', (raw) => messages.push(JSON.parse(raw)));
  t.after(async () => {
    ws.terminate();
    for (const client of wss.clients) client.terminate();
    await new Promise((resolve) => wss.close(resolve));
    tables.delete(table.tableId);
  });
  await once(ws, 'open');
  const waitFor = async (predicate) => {
    const deadline = Date.now() + 1500;
    while (!messages.some(predicate) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    return messages.find(predicate);
  };
  ws.send(JSON.stringify({ type: 'join', tableId: table.tableId,
    playerId: 'late-human', userId: 'late-owner', displayName: 'You', buyIn: 2000 }));
  const joined = await waitFor((message) => message.type === 'joined');
  assert.equal(joined?.seat, 2);
  assert.equal(joined.waitingForNextHand, true, 'the accepted seat explains why no cards have arrived');
  const queued = await waitFor((message) => message.type === 'state');
  assert.ok(queued, 'JOIN must immediately show the ongoing hand');
  assert.equal(queued.yourSeat, 2, 'keep the assigned human seat, never an opponent viewpoint');
  assert.equal(queued.waitingForNextHand, true);
  assert.equal(queued.state.waitingForNextHand, true);
  assert.equal(queued.state.street, Streets.PREFLOP);
  assert.equal(queued.state.seats.length, 2, 'the late human is not fabricated into the current hand');
  assert.ok(queued.state.seats.every((seat) => seat.holeCards.length === 0), 'no private opponent cards leak');
  assert.deepEqual(queued.legalActions, []);
  assert.equal(queued.state.heroEquity, undefined);
  assert.equal(queued.state.reads, undefined);
  assert.equal(queued.state.sessionId, null);

  messages.length = 0;
  table.applyAction(table.connections[table.game.toAct], { type: Actions.CALL });
  const update = await waitFor((message) => message.type === 'state');
  assert.ok(update, 'the queued player continues receiving public play');
  assert.equal(update.waitingForNextHand, true);
  assert.ok(update.state.seats.every((seat) => seat.holeCards.length === 0));
  assert.deepEqual(update.legalActions, []);

  finishByFolding(table);
  messages.length = 0;
  table.maybeStartHand();
  const dealt = await waitFor((message) => message.type === 'state' && message.state.handNumber === 2);
  assert.ok(dealt, 'the same connection receives the next deal');
  assert.equal(dealt.waitingForNextHand, false);
  assert.equal(dealt.state.waitingForNextHand, false);
  assert.equal(dealt.state.seats[dealt.yourSeat].playerId, 'late-human');
  assert.equal(dealt.state.seats[dealt.yourSeat].holeCards.length, 2);
  assert.ok(dealt.state.seats.filter((_, seat) => seat !== dealt.yourSeat).every((seat) => seat.holeCards.length === 0));

  // The real rebuy journey: rig only the cards so the human deterministically
  // loses an all-in, then use the public LEAVE + fresh JOIN path from Play again.
  table.game.seats[0].holeCards = ['As', 'Ah'];
  table.game.seats[1].holeCards = ['Ks', 'Kd'];
  table.game.seats[2].holeCards = ['2c', '3c'];
  const runout = ['4c', '5h', '7d', '9s', '8c', 'Jc', 'Tc', 'Qh'];
  const used = new Set([...runout, ...table.game.seats.flatMap((seat) => seat.holeCards)]);
  table.game.dealer = new Dealer([...runout, ...createDeck().filter((card) => !used.has(card))]);
  assert.equal(table.game.toAct, 1);
  table.applyAction(table.connections[1], { type: Actions.FOLD });
  const raise = table.game.legalActions(2).find((action) => action.type === Actions.RAISE);
  messages.length = 0;
  ws.send(JSON.stringify({ type: 'action', action: { type: Actions.RAISE, amount: raise.max } }));
  const shove = await waitFor((message) => message.type === 'state' && message.state.seats[2].allIn);
  assert.ok(shove, 'the real human socket shoves');
  table.applyAction(table.connections[0], { type: Actions.CALL });
  const lost = await waitFor((message) => message.type === 'state' && message.state.street === Streets.COMPLETE);
  assert.equal(lost?.state.seats[2].stack, 0, 'the human actually busted');

  ws.send(JSON.stringify({ type: 'leave' }));
  ws.close();
  await once(ws, 'close');
  assert.ok(table.pending.every((seat) => seat?.playerId !== 'late-human'), 'LEAVE releases the old identity');
  const rebuy = new WebSocket(`ws://127.0.0.1:${wss.address().port}`);
  t.after(() => rebuy.terminate());
  await once(rebuy, 'open');
  messages.length = 0;
  rebuy.on('message', (raw) => messages.push(JSON.parse(raw)));
  rebuy.send(JSON.stringify({ type: 'join', tableId: table.tableId,
    playerId: 'rebought-human', userId: 'late-owner', displayName: 'You', buyIn: 2000 }));
  const rejoined = await waitFor((message) => message.type === 'joined');
  assert.equal(rejoined?.seat, 2, 'the new human reuses the released chair');
  assert.equal(rejoined.waitingForNextHand, true, 'old-hand cards never become the new human hand');
  assert.equal(table.pending.filter((seat) => seat?.playerId === 'rebought-human').length, 1);
  table.maybeStartHand();
  const boughtHand = await waitFor((message) => message.type === 'state' && message.state.handNumber === 3);
  assert.ok(boughtHand, 'Play again must receive its funded next hand');
  const hero = boughtHand.state.seats[boughtHand.yourSeat];
  assert.equal(hero.playerId, 'rebought-human');
  assert.equal(hero.holeCards.length, 2);
  assert.equal(hero.stack + hero.contribTotal, 2000, 'the old busted stack cannot overwrite the fresh buy-in');
  assert.equal(boughtHand.waitingForNextHand, false);
});
