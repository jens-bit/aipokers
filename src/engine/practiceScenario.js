import { Game, Actions } from './game.js';
import { createDeck } from './deck.js';
import { evaluate } from './hand.js';
import { plainHandName } from './handName.js';

// Development-time source for client/src/lib/practiceLesson.json. The browser
// reads that static lesson; it never imports this module or joins a real table.
// All actions and payouts come from Game. No profiles, wallets, stores, clocks
// or model calls are involved, and the opponent's cards stay hidden until shown.
const INITIAL_STACK = 200;
const HERO_SEAT = 0;
const DEAL_PREFIX = Object.freeze([
  'Qh', 'Kh', 'Qd', 'Kd', // Heads-up dealing starts at seat 1, twice around.
  '2c', 'Ks', '7c', '2h', // Burn, then the flop.
  '3c', '7h',             // Burn, then the turn.
  '4c', '9c',             // Burn, then the river.
]);

export function createPracticeDeck() {
  const dealt = new Set(DEAL_PREFIX);
  return [...DEAL_PREFIX, ...createDeck().filter(card => !dealt.has(card))];
}

/** A deterministic public lesson; each call returns independently owned data. */
export function buildPracticeLesson() {
  const game = new Game({
    tableId: 'practice-kings-full',
    seats: [
      { playerId: 'practice-hero', stack: INITIAL_STACK },
      { playerId: 'practice-opponent', stack: INITIAL_STACK },
    ],
    smallBlind: 1,
    bigBlind: 2,
  });
  const frames = [];
  let lastAction = null;

  function play(seat, type, amount) {
    const action = amount == null ? { type } : { type, amount };
    game.act(seat, action);
    lastAction = { seat, action };
  }

  function capture(id, title, narration, target) {
    const state = game.getPublicState(HERO_SEAT);
    state.seats = state.seats.map((seat, index) => ({
      ...seat,
      displayName: index === HERO_SEAT ? 'Your agent' : 'Practice opponent',
    }));
    // evaluate() requires a flop. Before it, the two private cards are shown
    // without inventing a five-card hand or looking ahead at the fixed deck.
    const madeHand = state.community.length >= 3
      ? plainHandName(evaluate(state.seats[HERO_SEAT].holeCards, state.community))
      : null;
    frames.push({
      id, title, narration, target,
      game: structuredClone(state),
      lastAction: structuredClone(lastAction),
      madeHand,
    });
  }

  game.startHand(createPracticeDeck());
  capture('deal', 'Meet your agent',
    'Your agent sits nearest you. The other player is a practice opponent. Your agent plays this example hand; you guide the lesson at your own pace.',
    'hero');

  play(0, Actions.CALL);
  capture('preflop-call', 'Two cards of his own',
    'Your agent holds two kings. These are his private cards. He calls one more chip to match the two-chip blind.',
    'cards');

  play(1, Actions.CHECK);
  capture('flop', 'The shared cards',
    'The first three shared cards are the flop. Everyone can use them. This king joins his two kings to make three of a kind.',
    'board');

  play(1, Actions.CHECK);
  play(0, Actions.BET, 4);
  capture('flop-bet', 'He makes a bet',
    'The opponent checks. With three kings, your agent bets four practice chips. The opponent must match the bet to stay in the hand.',
    'action');

  play(1, Actions.CALL);
  capture('turn', 'A full house',
    'The opponent calls. The fourth shared card, the turn, is another seven. Three kings and two sevens make a full house: kings full of sevens.',
    'board');

  play(1, Actions.CHECK);
  play(0, Actions.CHECK);
  capture('river', 'The final shared card',
    'Both players check, adding no chips. The river is the fifth and final shared card. Your agent still has kings full of sevens.',
    'board');

  play(1, Actions.CHECK);
  play(0, Actions.BET, 8);
  capture('river-bet', 'One last bet',
    'The opponent checks again. Your agent bets eight practice chips with his full house. The next step shows whether the opponent calls.',
    'action');

  play(1, Actions.CALL);
  capture('showdown', 'The hand, explained',
    'The opponent calls and both hands are shown. Kings full of sevens wins the 28-chip pot. Your agent put in 14 chips, so his profit is 14 practice chips.',
    'result');

  const final = frames.at(-1).game;
  const winner = final.result.winners[0];
  const payout = final.result.winners
    .filter(entry => entry.seat === HERO_SEAT)
    .reduce((total, entry) => total + entry.amount, 0);
  return {
    schema: 'railbird.practice-lesson',
    version: 1,
    practiceOnly: true,
    id: 'kings-full',
    heroSeat: HERO_SEAT,
    initialStack: INITIAL_STACK,
    frames,
    result: {
      winnerSeat: winner.seat,
      hand: winner.hand,
      pot: final.result.pot,
      payout,
      net: final.seats[HERO_SEAT].stack - INITIAL_STACK,
      balances: final.seats.map(seat => seat.stack),
    },
  };
}
