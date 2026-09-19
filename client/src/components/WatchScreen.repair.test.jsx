import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { WatchFelt, WatchScreen } from './WatchScreen.jsx';
import { midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { playingAgent } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [{ ...playingAgent, chatHistory: [
    { role: 'assistant', content: 'I remember the river.' },
  ] }] });
  fetchMock.route('/thread', { lines: [] });
});

const props = { game: midHandGame, mySeat: 0, config: spectatorConfig, privateChatInPlace: true };
const uncontested = { ...midHandGame, street: 'complete', community: [], toAct: null,
  result: { type: 'uncontested', pot: 150, winners: [{ seat: 0, amount: 150 }], showdown: [], deltas: { 0: 50 } } };

it('BUG-249: the session ceremony last-hand sentence agrees with the actual paid award', async () => {
  const game = { ...uncontested, community: ['5c', '4h', '8c'],
    result: { ...uncontested.result, pot: 200, winners: [{ seat: 0, amount: 200 }],
      rake: { total: 2, bySeat: { 0: 2 } } } };
  const { container } = render(<WatchScreen {...props} game={game}
    sessionEnd={{ reason: 'worn', hands: 24, finalStack: 1700 }}/>);
  await screen.findByRole('button', { name: 'Talk to The Grinder about tonight' });
  const sentence = container.querySelector('.watch-ceremony__hand');
  expect(sentence).toHaveAttribute('aria-label', 'The Grinder took $198 uncontested');
  expect(sentence.querySelector('.watch-ceremony__hand-amt')).toHaveTextContent(/^\$198$/);
});

it('BUG-249: a major award accessible label agrees with its net visual amount', () => {
  const game = { ...uncontested, community: ['6c', '4h', '8c', 'Kd', '2s'],
    result: { type: 'showdown', pot: 12000, winners: [{ seat: 0, amount: 12000, hand: 'three sixes' }],
      rake: { total: 60, bySeat: { 0: 60 } } } };
  const { container } = render(<WatchFelt game={game} mySeat={0}/>);
  expect(container.querySelector('.watch-felt__won-amt')).toHaveTextContent(/^\$11,940$/);
  expect(container.querySelector('.watch-felt__won-pill'))
    .toHaveAttribute('aria-label', 'The Grinder took $11,940 with three sixes');
});

it('BUG-249: the compact replay award agrees with its paid result sentence', () => {
  const game = { ...uncontested, community: ['5c', '4h', '8c'],
    result: { ...uncontested.result, pot: 200, winners: [{ seat: 0, amount: 200 }],
      rake: { total: 2, bySeat: { 0: 2 } } } };
  const { container } = render(<WatchFelt game={game} mySeat={0} geom={{ felt: 500, pot: 196, board: 243, tug: 290 }}/>);
  expect(container.querySelector('.watch-felt__won-amt')).toHaveTextContent(/^\$198$/);
  expect(container.querySelector('.watch-felt__won-pill')).toHaveAttribute('aria-label', 'The Grinder took $198 uncontested');
});

it('BUG-238: an uncontested preflop award has no dealt board or card backs', () => {
  const { container } = render(<WatchFelt game={uncontested} mySeat={0}/>);
  expect(container.querySelector('.watch-felt__won')).toHaveTextContent('$150');
  expect(container.querySelector('.watch-felt__won')).toHaveTextContent('uncontested');
  expect(container.querySelector('.watch-felt__board').children).toHaveLength(0);
});

it('BUG-239: typing a whisper switches the open Stats panel to Conversation without losing the draft', async () => {
  const user = userEvent.setup();
  render(<WatchScreen {...props}/>);
  await user.click(screen.getByRole('button', { name: 'Chat', exact: true }));
  await user.click(screen.getByRole('button', { name: 'Stats', exact: true }));
  const composer = await screen.findByPlaceholderText('Whisper to him…');
  await user.type(composer, 'Stay patient');
  expect(screen.getByRole('button', { name: 'Conversation', exact: true })).toHaveAttribute('aria-pressed', 'true');
  expect(composer).toHaveValue('Stay patient');
  expect(await screen.findByText('I remember the river.')).toBeVisible();
});

it('BUG-240: tapping the owned agent opens Conversation first', async () => {
  const user = userEvent.setup();
  render(<WatchScreen {...props}/>);
  await user.click(screen.getByRole('button', { name: 'View your agent at the table' }));
  const panel = await screen.findByRole('dialog', { name: 'The Grinder at the table' });
  expect(within(panel).getByRole('button', { name: 'Conversation' })).toHaveAttribute('aria-pressed', 'true');
});

it('BUG-247: Talk about tonight leaves the session ceremony for the private conversation without leaving the table', async () => {
  const user = userEvent.setup();
  const sessionEnd = { reason: 'worn', hands: 24, finalStack: 1700 };
  const { container } = render(<WatchScreen {...props} sessionEnd={sessionEnd}/>);
  await user.click(screen.getByRole('button', { name: 'Talk to The Grinder about tonight' }));
  const panel = await screen.findByRole('dialog', { name: 'The Grinder at the table' });
  expect(within(panel).getByRole('button', { name: 'Conversation' })).toHaveAttribute('aria-pressed', 'true');
  expect(container.querySelector('.watch-ceremony')).toBeNull();
  expect(await within(panel).findByText('I remember the river.')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Back to table' }));
  expect(container.querySelector('.watch-felt')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Talk to The Grinder about tonight' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Back home', exact: true })).toBeVisible();
});

it('BUG-247: closing a finished human game thread restores Play again and Back home', async () => {
  const user = userEvent.setup();
  const onRebuy = vi.fn(), onBackToFloor = vi.fn();
  const { container } = render(<WatchScreen game={uncontested} mySeat={0} seated
    config={{ displayName: 'Jens', buyIn: 2000 }}
    sessionEnd={{ reason: 'complete', hands: 24, finalStack: 1700 }}
    onRebuy={onRebuy} onBackToFloor={onBackToFloor}/>);
  expect(screen.getByRole('button', { name: 'Play again' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Chat', exact: true }));
  expect(screen.getByRole('dialog', { name: 'The table' })).toBeVisible();
  expect(container.querySelector('.watch-ceremony')).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Close the thread' }));
  expect(screen.queryByRole('dialog', { name: 'The table' })).toBeNull();
  await user.click(screen.getByRole('button', { name: 'Play again' }));
  expect(onRebuy).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Back home', exact: true }));
  expect(onBackToFloor).toHaveBeenCalledTimes(1);
});

it('BUG-241: the private panel is docked outside the live felt, keeping the hero out of its overlay', async () => {
  const user = userEvent.setup();
  const { container } = render(<WatchScreen {...props}/>);
  const felt = container.querySelector('.watch-felt');
  await user.click(screen.getByRole('button', { name: 'Chat', exact: true }));
  const panel = await screen.findByRole('dialog', { name: 'The Grinder at the table' });
  expect(panel.closest('.watch-felt')).toBeNull();
  expect(container.querySelector('.watch-felt')).toBe(felt);
  expect(felt).not.toHaveClass('watch-felt--overlay');
});

it('BUG-218: the felt displays actual settled rake and keeps the same empty slot before the next award', () => {
  const { container, rerender } = render(<WatchFelt game={midHandGame} mySeat={0}/>);
  const slot = container.querySelector('.watch-felt__rake');
  expect(slot).toBeInTheDocument();
  expect(slot).toBeEmptyDOMElement();
  rerender(<WatchFelt game={{ ...uncontested, result: { ...uncontested.result, rake: { total: 12 } } }} mySeat={0}/>);
  expect(slot).toHaveTextContent('Rake $12');
  rerender(<WatchFelt game={{ ...midHandGame, handNumber: midHandGame.handNumber + 1 }} mySeat={0}/>);
  expect(container.querySelector('.watch-felt__rake')).toBe(slot);
  expect(slot).toBeEmptyDOMElement();
});

it('BUG-218: a pending all-in runout cannot reveal its settled rake early', () => {
  const { container, rerender } = render(<WatchFelt game={{ ...uncontested, pace: 'allin',
    community: ['As', 'Kd', '8c', '4s', '2h'], result: { ...uncontested.result, rake: { total: 12 } },
  }} mySeat={0} flipped={3}/>);
  expect(container.querySelector('.watch-felt__rake')).toBeEmptyDOMElement();
  rerender(<WatchFelt game={{ ...uncontested, result: { ...uncontested.result, rake: { total: 0 } } }} mySeat={0}/>);
  expect(container.querySelector('.watch-felt__rake')).toBeEmptyDOMElement();
});
