import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { WatchScreen } from '../WatchScreen.jsx';
import { DeskHomeTable } from '../desktop/DeskHomeTable.jsx';
import { DeskCasinoTable } from '../desktop/DeskCasinoTable.jsx';
import { midHandGame, spectatorConfig } from '../../test/fixtures/game.js';
import { agentsResponse } from '../../test/fixtures/agents.js';
import { fetchMock, telegram } from '../../test/harness.js';

const guide = vi.hoisted(() => ({ stage: 'live', agentId: 'agent_grinder', advance: vi.fn(), dismiss: vi.fn() }));
vi.mock('./FirstRunGuide.jsx', () => ({ useFirstRunGuide: () => guide }));

beforeEach(() => {
  guide.stage = 'live'; guide.advance.mockClear(); guide.dismiss.mockClear();
  telegram.signIn();
  fetchMock.route('/api/agents', agentsResponse);
  fetchMock.route('/api/home/thread', { lines: [], count: 0 });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
    const card = this.classList.contains('watch-felt__card');
    const cardIndex = card ? [...this.parentElement.children].indexOf(this) : 0;
    const [left, top, width, height] = this.hasAttribute('data-watch-status') ? [120, 70, 160, 24]
      : this.matches('.seat-ghost, .watch-hero__body, .watch-composer__input') ? [120, 210, 100, 44]
      : card ? [120 + cardIndex * 46, 210, 44, 64]
      : this.classList.contains('watch-felt__board') ? [0, 210, 1024, 64]
      : this.dataset.testid === 'context-hint' ? [0, 0, 240, 112] : [0, 0, 1024, 768];
    return { left, top, width, height, right: left + width, bottom: top + height, x: left, y: top };
  });
});
afterEach(() => vi.restoreAllMocks());

function phone(props = {}) {
  return <WatchScreen game={midHandGame} mySeat={0} config={spectatorConfig} chatMessages={[]}
    displayNames={{}} onLeave={() => {}} onSitOut={() => {}} {...props}/>;
}
function desk(props = {}) {
  return <DeskHomeTable game={midHandGame} mySeat={0} seated={false} agents={agentsResponse.agents}
    legalActions={[]} onBack={() => {}} {...props}/>;
}
function casino({ error, onLeave, ...props } = {}) {
  return <DeskCasinoTable game={midHandGame} mySeat={0} agent={agentsResponse.agents[0]}
    notice={error} onBack={onLeave ?? (() => {})} {...props}/>;
}

it('LIVE-GUIDE: phone waits for the owner lookup before offering the real private-chat sequence', async () => {
  let release;
  fetchMock.route('/api/agents', () => new Promise(resolve => { release = resolve; }));
  const ownedGame = { ...midHandGame, seats: midHandGame.seats.map((seat, index) => index ? seat : { ...seat, playerId: 'agent_agent_grinder' }) };
  render(phone({ game: ownedGame }));
  await act(async () => new Promise(resolve => requestAnimationFrame(resolve)));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  expect(guide.advance).not.toHaveBeenCalled();
  await act(async () => release(agentsResponse));
  const hint = await screen.findByTestId('context-hint');
  expect(hint).toHaveTextContent('You are watching. Your AI agent is playing.');
  fireEvent.click(within(hint).getByRole('button', { name: 'OK' }));
  expect(guide.advance).toHaveBeenCalledWith('live-chat');
  expect(fetchMock.posts).toEqual([]);
});

// The founder replaced the cards lesson with real watching/chat/seat pointers.
it.each([['phone', phone], ['desktop', desk], ['desktop casino', casino]])('LIVE-GUIDE: %s points at watch status and OK advances without touching the hand', async (_, table) => {
  const onAct = vi.fn(), onLeave = vi.fn();
  const view = render(table({ onAct, onLeave }));
  const board = view.container.querySelector('.watch-felt__board');
  const cards = board.textContent;
  const hint = await screen.findByRole('note', { name: 'Getting started' });
  expect(hint).toHaveTextContent('You are watching.');
  expect(hint).not.toHaveTextContent('shared cards');
  if (_ !== 'phone') expect(view.container.querySelector('[data-watch-status]')).toHaveStyle({ pointerEvents: 'auto' });
  expect(screen.getByTestId('context-hint-target')).toHaveStyle({ left: '120px', width: '160px', height: '24px' });
  fireEvent.click(within(hint).getByRole('button', { name: 'OK' }));
  expect(guide.advance).toHaveBeenCalledWith('live-opponent');
  expect(guide.dismiss).not.toHaveBeenCalled();
  expect(onAct).not.toHaveBeenCalled();
  expect(onLeave).not.toHaveBeenCalled();
  expect(view.container.querySelector('.watch-felt__board')).toBe(board);
  expect(board.textContent).toBe(cards);
});

it.each([['phone', phone], ['desktop', desk], ['desktop casino', casino]])('CONTEXT-HINT-1: %s leaves a read sheet clear and restores the hint when it closes', async (_, table) => {
  const view = render(table());
  await screen.findByRole('note', { name: 'Getting started' });
  fireEvent.click(view.container.querySelector('.seat-ghost'));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  const read = view.container.querySelector('.read-sheet');
  expect(read).toBeInTheDocument();
  fireEvent.click(within(read).getByRole('button', { name: /close/i }));
  expect(await screen.findByTestId('context-hint')).toBeInTheDocument();
});

it('CONTEXT-HINT-1: phone chat covers no guide and closing it restores the live hint', async () => {
  render(phone());
  await screen.findByTestId('context-hint');
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Close the thread' }));
  expect(await screen.findByTestId('context-hint')).toBeInTheDocument();
});

it.each([['phone', phone], ['desktop', desk], ['desktop casino', casino]])('CONTEXT-HINT-1: %s does not guide missing, finished or errored tables, or an inactive tour', async (_, table) => {
  const view = render(table({ game: null }));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  view.rerender(table({ sessionEnd: { finalStack: 1200, hands: 4 } }));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  view.rerender(table({ error: 'Table unavailable' }));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  guide.stage = null;
  view.rerender(table());
  expect(screen.queryByTestId('context-hint')).toBeNull();
  await act(async () => {});
});

it('CONTEXT-HINT-1: a public casino spectator can follow the guide without private cards or human controls', async () => {
  const onBack = vi.fn();
  const game = { ...midHandGame, seats: midHandGame.seats.map(seat => ({ ...seat, holeCards: [], isAI: false })) };
  const view = render(casino({ game, agent: null, mySeat: -1, onBack }));
  await screen.findByTestId('context-hint');
  expect(view.container.querySelector('.watch-hero__cards')).toHaveTextContent('');
  expect(screen.queryByRole('button', { name: 'CHECK' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'BACK TO THE FLOOR' }));
  expect(onBack).toHaveBeenCalledOnce();
  expect(guide.dismiss).not.toHaveBeenCalled();
});

it('CONTEXT-HINT-1: desktop casino pauses the live hint during a notice or an explicitly seated human state', async () => {
  const view = render(casino());
  await screen.findByTestId('context-hint');
  view.rerender(casino({ notice: 'Reconnecting…' }));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  expect(screen.getByRole('status')).toHaveTextContent('Reconnecting…');
  view.rerender(casino({ guideBlocked: true }));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
  view.rerender(casino({ seated: true }));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  view.rerender(casino());
  expect(await screen.findByTestId('context-hint')).toBeInTheDocument();
});

it.each([['phone', phone], ['desktop', desk]])('CONTEXT-HINT-1: %s human play keeps the actual legal action usable with no tour overlay', async (_, table) => {
  const onAct = vi.fn();
  render(table({ seated: true, game: { ...midHandGame, toAct: 0 }, legalActions: [{ type: 'check' }], onAct }));
  expect(screen.queryByTestId('context-hint')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'CHECK' }));
  expect(onAct).toHaveBeenCalledOnce();
  expect(onAct).toHaveBeenCalledWith({ type: 'check' });
  expect(guide.dismiss).not.toHaveBeenCalled();
  await act(async () => {});
});
