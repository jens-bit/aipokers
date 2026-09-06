// client/src/components/home/HomeFlat.test.jsx — DRAFT-2
//
// The door tag, and the fact that it is opt-in.
//
// The wave-53 nav law makes the door the way to the casino ("HOME · CASINO · YOU
// are things in the world, not tabs over it… CASINO is the door"), and the ref
// hangs a tag over it — design-refs/mood-nav.jsx `DoorTap`. HOME has not been
// given the tag yet; that is the nav tree's to land on its own frames. So the
// rule this file pins is the one DRAFT-2 is entitled to: a caller who asks for
// the tag gets it, and a caller who does not is unchanged.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { HomeFlat } from './HomeFlat.jsx';
import { FLAT, F_W } from './flat.js';

describe('DRAFT-2: the door tag', () => {
  it('is not drawn unless it is asked for', () => {
    render(<HomeFlat />);
    expect(screen.queryByTestId('home-door-tag')).toBeNull();
  });

  it('names where the door goes when it is', () => {
    render(<HomeFlat doorTag="THE CASINO →" />);
    expect(screen.getByTestId('home-door-tag')).toHaveTextContent('THE CASINO');
  });

  it('sits on the door, in the room\'s own coordinate space', () => {
    render(<HomeFlat doorTag="THE CASINO →" />);
    const tag = screen.getByTestId('home-door-tag');
    // 26px above the door, and anchored by its right edge to the door's right
    // edge. Both from flat.js rather than from literals, so the tag follows the
    // door if the room is ever re-measured.
    expect(parseFloat(tag.style.right)).toBe(F_W - (FLAT.door.x + FLAT.door.w));
    expect(parseFloat(tag.style.top)).toBe(FLAT.door.y - 26);
  });

  it('stays inside the room, which clips — the arrow must not be sliced off', () => {
    render(<HomeFlat doorTag="THE CASINO →" />);
    const tag = screen.getByTestId('home-door-tag');
    // The failure this pins, caught in the 390×844 screenshot: a LEFT anchor at
    // the ref's `door.x - 4` (326) plus ~86px of nowrap text runs to 412, and
    // .home-flat hides its overflow at 390 — so the arrow was cut off the label
    // and the tag read "THE CASINO" against the wall.
    expect(tag.style.left).toBe('');
    expect(parseFloat(tag.style.right)).toBeGreaterThanOrEqual(0);
  });

  it('is above the room, so a body walking past cannot cover it', () => {
    // An occupant is stacked by his own y and those run to ~470. The tag's own
    // z-index is the ref's 260 — but the rule that matters is that it is set at
    // all, in the stylesheet, rather than left to document order.
    render(<HomeFlat doorTag="THE CASINO →" />);
    expect(screen.getByTestId('home-door-tag')).toHaveClass('home-flat__door-tag');
  });
});
