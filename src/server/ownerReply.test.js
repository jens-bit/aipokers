import test from 'node:test';
import assert from 'node:assert/strict';
import { spokenOwnerReply } from './ownerReply.js';

test('FIRST-CHAT-1: action-only replies are unavailable, while mixed replies retain speech', () => {
  for (const value of [null, {}, '', '*leans against the wall*', '_shrugs_', '[sighs]', '(looks away)', '*nods* *smiles*']) {
    assert.equal(spokenOwnerReply(value), '', String(value));
  }
  assert.equal(spokenOwnerReply('*leans against the wall* I heard you. *nods*'), 'I heard you.');
  assert.equal(spokenOwnerReply('[sighs] "That was a tough hand."'), '"That was a tough hand."');
});

test('FIRST-CHAT-1: ordinary emphasis, quoted dialogue, cards and parenthetical explanations survive', () => {
  for (const value of ['I *really* like that hand.', '**Absolutely.**', '**Looks good to me.**', '(Turns out I was right.)', '"I am ready."', 'I have As Ks (ace-king suited).', 'I can call (if the price stays low).']) {
    assert.equal(spokenOwnerReply(value), value);
  }
});
