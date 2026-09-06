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
    const { container } = render(<DeskTableStage game={betweenHandsGame} agentName={HERO} />);
    // DP-1 put the rope under the board, and a rope with nothing to say also
    // reads '—', so the assertion names the pot rather than the whole stage.
    expect(container.querySelector('.dtb__pot-dash')).toHaveTextContent('—');
    expect(screen.queryByText('$0')).not.toBeInTheDocument();
  });

  it('turns every card face down, the hero included', () => {
    render(<DeskTableStage game={betweenHandsGame} agentName={HERO} />);
    expect(cardFaces()).toHaveLength(0);
  });

  // WATCH-6 re-expressed: board 31 gives the strip a permanent Equity column,
  // so the label is always on screen. The rule this test exists for is that
  // there is no stale NUMBER between hands — the readout says nothing rather
  // than repeating the last hand's.
  it('waits for the deal instead of printing a stale equity', () => {
    const { container } = render(<DeskTableStage game={betweenHandsGame} agentName={HERO} />);
    expect(screen.getByText(/waiting for the deal/i)).toBeInTheDocument();
    expect(container.querySelector('.dtb__equity-val').textContent).toBe('—');
  });
});

// ── DP-1 · watch v3 at the desk ─────────────────────────────────────────────
// Ported from D3Watch3ScreenM. The rope and the ladder come from the mobile
// modules (lib/pace.js, system/TugBar.jsx), so these assert the desk renders
// them — not that a second implementation agrees with the first.

describe('DP-1 — the pacing ladder', () => {
  const at = (pace) => ({ ...midHandGame, pace });

  it('is calm by default, and calm is the stage that shipped', () => {
    const { container } = render(<DeskTableStage game={midHandGame} agentName={HERO} />);
    expect(container.querySelector('.dtb')).toHaveAttribute('data-pace', 'calm');
  });

  it('takes the state the server put the table in', () => {
    for (const pace of ['heating', 'allin', 'showdown']) {
      const { container, unmount } = render(<DeskTableStage game={at(pace)} agentName={HERO} />);
      expect(container.querySelector('.dtb')).toHaveAttribute('data-pace', pace);
      unmount();
    }
  });

  it('never infers a state the server did not send', () => {
    const { container } = render(<DeskTableStage game={at('dramatic')} agentName={HERO} />);
    expect(container.querySelector('.dtb')).toHaveAttribute('data-pace', 'calm');
  });

  it('carries a glow layer that takes no pointer and reads to nobody', () => {
    const { container } = render(<DeskTableStage game={at('allin')} agentName={HERO} />);
    const glow = container.querySelector('.dtb__glow');
    expect(glow).toBeTruthy();
    expect(glow).toHaveAttribute('aria-hidden');
  });
});

describe('DP-1 — the rope under the board', () => {
  it('draws the rope on a live hand', () => {
    const { container } = render(
      <DeskTableStage
        game={{ ...midHandGame, heroEquity: 0.71 }}
        agentName={HERO}
      />,
    );
    const tug = container.querySelector('.dtb__tug .tug');
    expect(tug).toBeTruthy();
    expect(screen.getByLabelText(/Hero equity 71 percent/)).toBeInTheDocument();
  });

  // WATCH-6 re-expressed: board 31 moves the rope out of the centre and into
  // HIS column, between him and his strip — the same place the phone puts it.
  // "Directly under the board" was always shorthand for "on the axis between
  // the board and him, never below the fold", and that is what is asserted.
  it('sits between him and his strip, not below the fold', () => {
    const { container } = render(<DeskTableStage game={midHandGame} agentName={HERO} />);
    const hero = container.querySelector('.dtb__hero');
    const kids = [...hero.children].map((el) => el.className);
    expect(kids.indexOf('dtb__hero-body')).toBeLessThan(kids.indexOf('dtb__tug'));
    expect(kids.indexOf('dtb__tug')).toBeLessThan(kids.indexOf('dtb__strip'));
    // And the centre of the felt is the pot and the board and nothing else.
    const centre = [...container.querySelector('.dtb__center').children]
      .map((el) => el.className.split(' ')[0]);
    expect(centre).toEqual(['dtb__pot', 'dtb__board']);
  });

  // Board 31: he is SEATED at the bottom, facing the room, cards in front.
  it('WATCH-6: seats him at the bottom with his cards in front of him', () => {
    const { container } = render(<DeskTableStage game={midHandGame} agentName={HERO} />);
    const body = container.querySelector('.dtb__hero-body');
    expect(body.querySelector('.mood-ghost')).toBeTruthy();
    const cards = body.querySelector('.dtb__hero-cards');
    expect(cards).toBeTruthy();
    // Drawn after him, so they are in front of him and not behind.
    expect(cards.compareDocumentPosition(body.querySelector('.mood-ghost'))
      & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
  });

  it('reads the snapshot first, then falls back to the last decision', () => {
    const { container, rerender } = render(
      <DeskTableStage
        game={{ ...midHandGame, heroEquity: 0.71 }}
        agentName={HERO}
        lastDecision={{ seat: 0, equity: 0.2, action: { type: 'bet', amount: 40 } }}
      />,
    );
    expect(screen.getByLabelText(/Hero equity 71 percent/)).toBeInTheDocument();

    rerender(
      <DeskTableStage
        game={midHandGame}
        agentName={HERO}
        lastDecision={{ seat: 0, equity: 0.2, action: { type: 'bet', amount: 40 } }}
      />,
    );
    expect(screen.getByLabelText(/Hero equity 20 percent/)).toBeInTheDocument();
    expect(container.querySelector('.dtb__tug .tug--dead')).toBeNull();
  });

  it('sits dead centre before the deal rather than empty', () => {
    const { container } = render(<DeskTableStage game={betweenHandsGame} agentName={HERO} />);
    expect(container.querySelector('.dtb__tug .tug--dead')).toBeTruthy();
    expect(screen.getByLabelText(/Equity not known yet/)).toBeInTheDocument();
  });

  it('fattens with the heated half of the ladder, and not before', () => {
    const { container, unmount } = render(
      <DeskTableStage game={{ ...midHandGame, pace: 'heating', heroEquity: 0.6 }} agentName={HERO} />,
    );
    expect(container.querySelector('.tug--big')).toBeTruthy();
    unmount();

    const calm = render(<DeskTableStage game={{ ...midHandGame, heroEquity: 0.6 }} agentName={HERO} />);
    expect(calm.container.querySelector('.tug--big')).toBeNull();
  });
});

describe('DP-1 — his one line', () => {
  const withLine = (over = {}) => (
    <DeskTableStage
      game={midHandGame}
      agentName={HERO}
      lastDecision={{ seat: 0, action: { type: 'bet', amount: 620 }, reasoning: "Now it's a real pot. Good." }}
      {...over}
    />
  );

  it('puts one sentence of thread voice on the stage', () => {
    render(withLine());
    expect(screen.getByText("Now it's a real pot. Good.")).toBeInTheDocument();
  });

  it('says nothing at all when he has not spoken', () => {
    const { container } = render(<DeskTableStage game={midHandGame} agentName={HERO} />);
    expect(container.querySelector('.dtb__line')).toBeNull();
  });

  it('goes quiet between hands — no stale line held over', () => {
    const { container } = render(withLine({ game: betweenHandsGame }));
    expect(container.querySelector('.dtb__line')).toBeNull();
  });

  it('ignores a line that belongs to somebody else at the table', () => {
    const { container } = render(withLine({
      lastDecision: { seat: 1, action: { type: 'call' }, reasoning: 'Not his to say.' },
    }));
    expect(container.querySelector('.dtb__line')).toBeNull();
  });
});
