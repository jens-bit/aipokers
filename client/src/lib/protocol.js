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
});

export const ServerMsg = Object.freeze({
  JOINED: 'joined',
  WATCHING: 'watching',
  STATE: 'state',
  HAND_START: 'hand_start',
  HAND_RESULT: 'hand_result',
  TABLE_CLOSED: 'table_closed',
  CHAT: 'chat',
  ERROR: 'error',
  PONG: 'pong',
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
