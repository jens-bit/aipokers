import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { DesktopHome } from './DesktopHome.jsx';
import { restingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, socketMock, telegram } from '../../test/harness.js';
import { FirstRunGuideProvider } from '../onboarding/FirstRunGuide.jsx';

// Geometry is covered by ContextHint and browser tests; this suite verifies
// the real birth/room lifecycle, including an arrival before acknowledgment.
vi.mock('../onboarding/ContextHint.jsx', () => ({ ContextHint: ({ text, onDismiss }) => <aside data-testid="context-hint">{text}<button onClick={onDismiss}>Skip</button></aside> }));

const newborn = { ...restingAgent, id: 'newborn-pebble', name: 'Pebble' };
const defaults = { onWatchAgent: () => {}, onDeployAgent: () => {}, onCreateAgent: () => {} };
const hint = () => screen.queryByTestId('context-hint');
const withGuide = props => <FirstRunGuideProvider ownerId="4242"><DesktopHome {...props}/></FirstRunGuideProvider>;
const PendingBirth = () => <div data-testid="pending-birth">His birth card awaits acknowledgment.</div>;

beforeEach(() => {
  localStorage.clear();
  telegram.signIn();
  fetchMock.route('/hands', { recentHands: [] });
});

it('FIRST-RUN-1: a newborn arriving during the desktop draft cannot show guidance before acknowledgment', async () => {
  fetchMock.route('/api/agents', { agents: [] });
  const props = { ...defaults, wsUrl: 'ws://localhost:8765' };
  const draft = <PendingBirth />;
  const { rerender } = render(withGuide({ ...props, draft }));
  await screen.findByTestId('pending-birth');
  await waitFor(() => expect(within(screen.getByTestId('desk-roster')).queryByText('Reading the room…')).toBeNull());
  const homeSocket = socketMock.last();
  act(() => {
    homeSocket.open();
    homeSocket.emit({ type: 'home_state', agents: [newborn], game: null });
  });
  expect(within(screen.getByTestId('home-screen')).getByRole('button', { name: /^Pebble —/ })).toBeInTheDocument();
  expect(hint()).toBeNull();
  expect(localStorage.getItem('railbird.guide.v1:4242')).toBeNull();

  // App clears the draft only after finishBirth acknowledges the created card.
  rerender(withGuide({ ...props, draft: null, birthHandledId: newborn.id }));
  expect(await screen.findByTestId('context-hint')).toHaveTextContent('This is Pebble. Tap to talk.');
  expect(JSON.parse(localStorage.getItem('railbird.guide.v1:4242')).seen).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Skip', exact: true }));
  expect(hint()).toBeNull();
});

it('FIRST-RUN-1: an independently arriving birth card hides guidance until the card closes', async () => {
  fetchMock.route('/api/agents', { agents: [restingAgent] });
  render(withGuide(defaults));
  await screen.findByTestId('context-hint');
  fetchMock.route('/api/agents', { agents: [restingAgent, newborn] });
  fireEvent.focus(window);
  const title = await screen.findByText('The card he was born with');
  const card = title.closest('.dsk-panel');
  expect(within(card).getByRole('button', { name: 'Deal him in', exact: true })).toBeInTheDocument();
  expect(hint()).toBeNull();

  fireEvent.click(within(card).getByRole('button', { name: 'Close panel' }));
  expect(hint()).toHaveTextContent(`This is ${restingAgent.name}. Tap to talk.`);
});

it('FIRST-RUN-1: removing the introduced agent ends the guide without binding a different agent', async () => {
  fetchMock.route('/api/agents', { agents: [restingAgent] });
  render(withGuide({ ...defaults, wsUrl: 'ws://localhost:8765' }));
  await screen.findByTestId('context-hint');
  const homeSocket = socketMock.last();
  act(() => {
    homeSocket.open();
    homeSocket.emit({ type: 'home_state', agents: [], game: null });
  });
  expect(hint()).toBeNull();
  act(() => homeSocket.emit({ type: 'home_state', agents: [newborn], game: null }));
  expect(hint()).toBeNull();
});

it('BUG-255: a pending request keeps its answer controls ahead of the introductory hint', async () => {
  const asking = { ...restingAgent, want: { kind: 'deploy', text: 'I am fresh. Put me in.', needs: 'deploy' } };
  fetchMock.route('/api/agents', { agents: [asking] });
  render(withGuide({ ...defaults, wsUrl: 'ws://localhost:8765' }));
  await screen.findByTestId('home-want-later');
  expect(hint()).toBeNull();
  const homeSocket = socketMock.last();
  act(() => { homeSocket.open(); homeSocket.emit({ type: 'home_state', agents: [{ ...asking, want: null }], game: null }); });
  expect(await screen.findByTestId('context-hint')).toHaveTextContent(`This is ${restingAgent.name}. Tap to talk.`);
});
