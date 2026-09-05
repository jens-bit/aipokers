// GhostFace — the wave-41 faces, ported from design-refs/mood-atoms.jsx for
// WATCH-6, and the MoodGhost vehicle that draws them.
//
// The v5 hero and the ceremony both need more of the atom than the client had:
// `heat` to pick the face's intensity tier and `event` for a transient
// expression. These assert the rules the ref states outright — the silhouette
// never changes, and detail is subtractive with size. The hands are next door,
// in GhostHands.test.jsx.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { MoodGhost } from './MoodGhost.jsx';
import { faceTier, faceDetail, FACE_EVENTS } from './GhostFace.jsx';

const MOODS = ['confident', 'neutral', 'frustrated', 'tilted', 'sulking'];

describe('the face tiers', () => {
  it('five states x three tiers, and heat is what picks the tier', () => {
    expect(faceTier(0)).toBe('low');
    expect(faceTier(33)).toBe('low');
    expect(faceTier(34)).toBe('mid');
    expect(faceTier(66)).toBe('mid');
    expect(faceTier(67)).toBe('high');
    expect(faceTier(100)).toBe('high');
  });

  it('draws the tier heat asked for, in every state', () => {
    for (const mood of MOODS) {
      for (const [heat, tier] of [[10, 'low'], [45, 'mid'], [90, 'high']]) {
        const { container, unmount } = render(<MoodGhost mood={mood} heat={heat} size={48} />);
        expect(container.querySelector(`[data-face="${mood}"]`).getAttribute('data-tier'))
          .toBe(tier);
        unmount();
      }
    }
  });

  // "The silhouette NEVER changes; only eyes, brows and the glow do."
  it('never changes the silhouette between tiers', () => {
    const bodyOf = (heat) => {
      const { container, unmount } = render(<MoodGhost mood="tilted" heat={heat} size={48} />);
      const d = [...container.querySelectorAll('path')]
        .map((el) => el.getAttribute('d'))
        .find((v) => v && v.startsWith('M40 12'));
      unmount();
      return d;
    };
    expect(bodyOf(10)).toBe(bodyOf(90));
  });

  // Detail is SUBTRACTIVE, in a fixed order, and the thread size keeps eyes only.
  it('drops detail with size rather than shrinking it', () => {
    expect(faceDetail(46)).toBe(3);
    expect(faceDetail(38)).toBe(2);
    expect(faceDetail(34)).toBe(1);
    expect(faceDetail(24)).toBe(0);

    const brows = (size) => {
      const { container, unmount } = render(<MoodGhost mood="frustrated" heat={90} size={size} />);
      const n = container.querySelectorAll('[data-face="frustrated"] path').length;
      unmount();
      return n;
    };
    expect(brows(48)).toBeGreaterThan(0);
    expect(brows(24)).toBe(0);
  });
});

describe('the six events', () => {
  it('an event replaces the eyes wholesale', () => {
    for (const event of FACE_EVENTS) {
      const { container, unmount } = render(<MoodGhost mood="neutral" event={event} size={48} />);
      expect(container.querySelector(`[data-event="${event}"]`)).toBeTruthy();
      // The state's own face is not drawn underneath it.
      expect(container.querySelector('[data-face]')).toBeNull();
      unmount();
    }
  });

  it('an unknown event is ignored rather than blanking his face', () => {
    const { container } = render(<MoodGhost mood="confident" event="delighted" size={48} />);
    expect(container.querySelector('[data-face="confident"]')).toBeTruthy();
  });
});

// Every caller that predates WATCH-6 passes none of the new props, and has to
// keep getting the face the atom always drew.
it('is unchanged for a caller that asks for nothing new', () => {
  const { container } = render(<MoodGhost mood="confident" />);
  const face = container.querySelector('[data-face="confident"]');
  expect(face.getAttribute('data-tier')).toBe('mid');
  expect(container.querySelector('[data-pose]')).toBeNull();
  expect(container.querySelector('[data-event]')).toBeNull();
});
