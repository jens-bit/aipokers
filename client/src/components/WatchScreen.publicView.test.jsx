import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { WatchFelt, WatchScreen } from './WatchScreen.jsx';
import { midHandGame } from '../test/fixtures/game.js';
import { fetchMock, telegram } from '../test/harness.js';

const player = { ...midHandGame.seats[0], playerId: 'agent_pebble', displayName: 'Pebble',
  identity: { hood: 'moss', glow: 'ice' }, stack: 117, holeCards: [], mood: { state: 'focused', heat: 18 } };
const house = { ...midHandGame.seats[1], playerId: 'house_granite', displayName: 'Granite',
  identity: null, stack: 279, holeCards: [] };
const homeGame = { ...midHandGame, seats: [player, house], pot: 4,
  lastAction: { handNumber: 1, seq: 3, street: 'flop', seat: 1, type: 'call', amount: 1 } };
const config = { isSpectator: true, tableId: 'home_table', displayName: 'Jens' };
const watch = (game = homeGame, props = {}) => <WatchScreen game={game} config={config} mySeat={-1}
  chatMessages={[]} onLeave={() => {}} {...props}/>;

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [] });
});

it('WATCH-PUBLIC-1: public Home Watch draws both real players and identifies its foreground camera', () => {
  const { container } = render(watch());
  const header = container.querySelector('.watch-screen__header');
  expect(header).toHaveTextContent('Watching');
  expect(header).not.toHaveTextContent('Jens');
  expect(header).not.toHaveTextContent(/neutral/i);
  const hero = container.querySelector('.watch-hero');
  expect(hero).toHaveTextContent('Pebble');
  expect(hero.querySelector('.mood-ghost')).toHaveAttribute('data-hood', 'moss');
  expect(container.querySelector('.watch-felt__hero-stack')).toHaveTextContent('$117');
  expect(container.querySelectorAll('.watch-felt__seat')).toHaveLength(1);
  expect(container.querySelector('.watch-felt__seat')).toHaveTextContent('Granite');
  expect(container.querySelector('.watch-felt__seat')).toHaveTextContent('$279');
  expect(hero.querySelector('.watch-hero__cards')).toHaveTextContent('');
  expect(container.querySelector('.action-narrator')).toHaveTextContent('Granite calls $1.');
  fireEvent.click(within(hero).getByRole('button', { name: 'Read Pebble' }));
  expect(screen.getByRole('dialog', { name: 'Pebble — read' })).toBeInTheDocument();
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(0);
});

it('WATCH-PUBLIC-1: public camera follows occupied seats after a reconnect or seat count change', () => {
  const { container, rerender } = render(watch(homeGame, { mySeat: 7 }));
  expect(container.querySelector('.watch-hero')).toHaveTextContent('Pebble');
  rerender(watch({ ...homeGame, seats: [null, house, player] }, { mySeat: -1 }));
  expect(container.querySelector('.watch-hero')).toHaveTextContent('Granite');
  expect(container.querySelector('.watch-felt__hero-stack')).toHaveTextContent('$279');
  expect(container.querySelectorAll('.watch-felt__seat')).toHaveLength(1);
  expect(container.querySelector('.watch-felt__seat')).toHaveTextContent('Pebble');
  expect(container.querySelector('.watch-felt__seat .floor-ghost')).toHaveAttribute('data-hood', 'moss');
  rerender(watch({ ...homeGame, seats: [null, house, player] }, { mySeat: 2 }));
  expect(container.querySelector('.watch-hero')).toHaveTextContent('Pebble');
  expect(container.querySelector('.watch-felt__hero-stack')).toHaveTextContent('$117');
});

it('WATCH-PUBLIC-1: camera identity does not become authenticated ownership or borrow another player’s action', () => {
  const game = { ...homeGame, lastAction: { ...homeGame.lastAction, seat: 0, type: 'raise', amount: 4, chips: 4, allIn: true },
    heroHand: { seat: 0, handNumber: 1, seq: 3, street: 'flop', label: 'a pair of aces' } };
  const { container } = render(watch(game, { lastDecision: { seat: 1, action: { type: 'fold' } } }));
  expect(container.querySelector('.watch-hero')).not.toHaveTextContent('FOLD');
  expect(container.querySelector('.action-narrator')).toHaveTextContent('Pebble shoves $4.');
  expect(container.querySelector('.action-narrator')).not.toHaveTextContent('aces');
  expect(screen.queryByRole('button', { name: 'CHECK' })).toBeNull();
});

it('WATCH-PUBLIC-1: the shared felt itself resolves a public camera and keeps its speaker over that player', () => {
  const { container } = render(<WatchFelt game={homeGame} mySeat={-1}
    bubbles={[{ id: 'public-line', seat: 0, mine: false, text: 'Good hand.' }]}/>);
  expect(container.querySelector('.watch-hero .mood-ghost')).toHaveAttribute('data-hood', 'moss');
  expect(container.querySelector('.watch-hero__says')).toHaveTextContent('Good hand.');
  expect(container.querySelector('.watch-felt__hero-stack')).toHaveTextContent('$117');
});

it('WATCH-PUBLIC-1: a public empty table does not invent a seated character or stack', () => {
  const { container } = render(watch({ ...homeGame, street: 'waiting', seats: [] }));
  expect(container.querySelector('.watch-hero')).toBeNull();
  expect(container.querySelector('.watch-felt__hero-stack')).toBeNull();
  expect(container.querySelectorAll('.watch-felt__seat')).toHaveLength(0);
  expect(container.querySelector('.watch-screen__title')).toHaveTextContent('Watching');
});

it('WATCH-PUBLIC-1: a long foreground name is visibly shortened but remains complete for readers and its action', () => {
  const name = 'The Patient Pebble of Malta';
  const { container } = render(watch({ ...homeGame, seats: [{ ...player, displayName: name }, house] }));
  const label = container.querySelector('.watch-hero__strip [title]');
  expect(label).toHaveTextContent('The Patient Pe…');
  expect(label).toHaveAttribute('aria-label', name);
  expect(within(container.querySelector('.watch-hero')).getByRole('button', { name: `Read ${name}` })).toBeInTheDocument();
});

it('WATCH-PUBLIC-1: an assigned owner-agent seat and a human’s legal action retain their actual ownership', () => {
  const game = { ...homeGame, seats: [house, { ...player, holeCards: ['Ah', 'Kd'] }] };
  const { container, rerender } = render(watch(game, { mySeat: 1,
    config: { ...config, agentId: 'pebble', displayName: 'Pebble' } }));
  expect(container.querySelector('.watch-screen__title')).toHaveTextContent('Pebble');
  expect(container.querySelector('.watch-hero__cards')).toHaveTextContent('AK');
  expect(container.querySelector('.watch-hero .mood-ghost')).toHaveAttribute('data-hood', 'moss');
  expect(container.querySelector('.watch-felt__seat')).toHaveTextContent('Granite');
  const onAct = vi.fn();
  rerender(watch({ ...game, toAct: 1 }, { seated: true, mySeat: 1, config: { displayName: 'Jens' }, legalActions: [{ type: 'check' }], onAct }));
  expect(container.querySelector('.watch-hero .mood-ghost')).toBeNull();
  expect(screen.getByTestId('owner-hero-cards')).toHaveTextContent('AK');
  fireEvent.click(screen.getByRole('button', { name: 'CHECK' }));
  expect(onAct).toHaveBeenCalledWith({ type: 'check' });
  expect(onAct).toHaveBeenCalledOnce();
});
