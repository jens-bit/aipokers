// client/src/hooks/useCasinoRooms.test.jsx — CASINO-1
//
// The lobby's two sources have to agree: GET /api/rooms is the pre-socket
// answer, FLOOR_STATE is the answer that rides the subscribe, and FLOOR_ROOMS
// is every answer after that. What is asserted here is the contract the
// doorways depend on — a room always exists, the newest payload wins outright,
// and an unreadable frame never empties a floor that is actually full.

import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import {
  useCasinoRooms, normalizeRooms, blindsOf, roomForBlinds, roomForTable,
  agentsByRoom, totalSeated,
} from './useCasinoRooms.js';
import { rooms, roomsResponse, floorRoom, upstairsRoom, backRoom } from '../test/fixtures/rooms.js';
import { playingAgent, restingAgent } from '../test/fixtures/agents.js';
import { fetchMock, socketMock, telegram } from '../test/harness.js';

const WS = 'ws://localhost:8765';

function open() {
  const ws = socketMock.last();
  act(() => ws.open());
  return ws;
}

describe('useCasinoRooms pure helpers', () => {
  it('blindsOf speaks liveGameView\'s format, which is the join key', () => {
    expect(blindsOf(floorRoom)).toBe('10/20');
    expect(blindsOf(upstairsRoom)).toBe('25/50');
    expect(blindsOf(null)).toBeNull();
  });

  it('normalizeRooms survives a payload that is not a floor', () => {
    expect(normalizeRooms(null)).toEqual([]);
    expect(normalizeRooms('nope')).toEqual([]);
    expect(normalizeRooms([null, { name: 'no id' }])).toEqual([]);
  });

  it('normalizeRooms fills in every field the doorway reads', () => {
    const [room] = normalizeRooms([{ id: 'floor' }]);
    expect(room).toMatchObject({
      id: 'floor', name: 'floor', rung: 0, tables: 0, seated: 0, hot: [], biggestPot: null,
    });
    expect(room.stakes).toEqual({ smallBlind: 0, bigBlind: 0, buyIn: 0, label: '' });
  });

  it('roomForBlinds finds the rung an agent is actually sitting at', () => {
    expect(roomForBlinds(rooms, '25/50')?.id).toBe('upstairs');
    expect(roomForBlinds(rooms, '10/20')?.id).toBe('floor');
    // A bespoke heads-up table at blinds no rung runs is in no room — the same
    // answer rooms.js gives on the server.
    expect(roomForBlinds(rooms, '1/2')).toBeNull();
    expect(roomForBlinds(rooms, null)).toBeNull();
  });

  it('roomForTable answers only for the tables the wire actually names', () => {
    expect(roomForTable(rooms, 'tbl-fixture')?.id).toBe('floor');   // the biggest pot
    expect(roomForTable(rooms, 'tbl-unknown')).toBeNull();
  });

  it('agentsByRoom puts each of yours in the room he is sitting in', () => {
    const byRoom = agentsByRoom(rooms, [playingAgent, restingAgent]);
    // playingAgent's liveGame runs at 10/20.
    expect(byRoom.floor.map((a) => a.id)).toEqual(['agent_grinder']);
    // The one at the bar is in no room, which is the honest answer: he is not
    // in the building.
    expect(byRoom.upstairs).toEqual([]);
    expect(byRoom.backroom).toEqual([]);
  });

  it('totalSeated is the whole building', () => {
    expect(totalSeated(rooms)).toBe(26);
    expect(totalSeated(null)).toBe(0);
  });
});

describe('useCasinoRooms on the wire', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/rooms', roomsResponse);
  });

  it('serves the lobby over REST before any socket opens', async () => {
    const { result } = renderHook(() => useCasinoRooms({ wsUrl: null }));

    await waitFor(() => expect(result.current.rooms).toHaveLength(3));
    expect(result.current.rooms.map((r) => r.id)).toEqual(['floor', 'upstairs', 'backroom']);
    expect(result.current.status).toBe('offline');
  });

  it('subscribes with FLOOR_SUB and takes the rooms off FLOOR_STATE', async () => {
    const { result } = renderHook(() => useCasinoRooms({ wsUrl: WS }));

    await waitFor(() => expect(socketMock.last()).toBeTruthy());
    const ws = open();
    expect(ws.sent[0]).toMatchObject({ type: 'floor_sub' });

    act(() => ws.emit({ type: 'floor_state', userId: '4242', agents: [], rooms }));
    await waitFor(() => expect(result.current.rooms).toHaveLength(3));
    expect(result.current.status).toBe('live');
  });

  it('a FLOOR_ROOMS push replaces the floor outright', async () => {
    const { result } = renderHook(() => useCasinoRooms({ wsUrl: WS }));
    await waitFor(() => expect(socketMock.last()).toBeTruthy());
    const ws = open();

    act(() => ws.emit({ type: 'floor_rooms', rooms }));
    await waitFor(() => expect(result.current.rooms[0].seated).toBe(17));

    act(() => ws.emit({
      type: 'floor_rooms',
      rooms: [{ ...floorRoom, seated: 41, hot: ['tbl-hot'] }, upstairsRoom, backRoom],
    }));
    await waitFor(() => expect(result.current.rooms[0].seated).toBe(41));
    expect(result.current.rooms[0].hot).toEqual(['tbl-hot']);
  });

  it('an unreadable push does not empty a floor we already have', async () => {
    const { result } = renderHook(() => useCasinoRooms({ wsUrl: WS }));
    await waitFor(() => expect(socketMock.last()).toBeTruthy());
    const ws = open();

    act(() => ws.emit({ type: 'floor_rooms', rooms }));
    await waitFor(() => expect(result.current.rooms).toHaveLength(3));

    act(() => ws.emit({ type: 'floor_rooms', rooms: null }));
    expect(result.current.rooms).toHaveLength(3);
  });

  it('unsubscribes on unmount rather than leaving a socket on the floor', async () => {
    const { unmount } = renderHook(() => useCasinoRooms({ wsUrl: WS }));
    await waitFor(() => expect(socketMock.last()).toBeTruthy());
    const ws = open();

    unmount();
    expect(ws.sent.at(-1)).toMatchObject({ type: 'floor_unsub' });
  });
});
