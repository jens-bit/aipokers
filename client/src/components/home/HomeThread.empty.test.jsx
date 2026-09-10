import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it } from 'vitest';
import { HomeThread } from './HomeThread.jsx';
import { fetchMock } from '../../test/harness.js';

const EMPTY = 'The room is yours. It is empty.';
beforeEach(() => fetchMock.route('/thread', { sessionId: 'today', lines: [] }));
const emptyRoom = props => render(<HomeThread roomMode roomLoaded nobodyYet {...props} />);

it('BUG-183: a confirmed empty household has the authored system-only sentence', async () => {
  emptyRoom();
  const line = screen.getByTestId('home-thread-line');
  expect(line).toHaveTextContent(EMPTY);
  expect(line.querySelector('.home-thread__who')).toBeNull();
  expect(line.querySelector('.home-thread__text')).toHaveClass('home-thread__text--system');
  expect(screen.queryByText('Nobody is home.')).toBeNull();
});

it('BUG-183: an unconfirmed roster keeps its loading state', () => {
  emptyRoom({ roomLoaded: false });
  expect(screen.getByTestId('home-thread-line')).toHaveTextContent('Reading the room…');
  expect(screen.queryByText(EMPTY)).toBeNull();
});

it('BUG-183: all-away and ordinary room fallbacks are not the first-agent state', () => {
  const view = emptyRoom({ nobodyYet: false, agent: { id: 'away', name: 'Granite',
    location: { where: 'table' }, opener: 'That river was expensive.' } });
  // BUG-184 ports the reference's inline name + separating space; same author/text.
  expect(screen.getByTestId('home-thread-line')).toHaveTextContent('Granite That river was expensive.');
  expect(screen.queryByText(EMPTY)).toBeNull();
  view.rerender(<HomeThread roomMode roomLoaded nobodyYet={false} />);
  expect(screen.getByTestId('home-thread-line')).toHaveTextContent('Nobody is home.');
  expect(screen.queryByText(EMPTY)).toBeNull();
});

it('BUG-183: an actual owner sentence replaces the empty fallback', async () => {
  fetchMock.route('/thread', { sessionId: 'today', lines: [
    { id: 1, kind: 'you', who: 'YOU', from: 'owner', text: 'Anyone there?', ts: 1 },
  ] });
  emptyRoom();
  const line = screen.getByTestId('home-thread-line');
  await waitFor(() => expect(line).toHaveTextContent('YOU Anyone there?'));
  expect(line.querySelector('.home-thread__text')).not.toHaveClass('home-thread__text--system');
  expect(screen.queryByText(EMPTY)).toBeNull();
});

it('BUG-183: pending YOU wins immediately, then refusal restores the truthful system fallback', async () => {
  let reply;
  fetchMock.route('/api/home/say', () => new Promise(resolve => { reply = resolve; }));
  emptyRoom();
  await userEvent.type(screen.getByTestId('home-thread-input'), 'Anyone there?');
  await userEvent.click(screen.getByRole('button', { name: 'Send', exact: true }));
  const line = screen.getByTestId('home-thread-line');
  expect(line).toHaveTextContent('YOU Anyone there?');
  expect(screen.queryByText(EMPTY)).toBeNull();
  await waitFor(() => expect(reply).toBeTypeOf('function'));
  reply({ status: 503, body: { error: 'Synthetic refusal' } });
  await waitFor(() => expect(screen.getByTestId('home-thread-input')).toHaveValue('Anyone there?'));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not send');
  expect(line).toHaveTextContent(EMPTY);
  expect(line.querySelector('.home-thread__who')).toBeNull();
});

it('BUG-183: the selected recap and its author still outrank another served sentence', async () => {
  fetchMock.route('/thread', { sessionId: 'today', lines: [
    { id: 1, kind: 'him', who: 'Bluff', from: 'bluff', text: 'One more hand.', ts: 1 },
  ] });
  emptyRoom({ nobodyYet: false, open: true, agent: { id: 'gran', name: 'Granite',
    unseenRecap: true, sessionRecap: { text: 'Quiet night. Nothing to report.' } } });
  await screen.findByText('“One more hand.”');
  expect(screen.getByTestId('home-thread-line')).toHaveTextContent('Granite Quiet night. Nothing to report.');
  expect(screen.queryByText(EMPTY)).toBeNull();
});
