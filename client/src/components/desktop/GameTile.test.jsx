// client/src/components/desktop/GameTile.test.jsx — UI-3 job B
//
// JOB B: every live agent's monitor shows his actual hand, not a silhouette.
// `game`/`lastDecision` are the rich per-table WATCH subscription and exist
// only for the one table the owner is watching; `liveGame` is AGE-37's
// compact, owner-scoped projection every live agent carries on the roster
// push regardless of who is watching whom. GameTile must draw a real board,
// pot and whose turn it is from `liveGame` alone when there is no watched
// `game` to prefer.

import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { GameTile, normalizeTile } from './GameTile.jsx';

const watchedGame = {
  seats: [
    { displayName: 'Milo', stack: 1_800, holeCards: ['Ah', 'Kd'] },
    { displayName: 'Rival', stack: 2_200, holeCards: [] },
  ],
  community: ['2c', '7d', 'Jh'],
  pot: 640,
  handNumber: 12,
  street: 'flop',
};
const lastDecision = { seat: 0, action: { type: 'bet', amount: 200 }, reasoning: 'Betting for value.', equity: 0.62 };

const liveGame = {
  heroSeat: 0,
  heroHole: ['Qs', 'Kh'],
  seats: [
    { displayName: 'Milo', stack: 1_500 },
    { displayName: 'Nightjar', stack: 900 },
  ],
  board: ['4h', '9s'],
  pot: 340,
  handNumber: 7,
  street: 'flop',
  toAct: 1,
};

describe('UI-3 job B · the watched monitor is unchanged', () => {
  it('draws the rich per-table payload: hole cards, equity, reasoning', () => {
    const { container } = render(<GameTile game={watchedGame} agentName="Milo" lastDecision={lastDecision} onWatch={() => {}} />);
    expect(screen.getByText('BET 200')).toBeInTheDocument();
    expect(screen.getByText('"Betting for value."')).toBeInTheDocument();
    expect(screen.getByText('62.0%')).toBeInTheDocument();
    expect(container.querySelector('.dsk-tile__meta')).toHaveTextContent('HAND #12');
    expect(container.querySelector('.dsk-tile__opp-name')).toHaveTextContent('Rival · 2,200');
  });
});

describe('UI-3 job B · a live agent nobody is watching is not a silhouette', () => {
  it('draws his real board, pot and hand number from liveGame alone', () => {
    const { container } = render(<GameTile liveGame={liveGame} agentName="Milo" onWatch={() => {}} />);
    expect(container.querySelector('.dsk-tile__pot b')).toHaveTextContent('340');
    expect(container.querySelector('.dsk-tile__meta')).toHaveTextContent('HAND #7');
    expect(container.querySelector('.dsk-tile__opp-name')).toHaveTextContent('Nightjar · 900');
  });

  it('says whose turn it actually is, never a fabricated decision', () => {
    render(<GameTile liveGame={liveGame} agentName="Milo" onWatch={() => {}} />);
    // toAct is the opponent's seat (1) in the fixture.
    expect(screen.getByText("OPPONENT'S TURN")).toBeInTheDocument();
    // No reasoning rides the roster push, so none is invented.
    expect(screen.queryByText(/"/)).not.toBeInTheDocument();
  });

  it('shows his own hole cards — the projection is owner-scoped, so they are really his', () => {
    const { container } = render(<GameTile liveGame={liveGame} agentName="Milo" onWatch={() => {}} />);
    const heroCards = container.querySelectorAll('.dsk-tile__hero .dsk-card--hero');
    expect([...heroCards].map((el) => el.textContent)).toEqual(['Q♠', 'K♥']);
  });

  it('with no live game at all, reads as a true silhouette rather than a guess', () => {
    const { container } = render(<GameTile agentName="Idle" onWatch={() => {}} />);
    expect(container.querySelector('.dsk-tile__meta')).toHaveTextContent('WAITING');
    expect(screen.getByText('THINKING')).toBeInTheDocument();
    expect(container.querySelector('.dsk-tile__pot b')).toHaveTextContent('0');
  });

  it('tapping it still watches him', async () => {
    const onWatch = vi.fn();
    render(<GameTile liveGame={liveGame} agentName="Milo" onWatch={onWatch} />);
    screen.getByRole('button', { name: 'WATCH →' }).click();
    expect(onWatch).toHaveBeenCalledOnce();
  });
});

describe('UI-3 job B · normalizeTile', () => {
  it('prefers the watched game over liveGame when both are somehow present', () => {
    const tile = normalizeTile(watchedGame, liveGame, lastDecision, 'Milo');
    expect(tile.handNumber).toBe(12);
    expect(tile.equityPct).toBe('62.0%');
  });

  it('falls back to liveGame when there is no watched game', () => {
    const tile = normalizeTile(null, liveGame, null, 'Milo');
    expect(tile.pot).toBe(340);
    expect(tile.hero.holeCards).toEqual(['Qs', 'Kh']);
    expect(tile.actionLabel).toBe("OPPONENT'S TURN");
  });

  it('is a true silhouette only when there is nothing live at all', () => {
    const tile = normalizeTile(null, null, null, 'Milo');
    expect(tile.hero).toBeNull();
    expect(tile.pot).toBe(0);
  });
});
