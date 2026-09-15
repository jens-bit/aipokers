import { act, fireEvent, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useCarry } from './useCarry.js';

const roomEl = { getBoundingClientRect: () => ({ left: 0, top: 0, width: 390, height: 612 }) };
it('AGENT-1: Carry from the agent view lifts him until the next placement gesture', () => {
  const onDrop = vi.fn();
  const { result } = renderHook(() => useCarry({ roomEl, onDrop }));
  act(() => result.current.pick('a1'));
  expect(result.current.carry.id).toBe('a1');
  fireEvent.pointerUp(window); // The click which opened Home cannot drop him.
  expect(onDrop).not.toHaveBeenCalled();
  // jsdom has no PointerEvent constructor; MouseEvent carries the coordinates.
  fireEvent(window, new MouseEvent('pointerdown', { clientX: 55, clientY: 385 }));
  fireEvent.pointerUp(window);
  expect(onDrop).toHaveBeenCalledWith('a1', 'couch');
  expect(result.current.carry).toBeNull();
});
it('AGENT-1: cancelling a picked-up agent makes no placement request', () => {
  const onDrop = vi.fn();
  const { result } = renderHook(() => useCarry({ roomEl, onDrop }));
  act(() => result.current.pick('a1'));
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(result.current.carry).toBeNull();
  fireEvent.pointerUp(window);
  expect(onDrop).not.toHaveBeenCalled();
});

it('BUG-134: a known mid-hand agent refuses before either kind of lift', () => {
  vi.useFakeTimers();
  const canLift = vi.fn(() => false), onRefuse = vi.fn(), onDrop = vi.fn();
  const { result, unmount } = renderHook(() => useCarry({ roomEl, onDrop, canLift, onRefuse }));
  try {
    const bind = result.current.bind('a1');
    act(() => bind.onPointerDown({ button: 0, isPrimary: true, pointerId: 1, clientX: 200, clientY: 250, currentTarget: { setPointerCapture() {} } }));
    act(() => vi.advanceTimersByTime(420));
    expect(result.current.carry).toBeNull();
    expect(onRefuse).toHaveBeenCalledWith('a1');
    act(() => bind.onPointerUp());
    expect(onDrop).not.toHaveBeenCalled();
    let picked; act(() => { picked = result.current.pick('a1'); });
    expect(picked).toBe(false);
    expect(result.current.carry).toBeNull();
  } finally { unmount(); vi.useRealTimers(); }
});
it('BUG-134: pointer cancellation cannot place a carried agent', () => {
  const onDrop = vi.fn();
  const { result } = renderHook(() => useCarry({ roomEl, onDrop }));
  act(() => result.current.pick('a1'));
  fireEvent(window, new MouseEvent('pointerdown', { clientX: 55, clientY: 385 }));
  act(() => result.current.bind('a1').onPointerCancel());
  expect(result.current.carry).toBeNull();
  expect(onDrop).not.toHaveBeenCalled();
});
it('BUG-134: a hand beginning during the press uses the latest lift policy', () => {
  vi.useFakeTimers(); const onRefuse=vi.fn();
  const {result,rerender,unmount}=renderHook(({allowed})=>useCarry({roomEl,canLift:()=>allowed,onRefuse}),{initialProps:{allowed:true}});
  try {
    act(()=>result.current.bind('a1').onPointerDown({button:0,clientX:200,clientY:250,currentTarget:{}}));
    rerender({allowed:false}); act(()=>vi.advanceTimersByTime(420));
    expect(result.current.carry).toBeNull(); expect(onRefuse).toHaveBeenCalledTimes(1);
  } finally {unmount();vi.useRealTimers();}
});

// ── BUG-134 · the deferred grab ──────────────────────────────────────────────
//
// BUG-211 made the kitchen table always live, so refusing a mid-hand lift
// outright would have ended Carry for a solo household — the one household
// the rule is for. A refused grab is remembered instead, and honoured the
// moment the hand finishes. These two cases are the whole mechanism: where he
// goes depends on whether the owner is still holding him.

const press = (bind, over = {}) => bind.onPointerDown({
  button: 0, isPrimary: true, pointerId: 1, clientX: 200, clientY: 250,
  currentTarget: { setPointerCapture() {} }, ...over,
});

it('BUG-134: a grab refused mid-hand lands in the finger still holding him when the hand ends', () => {
  vi.useFakeTimers();
  let live = true;
  const onRefuse = vi.fn(), onDrop = vi.fn();
  const { result, rerender, unmount } = renderHook(
    () => useCarry({ roomEl, onDrop, canLift: () => !live, onRefuse }),
  );
  try {
    act(() => press(result.current.bind('a1')));
    act(() => vi.advanceTimersByTime(420));
    // Refused, and nothing is in the air — but the finger has not moved.
    expect(onRefuse).toHaveBeenCalledWith('a1');
    expect(result.current.carry).toBeNull();

    // The hand ends. HomeScreen asks again.
    live = false;
    rerender();
    let picked; act(() => { picked = result.current.pick('a1'); });
    expect(picked).toBe(true);
    expect(result.current.carry.id).toBe('a1');

    // He came up INTO the gesture that was already happening: he follows the
    // finger from here, and this pointerup is the drop rather than being
    // swallowed while he waits for a press that is already happening.
    const bind = result.current.bind('a1');
    act(() => bind.onPointerMove({ clientX: 55, clientY: 385 }));
    expect(result.current.carry.over).toBe('couch');
    act(() => bind.onPointerUp());
    expect(onDrop).toHaveBeenCalledWith('a1', 'couch');
    expect(result.current.carry).toBeNull();
  } finally { unmount(); vi.useRealTimers(); }
});

it('BUG-134: a grab refused mid-hand waits for a fresh press once the finger has gone', () => {
  vi.useFakeTimers();
  let live = true;
  const onRefuse = vi.fn(), onDrop = vi.fn();
  const { result, rerender, unmount } = renderHook(
    () => useCarry({ roomEl, onDrop, canLift: () => !live, onRefuse }),
  );
  try {
    act(() => press(result.current.bind('a1')));
    act(() => vi.advanceTimersByTime(420));
    expect(onRefuse).toHaveBeenCalledWith('a1');
    // The owner lets go and goes back to watching the hand.
    act(() => { result.current.bind('a1').onPointerUp(); });
    expect(onDrop).not.toHaveBeenCalled();

    live = false;
    rerender();
    act(() => { result.current.pick('a1'); });
    expect(result.current.carry.id).toBe('a1');

    // Nothing is holding him, so the next stray pointerup must not place him —
    // the same guard the roster's CARRY button has always had.
    act(() => { fireEvent.pointerUp(window); });
    expect(onDrop).not.toHaveBeenCalled();
    expect(result.current.carry.id).toBe('a1');

    fireEvent(window, new MouseEvent('pointerdown', { clientX: 55, clientY: 385 }));
    fireEvent.pointerUp(window);
    expect(onDrop).toHaveBeenCalledWith('a1', 'couch');
  } finally { unmount(); vi.useRealTimers(); }
});

it('BUG-134: the finger may travel while the grab waits, and he comes up under it', () => {
  vi.useFakeTimers();
  let live = true;
  const onRefuse = vi.fn(), onDrop = vi.fn();
  const { result, rerender, unmount } = renderHook(
    () => useCarry({ roomEl, onDrop, canLift: () => !live, onRefuse }),
  );
  try {
    const bind = result.current.bind('a1');
    act(() => press(bind));
    act(() => vi.advanceTimersByTime(420));
    expect(onRefuse).toHaveBeenCalledWith('a1');

    // Still waiting on the hand, the owner starts carrying him to the couch.
    // Travel past PRESS_SLOP cancels a press that has NOT been answered — it
    // is a scroll — but this one has, so it tracks the finger instead.
    act(() => bind.onPointerMove({ clientX: 55, clientY: 385 }));
    expect(result.current.carry).toBeNull();

    // The hand ends. He comes up where the finger actually is, over the couch,
    // rather than back where the press began — and the couch lights at once,
    // without waiting for another move.
    live = false;
    rerender();
    act(() => { result.current.pick('a1', { x: 195, y: 280 }); });
    expect(result.current.carry.id).toBe('a1');
    expect(result.current.carry.over).toBe('couch');

    act(() => bind.onPointerUp());
    expect(onDrop).toHaveBeenCalledWith('a1', 'couch');
  } finally { unmount(); vi.useRealTimers(); }
});
