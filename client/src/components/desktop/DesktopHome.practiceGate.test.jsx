import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';

import { DesktopHome } from './DesktopHome.jsx';
import { restingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, socketMock, telegram } from '../../test/harness.js';

const newborn = { ...restingAgent, id: 'newborn-pebble', name: 'Pebble' };
const defaults = { onWatchAgent: () => {}, onDeployAgent: () => {}, onCreateAgent: () => {} };
const practice = () => within(screen.getByTestId('home-screen')).queryByRole('button', { name: /^Learn with / });
const PendingBirth = () => <div data-testid="pending-birth">His birth card awaits acknowledgment.</div>;

beforeEach(() => {
  localStorage.clear();
  telegram.signIn();
  fetchMock.route('/hands', { recentHands: [] });
});

it('DESK-NEXT-1: a newborn arriving during the desktop draft cannot launch practice before the birth is acknowledged', async () => {
  fetchMock.route('/api/agents', { agents: [] });
  const onPractice = vi.fn();
  const props = { ...defaults, wsUrl: 'ws://localhost:8765', onPractice };
  const draft = <PendingBirth />;
  const { rerender } = render(<DesktopHome {...props} draft={draft} />);
  await screen.findByTestId('pending-birth');
  await waitFor(() => expect(within(screen.getByTestId('desk-roster')).queryByText('Reading the room…')).toBeNull());
  const homeSocket = socketMock.last();
  act(() => {
    homeSocket.open();
    homeSocket.emit({ type: 'home_state', agents: [newborn], game: null });
  });
  expect(within(screen.getByTestId('home-screen')).getByRole('button', { name: /^Pebble —/ })).toBeInTheDocument();
  expect(practice()).toBeNull();
  expect(onPractice).not.toHaveBeenCalled();

  // App clears the draft only after finishBirth acknowledges the created card.
  rerender(<DesktopHome {...props} draft={null} birthHandledId={newborn.id} />);
  const learn = await within(screen.getByTestId('home-screen')).findByRole('button', { name: 'Learn with Pebble' });
  fireEvent.click(learn);
  expect(onPractice).toHaveBeenCalledOnce();
  expect(onPractice).toHaveBeenCalledWith(expect.objectContaining({ id: newborn.id }));
});

it('DESK-NEXT-1: an independently arriving birth card also holds practice until the card closes', async () => {
  fetchMock.route('/api/agents', { agents: [restingAgent] });
  render(<DesktopHome {...defaults} onPractice={vi.fn()} />);
  await within(screen.getByTestId('home-screen')).findByRole('button', { name: `Learn with ${restingAgent.name}` });
  fetchMock.route('/api/agents', { agents: [restingAgent, newborn] });
  fireEvent.focus(window);
  const title = await screen.findByText('The card he was born with');
  const card = title.closest('.dsk-panel');
  expect(within(card).getByRole('button', { name: 'Deal him in', exact: true })).toBeInTheDocument();
  expect(practice()).toBeNull();

  fireEvent.click(within(card).getByRole('button', { name: 'Close panel' }));
  expect(practice()).toHaveAccessibleName(`Learn with ${restingAgent.name}`);
});
