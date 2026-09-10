import { act, render, screen, waitFor } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeScreen } from './HomeScreen.jsx';
import { fetchMock, socketMock, telegram } from '../test/harness.js';

it('BUG-184: Home supplies the accepted visitor identity after own-roster REST and keeps pushed speech author-scoped', async () => {
  telegram.signIn();
  const base = { nature: { name: 'Rock' }, mood: { state: 'neutral', heat: 35 }, fatigue: 'fresh',
    location: { where: 'home' }, routine: { key: 'paces', label: 'pacing' } };
  const resident = { ...base, id: 'resident', name: 'Granite', identity: { hood: 'sand', glow: 'gold' } };
  const guest = { ...base, id: 'visitor', name: 'The Professor', guest: true, identity: { hood: 'indigo', glow: 'violet' } };
  const answers = [];
  fetchMock.route('/api/agents?', () => new Promise(resolve => answers.push(resolve)));
  fetchMock.route('/thread?', { sessionId: 'today', lines: [
    { id: 1, ts: 1, from: 'visitor', kind: 'him', who: guest.name, text: 'I can hear the room.' },
  ] });
  fetchMock.route('/api/slots?', { used: 1, cap: 4 });
  fetchMock.route('/api/wallet?', { balance: 1000 });
  render(<HomeScreen wsUrl="ws://localhost:8765" />);
  const socket = await waitFor(() => { expect(socketMock.last()).toBeTruthy(); return socketMock.last(); });
  await act(async () => {
    socket.open();
    socket.emit({ type: 'home_state', userId: '4242', agents: [resident, guest], game: null });
  });
  const line = await screen.findByRole('button', { name: 'The Professor I can hear the room.' });
  expect(line.querySelector('.home-thread__avatar')).toHaveAttribute('data-agent-id', 'visitor');
  expect(line.querySelector('svg')).toHaveAttribute('data-hood', 'indigo');
  expect(line.querySelector('.home-thread__who')).toHaveTextContent(/^The Pr$/);
  await act(async () => { answers.forEach(resolve => resolve({ agents: [resident] })); });
  expect(line.querySelector('.home-thread__avatar')).toHaveAttribute('data-agent-id', 'visitor');
  expect(line.querySelector('svg')).toHaveAttribute('data-hood', 'indigo');
  await act(async () => socket.emit({ type: 'owner_line', userId: '4242', sessionId: 'today', line:
    { id: 2, ts: 2, kind: 'him', from: 'resident', who: 'Granite', text: 'No hurry.' } }));
  expect(line).toHaveAccessibleName('Granite No hurry.');
  expect(line.querySelector('.home-thread__avatar')).toHaveAttribute('data-agent-id', 'resident');
  await act(async () => socket.emit({ type: 'owner_line', userId: 'other', sessionId: 'today', line:
    { id: 3, ts: 3, kind: 'him', from: 'visitor', who: guest.name, text: 'Private elsewhere.' } }));
  expect(line).toHaveAccessibleName('Granite No hurry.');
  expect(screen.queryByText('Private elsewhere.')).toBeNull();
  expect(fetchMock.posts).toHaveLength(0);
  expect(fetchMock.requests.some(r => /\/api\/agents\/[^?]+\/(thread|profile)/.test(r.url))).toBe(false);
});
