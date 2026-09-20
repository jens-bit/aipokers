import test from 'node:test';
import assert from 'node:assert/strict';
import { explicitAllInIntent, ALL_IN_EVERY_HAND_STRATEGY, allInStrategyAction, ALL_IN_EVERY_HAND } from './strategyIntent.js';

test('BUG-283: affirmative unconditional all-in instructions compile, including ordinary founder wording', () => {
  for (const text of [ALL_IN_EVERY_HAND_STRATEGY, 'Make him go all in each hand.',
    'all I want him to play is all in, all the time', 'Go all-in every hand.',
    'You move all in every hand, with any two cards.', 'Always shove.',
    'Jam any two, anytime.', 'Shove anytwo anytime.', 'Go all in constantly.',
    'Every single hand, move all in.', 'He goes all‑in every hand.',
    'Never fold. Always go all in.', 'Make him go all in each hand Loose Often',
    'Make him go all in each hand\nLoose\nOften\nWhen unsure, push',
    'Push your entire stack whenever it is your turn.', 'Move all in regardless of cards.',
    'Shove at every legal opportunity.']) {
    assert.equal(explicitAllInIntent(text), true, text);
  }
});

test('BUG-283: names, loose personalities, negation, conditions, quotes and opponent descriptions never force all-in', () => {
  for (const text of [null, {}, '', 'All In', 'Play loose and aggressive.', 'Play any two cards.',
    'He is called All In and plays every hand.', 'My opponent goes all in every hand.',
    'For example, go all in every hand.', '"go all in every hand" is a bad strategy.',
    "'Go all in every hand'", 'Do not go all in every hand.', "Don't always shove.",
    "He shouldn't shove every hand", "Don't make him go all in every hand",
    'Should I go all in every hand?', 'Can he go all in every hand?',
    'Always shove. You should not let him shove every hand.',
    'Never jam every hand.', 'Go all in every hand if you have aces.',
    'Go all in every hand unless someone raises.', 'Go all in every hand when short stacked.',
    'Only go all in every hand with good cards.', 'Almost always shove.',
    'Go all in every hand. Never go all in.', 'Always shove. Only shove with aces.',
    'Always shove\nDo not go all in every hand.', 'Always shove. Sometimes shove.',
    'Always shove\nOnly with aces', 'Always shove\nActually stop doing that',
    'Always shove\ninstead play tight', 'Always shove\nDon\'t do that',
    'Always shove\nHe shouldn’t shove every hand',
    'You play nearly every hand and love maximum all-in pressure.',
    'What happens if I go all in every hand?', 'You are an all-in gambler. Play every hand.']) {
    assert.equal(explicitAllInIntent(text), false, String(text));
  }
});

test('BUG-283: the original saved BUG223 fallback compiles without enforcing its obsolete never-call wording', () => {
  const old = 'You move all in. That is the whole strategy and you do not deviate from it: '
    + 'whenever it is your turn and you have chips, you put every one of them in the middle, '
    + 'preflop or otherwise, with any two cards. You never call and you never make a small '
    + 'raise. If the only legal move is to check, you check, and then you shove on the next '
    + 'street. You are not bluffing and you are not value betting - you are making every pot '
    + 'a decision for your opponent and nothing else.';
  assert.equal(explicitAllInIntent(old), true);
  assert.equal(explicitAllInIntent(`${old}\nOnly shove with aces.`), false);
});

test('BUG-283: a compiled directive cannot invent an unavailable raise or an action on an absent turn', () => {
  assert.equal(allInStrategyAction({ canRaise: true, maxRaise: 2000 }), null);
  assert.equal(allInStrategyAction({ policy: { intent: ALL_IN_EVERY_HAND }, canRaise: false, maxRaise: 2000, toCall: 0 }), null);
});
