// src/server/stablemate.test.js — AGENT-4 job D, rewritten by AGENT-5 job E
//
// ── TESTING LAW #5, STATED UP FRONT ─────────────────────────────────────────
//
// This file used to assert MATCH-1's rule: "two agents of one owner never
// share a casino table". JENS HAS EXPLICITLY OVERRULED THAT RULE. The product
// is not wrong here — the rule is one we no longer want, which is the one
// circumstance in which a red test gets rewritten rather than the code fixed.
//
// What the rule was for is not lost, it has moved: matchmaking now SPREADS an
// owner's agents by default and gathers them only when a deploy asks
// (`together: true`, AGENT-5 job F). The difference is that a preference can
// be overridden by the man who owns the agents, and a wall could not.
//
// ── What survives, and why this file still exists ───────────────────────────
//
// `seatOfStablemate` outlived the refusal it was written for. AGENT-4 fixed a
// real fault in it — the predicate counted the man being seated among his own
// obstacles, so it could say "one of yours is here" about somebody who was his
// only candidate for it — and that fault would be just as real in its new use.
// Job G asks the same question for the opposite reason: not to stop him
// sitting down, but so that he can SAY something when he notices who he is
// sitting next to. A man greeting himself is the same bug wearing a hat.
//
// So: the predicate is still asserted here, hard. The refusal built on it is
// asserted GONE.

import test from 'node:test';
import assert from 'node:assert/strict';

import { Table } from './table.js';

function table(opts = {}) {
  const t = new Table({ tableId: 't-mate', smallBlind: 10, bigBlind: 20, ...opts });
  t._scheduleNextHand = () => {};
  t.startSessionLoop = () => {};
  return t;
}

// ── the predicate ───────────────────────────────────────────────────────────

test('BUG-222: a man is never his own stablemate', () => {
  const t = table();
  t.seatAI({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 });

  assert.equal(t.seatOfStablemate('jens', { except: 'a1' }), -1,
    'the only agent of his at this table IS him');
  assert.equal(t.seatsAgentOfOwner('jens', { except: 'a1' }), false);

  // And asked about somebody else, it finds him.
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
  // The House regulars carry a userId of null.
  const t = table();
  t.seatAI({ displayName: 'Doyle', buyIn: 2_000 });
  t.seatAI({ displayName: 'Granite', buyIn: 2_000 });
  assert.equal(t.seatsAgentOfOwner('jens', { except: 'a1' }), false);
  assert.equal(t.joinAgentSession({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 }), 2);
});

// ── the refusal that used to be built on it ─────────────────────────────────

test('AGENT-5 job E: two of one owner DO share a casino table now', () => {
  // Was: "BUG-222: two of one owner still never share a casino table", which
  // asserted `null`. Rewritten under testing law #5 — see the header.
  const t = table();
  t.seatAI({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 });
  assert.equal(
    t.joinAgentSession({ agentId: 'a2', userId: 'jens', displayName: 'Deuce', buyIn: 2_000 }),
    1,
    'the door no longer refuses a stablemate',
  );
  assert.equal(t.seatedCount(), 2);
});

test('AGENT-5 job E: WATCH seats the second one instead of throwing', () => {
  // Was: "BUG-222: the refusal names the stablemate and states the rule".
  const t = table();
  t.seatAI({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 });

  const ws = { readyState: 1, OPEN: 1, send() {} };
  const seat = t.addSpectator(ws, { agentId: 'a2', userId: 'jens', displayName: 'Deuce' });
  assert.equal(seat, 1, 'he takes the chair rather than an error');
  assert.equal(t.seatedCount(), 2);
});

test('AGENT-5 job E: no collusion guard came with it', () => {
  // The brief is explicit: no collusion guard, no special-cased play. Two of
  // one owner's agents are two players. Asserted as an ABSENCE, because an
  // absence is exactly the kind of thing that gets quietly added back.
  const t = table();
  t.seatAI({ agentId: 'a1', userId: 'jens', displayName: 'Ace', buyIn: 2_000 });
  t.seatAI({ agentId: 'a2', userId: 'jens', displayName: 'Deuce', buyIn: 2_000 });

  // Nothing on the table marks the pair, and nothing about the seats differs
  // from a table of two strangers.
  assert.equal(t.aiSeats[0], true);
  assert.equal(t.aiSeats[1], true);
  assert.equal(t.seatLeaving[0], false);
  assert.equal(t.seatLeaving[1], false);
  assert.equal(typeof t.stablemateMessage, 'undefined',
    'the refusal sentence is gone, not merely unused');
});

test('AGENT-5 job E: and the kitchen table is unchanged', () => {
  // It was always the exception; it is now simply the same as everywhere else,
  // which is a smaller product rather than a bigger one.
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
