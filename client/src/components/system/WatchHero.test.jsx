// WatchHero — him, seated at the bottom of the felt.
// Port of design-refs/mood-watch5.jsx `V5Hero`.
//
// "v4b put him in a hero row: a strip of chrome at the foot of the felt with
// his cards in it, which made the one character you own the least present thing
// on his own table. v5 seats him."
//
// The rules asserted here are the ones the ref states as laws:
//   · twice an opponent seat, facing the viewer
//   · his cards face up IN FRONT of him, never behind
//   · a FLOWED COLUMN — bubble, him, rope, strip — so nothing lands on anything
//     else. That is the lesson v4b paid eleven defects for.
//   · NOTHING ON THIS SCREEN MAY INSERT A ROW (52f). The cost was a pinned panel
//     under his strip, which pushed the felt up and made the cost screen a
//     different screen from the calm one. It rides OVER the strip now.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import {
  WatchHero, heroPose, betBand, COST_TOAST_MS, OPP_GHOST, OPP_SEAT, HERO_GHOST,
} from './WatchHero.jsx';

const hole = [['A', 's'], ['K', 'h']];

const draw = (props = {}) => render(
  <WatchHero stack="$1,847" street="TURN" equity={87} hole={hole} {...props} />,
);

describe('the column', () => {
  it('is a flow, in the ref\'s order, with nothing positioned against the felt', () => {
    const { container } = draw({ says: 'He checked twice.', action: 'BET $240', cost: { key: 'FOCUS', line: 'He misjudged equity by 7%.' } });
    const order = [...container.querySelector('.watch-hero').children]
      .map((el) => el.className.split(' ')[0]);
    // Four, with or without a cost: the cost rides over the strip rather than
    // taking a row of its own, so the felt geometry is identical either way.
    expect(order).toEqual([
      'watch-hero__says', 'watch-hero__body', 'watch-hero__tug', 'glass',
    ]);
    expect(container.querySelector('.watch-hero__strip .watch-hero__cost')).toBeTruthy();
  });

  // The band is reserved by the flow, not by a fixed height: with nothing said
  // it simply is not there, and him and the rope move up by exactly its height.
  it('has no bubble at all when he has said nothing', () => {
    const { container } = draw();
    expect(container.querySelector('.watch-hero__says')).toBeNull();
    expect(container.querySelector('.bubble')).toBeNull();
  });

  it('speaks in his own register, over his head', () => {
    const { container } = draw({ says: 'He checked twice.' });
    const bubble = container.querySelector('.watch-hero__says .bubble--mine');
    expect(bubble).toBeTruthy();
    expect(bubble.textContent).toContain('He checked twice.');
  });
});

describe('him', () => {
  it('is twice an opponent seat', () => {
    // HANDS-1: the ratio is measured body to body — a hero measured against a
    // seat's whole stack (body + gap + pill) was comparing him to a column of
    // chrome, not to a character.
    //
    // WATCH-10 job 1 took an opponent to 80% (32px body, 58px stack) and left
    // HIM exactly where he was, which is the whole point of taking the space:
    // "twice an opponent" is a FLOOR, not a target, and he now stands at three
    // times one. What must not move is the 96 — that is his size, and the ratio
    // is a consequence of it.
    expect(HERO_GHOST).toBe(96);
    expect(OPP_GHOST).toBe(32);
    expect(OPP_SEAT).toBe(58);
    expect(HERO_GHOST / OPP_GHOST).toBeGreaterThanOrEqual(2);
    const { container } = draw();
    expect(container.querySelector('.mood-ghost').getAttribute('width'))
      .toBe(String(HERO_GHOST));
  });

  // ...and never over his face. The face is the readout the whole screen is
  // built around; cards across it are the one way this composition fails.
  it('keeps his cards off his face', () => {
    const css = readFileSync(
      resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/watch6.css'), 'utf8',
    );
    const rule = /\.watch-hero__cards\s*\{([^}]*)\}/.exec(css)[1];
    const top = Number(/top:\s*([\d.]+)%/.exec(rule)[1]);
    expect(top).toBeGreaterThanOrEqual(60);
  });

  // "cards face up in front of him (over the lower third of his body, never
  // behind)" — drawn after him, and above him in z.
  it('holds his cards in front of him, face up', () => {
    const { container } = draw();
    const body = container.querySelector('.watch-hero__body');
    const cards = body.querySelector('.watch-hero__cards');
    const ghost = body.querySelector('.mood-ghost');
    expect(cards.compareDocumentPosition(ghost) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(cards.querySelectorAll('.watch-felt__hero-card')).toHaveLength(2);
  });

  it('shows backs, not faces, between hands', () => {
    const { container } = draw({ between: true });
    const text = container.querySelector('.watch-hero__cards').textContent;
    expect(text).not.toContain('A');
    expect(text).not.toContain('K');
  });

  // W4-1's deal beat: card two is never on the felt before card one.
  it('lands his cards one at a time', () => {
    const { container } = draw({ landed: 1 });
    const landed = [...container.querySelectorAll('.watch-felt__hero-card')]
      .map((el) => el.dataset.landed);
    expect(landed).toEqual(['yes', 'no']);
  });

  // W5-2's toss survives the port: the same marker the muck animation keys off.
  it('marks both cards as thrown when he mucks', () => {
    const { container } = draw({ mucking: true });
    const thrown = container.querySelectorAll('.watch-felt__hero-card[data-mucking="yes"]');
    expect(thrown).toHaveLength(2);
  });

  it('opens the thread when his face is tapped', () => {
    const onTapFace = vi.fn();
    const { container } = draw({ onTapFace });
    container.querySelector('.watch-hero__body').click();
    expect(onTapFace).toHaveBeenCalledTimes(1);
  });
});

describe('the strip', () => {
  it('is glass, and names the street when there is nothing to pay', () => {
    const { container } = draw();
    const strip = container.querySelector('.watch-hero__strip');
    expect(strip.className).toContain('glass');
    expect(strip.querySelector('.watch-felt__hero-num.is-dim').textContent).toBe('TURN');
  });

  it('names the price when there is one', () => {
    const { container } = draw({ toCall: 240 });
    expect([...container.querySelectorAll('.watch-felt__hero-lbl')].map((e) => e.textContent))
      .toContain('To call');
    expect(container.querySelector('.watch-felt__hero-num.is-gold').textContent).toBe('$240');
  });

  it('carries his action, and the holding tag only when it is given one', () => {
    const { container } = draw({ action: 'BET $240', tag: 'HOLDING' });
    expect(container.querySelector('.watch-felt__action-chip').textContent).toBe('BET $240');
    expect(container.querySelector('.watch-felt__hero-tag').textContent).toBe('HOLDING');
    expect(draw().container.querySelector('.watch-felt__hero-tag')).toBeNull();
  });
});

describe('the pinned cost', () => {
  it('is one line under his strip, with the attribute that bought it', () => {
    const { container } = draw({ cost: { key: 'FOCUS', line: 'He misjudged equity by 7% on the river' } });
    const pin = container.querySelector('.watch-hero__cost');
    expect(pin.querySelector('.watch-hero__cost-line').textContent)
      .toBe('He misjudged equity by 7% on the river');
    expect(pin.querySelector('.watch-hero__cost-key').textContent).toBe('FOCUS');
  });

  it('is absent when the hand had nothing to answer for', () => {
    expect(draw().container.querySelector('.watch-hero__cost')).toBeNull();
  });
});

// Which pose he is wearing is a FACT ABOUT THE HAND, not a design choice, so
// it is derived in one place and asserted here rather than guessed at a call site.
describe('heroPose', () => {
  it('reads the hand, in the ref\'s own order of precedence', () => {
    expect(heroPose({ mucking: true, between: false })).toBe('toss');
    expect(heroPose({ between: true })).toBe('rest');
    expect(heroPose({ pace: 'allin' })).toBe('clench');
    expect(heroPose({ heat: 70 })).toBe('clench');
    expect(heroPose({ action: { type: 'bet' } })).toBe('push');
    expect(heroPose({ action: { type: 'raise' } })).toBe('push');
    expect(heroPose({ action: { type: 'check' } })).toBe('drum');
    expect(heroPose({ action: { type: 'fold' } })).toBe('toss');
    expect(heroPose({})).toBe('hold');
  });
});

describe('betBand', () => {
  it('is three bands and nothing between', () => {
    expect(betBand(30, 100)).toBe('small');
    expect(betBand(60, 100)).toBe('mid');
    expect(betBand(150, 100)).toBe('big');
  });

  it('falls back to mid rather than inventing a band it cannot know', () => {
    expect(betBand(null, 100)).toBe('mid');
    expect(betBand(40, 0)).toBe('mid');
  });
});
