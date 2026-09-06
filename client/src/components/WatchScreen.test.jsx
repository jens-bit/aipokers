// client/src/components/WatchScreen.test.jsx — TEST-1
//
// The fish tank. Watching is passive: the felt reports what the table is
// doing, and the owner — and only the owner — sees their own agent's hole
// cards face up. Between hands the felt holds a calm state rather than
// swapping itself out for a spinner.

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { WatchScreen, feltGeometry } from './WatchScreen.jsx';
import { betweenHandsGame, midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';
import { FLIP_MS } from '../lib/pace.js';
import { resetHaptics } from '../lib/haptics.js';
import { isMuted, play, resetAudio } from '../lib/audio.js';
import { GUESSES, resetPredict } from '../lib/predict.js';

// FIX-3b asserts on rules rather than on layout: jsdom computes neither
// env(safe-area-inset-bottom) nor any height.
const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readCss = (rel) => readFileSync(resolve(clientRoot, rel), 'utf8');
const cssRule = (sheet, selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp(`(?:^|[},])\\s*${escaped}\\s*\\{([^}]*)\\}`, 'm').exec(sheet);
  return found ? found[1] : '';
};

function renderWatch(game, props = {}) {
  return render(
    <WatchScreen
      game={game}
      mySeat={0}
      config={spectatorConfig}
      displayNames={{ 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' }}
      chatMessages={[]}
      sendChat={() => {}}
      onLeave={() => {}}
      onSitOut={() => {}}
      {...props}
    />,
  );
}

// A card face renders its rank as text inside .watch-felt; a card back does
// not. This is how the felt tells "shown" from "face down" on screen.
function faceUpRanks(scope) {
  return [...scope.querySelectorAll('div')]
    .map((el) => (el.children.length === 0 ? el.textContent.trim() : ''))
    .filter((t) => /^(10|[2-9]|[AKQJ])$/.test(t));
}

// Hero on the clock with $40 still to call.
const toActGame = () => ({
  ...midHandGame,
  toAct: 0,
  currentBet: 80,
  seats: midHandGame.seats.map((s, i) => (i === 0 ? { ...s, contribThisStreet: 40 } : s)),
});

// W3-1 pace fixtures. feature/pace puts `pace` and `heroEquity` on the snapshot;
// everything else about the table is the shipped mid-hand fixture.
const paced = (pace, extra = {}) => ({ ...midHandGame, pace, ...extra });

describe('WatchScreen mid-hand', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('names the table it is watching', async () => {
    renderWatch(midHandGame);
    expect(await screen.findByText('The Grinder')).toBeInTheDocument();
  });

  it('renders the board', () => {
    const { container } = renderWatch(midHandGame);
    const board = container.querySelector('.watch-felt__board');
    expect(board).toBeTruthy();
    // Five slots always: three flop cards face up, two backs still to come.
    expect(board.children).toHaveLength(5);
    expect(faceUpRanks(board)).toEqual(['5', '4', '8']);
  });

  it('renders the pot', () => {
    const { container } = renderWatch(midHandGame);
    const pot = container.querySelector('.watch-felt__pot');
    expect(within(pot).getByText('POT')).toBeInTheDocument();
    expect(within(pot).getByText('$100')).toBeInTheDocument();
  });

  // W4-2 re-expressed the last line only. The seat is a SeatGhost now and its
  // chip carries the bare stack, as the refs draw it — the felt is dense and
  // every seat repeating a currency symbol was noise. The rule is unchanged:
  // every opponent is on screen with its stack.
  it('renders every opponent seat with its stack', () => {
    const { container } = renderWatch(midHandGame);
    const seats = container.querySelectorAll('.watch-felt__seat');
    // Hero is the felt's own hero row; the other two seats ring the table.
    expect(seats).toHaveLength(2);
    expect(screen.getByText('Doyle_v3')).toBeInTheDocument();
    expect(screen.getByText('Granite')).toBeInTheDocument();
    // Both opponents are still on 980 after posting their blinds.
    expect(screen.getAllByText('980')).toHaveLength(2);
  });

  // The fish-tank law: the owner watches their own agent play, so the hero's
  // two cards are face up. getPublicState already withholds every other seat's.
  // WATCH-6 re-expressed: his cards are no longer slots in a chrome row. They
  // are face up IN FRONT OF HIM, over the lower part of his body, in the hero
  // column at the bottom edge. The law is untouched; the anchor moved.
  it('shows the hero hole cards face up', () => {
    const { container } = renderWatch(midHandGame);
    const hero = container.querySelector('.watch-hero');
    expect(faceUpRanks(hero)).toEqual(['6', '6']);
  });

  it('WATCH-6: he is seated at the bottom, at twice an opponent seat', () => {
    const { container } = renderWatch(midHandGame);
    const hero = container.querySelector('.watch-hero');
    expect(hero).toBeTruthy();

    const his = hero.querySelector('.mood-ghost');
    const theirs = container.querySelector('.watch-felt__seat .seat-ghost__ghost svg');
    expect(Number(his.getAttribute('width')))
      .toBeGreaterThanOrEqual(2 * Number(theirs.getAttribute('width')));

    // And his cards are drawn after him, so they are in front and not behind.
    const cards = hero.querySelector('.watch-hero__cards');
    expect(cards).toBeTruthy();
    expect(cards.compareDocumentPosition(his) & Node.DOCUMENT_POSITION_PRECEDING)
      .toBeTruthy();
  });

  // The column is a flow: bubble, him, rope, strip, cost. Nothing in it is
  // positioned against the felt, so a two-line bubble moves its neighbours
  // instead of landing on them.
  it('WATCH-6: the hero column is one flow, in the ref\'s order', () => {
    const { container } = renderWatch(midHandGame, {
      lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.5, reasoning: 'He is done.' },
    });
    const hero = container.querySelector('.watch-hero');
    const order = [...hero.children].map((el) => el.className.split(' ')[0]);
    expect(order).toEqual([
      'watch-hero__says', 'watch-hero__body', 'watch-hero__tug', 'glass',
    ]);
  });

  it('keeps the opponents\' hole cards face down', () => {
    const { container } = renderWatch(midHandGame);
    for (const seat of container.querySelectorAll('.watch-felt__seat')) {
      expect(faceUpRanks(seat)).toEqual([]);
    }
  });

  // FIX-1f replaces the old "shows the street and the blinds on the meta line"
  // case. That test encoded a rule the 2026-09-05 playtest reversed: the felt
  // carried "#tbl · $10/$20 · FLOP · 3-HANDED · TO CALL $40" while a hand was
  // live, five facts of which four are already on screen. The line is gone
  // during a hand; the board reports the street, the seat ring reports how many
  // are in, and the price is in the readout. It survives between hands, which
  // is the reference's calm state (design-refs/mood-watch.jsx).
  it('FIX-1f: shows no meta line on the felt while a hand is live', () => {
    const { container } = renderWatch(midHandGame);
    expect(container.querySelector('.watch-felt__street')).toBeNull();
  });

  it('FIX-1f: keeps the calm meta line between hands', () => {
    const { container } = renderWatch(betweenHandsGame);
    const meta = container.querySelector('.watch-felt__street');
    expect(meta).toBeTruthy();
    expect(meta.textContent).toContain('$10/$20');
    expect(meta.textContent).toContain('SHUFFLING');
    expect(meta.textContent).not.toContain('HANDED');
  });

  // W3-1 moves the price once more, out of the action chip and into its own
  // column of the hero row — HeroRow3's "To call" slot, which is where the ref
  // puts it. FIX-1f's rule holds: when there is a price to pay, it is on screen.
  it('W3-1: the hero row names the price when it is the hero\'s turn', () => {
    const { container } = renderWatch(toActGame());
    const labels = [...container.querySelectorAll('.watch-felt__hero-lbl')].map((el) => el.textContent);
    expect(labels).toContain('To call');
    expect(container.querySelector('.watch-felt__hero-num.is-gold').textContent).toBe('$40');
    // The chip names the action; the arithmetic has its own column now.
    expect(container.querySelector('.watch-felt__action-chip').textContent).toBe('TO ACT');
  });

  it('W3-1: the same column shows the street when nothing is owed', () => {
    const { container } = renderWatch(midHandGame);
    const labels = [...container.querySelectorAll('.watch-felt__hero-lbl')].map((el) => el.textContent);
    expect(labels).toContain('Street');
    expect(container.querySelector('.watch-felt__hero-num.is-dim').textContent).toBe('FLOP');
  });

  // FIX-1g. The readout showed an em dash for the whole of the hero's turn —
  // the one moment the owner is watching it. The server knows his equity before
  // he acts, so the last number it sent for this hand stands until a newer one
  // lands, and a dash now means only "nothing dealt yet".
  describe('FIX-1g hero equity', () => {
    // W3-1: equity is no longer a column in the hero row — finding 2 moved it
    // onto the rope under the board, where a non-poker player can read it.
    // FIX-1g's rule is unchanged and follows it there.
    const equityText = (container) => container.querySelector('.tug__value').textContent;

    it('FIX-1g: shows the equity the server sent with the last decision', () => {
      const { container } = renderWatch(midHandGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });
      expect(equityText(container)).toBe('67%');
    });

    it('FIX-1g: holds that number while the hero is asked to act again', () => {
      const { container, rerender } = renderWatch(midHandGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });

      // The turn lands and the hero is on the clock with no decision on the
      // wire yet — lastDecision is null. Same hand, so the read still stands.
      // This is exactly where the dash used to appear.
      rerender(
        <WatchScreen
          game={{ ...midHandGame, street: 'turn', toAct: 0, community: ['5c', '4h', '8c', 'Kd'] }}
          mySeat={0}
          config={spectatorConfig}
          displayNames={{ 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' }}
          chatMessages={[]}
          lastDecision={null}
          sendChat={() => {}}
          onLeave={() => {}}
          onSitOut={() => {}}
        />,
      );

      expect(container.querySelector('.watch-felt__action-chip')).toBeTruthy();
      expect(equityText(container)).toBe('67%');
    });

    it('FIX-1g: forgets the read when the next hand is dealt', () => {
      const { container, rerender } = renderWatch(midHandGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });

      rerender(
        <WatchScreen
          game={{ ...midHandGame, handNumber: 2, toAct: 0 }}
          mySeat={0}
          config={spectatorConfig}
          displayNames={{ 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' }}
          chatMessages={[]}
          lastDecision={null}
          sendChat={() => {}}
          onLeave={() => {}}
          onSitOut={() => {}}
        />,
      );

      expect(equityText(container)).toBe('—');
    });

    it('FIX-1g: dashes before the deal, and only there', () => {
      const { container } = renderWatch(betweenHandsGame, {
        lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674 },
      });
      expect(equityText(container)).toBe('—');
    });

    it('FIX-1g: dashes on a hand that has produced no read yet', () => {
      const { container } = renderWatch(midHandGame);
      expect(equityText(container)).toBe('—');
    });
  });

  // Replaces "appends the agent's decision to the feed with its equity as a
  // percentage". W3-2 removes the LIVE ANALYSIS tab, which was the decision
  // feed's only home and the only place that printed 67.4% — the solver stack
  // finding 3 kills. What a decision still owes the screen is unchanged and
  // asserted here: his sentence, and his equity on the rope.
  // FIX-3a retunes this. His equity is unconditional — it is the rope. His line
  // is not: on a short felt the geometry has no room for it between the board
  // and the rope, and it is suppressed there rather than drawn through the rope.
  // It still reaches the owner in the sheet's peek row and in the thread.
  it('W3-2: a decision reaches the felt as his equity, always', async () => {
    const { container } = renderWatch(midHandGame, {
      lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.674, reasoning: 'Set. Charging the draws.' },
    });
    await screen.findByText('The Grinder');
    // WV2-2: the wire carries equity as a 0..1 fraction, not a percent.
    expect(container.querySelector('.tug__value').textContent).toBe('67%');
  });
});

// ── W3-1 · the pacing ladder and the rope ───────────────────────────────────
// Playtest 2026-09-05: "a simulation, not a game." The felt had one state — a
// $60 pot and a $3,694 pot were drawn identically — and the money on the line
// was a 12.5px number in a corner. Four server-driven states and a rope.

describe('W3-1 pacing states', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  const felt = (container) => container.querySelector('.watch-felt');

  it('W3-1: a snapshot with no pace field reads as calm', () => {
    const { container } = renderWatch(midHandGame);
    expect(felt(container).dataset.pace).toBe('calm');
    // CALM is the felt that shipped: no glow overlay at all.
    expect(container.querySelector('.watch-felt__glow')).toBeNull();
  });

  it('W3-1: an unrecognised pace still reads as calm', () => {
    const { container } = renderWatch(paced('on-fire'));
    expect(felt(container).dataset.pace).toBe('calm');
  });

  for (const state of ['heating', 'allin', 'showdown']) {
    it(`W3-1: the felt carries the ${state} state and its glow`, () => {
      const { container } = renderWatch(paced(state));
      expect(felt(container).dataset.pace).toBe(state);
      expect(container.querySelector('.watch-felt__glow')).toBeTruthy();
    });
  }

  it('W3-1: only ALL-IN puts the holding tag on the hero row', () => {
    const { container } = renderWatch(paced('allin'));
    expect(container.querySelector('.watch-felt__hero-tag')).toBeTruthy();

    const calm = renderWatch(paced('calm'));
    expect(calm.container.querySelector('.watch-felt__hero-tag')).toBeNull();
  });

  it('W3-1: the runout is dealt one card at a time on a showdown', () => {
    vi.useFakeTimers();
    try {
      const river = { ...paced('showdown'), community: ['5c', '4h', '8c', 'Kd', '2s'] };
      const { container } = renderWatch(river);
      const board = () => container.querySelector('.watch-felt__board');

      // The reveal starts closed — nothing has flipped yet.
      expect(faceUpRanks(board())).toEqual([]);

      act(() => { vi.advanceTimersByTime(FLIP_MS); });
      expect(faceUpRanks(board())).toEqual(['5']);

      act(() => { vi.advanceTimersByTime(FLIP_MS * 2); });
      expect(faceUpRanks(board())).toEqual(['5', '4', '8']);

      act(() => { vi.advanceTimersByTime(FLIP_MS * 2); });
      expect(faceUpRanks(board())).toEqual(['5', '4', '8', 'K', '2']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('W3-1: every dealt card is face up when the pace is not a showdown', () => {
    const { container } = renderWatch({ ...midHandGame, community: ['5c', '4h', '8c', 'Kd'] });
    expect(faceUpRanks(container.querySelector('.watch-felt__board'))).toEqual(['5', '4', '8', 'K']);
  });
});

describe('W3-1 the rope', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('W3-1: draws hero equity from the snapshot, on every frame', () => {
    const { container } = renderWatch(paced('calm', { heroEquity: 0.71 }));
    expect(container.querySelector('.tug__value').textContent).toBe('71%');
  });

  it('W3-1: the snapshot beats the last decision', () => {
    const { container } = renderWatch(paced('calm', { heroEquity: 0.71 }), {
      lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.30 },
    });
    expect(container.querySelector('.tug__value').textContent).toBe('71%');
  });

  it('W3-1: the seam sits where his equity is', () => {
    const { container } = renderWatch(paced('calm', { heroEquity: 0.71 }));
    expect(container.querySelector('.tug__fill').style.width).toBe('71%');
  });

  it('W3-1: before the deal the rope sits dead centre rather than empty', () => {
    const { container } = renderWatch(betweenHandsGame);
    const tug = container.querySelector('.tug');
    expect(tug.className).toContain('tug--dead');
    expect(container.querySelector('.tug__fill').style.width).toBe('50%');
    expect(container.querySelector('.tug__value').textContent).toBe('—');
  });

  it('W3-1: names the one live opponent and nobody else', () => {
    const heads = {
      ...midHandGame,
      seats: midHandGame.seats.map((s, i) => (i === 2 ? { ...s, folded: true } : s)),
      heroEquity: 0.64,
    };
    const { container } = renderWatch(heads);
    expect(container.querySelector('.tug__villain').textContent).toBe('DOYLE_V3');

    // Three-handed and both still in: the owner is watching his agent, not
    // refereeing, so the far end stays unlabelled.
    const multi = renderWatch(paced('calm', { heroEquity: 0.64 }));
    expect(multi.container.querySelector('.tug__villain')).toBeNull();
  });

  it('W3-1: the rope goes fat while the pot is heated', () => {
    const { container } = renderWatch(paced('heating', { heroEquity: 0.71 }));
    expect(container.querySelector('.tug').className).toContain('tug--big');

    const calm = renderWatch(paced('calm', { heroEquity: 0.71 }));
    expect(calm.container.querySelector('.tug').className).not.toContain('tug--big');
  });
});

// ── W3-2 · two tabs, and READ ───────────────────────────────────────────────

describe('W3-2 the panel', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  // WATCH-6 re-expressed: there is no tab bar to count tabs in. The felt fills
  // the screen and the one list there ever was — the record — is a glass layer
  // over its lower 70%. What W3-2/W4-2 protect is that NOTHING ELSE has crept
  // back under the felt, and that is asserted directly.
  it('W4-2: there is no tab bar under the felt at all', () => {
    const { container } = renderWatch(midHandGame);
    expect(container.querySelector('.watch-tabs')).toBeNull();
    expect(container.querySelector('.watch-sheet')).toBeNull();
    // Header, felt, composer. Nothing else.
    const shell = [...container.querySelector('.watch-screen').children]
      .map((el) => el.className.split(' ')[0]);
    expect(shell).toEqual(['watch-screen__header', 'watch-felt', 'watch-composer']);
  });

  it('W3-2: RANGE, HISTORY and ANALYSIS are gone, not hidden', () => {
    const { container } = renderWatch(midHandGame);
    const text = container.textContent.toLowerCase();
    expect(text).not.toContain('range');
    expect(text).not.toContain('analysis');
    expect(screen.queryByText('Range analysis coming soon.')).not.toBeInTheDocument();
    expect(screen.queryByText('No hands played yet.')).not.toBeInTheDocument();
  });

  it('W4-2: the record opens over the felt, and the reads are not in it', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch(midHandGame);
    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(container.querySelector('.thread-sheet')).toBeTruthy();
    // The reads are not in the record; they open on a seat tap, in the same
    // glass, over the same 70%.
    expect(container.querySelector('.read-panel')).toBeNull();
  });

  it('W3-2: nothing anywhere says it is waiting for the first action', () => {
    renderWatch(midHandGame);
    expect(screen.queryByText(/waiting for (the )?first action/i)).not.toBeInTheDocument();
  });

  it('W3-2: the Chat action still reaches the record', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch(midHandGame);
    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(container.querySelector('.thread-sheet')).toBeTruthy();
    expect(container.querySelector('.read-panel')).toBeNull();
  });
});

// ── W3-5 · the shape the server actually sends ──────────────────────────────
//
// W3-2 was written against a guessed contract: one opponent, stats in a map,
// `conf` as a ± half-width in points. All three were wrong. The fixtures below
// are readPanel() output from feature/pace @ 5a7832d — the same function
// src/server/table.js _readsFor() calls — dumped once per classifyOpponent
// shape, plus the two evidence states.

const READ_FIXTURE = {
  station: {
    playerId: 'p_house', displayName: 'House', seat: 1, handsObserved: 63,
    gate: 8.8, formed: true, shape: 'station',
    line: 'He calls everything. I stop bluffing and start charging him.',
    rows: [
      { k: 'vpip', label: 'PLAYS', value: 96, confidence: 1, formed: true },
      { k: 'pfr', label: 'RAISES FIRST', value: 4, confidence: 1, formed: true },
      { k: 'aggr', label: 'AGGRESSION', value: 7, confidence: 1, formed: true },
      { k: 'fold', label: 'FOLDS TO HEAT', value: 6, confidence: 1, formed: true },
      { k: 'sd', label: 'GOES TO SHOWDOWN', value: 71, confidence: 1, formed: true },
    ],
  },
  maniac: {
    playerId: 'p_doyle', displayName: 'doyle_v3', seat: 1, handsObserved: 48,
    gate: 8.8, formed: true, shape: 'maniac',
    line: 'He never stops firing. I let him bet my good hands for me.',
    rows: [
      { k: 'vpip', label: 'PLAYS', value: 61, confidence: 1, formed: true },
      { k: 'pfr', label: 'RAISES FIRST', value: 44, confidence: 1, formed: true },
      { k: 'aggr', label: 'AGGRESSION', value: 100, confidence: 1, formed: true },
      { k: 'fold', label: 'FOLDS TO HEAT', value: 22, confidence: 1, formed: true },
      { k: 'sd', label: 'GOES TO SHOWDOWN', value: 38, confidence: 1, formed: true },
    ],
  },
  nit: {
    playerId: 'p_granite', displayName: 'Granite', seat: 2, handsObserved: 142,
    gate: 8.8, formed: true, shape: 'nit',
    line: 'He folds far too often. That is where the money is.',
    rows: [
      { k: 'vpip', label: 'PLAYS', value: 14, confidence: 1, formed: true },
      { k: 'pfr', label: 'RAISES FIRST', value: 9, confidence: 1, formed: true },
      { k: 'aggr', label: 'AGGRESSION', value: 37, confidence: 1, formed: true },
      { k: 'fold', label: 'FOLDS TO HEAT', value: 62, confidence: 1, formed: true },
      { k: 'sd', label: 'GOES TO SHOWDOWN', value: 21, confidence: 1, formed: true },
    ],
  },
  tag: {
    playerId: 'p_nash', displayName: 'Nash_EQ', seat: 2, handsObserved: 210,
    gate: 8.8, formed: true, shape: 'tag',
    line: 'He is a real player. No heroics against this one.',
    rows: [
      { k: 'vpip', label: 'PLAYS', value: 24, confidence: 1, formed: true },
      { k: 'pfr', label: 'RAISES FIRST', value: 19, confidence: 1, formed: true },
      { k: 'aggr', label: 'AGGRESSION', value: 87, confidence: 1, formed: true },
      { k: 'fold', label: 'FOLDS TO HEAT', value: 41, confidence: 1, formed: true },
      { k: 'sd', label: 'GOES TO SHOWDOWN', value: 29, confidence: 1, formed: true },
    ],
  },
  // Seen, but under the gate: numbers on the bars, nothing claimed.
  filling: {
    playerId: 'p_new', displayName: 'newcomer', seat: 1, handsObserved: 4,
    gate: 8.8, formed: false, shape: null, line: null,
    rows: [
      { k: 'vpip', label: 'PLAYS', value: 33, confidence: 0.15, formed: false },
      { k: 'pfr', label: 'RAISES FIRST', value: 12, confidence: 0.15, formed: false },
      { k: 'aggr', label: 'AGGRESSION', value: 47, confidence: 0.15, formed: false },
      { k: 'fold', label: 'FOLDS TO HEAT', value: 38, confidence: 0.15, formed: false },
      { k: 'sd', label: 'GOES TO SHOWDOWN', value: 30, confidence: 0.15, formed: false },
    ],
  },
  // Nobody has sat down with him yet.
  fresh: {
    playerId: null, displayName: null, seat: 1, handsObserved: 0,
    gate: 8.8, formed: false, shape: null, line: null,
    rows: [
      { k: 'vpip', label: 'PLAYS', value: null, confidence: 0, formed: false },
      { k: 'pfr', label: 'RAISES FIRST', value: null, confidence: 0, formed: false },
      { k: 'aggr', label: 'AGGRESSION', value: null, confidence: 0, formed: false },
      { k: 'fold', label: 'FOLDS TO HEAT', value: null, confidence: 0, formed: false },
      { k: 'sd', label: 'GOES TO SHOWDOWN', value: null, confidence: 0, formed: false },
    ],
  },
};

// W4-2 re-expressed these: the READ tab is gone, because a read is about ONE
// person and the way you ask for it is to tap them. Every rule the block
// encodes is unchanged — the five rows in canon order, the server's own values
// and labels, the bracket that widens with a thin read, the gate deciding
// `formed`, the no-evidence state that claims nothing. What changed is the
// gesture that opens them and the two class names the sheet renamed
// (.read-sheet__name/__line -> .read-sheet__name/__line).
describe('W3-5 the served read shape, in the sheet', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  const withReads = (reads) => ({ ...midHandGame, reads });

  // Tap the seat the read belongs to. Hero is seat 0 and the ghosts ring the
  // table clockwise from him, so ghost n is seat n+1. `scope` matters: a case
  // that renders twice would otherwise tap the first render's ghost.
  const openRead = (seat = 1, scope = document) => {
    const ghost = [...scope.querySelectorAll('.seat-ghost')][seat - 1];
    if (ghost) fireEvent.click(ghost);
  };
  const openReadFor = (entry, scope) => openRead(entry.seat, scope);

  const rowFor = (container, label) =>
    [...container.querySelectorAll('.read-bar')]
      .find((el) => el.querySelector('.read-bar__label').textContent === label);

  it('W3-5: draws the five rows in canon order with no reads at all', () => {
    const { container } = renderWatch(midHandGame);
    openRead();
    expect([...container.querySelectorAll('.read-bar__label')].map((el) => el.textContent))
      .toEqual(['PLAYS', 'RAISES FIRST', 'AGGRESSION', 'FOLDS TO HEAT', 'GOES TO SHOWDOWN']);
  });

  it('W3-5: with no evidence he says so himself, and no bar claims a number', () => {
    const { container } = renderWatch(withReads([READ_FIXTURE.fresh]));
    openRead();
    expect(screen.getByText('NO EVIDENCE YET')).toBeInTheDocument();
    expect(screen.getByText(/Give me a few hands/)).toBeInTheDocument();
    expect([...container.querySelectorAll('.read-bar__value')].map((el) => el.textContent))
      .toEqual(['··', '··', '··', '··', '··']);
    expect(container.querySelector('.read-bar__fill')).toBeNull();
    // No evidence, no bracket: the bar does not draw a range around a number it
    // does not have.
    expect(container.querySelector('.read-bar__band')).toBeNull();
  });

  // One case per classifyOpponent shape, on the server's own output.
  for (const shape of ['station', 'maniac', 'nit', 'tag']) {
    it(`W3-5: renders the ${shape} panel the server sent`, () => {
      const entry = READ_FIXTURE[shape];
      const { container } = renderWatch(withReads([entry]));
      openReadFor(entry);

      expect(container.querySelector('.read-sheet__name').textContent).toBe(entry.displayName);
      expect(screen.getByText(`${entry.handsObserved} HANDS SEEN`)).toBeInTheDocument();
      // The line is his, and it is the server's — never composed here.
      expect(container.querySelector('.read-sheet__line').textContent).toContain(entry.line);

      for (const row of entry.rows) {
        const el = rowFor(container, row.label);
        expect(el.querySelector('.read-bar__value').textContent).toBe(String(row.value));
        expect(el.querySelector('.read-bar__fill').style.width).toBe(`${row.value}%`);
        expect(el.className).toContain('read-bar--formed');
      }
    });
  }

  // The one value the client has to interpret rather than echo.
  it('W3-5: confidence is a certainty, so a full read draws no bracket', () => {
    const { container } = renderWatch(withReads([READ_FIXTURE.nit]));
    openReadFor(READ_FIXTURE.nit);
    // confidence 1 — as sure as the model gets. The bracket has closed to a
    // number, which is where "narrows with hands" ends.
    expect(container.querySelector('.read-bar__band')).toBeNull();
  });

  it('W3-5: a thin read draws a wide bracket around its number', () => {
    const { container } = renderWatch(withReads([READ_FIXTURE.filling]));
    openReadFor(READ_FIXTURE.filling);
    const plays = rowFor(container, 'PLAYS');
    // confidence 0.15 → 12 * 0.85 ≈ 10 points either side of 33.
    expect(plays.querySelector('.read-bar__band').style.left).toBe('23%');
    expect(plays.querySelector('.read-bar__band').style.width).toBe('20%');
  });

  it('W3-5: the gate decides formed, and the gate is the server\'s', () => {
    // 4 hands against a gate of 8.8: numbers on the bars, nothing claimed.
    const thin = renderWatch(withReads([READ_FIXTURE.filling]));
    openReadFor(READ_FIXTURE.filling, thin.container);
    expect(rowFor(thin.container, 'PLAYS').className).not.toContain('read-bar--formed');
    expect(thin.container.querySelector('.read-sheet__line').textContent).toContain('Give me a few hands');

    const formed = renderWatch(withReads([READ_FIXTURE.station]));
    openReadFor(READ_FIXTURE.station, formed.container);
    expect(rowFor(formed.container, 'PLAYS').className).toContain('read-bar--formed');
  });

  // The server has no `forming` flag — _maybeBroadcastReads() simply stops
  // sending once nothing has changed — so the client notices the transition.
  it('W3-5: a read announces itself when it forms, and settles after', () => {
    vi.useFakeTimers();
    try {
      // He is still counting: unformed, so nothing is announced.
      const unformed = { ...READ_FIXTURE.station, formed: false, line: null, handsObserved: 4 };
      const { container, rerender } = renderWatch(withReads([unformed]));
      // W4-2: the read lives in the sheet now, so the announcement does too.
      openReadFor(unformed, container);
      expect(container.querySelector('.read-sheet__line').className).not.toContain('is-forming');

      // The next snapshot has it formed. That is the event.
      const rerenderWith = (reads) => rerender(
        <WatchScreen game={withReads(reads)} mySeat={0} config={spectatorConfig}
          displayNames={{}} chatMessages={[]} sendChat={() => {}} onLeave={() => {}} onSitOut={() => {}} />,
      );
      act(() => { rerenderWith([READ_FIXTURE.station]); });
      expect(container.querySelector('.read-sheet__line').className).toContain('is-forming');

      // And then it is just his read, not a badge.
      act(() => { vi.advanceTimersByTime(5000); });
      expect(container.querySelector('.read-sheet__line').className).not.toContain('is-forming');
    } finally {
      vi.useRealTimers();
    }
  });

  it('W3-5: a read that was already formed when the screen opened is not an event', () => {
    const { container } = renderWatch(withReads([READ_FIXTURE.station]));
    openReadFor(READ_FIXTURE.station);
    expect(container.querySelector('.read-sheet__line').className).not.toContain('is-forming');
  });

  it('W3-5: a short or reordered rows array still draws five in canon order', () => {
    const { container } = renderWatch(withReads([{
      ...READ_FIXTURE.station,
      rows: [
        { k: 'sd', label: 'GOES TO SHOWDOWN', value: 71, confidence: 1, formed: true },
        { k: 'vpip', label: 'PLAYS', value: 96, confidence: 1, formed: true },
      ],
    }]));
    openRead(READ_FIXTURE.station.seat);
    expect([...container.querySelectorAll('.read-bar__label')].map((el) => el.textContent))
      .toEqual(['PLAYS', 'RAISES FIRST', 'AGGRESSION', 'FOLDS TO HEAT', 'GOES TO SHOWDOWN']);
    expect(rowFor(container, 'AGGRESSION').querySelector('.read-bar__value').textContent).toBe('··');
  });
});

// W4-2 replaced the rule this block used to encode. The panel no longer PICKS
// an opponent for you — it never had a good answer, and pickOpponent's own
// heuristics (live before folded, then most observed) are still covered
// directly in lib/reads.test.jsx. On the felt the choice is now the owner's:
// you tap a seat and you get THAT seat's read, whoever the server would have
// picked. These cases assert the replacement.
describe('W4-2 choosing whose read to see', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  const who = (container) => container.querySelector('.read-sheet__name').textContent;
  const tap = (container, seat) => {
    const ghost = [...container.querySelectorAll('.seat-ghost')][seat - 1];
    fireEvent.click(ghost);
  };

  const twoReads = {
    ...midHandGame,
    reads: [
      { ...READ_FIXTURE.maniac, seat: 1 },
      { ...READ_FIXTURE.tag, seat: 2 },
    ],
  };

  it('W4-2: nothing is open until a seat is tapped', () => {
    const { container } = renderWatch(twoReads);
    expect(container.querySelector('.read-sheet')).toBeNull();
  });

  it(`W4-2: tapping a seat opens that seat's read, not the most observed`, () => {
    // Nash has 210 hands behind him and would win any auto-pick. The owner
    // asked about Doyle, so the sheet is about Doyle.
    const { container } = renderWatch(twoReads);
    tap(container, 1);
    expect(who(container)).toBe('doyle_v3');
  });

  it('W4-2: tapping the other seat swaps the read', () => {
    const { container } = renderWatch(twoReads);
    tap(container, 1);
    expect(who(container)).toBe('doyle_v3');
    tap(container, 2);
    expect(who(container)).toBe('Nash_EQ');
  });

  it('W4-2: a folded seat can still be read — folding does not hide him', () => {
    const game = {
      ...twoReads,
      seats: midHandGame.seats.map((s, i) => (i === 2 ? { ...s, folded: true } : s)),
    };
    const { container } = renderWatch(game);
    tap(container, 2);
    expect(who(container)).toBe('Nash_EQ');
  });

  it('W4-2: tapping the same seat again closes it', () => {
    const { container } = renderWatch(twoReads);
    tap(container, 1);
    expect(container.querySelector('.read-sheet')).toBeTruthy();
    tap(container, 1);
    expect(container.querySelector('.read-sheet')).toBeNull();
  });

  it('W4-2: a seat the server sent no read for opens and says so, rather than crashing', () => {
    const { container } = renderWatch({ ...midHandGame, reads: [] });
    tap(container, 1);
    expect(container.querySelector('.read-sheet')).toBeTruthy();
    expect(screen.getByText('NO EVIDENCE YET')).toBeInTheDocument();
  });
});

describe('W3-5 the staged runout', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  const river = { ...midHandGame, pace: 'showdown', community: ['5c', '4h', '8c', 'Kd', '2s'] };
  const board = (container) => container.querySelector('.watch-felt__board');

  it('W3-5: the PACE frame decides what is face up, not a local clock', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(river, {
        paceFrame: { pace: 'showdown', board: ['5c', '4h', '8c'], card: '8c' },
      });
      expect(faceUpRanks(board(container))).toEqual(['5', '4', '8']);

      // Nothing moves on its own: the server is driving, so every watcher sees
      // the same card at the same moment.
      act(() => { vi.advanceTimersByTime(FLIP_MS * 5); });
      expect(faceUpRanks(board(container))).toEqual(['5', '4', '8']);

      // The next frame turns the next card.
      rerender(
        <WatchScreen game={river} mySeat={0} config={spectatorConfig} displayNames={{}}
          chatMessages={[]} sendChat={() => {}} onLeave={() => {}} onSitOut={() => {}}
          paceFrame={{ pace: 'showdown', board: ['5c', '4h', '8c', 'Kd'], card: 'Kd' }} />,
      );
      expect(faceUpRanks(board(container))).toEqual(['5', '4', '8', 'K']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('W3-5: falls back to the local flip when no frame arrives', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(river);
      expect(faceUpRanks(board(container))).toEqual([]);
      act(() => { vi.advanceTimersByTime(FLIP_MS * 3); });
      expect(faceUpRanks(board(container))).toEqual(['5', '4', '8']);
    } finally {
      vi.useRealTimers();
    }
  });

  // W3-6: useTable merges the frame onto the view model, so the felt follows the
  // server without every container between them forwarding a prop.
  it('W3-6: the felt follows a frame carried on the game', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch({
        ...river,
        paceFrame: { pace: 'showdown', board: ['5c', '4h', '8c', 'Kd'], card: 'Kd' },
      });
      expect(faceUpRanks(board(container))).toEqual(['5', '4', '8', 'K']);
      act(() => { vi.advanceTimersByTime(FLIP_MS * 5); });
      expect(faceUpRanks(board(container))).toEqual(['5', '4', '8', 'K']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('W3-6: an explicit prop still wins over the one on the game', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(
        { ...river, paceFrame: { pace: 'showdown', board: ['5c'], card: '5c' } },
        { paceFrame: { pace: 'showdown', board: ['5c', '4h', '8c'], card: '8c' } },
      );
      expect(faceUpRanks(board(container))).toEqual(['5', '4', '8']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('W3-5: a frame with no board defers to the fallback', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(river, { paceFrame: { pace: 'showdown', card: '2s' } });
      act(() => { vi.advanceTimersByTime(FLIP_MS); });
      expect(faceUpRanks(board(container))).toEqual(['5']);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('W3-3 the beats', () => {
  let haptics;

  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    resetHaptics();
    resetAudio();
    haptics = [];
    window.Telegram.WebApp.HapticFeedback = {
      impactOccurred: (style) => haptics.push(['impact', style]),
      notificationOccurred: (style) => haptics.push(['notification', style]),
      selectionChanged: () => haptics.push(['selection', null]),
    };
  });

  it('W3-3: a calm hand is silent', () => {
    renderWatch(midHandGame);
    expect(haptics).toEqual([]);
  });

  it('W3-3: entering HEATING taps once, and never again for the same hand', () => {
    const { rerender } = renderWatch(paced('heating'));
    expect(haptics).toEqual([['impact', 'rigid']]);

    // Same hand, another snapshot: the ladder does not re-announce itself.
    rerender(
      <WatchScreen game={paced('heating', { pot: 1400 })} mySeat={0} config={spectatorConfig}
        displayNames={{}} chatMessages={[]} sendChat={() => {}} onLeave={() => {}} onSitOut={() => {}} />,
    );
    expect(haptics).toEqual([['impact', 'rigid']]);
  });

  it('W3-3: ALL-IN is the loudest thing on the screen', () => {
    renderWatch(paced('allin'));
    expect(haptics).toEqual([['notification', 'warning']]);
  });

  it('W3-3: winning the pot is a success, losing it is quiet', () => {
    const won = {
      ...midHandGame, street: 'complete',
      result: { pot: 400, winners: [{ seat: 0 }] },
    };
    renderWatch(won);
    expect(haptics).toEqual([['notification', 'success']]);

    haptics.length = 0;
    resetHaptics();
    const lost = { ...won, handNumber: 2, result: { pot: 400, winners: [{ seat: 1 }] } };
    renderWatch(lost);
    // A soft tap, and — per lib/audio — no sound at all.
    expect(haptics).toEqual([['impact', 'soft']]);
    expect(play('lostPot')).toBeNull();
  });

  it('W3-3: an opponent acting never reaches the device', () => {
    // The screen is only ever handed the hero's decision; there is no code path
    // and no table entry for anyone else's.
    renderWatch({ ...midHandGame, toAct: 1 });
    expect(haptics).toEqual([]);
  });

  // WATCH-6 re-expressed: there is no panel under the felt. The switch is in
  // the record's own head — one tap from anywhere on the screen, and no longer
  // a grey row on a green table.
  it('W3-3: the record carries a sound switch, and it remembers', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch(midHandGame);
    await user.click(screen.getByRole('button', { name: 'Chat' }));

    const toggle = screen.getByRole('button', { name: /sound on/i });
    expect(isMuted()).toBe(false);

    await user.click(toggle);
    expect(isMuted()).toBe(true);
    expect(screen.getByRole('button', { name: /sound off/i })).toBeInTheDocument();
    expect(container.querySelector('.watch-mute').className).toContain('is-muted');
  });
});

// ── W3-4 · the prediction beat, behind its flag ─────────────────────────────

describe('W3-4 the prediction beat', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    resetPredict();
    try { window.localStorage.clear(); } catch { /* private window */ }
  });

  const enable = () => window.localStorage.setItem('ap_predict', '1');

  // WATCH-6: the felt is the performance and nothing but the game is drawn on
  // it, so the beat moved with the rest of the furniture into the record.
  // Opening it is what these tests do first; the flag is still the gate.
  const openRecord = () => {
    act(() => { screen.getByRole('button', { name: 'Chat' }).click(); });
  };

  it('W3-4: is absent unless the flag is set', () => {
    const { container } = renderWatch(midHandGame);
    openRecord();
    expect(container.querySelector('.predict')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Raise' })).not.toBeInTheDocument();
  });

  it('W3-4: appears in the record with the flag on, framed as a bet on him', () => {
    enable();
    const { container } = renderWatch(midHandGame);
    openRecord();
    expect(container.querySelector('.predict')).toBeTruthy();
    // The verb is his. This is not a control the owner is operating.
    expect(screen.getByText('He’s going to…')).toBeInTheDocument();
    expect(GUESSES.every((g) => screen.getByRole('button', { name: g }))).toBe(true);
  });

  it('W3-4: picking a chip marks it and nothing else', async () => {
    enable();
    const user = userEvent.setup();
    const { container } = renderWatch(midHandGame);
    openRecord();

    await user.click(screen.getByRole('button', { name: 'Raise' }));
    const chips = [...container.querySelectorAll('.predict__chip')];
    expect(chips.map((c) => c.className.includes('is-picked'))).toEqual([false, false, true]);
    // Nothing is spent and nothing is locked until he acts.
    expect(chips.every((c) => !c.disabled)).toBe(true);
  });

  it('W3-4: the chips lock the moment he acts, and a right call extends the streak', async () => {
    enable();
    const user = userEvent.setup();
    const { container, rerender } = renderWatch(midHandGame);
    openRecord();

    await user.click(screen.getByRole('button', { name: 'Raise' }));

    rerender(
      <WatchScreen game={midHandGame} mySeat={0} config={spectatorConfig}
        displayNames={{}} chatMessages={[]}
        lastDecision={{ seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.6 }}
        sendChat={() => {}} onLeave={() => {}} onSitOut={() => {}} />,
    );

    expect(screen.getByText('You called it')).toBeInTheDocument();
    expect(screen.getByText('1 IN A ROW')).toBeInTheDocument();
    expect([...container.querySelectorAll('.predict__chip')].every((c) => c.disabled)).toBe(true);
    expect(container.querySelector('.predict__chip.is-won')).toBeTruthy();
  });

  it('W3-4: a wrong call says so and takes the streak to zero', async () => {
    enable();
    const user = userEvent.setup();
    const { container, rerender } = renderWatch(midHandGame);
    openRecord();

    await user.click(screen.getByRole('button', { name: 'Fold' }));
    rerender(
      <WatchScreen game={midHandGame} mySeat={0} config={spectatorConfig}
        displayNames={{}} chatMessages={[]}
        lastDecision={{ seat: 0, action: { type: 'call', amount: 40 }, equity: 0.6 }}
        sendChat={() => {}} onLeave={() => {}} onSitOut={() => {}} />,
    );

    expect(screen.getByText('Not this time')).toBeInTheDocument();
    expect(screen.getByText('0 IN A ROW')).toBeInTheDocument();
    expect(container.querySelector('.predict__chip.is-lost')).toBeTruthy();
  });

  it('W3-4: there is nothing to spend and no reward but the number', () => {
    enable();
    const { container } = renderWatch(midHandGame);
    openRecord();
    const text = container.querySelector('.predict').textContent.toLowerCase();
    for (const banned of ['coin', 'chips left', 'claim', 'reward', 'bonus', 'x2']) {
      expect(text).not.toContain(banned);
    }
  });
});

// ── FIX-3 · watch layout ────────────────────────────────────────────────────

describe('FIX-3a line and rope never overlap', () => {
  // jsdom measures nothing, so the stacking is asserted on the geometry that
  // produces it, at the real pixel sizes a phone gives the stage.
  const STAGES = [598, 674, 520, 760, 420];
  const FRACS = [306 / 639, 400 / 639, 508 / 639, 620 / 639];

  const BOARD_CARD_H = 64;
  const TUG_H = 30;
  const LINE_H = 19;
  const HERO_BAND = 78;

  it('FIX-3a: at every detent and stage, the stack is board → line → rope → hero', () => {
    for (const stage of STAGES) {
      for (const frac of FRACS) {
        const g = feltGeometry(frac, stage);
        const boardBottom = g.board + BOARD_CARD_H;
        const heroTop = g.felt - HERO_BAND;

        // The rope is under the board and above the hero row, always.
        expect(g.tug, `stage ${stage} frac ${frac}: rope over the board`)
          .toBeGreaterThanOrEqual(boardBottom);
        expect(g.tug + TUG_H, `stage ${stage} frac ${frac}: rope into the hero row`)
          .toBeLessThanOrEqual(heroTop);

        // And his line, when it is drawn at all, sits between them without
        // touching either.
        if (g.line != null) {
          expect(g.line, `stage ${stage} frac ${frac}: line over the board`)
            .toBeGreaterThanOrEqual(boardBottom);
          expect(g.line + LINE_H, `stage ${stage} frac ${frac}: line into the rope`)
            .toBeLessThanOrEqual(g.tug);
        }
      }
    }
  });

  it('FIX-3a: the line is drawn when the felt is tall enough for it', () => {
    // The hidden detent gives the felt almost the whole stage.
    const g = feltGeometry(620 / 639, 760);
    expect(g.line).not.toBeNull();
    expect(g.line + 19).toBeLessThanOrEqual(g.tug);
  });

  it('FIX-3a: and suppressed rather than drawn through the rope when it is not', () => {
    // The expanded detent on a short stage: board, rope, hero row and the seat
    // ring already use every pixel. His line is in the peek row and the thread.
    const g = feltGeometry(306 / 639, 560);
    expect(g.line).toBeNull();
  });

  it('FIX-3a: the detent geometry itself is unchanged', () => {
    // SHEET_LAY, verbatim: at the ref's own region the three tops reproduce it.
    const region = 639;
    expect(feltGeometry(306 / region, region)).toMatchObject({ felt: 306, pot: 60, board: 108, tug: 184 });
    expect(feltGeometry(508 / region, region)).toMatchObject({ felt: 508, pot: 128, board: 196, tug: 286 });
    expect(feltGeometry(620 / region, region)).toMatchObject({ felt: 620, pot: 168, board: 244, tug: 336 });
  });

  // WATCH-6 re-expressed. The bug this test exists for was the rope and his
  // line being anchored to OPPOSITE EDGES of a felt that changed height, so a
  // short felt drew one through the other. v6 removes both halves of that: the
  // felt no longer changes height, and the rope is not positioned against it at
  // all — it is a row in the hero column, between him and his strip, so the
  // browser's own flow is the single source of truth for the stack.
  it('FIX-3a: nothing in the stack is anchored against the opposite edge', () => {
    const { container } = renderWatch(midHandGame, {
      lastDecision: { seat: 0, action: { type: 'bet', amount: 40 }, equity: 0.5, reasoning: 'He is done.' },
    });
    const felt = container.querySelector('.watch-felt');
    // The felt fills its parent and writes no per-detent height of its own.
    expect(felt.className).toContain('watch-felt--fill');
    expect(felt.style.height).toBe('');

    // The rope and the strip are siblings in his column, in that order, so
    // there is no arithmetic left for them to disagree about.
    const hero = container.querySelector('.watch-hero');
    const kids = [...hero.children].map((el) => el.className.split(' ')[0]);
    expect(kids.indexOf('watch-hero__tug')).toBeGreaterThan(kids.indexOf('watch-hero__body'));
    expect(kids.indexOf('glass')).toBeGreaterThan(kids.indexOf('watch-hero__tug'));
    expect(hero.querySelector('.tug')).toBeTruthy();
  });
});

describe('FIX-3b the chat composer clears the bottom of the screen', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('FIX-3b: the screen follows the Telegram viewport, so the keyboard cannot cover it', () => {
    const css = readCss('src/styles/watch.css');
    const rule = cssRule(css, '.watch-screen');
    // --tg-h shrinks when the iOS keyboard opens (KEY-1 tracks it). Following
    // it is what keeps the sheet, and the composer at the foot of it, above the
    // keyboard rather than behind it.
    expect(rule).toMatch(/height:\s*var\(--tg-h/);
  });

  it('FIX-3b: the sheet composer clears the home indicator', () => {
    const css = readCss('src/styles/analysis.css');
    const rule = cssRule(css, '.dr-chat-tab--fill .dr-chat-tab__form');
    expect(rule).toMatch(/padding-bottom:\s*max\(env\(safe-area-inset-bottom/);
    // A floor under it, because env() is 0 on a device with no inset.
    expect(rule).toMatch(/8px\)/);
  });

  // WATCH-6 re-expressed: the composer is no longer a form at the foot of a
  // tab that may or may not be open. It is the screen's own last row, always
  // there, and it asks for a whisper.
  it('FIX-3b: and the composer is reachable whatever else is on screen', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch(midHandGame);

    const input = () => container.querySelector('.watch-composer__input');
    expect(input()).toBeTruthy();
    expect(input().placeholder).toBe('Whisper to him…');

    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(input()).toBeTruthy();
    expect(container.querySelector('.thread-sheet').contains(input())).toBe(false);
  });
});

describe('FIX-3c the collapsed header', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('FIX-3c: one row carries back, name, mood, state and chat', async () => {
    const { container } = renderWatch(midHandGame);
    await screen.findByText('The Grinder');

    const header = container.querySelector('.watch-screen__header');
    expect(header.querySelector('.watch-screen__back')).toBeTruthy();
    expect(header.querySelector('.watch-screen__title').textContent).toBe('The Grinder');
    expect(header.querySelector('.mood-chip, [class*="mood"]')).toBeTruthy();
    expect(header.querySelector('.watch-screen__chat').textContent).toBe('Chat');
  });

  it('FIX-3c: the header is the ww-ref\'s 40px, and the mood band is gone', () => {
    const { container } = renderWatch(midHandGame);
    const css = readCss('src/styles/watch.css');
    expect(cssRule(css, '.watch-screen__header')).toMatch(/height:\s*40px/);
    // The band was a second 56px row above the felt. It is not there any more.
    expect(container.querySelector('.mood-band')).toBeNull();
  });

  it('FIX-3c: the chat control still reaches the record', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch(midHandGame);
    await user.click(container.querySelector('.watch-screen__chat'));
    expect(container.querySelector('.thread-sheet')).toBeTruthy();
  });

  // WATCH-6: the strip is the record's footer now — the moment the owner is
  // between hands and thinking about pulling him out is the moment he is in
  // the record anyway. His cause line still rides on it.
  it('FIX-3c: his cause line moves to the between-hands strip', () => {
    const { container } = renderWatch(betweenHandsGame);
    act(() => { screen.getByRole('button', { name: 'Chat' }).click(); });
    const strip = container.querySelector('.watch-sitout-strip');
    expect(strip).toBeTruthy();
    expect(within(strip).getByText('Between hands')).toBeInTheDocument();
    // The strip's second line is his cause when there is one, and the old
    // default when there is not.
    expect(strip.querySelector('.watch-sitout-strip__meta').textContent).toBeTruthy();
  });

  it('FIX-3c: leaving still leaves, not sits out', async () => {
    const user = userEvent.setup();
    const onLeave = vi.fn();
    const onSitOut = vi.fn();
    const { container } = renderWatch(midHandGame, { onLeave, onSitOut });

    await user.click(container.querySelector('.watch-screen__back'));
    expect(onLeave).toHaveBeenCalled();
    expect(onSitOut).not.toHaveBeenCalled();
  });
});

describe('WatchScreen between hands', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('renders the calm state, not a placeholder', () => {
    const { container } = renderWatch(betweenHandsGame);

    // The felt is still there — same anatomy, nothing swapped out for a
    // spinner or an empty div.
    expect(container.querySelector('.watch-felt')).toBeTruthy();
    expect(container.querySelector('.watch-felt__board')).toHaveClass('is-between');
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('shows an em dash for the pot instead of $0', () => {
    const { container } = renderWatch(betweenHandsGame);
    const pot = container.querySelector('.watch-felt__pot');
    expect(within(pot).getByText('—')).toBeInTheDocument();
  });

  it('says the table is shuffling', () => {
    const { container } = renderWatch(betweenHandsGame);
    expect(container.querySelector('.watch-felt__street').textContent).toContain('SHUFFLING');
  });

  it('draws five card backs and no board cards', () => {
    const { container } = renderWatch(betweenHandsGame);
    const board = container.querySelector('.watch-felt__board');
    expect(board.children).toHaveLength(5);
    expect(faceUpRanks(board)).toEqual([]);
  });

  it('keeps the hero cards face down between hands', () => {
    const { container } = renderWatch(betweenHandsGame);
    expect(faceUpRanks(container.querySelector('.watch-felt__hero'))).toEqual([]);
  });
});

describe('WatchScreen controls', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('leaving calls onLeave — watching is not the same as recalling the agent', async () => {
    const onLeave = vi.fn();
    const onSitOut = vi.fn();
    renderWatch(midHandGame, { onLeave, onSitOut });

    screen.getByRole('button', { name: 'Leave table' }).click();

    expect(onLeave).toHaveBeenCalled();
    expect(onSitOut).not.toHaveBeenCalled();
  });
});

// ── SEAT-1a · the posture the wire now carries ───────────────────────────────
// W4-2's law is "seats as characters", and SeatGhost has taken a mood since the
// v4 port — but until SEAT-1 the server sent none, so every opponent at every
// table stood neutral. These assert the felt actually reads the field, in the
// object shape the server sends and in the bare string it used to be.
describe('SEAT-1a seat mood', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  // Only a tilted posture draws the shimmer ring (POSTURE.tilted.shimmer).
  const tiltedGhosts = (container) =>
    container.querySelectorAll('.seat-ghost .floor-ghost__shimmer');

  const withVillainMood = (mood) => ({
    ...midHandGame,
    seats: midHandGame.seats.map((s, i) => (i === 1 ? { ...s, mood } : s)),
  });

  it('SEAT-1a: draws a tilted opponent tilted, from mood: { state, heat }', async () => {
    const { container } = renderWatch(withVillainMood({ state: 'tilted', heat: 88 }));
    await screen.findByText('The Grinder');
    expect(tiltedGhosts(container).length).toBe(1);
  });

  it('SEAT-1a: a resting seat is not tilted', async () => {
    const { container } = renderWatch(midHandGame);
    await screen.findByText('The Grinder');
    expect(tiltedGhosts(container).length).toBe(0);
  });

  it('SEAT-1a: the pre-SEAT-1 bare string still works', async () => {
    const { container } = renderWatch(withVillainMood('tilted'));
    await screen.findByText('The Grinder');
    expect(tiltedGhosts(container).length).toBe(1);
  });

  it('SEAT-1a: a seat with no mood at all falls back to neutral, not a crash', async () => {
    const noMood = {
      ...midHandGame,
      seats: midHandGame.seats.map(({ mood, ...rest }) => rest),
    };
    const { container } = renderWatch(noMood);
    await screen.findByText('The Grinder');
    expect(container.querySelectorAll('.seat-ghost').length).toBeGreaterThan(0);
    expect(tiltedGhosts(container).length).toBe(0);
  });
});

// ── WATCH-6 · the whisper, end to end ───────────────────────────────────────
//
// "Whisper: composer placeholder 'Whisper to him…'; sent message rises as a
// pale bubble from the bottom edge, fades over 4 s; his reply is his normal
// bubble." The record keeps both — a whisper is transient on the felt, never
// in the thread.

describe('WATCH-6 the whisper', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('sends as a pale bubble on the felt, and is gone in four seconds', async () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(midHandGame);
      const input = container.querySelector('.watch-composer__input');

      act(() => {
        fireEvent.change(input, { target: { value: 'Careful with him.' } });
        fireEvent.submit(input.closest('form'));
      });

      const whisper = container.querySelector('.watch-whisper');
      expect(whisper).toBeTruthy();
      expect(whisper.textContent).toBe('Careful with him.');
      // It is not his bubble: his is teal-edged and over his head.
      expect(whisper.closest('.watch-hero')).toBeNull();

      act(() => { vi.advanceTimersByTime(4100); });
      expect(container.querySelector('.watch-whisper')).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the field, so the same whisper cannot be sent twice', () => {
    const { container } = renderWatch(midHandGame);
    const input = container.querySelector('.watch-composer__input');
    act(() => {
      fireEvent.change(input, { target: { value: 'Careful with him.' } });
      fireEvent.submit(input.closest('form'));
    });
    expect(input.value).toBe('');
  });

  // The strip is the loudest thing he owns. "waiting for the deal" printed over
  // a live hand reads as him not being in it.
  it('says nothing about waiting while the hand is live', () => {
    const { container } = renderWatch(midHandGame);
    expect(container.querySelector('.watch-hero .watch-felt__waiting')).toBeNull();

    const between = renderWatch(betweenHandsGame);
    expect(between.container.querySelector('.watch-hero .watch-felt__waiting').textContent)
      .toBe('waiting for the deal');
  });

  // Item 4: a seat tap and the thread are one slot. Opening either closes the
  // other, and the felt never moves for them.
  it('gives the read and the thread the same slot over the felt', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch(midHandGame);

    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(container.querySelector('.thread-sheet')).toBeTruthy();

    await user.click(container.querySelector('.seat-ghost'));
    expect(container.querySelector('.thread-sheet')).toBeNull();
    expect(container.querySelector('.read-sheet')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(container.querySelector('.read-sheet')).toBeNull();
    expect(container.querySelector('.thread-sheet')).toBeTruthy();
  });
});
