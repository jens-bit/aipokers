// client/src/test/fixtures/rooms.js — CASINO-1
//
// The floor exactly as ROOMS-1 sends it: roomsSnapshot() in src/server/rooms.js,
// which is what both GET /api/rooms and the FLOOR_ROOMS frame carry.
//
//   id / name / rung    the house's own names, derived from STAKES
//   stakes              { smallBlind, bigBlind, buyIn, label }
//   tables / seated     live tables in the room, and seats filled across them
//   hot                 tableIds that fired a `hot` event inside HOT_RECENT_MS
//   biggestPot          { tableId, pot } — the pot in the air, or null
//
// The buy-ins are the real ladder (STAKES in src/server/wallet.js): 2,000 at
// $10/$20, 5,000 at $25/$50, 10,000 at $50/$100. A room always exists, so the
// quiet back room reports zeroes rather than disappearing.

export const floorRoom = {
  id: 'floor',
  name: 'the floor',
  rung: 0,
  stakes: { smallBlind: 10, bigBlind: 20, buyIn: 2_000, label: '$10/$20' },
  tables: 4,
  seated: 17,
  hot: [],
  biggestPot: { tableId: 'tbl-fixture', pot: 640 },
};

export const upstairsRoom = {
  id: 'upstairs',
  name: 'upstairs',
  rung: 1,
  stakes: { smallBlind: 25, bigBlind: 50, buyIn: 5_000, label: '$25/$50' },
  tables: 2,
  seated: 9,
  hot: [],
  biggestPot: null,
};

export const backRoom = {
  id: 'backroom',
  name: 'the back room',
  rung: 2,
  stakes: { smallBlind: 50, bigBlind: 100, buyIn: 10_000, label: '$50/$100' },
  tables: 0,
  seated: 0,
  hot: [],
  biggestPot: null,
};

export const rooms = [floorRoom, upstairsRoom, backRoom];

/** GET /api/rooms body. */
export const roomsResponse = { rooms, hotWindowMs: 20_000 };

/** The same floor with a big pot live upstairs, at table `tbl-hot`. */
export const hotRooms = [
  floorRoom,
  { ...upstairsRoom, hot: ['tbl-hot'], biggestPot: { tableId: 'tbl-hot', pot: 4_180 } },
  backRoom,
];

// ── the ticker ──────────────────────────────────────────────────────────────
// EVENT-1's record: { id, ts, type, tableId, agentIds, headline, pot }. Nothing
// here carries a stakes label — the board derives one only when the table is
// named by a room's `hot` or `biggestPot`.

export function casinoEvent(over = {}) {
  return {
    id: 1,
    ts: Date.now(),
    type: 'bigPot',
    tableId: 'tbl-fixture',
    agentIds: [],
    headline: 'Ozymandias cracked aces',
    pot: 14_200,
    ...over,
  };
}

export const eventsResponse = {
  events: [
    casinoEvent({ id: 1, type: 'bigPot', headline: 'Ozymandias cracked aces', tableId: 'tbl-fixture' }),
    casinoEvent({ id: 2, type: 'cooler', headline: 'quads into a straight flush, table 8', tableId: 'tbl-8' }),
    casinoEvent({ id: 3, type: 'bust', headline: 'Fold_Equity out — third time today', tableId: null }),
  ],
  lastId: 3,
};

// ── the felts ───────────────────────────────────────────────────────────────
// CASINO-2's ROOM_TABLES record, exactly as roomTables.js sends it: one public
// snapshot per live table. Seats, stacks, faces, the community cards and the
// money in the middle — and nobody's hole cards, ever, which is the one thing
// about this payload worth remembering when writing a fixture for it.

export function feltSeat(over = {}) {
  return {
    seat: 0,
    name: 'House regular',
    agentId: null,
    stack: 1_820,
    accentColor: null,
    mood: { state: 'neutral', heat: 30 },
    fatigue: 'fresh',
    drinking: false,
    inHand: true,
    ...over,
  };
}

export function felt(over = {}) {
  return {
    tableId: 'tbl-fixture',
    room: 'floor',
    blinds: '10/20',
    smallBlind: 10,
    bigBlind: 20,
    street: 'flop',
    board: ['Ah', 'Kd', '7c'],
    pot: 640,
    toAct: 1,
    handNumber: 12,
    hot: false,
    seated: 3,
    maxSeats: 6,
    seats: [
      feltSeat({ seat: 0, name: 'Ozymandias' }),
      feltSeat({ seat: 1, name: 'Granite', stack: 980 }),
      feltSeat({ seat: 3, name: 'Nightjar', stack: 2_400 }),
    ],
    ...over,
  };
}

/** A felt with one of YOUR agents at it — the fixtures' `playingAgent`. */
export function myFelt(over = {}) {
  return felt({
    tableId: 'tbl-mine',
    seats: [
      feltSeat({ seat: 0, name: 'Ozymandias' }),
      feltSeat({ seat: 2, name: 'The Grinder', agentId: 'agent_grinder', accentColor: '#00D4AA' }),
    ],
    ...over,
  });
}

export const felts = [felt(), myFelt({ pot: 940 })];
