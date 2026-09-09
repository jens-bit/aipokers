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
