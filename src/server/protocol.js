// Wire protocol shared between the WebSocket server and any client.
// Messages are JSON in both directions.

export const ClientMsg = Object.freeze({
  JOIN: 'join',         // { type, tableId, playerId, buyIn, displayName?, smallBlind?, bigBlind? }
  WATCH: 'watch',       // { type, tableId, agentStrategy, displayName?, wantOpponentAI?, smallBlind?, bigBlind? }
  ACTION: 'action',     // { type, action: { type, amount? } }
  DEAL: 'deal',         // { type } — start the next hand once both players are seated and chipped
  RENAME: 'rename',     // { type, displayName } — change your seat's display name
  CHAT: 'chat',         // { type, tableId, text } — table chat message from the seated client
  SIT_OUT: 'sit_out',   // { type } — deliberate STOP (owner or spectator). Finish the
                        // current hand, then broadcast TABLE_CLOSED and run the agent
                        // finish path (idle + unseenRecap). If no hand is in progress
                        // the table closes immediately. See BUG-14.
  LEAVE: 'leave',       // { type }
  // AGE-38 floor channel — additive, unrelated to any table this connection
  // may also be seated at or watching.
  FLOOR_SUB: 'floor_sub',     // { type, userId, initData?, apiSecret? } — subscribe to
                              // this owner's floor: an immediate FLOOR_STATE plus
                              // FLOOR_GAME pushes for every table they have live.
                              // initData / apiSecret are the same credentials the
                              // REST layer takes; without them heroHole is withheld.
  FLOOR_UNSUB: 'floor_unsub', // { type } — stop pushes (disconnect does this too)
  PING: 'ping',
});

export const ServerMsg = Object.freeze({
  JOINED: 'joined',         // { type, tableId, seat }
  WATCHING: 'watching',     // { type, tableId, spectatorSeat }
  STATE: 'state',           // { type, state }   (filtered for this seat)
  HAND_START: 'hand_start', // { type, handNumber }
  HAND_RESULT: 'hand_result', // { type, result }
  TABLE_CLOSED: 'table_closed', // { type, reason }
  CHAT: 'chat',             // { type, seat, displayName, text, isAI }
  DECISION: 'decision',     // { type, seat, action: { type, amount? }, reasoning }
  // AGE-38 floor channel (server → subscriber).
  FLOOR_STATE: 'floor_state', // { type, userId, agents: [{ id, name, presence, mood,
                              //   lastMoment, sessionRecap, unseenRecap, proposal,
                              //   activeTableId, liveGame }] }
  FLOOR_GAME: 'floor_game',   // { type, tableId, agentId, street, board, heroHole,
                              //   pot, toAct, actionDeadline, handNumber }
                              // heroHole is null unless the subscriber proved
                              // ownership in FLOOR_SUB. At most one per second
                              // per table.
  ERROR: 'error',           // { type, message }
  PONG: 'pong',
});
