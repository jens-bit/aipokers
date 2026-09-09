import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Table } from './table.js';
import { Game } from '../engine/game.js';
import { saveProfile, _closeForTests } from './store.js';
import { getFlaggedHand } from './agentProfiles.js';
import { buildFlaggedEntry } from './flaggedHands.js';
test('BUG-114: a completed hand persists stack change and identity before seats leave', () => {
  saveProfile('share114', {
    agents: [{
      id: 'agent114',
      name: 'Granite',
      identity: {
        hood: 'moss',
        glow: 'gold',
        secret: 'private'
      },
      profile: {
        tightness: 50,
        aggression: 50,
        bluffFreq: 25,
        discipline: 60
      }
    }]
  });
  const t = new Table({
    tableId: 'share114',
    smallBlind: 10,
    bigBlind: 20
  });
  t.agentIds[0] = 'agent114';
  t.agentUserIds[0] = 'share114';
  t.pending[0] = {
    playerId: 'p0',
    displayName: 'Granite',
    buyIn: 2000
  };
  t.pending[1] = {
    playerId: 'p1',
    buyIn: 2000
  };
  t.game = new Game({
    tableId: t.tableId,
    seats: [{
      playerId: 'p0',
      stack: 2000
    }, {
      playerId: 'p1',
      stack: 2000
    }],
    smallBlind: 10,
    bigBlind: 20
  });
  t.currentHandStartStacks = t.game.seats.map(s => s.stack);
  t.game.startHand();
  // A side-pot winner can still finish below his starting stack.
  t.game.seats[0].stack = 1880;
  t.game.handNumber = 114;
  const result = {
    type: 'showdown',
    pot: 1840,
    winners: [{
      seat: 0,
      amount: 500
    }],
    showdown: []
  };
  try {
    t._classifyAndFlagHands(result);
    const h = getFlaggedHand('agent114', 'share114', 114).hand;
    assert.equal(h.won, true);
    assert.equal(h.pot, 1840);
    assert.equal(h.net, -120);
    assert.deepEqual(h.identity, {
      hood: 'moss',
      glow: 'gold'
    });
    assert.equal(JSON.stringify(h).includes('private'), false);
  } finally {
    _closeForTests();
  }
});
test('old flagged records retain unknown net instead of guessed zero', () => {
  const e = buildFlaggedEntry({
    pot: 100,
    won: true
  });
  assert.equal(e.net, null);
  assert.equal(e.identity, null);
  assert.equal(buildFlaggedEntry({
    net: NaN
  }).net, null);
});
