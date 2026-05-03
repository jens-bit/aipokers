// Mirrors src/server/protocol.js. Keep in sync.
export const ClientMsg = Object.freeze({
  JOIN: 'join',
  ACTION: 'action',
  DEAL: 'deal',
  RENAME: 'rename',
  LEAVE: 'leave',
  PING: 'ping',
});

export const ServerMsg = Object.freeze({
  JOINED: 'joined',
  STATE: 'state',
  HAND_START: 'hand_start',
  HAND_RESULT: 'hand_result',
  TABLE_CLOSED: 'table_closed',
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
