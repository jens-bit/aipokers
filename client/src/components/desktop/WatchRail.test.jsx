// client/src/components/desktop/WatchRail.test.jsx — ATTR-2e-4
//
// The analysis rail has one job that is easy to get wrong: it must go quiet
// with the stage between hands. A live equity readout left standing over a
// cleared table is a lie about a hand nobody is playing.
//
// It also holds rows open for reads the engine does not produce yet, rather
// than swapping in different content — the DSK2-3 placeholder pattern.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { WatchRail } from './WatchRail.jsx';
import { playingAgent } from '../../test/fixtures/agents.js';
import { midHandGame, betweenHandsGame } from '../../test/fixtures/game.js';

const decision = { seat: 0, equity: 0.874, action: { type: 'bet', amount: 240 }, reasoning: 'He is capped.' };

function renderRail(props = {}) {
  return render(
    <WatchRail
      agent={playingAgent}
      game={midHandGame}
      lastDecision={decision}
      heroSeat={0}
      hands={[]}
      draft=""
      onDraftChange={() => {}}
      onSend={() => {}}
      {...props}
    />,
  );
}

describe('WatchRail mid-hand', () => {
  it('names the agent and says he is at the table', () => {
    renderRail();
    expect(screen.getByText(playingAgent.name)).toBeInTheDocument();
    expect(screen.getByText('AT THE TABLE')).toBeInTheDocument();
  });

  it('reports equity as a percentage, not the raw 0..1 fraction', () => {
    renderRail();
    expect(screen.getByText('87.4%')).toBeInTheDocument();
    expect(screen.queryByText(/0\.874/)).not.toBeInTheDocument();
  });

  // WATCH-6 re-expressed: board 31 puts THE TABLE at the top of the rail, so
  // his line is now in two places on purpose — the record keeps it, and the
  // analysis panel still leads with it. Both are his voice; neither is a
  // paraphrase.
  it('carries his reasoning in his own voice', () => {
    const { container } = renderRail();
    expect(container.querySelector('.dsk-apanel__voice').textContent)
      .toContain('He is capped');
    const row = [...container.querySelectorAll('.thread-row')]
      .find((el) => el.textContent.includes('He is capped'));
    expect(row.querySelector('.thread-row__who').textContent).toBe('HIM');
  });

  it('leads with the record, per board 31', () => {
    const { container } = renderRail();
    const titles = [...container.querySelectorAll('.dsk-apanel .dsk-label')]
      .map((el) => el.textContent);
    expect(titles[0]).toBe('The table');
  });

  it('holds the unmodelled reads open with an em dash rather than hiding them', () => {
    renderRail();
    expect(screen.getByText('Fold equity')).toBeInTheDocument();
    expect(screen.getByText('Solver line')).toBeInTheDocument();
    expect(screen.getByText(/not modelled yet/i)).toBeInTheDocument();
  });
});

describe('WatchRail between hands', () => {
  it('switches the head to BETWEEN HANDS', () => {
    renderRail({ game: betweenHandsGame });
    expect(screen.getByText('BETWEEN HANDS')).toBeInTheDocument();
  });

  it('drops the live reads — there is no hand to have a read on', () => {
    renderRail({ game: betweenHandsGame });
    expect(screen.queryByText('Equity')).not.toBeInTheDocument();
    expect(screen.queryByText('Fold equity')).not.toBeInTheDocument();
  });

  it('shows the session numbers instead', () => {
    renderRail({ game: betweenHandsGame });
    expect(screen.getByText('This session')).toBeInTheDocument();
    expect(screen.getByText('Biggest pot')).toBeInTheDocument();
  });

  it('says so plainly when no hand has finished yet', () => {
    renderRail({ game: betweenHandsGame, hands: [] });
    expect(screen.getByText(/no finished hands this session yet/i)).toBeInTheDocument();
  });
});
