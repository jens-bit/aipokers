// client/src/lib/protocol.test.jsx — TEST-1
//
// protocol.js mirrors src/server/protocol.js and the engine's Streets/Actions.
// The WS protocol is public (llms.txt) and the server switches on these exact
// strings, so a typo or a rename here is a silent break: the client would send
// a message no handler matches. These tests pin the wire values.

import { describe, expect, it } from 'vitest';
import { Actions, ClientMsg, ServerMsg, Streets } from './protocol.js';

describe('protocol', () => {
  it('pins the client message types the server switches on', () => {
    expect(ClientMsg).toEqual({
      JOIN: 'join',
      WATCH: 'watch',
      ACTION: 'action',
      DEAL: 'deal',
      RENAME: 'rename',
      CHAT: 'chat',
      LEAVE: 'leave',
      PING: 'ping',
      SIT_OUT: 'sit_out',
      FLOOR_SUB: 'floor_sub',
      FLOOR_UNSUB: 'floor_unsub',
    });
  });

  it('pins the server message types the client switches on', () => {
    expect(ServerMsg).toEqual({
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
      EVENT: 'event',
      // CASINO-1 mirrored the two frames ROOMS-1 already sends: the floor
      // snapshot that rides a subscribe, and the rooms push after it.
      FLOOR_STATE: 'floor_state',
      FLOOR_ROOMS: 'floor_rooms',
      // HOME-1 / HOME-STATE-1: the room's own three, on the same channel.
      HOME_STATE: 'home_state',
      WANT: 'want',
      SESSION_END: 'session_end',
    });
  });

  it('pins the streets the engine reports', () => {
    expect(Streets).toEqual({
      WAITING: 'waiting',
      PREFLOP: 'preflop',
      FLOP: 'flop',
      TURN: 'turn',
      RIVER: 'river',
      SHOWDOWN: 'showdown',
      COMPLETE: 'complete',
    });
  });

  it('pins the action types', () => {
    expect(Actions).toEqual({
      FOLD: 'fold',
      CHECK: 'check',
      CALL: 'call',
      BET: 'bet',
      RAISE: 'raise',
    });
  });

  it('freezes every table so a caller cannot mutate the protocol at runtime', () => {
    for (const table of [ClientMsg, ServerMsg, Streets, Actions]) {
      expect(Object.isFrozen(table)).toBe(true);
    }
  });
});
