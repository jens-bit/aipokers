// UI-3 job F: THE ROOM ANSWERS. Typing to the room already fanned a reply out
// to everybody standing in it through the existing talk turn (SERVER-4,
// THREAD-2) — what this job fixes is drawing it: a reply now shows as his own
// speech bubble over his body, the same queue every other room line uses
// (roomBubbles.js), fed from the OWNER_LINE push the server already sends.
import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeScreen } from './HomeScreen.jsx';
import { fetchMock, socketMock, telegram } from '../test/harness.js';

const base = {
  nature: { name: 'Rock' }, mood: { state: 'neutral', heat: 35 }, fatigue: 'fresh',
  location: { where: 'home' }, routine: { key: 'paces', label: 'pacing' },
};

it('UI-3 job F: his reply to the room becomes his own speech bubble', async () => {
  telegram.signIn();
  const agent = { ...base, id: 'a1', name: 'The Grinder' };
  fetchMock.route('/api/agents?', { agents: [agent] });
  fetchMock.route('/thread?', { sessionId: 'today', lines: [] });
  fetchMock.route('/api/slots?', { used: 1, cap: 4 });
  fetchMock.route('/api/wallet?', { balance: 54000 });
  render(<HomeScreen wsUrl="ws://localhost:8765" renderRail={({ toast }) => <div>{toast}</div>} />);
  const socket = await waitFor(() => { expect(socketMock.last()).toBeTruthy(); return socketMock.last(); });
  await act(async () => { socket.open(); socket.emit({ type: 'home_state', userId: '4242', agents: [agent], game: null }); });
  await screen.findByTestId('home-screen');

  await act(async () => {
    socket.emit({
      type: 'owner_line',
      userId: '4242',
      sessionId: 'today',
      line: { id: 'l1', sessionId: 'today', ts: Date.now(), kind: 'him', who: 'The Grinder', text: 'Evening.', source: 'home', from: 'a1', to: 'owner' },
    });
  });

  await waitFor(() => expect(screen.getByTestId('home-says-a1')).toHaveTextContent('Evening.'));
});

it("UI-3 job F: a table line on the same owner channel is not mistaken for a room reply", async () => {
  telegram.signIn();
  const agent = { ...base, id: 'a1', name: 'The Grinder' };
  fetchMock.route('/api/agents?', { agents: [agent] });
  fetchMock.route('/thread?', { sessionId: 'today', lines: [] });
  fetchMock.route('/api/slots?', { used: 1, cap: 4 });
  fetchMock.route('/api/wallet?', { balance: 54000 });
  render(<HomeScreen wsUrl="ws://localhost:8765" renderRail={({ toast }) => <div>{toast}</div>} />);
  const socket = await waitFor(() => { expect(socketMock.last()).toBeTruthy(); return socketMock.last(); });
  await act(async () => { socket.open(); socket.emit({ type: 'home_state', userId: '4242', agents: [agent], game: null }); });
  await screen.findByTestId('home-screen');

  await act(async () => {
    socket.emit({
      type: 'owner_line',
      userId: '4242',
      sessionId: 'tbl-1',
      line: { id: 'l2', sessionId: 'tbl-1', ts: Date.now(), kind: 'him', who: 'The Grinder', text: 'Nice hand.', source: 'table', from: 'a1', to: null, tableId: 'tbl-1' },
    });
  });

  expect(screen.queryByTestId('home-says-a1')).not.toBeInTheDocument();
});
