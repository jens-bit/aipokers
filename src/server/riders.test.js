// src/server/riders.test.js — RIDERS-1
//
// Four small server promises the client ports are built against. Each one is
// something a screen already renders and the server was not yet sending.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import { buildFlaggedEntry } from './flaggedHands.js';
import { restedFatigue, FATIGUE_RECOVERY_HOURS, FATIGUE_STAGES } from '../agent/attributes.js';
import { installAgentProfileRoutes, presentAgent, floorSnapshot } from './agentProfiles.js';
import { heatForState } from '../agent/mood.js';

// ── 1. REPLAY-1's two exactness gaps ────────────────────────────────────────
describe('streets[].pot and streets[].allIn', () => {
  const decision = (over = {}) => ({
    street: 'flop',
    action: { type: 'raise', amount: 1847 },
    community: ['Kc', '9c', '4c'],
    equity: 0.62,
    potOdds: 0.3,
    reasoning: 'He has missed this twice.',
    ...over,
  });

  it('carries the pot the action created', () => {
    const e = buildFlaggedEntry({
      flagType: 'bigBluff',
      decisions: [decision({ pot: 3694, allIn: false })],
      handNumber: 12, pot: 3694, holeCards: ['Qh', '3d'], won: true,
    });
    assert.equal(e.streets[0].pot, 3694);
  });

  it('says outright whether the action was all-in', () => {
    const jam = buildFlaggedEntry({
      flagType: 'bigBluff',
      decisions: [decision({ pot: 3694, allIn: true })],
      handNumber: 12, pot: 3694, holeCards: ['Qh', '3d'], won: true,
    });
    assert.equal(jam.streets[0].allIn, true);
    // The gap this closes: "raise 1847" is indistinguishable from a jam in the
    // action string, so the replay's hold never fired on a real all-in.
    assert.match(jam.streets[0].action, /RAISE 1847/);
  });

  it('is null, never a guess, for a hand recorded before they existed', () => {
    const old = buildFlaggedEntry({
      flagType: 'badBeat',
      decisions: [decision()],
      handNumber: 3, pot: 500, holeCards: ['Ah', 'Kd'], won: false,
    });
    assert.equal(old.streets[0].pot, null);
    assert.equal(old.streets[0].allIn, null);
  });

  it('distinguishes "not stored" from zero and from false', () => {
    const zero = buildFlaggedEntry({
      flagType: 'badBeat',
      decisions: [decision({ pot: 0, allIn: false })],
      handNumber: 3, pot: 0, holeCards: ['Ah', 'Kd'], won: false,
    });
    assert.equal(zero.streets[0].pot, 0);
    assert.equal(zero.streets[0].allIn, false);
  });

  it('leaves everything else on the row exactly as it was', () => {
    const e = buildFlaggedEntry({
      flagType: 'bigBluff',
      decisions: [decision({ pot: 400, allIn: false })],
      handNumber: 1, pot: 400, holeCards: ['Qh', '3d'], won: true,
    });
    const row = e.streets[0];
    assert.equal(row.street, 'flop');
    assert.deepEqual(row.board, ['Kc', '9c', '4c']);
    assert.equal(row.equity, 62);
    assert.equal(row.potOdds, 30);
    assert.equal(row.reasoning, 'He has missed this twice.');
  });
});

// ── 2. FLOOR-2's WORN pip ───────────────────────────────────────────────────
describe('fatigue recovers at the bar rather than resetting', () => {
  it('one stage back per recovery window', () => {
    assert.equal(restedFatigue('worn', 0), 'worn');
    assert.equal(restedFatigue('worn', FATIGUE_RECOVERY_HOURS - 0.1), 'worn');
    assert.equal(restedFatigue('worn', FATIGUE_RECOVERY_HOURS), 'settled');
    assert.equal(restedFatigue('worn', FATIGUE_RECOVERY_HOURS * 2), 'fresh');
    assert.equal(restedFatigue('settled', FATIGUE_RECOVERY_HOURS), 'fresh');
  });

  it('never goes the other way — time only ever restores', () => {
    for (const stage of FATIGUE_STAGES) {
      for (const hours of [0, 1, 5, 100]) {
        const after = restedFatigue(stage, hours);
        assert.ok(FATIGUE_STAGES.indexOf(after) <= FATIGUE_STAGES.indexOf(stage),
          `${stage} + ${hours}h became ${after}`);
      }
    }
  });

  it('treats an agent with no recorded session as rested, not permanently worn', () => {
    assert.equal(restedFatigue('worn', Infinity), 'fresh');
  });

  it('holds the stage when the elapsed time is unknown', () => {
    assert.equal(restedFatigue('worn', NaN), 'worn');
    assert.equal(restedFatigue('worn', -5), 'worn');
  });

  it('an idle agent keeps the stage he finished on', () => {
    // The bug: presentAgent used to report 'fresh' for any idle agent, so a
    // worn one looked box-fresh the instant the session ended.
    const justOffTheTable = {
      id: 'a1', name: 'The Grinder', status: 'idle', activeTableId: null,
      fatigue: 'worn', restedAt: Date.now(),
      stats: { handsPlayed: 400 }, mood: { state: 'neutral', heat: 30 },
    };
    assert.equal(presentAgent(justOffTheTable).fatigue, 'worn');
  });

  it('and looks rested again after a spell at the bar', () => {
    const hoursAgo = (h) => Date.now() - h * 3_600_000;
    const settled = {
      id: 'a2', name: 'The Grinder', status: 'idle', activeTableId: null,
      fatigue: 'worn', restedAt: hoursAgo(FATIGUE_RECOVERY_HOURS),
      stats: { handsPlayed: 400 }, mood: { state: 'neutral', heat: 30 },
    };
    assert.equal(presentAgent(settled).fatigue, 'settled');
    const fresh = { ...settled, id: 'a3', restedAt: hoursAgo(FATIGUE_RECOVERY_HOURS * 3) };
    assert.equal(presentAgent(fresh).fatigue, 'fresh');
  });
});

// ── 3. mood.heat on every projection ────────────────────────────────────────
describe('mood.heat rides every projection', () => {
  const userId = 'riders-heat-user';

  async function boot() {
    const app = express();
    app.use(express.json());
    installAgentProfileRoutes(app);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    return { server, base };
  }

  it('is on presentAgent, which is what all three projections are built from', () => {
    const p = presentAgent({
      id: 'a1', name: 'x', status: 'idle',
      mood: { state: 'tilted', heat: 82, cause: 'lost as the ~78% favorite' },
      stats: { handsPlayed: 10 },
    });
    assert.equal(p.mood.heat, 82);
    assert.equal(p.mood.state, 'tilted');
  });

  it('is backfilled from the band for a record stored before heat existed', () => {
    const p = presentAgent({
      id: 'a2', name: 'x', status: 'idle',
      mood: { state: 'tilted', cause: 'lost a big pot' },
      stats: { handsPlayed: 10 },
    });
    assert.equal(p.mood.heat, heatForState('tilted'));
  });

  it('rides the floor snapshot the WS channel pushes', async () => {
    const { server, base } = await boot();
    try {
      const floorUser = `${userId}-floor`;
      await fetch(`${base}/api/agents/chat/reset`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: floorUser }),
      });
      await fetch(`${base}/api/agents/build`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId: floorUser }),
      }).then((r) => r.json());
      const floor = floorSnapshot(floorUser, { owner: true });
      assert.ok(floor.length > 0, 'the floor has him');
      assert.equal(typeof floor[0].mood.heat, 'number');
    } finally {
      server.close();
    }
  });

  it('rides the list and the single-agent route', async () => {
    const { server, base } = await boot();
    try {
      await fetch(`${base}/api/agents/chat/reset`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      const built = await fetch(`${base}/api/agents/build`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      }).then((r) => r.json());
      const id = built.createdAgent?.id;
      assert.ok(id, 'agent built');

      const list = await fetch(`${base}/api/agents?userId=${userId}`).then((r) => r.json());
      const fromList = list.agents.find((a) => a.id === id);
      assert.equal(typeof fromList.mood.heat, 'number', 'GET /api/agents');

      const one = await fetch(`${base}/api/agents/${id}?userId=${userId}`).then((r) => r.json());
      assert.equal(typeof one.mood.heat, 'number', 'GET /api/agents/:id');
      assert.equal(one.mood.heat, fromList.mood.heat, 'and they agree');
    } finally {
      server.close();
    }
  });
});
