// client/src/hooks/useCarry.js — HOME-2 job 5
//
// LONG-PRESS, LIFT, CARRY, DROP.
//
// The gesture, and only the gesture: where the fixtures are is carry.js's
// arithmetic and what a drop MEANS is HomeScreen's. This file answers three
// questions and no others — has he been held long enough to come off the floor,
// where is the finger now in room coordinates, and what was under it when the
// finger let go.
//
// FOUR THINGS THAT ARE EASY TO GET WRONG HERE, and all four are why this is a
// hook rather than three handlers inlined on a body:
//
//   1 A LIFT IS NOT A TAP. Tapping a man opens his thread and has since
//     HOME-1. So the press has to hold for LONG_PRESS_MS before anything
//     happens, and once it has, the click that pointerup would otherwise fire
//     is swallowed — a thread opening behind the man you just put on the couch
//     is the worst possible outcome of a successful gesture.
//   2 A PRESS THAT SLIDES IS NOT A PRESS. A finger moves a few pixels on any
//     tap. Past PRESS_SLOP it is a scroll or a swipe and the timer is dropped,
//     so the room never lifts somebody the owner was scrolling past.
//   3 THE POINTER HAS TO BE CAPTURED. Without it the drag ends the instant the
//     finger crosses out of the 46px body it started on, which is immediately.
//   4 THE ROOM IS SCALED. Every client coordinate is divided by the scale the
//     room is actually drawn at (carry.js's `toRoom`), measured off the element
//     rather than assumed — the desk draws the same room at 1.7.

import { useCallback, useEffect, useRef, useState } from 'react';

import { LONG_PRESS_MS, PRESS_SLOP, clampToRoom, fixtureAt, toRoom } from '../components/home/carry.js';

/**
 * @param roomEl   the `.home-flat` element, for the scale and the origin
 * @param onDrop   (agentId, fixture | null) — called once per completed carry
 * @param enabled  off on the desk, and off while a sheet is up
 */
export function useCarry({ roomEl, onDrop, enabled = true }) {
  // { id, x, y, over } — where he is in room coordinates and what is under him.
  const [carry, setCarry] = useState(null);
  const pressRef = useRef(null);
  const carryRef = useRef(null);
  const liftedRef = useRef(false);

  carryRef.current = carry;

  const clear = useCallback(() => {
    const press = pressRef.current;
    if (press?.timer) clearTimeout(press.timer);
    pressRef.current = null;
    setCarry(null);
  }, []);

  useEffect(() => () => {
    if (pressRef.current?.timer) clearTimeout(pressRef.current.timer);
  }, []);

  // Off means down: a rail opening or a sheet rising must not leave a man in
  // the air with nothing listening for the finger that is holding him.
  useEffect(() => { if (!enabled) clear(); }, [enabled, clear]);

  const move = useCallback((clientX, clientY) => {
    const press = pressRef.current;
    if (!press) return;
    const rect = roomEl?.getBoundingClientRect?.();
    const at = toRoom(rect, clientX, clientY);
    if (!at) return;

    if (!press.lifted) {
      // Still deciding. A finger that has travelled is doing something else.
      const dx = clientX - press.clientX;
      const dy = clientY - press.clientY;
      if (Math.hypot(dx, dy) > PRESS_SLOP) clear();
      return;
    }

    const held = clampToRoom(at.x, at.y, press.size);
    setCarry({ id: press.id, x: held.x, y: held.y, over: fixtureAt(held.x, held.y) });
  }, [roomEl, clear]);

  const end = useCallback(() => {
    const press = pressRef.current;
    const held = carryRef.current;
    if (press?.timer) clearTimeout(press.timer);
    pressRef.current = null;
    setCarry(null);
    if (!press?.lifted) return;
    // A drop on the floor is a real answer — he goes back where he was — so
    // onDrop is called either way and null is the fixture that means "nowhere".
    onDrop?.(press.id, held?.over ?? null);
  }, [onDrop]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onMove = (e) => move(e.clientX, e.clientY);
    const onUp = () => end();
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [enabled, move, end]);

  /** The handlers one body wears. */
  const bind = useCallback((agentId, { size = 46 } = {}) => {
    if (!enabled) return {};
    return {
      onPointerDown(e) {
        // Secondary buttons are not a carry, and neither is a second finger.
        if (e.button != null && e.button !== 0) return;
        if (pressRef.current) return;
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* jsdom */ }
        const id = String(agentId);
        const press = { id, size, clientX: e.clientX, clientY: e.clientY, lifted: false, timer: null };
        press.timer = setTimeout(() => {
          if (pressRef.current !== press) return;
          press.lifted = true;
          liftedRef.current = true;
          const rect = roomEl?.getBoundingClientRect?.();
          const at = toRoom(rect, press.clientX, press.clientY);
          const held = at ? clampToRoom(at.x, at.y, size) : { x: 0, y: 0 };
          setCarry({ id, x: held.x, y: held.y, over: at ? fixtureAt(held.x, held.y) : null });
        }, LONG_PRESS_MS);
        pressRef.current = press;
      },
      onPointerMove(e) { move(e.clientX, e.clientY); },
      onPointerUp() { end(); },
      onPointerCancel() { end(); },
      onClickCapture(e) {
        // Rule 1: the tap that opens his thread must not fire behind a carry.
        if (!liftedRef.current) return;
        liftedRef.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    };
  }, [enabled, roomEl, move, end]);

  return { carry, bind, cancel: clear };
}
