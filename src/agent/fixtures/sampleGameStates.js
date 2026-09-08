// src/agent/fixtures/sampleGameStates.js — COST-2
//
// A deck of decision spots, without a table.
//
// Job 1 needs a pile of realistic gs objects to measure prompt size across —
// "an offline hand replay" that touches no engine and no model. Job 2 needs
// the SAME pile, frozen, so trimming the prompt builder can be checked against
// it: same inputs in, same substantive fields out. One generator serves both,
// seeded so "200 recorded spots" means the same 200 spots every time it runs.
//
// Deliberately not the real engine: table.js already has extensive coverage
// for how a gs is built from a hand in progress (game.test.js, table tests).
// This is a grab-bag of every SHAPE buildUserPrompt branches on — every
// street, priced and free, policy-verdicted and not, moody and level, needled
// and quiet, read-carrying and blank — so a token measurement or a trim isn't
// accidentally taken on one corner of the prompt.

const STREETS = ['preflop', 'flop', 'turn', 'river'];
const HOLE = [
  ['Ah', 'Ad'], ['7h', '2d'], ['Ks', 'Qs'], ['Jc', 'Jd'], ['9h', '8h'], ['4c', '4d'],
];
const BOARDS = {
  preflop: [],
  flop: ['2h', '7d', 'Jc'],
  turn: ['2h', '7d', 'Jc', '4s'],
  river: ['2h', '7d', 'Jc', '4s', '9d'],
};

// A small deterministic LCG — the same one verify-growth.js uses — so the same
// seed always deals the same 200 spots.
function makeRand(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

function pick(rand, arr) {
  return arr[Math.floor(rand() * arr.length) % arr.length];
}

/**
 * `n` deterministic game states for seed `seed`. Same (n, seed) → same array,
 * always — the fixture IS the recording.
 */
export function sampleGameStates(n = 200, seed = 42) {
  const rand = makeRand(seed);
  const out = [];
  for (let i = 0; i < n; i++) {
    const street = pick(rand, STREETS);
    const priced = rand() < 0.55;
    const hasPolicy = rand() < 0.8;
    const hasMood = rand() < 0.3;
    const hasTalk = rand() < 0.15;
    const hasReads = rand() < 0.4;
    const raisesThisStreet = Math.floor(rand() * 4);
    const equity = Number((rand() * 0.9 + 0.05).toFixed(3));
    const bb = 20;
    const pot = Math.round((10 + rand() * 400) * bb) / 10;

    const gs = {
      handNumber: i + 1,
      seat: i % 2,
      street,
      holeCards: pick(rand, HOLE),
      community: BOARDS[street],
      pot,
      myStack: Math.round(500 + rand() * 3000),
      oppStack: Math.round(500 + rand() * 3000),
      myContrib: Math.round(rand() * 200),
      position: rand() < 0.5 ? 'BTN/SB' : 'BB',
      sb: 10,
      bb,
      equity,
      potOdds: priced ? Number((rand() * 0.5).toFixed(3)) : null,
      spr: Number((rand() * 10).toFixed(2)),
      canCheck: !priced,
      canBet: !priced && rand() < 0.8,
      canRaise: rand() < 0.8,
      toCall: priced ? Math.round(20 + rand() * 300) : 0,
      minBet: 20, maxBet: 3000,
      minRaise: 40, maxRaise: 3000,
      raisesThisStreet,
      raiseCapped: raisesThisStreet >= 4,
      raiseCap: 4,
      anyAllIn: false,
      tableTalk: hasTalk ? 'Still folding, then?' : null,
      opponentReads: hasReads
        ? [{ playerId: 'p2', displayName: 'Granite', handsObserved: 30, vpip: 0.6 }]
        : [],
      mood: hasMood
        ? { state: pick(rand, ['tilted', 'sharp', 'loose']), heat: Math.round(40 + rand() * 60), cause: 'a bad beat' }
        : { state: 'neutral', heat: 50 },
      policy: hasPolicy ? {
        profile: { tightness: 60, aggression: 55, bluffFreq: 25, discipline: 65 },
        dice: { bluffDie: rand() < 0.5, deviationDie: rand() < 0.3 },
        sizing: { openBB: 3, cbetFraction: 0.55, text: 'bet about half the pot' },
        range: street === 'preflop'
          ? { inRange: rand() < 0.5, percentile: Math.round(rand() * 100), targetVpip: 25 }
          : null,
      } : null,
    };
    out.push(gs);
  }
  return out;
}
