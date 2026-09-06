// client/src/components/watch10.test.jsx — WATCH-10
//
// DENSITY ON THE FELT, end to end.
//
// "A panel is a picture, not a paragraph" is board 26's law for panels. Six
// seats at 40px on a 390px felt were the same mistake spatially: five
// opponents, five ten-chip piles and five name-and-stack pills filled the top
// half of the table and left the one character the owner actually owns no more
// room than the strangers around him.
//
//   job 1  an opponent at 80%, his backs at 70%, ONE stack with the number
//          beside it, and a name pill that is a name pill — on the watch felt
//          and on SIT-1's felt, which is the same felt and the same component
//   job 2  no bubble or pill over another, by FIX-6's rule (the arithmetic is
//          lib/feltBubbles.test.jsx; this is that the felt uses it)
//   job 3  the result line names the hand wherever it is said
//   job 4  one thousands separator on the screen
//
// What is NOT here: the hero. Every assertion below that mentions him is that
// he did not move.

import { act, render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WatchScreen } from './WatchScreen.jsx';
import { SEAT_BACK_H, SEAT_BACK_W, SEAT_BODY, SEAT_H } from './system/SeatGhost.jsx';
import { HERO_GHOST } from './system/WatchHero.jsx';
import { buildShareModel } from './share/shareModel.js';
import { UNCONTESTED } from '../lib/handResult.js';
import { DEAL_TOTAL_MS } from '../lib/deal.js';
import { midHandGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

const base = {
  mySeat: 0,
  config: spectatorConfig,
  chatMessages: [],
  sendChat: () => {},
  onLeave: () => {},
  onSitOut: () => {},
};

const seat = (name, stack, over = {}) => ({
  playerId: `p_${name}`,
  stack,
  holeCards: [],
  contribTotal: 20,
  contribThisStreet: 0,
  folded: false,
  allIn: false,
  actedThisStreet: false,
  displayName: name,
  mood: { state: 'neutral', heat: 30 },
  ...over,
});

/** Six-handed: the hero and the five opponents slotsFor() can seat. */
const sixHanded = (over = {}) => ({
  ...midHandGame,
  seats: [
    midHandGame.seats[0],
    seat('Doyle_v3', 980),
    seat('Granite', 2104),
    seat('nash_eq', 3410),
    seat('ivey_bot', 880),
    seat('Bluff Master General', 1290),
  ],
  ...over,
});

const seats = () => [...document.querySelectorAll('.watch-felt__seat')];

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/api/agents?', agentsResponse);
});

// ── job 1 ───────────────────────────────────────────────────────────────────

describe('WATCH-10 job 1 · an opponent takes 80% of the room he took', () => {
  it('draws his body at 80% and leaves the hero exactly where he was', () => {
    render(<WatchScreen {...base} game={sixHanded()} />);
    const body = seats()[0].querySelector('.seat-ghost .floor-ghost');
    expect(body.style.width).toBe(`${SEAT_BODY}px`);
    expect(SEAT_BODY).toBe(32);
    // Him: unchanged, which is the point of taking the space off them.
    expect(document.querySelector('.watch-hero__body .mood-ghost').getAttribute('width'))
      .toBe(String(HERO_GHOST));
    expect(HERO_GHOST).toBe(96);
  });

  it('draws his card backs at 70%, and the hero\'s at the size they were', () => {
    // His backs land on the last beat of the deal, so the deal has to be over
    // before there is a pair to measure.
    vi.useFakeTimers();
    render(<WatchScreen {...base} game={sixHanded()} />);
    act(() => { vi.advanceTimersByTime(DEAL_TOTAL_MS + 20); });
    const back = seats()[0].querySelector('.seat-ghost__backs > div');
    expect(back.style.width).toBe(`${SEAT_BACK_W}px`);
    expect(back.style.height).toBe(`${SEAT_BACK_H}px`);
    expect([SEAT_BACK_W, SEAT_BACK_H]).toEqual([11, 14]);
    // 15x20 was the pair before this, so 70% of it, rounded up in both axes.
    expect(SEAT_BACK_W / 15).toBeGreaterThanOrEqual(0.7);
    expect(SEAT_BACK_H / 20).toBeGreaterThanOrEqual(0.7);
    vi.useRealTimers();
  });

  it('banks ONE stack per seat, with his number beside it', () => {
    render(<WatchScreen {...base} game={sixHanded()} />);
    for (const s of seats()) {
      const pile = s.querySelector('.watch-felt__seat-pile');
      expect(pile).toBeTruthy();
      // Never a ten-chip column again.
      expect(pile.querySelectorAll('.chip').length).toBeLessThanOrEqual(3);
      expect(pile.querySelector('.chip-stack__amt')).toBeTruthy();
    }
    // The shape still says how much: a big stack is not three white chips.
    const bands = seats().map((s) => s.querySelector('.chip-stack').getAttribute('data-band'));
    expect(new Set(bands).size).toBeGreaterThan(1);
  });

  it('writes the name with pillName, and nothing else in the pill', () => {
    render(<WatchScreen {...base} game={sixHanded()} />);
    const names = seats().map((s) => s.querySelector('.seat-ghost__name').textContent);
    expect(names).toContain('Doyle_v3');
    // "Bluff Master General" is 20 characters. pillName cuts at 14 and SAYS it
    // was cut, so the man is still recognisably that man — the first word on
    // its own ("Bluff") is a different name, which is what BUGS-A job 1 ended.
    expect(names).toContain('Bluff Master G…');
    for (const s of seats()) {
      expect(s.querySelector('.seat-ghost__stack')).toBeNull();
    }
  });

  it('is one seat component, so the sit-down felt gets the same seat', () => {
    // SIT-1: the felt the kitchen chair opens IS this felt, with the owner in
    // the hero seat. If these two ever disagree it is because somebody forked
    // the component, which is the thing the queue said not to do.
    const anatomy = () => [...document.querySelectorAll('.watch-felt__seat')].map((s) => ({
      name: s.querySelector('.seat-ghost__name').textContent,
      body: s.querySelector('.floor-ghost').style.width,
      stackInPill: !!s.querySelector('.seat-ghost__stack'),
      onChips: s.querySelector('.watch-felt__seat-pile .chip-stack__amt').textContent,
      chips: s.querySelectorAll('.watch-felt__seat-pile .chip').length,
    }));

    const spectate = render(<WatchScreen {...base} game={sixHanded()} />);
    const watching = anatomy();
    spectate.unmount();

    render(<WatchScreen {...base} seated game={sixHanded()}
      legalActions={[{ type: 'fold' }, { type: 'check' }]} />);
    expect(anatomy()).toEqual(watching);
    expect(watching[0].body).toBe('32px');
    expect(watching[0].stackInPill).toBe(false);
  });

  it('adds up: a seat is a body, a gap and a pill and no taller', () => {
    expect(SEAT_H).toBe(58);
  });
});

// ── job 2 ───────────────────────────────────────────────────────────────────

describe('WATCH-10 job 2 · nothing is drawn over anything', () => {
  const said = (seatNo, text) => ({ isAI: true, seat: seatNo, text, t: Date.now() });

  it('gives every bubble a side, so it is placed rather than pinned', () => {
    render(<WatchScreen {...base} game={sixHanded()}
      chatMessages={[said(1, 'Again?')]} />);
    const bubble = document.querySelector('.watch-felt__bubble');
    expect(bubble).toBeTruthy();
    expect(bubble.className).toMatch(/ is-(left|right)$/);
    // And the tail is the stylesheet's, not an inline offset that would win
    // against it and point the wrong way.
    expect(bubble.querySelector('.bubble__tail').getAttribute('style')).toBeFalsy();
  });

  it('shows two short lines from two seats', () => {
    render(<WatchScreen {...base} game={sixHanded()}
      chatMessages={[said(1, 'Again?'), said(2, 'Call.')]} />);
    expect(document.querySelectorAll('.watch-felt__bubble')).toHaveLength(2);
  });

  it('does not draw the one it has no room for', () => {
    // Two lines this long cannot both open in the top band at 390 wide, so the
    // felt shows one. lib/bubbles.js's own last clause: the record has both.
    // Seats 2 and 3 are the two that share the top band (slotsFor(5) hands out
    // ml · tl · tc · tr · mr, in that order, from the hero's left).
    const long = 'He does that every single time he';
    render(<WatchScreen {...base} game={sixHanded()}
      chatMessages={[said(2, long), said(3, long)]} />);
    expect(document.querySelectorAll('.watch-felt__bubble')).toHaveLength(1);
  });
});

// ── job 3 ───────────────────────────────────────────────────────────────────

const settled = (result) => sixHanded({
  street: 'complete',
  toAct: null,
  community: ['9s', 'Kc', '4d', '2h', '7c'],
  result,
});

const SHOWDOWN = {
  type: 'showdown',
  pot: 30,
  winners: [{ seat: 2, amount: 30 }],
  showdown: [{ seat: 2, holeCards: ['9h', 'Ad'] }],
};

describe('WATCH-10 job 3 · the result line names the hand wherever it is said', () => {
  it('names it on the felt pill', () => {
    render(<WatchScreen {...base} game={settled(SHOWDOWN)} />);
    expect(document.querySelector('.watch-felt__won-pill').getAttribute('aria-label'))
      .toBe('Granite took $30 with a pair of nines');
  });

  it('names it in the ceremony, in the same words', () => {
    render(<WatchScreen {...base} game={settled(SHOWDOWN)}
      sessionEnd={{ reason: 'sat out by owner', hands: 42 }} />);
    const line = document.querySelector('.watch-ceremony__hand');
    expect(line).toBeTruthy();
    expect(line.getAttribute('aria-label')).toBe('Granite took $30 with a pair of nines');
    expect(line.textContent).toContain('with a pair of nines');
  });

  it('says nothing in the ceremony when the session ended between hands', () => {
    render(<WatchScreen {...base} game={sixHanded()}
      sessionEnd={{ reason: 'sat out by owner', hands: 42 }} />);
    expect(document.querySelector('.watch-ceremony')).toBeTruthy();
    expect(document.querySelector('.watch-ceremony__hand')).toBeNull();
  });

  it('names it on the share card, off his own cards', () => {
    const model = buildShareModel({
      handNumber: 12,
      pot: 3694,
      won: true,
      holeCards: ['Ah', 'Kh'],
      opponentShowdownCards: [['Qs', 'Qd']],
      streets: [{ street: 'river', board: ['2h', '7h', 'Th', '3c', '8d'] }],
    }, { agentName: 'Granite' });
    expect(model.hand).toBe('ace-high flush');
    expect(model.result).toBe('+$3,694 · ace-high flush');
  });

  it('says uncontested on the share card rather than nothing at all', () => {
    // A pot nobody called is still an answer to "with what", and it is the
    // word the felt has used since BUGS-A job 12 — one vocabulary, both
    // surfaces. Before this the card showed the amount and a blank.
    const model = buildShareModel({
      handNumber: 13,
      pot: 240,
      won: true,
      holeCards: ['Ah', 'Kh'],
      opponentShowdownCards: [],
      streets: [{ street: 'preflop', board: [] }],
    }, { agentName: 'Granite' });
    expect(model.hand).toBe(UNCONTESTED);
    expect(model.result).toBe('+$240 · uncontested');
  });

  it('a hand he lost never claims nobody called it', () => {
    const model = buildShareModel({
      handNumber: 14,
      pot: 180,
      won: false,
      holeCards: ['Ah', 'Kh'],
      opponentShowdownCards: [],
      streets: [{ street: 'turn', board: ['2c', '7d', 'Ts', '3c'] }],
    }, { agentName: 'Granite' });
    // He has cards and a board, so SHARE-1 still names what he was holding —
    // that is unchanged. What must never happen is a LOST hand calling itself
    // uncontested: he did not take a pot nobody called, he folded.
    expect(model.hand).not.toBe(UNCONTESTED);
    expect(model.result).toContain('−$180');
  });
});

// ── job 4 ───────────────────────────────────────────────────────────────────

describe('WATCH-10 job 4 · one thousands separator on the felt', () => {
  // Sweden groups thousands with a narrow no-break space and uses a comma for
  // the decimal, so a felt that asks the device how to write a number writes it
  // two ways at once. This pins the device to that locale and asserts the felt
  // does not listen to it.
  const swedish = () => {
    const real = Number.prototype.toLocaleString;
    vi.spyOn(Number.prototype, 'toLocaleString').mockImplementation(function fake(...args) {
      return real.call(this, args[0] ?? 'sv-SE', args[1]);
    });
  };

  it('BUG-37: writes his pile, their piles and the pot the same way, on any phone', () => {
    swedish();
    try {
      render(<WatchScreen {...base} game={sixHanded({ pot: 4180 })} />);
      expect(document.querySelector('.watch-felt__hero-stack .chip-stack__amt').textContent)
        .toBe('$940');
      const amounts = seats()
        .map((s) => s.querySelector('.chip-stack__amt').textContent);
      expect(amounts).toContain('$2,104');
      expect(amounts).toContain('$3,410');
      expect(document.querySelector('.watch-felt__pot-amt').textContent).toBe('$4,180');
      // Nothing anywhere on the felt grouped the other way.
      expect(document.querySelector('.watch-felt').textContent).not.toMatch(/\d \d|\d \d/);
    } finally {
      vi.restoreAllMocks();
    }
  });

  it('says an em dash for a stack nobody sent, not "$--"', () => {
    render(<WatchScreen {...base} game={sixHanded({
      seats: sixHanded().seats.map((s, i) => (i === 0 ? { ...s, stack: null } : s)),
    })} />);
    expect(document.querySelector('.watch-felt__hero-stack .chip-stack__amt').textContent)
      .toBe('—');
  });
});
