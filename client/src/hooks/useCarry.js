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
import { PHONE_ROOM } from '../components/home/flat.js';

// The held silhouette includes its pill, tilt, floating beat and floor shadow.
// Clamping only the hood clips the pill at the door and the shadow at the floor.
function heldInRoom(x, y, size, geometry) {
  const held = clampToRoom(x, y, size + 24, geometry);
  return { x: held.x, y: Math.max(size + 40, Math.min(geometry.height - 46, held.y)) };
}

/**
 * @param roomEl   the `.home-flat` element, for the scale and the origin
 * @param onDrop   (agentId, fixture | null) — called once per completed carry
 * @param enabled  off on the desk, and off while a sheet is up
 */
export function useCarry({ roomEl, onDrop, canLift, onRefuse, enabled = true, geometry = PHONE_ROOM }) {
  // { id, x, y, over } — where he is in room coordinates and what is under him.
  const [carry, setCarry] = useState(null);
  const pressRef = useRef(null);
  const carryRef = useRef(null);
  const liftedRef = useRef(false);
  const swallowClickRef = useRef(false);

  carryRef.current = carry;
  // A hand can start during the 420ms press. Check the latest snapshot.
  const liftPolicy = useRef({});
  liftPolicy.current = { canLift, onRefuse };
  const allowLift = useCallback((id) => {
    if (liftPolicy.current.canLift?.(id) !== false) return true;
    liftPolicy.current.onRefuse?.(id);
    return false;
  }, []);

  const clear = useCallback(() => {
    const press = pressRef.current;
    if (press?.timer) clearTimeout(press.timer);
    pressRef.current = null;
    carryRef.current = null;
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
    const at = toRoom(rect, clientX, clientY, geometry);
    if (!at) return;

    if (!press.lifted) {
      // Still deciding. A finger that has travelled is doing something else.
      const dx = clientX - press.clientX;
      const dy = clientY - press.clientY;
      if (Math.hypot(dx, dy) > PRESS_SLOP) clear();
      return;
    }

    const held = heldInRoom(at.x, at.y, press.size, geometry);
    setCarry({ id: press.id, x: held.x, y: held.y, over: fixtureAt(held.x, held.y, geometry), moved: true });
  }, [roomEl, clear, geometry]);

  const end = useCallback(() => {
    const press = pressRef.current;
    if (press?.awaitPress) return;
    const held = carryRef.current;
    if (press?.timer) clearTimeout(press.timer);
    pressRef.current = null;
    setCarry(null);
    if (!press?.lifted) return;
    if (press.picked) swallowClickRef.current = true;
    // A drop on the floor is a real answer — he goes back where he was — so
    // onDrop is called either way and null is the fixture that means "nowhere".
    onDrop?.(press.id, held?.over ?? null);
  }, [onDrop]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onMove = (e) => move(e.clientX, e.clientY);
    const onDown = (e) => {
      if (!pressRef.current?.picked || (e.button != null && e.button !== 0)) return;
      pressRef.current.awaitPress = false;
      move(e.clientX, e.clientY);
    };
    const onUp = () => end();
    const onCancel = () => clear();
    const onKey = (e) => { if (e.key === 'Escape') clear(); };
    const onClick = (e) => {
      if (!swallowClickRef.current) return;
      swallowClickRef.current = false;
      e.preventDefault(); e.stopPropagation();
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
    window.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('click', onClick, true);
    };
  }, [enabled, move, end, clear]);

  // Board 42's Carry action hands the room an already lifted man. Wait for a
  // fresh gesture so the pointerup that opened Home cannot place him itself.
  const pick = useCallback((agentId, at = { x: 195, y: 280 }) => {
    if (!enabled || !roomEl) return false;
    clear();
    const id = String(agentId);
    if (!allowLift(id)) return false;
    pressRef.current = { id, size: Math.max(62, geometry.bodySize * 1.1), lifted: true, picked: true, awaitPress: true };
    const held = heldInRoom(at.x, at.y, pressRef.current.size, geometry);
    setCarry({ id, ...held, over: null });
    return true;
  }, [enabled, roomEl, clear, geometry, allowLift]);

  /** The handlers one body wears. */
  const bind = useCallback((agentId, { size = 46 } = {}) => {
    if (!enabled) return {};
    return {
      onPointerDown(e) {
        // Secondary buttons are not a carry, and neither is a second finger.
        if ((e.button != null && e.button !== 0) || e.isPrimary === false) return;
        if (pressRef.current) return;
        try { e.currentTarget.setPointerCapture?.(e.pointerId); } catch { /* jsdom */ }
        const id = String(agentId);
        const press = { id, size: Math.max(62, size * 1.1), clientX: e.clientX, clientY: e.clientY, lifted: false, timer: null };
        press.timer = setTimeout(() => {
          if (pressRef.current !== press) return;
          if (!allowLift(id)) {
            liftedRef.current = true; // Swallow the click after a refused long press.
            return;
          }
          press.lifted = true;
          liftedRef.current = true;
          const rect = roomEl?.getBoundingClientRect?.();
          const at = toRoom(rect, press.clientX, press.clientY, geometry);
          const held = at ? heldInRoom(at.x, at.y, press.size, geometry) : { x: 0, y: 0 };
          setCarry({ id, x: held.x, y: held.y, over: null });
        }, LONG_PRESS_MS);
        pressRef.current = press;
      },
      onPointerMove(e) { move(e.clientX, e.clientY); },
      onPointerUp() { end(); },
      onPointerCancel() { clear(); },
      onClickCapture(e) {
        // Rule 1: the tap that opens his thread must not fire behind a carry.
        if (!liftedRef.current) return;
        liftedRef.current = false;
        e.preventDefault();
        e.stopPropagation();
      },
    };
  }, [enabled, roomEl, move, end, clear, geometry, allowLift]);

  return { carry, bind, pick, cancel: clear };
}
