// Mirrors src/server/protocol.js. Keep in sync.
export const ClientMsg = Object.freeze({
  JOIN: 'join',
  WATCH: 'watch',
  ACTION: 'action',
  DEAL: 'deal',
  RENAME: 'rename',
  CHAT: 'chat',
  LEAVE: 'leave',
  PING: 'ping',
  SIT_OUT: 'sit_out',
  // EVENT-2: the floor channel. FLOOR_SUB is what a ticker sends to start
  // receiving EVENT frames; it carries a userId because the same subscription
  // also drives this owner's FLOOR_STATE / FLOOR_GAME pushes.
  FLOOR_SUB: 'floor_sub',
  FLOOR_UNSUB: 'floor_unsub',
});

export const ServerMsg = Object.freeze({
  JOINED: 'joined',
  WATCHING: 'watching',
  STATE: 'state',
  HAND_START: 'hand_start',
  HAND_RESULT: 'hand_result',
  TABLE_CLOSED: 'table_closed',
  CHAT: 'chat',
  DECISION: 'decision',
  SEAT_LEFT: 'seat_left',
  ERROR: 'error',
  PONG: 'pong',
  // EVENT-1/EVENT-2: one line of the casino-wide ticker,
  // { event: { id, ts, type, tableId, agentIds, headline, pot } }. Pushed to
  // every FLOOR_SUB subscriber regardless of who owns the agents in it.
  EVENT: 'event',
  // ROOMS-1: the owner's floor, sent once on subscribe. It carries `rooms`
  // alongside `agents`, which is how a fresh subscriber has a lobby before the
  // first push arrives.
  FLOOR_STATE: 'floor_state',
  // ROOMS-1: the floor grouped by stakes tier, { type, rooms }. Not
  // owner-filtered — it is counts and table ids — and pushed on change.
  FLOOR_ROOMS: 'floor_rooms',
  // CASINO-2: what is RUNNING inside those rooms — one public felt per live
  // table, { type, tables, rooms }. FLOOR_ROOMS is the building; this is the
  // felts in it, which is the question you have the moment you walk through a
  // doorway. Each table carries { tableId, room, blinds, street, board, pot,
  // toAct, handNumber, hot, seated, maxSeats, seats: [{ seat, name, agentId,
  // stack, accentColor, mood, fatigue, drinking, inHand }] }, ranked hot-first
  // then by the money in the middle. `rooms` is { [tableId]: roomId } — the
  // table -> room map ROOMS-1 never sent. NOBODY'S HOLE CARDS ARE ON IT, not
  // even your own: that is FLOOR_GAME's job. Pushed on change, at most one per
  // second, and once on subscribe.
  ROOM_TABLES: 'room_tables',
  // HOME-STATE-1 / HOME-1: the owner's living room, owner-scoped, on the same
  // subscription. { userId, agents: [{ id, name, nature, mood, location,
  // routine, fatigue, unseenRecap, study }], game }. `location.where` is
  // home | casino | table; `routine` is null anywhere but home; `game` is the
  // home game — an ordinary tableId to WATCH, or null.
  HOME_STATE: 'home_state',
  // WANTS-1: the one thing an agent is asking his owner for, or null when he
  // has stopped asking. { userId, agentId, want }.
  WANT: 'want',
  // SERVER-3: one agent's stay at a table is over. Owner-scoped on the floor
  // channel. { sessionId, agentId, tableId, reason, hands, net, biggestPot,
  // duration, endedAt } — the money line HOME-1 walks him back in with.
  SESSION_END: 'session_end',
  // BUG-33 / PACE-1: the pacing ladder, server-authoritative.
  // { tableId, pace, potBb, board?, card? }. `pace` and `potBb` also ride every
  // STATE snapshot; what arrives ONLY here is the staged runout during a
  // spectator-only all-in hold, where the server turns the board a card at a
  // time so every watcher sees the same card at the same moment.
  //
  // This key was missing for as long as this file has existed, which made
  // `ServerMsg.PACE` undefined and useTable's `case ServerMsg.PACE:` a case on
  // undefined — a branch nothing could ever reach. The server has been staging
  // that runout since PACE-1 and no client had ever handled it.
  PACE: 'pace',
  // BUG-33 / PACE-1: the agent's read on his opponents, for the owner's
  // spectator only. { tableId, seat, reads: [...] } — the same array that rides
  // a STATE snapshot, pushed on its own the moment the picture CHANGES, which
  // is the event the read panel animates on. Missing for the same reason and
  // with the same effect.
  READ: 'read',
  // WATCH-9: one line was just written into this table's thread. The sheet used
  // to read the store when it was opened and never again, so a sheet left open
  // went quiet while the table carried on talking. The payload's `line` is the
  // same object the REST read serves, id included, so it merges with what was
  // fetched instead of racing it.
  //
  // TABLE-SCOPED — { tableId, sessionId, agentId, line }, delivered to the
  // sockets watching that seat. The server pushes the SAME written line a
  // second way, to the owner's floor channel, under the name OWNER_LINE
  // ('owner_line'); nothing here consumes that yet, and when something does it
  // gets its own constant. One name per payload shape: a client that had to
  // sniff which 'thread_line' it just received is a bug waiting to happen.
  THREAD_LINE: 'thread_line',
});

export const Streets = Object.freeze({
  WAITING: 'waiting',
  PREFLOP: 'preflop',
  FLOP: 'flop',
  TURN: 'turn',
  RIVER: 'river',
  SHOWDOWN: 'showdown',
  COMPLETE: 'complete',
});

export const Actions = Object.freeze({
  FOLD: 'fold',
  CHECK: 'check',
  CALL: 'call',
  BET: 'bet',
  RAISE: 'raise',
});
