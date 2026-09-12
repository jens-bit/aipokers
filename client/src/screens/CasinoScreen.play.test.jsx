import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CasinoScreen } from './CasinoScreen.jsx';
import { DesktopHome } from '../components/desktop/DesktopHome.jsx';
import { restingAgent, playingAgent } from '../test/fixtures/agents.js';
import { backRoom, felt, upstairsRoom } from '../test/fixtures/rooms.js';
import { fetchMock, telegram } from '../test/harness.js';

const milo = { ...restingAgent, id: 'milo', name: 'Milo', pocket: { balance: 12000, mode: 'allowance' } };
const quiet = { ...backRoom, tables: 0, seated: 0 };
const deployed = { tableId: 'new-table', agentId: milo.id, agentName: milo.name, strategy: milo.strategy,
  room: quiet.id, stakes: quiet.stakes, sessionStarted: true, joinedExisting: false };

function route(agents = [milo], tables = []) {
  fetchMock.route('/api/agents?', { agents });
  fetchMock.route('/api/rooms', { rooms: [quiet] });
  fetchMock.route(/\/api\/rooms\/[^/]+\/tables$/, { room: quiet.id, tables });
  fetchMock.route('/api/events', { events: [], lastId: 0 });
  fetchMock.route('/api/wallet', { balance: 20000, ledger: [] });
  fetchMock.route('/thread', { lines: [], sessionId: 'home' });
}

beforeEach(() => {
  telegram.signIn();
  sessionStorage.setItem('agentic_casino_room', quiet.id);
  sessionStorage.setItem('agentic_casino_view', 'floor');
  route();
});
afterEach(() => {
  sessionStorage.removeItem('agentic_casino_room');
  sessionStorage.removeItem('agentic_casino_view');
});

describe('CASINO-PLAY: a real agent can join or start from the floor', () => {
  it('a delayed deployment cannot pull the owner into Watch after leaving the casino', async () => {
    let finish;
    fetchMock.route('/deploy', () => new Promise(resolve => { finish = resolve; }), { method: 'POST' });
    const onDeployed = vi.fn();
    const view = render(<CasinoScreen onDeployed={onDeployed} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send Milo to play' }));
    view.unmount();
    render(<p>Back at Home</p>);
    sessionStorage.setItem('agentic_casino_room', upstairsRoom.id);
    await act(async () => finish(deployed));
    expect(onDeployed).not.toHaveBeenCalled();
    expect(screen.getByText('Back at Home')).toBeVisible();
    expect(sessionStorage.getItem('agentic_casino_room')).toBe(upstairsRoom.id);
    expect(fetchMock.posts).toHaveLength(1);
  });

  it.each(['another room', 'the same floor again'])('a delayed deployment respects navigation to %s', async destination => {
    let finish;
    fetchMock.route('/api/rooms', { rooms: [upstairsRoom, quiet] });
    fetchMock.route(/\/api\/rooms\/[^/]+\/tables$/, { tables: [] });
    fetchMock.route('/deploy', () => new Promise(resolve => { finish = resolve; }), { method: 'POST' });
    const onDeployed = vi.fn();
    render(<CasinoScreen onDeployed={onDeployed} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send Milo to play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Board', exact: true }));
    const room = destination === 'another room' ? upstairsRoom : quiet;
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(`^${room.name},`) }));
    expect(screen.getByTestId('floor-view')).toHaveAttribute('data-room', room.id);
    await act(async () => finish(deployed));
    expect(onDeployed).not.toHaveBeenCalled();
    expect(screen.getByTestId('floor-view')).toHaveAttribute('data-room', room.id);
    expect(sessionStorage.getItem('agentic_casino_room')).toBe(room.id);
    expect(screen.queryByTestId('casino-play-status')).toBeNull();
    expect(screen.getByRole('button', { name: 'Send Milo to play' })).toBeEnabled();
    expect(fetchMock.posts).toHaveLength(1);
  });

  it('a late funding refusal does not open a sheet over the board the owner chose', async () => {
    let finish;
    fetchMock.route('/deploy', () => new Promise(resolve => { finish = resolve; }), { method: 'POST' });
    render(<CasinoScreen onDeployed={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send Milo to play' }));
    fireEvent.click(screen.getByRole('button', { name: 'Board', exact: true }));
    await act(async () => finish({ status: 402, body: { error: 'cantAfford' } }));
    expect(screen.getByRole('button', { name: 'Board', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('dialog', { name: 'Fund Milo' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(fetchMock.posts).toHaveLength(1);
  });

  it.each([false, true])('shows the exact buy-in before one request; joins existing=%s', async joinedExisting => {
    let finish;
    fetchMock.route('/deploy', () => new Promise(resolve => { finish = resolve; }), { method: 'POST' });
    const onDeployed = vi.fn();
    render(<CasinoScreen onDeployed={onDeployed} />);
    const action = await screen.findByTestId('casino-play');
    expect(action).toHaveTextContent('$50/$100');
    expect(action).toHaveTextContent('$10,000 play-money buy-in from Milo’s pocket');
    const send = within(action).getByRole('button', { name: 'Send Milo to play' });
    fireEvent.click(send);
    fireEvent.click(send);
    expect(send).toBeDisabled();
    expect(fetchMock.posts).toHaveLength(1);
    expect(fetchMock.posts[0]).toMatchObject({ url: '/api/agents/milo/deploy', body: { userId: '4242', rung: 2, stakes: quiet.stakes } });
    expect(fetchMock.posts[0].headers['x-telegram-init-data']).toBeTruthy();
    expect(onDeployed).not.toHaveBeenCalled();
    await act(async () => finish({ ...deployed, joinedExisting }));
    expect(onDeployed).toHaveBeenCalledWith({ ...deployed, joinedExisting }, expect.objectContaining({ id: 'milo' }), quiet);
  });

  it('lets the owner choose among available agents and excludes agents already away or retired', async () => {
    route([milo, { ...milo, id: 'pip', name: 'Pip' }, playingAgent,
      { ...milo, id: 'guest', name: 'Guest', location: { where: 'visiting' } },
      { ...milo, id: 'visitor', name: 'Visitor', guest: true },
      { ...milo, id: 'retired', name: 'Retired', archived: true }]);
    fetchMock.route('/deploy', { ...deployed, agentId: 'pip', agentName: 'Pip' }, { method: 'POST' });
    render(<CasinoScreen onDeployed={vi.fn()} />);
    const choice = await screen.findByRole('combobox', { name: 'Choose your agent' });
    expect(within(choice).getAllByRole('option').map(option => option.textContent)).toEqual(['Milo', 'Pip']);
    fireEvent.change(choice, { target: { value: 'pip' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send Pip to play' }));
    await waitFor(() => expect(fetchMock.posts).toHaveLength(1));
    expect(fetchMock.posts[0].url).toBe('/api/agents/pip/deploy');
  });

  it.each([false, true])('a short pocket opens the existing funding controls without deploying (desktop=%s)', async desktop => {
    route([{ ...milo, pocket: { balance: 100, mode: 'allowance' } }]);
    render(<CasinoScreen desktop={desktop} onDeployed={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fund Milo to play' }));
    expect(await screen.findByRole('dialog', { name: 'Fund Milo' })).toBeVisible();
    expect(fetchMock.posts).toHaveLength(0);
  });

  it('refreshes the pocket after funding and still requires the explicit play action', async () => {
    route([{ ...milo, pocket: { balance: 100, mode: 'allowance', cap: 10000 } }]);
    fetchMock.route('/fund', () => {
      fetchMock.route('/api/agents?', { agents: [milo] });
      return { pocket: milo.pocket };
    }, { method: 'POST' });
    fetchMock.route('/deploy', deployed, { method: 'POST' });
    render(<CasinoScreen onDeployed={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Fund Milo to play' }));
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Fund Milo' })).getByRole('button', { name: 'Give him chips', exact: true }));
    const send = await screen.findByRole('button', { name: 'Send Milo to play' });
    expect(fetchMock.posts.map(request => request.url)).toEqual(['/api/agents/milo/fund']);
    fireEvent.click(send);
    await waitFor(() => expect(fetchMock.posts).toHaveLength(2));
    expect(fetchMock.posts[1].url).toBe('/api/agents/milo/deploy');
  });

  it.each([
    ['refusal', { status: 409, body: { error: 'agentResting', message: 'Milo is sitting this one out.' } }, 'Milo is sitting this one out.'],
    ['malformed success', { tableId: 'bad-table' }, 'Milo’s table could not be opened. Try again.'],
    ['network failure', () => { throw new Error('offline'); }, 'Milo’s table could not be opened. Try again.'],
  ])('shows %s and allows a deliberate retry without false success', async (_, reply, message) => {
    const onDeployed = vi.fn();
    fetchMock.route('/deploy', reply, { method: 'POST' });
    render(<CasinoScreen onDeployed={onDeployed} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send Milo to play' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(message);
    expect(onDeployed).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Send Milo to play' })).toBeEnabled();
    fetchMock.route('/deploy', deployed, { method: 'POST' });
    fireEvent.click(screen.getByRole('button', { name: 'Send Milo to play' }));
    await waitFor(() => expect(onDeployed).toHaveBeenCalledOnce());
    expect(fetchMock.posts).toHaveLength(2);
  });

  it('does not call an unstarted session playing or send another deployment', async () => {
    fetchMock.route('/deploy', { ...deployed, sessionStarted: false }, { method: 'POST' });
    const onDeployed = vi.fn();
    render(<CasinoScreen onDeployed={onDeployed} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Send Milo to play' }));
    expect(await screen.findByTestId('casino-play-status')).toHaveTextContent('Waiting for Milo’s table to start.');
    expect(onDeployed).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Send Milo to play' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Watch Milo' }));
    expect(onDeployed).toHaveBeenCalledOnce();
    expect(fetchMock.posts).toHaveLength(1);
  });

  it.each(['owned', 'public'])('floor Watch passes only authenticated roster ownership for a %s table', async kind => {
    const owner = { ...milo, activeTableId: 'table-owned', liveGame: null };
    const tableId = kind === 'owned' ? 'table-owned' : 'table-public';
    route([owner], [felt({ tableId, room: quiet.id })]);
    const onSpectate = vi.fn();
    render(<CasinoScreen onSpectate={onSpectate} />);
    fireEvent.click(await screen.findByRole('button', { name: kind === 'owned' ? 'Watch Milo at this table' : `Watch table ${tableId}` }));
    if (kind === 'owned') expect(onSpectate).toHaveBeenCalledWith(tableId, { roomId: quiet.id, agent: owner });
    else expect(onSpectate).toHaveBeenCalledWith(tableId);
    expect(fetchMock.posts).toHaveLength(0);
  });

  it('the desktop board forwards the existing placement action', async () => {
    const onPlace = vi.fn();
    render(<DesktopHome onPlace={onPlace} />);
    fireEvent.click(await screen.findByTestId('home-door'));
    fireEvent.click(await screen.findByRole('button', { name: 'Board', exact: true }));
    fireEvent.click(await screen.findByRole('button', { name: 'SEND HIM TO PLAY', exact: true }));
    expect(onPlace).toHaveBeenCalledWith(expect.objectContaining({ id: 'milo' }));
  });
});
