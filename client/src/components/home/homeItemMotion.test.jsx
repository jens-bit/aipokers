import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HOME_ITEM_WAIT_MS, HOME_WALK_MS, useHomeItemMotion } from './homeItemMotion.js';
import { PHONE_ROOM } from './flat.js';

const agent = (id, extra = {}) => ({ id, location: { where: 'home' }, routine: { key: 'reads' }, homeItem: null, ...extra });
const at = (x, y, spot = 'floor:0') => ({ x, y, spot, seat: null });
let owner = 0;
function setup(agents = [agent('a')], extra = {}) {
  let props = { agents, positions: new Map(agents.map((a, i) => [a.id, at(108 + i * 100, 404)])),
    geometry: PHONE_ROOM, ownerScope: `fridge-${++owner}`, carriedId: null, ...extra };
  const view = renderHook(p => useHomeItemMotion(p), { initialProps: props });
  return { ...view, get props() { return props; }, update(change) { props = { ...props, ...change }; view.rerender(props); },
    accept(id = 'a', item = 'snack', time = Date.now()) {
      props = { ...props, agents: props.agents.map(a => a.id === id ? { ...a, homeItem: { item, at: time } } : a) };
      view.rerender(props);
    } };
}
const tick = (ms = HOME_WALK_MS) => act(() => vi.advanceTimersByTime(ms));
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(10_000_000); });
afterEach(() => vi.useRealTimers());

describe('HOME-2 accepted fridge trips', () => {
  it('walks out, opens only on arrival, and brings the accepted snack back on the existing room clock', () => {
    const view = setup();
    const origin = view.props.positions.get('a');
    view.accept();
    expect(view.result.current.active).toMatchObject({ id: 'a', item: 'snack', phase: 'out' });
    expect(view.result.current.positions.get('a')).toMatchObject({ x: 284, y: 200, spot: 'fridge:fetch' });
    expect(view.result.current.fridgeLit).toBe(false);
    tick(HOME_WALK_MS - 1);
    expect(view.result.current.fridgeLit).toBe(false);
    tick(1);
    expect(view.result.current.active.phase).toBe('hold');
    expect(view.result.current.fridgeLit).toBe(true);
    tick();
    expect(view.result.current.active).toMatchObject({ item: 'snack', phase: 'back' });
    expect(view.result.current.fridgeLit).toBe(false);
    expect(view.result.current.positions.get('a')).toEqual(origin);
    tick();
    expect(view.result.current.active).toBeNull();
    view.update({ agents: [...view.props.agents] });
    expect(view.result.current.active).toBeNull();
  });

  it('a cold persisted action, refusal, pending want or unsupported item never starts a fetch', () => {
    const view = setup([agent('a', { homeItem: { item: 'beer', at: Date.now() - 1 } })]);
    expect(view.result.current.active).toBeNull();
    view.update({ agents: [agent('a', { drinkPending: true, want: { kind: 'drink' } })] });
    expect(view.result.current.active).toBeNull();
    view.accept('a', 'coffee');
    expect(view.result.current.active).toBeNull();
  });

  it.each([-3_600_000, 3_600_000])('accepts a real server delta when the phone clock differs by %sms', skew => {
    const serverAt = Date.now() + skew;
    const view = setup([agent('a', { homeItem: { item: 'beer', at: serverAt } })]);
    expect(view.result.current.active).toBeNull();
    view.accept('a', 'snack', serverAt + 1);
    expect(view.result.current.active?.item).toBe('snack');
  });

  it('waits for typed Home state after REST and suppresses its cold persisted item', () => {
    const rest = agent('a'); delete rest.homeItem;
    const view = setup([rest]);
    view.accept('a', 'beer', Date.now());
    expect(view.result.current.active).toBeNull();
    view.accept('a', 'snack', Date.now() + 1);
    expect(view.result.current.active?.item).toBe('snack');
  });

  it('rejects an older server event after a newer accepted event has completed', () => {
    const view = setup();
    view.accept('a', 'snack', 2000);
    expect(view.result.current.active?.item).toBe('snack');
    tick(); tick(); tick();
    view.accept('a', 'beer', 1000);
    expect(view.result.current.active).toBeNull();
  });

  it('never replays the same consumed event after Home unmounts, but a later accepted event does play', () => {
    const first = setup();
    first.accept('a', 'beer');
    expect(first.result.current.active?.item).toBe('beer');
    const props = first.props;
    first.unmount();
    const next = setup(props.agents, { ...props });
    expect(next.result.current.active).toBeNull();
    tick(1);
    next.accept();
    expect(next.result.current.active?.item).toBe('snack');
  });

  it('consumed accepted events belong to one owner', () => {
    const first = setup();
    first.accept();
    expect(first.result.current.active?.id).toBe('a');
    const next = setup();
    next.accept();
    expect(next.result.current.active?.id).toBe('a');
  });

  it('queues two accepted actions without moving their neighbours or sharing the fridge', () => {
    const view = setup([agent('a'), agent('b'), agent('c')]);
    const original = new Map(view.props.positions);
    view.update({ agents: view.props.agents.map(a => a.id === 'c' ? a : { ...a, homeItem: { item: 'beer', at: Date.now() } }) });
    expect(view.result.current.active?.id).toBe('a');
    expect(view.result.current.positions.get('b')).toEqual(original.get('b'));
    expect(view.result.current.positions.get('c')).toEqual(original.get('c'));
    tick(); tick(); tick();
    expect(view.result.current.active?.id).toBe('b');
    expect(view.result.current.positions.get('a')).toEqual(original.get('a'));
  });

  it('waits for the authored fridge footprint to clear instead of moving another resident', () => {
    const view = setup([agent('a'), agent('b')], { positions: new Map([['a', at(108, 404)], ['b', at(284, 200)]]) });
    view.accept();
    expect(view.result.current.active).toBeNull();
    expect(view.result.current.positions.get('b')).toEqual(view.props.positions.get('b'));
    view.update({ positions: new Map([['a', at(108, 404)], ['b', at(336, 404)]]) });
    expect(view.result.current.active?.id).toBe('a');
  });

  it('expires an obstructed accepted item instead of fetching it when a neighbour moves much later', () => {
    const view = setup([agent('a'), agent('b')], { positions: new Map([['a', at(108, 404)], ['b', at(284, 200)]]) });
    view.accept();
    expect(view.result.current.active).toBeNull();
    tick(HOME_ITEM_WAIT_MS);
    view.update({ positions: new Map([['a', at(108, 404)], ['b', at(336, 404)]]) });
    expect(view.result.current.active).toBeNull();
    tick(1);
    view.accept();
    expect(view.result.current.active?.id).toBe('a');
  });

  it.each(['carried', 'away', 'seated', 'plays', 'guest'])('cancels when the fetching agent becomes %s and does not restart that event', reason => {
    const view = setup();
    view.accept(); tick();
    expect(view.result.current.fridgeLit).toBe(true);
    const a = view.props.agents[0];
    const change = reason === 'carried' ? { carriedId: 'a' }
      : reason === 'seated' ? { positions: new Map([['a', { x: 208, y: 238, spot: 'table:1', seat: 1 }]]) }
      : { agents: [{ ...a, ...(reason === 'away' ? { location: { where: 'casino' } }
        : reason === 'plays' ? { routine: { key: 'plays' } } : { guest: true }) }] };
    view.update(change);
    expect(view.result.current.active).toBeNull();
    expect(view.result.current.fridgeLit).toBe(false);
    view.update({ agents: [a], carriedId: null, positions: new Map([['a', at(108, 404)]]) });
    tick(HOME_WALK_MS * 4);
    expect(view.result.current.active).toBeNull();
  });

  it('skips a fresh accepted action already in a hand and never moves its actual chair', () => {
    const chair = { x: 208, y: 238, spot: 'table:1', seat: 1 };
    const view = setup([agent('a')], { positions: new Map([['a', chair]]) });
    view.accept();
    expect(view.result.current.active).toBeNull();
    expect(view.result.current.positions.get('a')).toEqual(chair);
  });
});
