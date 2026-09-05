// client/src/test/fixtures/agents.js — TEST-1
//
// Agent records exactly as the API returns them.
//   liveGame        — Table#liveGameView(agentId, { includeHole }) in
//                     src/server/table.js. null unless the session loop is
//                     genuinely advancing hands (AGE-37 presence law).
//   presentedAgent  — presentAgent(agent, { owner }) in
//                     src/server/agentProfiles.js. This is what
//                     GET /api/agents returns and what CasinoFloor consumes.
//   floorSnapshot   — floorSnapshot(userId, { owner }), the compact projection
//                     the floor channel pushes over the WebSocket.
//
// heroHole is only populated for a caller that proved ownership; both shapes
// carry it inside liveGame, so an unowned fixture sets it to null.

export const liveGame = {
  tableId: 'tbl-fixture',
  heroSeat: 0,
  street: 'flop',
  board: ['5c', '4h', '8c'],
  heroHole: ['6h', '6s'],
  heroStack: 940,
  pot: 100,
  toAct: 1,
  actionDeadline: null,
  handNumber: 1,
  dealtIn: true,
  seatCount: 3,
  maxSeats: 6,
  handsThisSession: 1,
  maxHands: 100,
  blinds: '10/20',
  seats: [
    { displayName: 'The Grinder', stack: 940, accentColor: '#00D4AA' },
    { displayName: 'Doyle_v3', stack: 980, accentColor: '#9B7BFF' },
    { displayName: 'Granite', stack: 980, accentColor: '#CDB380' },
  ],
};

// A seated agent whose table is actually advancing hands: presence 'playing'
// with a liveGame attached. BUG-16 was the floor showing this state for an
// agent whose table was frozen — presence and liveGame now move together.
export const playingAgent = {
  id: 'agent_grinder',
  name: 'The Grinder',
  style: 'Tight',
  risk: 'Low',
  strategy: 'Patient. Folds junk, punishes limps.',
  status: 'playing',
  activeTableId: 'tbl-fixture',
  profile: { tightness: 78, aggression: 45, bluffFreq: 12, discipline: 82 },
  stats: {
    handsPlayed: 174,
    handsWon: 87,
    totalDecisions: 170,
    aggressiveDecisions: 66,
    passiveDecisions: 20,
    foldDecisions: 84,
    winRate: 50,
    biggestPot: 3460,
    netWon: 1240,
  },
  recentHands: [],
  memory: '',
  bankroll: 11240,
  ledger: [{ ts: 1788600000000, type: 'grant', amount: 10000, tableId: null }],
  mood: { state: 'confident', cause: 'stacked the loose one', updatedAt: 1788608983516 },
  lastMoment: { text: 'Flopped a set and got paid.', mood: 'confident', at: 1788608983516 },
  sessionRecap: null,
  unseenRecap: false,
  proposal: null,
  presence: 'playing',
  liveGame,
  flaggedCount: 2,
  sessionLog: [],
  careerStats: {
    hands: 174,
    sessions: 0,
    net: 1240,
    biggestPot: 3460,
    winRate: 50,
    bankroll: 11240,
  },
};

// Idle at the bar: no table, no liveGame, presence 'resting'.
export const restingAgent = {
  id: 'agent_cannon',
  name: 'Loose Cannon',
  style: 'Aggressive',
  risk: 'High',
  strategy: 'Bets big, bluffs often.',
  status: 'idle',
  activeTableId: null,
  profile: { tightness: 30, aggression: 90, bluffFreq: 60, discipline: 30 },
  stats: {
    handsPlayed: 42,
    handsWon: 18,
    totalDecisions: 40,
    aggressiveDecisions: 26,
    passiveDecisions: 6,
    foldDecisions: 8,
    winRate: 42.9,
    biggestPot: 880,
    netWon: -320,
  },
  recentHands: [],
  memory: '',
  bankroll: 9680,
  ledger: [{ ts: 1788600000000, type: 'grant', amount: 10000, tableId: null }],
  mood: { state: 'frustrated', cause: 'ran into the nuts twice', updatedAt: 1788608000000 },
  lastMoment: { text: 'Rough run — lost the last few.', mood: 'frustrated', at: 1788608000000 },
  sessionRecap: { text: 'Down 320 over 42 hands.', at: 1788608000000 },
  unseenRecap: true,
  proposal: null,
  presence: 'resting',
  liveGame: null,
  flaggedCount: 0,
  sessionLog: [],
  careerStats: {
    hands: 42,
    sessions: 1,
    net: -320,
    biggestPot: 880,
    winRate: 42.9,
    bankroll: 9680,
  },
};

// GET /api/agents body.
export const agentsResponse = { agents: [playingAgent, restingAgent] };

// The WS floor projection of the same two agents — presentAgent minus the
// heavy fields the floor never renders.
export const floorSnapshot = [playingAgent, restingAgent].map((a) => ({
  id: a.id,
  name: a.name,
  style: a.style,
  risk: a.risk,
  presence: a.presence,
  mood: a.mood,
  lastMoment: a.lastMoment,
  sessionRecap: a.sessionRecap,
  unseenRecap: a.unseenRecap,
  proposal: a.proposal ? { text: a.proposal.text, basedOn: a.proposal.basedOn } : null,
  activeTableId: a.activeTableId,
  liveGame: a.liveGame,
}));
