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
