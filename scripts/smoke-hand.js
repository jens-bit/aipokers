// Plays a few scripted heads-up hands against the engine to verify state
// transitions, pot math, and showdown payouts. Run with: npm run smoke
import { Game, Streets, Actions } from '../src/engine/game.js';

let failures = 0;
function check(label, cond) {
  if (cond) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.error(`  FAIL ${label}`);
  }
}

function newGame() {
  return new Game({
    tableId: 'smoke',
    seats: [
      { playerId: 'A', stack: 1000 },
      { playerId: 'B', stack: 1000 },
    ],
    smallBlind: 10,
    bigBlind: 20,
    dealerSeat: 0,
  });
}

console.log('\n— hand 1: SB folds preflop —');
{
  const g = newGame();
  g.startHand();
  check('street is preflop', g.street === Streets.PREFLOP);
  check('pot is SB+BB', g.pot === 30);
  check('SB acts first (seat 0)', g.toAct === 0);
  check('A stack debited SB', g.seats[0].stack === 990);
  check('B stack debited BB', g.seats[1].stack === 980);
  g.act(0, { type: Actions.FOLD });
  check('hand complete', g.street === Streets.COMPLETE);
  check('B wins uncontested pot', g.seats[1].stack === 1010);
  check('A keeps remaining stack', g.seats[0].stack === 990);
  check('button rotated', g.dealerSeat === 1);
}

console.log('\n— hand 2: limp / check / check / check / check showdown —');
{
  const g = newGame();
  g.startHand();
  // SB calls (limps): adds 10 to match BB
  g.act(0, { type: Actions.CALL });
  check('pot = 2 * BB after limp', g.pot === 40);
  check('still preflop, BB to act', g.street === Streets.PREFLOP && g.toAct === 1);
  // BB checks option
  g.act(1, { type: Actions.CHECK });
  check('moved to flop', g.street === Streets.FLOP);
  check('community has 3 cards', g.community.length === 3);
  check('BB acts first postflop', g.toAct === 1);
  // check, check
  g.act(1, { type: Actions.CHECK });
  g.act(0, { type: Actions.CHECK });
  check('moved to turn', g.street === Streets.TURN);
  check('community has 4 cards', g.community.length === 4);
  g.act(1, { type: Actions.CHECK });
  g.act(0, { type: Actions.CHECK });
  check('moved to river', g.street === Streets.RIVER);
  check('community has 5 cards', g.community.length === 5);
  g.act(1, { type: Actions.CHECK });
  g.act(0, { type: Actions.CHECK });
  check('hand complete after river', g.street === Streets.COMPLETE);
  check('result is showdown', g.result.type === 'showdown');
  const totalChips = g.seats[0].stack + g.seats[1].stack;
  check('chip conservation (2000 in, 2000 out)', totalChips === 2000);
}

console.log('\n— hand 3: all-in preflop, runout to showdown —');
{
  const g = newGame();
  g.startHand();
  // SB raises all-in
  g.act(0, { type: Actions.RAISE, amount: 1000 });
  check('A is all-in', g.seats[0].allIn === true);
  check('A contributed full stack', g.seats[0].contribTotal === 1000);
  // BB calls
  g.act(1, { type: Actions.CALL });
  check('hand resolved (all-in runout)', g.street === Streets.COMPLETE);
  check('community fully dealt', g.community.length === 5);
  check('chip conservation', g.seats[0].stack + g.seats[1].stack === 2000);
}

console.log('\n— hand 4: BB raises preflop after SB call, SB folds —');
{
  const g = newGame();
  g.startHand();
  g.act(0, { type: Actions.CALL }); // SB completes to BB
  check('BB still to act (option)', g.toAct === 1 && g.street === Streets.PREFLOP);
  g.act(1, { type: Actions.RAISE, amount: 60 }); // raise to 60
  check('action back to SB', g.toAct === 0);
  check('current bet is 60', g.currentBet === 60);
  g.act(0, { type: Actions.FOLD });
  check('B wins uncontested', g.seats[1].stack === 1020);
  check('A stack down by 20 (the limp call)', g.seats[0].stack === 980);
}

console.log('\n— hand 5: short all-in raise refunds uncalled excess —');
{
  // Construct a contrived spot: BB has tiny stack, SB shoves much bigger.
  const g = new Game({
    tableId: 'smoke-shortstack',
    seats: [
      { playerId: 'A', stack: 1000 }, // SB / dealer
      { playerId: 'B', stack: 50 },   // BB
    ],
    smallBlind: 10,
    bigBlind: 20,
    dealerSeat: 0,
  });
  g.startHand();
  // After blinds: A=990 (10 in), B=30 (20 in), pot=30
  g.act(0, { type: Actions.RAISE, amount: 1000 });
  // A goes all-in for 1000. B can only call 50 total.
  g.act(1, { type: Actions.CALL });
  // B is all-in for 50 total. A's excess (1000 - 50 = 950) must be refunded.
  check('A refunded uncalled excess', g.seats[0].contribTotal === 50);
  check('total chips conserved', g.seats[0].stack + g.seats[1].stack === 1050);
  check('hand complete', g.street === Streets.COMPLETE);
}

console.log('\n— summary —');
if (failures === 0) {
  console.log('all checks passed');
  process.exit(0);
} else {
  console.error(`${failures} checks failed`);
  process.exit(1);
}
