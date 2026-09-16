// src/server/stablemate.test.js — AGENT-4 job D
//
// "another of your agents is already at this table"
//
// ── What the string is, and what it is not ──────────────────────────────────
//
// Jens reported seeing "Another of your agents is already unstable." in prod.
// The literal word "unstable" appears nowhere in the source; the only sentence
// in the codebase of that shape is `table.js`'s MATCH-1 refusal, which is what
// this file is about.
//
// THE CONDITION. `addSpectator` and `joinAgentSession` both refused on
// `!this.home && this.seatsAgentOfOwner(userId)` — true when ANY seat at this
// casino table holds an agent belonging to that owner. MATCH-1's rule is "not
// two of ONE OWNER'S agents at ONE table", so the question it needs answered is
// about the owner's OTHER agents, and this predicate counted the man being
// seated among his own obstacles. Both call sites returned early when he was
// already seated here, so it was correct BY ACCIDENT rather than by
// construction — and a third caller would have been told that an agent was
// blocked by himself. That is the half of Jens's reading that was a real fault:
// the sentence can be produced about a man who is his only candidate for it.
//
// THE SENTENCE. It named nobody. Not which agent is already there, not which
// agent is being refused, and it began mid-sentence. MONEY-1 fixed exactly this
// failure on the sibling refusal (`seatedElsewhereMessage` names the felt,
// because "no" tells an owner nothing he can act on) and left this one behind.
//
// Both are fixed here: the predicate takes the agent it is being asked on
// behalf of, and the sentence names the stablemate and says what the rule is.

import test from 'node:test';
import assert from 'node:assert/strict';

import { Table } from './table.js';

function table(opts = {}) {
  const t = new Table({ tableId: 't-mate', smallBlind: 10, bigBlind: 20, ...opts });
  t._scheduleNextHand = () => {};
  t.startSessionLoop = () => {};
  return t;
}

// ── the condition ───────────────────────────────────────────────────────────

test('BUG-222: a man is never his own stablemate', () => {
  const t = table();
  t.seatAI({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 });

  assert.equal(t.seatOfStablemate('jens', { except: 'a1' }), -1,
    'the only agent of his at this table IS him');
  assert.equal(t.seatsAgentOfOwner('jens', { except: 'a1' }), false);

  // And asked about somebody else, the rule still holds.
  assert.equal(t.seatOfStablemate('jens', { except: 'a2' }), 0);
  assert.equal(t.seatsAgentOfOwner('jens', { except: 'a2' }), true);
});

test('BUG-222: it finds the stablemate wherever he is sitting', () => {
  const t = table();
  t.seatAI({ displayName: 'House', buyIn: 2_000 });                              // no owner
  t.seatAI({ agentId: 'b1', userId: 'someone-else', displayName: 'Other', buyIn: 2_000 });
  t.seatAI({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 });

  assert.equal(t.seatOfStablemate('jens', { except: 'a2' }), 2,
    'not seat 0, which is the House, and not seat 1, which is a stranger');
  assert.equal(t.seatOfStablemate('nobody'), -1);
  assert.equal(t.seatOfStablemate(null), -1, 'a seat with no owner blocks nobody');
  assert.equal(t.seatOfStablemate(''), -1);
});

test('BUG-222: an unowned seat is not a stablemate', () => {
  // The House regulars carry a userId of null. A table full of them must never
  // refuse an owner's first agent.
  const t = table();
  t.seatAI({ displayName: 'Doyle', buyIn: 2_000 });
  t.seatAI({ displayName: 'Granite', buyIn: 2_000 });
  assert.equal(t.seatsAgentOfOwner('jens', { except: 'a1' }), false);
  assert.equal(t.joinAgentSession({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 }), 2);
});

// ── the sentence ────────────────────────────────────────────────────────────

test('BUG-222: the refusal names the stablemate and states the rule', () => {
  const t = table();
  t.seatAI({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 });

  const ws = { readyState: 1, OPEN: 1, send() {} };
  assert.throws(
    () => t.addSpectator(ws, { agentId: 'a2', userId: 'jens', displayName: 'Deuce' }),
    (err) => {
      const line = err.message;
      // The old string named nobody and began mid-sentence.
      assert.doesNotMatch(line, /another of your agents/i, `still the old copy: "${line}"`);
      assert.match(line, /Ace/, 'the agent who is already there');
      assert.match(line, /Deuce/, 'and the one being refused');
      assert.match(line, /^[A-Z]/, 'it is a sentence');
      assert.match(line, /table of his own/, 'and it says what to do about it');
      return true;
    },
  );
  assert.equal(t.seatedCount(), 1, 'and nobody was seated on the way out');
});

test('BUG-222: the sentence still works when the seat has no display name', () => {
  const t = table();
  t.seatAI({ agentId: 'a1', userId: 'jens', buyIn: 2_000 });
  const line = t.stablemateMessage(0, null);
  assert.ok(line.trim().length > 0);
  assert.match(line, /^[A-Z]/);
  assert.doesNotMatch(line, /undefined|null/);
});

// ── the rule it enforces is unchanged ───────────────────────────────────────

test('BUG-222: two of one owner still never share a casino table', () => {
  const t = table();
  t.seatAI({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 });
  assert.equal(
    t.joinAgentSession({ agentId: 'a2', userId: 'jens', displayName: 'Deuce', buyIn: 2_000 }),
    null,
    'MATCH-1 stands',
  );
  assert.equal(t.seatedCount(), 1);
});

test('BUG-222: and the kitchen table is still the exception', () => {
  // The home game seats a household on purpose — see homeGame.js.
  const t = table({ tableId: 'home-jens', home: true, homeOwnerId: 'jens' });
  t.seatAI({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 });
  const seat = t.joinAgentSession({ agentId: 'a2', userId: 'jens', displayName: 'Deuce', buyIn: 2_000 });
  assert.equal(seat, 1, 'two of his may sit down together at home');
});

test('BUG-222: a stranger at the table is no obstacle at all', () => {
  const t = table();
  t.seatAI({ agentId: 'b1', userId: 'someone-else', displayName: 'Other', buyIn: 2_000 });
  assert.equal(
    t.joinAgentSession({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 }),
    1,
    'playing other people is the entire point',
  );
});
