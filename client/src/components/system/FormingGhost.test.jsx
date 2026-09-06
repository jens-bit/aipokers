// client/src/components/system/FormingGhost.test.jsx — DRAFT-2
//
// The ref's claim about this component is testable, and it is the only thing
// worth testing here: ONE ATOM, FOUR PARAMETER SETS. If a stage ever stops being
// a MoodGhost, he has started drifting from the creature the rest of the product
// renders — which is exactly what the old hand-rolled FormingGhost did.

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FormingGhost, DRAFT_STAGES, DRAFT_STAGE_COUNT, draftStage } from './FormingGhost.jsx';
import { HOODS, GLOWS } from '../../lib/identity.js';

const ghostOf = (c) => c.querySelector('svg.mood-ghost');

describe('DRAFT-2: he forms out of one atom', () => {
  it('draws every stage with the product ghost, not a second drawing', () => {
    for (const s of DRAFT_STAGES) {
      const { container, unmount } = render(<FormingGhost stage={s.n} />);
      expect(ghostOf(container), `stage ${s.n} is not a MoodGhost`).toBeTruthy();
      unmount();
    }
  });

  it('is four stages, and the last one is his colour', () => {
    expect(DRAFT_STAGE_COUNT).toBe(4);
    expect(DRAFT_STAGES.at(-1).glow).toBe(GLOWS[1].c);
    expect(DRAFT_STAGES.at(-1).cap).toBe('his colour');
  });

  it('starts as a silhouette: a near-black hood under a near-black glow', () => {
    const [first] = DRAFT_STAGES;
    // Both ends of the hood gradient and the glow are near-black, which is the
    // whole trick — there is nothing to see but an outline.
    for (const hex of [first.hood.top, first.hood.bot, first.glow]) {
      const lum = parseInt(hex.slice(1, 3), 16) + parseInt(hex.slice(3, 5), 16) + parseInt(hex.slice(5, 7), 16);
      expect(lum, `${hex} is too light to read as a silhouette`).toBeLessThan(90);
    }
  });

  it('puts him in a real hood before it lights his eyes', () => {
    // Stage 2 is the hood with a dead glow — a body, no eyes. Stage 3 lights them.
    expect(DRAFT_STAGES[1].hood).toBe(HOODS[1]);
    expect(DRAFT_STAGES[1].halo).toBe(0);
    expect(DRAFT_STAGES[2].hood).toBe(HOODS[1]);
    expect(DRAFT_STAGES[2].halo).toBeGreaterThan(0);
  });

  it('carries the stage on the element, so the room above the sheet is readable', () => {
    const { container } = render(<FormingGhost stage={3} />);
    expect(container.querySelector('[data-stage="3"]')).toBeTruthy();
  });
});

describe('DRAFT-2: the stage is a count of answers', () => {
  it('is a silhouette before he has been told anything', () => {
    expect(draftStage(0)).toBe(1);
  });

  it('advances one stage per answer', () => {
    expect(draftStage(1)).toBe(2);
    expect(draftStage(2)).toBe(3);
    expect(draftStage(3)).toBe(4);
  });

  it('lets the conversation run longer than four turns without running off the end', () => {
    // A draft is allowed to take nine questions. He is simply finished forming
    // before it ends — the alternative is an undefined stage and a blank room.
    expect(draftStage(9)).toBe(DRAFT_STAGE_COUNT);
    expect(draftStage(400)).toBe(DRAFT_STAGE_COUNT);
  });

  it('survives a caller with no count at all', () => {
    expect(draftStage(undefined)).toBe(1);
    expect(draftStage(NaN)).toBe(1);
  });
});
