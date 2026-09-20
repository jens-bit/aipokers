import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PHONE_ROOM } from './flat.js';
import { HOME_ITEM_TRIP_MS } from '../../../../src/shared/homeCare.js';

export const HOME_WALK_MS = HOME_ITEM_TRIP_MS / 3;
export const HOME_ITEM_WAIT_MS = 15_000;
// Display memory only: no read acknowledgment, inventory change or synthetic
// action. An owner HOME_STATE repeats this accepted event on every snapshot.
const consumed = new Map();
function remember(scope, key) {
  if (scope === null) return;
  const events = consumed.get(scope) ?? new Set();
  events.add(key);
  while (events.size > 128) events.delete(events.values().next().value);
  consumed.delete(scope);
  consumed.set(scope, events);
  while (consumed.size > 8) consumed.delete(consumed.keys().next().value);
}
function eligible(agent, at, carriedId) {
  return !!agent && !!at && !agent.guest && !agent.archived && !agent.retiring
    && (agent.location?.where ?? 'home') === 'home' && !agent.activeTableId
    && agent.routine?.key !== 'plays' && at.seat == null && at.spot !== 'door:born'
    && String(agent.id) !== String(carriedId);
}
const overlap = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
const footprint = (at, size) => ({ left: at.x - size / 2 - 11, right: at.x + size / 2 + 11,
  top: at.y - size - 26, bottom: at.y + 3 });

/** One authored fridge trip at a time; ordinary homePositions keeps every other
 * resident and the return place reserved. The walk is never a routine guess. */
export function useHomeItemMotion({ agents, positions, geometry = PHONE_ROOM, ownerScope = null, carriedId = null }) {
  const scope = ownerScope == null ? null : String(ownerScope);
  const machine = useRef({ scope, baseline: new Map(), queue: [], active: null });
  const [active, setActive] = useState(null);
  const [queueWake, setQueueWake] = useState(0);
  const fridge = useMemo(() => ({
    // mood-home.jsx STAND.fridge: 284,200 beside the 250,94 / 54x86 door.
    x: geometry.flat.fridge.x + geometry.flat.fridge.w * 34 / 54,
    y: geometry.flat.fridge.y + geometry.flat.fridge.h + 20,
    spot: 'fridge:fetch', seat: null,
  }), [geometry]);

  useLayoutEffect(() => {
    if (machine.current.scope !== scope) machine.current = { scope, baseline: new Map(), queue: [], active: null };
    const m = machine.current;
    const roster = new Map(agents.map(a => [String(a.id), a]));
    const canFetch = id => eligible(roster.get(id), positions.get(id), carriedId);
    const clear = id => ![...positions].some(([other, at]) => other !== id && at.spot !== 'door:away'
      && overlap(footprint(fridge, geometry.width === PHONE_ROOM.width ? 44 : geometry.bodySize),
        footprint(at, at.seat == null ? geometry.bodySize : geometry.seatedSize)));
    for (const agent of agents) {
      const event = agent.homeItem;
      // REST deliberately omits this field. Only a typed owner HOME_STATE
      // establishes the baseline, and first/cold snapshots never invent a trip.
      if (event !== null && (!['beer', 'snack'].includes(event?.item) || !Number.isFinite(event?.at) || event.at <= 0)) continue;
      const id = String(agent.id);
      if (!m.baseline.has(id)) {
        m.baseline.set(id, event?.at ?? 0);
        if (event) remember(scope, JSON.stringify([id, event.item, event.at]));
        continue;
      }
      if (!event || event.at <= m.baseline.get(id)) continue;
      m.baseline.set(id, event.at);
      const key = JSON.stringify([id, event.item, event.at]);
      const repeated = consumed.get(scope)?.has(key);
      remember(scope, key);
      // Compare server stamps only to each other, never to the phone's clock.
      // Receipt time bounds a blocked queue; it does not decide freshness.
      if (!repeated && canFetch(id)) {
        m.queue.push({ id, item: event.item, at: event.at, key, scope, expiresAt: Date.now() + HOME_ITEM_WAIT_MS });
        if (m.queue.length > 16) m.queue.shift();
      }
    }
    // Limit baseline storage too, retaining current residents across reconnects.
    for (const id of m.baseline.keys()) if (!roster.has(id)) m.baseline.delete(id);
    m.queue = m.queue.filter(event => canFetch(event.id) && event.expiresAt > Date.now());
    if (m.active && (!canFetch(m.active.id) || (m.active.phase !== 'back' && !clear(m.active.id)))) m.active = null;
    if (!m.active) {
      const next = m.queue.findIndex(event => clear(event.id));
      if (next >= 0) m.active = { ...m.queue.splice(next, 1)[0], phase: 'out' };
    }
    const nextActive = m.active;
    setActive(previous => previous === nextActive ? previous : nextActive);
    if (!m.queue.length) return undefined;
    const timer = setTimeout(() => setQueueWake(value => value + 1), Math.max(0, Math.min(...m.queue.map(event => event.expiresAt)) - Date.now()));
    return () => clearTimeout(timer);
  }, [agents, positions, geometry, fridge, scope, carriedId, active, queueWake]);

  useEffect(() => {
    if (!active || active.scope !== scope) return undefined;
    const timer = setTimeout(() => {
      const m = machine.current;
      if (m.active !== active) return;
      m.active = active.phase === 'back' ? null : { ...active, phase: active.phase === 'out' ? 'hold' : 'back' };
      setActive(m.active);
    }, HOME_WALK_MS);
    return () => clearTimeout(timer);
  }, [active, scope]);

  const current = active?.scope === scope ? active : null;
  const shown = useMemo(() => {
    if (!current || current.phase === 'back') return positions;
    const result = new Map(positions);
    result.set(current.id, fridge);
    return result;
  }, [positions, current, fridge]);
  return { positions: shown, active: current, fridgeLit: current?.phase === 'hold' };
}
