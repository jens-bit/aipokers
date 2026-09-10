import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeScreen } from './HomeScreen.jsx';
import { fetchMock, socketMock, telegram } from '../test/harness.js';

it.each([false, true])('BUG-189: Home passes the want actor identity in the actual %s desktop path', async desktop => {
  telegram.signIn();
  const base = { nature: { name: 'Rock' }, mood: { state: 'neutral', heat: 35 }, fatigue: 'fresh',
    location: { where: 'home' }, routine: { key: 'paces', label: 'pacing' } };
  const first = { ...base, id: 'first', name: 'Professor', identity: { hood: 'sand', glow: 'gold' } };
  const asking = { ...base, id: 'asking', name: 'Professor', identity: { hood: 'indigo', glow: 'violet' },
    want: { kind: 'deploy', text: 'Let me back in.' } };
  fetchMock.route('/api/agents?', { agents: [first, asking] });
  fetchMock.route('/thread?', { sessionId: 'today', lines: [] });
  fetchMock.route('/api/slots?', { used: 2, cap: 4 });
  fetchMock.route('/api/wallet?', { balance: 54000 });
  render(<HomeScreen wsUrl="ws://localhost:8765" desktop={desktop} renderRail={({ toast }) => <div>{toast}</div>} />);
  const socket = await waitFor(() => { expect(socketMock.last()).toBeTruthy(); return socketMock.last(); });
  await act(async () => { socket.open(); socket.emit({ type: 'home_state', userId: '4242', agents: [first, asking], game: null }); });
  const want = await screen.findByTestId('home-want');
  expect(want.querySelector('.home-mood-avatar')).toHaveAttribute('data-agent-id', 'asking');
  expect(want.querySelector('.home-mood-avatar svg')).toHaveAttribute('data-hood', 'indigo');
  expect(want.querySelector('.home-want__who')).toHaveTextContent(/^Profes$/);
  expect(screen.getAllByText('Let me back in.', { exact: true })).toHaveLength(1);
  expect(screen.queryByTestId('home-bubble')).toBeNull();
  expect(fetchMock.posts).toHaveLength(0);
});
