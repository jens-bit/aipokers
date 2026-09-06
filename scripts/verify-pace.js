// scripts/verify-pace.js — PACE-1
//
// The pacing ladder, end to end, on a real table over a real socket.
//
//   1. The ladder is server-authoritative and only ever advances: CALM at the
//      deal, HEATING when the pot crosses the threshold, ALL-IN when a stack is
//      committed and nobody can act, SHOWDOWN at the reveal.
//   2. `pace` and `potBb` ride every STATE snapshot, so a client that connects
//      mid-hand is not calm until the next transition.
//   3. THE HOLD IS SPECTATOR-ONLY. Watched: his line lands, three to five
//      seconds of nothing, the runout a card at a time 700ms apart, the
//      finished board held two seconds, and only then the pot. Unwatched: the
//      result is immediate, because a five-second pause nobody sees is five
//      seconds of a worse win rate.
//
// Two seated sockets drive the betting directly, so the hand shapes are exact
// and nothing depends on a model. Runs with NO ANTHROPIC_API_KEY.

if (process.env.ANTHROPIC_API_KEY) {
  console.error('[verify] ANTHROPIC_API_KEY is set; this suite asserts on deterministic play.');
  process.exit(1);
}

process.env.HAND_PAUSE_MS ??= '300';
process.env.PACE_HEAT_BB ??= '25';
process.env.DEV_API_SECRET ??= 'pace-e2e-secret';
// Two seated humans and nothing else: no House fallback, no model.
process.env.AI_ENABLED = 'false';
process.env.HOUSE_FALLBACK_MS ??= '600000';

import express from 'express';
import http from 'node:http';
import { WebSocket } from 'ws';

const { createServer } = await import('../src/server/wsServer.js');
const { ClientMsg, ServerMsg } = await import('../src/server/protocol.js');
const { setPersistEnabled } = await import('../src/server/opponentStats.js');
const {
  PACE, ALLIN_HOLD_MIN_MS, ALLIN_HOLD_MAX_MS, RUNOUT_CARD_MS, REVEAL_HOLD_MS,
  allInHoldMs, seedFor,
} = await import('../src/server/pace.js');

setPersistEnabled(false);

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── boot ────────────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());
const httpServer = http.createServer(app);
createServer({ server: httpServer, defaultBlinds: { smallBlind: 10, bigBlind: 20 } });
await new Promise((res) => httpServer.listen(0, '127.0.0.1', res));
const port = httpServer.address().port;
console.log(`[verify] server up on ws://127.0.0.1:${port}`);

// A socket that remembers everything it was sent, with arrival times.
function openSocket(name) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}`);
  const log = [];
  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }
    log.push({ at: Date.now(), msg });
  });
  return new Promise((resolve, reject) => {
    ws.on('open', () => resolve({
      name, ws, log,
      send: (o) => ws.send(JSON.stringify(o)),
      of: (type) => log.filter((e) => e.msg.type === type),
      last: (type) => log.filter((e) => e.msg.type === type).at(-1)?.msg ?? null,
      clear: () => { log.length = 0; },
      close: () => ws.close(),
    }));
    ws.on('error', reject);
  });
}

const waitFor = async (sock, predicate, budgetMs = 8000) => {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    const hit = sock.log.find((e) => predicate(e.msg));
    if (hit) return hit;
    await sleep(25);
  }
  return null;
};

// Drive one hand to an all-in showdown: whoever is to act jams, the other
// calls. Returns the moment the LAST action was sent — the instant the pot
// would move if there were no hold, which is what every timing here is
// measured against.
//
// The hand is already running by the time both players have joined (the JOIN
// handler calls maybeStartHand), so this waits for a live street rather than
// dealing one itself.
async function jamHand(a, b) {
  const live = (sock) => {
    const s = sock.last(ServerMsg.STATE);
    return s && s.state && s.state.street && s.state.street !== 'waiting' ? s : null;
  };
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline && !live(a)) await sleep(50);

  let lastActionAt = Date.now();
  for (let i = 0; i < 8; i++) {
    if (a.of(ServerMsg.HAND_RESULT).length > 0) break;
    const sa = live(a);
    const sb = live(b);
    const who = sa && sa.state.toAct === sa.yourSeat ? a
      : sb && sb.state.toAct === sb.yourSeat ? b
      : null;
    if (!who) { await sleep(80); continue; }
    const seen = who.last(ServerMsg.STATE);
    const legal = seen.legalActions ?? [];
    const raise = legal.find((l) => l.type === 'raise');
    const call = legal.find((l) => l.type === 'call');
    const check = legal.find((l) => l.type === 'check');
    lastActionAt = Date.now();
    if (raise) who.send({ type: ClientMsg.ACTION, action: { type: 'raise', amount: raise.max } });
    else if (call) who.send({ type: ClientMsg.ACTION, action: { type: 'call' } });
    else if (check) who.send({ type: ClientMsg.ACTION, action: { type: 'check' } });
    else break;
    await sleep(150);
  }
  return lastActionAt;
}

// ── 1. unwatched: no hold ───────────────────────────────────────────────────
console.log('\n— unwatched: the hand resolves at machine speed —');
{
  const tableId = 'pace-unwatched';
  const a = await openSocket('A');
  const b = await openSocket('B');
  a.send({ type: ClientMsg.JOIN, tableId, playerId: 'pa', buyIn: 2000, displayName: 'A' });
  b.send({ type: ClientMsg.JOIN, tableId, playerId: 'pb', buyIn: 2000, displayName: 'B' });
  await waitFor(b, (m) => m.type === ServerMsg.JOINED);
  await sleep(200);

  const start = await jamHand(a, b);
  const result = await waitFor(a, (m) => m.type === ServerMsg.HAND_RESULT, 8000);
  check('the hand completes', !!result);
  const elapsed = result ? result.at - start : Infinity;
  check(`the pot is pushed without a hold (${elapsed}ms < ${ALLIN_HOLD_MIN_MS}ms)`,
    elapsed < ALLIN_HOLD_MIN_MS, `${elapsed}ms`);

  const paces = a.of(ServerMsg.PACE).map((e) => e.msg.pace);
  check('pace messages still arrive when nobody is watching', paces.length > 0, JSON.stringify(paces));
  check('the ladder still reaches showdown unwatched', paces.includes(PACE.SHOWDOWN), JSON.stringify(paces));
  check('no runout card was staged', a.of(ServerMsg.PACE).every((e) => !e.msg.card));

  a.close(); b.close();
  await sleep(150);
}

// ── 2. watched: the whole beat ──────────────────────────────────────────────
console.log('\n— watched: the staged beat —');
{
  const tableId = 'pace-watched';
  const a = await openSocket('A');
  const b = await openSocket('B');
  a.send({ type: ClientMsg.JOIN, tableId, playerId: 'wa', buyIn: 2000, displayName: 'A' });
  b.send({ type: ClientMsg.JOIN, tableId, playerId: 'wb', buyIn: 2000, displayName: 'B' });
  await waitFor(b, (m) => m.type === ServerMsg.JOINED);

  const spec = await openSocket('S');
  spec.send({ type: ClientMsg.WATCH, tableId, displayName: 'Watcher' });
  await waitFor(spec, (m) => m.type === ServerMsg.WATCHING, 5000);
  await sleep(200);

  const start = await jamHand(a, b);
  const result = await waitFor(spec, (m) => m.type === ServerMsg.HAND_RESULT, 20000);
  check('the hand completes', !!result);

  const paces = spec.of(ServerMsg.PACE);
  const ladder = paces.map((e) => e.msg.pace);
  check('the ladder never steps back', (() => {
    const rank = { calm: 0, heating: 1, allin: 2, showdown: 3 };
    let seen = -1;
    for (const p of ladder) { if (rank[p] < seen) return false; seen = Math.max(seen, rank[p]); }
    return true;
  })(), JSON.stringify(ladder));
  check('it reaches ALL-IN', ladder.includes(PACE.ALLIN), JSON.stringify(ladder));
  check('it reaches SHOWDOWN', ladder.includes(PACE.SHOWDOWN), JSON.stringify(ladder));

  const allIn = paces.find((e) => e.msg.pace === PACE.ALLIN);
  const cards = paces.filter((e) => e.msg.card);
  check('the runout arrives card by card', cards.length > 0, `${cards.length} cards`);

  if (allIn && cards.length > 0) {
    const gap = cards[0].at - allIn.at;
    check(`the all-in is held ${ALLIN_HOLD_MIN_MS}–${ALLIN_HOLD_MAX_MS}ms before the runout (${gap}ms)`,
      gap >= ALLIN_HOLD_MIN_MS - 250 && gap <= ALLIN_HOLD_MAX_MS + 800, `${gap}ms`);
  }
  if (cards.length > 1) {
    const gaps = cards.slice(1).map((c, i) => c.at - cards[i].at);
    check(`runout cards are ~${RUNOUT_CARD_MS}ms apart (${gaps.join(', ')})`,
      gaps.every((g) => g >= RUNOUT_CARD_MS - 250 && g <= RUNOUT_CARD_MS + 400), gaps.join(', '));
    check('each card grows the board by exactly one',
      cards.every((c, i) => c.msg.board.length === cards[0].msg.board.length + i));
  }
  if (cards.length > 0 && result) {
    const held = result.at - cards.at(-1).at;
    check(`the finished board is held ~${REVEAL_HOLD_MS}ms before the pot moves (${held}ms)`,
      held >= REVEAL_HOLD_MS - 250 && held <= REVEAL_HOLD_MS + 800, `${held}ms`);
  }

  const total = result ? result.at - start : 0;
  check(`the whole beat is longer than the hold alone (${total}ms)`, total >= ALLIN_HOLD_MIN_MS, `${total}ms`);

  // The seated players get the same beat — the pot is one event for everyone.
  check('seated players see the pot move at the same time',
    a.of(ServerMsg.HAND_RESULT).length === 1 && b.of(ServerMsg.HAND_RESULT).length === 1);
  check('the pot is pushed exactly once', spec.of(ServerMsg.HAND_RESULT).length === 1);

  spec.close(); a.close(); b.close();
  await sleep(150);
}

// ── 3. the snapshot carries the state ───────────────────────────────────────
console.log('\n— pace rides every snapshot —');
{
  const tableId = 'pace-snapshot';
  const a = await openSocket('A');
  const b = await openSocket('B');
  a.send({ type: ClientMsg.JOIN, tableId, playerId: 'sa', buyIn: 2000, displayName: 'A' });
  b.send({ type: ClientMsg.JOIN, tableId, playerId: 'sb', buyIn: 2000, displayName: 'B' });
  await waitFor(b, (m) => m.type === ServerMsg.JOINED);
  await sleep(200);
  await waitFor(a, (m) => m.type === ServerMsg.HAND_START, 8000);
  await sleep(200);

  const states = a.of(ServerMsg.STATE);
  check('every snapshot carries a pace', states.length > 0 && states.every((e) => typeof e.msg.state.pace === 'string'));
  check('every snapshot carries the pot in big blinds',
    states.every((e) => typeof e.msg.state.potBb === 'number'));
  check('a fresh deal is calm', states.at(-1).msg.state.pace === PACE.CALM,
    states.at(-1).msg.state.pace);

  a.close(); b.close();
  await sleep(150);
}

// ── 4. the owner's spectator: equity from the deal, and his read ────────────
// WATCH on a client-driven table seats the watcher's OWN agent and attaches him
// to it — that seat is his, which is the same rule _broadcastDecision has always
// used to decide who may see reasoning. So the watcher goes first here and the
// human sits down opposite him, which is the real shape of the flow.
console.log('\n— the owner’s spectator sees his agent’s eyes —');
{
  const tableId = 'pace-hero';
  const spec = await openSocket('S');
  spec.send({ type: ClientMsg.WATCH, tableId, displayName: 'His Agent' });
  const watching = await waitFor(spec, (m) => m.type === ServerMsg.WATCHING, 5000);
  check('the watcher is attached to a seat', !!watching);

  const a = await openSocket('A');
  a.send({ type: ClientMsg.JOIN, tableId, playerId: 'ha', buyIn: 2000, displayName: 'A' });
  await waitFor(a, (m) => m.type === ServerMsg.JOINED);
  await sleep(700);

  const states = spec.of(ServerMsg.STATE).filter((e) => e.msg.state.street && e.msg.state.street !== 'waiting');
  check('the spectator gets snapshots of the live hand', states.length > 0, `${spec.of(ServerMsg.STATE).length} states`);

  // The rider: equity is there from the DEAL, before his agent has acted once.
  const first = states[0]?.msg.state;
  check('hero equity is on the first snapshot of the hand — never a dash',
    typeof first?.heroEquity === 'number' && first.heroEquity > 0 && first.heroEquity < 1,
    JSON.stringify(first?.heroEquity));
  // BUG-34: "a live hand" means a hand he is still IN.
  //
  // _heroEquityFor returns null for a folded seat on purpose — a man who
  // folded has no equity in the pot — so the snapshot after he folds carries
  // no number, correctly. This check filtered only on `street !== 'waiting'`,
  // which includes `complete`, so it asserted a rule the product has never
  // held and has no business holding.
  //
  // Whether it fired was pure timing. With no model behind him the hero
  // check/folds, and his 800ms think delay normally put that fold after this
  // script's 700ms sample window; under the e2e group's concurrency the sleep
  // overran, the post-fold snapshot landed inside the sample, and the run came
  // back "1 without". Nothing about the server differed between the two.
  // waitFor resolves the LOG ENTRY, not the message — `{ at, msg }`.
  const heroSeat = watching?.msg?.spectatorSeat ?? null;
  check('the snapshot names the seat the watcher is at', Number.isInteger(heroSeat),
    JSON.stringify(heroSeat));
  const inHand = states.filter((e) => !e.msg.state.seats?.[heroSeat]?.folded);
  check('every snapshot of a hand he is still in carries it',
    inHand.length > 0 && inHand.every((e) => typeof e.msg.state.heroEquity === 'number'),
    `${inHand.filter((e) => typeof e.msg.state.heroEquity !== 'number').length} without, of ${inHand.length}`);
  // And the other half of the rule, so excluding those snapshots above does not
  // quietly stop asserting anything about them.
  const folded = states.filter((e) => e.msg.state.seats?.[heroSeat]?.folded);
  if (folded.length > 0) {
    check('a seat that folded reports no equity rather than a stale one',
      folded.every((e) => e.msg.state.heroEquity === null),
      JSON.stringify(folded.map((e) => e.msg.state.heroEquity)));
  }
  check('equity is a probability, not a percentage',
    states.every((e) => e.msg.state.heroEquity === null || (e.msg.state.heroEquity >= 0 && e.msg.state.heroEquity <= 1)));

  // The read panel: five rows in the ref's order, present from the start even
  // with no evidence behind them, because the bars fill rather than appear.
  const withReads = states.find((e) => Array.isArray(e.msg.state.reads));
  check('the read panel rides the snapshot', !!withReads);
  if (withReads) {
    const panel = withReads.msg.state.reads[0];
    check('one entry per opponent', withReads.msg.state.reads.length >= 1);
    check('five rows in the ref order',
      panel.rows.map((r) => r.k).join(',') === 'vpip,pfr,aggr,fold,sd', JSON.stringify(panel.rows.map((r) => r.k)));
    check('each row is {value, confidence, formed}',
      panel.rows.every((r) => (r.value === null || typeof r.value === 'number')
        && typeof r.confidence === 'number' && typeof r.formed === 'boolean'));
    check('hands observed rides the panel', typeof panel.handsObserved === 'number');
    check('a fresh opponent has formed nothing and says nothing',
      panel.handsObserved === 0 ? (panel.formed === false && panel.line === null) : true);
  }

  // Nobody else gets either payload.
  const seated = a.of(ServerMsg.STATE).at(-1)?.msg.state;
  check('a seated player is told nothing about anyone’s equity', seated?.heroEquity === undefined);
  check('a seated player gets no read panel', seated?.reads === undefined);

  a.close(); spec.close();
  await sleep(150);
}

// ── 5. the hold length is reproducible ──────────────────────────────────────
console.log('\n— the hold is deterministic —');
{
  check('the same table and hand always hold for the same time',
    allInHoldMs(seedFor('t', 4)) === allInHoldMs(seedFor('t', 4)));
  check('the hold stays inside 3–5s across a thousand hands', (() => {
    for (let i = 0; i < 1000; i++) {
      const ms = allInHoldMs(seedFor('t', i));
      if (ms < ALLIN_HOLD_MIN_MS || ms > ALLIN_HOLD_MAX_MS) return false;
    }
    return true;
  })());
}

console.log('');
httpServer.close();
if (failures === 0) {
  console.log('[verify-pace] ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.error(`[verify-pace] ${failures} check(s) failed`);
  process.exit(1);
}
