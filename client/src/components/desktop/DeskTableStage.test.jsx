// client/src/components/desktop/DeskTableStage.test.jsx — ATTR-2e-4
//
// The desk stage is the desktop half of the fish-tank law, and of WCM-1's calm.
// Two behaviours are worth pinning:
//   the hero is YOUR agent, so his hole cards are face up while a hand is live;
//   between hands the stage goes quiet rather than showing a zeroed-out table.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { DeskTableStage, phaseOf } from './DeskTableStage.jsx';
import { midHandGame, betweenHandsGame } from '../../test/fixtures/game.js';

const HERO = midHandGame.seats?.[0]?.displayName ?? 'The Grinder';

function cardFaces() {
  // PlayingCard prints its rank as text; CardBack prints nothing.
  return screen.queryAllByText(/^(?:[2-9]|10|[JQKA])$/);
}

describe('DeskTableStage phases', () => {
  it('reads a hand in progress as live', () => {
    expect(phaseOf(midHandGame)).toBe('live');
  });

  it('reads a cleared table as between, not live', () => {
    expect(phaseOf(betweenHandsGame)).toBe('between');
  });

  it('treats a missing game as between rather than throwing', () => {
    expect(phaseOf(null)).toBe('between');
  });
});

describe('DeskTableStage mid-hand', () => {
  it('shows the hero hole cards face up — the fish-tank law', () => {
    render(<DeskTableStage game={midHandGame} agentName={HERO} />);
    expect(cardFaces().length).toBeGreaterThan(0);
  });

  it('names the pot rather than an em dash', () => {
    render(<DeskTableStage game={midHandGame} agentName={HERO} />);
    expect(screen.getByText(`$${midHandGame.pot.toLocaleString()}`)).toBeInTheDocument();
  });

  it('offers the way back to the floor', () => {
    render(<DeskTableStage game={midHandGame} agentName={HERO} />);
    expect(screen.getByRole('button', { name: /back to the floor/i })).toBeInTheDocument();
  });
});

describe('DeskTableStage between hands (WCM-1)', () => {
  it('says the table is shuffling', () => {
    render(<DeskTableStage game={betweenHandsGame} agentName={HERO} />);
    expect(screen.getByText(/shuffling up/i)).toBeInTheDocument();
  });

  it('shows an em dash for the pot instead of $0', () => {
    render(<DeskTableStage game={betweenHandsGame} agentName={HERO} />);
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByText('$0')).not.toBeInTheDocument();
  });

  it('turns every card face down, the hero included', () => {
    render(<DeskTableStage game={betweenHandsGame} agentName={HERO} />);
    expect(cardFaces()).toHaveLength(0);
  });

  it('waits for the deal instead of printing a stale equity', () => {
    render(<DeskTableStage game={betweenHandsGame} agentName={HERO} />);
    expect(screen.getByText(/waiting for the deal/i)).toBeInTheDocument();
    expect(screen.queryByText(/equity/i)).not.toBeInTheDocument();
  });
});
