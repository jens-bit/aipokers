import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { DeskHomeTable } from './DeskHomeTable.jsx';
import { DesktopHome } from './DesktopHome.jsx';
import { midHandGame } from '../../test/fixtures/game.js';
import { fetchMock, telegram } from '../../test/harness.js';

vi.mock('../../hooks/useHomeThread.js', () => ({ useHomeThread: () => ({
  lines: [{ id: 'room-line', kind: 'him', from: 'a', to: 'all', text: 'We are still here.' }],
  loading: false, sending: false, say: vi.fn(), error: null,
}) }));
// Only the room entry is substituted. The desktop shell, table, action strip,
// session ceremony and permanent conversation below are the real components.
vi.mock('./DeskHome.jsx', () => ({ DeskHome: ({ onSitAtTable, onWatchTable }) => <>
  <button onClick={() => onSitAtTable('home-test')}>Sit at home</button>
  <button onClick={() => onWatchTable('home-test')}>Watch at home</button>
</> }));

const agents = [{ id: 'a', name: 'Rock', location: { where: 'home' } }];
function gameAt(stack, extra = {}) {
  return { ...midHandGame, tableId: 'home-test', street: 'complete', toAct: null,
    seats: midHandGame.seats.map((seat, index) => ({ ...seat,
      stack: index === 1 ? stack : 1700, displayName: index === 1 ? 'You' : seat.displayName,
    })), ...extra };
}
function renderTable(props = {}) {
  return render(<DeskHomeTable game={gameAt(0)} seated mySeat={1} buyIn={1000}
    agents={agents} legalActions={[]} onAct={vi.fn()} onBack={vi.fn()} {...props}/>);
}
beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', { agents });
  fetchMock.route('/api/wallet', { wallet: { balance: 5000, ledger: [] } });
});

it('BUG-140: a desktop human bust shows YOU LOST with human actions and retains the room', async () => {
  const onRebuy = vi.fn(), onBack = vi.fn();
  const { container } = renderTable({ sessionEnd: { reason: 'a player ran out of chips', hands: 4 }, onRebuy, onBack });
  const ceremony = screen.getByRole('status');
  expect(within(ceremony).getByText('YOU LOST')).toBeVisible();
  expect(within(ceremony).getByText('−$1,000')).toBeInTheDocument();
  expect(ceremony.querySelector('.watch-ceremony__stack')).toHaveTextContent('$0');
  expect(ceremony.querySelector('.watch-ceremony__ghost')).toBeNull();
  expect(screen.queryByText('BUSTED', { exact: true })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Fund him again' })).toBeNull();
  expect(container.querySelector('.dsk-home-table__actions')).toBeNull();
  expect(screen.getByTestId('room-thread')).toHaveTextContent('We are still here.');
  await userEvent.click(within(ceremony).getByRole('button', { name: 'Play again' }));
  expect(onRebuy).toHaveBeenCalledOnce();
  await userEvent.click(within(ceremony).getByRole('button', { name: 'Back home' }));
  expect(onBack).toHaveBeenCalledOnce();
});

it('BUG-140: desktop result uses terminal stack before an older frame and the actual buy-in', () => {
  renderTable({ game: gameAt(0), buyIn: 2000, sessionEnd: { finalStack: 2600, hands: 5, busted: false } });
  const ceremony = screen.getByRole('status');
  expect(within(ceremony).getByText('YOU WON')).toBeInTheDocument();
  expect(within(ceremony).getByText('+$600')).toBeInTheDocument();
  expect(ceremony.querySelector('.watch-ceremony__stack')).toHaveTextContent('$2,600');
});

it('BUG-141: a queued desktop human sees NEXT HAND and cannot use an opponent turn', () => {
  const onAct = vi.fn();
  const { container } = renderTable({ game: gameAt(1000, { street: 'flop', toAct: 1, waitingForNextHand: true }),
    legalActions: [{ type: 'fold' }, { type: 'call', amount: 40 }], onAct });
  expect(screen.getByText('NEXT HAND', { exact: true })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'FOLD' })).toBeDisabled();
  expect(container.querySelector('.owner-hero')).toBeInTheDocument();
  expect(container.querySelector('.watch-hero__ghost')).toBeNull();
  expect(container.querySelector('.watch-ceremony')).toBeNull();
});

it('BUG-140: closing before a queued human is dealt in reports GAME ENDED without an invented loss', () => {
  renderTable({ game: gameAt(1700, { waitingForNextHand: true }),
    sessionEnd: { reason: 'the table closed before the next deal' } });
  const ceremony = screen.getByRole('status');
  expect(within(ceremony).getByText('GAME ENDED')).toBeInTheDocument();
  expect(within(ceremony).queryByText('YOU LOST')).toBeNull();
  expect(ceremony.querySelector('.watch-ceremony__delta-amt')).toBeNull();
  expect(ceremony.querySelector('.watch-ceremony__stack')).toHaveTextContent('—');
  expect(within(ceremony).getByRole('button', { name: 'Play again' })).toBeInTheDocument();
});

it('BUG-140: DesktopHome forwards a seated human result and rebuy while keeping its shell', async () => {
  const onRebuy = vi.fn(), onLeave = vi.fn();
  const props = { game: gameAt(0), tableConfig: { tableId: 'home-test', sitting: true, buyIn: 1000 },
    mySeat: 1, onRebuy, onLeave, sessionEnd: { reason: 'busted', hands: 4 },
    onCreateAgent: vi.fn(), onWatchAgent: vi.fn(), onDeployAgent: vi.fn() };
  render(<DesktopHome {...props}/>);
  await userEvent.click(screen.getByRole('button', { name: 'Sit at home' }));
  expect(screen.getByText('YOU LOST')).toBeInTheDocument();
  expect(screen.getByTestId('desk-roster')).toBeInTheDocument();
  expect(screen.getByTestId('room-thread')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Play again' }));
  expect(onRebuy).toHaveBeenCalledOnce();
  await userEvent.click(within(screen.getByRole('status')).getByRole('button', { name: 'Back home' }));
  expect(onLeave).toHaveBeenCalledOnce();
  expect(screen.getByRole('button', { name: 'Sit at home' })).toBeInTheDocument();
});

it('BUG-140: watching a home game does not claim the agent result belongs to YOU', async () => {
  render(<DesktopHome game={gameAt(0)} mySeat={-1} tableConfig={{ tableId: 'home-test', sitting: false }}
    sessionEnd={{ reason: 'busted' }} onCreateAgent={vi.fn()} onWatchAgent={vi.fn()} onDeployAgent={vi.fn()}/>);
  await userEvent.click(screen.getByRole('button', { name: 'Watch at home' }));
  expect(screen.queryByText('YOU LOST')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Play again' })).toBeNull();
});
