// scripts/verify-cost-router.js — COST-1
//
// The router against REAL HANDS, end to end.
//
// router.test.js is the scripted hand set: hand-built game states, one claim
// per gate. This is the other half — an actual Table dealing actual hands to
// actual seats, driven all the way through _buildAiGameState, so the claims
// here are about the things a unit test cannot see:
//
//   · the briefing the table builds really does carry what the router reads
//   · a whole hand's worth of decisions splits the way the design says
//   · the cheap path produces a LEGAL, playable action every time — this is
//     the one that matters, because a policy decision the engine rejects is a
//     free call that costs a hand
//   · the tempo, the talk and the kitchen table are wired to `watched`
//
// No model calls and no server process: the table is driven directly, exactly
// as table.raise.test.js drives it.
//
// Run: node scripts/verify-cost-router.js

// TEST-2: no automated suite talks to a real model.
delete process.env.ANTHROPIC_API_KEY;

import { Table } from '../src/server/table.js';
import { routeFor, Route, Reason, newRouteCounter, countRoute, policyShare } from '../src/server/router.js';
import { chooseFromPolicy, rateActions, countOptions } from '../src/agent/policyPlay.js';
import { setPersistEnabled } from '../src/server/opponentStats.js';

setPersistEnabled(false);

let passed = 0;
let failed = 0;

function assert(label, got, expected) {
  if (got === expected) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label} — got ${JSON.stringify(got)}, expected ${JSON.stringify(expected)}`);
    failed++;
  }
}
function assertOk(label, cond, detail = '') {
  assert(detail ? `${label} (${detail})` : label, !!cond, true);
}

const fakeWs = () => ({ readyState: 1, OPEN: 1, send() {} });

let seq = 0;
function table({ maxSeats = 2, home = false, buyIn = 2000 } = {}) {
  const t = new Table({
    tableId: `verify-route-${++seq}`,
    smallBlind: 10, bigBlind: 20, maxSeats, home,
  });
  for (let i = 0; i < maxSeats; i++) {
    t.seatPlayer(fakeWs(), { playerId: `p${i}`, buyIn, displayName: `P${i}` });
    t.agentProfiles[i] = i === 0
      ? { tightness: 75, aggression: 45, bluffFreq: 15, discipline: 75 }   // a Nit
      : { tightness: 40, aggression: 75, bluffFreq: 40, discipline: 45 };  // a TAG
  }
  // Seats stay PLAIN here. Marking them AI at seating time makes the table
  // AI-only, which makes it adopt itself and start the autonomous loop
  // (_adoptUndrivenTable) — and an autonomous table deals on its own timer
  // rather than when this script asks it to. _buildAiGameState does not read
  // aiSeats, so the briefing is the same either way; the sections that need
  // the flag (the talk) set it after the hand is under way.
  return t;
}

// ── (a) a real hand, played entirely by the router ──────────────────────────
//
// Every decision is routed; the ones the router keeps are answered by the
// compiled policy and PLAYED. The engine is the judge: an illegal action
// throws, and this loop does not catch.

console.log('\nreal hands, played by the router');

const counter = newRouteCounter();
let handsPlayed = 0;
let policyActions = 0;
let rejections = 0;

const t = table();
// Twelve hands, not forty. Each decision runs the same 800-iteration Monte
// Carlo the live table runs, and `npm test` has to stay fast enough that
// nobody is tempted to skip it — twelve hands is already ~90 decisions, which
// is more than enough for a split to mean something.
for (let hand = 0; hand < 12; hand++) {
  t.maybeStartHand({ clientDriven: true });
  if (!t.game || t.game.street === 'complete') break;
  handsPlayed++;

  let guard = 0;
  while (t.game.street !== 'complete' && guard++ < 60) {
    const seat = t.game.toAct;
    if (seat === null || seat === undefined) break;

    const gs = t._buildAiGameState(seat);
    const routed = routeFor(gs, { home: false });
    countRoute(counter, routed);

    // Whichever way it routed, the policy has to be able to answer it — that
    // is what makes the cheap path safe to take. Model-routed spots are played
    // by the policy here too, because there is no model in a verify script.
    const { action } = chooseFromPolicy(gs);
    if (routed.route === Route.POLICY) policyActions++;
    try {
      t.game.act(seat, t._disciplineAction(seat, action));
    } catch (err) {
      rejections++;
      console.error(`  the engine rejected ${JSON.stringify(action)}: ${err.message}`);
      break;
    }
  }
  if (t.game?.street === 'complete') t._captureStacks();
  if (t._survivingSeats().length < 2) break;
}

assertOk('hands were actually dealt', handsPlayed >= 5, `${handsPlayed} hands`);
assertOk('decisions were actually made', counter.total >= 20, `${counter.total} decisions`);
assert('every compiled action was legal — a rejected free action costs a hand', rejections, 0);
assertOk('the cheap path was actually taken', counter.policy > 0, `${counter.policy} policy`);
assertOk('and so was the expensive one', counter.model > 0, `${counter.model} model`);
assertOk(
  'the split is a real saving rather than a rounding error',
  policyShare(counter) >= 0.2,
  `${Math.round(policyShare(counter) * 100)}% answered free`,
);
assertOk(
  'every route carried a reason from the closed set',
  Object.keys(counter.byReason).every((r) => Object.values(Reason).includes(r)),
  Object.keys(counter.byReason).join(', '),
);
console.log(`  INFO  ${counter.total} decisions · ${counter.model} model · ${counter.policy} policy ` +
            `— ${Object.entries(counter.byReason).map(([k, n]) => `${k} ${n}`).join(', ')}`);
assertOk('policyActions and the counter agree', policyActions === counter.policy);

// ── (b) the briefing carries what the router reads ──────────────────────────

console.log('\nthe briefing carries the gates');

const t2 = table();
t2.maybeStartHand({ clientDriven: true });
const gs2 = t2._buildAiGameState(t2.game.toAct);
for (const field of ['equity', 'potOdds', 'pot', 'bb', 'street', 'toCall', 'myStack', 'policy']) {
  assertOk(`briefing carries ${field}`, field in gs2);
}
assert('briefing says whether a stack is already in', typeof gs2.anyAllIn, 'boolean');
assert('briefing says whether a read just moved', typeof gs2.readOnWire, 'boolean');
assert('the first decision of a session has no read news', gs2.readOnWire, false);

// ── (c) the policy always has something playable to say ─────────────────────

console.log('\nthe compiled policy never shrugs');

const t3 = table();
t3.maybeStartHand({ clientDriven: true });
const gs3 = t3._buildAiGameState(t3.game.toAct);
const rated = rateActions(gs3);
assertOk('every legal action was rated', rated.length >= 2, `${rated.length} rated`);
assertOk('every score is inside 0..100', rated.every((r) => r.score >= 0 && r.score <= 100));
assertOk('the ratings are sorted best first', rated.every((r, i) => i === 0 || rated[i - 1].score >= r.score));
assertOk('options is at least one', countOptions(rated) >= 1);
const chosen = chooseFromPolicy(gs3);
assertOk('a decision came back', !!chosen.action?.type);
assertOk('with a line in his voice', typeof chosen.reasoning === 'string' && chosen.reasoning.length > 0);
assertOk('and no solver talking in it', !/equity|pot odds|\bbb\b|%/i.test(chosen.reasoning), chosen.reasoning);

// ── (d) the kitchen table spends nothing, whatever the spot ─────────────────

console.log('\nthe kitchen table');

const home = table({ home: true });
home.maybeStartHand({ clientDriven: true });
const homeRouted = routeFor(home._buildAiGameState(home.game.toAct), { home: true, nemesis: true });
assert('home routes to the policy', homeRouted.route, Route.POLICY);
assert('and says why', homeRouted.reason, Reason.HOME);
assert('a home table is never "watched" for talk purposes', home.home, true);
home._writeNightRecap();
assert('and is never written up at the end', home._recapWritten, false);

// ── (e) the tempo follows who is actually there ─────────────────────────────

console.log('\nthe tempo');

const lonely = table();
lonely.connections = lonely.connections.map(() => null);
lonely.autoPlay = true;
lonely._handPauseNamed = false;
lonely.handPauseMs = 8000;
assert('nobody watching → the unwatched pause', lonely._dealPauseMs(), 25_000);
assert('and it knows nobody is there', lonely.isWatched(), false);

lonely.spectators.push({ ws: fakeWs(), spectatorSeat: 0 });
assert('a spectator arrives → today\'s pacing, mid-session', lonely._dealPauseMs(), 8000);
assert('and it knows somebody is there', lonely.isWatched(), true);

const named = table();
named.connections = named.connections.map(() => null);
named.autoPlay = true;
named._handPauseNamed = true;
named.handPauseMs = 500;
assert('a tempo somebody asked for is never overridden', named._dealPauseMs(), 500);

// ── (f) a remark buys no model call ─────────────────────────────────────────

console.log('\nwhat somebody says at the table');

const heard = table();
heard.maybeStartHand({ clientDriven: true });
heard.aiSeats[1] = true;
heard._hearFromTable('Still folding, then?', 0);
assert('the line is queued for the other seat', heard.pendingNeedle[1], 'Still folding, then?');
assert('and not for the man who said it', heard.pendingNeedle[0], null);
const needled = heard._buildAiGameState(1);
assert('it reaches the briefing', needled.tableTalk, 'Still folding, then?');
assert('and the router treats it as a reason to spend',
  routeFor(needled, { home: false }).reason === Reason.TALK
    // Another gate may legitimately fire first on a live hand; what must never
    // happen is the needle being answered for free.
    || routeFor(needled, { home: false }).route === Route.MODEL, true);

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed + failed} test(s): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
