import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import App from './App.jsx';
import { AgentThread } from './screens/ChatsScreen.jsx';
import { YouScreen } from './screens/YouScreen.jsx';
import { AgentChat } from './components/AgentChat.jsx';
import { HistoryTab } from './components/HistoryTab.jsx';
import { fetchMock, socketMock, telegram } from './test/harness.js';
import { playingAgent } from './test/fixtures/agents.js';
import { midHandGame } from './test/fixtures/game.js';

const hand = { handNumber: 7, pot: 200, potSize: 200, won: true,
  holeCards: ['As', 'Ad'], decisions: [{ street: 'river', action: { type: 'call' }, reasoning: 'Private owner hand reasoning.' }] };
const requests = () => fetchMock.requestsMatching('/hands?');

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents?', { agents: [playingAgent] });
  fetchMock.route(`/api/agents/${playingAgent.id}?`, playingAgent);
  fetchMock.route('/hands?', request => request.headers['x-telegram-init-data'] === telegram.webApp.initData
    ? { recentHands: [hand], stats: playingAgent.stats }
    : { status: 401, body: { error: 'Unauthorized' } });
  fetchMock.route('/flagged?', { flaggedHands: [] });
  fetchMock.route('/attr-log?', { attrLog: [] });
  fetchMock.route('/memory?', { memoryContext: '' });
  fetchMock.route('/thread?', { lines: [], count: 0 });
  fetchMock.route('/api/wallet?', { balance: 9000, ledger: [] });
});

async function expectOwnerRead() {
  await waitFor(() => expect(requests().length).toBeGreaterThan(0));
  for (const request of requests()) {
    expect(request.headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
    expect(request.url).toContain('userId=4242');
  }
}

it('BUG-274: the private conversation reads its owner’s hands with credentials', async () => {
  render(<AgentThread agent={playingAgent} />);
  await expectOwnerRead();
  expect(await screen.findByText('NOTHING WORTH FLAGGING')).toBeVisible();
});

it('BUG-274: You keeps the authenticated owner’s notable hands', async () => {
  render(<YouScreen />);
  await expectOwnerRead();
  expect(await screen.findByText('THE GRINDER · HAND #7')).toBeVisible();
});

it('BUG-274: history loads actual private decisions using the owner credential', async () => {
  render(<HistoryTab />);
  await expectOwnerRead();
  fireEvent.click(await screen.findByRole('button', { name: /Hand #7/ }));
  expect(await screen.findByText(/Private owner hand reasoning/)).toBeVisible();
});

it('BUG-274: the retained legacy chat caller also supplies the owner credential', async () => {
  render(<AgentChat agent={playingAgent} />);
  await expectOwnerRead();
});

it('BUG-274: App refreshes the completed watched hand using the same owner credential', async () => {
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: /^The Grinder — / }));
  await user.click(await screen.findByRole('button', { name: 'Watch live game' }));
  await screen.findByRole('button', { name: 'Stop watching' });
  let socket;
  await waitFor(() => {
    act(() => { for (const ws of socketMock.instances) if (ws.readyState === 0) ws.open(); });
    socket = socketMock.instances.findLast(ws => ws.sent.some(message => message.type === 'watch' && message.tableId === playingAgent.activeTableId));
    expect(socket).toBeTruthy();
  });
  const before = requests().length;
  act(() => {
    socket.emit({ type: 'state', yourSeat: 0, state: midHandGame });
    socket.emit({ type: 'hand_start', handNumber: 7 });
    socket.emit({ type: 'hand_result', result: { type: 'uncontested', pot: 200, winners: [{ seat: 0, amount: 200 }] } });
  });
  await waitFor(() => expect(requests().length).toBeGreaterThan(before));
  expect(requests().at(-1).headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
}, 15_000);
