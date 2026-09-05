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
  // SEAT-1a (additive): every seat in `state.seats` carries `mood`
  // { state, heat } — state is one of confident | neutral | frustrated |
  // tilted | sulking, heat is 0-100 within it. It is the same value the
  // owner's own mood header reads, so the felt and the header never disagree.
  // A seat with no agent behind it (a House regular, a human) reports a
  // resting { state: 'neutral', heat: 30 }. Mood is public: it is the one
  // thing about an opponent a person at a real table can see. A client that
  // ignores the field sees exactly what it saw before it existed.
  STATE: 'state',           // { type, state }   (filtered for this seat)
  HAND_START: 'hand_start', // { type, handNumber }
  HAND_RESULT: 'hand_result', // { type, result }
  TABLE_CLOSED: 'table_closed', // { type, reason }
  CHAT: 'chat',             // { type, seat, displayName, text, isAI }
  DECISION: 'decision',     // { type, seat, action: { type, amount? }, reasoning }
  // MST-1 (additive): one seat left a table that is still running. Sent to
  // everyone still at the table; the departing seat's own sockets get
  // TABLE_CLOSED instead, so a client that predates this message behaves
  // exactly as before.
  SEAT_LEFT: 'seat_left',   // { type, seat, displayName, reason }
  // PACE-1 (additive): the pacing ladder, server-authoritative. Sent to every
  // socket at the table whenever the state advances within a hand, and once at
  // each deal to reset it to 'calm'. `pace` is one of calm | heating | allin |
  // showdown; `potBb` is the pot in big blinds at the moment it changed.
  // During a spectator-only all-in hold the runout arrives here card by card,
  // as `board` (the cards visible so far) and `card` (the one just turned) —
  // the STATE snapshot already holds the finished board, so a client that
  // ignores PACE sees exactly what it saw before this message existed.
  PACE: 'pace',             // { type, tableId, pace, potBb, board?, card? }
  // PACE-1 (additive): the agent's read on one opponent, for the owner's
  // spectator only. Never sent to a seated player or to a spectator watching
  // someone else's agent.
  READ: 'read',             // { type, tableId, seat, reads: [{ playerId,
                            //   displayName, handsObserved, formed, line,
                            //   rows: [{ k, label, value, confidence, formed }] }] }
  // AGE-38 floor channel (server → subscriber).
  FLOOR_STATE: 'floor_state', // { type, userId, agents: [{ id, name, presence, mood,
                              //   lastMoment, sessionRecap, unseenRecap, proposal,
                              //   activeTableId, liveGame }] }
  FLOOR_GAME: 'floor_game',   // { type, tableId, agentId, street, board, heroHole,
                              //   pot, toAct, actionDeadline, handNumber }
                              // heroHole is null unless the subscriber proved
                              // ownership in FLOOR_SUB. At most one per second
                              // per table.
  // EVENT-1 (additive): one line of the casino-wide floor ticker, pushed to
  // every floor subscriber regardless of who owns the agents in it — the point
  // of a ticker is that it tells you about a table you are NOT watching.
  // `event` is { id, ts, type, tableId, agentIds, headline, pot }; `type` is
  // one of bigPot | cooler | heater | bust | nemesisSeated | hot. Headlines
  // only: no hole cards, no reasoning, nothing AGE-33/37 would withhold. The
  // same events are readable over GET /api/events?since=<id>, and `id` is
  // monotonic so a client can reconcile the two. A client that ignores this
  // message sees exactly what it saw before it existed.
  EVENT: 'event',           // { type, event }
  ERROR: 'error',           // { type, message }
  PONG: 'pong',
});
