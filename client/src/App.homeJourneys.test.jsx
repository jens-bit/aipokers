import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App.jsx';
import { fetchMock, socketMock, telegram } from './test/harness.js';
import { playingAgent, restingAgent } from './test/fixtures/agents.js';
import { felt, roomsResponse } from './test/fixtures/rooms.js';
import { midHandGame } from './test/fixtures/game.js';

const agents = [playingAgent, { ...restingAgent, pocket: { balance: 2500 } }];
const upstairs = felt({ tableId: 'tbl-upstairs', room: 'upstairs' });
const draft = () => screen.getByPlaceholderText('Whisper to him…');

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents?', { agents });
  for (const agent of agents) fetchMock.route(`/api/agents/${agent.id}?`, agent);
  fetchMock.route('/hands?', { recentHands: [] });
  fetchMock.route('/flagged?', { flaggedHands: [] });
  fetchMock.route('/thread?', { sessionId: 'home', lines: [], count: 0 });
  fetchMock.route('/memory?', { memoryContext: '' });
  fetchMock.route('/api/rooms', roomsResponse);
  fetchMock.route(/\/api\/rooms\/([^/]+)\/tables$/, ({ url }) => ({
    room: url.match(/\/rooms\/([^/]+)/)[1],
    tables: url.includes('/upstairs/') ? [upstairs] : [],
  }));
  fetchMock.route('/api/events', { events: [], lastId: 0 });
  fetchMock.route('/api/wallet', { balance: 9000, staked: 0, session: 0, ledger: [] });
  fetchMock.route('/queue', { tableId: 'tbl-new', agentId: restingAgent.id, agentName: restingAgent.name }, { method: 'POST' });
});

afterEach(() => {
  sessionStorage.removeItem('agentic_casino_view');
  sessionStorage.removeItem('agentic_casino_room');
});

async function enterUpstairs(user) {
  await screen.findByTestId('home-screen');
  await user.click(screen.getByTestId('home-door'));
  await screen.findByTestId('floor-view');
  await user.click(within(screen.getByTestId('casino-view-toggle')).getByRole('button', { name: 'Board', exact: true }));
  await user.click(await screen.findByRole('button', { name: /^upstairs,/ }));
  expect(await screen.findByTestId('floor-view')).toHaveAttribute('data-room', 'upstairs');
  pushFloorTables();
}

function pushFloorTables() {
  act(() => {
    for (const socket of socketMock.instances) {
      if (socket.readyState > 1) continue;
      if (socket.readyState === 0) socket.open();
      socket.emit({ type: 'room_tables', tables: [upstairs], rooms: { 'tbl-upstairs': 'upstairs' } });
    }
  });
}

async function openRosterAgent(user, name) {
  await user.click(screen.getByRole('button', { name: 'Your agents', exact: true }));
  const roster = await screen.findByTestId('roster-sheet');
  await user.click(await within(roster).findByRole('button', { name: new RegExp(`^${name} — `) }));
  await screen.findByPlaceholderText('Whisper to him…');
}

async function openHomeAgent(user, name) {
  await screen.findByTestId('home-screen');
  await user.click(await screen.findByRole('button', { name: new RegExp(`^${name} — `) }));
  await screen.findByPlaceholderText('Whisper to him…');
}

async function waitForWatch() {
  await screen.findByRole('button', { name: 'Leave table' });
  expect(document.querySelector('.watch-screen')).toBeTruthy();
}

// MERGE-7: these ten cases boot the whole app and drive multi-screen journeys
// through it, and they cost 1.7-3.8s EACH when they have the machine to
// themselves. vitest's default deadline is 5s, and vite.config.js already
// notes the reason it bites here: "Decorative Home trees are expensive; extra
// workers contend for the test deadline." LIFE-1 added server work to the home
// path and pushed the slowest of them (the retained-draft journey, measured at
// 3722ms alone) over that 5s line under full-suite contention, while it passes
// in isolation every time.
//
// So the deadline is wrong, not the test. It is raised here and only here, and
// NOT ONE ASSERTION IS TOUCHED (Testing law #5) — a timeout is a statement
// about how long the machine may take, never about what the product must do.
// 20s still fails a genuine hang in reasonable time; it just stops failing
// honest work that takes four seconds.
describe('HOME-3: existing phone journeys preserve their place', () => {
  it('a floor table returns to the selected room after both Watch trips', async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterUpstairs(user);
    for (let trip = 0; trip < 2; trip += 1) {
      const floor = await screen.findByTestId('floor-view');
      await user.click(await within(floor).findByRole('button', { name: /Watch table tbl-upstairs/ }));
      await waitForWatch();
      await user.click(screen.getByRole('button', { name: 'Leave table' }));
      expect(await screen.findByTestId('floor-view')).toHaveAttribute('data-room', 'upstairs');
      pushFloorTables();
    }
    await user.click(screen.getByRole('button', { name: 'Back home' }));
    expect(await screen.findByTestId('home-screen')).toBeVisible();
  });

  it('a Watch opened from the board returns to the board', async () => {
    const user = userEvent.setup();
    render(<App />);
    await enterUpstairs(user);
    await user.click(within(screen.getByTestId('casino-view-toggle')).getByRole('button', { name: 'Board', exact: true }));
    await user.click(await screen.findByRole('button', { name: /Watch this table\./ }));
    await waitForWatch();
    await user.click(screen.getByRole('button', { name: 'Leave table' }));
    expect(await screen.findByRole('heading', { name: 'The casino', exact: true })).toBeVisible();
    expect(screen.queryByTestId('floor-view')).toBeNull();
  });

  it('retains an unsent draft through Profile and separates drafts by agent and owner', async () => {
    const user = userEvent.setup();
    const view = render(<App />);
    await openHomeAgent(user, restingAgent.name);
    await user.type(draft(), 'Keep this thought.');
    await user.click(screen.getByRole('button', { name: 'Profile', exact: true }));
    await user.click(await screen.findByRole('button', { name: 'Back', exact: true }));
    expect(draft()).toHaveValue('Keep this thought.');
    await user.click(screen.getByRole('button', { name: 'Back', exact: true }));
    await openHomeAgent(user, playingAgent.name);
    expect(draft()).toHaveValue('');
    await user.type(draft(), 'A different thought.');
    await user.click(screen.getByRole('button', { name: 'Back', exact: true }));
    await openHomeAgent(user, restingAgent.name);
    expect(draft()).toHaveValue('Keep this thought.');
    await act(async () => { telegram.signIn({ id: 4343 }); view.rerender(<App />); });
    expect(draft()).toHaveValue('');
    await act(async () => { telegram.signIn(); view.rerender(<App />); });
    expect(draft()).toHaveValue('Keep this thought.');
    expect(fetchMock.posts).toHaveLength(0);
  });

  it.each(['home', 'casino'])('Profile CHAT resumes the thread and Back returns to its original %s', async origin => {
    const user = userEvent.setup();
    render(<App />);
    if (origin === 'casino') { await enterUpstairs(user); await openRosterAgent(user, restingAgent.name); }
    else await openHomeAgent(user, restingAgent.name);
    await user.type(draft(), 'Still writing.');
    await user.click(screen.getByRole('button', { name: 'Profile', exact: true }));
    await user.click(await screen.findByRole('button', { name: 'Back to chat' }));
    await screen.findByPlaceholderText('Whisper to him…');
    await user.click(screen.getByRole('button', { name: 'Back', exact: true }));
    if (origin === 'casino') expect(await screen.findByTestId('floor-view')).toHaveAttribute('data-room', 'upstairs');
    else expect(await screen.findByTestId('home-screen')).toBeVisible();
    expect(document.querySelector('.profile-overview')).toBeNull();
  });

  it('a Chat opened from a direct away-agent Profile still returns to that Profile', async () => {
    const away = { ...restingAgent, location: { where: 'casino', room: 'floor' } };
    fetchMock.route('/api/agents?', { agents: [away] });
    fetchMock.route(`/api/agents/${away.id}?`, away);
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Loose Cannon at the casino.*Open him/ }));
    await user.click(await screen.findByRole('button', { name: 'Back to chat' }));
    await screen.findByPlaceholderText('Whisper to him…');
    await user.click(screen.getByRole('button', { name: 'Back', exact: true }));
    expect(await screen.findByRole('button', { name: 'Back to chat' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Back', exact: true }));
    expect(await screen.findByTestId('home-screen')).toBeVisible();
  });

  it('sending clears only that agent retained draft', async () => {
    fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: 'Heard you.' }] }, { method: 'POST' });
    const user = userEvent.setup();
    render(<App />);
    await openHomeAgent(user, restingAgent.name);
    await user.type(draft(), 'Send this thought.');
    await user.click(screen.getByRole('button', { name: 'Send', exact: true }));
    await screen.findByText('Heard you.', { selector: '.agent-view__text' });
    await user.click(screen.getByRole('button', { name: 'Profile', exact: true }));
    await user.click(await screen.findByRole('button', { name: 'Back', exact: true }));
    expect(draft()).toHaveValue('');
    expect(fetchMock.posts.map(request => request.body)).toEqual([
      { userId: '4242', content: 'Send this thought.', existingAgentId: restingAgent.id },
    ]);
  });

  it('a live Watch retains the unsent conversation and its Home origin', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHomeAgent(user, playingAgent.name);
    await user.type(draft(), 'Ask him after this hand.');
    await user.click(screen.getByRole('button', { name: 'Watch live game' }));
    await waitForWatch();
    await user.click(screen.getByRole('button', { name: 'Leave table' }));
    expect(draft()).toHaveValue('Ask him after this hand.');
    await user.click(screen.getByRole('button', { name: 'Back', exact: true }));
    expect(await screen.findByTestId('home-screen')).toBeVisible();
  });

  it('BUG-143: Watch Chat closes to the game, then Leave restores the original thread and Home', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHomeAgent(user, restingAgent.name);
    await user.type(draft(), 'Finish writing after the game.');
    await user.click(screen.getByRole('button', { name: 'Profile', exact: true }));
    await user.click(await screen.findByRole('button', { name: 'Deploy', exact: true }));
    await user.click(await screen.findByRole('button', { name: 'Deal him in' }));
    await waitForWatch();
    const watchedTable = document.querySelector('.watch-screen');
    await user.click(screen.getByRole('button', { name: 'Chat', exact: true }));
    await screen.findByPlaceholderText('Whisper to him…');
    await user.click(screen.getByRole('button', { name: 'Close agent panel', exact: true }));
    expect(document.querySelector('.watch-screen')).toBe(watchedTable);
    await user.click(screen.getByRole('button', { name: 'Leave table', exact: true }));
    expect(draft()).toHaveValue('Finish writing after the game.');
    await user.click(screen.getByRole('button', { name: 'Back', exact: true }));
    expect(await screen.findByTestId('home-screen')).toBeVisible();
    await openHomeAgent(user, restingAgent.name);
    expect(draft()).toHaveValue('Finish writing after the game.');
  });

  it('the session exit names Home and actually returns there', async () => {
    const user = userEvent.setup();
    render(<App />);
    await openHomeAgent(user, playingAgent.name);
    await user.click(screen.getByRole('button', { name: 'Watch live game' }));
    await waitForWatch();
    let watchSocket;
    await waitFor(() => {
      act(() => {
        for (const socket of socketMock.instances) if (socket.readyState === 0) socket.open();
      });
      // Home also has a floor socket. Deliver the table's final event to the
      // connection that actually watched it, regardless of creation order.
      watchSocket = socketMock.instances.findLast(socket => socket.readyState === 1 &&
        socket.sent.some(message => message.type === 'watch' && message.tableId === playingAgent.activeTableId));
      expect(watchSocket).toBeTruthy();
    });
    act(() => {
      watchSocket.emit({ type: 'state', yourSeat: 0, state: midHandGame });
      watchSocket.emit({ type: 'table_closed', reason: 'Session complete' });
    });
    await waitFor(() => expect(document.querySelector('.watch-ceremony')).toBeTruthy());
    const exit = await screen.findByRole('button', { name: 'Back home', exact: true });
    await user.click(exit);
    expect(await screen.findByTestId('home-screen')).toBeVisible();
  });
}, 20000);
