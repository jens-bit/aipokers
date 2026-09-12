import { act, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { DeskHome } from './DeskHome.jsx';
import { restingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, socketMock, telegram } from '../../test/harness.js';

const empty = { used: 0, cap: 4, next: { index: 1, price: 0, earned: 0, unlocked: true } };
const born = { used: 1, cap: 4, next: { index: 2, price: 10000, earned: 0, unlocked: false } };
const pebble = { ...restingAgent, id: 'pebble', name: 'Pebble', location: { where: 'home' } };
const onPanel = () => {};
const room = (panel, onCreateAgent = () => {}) => <DeskHome wsUrl="ws://localhost/home" panel={panel}
  onPanel={onPanel} onCreateAgent={onCreateAgent} guideEnabled={false}/>;

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [] });
  fetchMock.route('/api/home/thread', { lines: [] });
});

it('HOME-SLOTS-1: opening the desktop table after birth reads the current roster and server slot price', async () => {
  let projection = empty;
  fetchMock.route('/api/slots', () => projection);
  const create = vi.fn();
  const { container, rerender } = render(room('thread', create));
  await waitFor(() => expect(fetchMock.requestsMatching('/api/agents').length).toBeGreaterThan(0));
  await act(async () => {}); // Let the initial, pre-birth REST reads complete.

  projection = born;
  fetchMock.route('/api/agents', { agents: [pebble] });
  act(() => {
    for (const socket of socketMock.instances) socket.open();
    const home = socketMock.instances.find(socket => socket.sent.some(message => message.type === 'floor_sub'));
    expect(home).toBeTruthy();
    home.emit({ type: 'home_state', userId: '4242', agents: [pebble], game: null });
  });
  await waitFor(() => expect(container.querySelector('.home-one[data-agent="pebble"]')).toBeInTheDocument());
  rerender(room('table', create));

  const sheet = screen.getByTestId('home-table-sheet');
  await waitFor(() => expect(within(sheet).getByText('2ND SEAT')).toBeInTheDocument());
  expect(screen.getByText('Roster · 1 of 4 agents')).toBeInTheDocument();
  expect(within(sheet).getByText('10,000 chips won')).toBeInTheDocument();
  expect(within(sheet).queryByText('1ST SEAT')).toBeNull();
  expect(within(sheet).queryByTestId('home-table-draft')).toBeNull();
  expect(fetchMock.requestsMatching('/api/slots')).toHaveLength(1);
  expect(fetchMock.requestsMatching('/api/slots')[0]).toMatchObject({ method: 'GET',
    headers: { 'X-Telegram-Init-Data': telegram.webApp.initData } });
  expect(fetchMock.calls.filter(request => request.method !== 'GET')).toEqual([]);
  expect(create).not.toHaveBeenCalled();
});

it('HOME-SLOTS-1: a late slots response from a closed panel cannot replace the next opening’s answer', async () => {
  let finishOld;
  const oldResponse = new Promise(resolve => { finishOld = resolve; });
  fetchMock.route('/api/slots', () => oldResponse);
  const { rerender } = render(room('table'));
  expect(await screen.findByText('Reading agent slots…')).toBeInTheDocument();
  await waitFor(() => expect(fetchMock.requestsMatching('/api/slots')).toHaveLength(1));
  rerender(room('thread'));
  expect(screen.queryByTestId('home-table-sheet')).toBeNull();

  fetchMock.route('/api/slots', born);
  rerender(room('table'));
  await waitFor(() => expect(screen.getByText('Roster · 1 of 4 agents')).toBeInTheDocument());
  expect(fetchMock.requestsMatching('/api/slots')).toHaveLength(2);
  await act(async () => { finishOld(empty); await oldResponse; });
  expect(screen.getByText('Roster · 1 of 4 agents')).toBeInTheDocument();
  expect(within(screen.getByTestId('home-table-sheet')).getByText('2ND SEAT')).toBeInTheDocument();
  expect(screen.queryByText('1ST SEAT')).toBeNull();
  expect(screen.queryByTestId('home-table-draft')).toBeNull();
});
