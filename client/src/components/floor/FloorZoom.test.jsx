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

import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

describe('BUG-165: the zoom only shows the server action deadline', () => {
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-09-10T10:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });
  const agentFor = (home, game = {}) => ({
    ...playingAgent,
    ...(home ? { presence: 'resting', activeTableId: null, homeTableId: 'kitchen' } : {}),
    liveGame: { ...playingAgent.liveGame, ...(home ? { tableId: 'kitchen', home: true } : {}), ...game },
  });

  it.each([true, false])('BUG-165: absent, invalid and expired clocks invent no 12s (home=%s)', home => {
    const { rerender, unmount } = renderZoom({ agent: agentFor(home) });
    for (const deadline of [undefined, null, NaN, Infinity, '12000', Date.now() - 500, Date.now()]) {
      rerender(<FloorZoom agent={agentFor(home, { actionDeadline: deadline })} />);
      expect(screen.queryByText(/^\d+s$/)).toBeNull();
      expect(screen.getByText(home ? 'Home game' : '$480', { exact: true })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Watch the table' })).toBeInTheDocument();
    }
    unmount();
  });

  it.each([true, false])('BUG-165: a real deadline counts down and disappears at expiry (home=%s)', home => {
    const { unmount } = renderZoom({ agent: agentFor(home, { actionDeadline: Date.now() + 2400 }) });
    expect(screen.getByText('3s', { exact: true })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(500); });
    expect(screen.getByText('2s', { exact: true })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByText('1s', { exact: true })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText(/^\d+s$/)).toBeNull();
    unmount();
  });

  it('BUG-165: replacing or removing a deadline follows the new snapshot without restarting twelve seconds', () => {
    const { rerender, unmount } = renderZoom({ agent: agentFor(false, { actionDeadline: Date.now() + 5000 }) });
    expect(screen.getByText('5s', { exact: true })).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(1000); });
    rerender(<FloorZoom agent={agentFor(false, { actionDeadline: Date.now() + 1800 })} />);
    expect(screen.getByText('2s', { exact: true })).toBeInTheDocument();
    rerender(<FloorZoom agent={agentFor(false, { actionDeadline: null })} />);
    expect(screen.queryByText(/^\d+s$/)).toBeNull();
    act(() => { vi.advanceTimersByTime(5000); });
    expect(screen.queryByText(/^\d+s$/)).toBeNull();
    unmount();
  });

  it('BUG-165: completed and waiting hands do not revive a stale future deadline', () => {
    const deadline = Date.now() + 7000;
    const { rerender, unmount } = renderZoom({ agent: agentFor(false, { actionDeadline: deadline, street: 'complete' }) });
    expect(screen.queryByText(/^\d+s$/)).toBeNull();
    rerender(<FloorZoom agent={agentFor(false, { actionDeadline: deadline, street: 'waiting' })} />);
    expect(screen.queryByText(/^\d+s$/)).toBeNull();
    unmount();
  });

  it('BUG-165: expiry between render and the timer effect cannot leave one second stuck on screen', () => {
    const deadline = Date.now() + 1;
    vi.spyOn(Date, 'now').mockReturnValueOnce(deadline - 1).mockReturnValue(deadline + 1);
    const { unmount } = renderZoom({ agent: agentFor(false, { actionDeadline: deadline }) });
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.queryByText(/^\d+s$/)).toBeNull();
    unmount();
  });
});

it('BUG-162: Home players reached from the casino zoom can Watch without dollar practice winnings', async()=>{
  const onWatch=vi.fn(), onDeploy=vi.fn();
  renderZoom({agent:{...playingAgent,presence:'resting',activeTableId:null,homeTableId:'kitchen',liveGame:{tableId:'kitchen',home:true,board:['Ah','Kd','2c'],pot:480}},onWatch,onDeploy});
  expect(screen.queryByText('$480',{exact:true})).toBeNull();
  expect(screen.getByText('Home game',{exact:true})).toBeInTheDocument();
  expect(screen.queryByRole('button',{name:'Deal him in'})).toBeNull();
  await userEvent.setup().click(screen.getByRole('button',{name:'Watch the table'}));
  expect(onWatch).toHaveBeenCalledOnce();
  expect(onDeploy).not.toHaveBeenCalled();
});

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
