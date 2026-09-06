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
  // SERVER-3 (additive): two things ride every STATE.
  //
  //   actionTimer — the acting seat's deadline, so the client can draw the
  //     hero's ring instead of guessing at one.
  //     { seat, deadlineTs, totalMs } — deadlineTs is server epoch ms and
  //     totalMs is the full length of that seat's clock, which is what a ring
  //     needs to know how far round to start. null when nobody is to act, and
  //     null for a HUMAN seat: there is no server-side action timer for
  //     humans yet (Fredrik's seat-lifecycle queue), and inventing a deadline
  //     the server will not enforce is worse than drawing no ring.
  //   sessionId — the id of the stay the seat this snapshot is filtered for
  //     is on, or null for a seat with no agent behind it. It is the key
  //     GET /api/agents/:id/thread and SESSION_END are filed under.
  STATE: 'state',           // { type, state }   (filtered for this seat)
  HAND_START: 'hand_start', // { type, handNumber }
  // SERVER-3 (additive): `result` now carries two more fields.
  //
  //   deltas — { [seat]: net } for every seat in the hand. NET: what the seat
  //     took out of the pot minus everything it put in, so the winner of a
  //     300 pot he built 150 of is +150. Folded seats are negative, seats that
  //     never invested are 0, and the whole map sums to zero. The client used
  //     to difference two stack snapshots to get this and got it wrong
  //     whenever it missed a broadcast.
  //   events — { [seat]: event } for the seats a hand-end face trigger applies
  //     to: badBeat | wonBig | bluffCaught. Same vocabulary as DECISION's
  //     `event` below; these three are the ones that are only knowable once
  //     the hand is over, so they ride the result rather than a decision. A
  //     seat with no trigger is absent.
  HAND_RESULT: 'hand_result', // { type, result }
  TABLE_CLOSED: 'table_closed', // { type, reason }
  CHAT: 'chat',             // { type, seat, displayName, text, isAI }
  // SERVER-3 (additive): DECISION carries `event` — the per-seat face trigger,
  // for the moment the client draws on the acting seat's ghost. One of
  //   dealtStrong   he looked down at a premium holding (first decision only)
  //   raisedAgainst somebody put in a raise he now has to answer
  //   allIn         the action he just took committed his stack
  // or null when none applies. The other three in the vocabulary —
  // badBeat | wonBig | bluffCaught — are only knowable at the end of the hand
  // and ride HAND_RESULT's `result.events` instead; see there. The field is
  // on the sanitized payload as well as the full one: a face is as public as
  // the action that caused it, which is the same line SEAT-1a's mood draws.
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
                              //   activeTableId, liveGame }], rooms: [...] }
                              // ROOMS-1 (additive): `rooms` is the same array
                              // GET /api/rooms serves — see FLOOR_ROOMS below.
                              // It rides the snapshot so a client that has
                              // just subscribed has the floor without a
                              // second request.
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
  // ROOMS-1 (additive): the floor grouped by stakes tier, pushed to every
  // subscriber whenever it changes (at most one per second, trailing-edge, so
  // the last state of a busy floor always lands). Not filtered by owner, for
  // the same reason the ticker is not: it is counts and table ids, nothing
  // owner-scoped. Each entry is
  //   { id, name, rung, stakes: { smallBlind, bigBlind, buyIn, label },
  //     tables, seated, hot: [tableId], biggestPot: { tableId, pot } | null }
  // in ladder order, lowest stakes first — floor / upstairs / back room. A
  // room with nothing in it reports zeroes rather than disappearing. `hot` is
  // the tables that fired a `hot` EVENT in the last 20s; `biggestPot` is the
  // largest pot in the air in that room right now, or null when no hand is
  // live. The same array is served by GET /api/rooms and rides FLOOR_STATE. A
  // client that ignores this message sees exactly what it saw before it
  // existed.
  FLOOR_ROOMS: 'floor_rooms', // { type, rooms }
  // SERVER-3 (additive): one agent's stay at a table is over. Sent to every
  // socket at the table (his owner's spectator is the one that runs the
  // ceremony with it) and, separately, to that owner's floor subscribers — the
  // two are different sockets in the client, so neither sees it twice; a
  // client that opened one socket for both can key on `sessionId`, which is
  // stable and unique per stay.
  //
  // THE CEREMONY IS A SESSION MOMENT, NOT A HAND MOMENT. It used to be
  // inferred from TABLE_CLOSED plus a poll of the agent record, which fired it
  // on tables closing for reasons that were not his session ending and left it
  // without the numbers it wanted to print. This is the message that fires it.
  //
  // `reason` is one of
  //   bust       his stack reached zero at the felt
  //   allowance  the budget behind him is spent — he cannot buy in again
  //   worn       STAMINA fatigue reached 'worn'; he sat himself at the bar
  //   calledIn   the owner stopped him (SIT_OUT, POST /finish, a wallet cut)
  //   stopped    everything else: the hand cap, the idle reaper, the room
  //              closing under him
  // `hands` counts the hands HE was dealt into, not the table's total; `net`
  // is signed chips (final stack minus his buy-in); `biggestPot` is the
  // largest pot he had money in this session; `duration` is milliseconds from
  // sitting down to standing up. A client that ignores this message sees
  // exactly what it saw before it existed.
  SESSION_END: 'session_end', // { type, sessionId, agentId, tableId, reason,
                              //   hands, net, biggestPot, duration, endedAt }
  ERROR: 'error',           // { type, message }
  PONG: 'pong',
});
