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
