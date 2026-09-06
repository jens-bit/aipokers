// GhostHands — the wave-42 hands, ported from design-refs/mood-atoms.jsx.
//
// "They are BODY LANGUAGE AT TABLE SCALE — what he is doing with the hand —
// while the face stays the emotional readout. The split matters: a face can
// only be read at 34px and above, but a hand pushing a stack forward reads
// at 20."
//
// EIGHT POSES AND NO MORE. Each is a fixed arrangement; nothing is procedural,
// so nothing can drift into a ninth pose by accident.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MoodGhost } from './MoodGhost.jsx';
import { handDetail, HAND_POSES } from './GhostHands.jsx';

describe('the hands', () => {
  it('eight poses and no more', () => {
    expect(HAND_POSES).toEqual(
      ['rest', 'hold', 'peek', 'push', 'toss', 'drum', 'clench', 'cover'],
    );
  });

  it('draws the pose it is given, and nothing when it is given none', () => {
    for (const pose of HAND_POSES) {
      const { container, unmount } = render(<MoodGhost hands={pose} size={68} />);
      expect(container.querySelector(`[data-pose="${pose}"]`)).toBeTruthy();
      unmount();
    }
    const { container } = render(<MoodGhost size={68} />);
    expect(container.querySelector('[data-pose]')).toBeNull();
  });

  // "The stack height IS the bet band" — three bands and nothing between.
  it('the pushed stack is the bet band', () => {
    const chips = (bet) => {
      const { container, unmount } = render(<MoodGhost hands="push" bet={bet} size={68} />);
      const n = container.querySelectorAll('[data-pose="push"] ellipse').length;
      unmount();
      return n;
    };
    expect(chips('small')).toBe(2);
    expect(chips('mid')).toBe(4);
    expect(chips('big')).toBe(7);
  });

  // "both hands over the face — on a win, one rakes instead"
  it('cover rakes on a win and hides on a loss', () => {
    const { container: won } = render(<MoodGhost hands="cover" won size={68} />);
    expect(won.querySelectorAll('[data-pose="cover"] ellipse').length).toBe(5);
    const { container: lost } = render(<MoodGhost hands="cover" size={68} />);
    expect(lost.querySelectorAll('[data-pose="cover"] ellipse').length).toBe(0);
  });

  // A folded opponent's cards are the one thing the fish tank never shows, so
  // the toss carries card BACKS and never a face.
  it('the toss throws backs, never faces', () => {
    const { container } = render(<MoodGhost hands="toss" size={68} />);
    const toss = container.querySelector('[data-pose="toss"]');
    expect(toss.querySelectorAll('rect').length).toBeGreaterThan(0);
    expect(toss.querySelector('text')).toBeNull();
  });

  it('a hand becomes a plain mitten below seat scale', () => {
    expect(handDetail(72)).toBe(2);
    expect(handDetail(34)).toBe(1);
    expect(handDetail(20)).toBe(0);

    const fingers = (size) => {
      const { container, unmount } = render(<MoodGhost hands="rest" size={size} />);
      const n = container.querySelectorAll('[data-pose="rest"] circle').length;
      unmount();
      return n;
    };
    expect(fingers(68)).toBe(6);   // three per hand
    expect(fingers(20)).toBe(0);
  });
});
