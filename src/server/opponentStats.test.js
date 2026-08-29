// src/server/opponentStats.test.js
// Scripted-action tests for the opponent stat counters. Run with:
//   node src/server/opponentStats.test.js

// Isolate from any persisted data on disk — we run without persistence and
// reset in-memory state between test blocks.
process.env.OPPONENT_STATS_NO_PERSIST = '1';

import assert from 'node:assert';
import { recordHand, getRead, reset, setPersistEnabled } from './opponentStats.js';

setPersistEnabled(false);

let failures = 0;
function check(label, cond) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}`); }
}

// A tiny helper to build an ordered action log for a single HU hand.
function log(entries) {
  return entries.map(([seat, street, actionType]) => ({ seat, street, actionType }));
}

console.log('\n— VPIP / PFR classification —');
reset();
// Hand A: seat 0 raises preflop, seat 1 folds preflop.
recordHand({
  playerIdsBySeat: ['P0', 'P1'],
  displayNamesBySeat: ['Alice', 'Bob'],
  actionLog: log([
    [0, 'preflop', 'raise'],
    [1, 'preflop', 'fold'],
  ]),
  showdownSeats: [],
});
{
  const alice = getRead('P0');
  const bob   = getRead('P1');
  check('Alice raised preflop → VPIP + PFR both 100', alice.vpip === 100 && alice.pfr === 100);
  check('Bob folded preflop → VPIP 0, PFR 0',         bob.vpip   === 0   && bob.pfr   === 0);
  check('Bob faced a raise and folded → foldToRaise 100', bob.foldToRaise === 100);
  check('Both saw one hand',                          alice.handsObserved === 1 && bob.handsObserved === 1);
}

console.log('\n— VPIP excludes BB check-through —');
reset();
// SB completes (call), BB checks the option. Flop check/check, turn check/check,
// river check/check → showdown. SB voluntarily put chips in, BB did not.
recordHand({
  playerIdsBySeat: ['SB', 'BB'],
  displayNamesBySeat: ['SB', 'BB'],
  actionLog: log([
    [0, 'preflop', 'call'],
    [1, 'preflop', 'check'],
    [1, 'flop',    'check'],
    [0, 'flop',    'check'],
    [1, 'turn',    'check'],
    [0, 'turn',    'check'],
    [1, 'river',   'check'],
    [0, 'river',   'check'],
  ]),
  showdownSeats: [0, 1],
});
{
  const sb = getRead('SB');
  const bb = getRead('BB');
  check('SB call preflop → VPIP 100, PFR 0',           sb.vpip === 100 && sb.pfr === 0);
  check('BB checked option only → VPIP 0, PFR 0',      bb.vpip === 0   && bb.pfr === 0);
  check('both went to showdown → 100%',                sb.wentToShowdown === 100 && bb.wentToShowdown === 100);
  check('neither faced aggression → foldToRaise null', sb.foldToRaise === null && bb.foldToRaise === null);
}

console.log('\n— aggression factor across streets —');
reset();
// Seat 0 raises pre, bets flop, bets turn, bets river. Seat 1 calls every street.
recordHand({
  playerIdsBySeat: ['Aggro', 'Caller'],
  displayNamesBySeat: ['Aggro', 'Caller'],
  actionLog: log([
    [0, 'preflop', 'raise'],
    [1, 'preflop', 'call'],
    [0, 'flop',    'bet'],
    [1, 'flop',    'call'],
    [0, 'turn',    'bet'],
    [1, 'turn',    'call'],
    [0, 'river',   'bet'],
    [1, 'river',   'call'],
  ]),
  showdownSeats: [0, 1],
});
{
  const aggro = getRead('Aggro');
  const caller = getRead('Caller');
  // Aggro: 0 calls, 4 bets/raises → AF = Infinity (never called)
  check('Aggro made 0 calls, 4 aggressions → AF Infinity', aggro.af === Infinity);
  // Caller: 4 calls, 0 bets/raises → AF = 0
  check('Caller made 4 calls, 0 aggressions → AF 0',       caller.af === 0);
  check('Caller faced 4 raises, folded 0 → foldToRaise 0', caller.foldToRaise === 0);
}

console.log('\n— rolling ring buffer caps at 50 —');
reset();
for (let i = 0; i < 60; i++) {
  recordHand({
    playerIdsBySeat: ['Ring'],
    displayNamesBySeat: ['Ring'],
    actionLog: log([[0, 'preflop', 'fold']]),
    showdownSeats: [],
  });
}
{
  const r = getRead('Ring');
  check('handsObserved capped at 50', r.handsObserved === 50);
  check('all recorded folds → VPIP 0', r.vpip === 0);
}

console.log('\n— mixed VPIP across multiple hands —');
reset();
// 3 hands: hand 1 raise, hand 2 call, hand 3 fold — VPIP 66.7%, PFR 33.3%
recordHand({ playerIdsBySeat: ['Mixer'], displayNamesBySeat: ['Mixer'], actionLog: log([[0,'preflop','raise']]) });
recordHand({ playerIdsBySeat: ['Mixer'], displayNamesBySeat: ['Mixer'], actionLog: log([[0,'preflop','call']]) });
recordHand({ playerIdsBySeat: ['Mixer'], displayNamesBySeat: ['Mixer'], actionLog: log([[0,'preflop','fold']]) });
{
  const m = getRead('Mixer');
  check('VPIP ≈ 66.7 across 3 hands', Math.abs(m.vpip - 66.7) < 0.1);
  check('PFR ≈ 33.3 across 3 hands',  Math.abs(m.pfr - 33.3) < 0.1);
  check('handsObserved = 3',          m.handsObserved === 3);
}

console.log('\n— unknown opponent returns null —');
reset();
check('getRead("nobody") null', getRead('nobody') === null);

console.log('\n— summary —');
if (failures === 0) {
  console.log('all opponentStats checks passed');
  process.exit(0);
} else {
  console.error(`${failures} opponentStats checks failed`);
  process.exit(1);
}
