import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import App from '../../App.jsx';
import { fetchMock, socketMock, telegram } from '../../test/harness.js';
import { playingAgent } from '../../test/fixtures/agents.js';
import { midHandGame } from '../../test/fixtures/game.js';

afterEach(() => vi.restoreAllMocks());
async function openOwnTable(entry = 'away frame') {
  vi.spyOn(window, 'matchMedia').mockImplementation(query => ({ matches: query.includes('1100'), media: query,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  telegram.signIn();
  const agent = { ...playingAgent, activeTableId: midHandGame.tableId,
    location: { where: 'casino', tableId: midHandGame.tableId } };
  fetchMock.route('/api/agents', { agents: [agent] });
  fetchMock.route('/memory', { memoryContext: '' });
  render(<App/>);
  // The TV mounts before the roster gives it a live target. Wait for the
  // actual control to become available before attempting the watch journey.
  const testId = entry === 'television' ? 'home-tv' : `home-frame-${agent.id}`;
  await screen.findByTestId(testId, {}, { timeout: 5000 });
  const target = await waitFor(() => {
    const button = screen.getByTestId(testId);
    expect(button).toBeEnabled();
    return button;
  });
  await userEvent.click(target);
  let socket;
  await waitFor(() => {
    act(() => { for (const candidate of socketMock.instances) if (candidate.readyState === 0) candidate.open(); });
    socket = socketMock.instances.find(candidate => candidate.sent.some(message => message.type === 'watch'));
    expect(socket).toBeTruthy();
  });
  expect(socket.sent.find(message => message.type === 'watch')).toMatchObject({ tableId: midHandGame.tableId, agentId: agent.id, userId: '4242' });
  return { socket, agent };
}

it.each(['away frame', 'television'])('BUG-194: refused own-agent %s shows the server reason and Back home instead of shuffling', async entry => {
  const { socket } = await openOwnTable(entry);
  act(() => socket.emit({ type: 'error', message: 'This kitchen is private' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('This kitchen is private');
  expect(screen.queryByTestId('desk-casino-table')).toBeNull();
  expect(screen.queryByText(/SHUFFLING/)).toBeNull();
  await userEvent.click(within(screen.getByRole('alert')).getByRole('button', { name: 'Back home', exact: true }));
  expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(socket.readyState).toBe(3);
});

it('BUG-194: an admitted own-agent snapshot replaces the refusal with the existing table', async () => {
  const { socket } = await openOwnTable();
  act(() => socket.emit({ type: 'error', message: 'That table is closed' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('That table is closed');
  act(() => {
    socket.emit({ type: 'watching', tableId: midHandGame.tableId, spectatorSeat: 0 });
    socket.emit({ type: 'state', state: midHandGame, yourSeat: 0, legalActions: [] });
  });
  expect(await screen.findByTestId('desk-casino-table')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});

it('BUG-194: an action refusal after an admitted own-agent snapshot keeps the existing table', async () => {
  const { socket } = await openOwnTable();
  act(() => {
    socket.emit({ type: 'watching', tableId: midHandGame.tableId, spectatorSeat: 0 });
    socket.emit({ type: 'state', state: midHandGame, yourSeat: 0, legalActions: [] });
  });
  expect(await screen.findByTestId('desk-casino-table')).toBeInTheDocument();
  act(() => socket.emit({ type: 'error', message: 'That action is not legal' }));
  expect(screen.getByTestId('desk-casino-table')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).toBeNull();
});
