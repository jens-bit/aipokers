// client/src/screens/CasinoScreen.deployReturn.test.jsx — FIRST-HOUSE-2, UI-3 job A
//
// FIRST-HOUSE-2 was about not losing the room a man had just been deployed
// into on Back. UI-3 job A deletes the thing that could be lost — there is
// one floor now, always open, so "which room to return to" is no longer a
// question this screen has to answer. What is still worth pinning is the
// part of the mechanism that survives underneath: `onDeployed` hands back
// the ROOM the server actually queued him into (his real stakes), even when
// that differs from what the owner tapped or the response shapes the number
// differently — the callers this screen reports to (DesktopHome's own
// bookkeeping, `casinoReturnRoomId`) still read that argument.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CasinoScreen } from './CasinoScreen.jsx';
import { restingAgent } from '../test/fixtures/agents.js';
import { backRoom, felt, roomsResponse, upstairsRoom } from '../test/fixtures/rooms.js';
import { fetchMock, telegram } from '../test/harness.js';

const funded = { ...restingAgent, pocket: { balance: 12_000, mode: 'allowance', cap: 12_000 } };
const queued = room => ({ tableId: `table-${room.id}`, agentId: funded.id, agentName: funded.name,
  room: room.id, stakes: { ...room.stakes, rung: room.rung }, ...room.stakes });

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [funded] });
  fetchMock.route('/api/rooms', roomsResponse);
  fetchMock.route(/\/api\/rooms\/([^/]+)\/tables$/, ({ url }) => {
    const room = url.match(/\/rooms\/([^/]+)/)[1];
    return { room, tables: [felt({ tableId: `table-${room}`, room })] };
  });
  fetchMock.route('/api/events', { events: [], lastId: 0 });
  fetchMock.route('/api/wallet', { balance: 20_000, ledger: [] });
  fetchMock.route('/thread', { lines: [], sessionId: 'home' });
  fetchMock.route('/hands', { recentHands: [] });
});

async function dealIntoStake(label) {
  const stake = await screen.findByRole('button', { name: new RegExp(`^${label.replace(/[$/]/g, '\\$&')}`) });
  fireEvent.click(stake);
}

describe('FIRST-HOUSE-2: the deployed table hands back its real room', () => {
  it.each([
    ['room', queued(upstairsRoom)],
    ['nested stakes', { tableId: 'table-upstairs', stakes: upstairsRoom.stakes }],
    ['top-level blinds', { tableId: 'table-upstairs', smallBlind: 25, bigBlind: 50 }],
  ])('uses the queued %s rather than the requested stake when the response differs', async (_, payload) => {
    const onDeployed = vi.fn();
    fetchMock.route('/queue', payload, { method: 'POST' });
    render(<CasinoScreen deployAgent={funded} onDeployed={onDeployed} />);
    await dealIntoStake(backRoom.stakes.label);
    await waitFor(() => expect(onDeployed).toHaveBeenCalledOnce());
    expect(onDeployed.mock.calls[0][2].id).toBe('upstairs');
  });

  it('a rejected deployment keeps the agent in the tray', async () => {
    const onDeployed = vi.fn();
    fetchMock.route('/queue', { status: 409, body: { error: 'cantAfford' } }, { method: 'POST' });
    render(<CasinoScreen deployAgent={funded} onDeployed={onDeployed} />);
    await dealIntoStake(backRoom.stakes.label);
    await waitFor(() => expect(fetchMock.posts.some(request => request.url.includes('/queue'))).toBe(true));
    expect(onDeployed).not.toHaveBeenCalled();
    expect(screen.getByText(`placing ${funded.name}`)).toBeInTheDocument();
  });

  // The floor never needed to be told which room to reopen — it always shows
  // every table, including his. A deploy just has to leave the table on it.
  it('the deployed table is on the floor once he is in, with no room to remember', async () => {
    fetchMock.route('/queue', queued(upstairsRoom), { method: 'POST' });
    render(<CasinoScreen deployAgent={funded} onDeployed={vi.fn()} />);
    await dealIntoStake(backRoom.stakes.label);
    await screen.findByTestId('floor-view');
    expect(screen.getByTestId('floor-view')).toHaveAttribute('data-room', 'floor');
  });
});
