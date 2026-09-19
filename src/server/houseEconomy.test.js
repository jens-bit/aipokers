import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCastMemberExcluding } from './houseCast.js';
import { pickComplementaryHouse, pickHouseRegular } from './matchmaking.js';
import { Table } from './table.js';

const balanced = { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 };

test('BUG-253: entry House mixes an exploitable regular with the existing competitive cast', () => {
  assert.equal(pickComplementaryHouse(balanced, { bigBlind: 20, rand: () => 0 }).stableId, 'tilted_ted');
  assert.equal(pickComplementaryHouse(balanced, { bigBlind: 20, rand: () => 0.66 }).stableId, 'tilted_ted');
  assert.equal(pickComplementaryHouse(balanced, { bigBlind: 20, rand: () => 2 / 3 }).stableId, 'doyle_v3');
  assert.equal(pickComplementaryHouse(balanced, { bigBlind: 20, rand: () => 0.99 }).stableId, 'doyle_v3');
});

test('BUG-253: higher stakes and callers without a casino stake retain the original House challenge', () => {
  for (const bigBlind of [50, 100, undefined, null, 0]) {
    assert.equal(pickComplementaryHouse(balanced, { bigBlind, rand: () => 0 }).stableId, 'doyle_v3');
  }
});

test('BUG-253: entry refills follow the same rule without duplicating a seated House identity', () => {
  assert.equal(pickHouseRegular(balanced, [], { bigBlind: 20, rand: () => 0 }).stableId, 'tilted_ted');
  const occupied = ['tilted_ted'];
  for (let i = 0; i < 5; i++) {
    const next = pickCastMemberExcluding(balanced, occupied, { bigBlind: 20, rand: () => 0 });
    assert.ok(next);
    assert.ok(!occupied.includes(next.id));
    occupied.push(next.id);
  }
  assert.equal(new Set(occupied).size, 6);
  assert.equal(pickCastMemberExcluding(balanced, occupied, { bigBlind: 20, rand: () => 0 }), null);
});

test('BUG-253: both first-session and refill seating pass the real table stakes to the House selector', () => {
  const original = Math.random;
  const tables = [];
  try {
    Math.random = () => 0;
    for (const bigBlind of [20, 50, 100]) {
      for (const fresh of [true, false]) {
        const table = new Table({ tableId: `house-economy-${bigBlind}-${fresh}`, smallBlind: bigBlind / 2, bigBlind });
        tables.push(table);
        table.startSessionLoop = () => {};
        table._notifyStateChange = () => {};
        if (fresh) table.startAgentSession({ displayName: 'Starter', agentProfile: balanced, buyIn: bigBlind * 100 });
        else {
          table.seatAI({ displayName: 'Starter', agentProfile: balanced, buyIn: bigBlind * 100 });
          table._seatHouseRegulars(2);
        }
        assert.deepEqual(table._seatedCastIds(), [bigBlind === 20 ? 'tilted_ted' : 'doyle_v3']);
      }
    }
  } finally {
    Math.random = original;
    tables.forEach(table => table._clearTimers());
  }
});
