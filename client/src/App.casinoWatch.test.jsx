import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it } from 'vitest';
import App from './App.jsx';
import { playingAgent, restingAgent } from './test/fixtures/agents.js';
import { felt, floorRoom } from './test/fixtures/rooms.js';
import { midHandGame } from './test/fixtures/game.js';
import { fetchMock, socketMock, telegram } from './test/harness.js';

const owner = { ...playingAgent, identity: { hood: 'moss', glow: 'ice' } };
const realMedia = window.matchMedia;
beforeEach(() => {
  telegram.signIn();
  sessionStorage.setItem('agentic_casino_view', 'floor');
  sessionStorage.setItem('agentic_casino_room', 'floor');
  fetchMock.route('/api/agents?', { agents: [{ ...restingAgent, id: owner.id, name: owner.name }] });
  fetchMock.route('/api/rooms', { rooms: [floorRoom] });
  fetchMock.route(/\/api\/rooms\/[^/]+\/tables$/, { room: 'floor', tables: [felt({ tableId: 'tbl-fixture', room: 'floor' })] });
  fetchMock.route('/api/events', { events: [], lastId: 0 });
  fetchMock.route('/api/wallet', { balance: 10000, ledger: [] });
  fetchMock.route('/memory?', { memoryContext: 'Remember Granite.' });
  fetchMock.route('/thread', { lines: [], sessionId: 'home' });
  fetchMock.route('/hands', { recentHands: [] });
});
afterEach(() => {
  window.matchMedia = realMedia;
  sessionStorage.removeItem('agentic_casino_view');
  sessionStorage.removeItem('agentic_casino_room');
});

it.each([
  ['phone', true], ['phone', false], ['desktop', true], ['desktop', false],
])('CASINO-OWNED: %s opens owned=%s through the actual floor and preserves server card privacy', async (size, owned) => {
  window.matchMedia = query => ({ matches: size === 'desktop' && query.includes('1100'), media: query,
    addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  const view = render(<App />);
  await screen.findByTestId('home-screen');
  await screen.findByRole('button', { name: new RegExp(`^${owner.name} — `) });
  // The casino sees a newer roster than the desktop shell: its owner has
  // joined a table since the Home poll. Only this authenticated response owns it.
  fetchMock.route('/api/agents?', { agents: owned ? [owner] : [restingAgent] });
  fireEvent.click(screen.getByTestId('home-door'));
  await screen.findByTestId('floor-view');
  act(() => { for (const socket of socketMock.instances) {
    if (socket.readyState > 1) continue;
    if (socket.readyState === 0) socket.open();
    socket.emit({ type: 'room_tables', tables: [felt({ tableId: 'tbl-fixture', room: 'floor' })], rooms: { 'tbl-fixture': 'floor' } });
  } });
  const target = await screen.findByRole('button', { name: owned ? `Watch ${owner.name} at this table` : 'Watch table tbl-fixture' });
  const beforeWatch = new Set(socketMock.instances);
  fireEvent.click(target);
  await waitFor(() => expect(view.container.querySelector(size === 'desktop' ? '[data-testid="desk-casino-table"]' : '.watch-screen')).toBeTruthy());
  let socket;
  await waitFor(() => {
    for (const candidate of socketMock.instances) if (!beforeWatch.has(candidate) && candidate.readyState === 0) candidate.open();
    socket = socketMock.instances.find(candidate => !beforeWatch.has(candidate) && candidate.sent.some(message => message.type === 'watch'));
    expect(socket).toBeTruthy();
  });
  expect(socket).toBeTruthy();
  const request = socket.sent.find(message => message.type === 'watch');
  expect(request).toMatchObject({ tableId: 'tbl-fixture', userId: '4242', wantOpponentAI: false });
  expect(request.agentId).toBe(owned ? owner.id : null);
  expect(request.displayName).toBe(owned ? owner.name : 'Jens');
  if (owned) expect(request.memoryContext).toBe('Remember Granite.');
  const state = { ...midHandGame, seats: [
    { ...midHandGame.seats[2], holeCards: [] },
    { ...midHandGame.seats[0], playerId: `agent_${owner.id}`, agentId: owner.id, identity: owner.identity,
      holeCards: owned ? ['Ah', 'Kd'] : [] },
  ] };
  act(() => {
    socket.emit({ type: 'watching', tableId: state.tableId, spectatorSeat: owned ? 1 : -1 });
    socket.emit({ type: 'state', state });
  });
  await waitFor(() => expect(view.container.querySelector('.watch-hero')).toBeTruthy());
  const hero = view.container.querySelector('.watch-hero');
  if (owned) {
    expect(hero.querySelector('.mood-ghost')).toHaveAttribute('data-hood', 'moss');
    expect(hero.querySelector('.watch-hero__cards')).toHaveTextContent('AK');
    expect(view.container.querySelector('.watch-felt__seat')).toHaveTextContent('Granite');
  } else {
    expect(hero.querySelector('.watch-hero__cards')).toHaveTextContent('');
    expect(fetchMock.requestsMatching('/memory?')).toHaveLength(0);
  }
  expect(screen.queryByRole('button', { name: 'CHECK', exact: true })).toBeNull();
  expect(fetchMock.posts).toHaveLength(0);
});
