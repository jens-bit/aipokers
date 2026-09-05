// client/src/test/fixtures/game.js — TEST-1
//
// Table state exactly as the client receives it: `msg.state` on a
// ServerMsg.STATE frame, which is Game#getPublicState(seat) from
// src/engine/game.js with Table#_augmentState's displayName added to each
// seat. Both objects below were dumped from the real engine (3-handed, blinds
// 10/20, dealer seat 0) rather than written by hand, so a shape change in the
// engine shows up here as a failing client test.

// Hero is seat 0 — the owner watching their own agent. Public state hides the
// other two seats' hole cards; the hero's are present, which is the fish-tank
// law the WatchScreen renders.
export const midHandGame = {
  tableId: 'tbl-fixture',
  handNumber: 1,
  street: 'flop',
  smallBlind: 10,
  bigBlind: 20,
  dealerSeat: 0,
  pot: 100,
  community: ['5c', '4h', '8c'],
  currentBet: 40,
  lastRaiseSize: 40,
  toAct: 1,
  seats: [
    {
      playerId: 'p_hero',
      stack: 940,
      holeCards: ['6h', '6s'],
      contribTotal: 60,
      contribThisStreet: 40,
      folded: false,
      allIn: false,
      actedThisStreet: true,
      displayName: 'The Grinder',
    },
    {
      playerId: 'p_villain',
      stack: 980,
      holeCards: [],
      contribTotal: 20,
      contribThisStreet: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      displayName: 'Doyle_v3',
    },
    {
      playerId: 'p_house',
      stack: 980,
      holeCards: [],
      contribTotal: 20,
      contribThisStreet: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      displayName: 'Granite',
    },
  ],
  result: null,
};

// Between hands: the table exists, nobody has been dealt in. street=waiting,
// no board, no pot. The calm state — not a loading placeholder.
export const betweenHandsGame = {
  tableId: 'tbl-fixture',
  handNumber: 0,
  street: 'waiting',
  smallBlind: 10,
  bigBlind: 20,
  dealerSeat: 0,
  pot: 0,
  community: [],
  currentBet: 0,
  lastRaiseSize: 20,
  toAct: null,
  seats: [
    {
      playerId: 'p_hero',
      stack: 1000,
      holeCards: [],
      contribTotal: 0,
      contribThisStreet: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      displayName: 'The Grinder',
    },
    {
      playerId: 'p_villain',
      stack: 1000,
      holeCards: [],
      contribTotal: 0,
      contribThisStreet: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      displayName: 'Doyle_v3',
    },
    {
      playerId: 'p_house',
      stack: 1000,
      holeCards: [],
      contribTotal: 0,
      contribThisStreet: 0,
      folded: false,
      allIn: false,
      actedThisStreet: false,
      displayName: 'Granite',
    },
  ],
  result: null,
};

// What useTable passes down as `config` when the owner is spectating.
export const spectatorConfig = {
  tableId: 'tbl-fixture',
  agentId: 'agent_grinder',
  displayName: 'The Grinder',
  isSpectator: true,
  wantAI: false,
  buyIn: 1000,
};
