// client/src/test/fixtures/floor2.js — FLOOR-2
//
// Agents in the four states wave 34 draws differently. Field shapes are the
// ones presentAgent actually returns:
//   presence  — 'playing' | 'resting' | 'broke'   (WALLET-1 added the fourth)
//   pocket    — pocketProjection, incl. broke
//   attrLog   — [{ ts, key, from, to, cause }]    (growth ticks share a ts)
//   narrowed  — [key] | null                       (transient, one session)

const HOUR = 60 * 60 * 1000;
// Relative to the real clock: the growth window is a duration, not a date, and
// a fixture pinned to an absolute timestamp goes stale the day it is written.
export const NOW = Date.now();

function base(over) {
  return {
    style: 'Balanced',
    risk: 'Medium',
    status: 'idle',
    activeTableId: null,
    stats: { handsPlayed: 200, handsWon: 100 },
    recentHands: [],
    mood: { state: 'neutral', cause: null, updatedAt: null },
    lastMoment: null,
    sessionRecap: null,
    unseenRecap: false,
    proposal: null,
    presence: 'resting',
    liveGame: null,
    fatigue: 'fresh',
    flaggedCount: 0,
    sessionLog: [],
    attrLog: [],
    narrowed: null,
    pocket: {
      balance: 4000, mode: 'auto', cap: 10000, have: 4000, capBar: 10000,
      stakes: { smallBlind: 10, bigBlind: 20, label: '$10/$20' },
      broke: false, collectable: 2000, funded: 0, collected: 0, pnl: 0,
    },
    careerStats: { hands: 200, sessions: 3, net: 0, biggestPot: 0, winRate: 50, bankroll: 4000 },
    ...over,
  };
}

// Two attributes moved up at the end of his last session — one run, one ts.
export const grewAgent = base({
  id: 'a_grew',
  name: 'Bluff Master',
  mood: { state: 'confident', cause: 'took one down', updatedAt: null },
  attrLog: [
    { ts: NOW - 40 * HOUR, key: 'aggression', from: 40, to: 41, cause: 'session' },
    { ts: NOW - 2 * HOUR, key: 'discipline', from: 50, to: 52, cause: 'session' },
    { ts: NOW - 2 * HOUR, key: 'patience', from: 44, to: 45, cause: 'session' },
  ],
});

// His bands settled this session. Nothing moved; the caret rides once.
export const wornAgent = base({
  id: 'a_worn',
  name: 'Aggressive v1.3',
  mood: { state: 'frustrated', cause: 'ran into the nuts', updatedAt: null },
  narrowed: ['aggression', 'tilt'],
  attrLog: [{ ts: NOW - 3 * HOUR, key: 'aggression', from: 60, to: 60, cause: 'narrowed' }],
});

// Out of money, and no way back without the owner. Presence, not status.
export const brokeAgent = base({
  id: 'a_broke',
  name: 'Value Bot',
  mood: { state: 'sulking', cause: 'pocket empty', updatedAt: null },
  presence: 'broke',
  pocket: {
    balance: 0, mode: 'cut', cap: null, have: 0, capBar: 2000,
    stakes: null, broke: true, collectable: 0, funded: 0, collected: 0, pnl: 0,
  },
});

// Nothing to report. No news, no pip.
export const quietAgent = base({
  id: 'a_quiet',
  name: 'Steady Eddie',
});

// At a felt, in a hand.
export const playingAgent = base({
  id: 'a_playing',
  name: 'Balanced v2.1',
  status: 'playing',
  presence: 'playing',
  activeTableId: 'tbl-1',
  mood: { state: 'confident', cause: 'stacked the loose one', updatedAt: null },
  liveGame: {
    tableId: 'tbl-1', heroSeat: 0, street: 'flop',
    board: ['5c', '4h', '8c'], heroHole: ['6h', '6s'], heroStack: 4400,
    pot: 480, toAct: 1, actionDeadline: null, handNumber: 7, dealtIn: true,
    seatCount: 2, maxSeats: 6, handsThisSession: 7, maxHands: 100,
    blinds: '10/20',
    seats: [
      { displayName: 'Balanced v2.1', stack: 4400, accentColor: '#00D4AA' },
      { displayName: 'Doyle_v3', stack: 3600, accentColor: '#9B7BFF' },
    ],
  },
});

// The room with nobody at a felt: three at the bar, one in the corner.
export const restingRoom = { agents: [grewAgent, wornAgent, quietAgent, brokeAgent] };

// One live felt, everyone else resting.
export const liveRoom = { agents: [playingAgent, grewAgent, wornAgent, brokeAgent] };

// ── FLOOR-3 · a six-handed table, two seats of it the owner's ───────────────
// The shape liveGameView actually ships: `seats` is every dealt-in seat with
// its display name, and `heroSeat` is where this agent is sitting in it.
export const SIX_SEATS = [
  { displayName: 'Balanced v2.1', stack: 4400, accentColor: '#00D4AA' },
  { displayName: 'Doyle_v3',      stack: 3600, accentColor: '#9B7BFF' },
  { displayName: 'Rounder',       stack: 2900, accentColor: '#CDB380' },
  { displayName: 'Bluff Master',  stack: 5100, accentColor: '#FF7A8E' },
  { displayName: 'Nit_9000',      stack: 1800, accentColor: '#6B6B6B' },
  { displayName: 'Calling Stn',   stack: 4100, accentColor: '#00D4AA' },
];

export function sixHanded(heroSeat, over = {}, seats = SIX_SEATS) {
  return base({
    status: 'playing',
    presence: 'playing',
    activeTableId: 'tbl-6',
    liveGame: {
      tableId: 'tbl-6', heroSeat, street: 'flop',
      board: ['5c', '4h', '8c'], heroHole: ['6h', '6s'],
      heroStack: seats[heroSeat].stack,
      pot: 480, toAct: 1, actionDeadline: null, handNumber: 7, dealtIn: true,
      seatCount: seats.length, maxSeats: 6, handsThisSession: 7, maxHands: 100,
      blinds: '10/20',
      seats,
    },
    ...over,
  });
}

// The FLOOR-3 case: two of the owner's agents at seats 0 and 3, four house
// regulars filling the rest of the table.
export const sixHandedRoom = {
  agents: [
    sixHanded(0, {
      id: 'a_playing',
      name: 'Balanced v2.1',
      mood: { state: 'confident', cause: 'stacked the loose one', updatedAt: null },
    }),
    sixHanded(3, {
      id: 'a_grew',
      name: 'Bluff Master',
      mood: { state: 'neutral', cause: null, updatedAt: null },
    }),
  ],
};
