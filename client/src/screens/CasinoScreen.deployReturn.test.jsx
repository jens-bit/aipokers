// FIRST-HOUSE-2: deploying into an upper room must not lose that room on Back.
// Use the real casino and desktop shell; only their network responses are fixtures.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CasinoScreen } from './CasinoScreen.jsx';
import { DesktopHome } from '../components/desktop/DesktopHome.jsx';
import { restingAgent } from '../test/fixtures/agents.js';
import { backRoom, felt, roomsResponse, upstairsRoom } from '../test/fixtures/rooms.js';
import { fetchMock, telegram } from '../test/harness.js';

const funded = { ...restingAgent, pocket: { balance: 12_000, mode: 'allowance', cap: 12_000 } };
const queued = room => ({ tableId: `table-${room.id}`, agentId: funded.id, agentName: funded.name,
  room: room.id, stakes: { ...room.stakes, rung: room.rung }, ...room.stakes });

beforeEach(() => {
  telegram.signIn();
  sessionStorage.setItem('agentic_casino_room', 'floor');
  sessionStorage.setItem('agentic_casino_view', 'floor');
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
afterEach(() => {
  sessionStorage.removeItem('agentic_casino_room');
  sessionStorage.removeItem('agentic_casino_view');
});

async function deployInto(room, scope = screen) {
  const door = await scope.findByRole('button', { name: new RegExp(`^${room.name},`) });
  fireEvent.click(door);
}

describe('FIRST-HOUSE-2: the deployed table keeps its room', () => {
  it.each([upstairsRoom, backRoom])('desktop returns to $id after deployment, replacing earlier spectator context', async room => {
    const onDeployed = vi.fn();
    const props = { onDeployed, onSpectate: vi.fn(), onLeave: vi.fn(), practiceReturn: { kind: 'casino' } };
    const view = render(<DesktopHome {...props} />);
    const floor = await screen.findByTestId('floor-view');
    expect(floor).toHaveAttribute('data-room', 'floor');
    fireEvent.click(await within(floor).findByRole('button', { name: /Watch table table-floor/ }));
    const watchedTable = await screen.findByTestId('desk-casino-table');
    fireEvent.click(within(watchedTable).getByRole('button', { name: 'BACK TO THE FLOOR', exact: true }));
    expect(await screen.findByTestId('floor-view')).toHaveAttribute('data-room', 'floor');

    fetchMock.route('/queue', queued(room), { method: 'POST' });
    view.rerender(<DesktopHome {...props} deployAgent={funded} />);
    await deployInto(room, within(view.container.querySelector('.dsk-stage')));
    await waitFor(() => expect(onDeployed).toHaveBeenCalledOnce());
    await screen.findByTestId('desk-casino-table');
    view.rerender(<DesktopHome {...props} />);
    fireEvent.click(within(screen.getByTestId('desk-casino-table')).getByRole('button', { name: 'BACK TO THE FLOOR', exact: true }));
    const returnedFloor = await screen.findByTestId('floor-view');
    expect(returnedFloor).toHaveAttribute('data-room', room.id);
    expect(await within(returnedFloor).findByRole('button', { name: new RegExp(`Watch table table-${room.id}`) })).toBeInTheDocument();
  });

  it.each([upstairsRoom, backRoom])('phone casino remount restores the deployed $id room', async room => {
    const onDeployed = vi.fn();
    fetchMock.route('/queue', queued(room), { method: 'POST' });
    const view = render(<CasinoScreen deployAgent={funded} onDeployed={onDeployed} />);
    await deployInto(room);
    await waitFor(() => expect(onDeployed).toHaveBeenCalledOnce());
    view.unmount();
    render(<CasinoScreen />);
    expect(await screen.findByTestId('floor-view')).toHaveAttribute('data-room', room.id);
  });

  it.each([
    ['room', queued(upstairsRoom)],
    ['nested stakes', { tableId: 'table-upstairs', stakes: upstairsRoom.stakes }],
    ['top-level blinds', { tableId: 'table-upstairs', smallBlind: 25, bigBlind: 50 }],
  ])('uses the queued %s rather than an outdated requested doorway when the response differs', async (_, payload) => {
    const onDeployed = vi.fn();
    fetchMock.route('/queue', payload, { method: 'POST' });
    render(<CasinoScreen deployAgent={funded} onDeployed={onDeployed} />);
    await deployInto(backRoom);
    await waitFor(() => expect(onDeployed).toHaveBeenCalledOnce());
    expect(onDeployed.mock.calls[0][2].id).toBe('upstairs');
    expect(sessionStorage.getItem('agentic_casino_room')).toBe('upstairs');
  });

  it('a rejected deployment keeps the previous room and the agent in the tray', async () => {
    const onDeployed = vi.fn();
    fetchMock.route('/queue', { status: 409, body: { error: 'cantAfford' } }, { method: 'POST' });
    render(<CasinoScreen deployAgent={funded} onDeployed={onDeployed} />);
    await deployInto(backRoom);
    await waitFor(() => expect(fetchMock.posts.some(request => request.url.includes('/queue'))).toBe(true));
    expect(onDeployed).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('agentic_casino_room')).toBe('floor');
    expect(screen.getByText(`placing ${funded.name}`)).toBeInTheDocument();
  });
});
