// Wire protocol shared between the WebSocket server and any client.
// Messages are JSON in both directions.

export const ClientMsg = Object.freeze({
  JOIN: 'join',         // { type, tableId, playerId, buyIn, displayName?, smallBlind?, bigBlind? }
  WATCH: 'watch',       // { type, tableId, agentStrategy, displayName?, wantOpponentAI?, smallBlind?, bigBlind? }
  ACTION: 'action',     // { type, action: { type, amount? } }
  DEAL: 'deal',         // { type } — start the next hand once both players are seated and chipped
  RENAME: 'rename',     // { type, displayName } — change your seat's display name
  LEAVE: 'leave',       // { type }
  PING: 'ping',
});

export const ServerMsg = Object.freeze({
  JOINED: 'joined',         // { type, tableId, seat }
  WATCHING: 'watching',     // { type, tableId, spectatorSeat }
  STATE: 'state',           // { type, state }   (filtered for this seat)
  HAND_START: 'hand_start', // { type, handNumber }
  HAND_RESULT: 'hand_result', // { type, result }
  TABLE_CLOSED: 'table_closed', // { type, reason }
  ERROR: 'error',           // { type, message }
  PONG: 'pong',
});
