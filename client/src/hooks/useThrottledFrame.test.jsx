// client/src/hooks/useThrottledFrame.test.jsx — BUGS-A job 8

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';

import { FRAME_MS, useOnScreen, useThrottled } from './useThrottledFrame.js';

function Shown({ value, active = true }) {
  const shown = useThrottled(value, FRAME_MS, { active });
  return <span data-testid="shown">{String(shown)}</span>;
}

const shown = () => screen.getByTestId('shown').textContent;

describe('BUGS-A job 8 · one repaint per second', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the first value at once — a frame does not open blank', () => {
    render(<Shown value="a" />);
    expect(shown()).toBe('a');
  });

  it('holds a change back until the beat, then shows the NEWEST one', () => {
    const view = render(<Shown value={1} />);
    expect(shown()).toBe('1');

    // Three pushes inside one second: the frame must not paint three times.
    view.rerender(<Shown value={2} />);
    view.rerender(<Shown value={3} />);
    view.rerender(<Shown value={4} />);
    expect(shown()).toBe('1');

    act(() => { vi.advanceTimersByTime(FRAME_MS); });
    // A throttle, not a debounce: the last state of the hand, not the first.
    expect(shown()).toBe('4');
  });

  it('a frozen frame keeps what it had, and catches up the moment it wakes', () => {
    const view = render(<Shown value={1} active={false} />);
    expect(shown()).toBe('1');

    view.rerender(<Shown value={2} active={false} />);
    act(() => { vi.advanceTimersByTime(5 * FRAME_MS); });
    expect(shown()).toBe('1');

    // Coming back is the moment the value matters, so it does not wait a beat.
    view.rerender(<Shown value={2} active />);
    expect(shown()).toBe('2');
  });
});

// ── on screen ───────────────────────────────────────────────────────────────

function Awake() {
  const ref = useRef(null);
  const awake = useOnScreen(ref);
  return <span ref={ref} data-testid="awake">{awake ? 'awake' : 'paused'}</span>;
}

describe('BUGS-A job 8 · what is not on screen does not paint', () => {
  const realIO = global.IntersectionObserver;
  let observers;

  beforeEach(() => {
    observers = [];
    global.IntersectionObserver = class {
      constructor(cb) { this.cb = cb; observers.push(this); }
      observe() {}
      disconnect() {}
      fire(isIntersecting) { act(() => this.cb([{ isIntersecting }])); }
    };
  });
  afterEach(() => {
    global.IntersectionObserver = realIO;
    Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
  });

  it('starts awake, because a frame that opens blank is the worse failure', () => {
    render(<Awake />);
    expect(screen.getByTestId('awake').textContent).toBe('awake');
  });

  it('pauses when it scrolls out of the room and wakes when it comes back', () => {
    render(<Awake />);
    observers[0].fire(false);
    expect(screen.getByTestId('awake').textContent).toBe('paused');
    observers[0].fire(true);
    expect(screen.getByTestId('awake').textContent).toBe('awake');
  });

  it('pauses when the owner swipes the Mini App away', () => {
    render(<Awake />);
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(screen.getByTestId('awake').textContent).toBe('paused');
  });

  it('stays awake where the browser cannot answer', () => {
    global.IntersectionObserver = undefined;
    render(<Awake />);
    expect(screen.getByTestId('awake').textContent).toBe('awake');
  });
});
