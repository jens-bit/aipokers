import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeTablePreview } from './HomeTablePreview.jsx';

const game = { tableId: 'home-a', state: 'running', seats: [
  { seat: 0, agentId: 'rock', name: 'Rock' }, { seat: 1, name: 'YOU', house: true },
] };
const agents = [{ id: 'rock', name: 'Rock', mood: { state: 'neutral' }, identity: { hood: 'moss', glow: 'gold' },
  chatHistory: [{ content: 'Private instructions' }] }];

it('BUG-154: a stale table snapshot cannot supply the preview board', () => {
  const { rerender } = render(<HomeTablePreview game={game} agents={agents}
    liveTable={{ config: { tableId: 'old-home' }, game: { community: ['As', 'Ah', 'Kd'] } }} />);
  expect(screen.queryByLabelText(/Community cards/)).not.toBeInTheDocument();
  rerender(<HomeTablePreview game={game} agents={agents}
    liveTable={{ config: { tableId: 'home-a' }, game: { community: ['9h', 'Js', '4c'], holeCards: ['As','Ah'] } }} />);
  expect(screen.getByLabelText('Community cards: 9h Js 4c')).toBeVisible();
  expect(screen.queryByText('A', { exact: true })).not.toBeInTheDocument();
  expect(screen.queryByText('Private instructions')).not.toBeInTheDocument();
});

it('BUG-154: the actual human has a name without a fabricated agent body', () => {
  render(<HomeTablePreview game={game} agents={agents} />);
  expect(screen.getByRole('img', { name: 'YOU' }).querySelector('.mood-ghost')).toBeNull();
  expect(screen.getByRole('img', { name: 'Rock' }).querySelector('.mood-ghost')).not.toBeNull();
  expect(screen.getByRole('img', { name: 'Rock' }).querySelector('.mood-ghost')).toHaveAttribute('data-hood', 'moss');
  expect(screen.getByRole('img', { name: 'Rock' }).querySelector('[fill="#C9A227"]')).not.toBeNull();
});

it('BUG-154: a paused or unconfirmed game does not show the previous hand or occupants', () => {
  render(<HomeTablePreview game={{ ...game, state: 'paused' }} agents={agents}
    liveTable={{ config: { tableId: 'home-a' }, game: { community: ['9h', 'Js', '4c'] } }} />);
  expect(screen.queryAllByRole('img')).toHaveLength(0);
  expect(screen.queryByLabelText(/Community cards/)).not.toBeInTheDocument();
});

it('BUG-144: a held all-in reveals only the staged 3, then 4, then 5 community cards', () => {
  const community = ['5c', '4h', '8c', 'Ks', '2d'];
  const table = { config: { tableId: 'home-a' }, game: { community,
    paceFrame: { pace: 'allin', board: community.slice(0, 3), card: null } } };
  const { rerender } = render(<HomeTablePreview game={game} liveTable={table} agents={agents} />);
  expect(screen.getByLabelText('Community cards: 5c 4h 8c')).toBeVisible();
  expect(screen.queryByText('K', { exact: true })).not.toBeInTheDocument();
  rerender(<HomeTablePreview game={game} liveTable={{ ...table,
    paceFrame: { pace: 'showdown', board: community.slice(0, 4), card: 'Ks' } }} agents={agents} />);
  expect(screen.getByLabelText('Community cards: 5c 4h 8c Ks')).toBeVisible();
  expect(screen.queryByText('2', { exact: true })).not.toBeInTheDocument();
  rerender(<HomeTablePreview game={game} liveTable={{ ...table,
    paceFrame: { pace: 'showdown', board: community, card: '2d' } }} agents={agents} />);
  expect(screen.getByLabelText('Community cards: 5c 4h 8c Ks 2d')).toBeVisible();
});
