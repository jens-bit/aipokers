// FIRST-HOUSE-3: a confirmed owned table arrival refreshes the roster immediately.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { DesktopHome } from './DesktopHome.jsx';
import { restingAgent } from '../../test/fixtures/agents.js';
import { midHandGame } from '../../test/fixtures/game.js';
import { fetchMock, telegram } from '../../test/harness.js';

// This test owns the shell's roster source, not the building's layout.
vi.mock('../../screens/CasinoScreen.jsx', () => ({ CasinoScreen: () => <div data-testid="casino-stage" /> }));

const tableId = 'confirmed-casino';
const beforeDeal = { ...restingAgent, status: 'playing', activeTableId: tableId, presence: 'resting',
  location: { where: 'home' }, routine: { label: 'counting chips' }, liveGame: null };
const atTable = { ...beforeDeal, presence: 'playing', routine: null,
  location: { where: 'table', tableId, room: 'backroom' }, liveGame: { tableId, blinds: '50/100' } };
const game = { ...midHandGame, tableId, seats: [{ ...midHandGame.seats[0], playerId: `agent_${beforeDeal.id}` }, midHandGame.seats[1]] };
const props = { isWatching: true, watchingAgent: beforeDeal,
  tableConfig: { tableId, isSpectator: true }, game: null };
const roster = () => within(screen.getByTestId('desk-roster'));
const reads = () => fetchMock.requestsMatching('/api/agents').length;

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents: [beforeDeal] });
  fetchMock.route('/api/wallet', { balance: 20_000, ledger: [] });
});

async function initialHome(viewProps = props) {
  const view = render(<DesktopHome {...viewProps} />);
  const home = await screen.findByTestId('home-screen');
  await waitFor(() => expect(roster().getByText('home')).toBeInTheDocument());
  fireEvent.click(within(home).getByRole('button', { name: 'The door — the casino', exact: true }));
  await screen.findByTestId('casino-stage');
  return view;
}

it('FIRST-HOUSE-3: first owned STATE replaces the pre-deal Home roster without waiting for its poll', async () => {
  const view = await initialHome();
  const before = reads();
  fetchMock.route('/api/agents', { agents: [atTable] });
  view.rerender(<DesktopHome {...props} game={game} />);
  expect(await roster().findByText('at the casino')).toBeInTheDocument();
  expect(roster().queryByText('counting chips')).toBeNull();
  expect(reads()).toBe(before + 1);
  view.rerender(<DesktopHome {...props} game={{ ...game, handNumber: game.handNumber + 1 }} />);
  expect(reads()).toBe(before + 1, 'subsequent hands do not poll the roster again');
});

it('FIRST-HOUSE-3: an older in-flight roster read cannot undo the confirmed arrival refresh', async () => {
  const view = await initialHome();
  let finishOld;
  fetchMock.route('/api/agents', () => new Promise(resolve => { finishOld = resolve; }));
  fireEvent.focus(window);
  await waitFor(() => expect(finishOld).toBeTypeOf('function'));
  fetchMock.route('/api/agents', { agents: [atTable] });
  view.rerender(<DesktopHome {...props} game={game} />);
  expect(await roster().findByText('at the casino')).toBeInTheDocument();
  await act(async () => finishOld({ agents: [beforeDeal] }));
  expect(roster().getByText('at the casino')).toBeInTheDocument();
  expect(roster().queryByText('counting chips')).toBeNull();
});

it.each([
  ['another table', { ...game, tableId: 'other-table' }, true],
  ['another owner', { ...game, seats: [{ ...game.seats[0], playerId: 'agent_somebody-else' }] }, true],
  ['a human game', game, false],
])('FIRST-HOUSE-3: %s cannot reinterpret this agent\'s location', async (_, snapshot, isWatching) => {
  const view = await initialHome();
  const before = reads();
  fetchMock.route('/api/agents', { agents: [atTable] });
  view.rerender(<DesktopHome {...props} isWatching={isWatching} game={snapshot} />);
  expect(reads()).toBe(before);
  expect(roster().getByText('home')).toBeInTheDocument();
});
