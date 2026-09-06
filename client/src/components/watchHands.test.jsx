// client/src/components/watchHands.test.jsx — HANDS-1
//
// The bodies, on the felt. Ported from design-refs/mood-atoms.jsx (the fist),
// design-refs/mood-watch5.jsx and design-refs/Agentic Poker Watch v5.html
// (52a–k, 52m).
//
// The laws this file exists to keep:
//
//   1. THE HANDS ARE IN FRONT OF THE CARDS. He is holding them, not standing
//      behind them — hero at 96, every opponent at 40, gripping the pair's
//      bottom corners from below.
//   2. ONE SEAT ANATOMY. Body, gap, one pill. The face is never covered; the
//      ring and the dealer button attach to the pill's LEFT EDGE; a folded seat
//      dims its body and loses its cards, and THE PILL STAYS.
//   3. CHIPS ARE OBJECTS ON A FELT, not a number in a panel. His pile stands to
//      his left with the figure under it, every opponent banks beside his own
//      seat, a bet is chips out in front, and at street end every spot sweeps
//      into a pot whose pill carries its own chip.
//   4. NOTHING ON THIS SCREEN MAY INSERT A ROW. The cost is a toast over his
//      strip for four seconds and then a dot at its right edge.
//   5. THE RING IS THE SERVER'S CLOCK and the faces are the server's triggers.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  WatchScreen, SessionCeremony, OPP_MUCK_MS, SWEEP_MS, PEEK_HOLD_MS,
} from './WatchScreen.jsx';
import { WatchHero, COST_TOAST_MS, HERO_GHOST } from './system/WatchHero.jsx';
import { SEAT_BODY, SEAT_H, SEAT_PILL } from './system/SeatGhost.jsx';
import { midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';
import { DEAL_TOTAL_MS } from '../lib/deal.js';
import { FACE_HOLD_MS } from '../lib/faces.js';

// jsdom computes no layout, so a rule about geometry is asserted as the rule.
const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const readCss = (name) => readFileSync(resolve(clientRoot, 'src/styles', name), 'utf8');
const watchCss = () => readCss('watch.css');
const watch6Css = () => readCss('watch6.css');

const base = {
  mySeat: 0,
  config: spectatorConfig,
  displayNames: { 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' },
  chatMessages: [],
  sendChat: () => {},
  onLeave: () => {},
  onSitOut: () => {},
};

const renderWatch = (game, props = {}) =>
  render(<WatchScreen game={game} {...base} {...props} />);
const rerenderWatch = (rerender, game, props = {}) =>
  rerender(<WatchScreen game={game} {...base} {...props} />);

const foldSeat = (game, seat) => ({
  ...game,
  seats: game.seats.map((s, i) => (i === seat ? { ...s, folded: true } : s)),
});

const settledGame = (over = {}) => ({
  ...midHandGame,
  street: 'complete',
  result: { pot: 400, winners: [{ seat: 0, descr: 'two pair' }], showdown: [] },
  ...over,
});

const poseIn = (el) => {
  const g = el.querySelector('[data-pose]');
  return g ? g.getAttribute('data-pose') : null;
};

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents', agentsResponse);
});

// ── 1 · the hands ──────────────────────────────────────────────────────────
describe('HANDS-1: the hands are in front of the cards', () => {
  it('mounts a hand layer on him at 96 and on every seat at 40', () => {
    const { container } = renderWatch(midHandGame);

    const his = container.querySelector('.watch-hero .ghost-hands');
    expect(his.getAttribute('width')).toBe(String(HERO_GHOST));

    const seats = container.querySelectorAll('.watch-felt__seat .seat-ghost__hands');
    expect(seats).toHaveLength(2);
    for (const s of seats) expect(s.getAttribute('width')).toBe(String(SEAT_BODY));
  });

  // "He is holding them, not standing behind them — so the hand layer sits
  // ABOVE the card pair rather than inside the ghost."
  it('draws the hands after the cards, on both scales', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(midHandGame);
      // The table's backs are the last beat of the deal; there is nothing to be
      // in front of until they are out.
      act(() => { vi.advanceTimersByTime(DEAL_TOTAL_MS + 20); });

      const heroCards = container.querySelector('.watch-hero__cards');
      const heroHands = container.querySelector('.watch-hero__hands');
      expect(heroCards.compareDocumentPosition(heroHands)
        & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

      const seat = container.querySelector('.watch-felt__seat .seat-ghost__body');
      const backs = seat.querySelector('.seat-ghost__backs');
      const hands = seat.querySelector('.seat-ghost__hands');
      expect(backs.compareDocumentPosition(hands)
        & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('is the ref\'s fist and not the placeholder mitten', () => {
    const { container } = renderWatch(midHandGame);
    const fist = container.querySelector('.watch-hero__hands path:not(.ghost-hands__knuckle)');
    expect(fist.getAttribute('fill')).toBe('#BDBDBD');
    expect(fist.getAttribute('stroke')).toBe('#16191B');
    expect(container.querySelectorAll('.watch-hero__hands .ghost-hands__knuckle'))
      .toHaveLength(4);
  });

  // The poses come off the table, not off a prop somebody remembered to pass.
  it('takes his pose from what just happened at the table', () => {
    const pose = (props) => {
      const { container, unmount } = renderWatch(midHandGame, props);
      const p = poseIn(container.querySelector('.watch-hero__hands'));
      unmount();
      return p;
    };

    expect(pose({ lastDecision: { seat: 0, action: { type: 'bet', amount: 40 } } })).toBe('push');
    expect(pose({ lastDecision: { seat: 0, action: { type: 'check' } } })).toBe('drum');
    expect(pose({ lastDecision: { seat: 0, action: { type: 'fold' } } })).toBe('toss');
    // An opponent's decision is not his body language.
    expect(pose({ lastDecision: { seat: 1, action: { type: 'bet', amount: 40 } } })).toBe('hold');
  });

  // "peek — one holds, one turns up at the near corner: dealt." A MOMENT: he
  // looks at what he was given and is holding again half a second later.
  it('peeks at what he was dealt, then holds', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(midHandGame);
      const pose = () => poseIn(container.querySelector('.watch-hero__hands'));

      act(() => { vi.advanceTimersByTime(DEAL_TOTAL_MS); });
      expect(pose()).toBe('peek');

      act(() => { vi.advanceTimersByTime(PEEK_HOLD_MS + 40); });
      expect(pose()).toBe('hold');
    } finally {
      vi.useRealTimers();
    }
  });

  // "The grammar of the pair reads at a glance: hands go UP AND OUT on a win,
  // IN OVER THE FACE on a loss" — and that pair is THE CEREMONY'S (52g/52h).
  // WATCH-7's law is that a hand end is quiet: both fists over his head at the
  // end of every hand he wins is the session moment fired forty times a session.
  it('keeps a won hand quiet, and saves the fists for the ceremony', () => {
    const { container } = renderWatch(settledGame());
    expect(poseIn(container.querySelector('.watch-hero__hands'))).toBe('hold');
    expect(container.querySelector('.watch-ceremony')).toBeNull();

    const won = render(
      <SessionCeremony won agentName="Balanced v2.1" net={3541} stack={5541} hands={41} />,
    );
    expect(poseIn(won.container.querySelector('.watch-ceremony__hands'))).toBe('raise');

    const lost = render(
      <SessionCeremony busted agentName="Balanced v2.1" net={-2000} stack={0} hands={22} />,
    );
    expect(poseIn(lost.container.querySelector('.watch-ceremony__hands'))).toBe('cover');
  });

  // An opponent gets FOUR poses — the ones that say what he is DOING. peek,
  // drum, clench and cover say what somebody is feeling, and an opponent's
  // feelings are the read sheet's job, not the felt's.
  it('gives an opponent the four poses he is allowed, and no others', () => {
    vi.useFakeTimers();
    try {
      // A check is `drum` on him and `hold` on a seat: drum, peek, clench and
      // cover say what somebody is FEELING, and an opponent's feelings are the
      // read sheet's job.
      const { container } = renderWatch(midHandGame, {
        lastDecision: { seat: 1, action: { type: 'check' } },
      });
      act(() => { vi.advanceTimersByTime(DEAL_TOTAL_MS + 20); });
      const seat = container.querySelectorAll('.watch-felt__seat')[0];
      expect(poseIn(seat.querySelector('.seat-ghost__hands'))).toBe('hold');
    } finally {
      vi.useRealTimers();
    }
  });

  it('follows the throw when a seat folds, and comes back to rest', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      act(() => { vi.advanceTimersByTime(DEAL_TOTAL_MS + 20); });
      act(() => { rerenderWatch(rerender, foldSeat(midHandGame, 1)); });

      const hands = () => poseIn(container.querySelectorAll('.watch-felt__seat')[0]
        .querySelector('.seat-ghost__hands'));
      expect(hands()).toBe('toss');

      act(() => { vi.advanceTimersByTime(OPP_MUCK_MS + 40); });
      expect(hands()).toBe('rest');
    } finally {
      vi.useRealTimers();
    }
  });
});

// ── 2 · one seat anatomy (52m) ─────────────────────────────────────────────
describe('HANDS-1: one seat anatomy', () => {
  // WATCH-10 job 1 · DENSITY. The numbers moved and the ANATOMY did not: an
  // opponent draws at 80% of what 52m settled (body 40 → 32, and the gap with
  // it, because SEAT_GRIP hangs the fists a fixed fraction of the body below
  // it), and the pill does not scale at all, because 9.5px name text at 80% is
  // not a smaller pill, it is an unreadable one. Two rows, one gap, in that
  // order — which is what this test is actually about — is unchanged.
  it('is a body, a gap and one pill', () => {
    expect(SEAT_BODY).toBe(32);
    expect(SEAT_PILL).toBe(18);
    expect(SEAT_H).toBe(SEAT_BODY + 8 + SEAT_PILL);

    const { container } = renderWatch(midHandGame);
    const seat = container.querySelector('.watch-felt__seat .seat-ghost');
    const rows = [...seat.children].map((el) => el.className.split(' ')[0]);
    expect(rows).toEqual(['seat-ghost__body', 'seat-ghost__row']);
  });

  // WATCH-10 job 1 · THE PILL IS A NAME PILL. It used to carry the name AND the
  // stack, which is the arrangement mood-watch5.jsx had already abandoned for
  // the hero — "the chips ARE the stack, so stating it here too made the number
  // the truth and the chips a decoration". An opponent banks a pile on the same
  // felt, so his figure went to his chips and the pill got the width back. The
  // rule this test defends is unchanged: whatever the pill holds is ONE LINE
  // under his feet, and his money is somewhere a reader can find it.
  it('carries his name on one line under his feet, and his money on his chips', () => {
    const { container } = renderWatch(midHandGame);
    const seat = container.querySelector('.watch-felt__seat');
    const pill = seat.querySelector('.seat-ghost__chip');
    expect(pill.querySelector('.seat-ghost__name').textContent).toBe('Doyle_v3');
    expect(pill.querySelector('.seat-ghost__stack')).toBeNull();
    expect(seat.querySelector('.watch-felt__seat-pile .chip-stack__amt').textContent)
      .toBe('$980');
  });

  // One stack, not a ten-chip column: five banded piles across the top of a
  // 390px felt were the densest thing on the table.
  it('banks one short stack, with the number beside it', () => {
    const { container } = renderWatch(midHandGame);
    const pile = container.querySelector('.watch-felt__seat .watch-felt__seat-pile');
    expect(pile.querySelectorAll('.chip').length).toBeLessThanOrEqual(3);
    expect(pile.querySelector('.chip-stack').className).toContain('is-seat');
  });

  // "The timer ring and the dealer button attach to the pill's LEFT EDGE rather
  // than orbiting the body, so nothing sits on the face."
  it('hangs the ring and the button off the pill\'s left edge, never the body', () => {
    const { container } = renderWatch({
      ...midHandGame,
      dealerSeat: 1,
      actionTimer: { seat: 1, deadlineTs: Date.now() + 9000, totalMs: 12000 },
    });
    const seat = container.querySelectorAll('.watch-felt__seat')[0];
    const row = seat.querySelector('.seat-ghost__row');
    expect([...row.children].map((el) => (el.getAttribute('class') || '').split(' ')[0]))
      .toEqual(['seat-ghost__sat', 'seat-ghost__chip']);
    const sat = row.querySelector('.seat-ghost__sat');
    expect(sat.querySelector('.seat-clock')).toBeTruthy();
    expect(sat.querySelector('.seat-ghost__dealer')).toBeTruthy();

    // ATTACHED, not in the row: in flow the pair widened the seat by up to 37px
    // and a rail seat that was both dealer and on the clock hung off the felt.
    const css = watchCss();
    expect(css).toMatch(/\.seat-ghost__sat \{[^}]*position: absolute/);

    // And nothing is inside the body but him, his cards and his hands.
    const body = seat.querySelector('.seat-ghost__body');
    expect(body.querySelector('.seat-clock')).toBeNull();
    expect(body.querySelector('.seat-ghost__dealer')).toBeNull();
  });

  // "Whatever else goes quiet, you can always read who is sitting there."
  it('dims a folded body and leaves the pill alone', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      act(() => { vi.advanceTimersByTime(DEAL_TOTAL_MS + 20); });
      act(() => { rerenderWatch(rerender, foldSeat(midHandGame, 1)); });
      act(() => { vi.advanceTimersByTime(OPP_MUCK_MS + 40); });

      const seat = container.querySelectorAll('.watch-felt__seat')[0].querySelector('.seat-ghost');
      expect(seat.className).toContain('is-folded');
      // The cards are gone entirely — no cards, and no hands on cards.
      expect(seat.querySelector('.seat-ghost__backs')).toBeNull();
      // The pill is still there, and still says who it is.
      expect(seat.querySelector('.seat-ghost__chip').textContent).toContain('Doyle_v3');
    } finally {
      vi.useRealTimers();
    }
  });

  it('scopes the fold dim to the body in the stylesheet', () => {
    const css = watchCss();
    expect(css).toMatch(/\.seat-ghost\.is-folded \.seat-ghost__body \{[^}]*opacity: 0\.34/);
    expect(css).not.toMatch(/\n\.seat-ghost\.is-folded \{/);
  });
});

// ── 3 · chips, as objects ──────────────────────────────────────────────────
describe('HANDS-1: chips are things on a felt', () => {
  it('stands his pile to his left, labelled, with the figure under it', () => {
    const { container } = renderWatch(midHandGame);
    const pile = container.querySelector('.watch-felt__hero-stack');
    expect(pile.querySelector('.chip-stack__label').textContent).toBe('STACK');
    expect(pile.querySelector('.chip-stack__amt').textContent).toBe('$940');
    expect(pile.querySelectorAll('.chip').length).toBeGreaterThan(0);
  });

  // The chips ARE the stack; stating it in the strip as well made the number
  // the truth and the pile a decoration.
  it('takes STACK out of his strip', () => {
    const { container } = renderWatch(midHandGame);
    const labels = [...container.querySelectorAll('.watch-hero__strip .watch-felt__hero-lbl')]
      .map((el) => el.textContent);
    expect(labels).not.toContain('Stack');
  });

  it('banks a pile beside every opponent', () => {
    const { container } = renderWatch(midHandGame);
    const piles = container.querySelectorAll('.watch-felt__seat .watch-felt__seat-pile');
    expect(piles).toHaveLength(2);
    for (const p of piles) expect(p.querySelectorAll('.chip').length).toBeGreaterThan(0);
  });

  it('puts a bet out as chips in front of the cards, with the figure beside them', () => {
    // The hero is 40 into this street; nobody else has put anything in yet.
    const { container } = renderWatch(midHandGame);
    const his = container.querySelector('.watch-felt__hero-bet');
    expect(his.querySelectorAll('.chip').length).toBeGreaterThan(0);
    expect(his.querySelector('.bet-spot__amt').textContent).toBe('40');
    expect(container.querySelectorAll('.watch-felt__seat-bet')).toHaveLength(0);

    const { container: c2 } = renderWatch({
      ...midHandGame,
      seats: midHandGame.seats.map((s, i) => (i === 1 ? { ...s, contribThisStreet: 40 } : s)),
    });
    expect(c2.querySelector('.watch-felt__seat-bet .bet-spot__amt').textContent).toBe('40');
  });

  // "Every spot travels together — one sweep, not four animations."
  it('sweeps every bet spot into the pot at street end', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch({
        ...midHandGame,
        seats: midHandGame.seats.map((s) => ({ ...s, contribThisStreet: 40 })),
      });
      expect(container.querySelectorAll('.is-sweeping')).toHaveLength(0);

      // The turn: the engine has cleared every contribution.
      act(() => {
        rerenderWatch(rerender, {
          ...midHandGame,
          street: 'turn',
          community: ['5c', '4h', '8c', 'Kd'],
          pot: 220,
          seats: midHandGame.seats.map((s) => ({ ...s, contribThisStreet: 0 })),
        });
      });
      // All three spots are still on the felt, travelling as one.
      expect(container.querySelectorAll('.is-sweeping')).toHaveLength(3);

      act(() => { vi.advanceTimersByTime(SWEEP_MS + 40); });
      expect(container.querySelectorAll('.is-sweeping')).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });

  // "The pot pill grows one step per band", so a table that has been betting
  // big looks different from one that has been limping before a figure is read.
  it('gives the pot pill its own chip, which grows with the pot', () => {
    const chips = (pot) => {
      const { container, unmount } = renderWatch({ ...midHandGame, pot });
      const n = container.querySelectorAll('.watch-felt__pot-pill .chip').length;
      unmount();
      return n;
    };
    expect(chips(60)).toBe(2);      // 3bb
    expect(chips(300)).toBe(3);     // 15bb
    expect(chips(900)).toBe(5);     // 45bb
  });
});

// ── the muck: one fixed spot ───────────────────────────────────────────────
describe('HANDS-1: a table of six folds makes one pile', () => {
  it('lands a folded pair on one spot beside the pot, face down', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = renderWatch(midHandGame);
      act(() => { vi.advanceTimersByTime(DEAL_TOTAL_MS + 20); });
      expect(container.querySelectorAll('.watch-felt__muck-pair')).toHaveLength(0);

      act(() => { rerenderWatch(rerender, foldSeat(midHandGame, 1)); });
      act(() => { vi.advanceTimersByTime(OPP_MUCK_MS + 40); });

      const muck = container.querySelector('.watch-felt__muck');
      expect(muck.querySelectorAll('.watch-felt__muck-pair')).toHaveLength(1);
      // Never face up at any frame: a card back carries no rank.
      expect(muck.textContent).toBe('');

      act(() => { rerenderWatch(rerender, foldSeat(foldSeat(midHandGame, 1), 2)); });
      act(() => { vi.advanceTimersByTime(OPP_MUCK_MS + 40); });
      expect(container.querySelectorAll('.watch-felt__muck-pair')).toHaveLength(2);
    } finally {
      vi.useRealTimers();
    }
  });

  // 250ms rather than 350, a flatter arc, and NOTHING FADES: a fold that
  // dissolves reads as a bug.
  it('is 250ms for a seat and keeps full opacity all the way to the pile', () => {
    expect(OPP_MUCK_MS).toBe(250);
    const css = watchCss();
    expect(css).toMatch(/animation:\s*watch-muck-seat 250ms/);
    const at = css.indexOf('@keyframes watch-muck-seat {');
    const frames = css.slice(at, css.indexOf('}\n', css.indexOf('100%', at)));
    expect(frames).not.toContain('opacity');
  });
});

// ── 4 · the cost, as a toast then a dot (52f / 52k) ────────────────────────
describe('HANDS-1: nothing on this screen may insert a row', () => {
  const cost = { key: 'FOCUS', line: 'He misjudged equity by 7% on the river' };

  it('rides over the strip, absolutely, so the column keeps its four rows', () => {
    const css = watch6Css();
    const rule = css.slice(css.indexOf('.watch-hero__cost {'),
      css.indexOf('.watch-hero__cost-line'));
    expect(rule).toContain('position: absolute');
    expect(rule).toContain('border-left: 3px solid');
  });

  it('collapses to a dot at the strip\'s right edge, and comes back on a tap', () => {
    vi.useFakeTimers();
    try {
      // The screen derives its own cost from the hand, so the atom is driven
      // directly here: this asserts the four-second rule, not the attribute
      // engine that decides there was a cost at all.
      const { container } = render(<WatchHero street="TURN" cost={cost} />);
      expect(container.querySelector('.watch-hero__cost-line').textContent).toBe(cost.line);
      expect(container.querySelector('.watch-hero__cost-key').textContent).toBe('FOCUS');

      act(() => { vi.advanceTimersByTime(COST_TOAST_MS + 40); });
      expect(container.querySelector('.watch-hero__cost')).toBeNull();
      // Inside the strip, so it costs no height.
      const dot = container.querySelector('.watch-hero__strip .watch-hero__cost-dot');
      expect(dot).toBeTruthy();

      act(() => { dot.click(); });
      expect(container.querySelector('.watch-hero__cost')).toBeTruthy();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows nothing at all when the hand had nothing to answer for', () => {
    const { container } = renderWatch(midHandGame);
    expect(container.querySelector('.watch-hero__cost')).toBeNull();
    expect(container.querySelector('.watch-hero__cost-dot')).toBeNull();
  });
});

// ── 5 · the server's clock and the server's faces ──────────────────────────
describe('HANDS-1: the ring is the clock the server is keeping', () => {
  it('draws the acting seat\'s ring from state.actionTimer', () => {
    const { container } = renderWatch({
      ...midHandGame,
      actionTimer: { seat: 1, deadlineTs: Date.now() + 6000, totalMs: 12000 },
    });
    const ring = container.querySelectorAll('.watch-felt__seat')[0].querySelector('.seat-clock');
    expect(ring).toBeTruthy();
    // Half the clock gone is half the arc drawn.
    const [drawn, total] = ring.querySelectorAll('circle')[1]
      .getAttribute('stroke-dasharray').split(' ').map(Number);
    expect(drawn / total).toBeCloseTo(0.5, 1);
  });

  it('draws his own ring on his own strip', () => {
    const { container } = renderWatch({
      ...midHandGame,
      toAct: 0,
      actionTimer: { seat: 0, deadlineTs: Date.now() + 9000, totalMs: 12000 },
    });
    expect(container.querySelector('.watch-hero__strip .seat-clock')).toBeTruthy();
  });

  // "A deadline the server will not enforce is worse than drawing no ring."
  it('draws no ring on his strip when the server is keeping no clock', () => {
    const { container } = renderWatch({ ...midHandGame, toAct: 0 });
    expect(container.querySelector('.watch-hero__strip .seat-clock')).toBeNull();
  });
});

describe('HANDS-1: the faces are the triggers the server sent', () => {
  const faceOn = (el) => {
    const g = el.querySelector('[data-event]');
    return g ? g.getAttribute('data-event') : null;
  };

  it('pulls his face for the moment the decision named', () => {
    vi.useFakeTimers();
    try {
      const { container } = renderWatch(midHandGame, {
        lastDecision: { seat: 0, action: { type: 'raise', amount: 120 }, event: 'allIn' },
      });
      expect(faceOn(container.querySelector('.watch-hero'))).toBe('locked');

      // A face is a MOMENT. Held any longer it stops being a reaction and
      // becomes his resting face, which is the mood system's job.
      act(() => { vi.advanceTimersByTime(FACE_HOLD_MS + 40); });
      expect(faceOn(container.querySelector('.watch-hero'))).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('pulls an opponent\'s face for the trigger that named him, and nobody else', () => {
    const { container } = renderWatch(midHandGame, {
      lastDecision: { seat: 1, action: { type: 'raise', amount: 120 }, event: 'raisedAgainst' },
    });
    const seats = container.querySelectorAll('.watch-felt__seat');
    expect(faceOn(seats[0])).toBe('wary');
    expect(faceOn(seats[1])).toBeNull();
  });

  it('takes the hand-end faces off the result', () => {
    const { container } = renderWatch(settledGame({
      result: {
        pot: 400, winners: [{ seat: 0, descr: 'two pair' }], showdown: [],
        events: { 0: 'wonBig', 1: 'badBeat' },
      },
    }));
    expect(faceOn(container.querySelector('.watch-hero'))).toBe('smug');
    expect(faceOn(container.querySelectorAll('.watch-felt__seat')[0])).toBe('stunned');
  });

  it('is silent on a server that sends neither', () => {
    const { container } = renderWatch(midHandGame);
    expect(faceOn(container.querySelector('.watch-hero'))).toBeNull();
  });
});
