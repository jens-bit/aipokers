// Offline, policy-only economy measurement. No sockets, model calls, grants
// beyond the real first-owner grant, or writes to the application's store.
// Run it through scripts/simulate-house-economy.js, which supplies a scratch cwd.
import assert from 'node:assert/strict';
import { createDeck } from '../engine/deck.js';
import { Streets } from '../engine/game.js';
import { chooseFromPolicy } from '../agent/policyPlay.js';
import { Table } from './table.js';
import { HOUSE_CAST } from './houseCast.js';
import { setPersistEnabled, reset as resetReads } from './opponentStats.js';
import { rakeSettings } from './rake.js';
import { STAKES, emptyWallet, emptyPocket, autoRefill, debitBuyIn, creditCashOut, takeRake, recordEarned, stakesFor } from './wallet.js';
import { unlockedSlots } from './slots.js';

export const STARTER_PROFILES = Object.freeze({
  balanced: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  tag: { tightness: 70, aggression: 72, bluffFreq: 25, discipline: 80 },
  aggressive: { tightness: 30, aggression: 85, bluffFreq: 45, discipline: 45 },
});

export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function deckFrom(seed) {
  const rand = seededRandom(seed), deck = createDeck();
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Keep benchmark overrides process-local and restore every one, including on
// a rejected engine action. Decks and decisions have independent streams, so
// changing one action does not reshuffle the next hand in an A/B comparison.
export function playHouseSession({ seed = 1, rung = 0, profile = STARTER_PROFILES.balanced, hands = 100, iterations = 120, opponent = null } = {}) {
  if (process.env.ANTHROPIC_API_KEY) throw new Error('Economy benchmark refuses a model API key');
  assert.ok(STAKES[rung], 'unknown stakes rung');
  assert.ok(Number.isInteger(hands) && hands > 0, 'hands must be a positive integer');
  const stake = STAKES[rung];
  const oldRandom = Math.random, oldIterations = process.env.EQUITY_ITERATIONS, oldLog = console.log;
  let table;
  try {
    setPersistEnabled(false);
    resetReads();
    console.log = () => {};
    process.env.EQUITY_ITERATIONS = String(iterations);
    Math.random = seededRandom(seed ^ 0x71a54bb3);
    table = new Table({ tableId: `economy-${seed}-${rung}`, ...stake, maxSeats: 2 });
    for (const name of ['_scheduleNextHand', 'startSessionLoop', '_broadcast', '_broadcastState', '_notifyStateChange', '_threadAction', '_threadTable']) table[name] = () => {};
    // A benchmark hero has the real numeric starter policy and no persistent
    // record: rested/neutral, no drinks, no growth or learned model memory.
    const hero = table.seatAI({ displayName: 'Starter', agentProfile: profile, buyIn: stake.buyIn });
    const cast = {};
    const fill = () => {
      if (opponent) {
        const member = HOUSE_CAST.find(m => m.id === opponent);
        assert.ok(member, `unknown House member ${opponent}`);
        table.seatAI({ displayName: member.name, strategy: member.strategy, agentProfile: member.profile,
          stableId: member.id, buyIn: stake.buyIn });
      } else table._seatHouseRegulars(2);
      for (const id of table._seatedCastIds()) cast[id] = (cast[id] ?? 0) + 1;
    };
    fill();
    const initialCast = table._seatedCastIds()[0];
    const castHands = {};
    const deltas = [];
    let heroRake = 0, allRake = 0, decisions = 0;
    for (let hand = 0; hand < hands; hand++) {
      if (table.seatStack(hero) <= 0) break;
      table._reconcileSeats();
      if (table.liveSeatCount() < 2) fill();
      table._reconcileSeats();
      assert.ok(table.game, 'House refill must leave a playable table');
      for (const id of table._seatedCastIds()) castHands[id] = (castHands[id] ?? 0) + 1;
      const before = table.seatStack(hero);
      table.currentHandActionLog = [];
      table.currentHandDecisions = [];
      table.currentHandStartStacks = table.game.seats.map(player => player.stack);
      table._raiseCounts = {};
      table._streetAtActionCapture = null;
      const handSeed = (seed + Math.imul(hand + 1, 0x9e3779b1)) >>> 0;
      table.game.startHand(deckFrom(handSeed));
      Math.random = seededRandom(handSeed ^ 0x85ebca6b);
      let guard = 0;
      while (table.game.street !== Streets.COMPLETE) {
        assert.ok(guard++ < 400, 'hand did not complete');
        const seat = table.game.toAct;
        assert.notEqual(seat, null, 'incomplete hand lost its actor');
        const gs = table._buildAiGameState(seat);
        const action = table._disciplineAction(seat, chooseFromPolicy(gs).action);
        const street = table.game.street;
        // No silent fallback: a rejected policy action invalidates a measure.
        try { table.game.act(seat, action); }
        catch (error) {
          throw new Error(`Benchmark invalid action: ${JSON.stringify({ seed, rung, hand, seat, street, action,
            players: table.game.seats.map(p => ({ stack: p.stack, allIn: p.allIn, folded: p.folded, contribution: p.contribThisStreet })),
            currentBet: table.game.currentBet, log: table.currentHandActionLog })}`, { cause: error });
        }
        table._incrementRaiseCountIfAggressive(action);
        table._logAction(seat, street, action);
        decisions++;
      }
      const result = table.game.result;
      const cut = table._takeRake(result);
      assert.equal(Object.values(result.deltas).reduce((sum, value) => sum + value, 0) + cut, 0, 'hand chips including rake must conserve');
      heroRake += result.rake?.bySeat?.[hero] ?? 0;
      allRake += cut;
      deltas.push(table.game.seats[hero].stack - before);
      table.handsThisSession++;
      table._recordOpponentStats(result);
      table._captureStacks();
      table._recordButton();
    }
    const stack = table.seatStack(hero);
    assert.equal(deltas.reduce((sum, delta) => sum + delta, 0), stack - stake.buyIn, 'session returns must sum to stack');
    return { seed, rung, hands: deltas.length, decisions, stack, net: stack - stake.buyIn,
      rake: heroRake, allRake, bust: stack === 0, initialCast, cast, castHands, deltas };
  } finally {
    table?._clearTimers();
    Math.random = oldRandom;
    console.log = oldLog;
    if (oldIterations === undefined) delete process.env.EQUITY_ITERATIONS; else process.env.EQUITY_ITERATIONS = oldIterations;
  }
}

export function summarizeSessions(sessions, rung) {
  const bb = STAKES[rung].bigBlind;
  const deltas = sessions.flatMap(s => s.deltas);
  const hands = deltas.length, net = sessions.reduce((sum, s) => sum + s.net, 0);
  const rake = sessions.reduce((sum, s) => sum + s.rake, 0);
  const mean = net / Math.max(1, hands) / bb;
  const variance = deltas.reduce((sum, value) => sum + (value / bb - mean) ** 2, 0) / Math.max(1, hands - 1);
  // Session-cluster standard error: the streak inside one session is not N
  // independent copies of the starting-stack state.
  const residuals = sessions.map(s => s.net / bb - mean * s.hands);
  const standardError = sessions.length > 1
    ? Math.sqrt(sessions.length / (sessions.length - 1) * residuals.reduce((sum, x) => sum + x * x, 0)) / hands * 100 : null;
  return { rung, hands, sessions: sessions.length, net, rake, netBb100: mean * 100,
    preRakeBb100: (net + rake) / Math.max(1, hands) / bb * 100,
    rakeBb100: rake / Math.max(1, hands) / bb * 100, stdevBb100: Math.sqrt(variance) * 10,
    standardErrorBb100: standardError, wins: sessions.filter(s => s.net > 0).length,
    busts: sessions.filter(s => s.bust).length, initialCast: sessions.reduce((out, s) => {
      out[s.initialCast] = (out[s.initialCast] ?? 0) + 1;
      return out;
    }, {}), castHands: sessions.reduce((out, s) => {
      for (const [id, n] of Object.entries(s.castHands)) out[id] = (out[id] ?? 0) + n;
      return out;
    }, {}), cast: sessions.reduce((out, s) => {
      for (const [id, n] of Object.entries(s.cast)) out[id] = (out[id] ?? 0) + n;
      return out;
    }, {}) };
}

// Resample complete measured sessions, not a Gaussian invented around one
// pooled win rate. This is a projection, not more independent played hands.
// One cared-for agent, auto-refill from the actual 8,000 safe/2,000 pocket,
// free rest between sessions, no paid food, no new agents or skill growth.
// `progress` is an explicit experiment: choose the highest affordable rung
// on each NEW deploy. Production also supports choosing/keeping a lower rung;
// neither the table loop nor winning a pot automatically promotes a player.
export function projectHouseholds(byRung, { seed = 1, households = 1000, sessions = 100, progress = true } = {}) {
  const rand = seededRandom(seed), rows = [];
  assert.ok(byRung[0]?.length, 'entry session samples required');
  for (let n = 0; n < households; n++) {
    const wallet = { ...emptyWallet(`bench-${n}`), balance: 8000 };
    const pocket = emptyPocket({ balance: 2000, mode: 'auto', cap: 2000 });
    let bank = 0, hands = 0, played = 0, maxRung = 0;
    const milestones = {};
    for (; played < sessions; played++) {
      autoRefill(wallet, pocket);
      const natural = stakesFor(pocket.balance);
      if (!natural) break;
      const rung = progress ? natural.rung : 0;
      const stake = STAKES[rung], samples = byRung[rung];
      assert.ok(samples?.length, `missing rung ${rung} samples for progression`);
      const draw = samples[Math.floor(rand() * samples.length)];
      const paid = debitBuyIn(pocket, stake.buyIn, 'benchmark');
      assert.equal(paid.ok, true);
      bank += paid.moved;
      const gross = draw.stack + draw.rake;
      creditCashOut(pocket, gross, 'benchmark'); bank -= gross;
      const cut = takeRake(pocket, draw.rake, 'benchmark'); bank += cut.moved;
      recordEarned(wallet, draw.net);
      hands += draw.hands;
      maxRung = Math.max(maxRung, rung);
      for (let slot = 2; slot <= unlockedSlots(wallet.earned); slot++) milestones[`slot${slot}`] ??= played + 1;
      if (rung > 0) milestones[`rung${rung}`] ??= played + 1;
      assert.equal(wallet.balance + pocket.balance + bank, 10000, 'household transfers including rake must conserve');
    }
    rows.push({ balance: wallet.balance + pocket.balance, earned: wallet.earned, hands, sessions: played,
      canPlay: wallet.balance + pocket.balance >= STAKES[0].buyIn, maxRung, milestones });
  }
  const mean = field => rows.reduce((sum, r) => sum + r[field], 0) / rows.length;
  return { households, sessionHorizon: sessions, progression: progress, alive: rows.filter(r => r.canPlay).length,
    deploymentPolicy: progress ? 'highest-affordable-on-every-new-deploy' : 'explicit-entry-rung-on-every-new-deploy',
    meanBalance: mean('balance'), meanEarned: mean('earned'), meanHands: mean('hands'),
    milestones: Object.fromEntries(['slot2','slot3','slot4','rung1','rung2'].map(key => {
      const reached = rows.map(r => r.milestones[key]).filter(Number.isFinite).sort((a,b) => a-b);
      return [key, { reached: reached.length, medianSessionAmongReachers: reached.length ? reached[Math.floor(reached.length / 2)] : null }];
    })) };
}

export const currentRake = rakeSettings;
