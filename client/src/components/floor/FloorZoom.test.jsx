// client/src/components/floor/FloorZoom.test.jsx — FIX-4
//
// Mobile playtest 2026-09-05: in the agent view, the speech bubble ("someone
// ran out of chips — session over · 2 hands flagged") was drawn on top of the
// back button, so the way out of the zoom was under the thing the agent was
// saying.
//
// Root cause: .floor-zoom__bubble-wrap is z-index 5 and starts at y=30;
// .floor-zoom__back is a 34px control at y=10, so the two boxes overlap and
// the bubble won. Nothing moves — the control is raised above the bubble
// instead, and the bubble's own text begins below y=44, so only its rounded
// corner passes behind the button.
//
// jsdom does no layout, so the overlap is arithmetic on the declared boxes and
// the stacking is read off getComputedStyle with floor.css loaded.

import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import '../../styles/floor.css';

import { FloorZoom } from './FloorZoom.jsx';
import { playingAgent } from '../../test/fixtures/floor2.js';
import { telegram } from '../../test/harness.js';

const renderZoom = (props = {}) => render(
  <FloorZoom
    agent={playingAgent}
    onBack={() => {}}
    onChat={() => {}}
    onWatch={() => {}}
    onProfile={() => {}}
    onDeploy={() => {}}
    {...props}
  />,
);

const px = (v) => parseFloat(v) || 0;

describe('FIX-4 the zoom back button and the speech bubble', () => {
  beforeEach(() => { telegram.signIn(); });

  it('FIX-4: they do overlap, which is why the stacking has to be decided', () => {
    const { container } = renderZoom();
    const back = container.querySelector('.floor-zoom__back');
    const bubble = container.querySelector('.floor-zoom__bubble-wrap');
    const backStyle = getComputedStyle(back);

    const backTop = px(backStyle.top);
    const backBottom = backTop + px(backStyle.height);
    const bubbleTop = px(bubble.style.top);

    expect(bubbleTop).toBeLessThan(backBottom);
    // ...and horizontally too: the bubble's left inset is inside the control.
    expect(px(getComputedStyle(bubble).left)).toBeLessThan(px(backStyle.left) + px(backStyle.width));
  });

  it('FIX-4: the back button is painted above the bubble', () => {
    const { container } = renderZoom();
    const back = Number(getComputedStyle(container.querySelector('.floor-zoom__back')).zIndex);
    const bubble = Number(getComputedStyle(container.querySelector('.floor-zoom__bubble-wrap')).zIndex);

    expect(Number.isNaN(back)).toBe(false);
    expect(back).toBeGreaterThan(bubble);
  });

  it('FIX-4: nothing else moved — the ghost and the bubble keep their tops', () => {
    const { container } = renderZoom();
    // playingAgent has a liveGame, which is the layout the playtest saw.
    expect(px(container.querySelector('.floor-zoom__bubble-wrap').style.top)).toBe(30);
    expect(px(container.querySelector('.floor-zoom__ghost').style.top)).toBe(198);
  });

  it('FIX-4: the way out is still a real control', () => {
    const { container } = renderZoom();
    const back = container.querySelector('.floor-zoom__back');
    expect(back.getAttribute('aria-label')).toBe('Back to the floor');
    expect(getComputedStyle(back).pointerEvents).not.toBe('none');
  });
});
