// GhostHands — the ref's fist, ported from design-refs/mood-atoms.jsx (design 44+).
//
// "They are BODY LANGUAGE AT TABLE SCALE — what he is doing with the hand —
// while the face stays the emotional readout. The split matters: a face can
// only be read at 34px and above, but a hand pushing a stack forward reads
// at 20."
//
// NINE POSES AND NO MORE. Each is a fixed arrangement of the same fist; nothing
// is procedural, so nothing can drift into a tenth pose by accident.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  ghostHands, GhostHandLayer, HAND_POSES, HERO_GRIP, SEAT_GRIP, handStroke, handW,
} from './GhostHands.jsx';

const draw = (props) => render(<GhostHandLayer {...props} />);

describe('the hands', () => {
  it('nine poses and no more', () => {
    expect(HAND_POSES).toEqual(
      ['rest', 'hold', 'peek', 'push', 'toss', 'drum', 'clench', 'cover', 'raise'],
    );
  });

  it('draws the pose it is given', () => {
    for (const pose of HAND_POSES) {
      const { container, unmount } = draw({ pose, size: 96 });
      expect(container.querySelector(`[data-pose="${pose}"]`)).toBeTruthy();
      unmount();
    }
  });

  // The megaprompt's vocabulary calls the winning pose `rake`; the ref draws it
  // as `raise` and has no raking hand at all. One pose, both names.
  it('takes rake as the name for the winning pose', () => {
    const { container } = draw({ pose: 'rake', size: 96 });
    expect(container.querySelector('[data-pose="raise"]')).toBeTruthy();
  });

  // "The grammar of the pair reads at a glance: hands go UP AND OUT on a win,
  // IN OVER THE FACE on a loss." (52g/52h) — so the two must not be the same
  // arrangement, and the winner's must be the higher one.
  it('goes up and out on a win, in over the face on a loss', () => {
    const y = (pose) => {
      const { container, unmount } = draw({ pose, size: 96 });
      const t = container.querySelector(`[data-pose="${pose}"] g`).getAttribute('transform');
      unmount();
      return Number(/translate\([-\d.]+ ([-\d.]+)\)/.exec(t)[1]);
    };
    expect(y('raise')).toBeLessThan(y('cover'));
  });

  // A folded seat's cards are the one thing the fish tank never shows, so the
  // toss carries card BACKS and never a face.
  it('the toss throws backs, never faces', () => {
    const { container } = draw({ pose: 'toss', size: 96 });
    const toss = container.querySelector('[data-pose="toss"]');
    expect(toss.querySelectorAll('rect').length).toBe(2);
    expect(toss.querySelector('text')).toBeNull();
  });

  // The fist is ONE drawing at every size: a pale fill, a thick dark outline and
  // two knuckle strokes. The placeholder mitten dropped its fingers below seat
  // scale and left a blob; this drops nothing.
  it('is a pale fist with a thick outline and two knuckles, at every size', () => {
    for (const size of [96, 40, 20]) {
      const { container, unmount } = draw({ pose: 'hold', size });
      const fists = container.querySelectorAll('[data-pose="hold"] path:not(.ghost-hands__knuckle)');
      expect(fists.length).toBe(2);
      expect(fists[0].getAttribute('fill')).toBe('#BDBDBD');
      expect(fists[0].getAttribute('stroke')).toBe('#16191B');
      // Non-scaling, so the outline is the same weight whatever the transform.
      expect(fists[0].getAttribute('vector-effect')).toBe('non-scaling-stroke');
      expect(container.querySelectorAll('.ghost-hands__knuckle').length).toBe(4);
      unmount();
    }
  });

  // The drawing does not change with size; the STROKE does. That is the whole
  // size ladder, which is why nothing has to be re-authored per seat scale.
  it('carries its size in the stroke, not in the geometry', () => {
    expect(handStroke(96)).toBe(3);
    expect(handStroke(48)).toBe(2.2);
    expect(handStroke(40)).toBe(1.5);
    // ~27.5% of the sprite, floored so a small seat still has a hand.
    expect(handW(96)).toBeCloseTo(26.4);
    expect(handW(40)).toBeCloseTo(11);
    expect(handW(20)).toBe(9);
  });

  // "GRIPS are the fanned pair's bottom OUTER corners, measured not guessed."
  // A seat's cards are proportionally larger, so it carries its own grip — one
  // number set per card layout, not one guess for the whole system.
  it('grips the hero pair and a seat pair at their own corners', () => {
    expect(HERO_GRIP).toEqual({ l: 12, r: 68, y: 89 });
    expect(SEAT_GRIP).toEqual({ l: 7, r: 73, y: 84 });
    expect(SEAT_GRIP.r - SEAT_GRIP.l).toBeGreaterThan(HERO_GRIP.r - HERO_GRIP.l);

    const at = (grip) => {
      const { container, unmount } = draw({ pose: 'hold', size: 40, grip });
      const t = container.querySelector('[data-pose="hold"] g').getAttribute('transform');
      unmount();
      return t;
    };
    expect(at(SEAT_GRIP)).toContain('translate(7 84)');
    expect(at(HERO_GRIP)).toContain('translate(12 89)');
  });

  // Both hands are the SAME fist, mirrored — the offset system this replaced let
  // the second hand drift onto the card face.
  it('mirrors one fist rather than drawing two', () => {
    const { container } = draw({ pose: 'hold', size: 96 });
    const [left, right] = container.querySelectorAll('[data-pose="hold"] > g');
    expect(left.getAttribute('transform')).toContain('scale(');
    expect(right.getAttribute('transform')).toMatch(/scale\(-/);
  });

  it('is a layer of its own, over the cards, and never catches a tap', () => {
    const { container } = draw({ pose: 'hold', size: 96 });
    const svg = container.querySelector('svg.ghost-hands');
    expect(svg.getAttribute('width')).toBe('96');
    expect(svg.style.pointerEvents).toBe('none');
    expect(svg.getAttribute('aria-hidden')).toBe('true');
  });

  it('is drawable straight into another svg', () => {
    expect(ghostHands({ pose: 'push', size: 40, grip: SEAT_GRIP })).toBeTruthy();
  });
});
