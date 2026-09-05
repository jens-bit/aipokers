// client/src/hooks/usePacedTable.test.jsx — W5-1
//
// The clock half of the pacing queue. lib/pace.test.jsx proves the arithmetic;
// this proves that a live stream driven through the hook actually arrives on
// screen one beat at a time, and that nothing is lost on the way.

import { act, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { usePacedTable } from './usePacedTable.js';
import { DWELL_MS } from '../lib/pace.js';

function snap(over = {}) {
  return {
    handNumber: 1,
    street: 'flop',
    community: ['5c', '4h', '8c'],
    currentBet: 0,
    pot: 100,
    toAct: 1,
    result: null,
    seats: [
      { folded: false, contribThisStreet: 0 },
      { folded: false, contribThisStreet: 0 },
    ],
    ...over,
  };
}

// A probe that records every game object the hook has handed down, so the test
// can assert on the sequence a viewer would have seen rather than on internals.
function harness() {
  const seen = [];
  function Probe({ game, lastDecision, chatMessages }) {
    const paced = usePacedTable({ game, lastDecision, paceFrame: null, chatMessages });
    seen.push(paced);
    return <div data-testid="lag">{paced.behindMs}</div>;
  }
  return { seen, Probe };
}

describe('W5-1: the paced stream', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('shows the first snapshot immediately', () => {
    const { seen, Probe } = harness();
    render(<Probe game={snap()} lastDecision={null} chatMessages={[]} />);
    expect(seen[seen.length - 1].game.handNumber).toBe(1);
  });

  it('holds a fold on screen for its own beat before letting the next frame through', () => {
    const { seen, Probe } = harness();
    const first = snap();
    const { rerender } = render(<Probe game={first} lastDecision={null} chatMessages={[]} />);

    // He folds, and the very next instant the server sends the next street.
    const folded = { ...first, seats: [first.seats[0], { folded: true, contribThisStreet: 0 }] };
    act(() => { rerender(<Probe game={folded} lastDecision={null} chatMessages={[]} />); });
    const latest = () => seen[seen.length - 1].game;
    expect(latest()).toBe(folded);          // the fold itself is the newest step

    const turned = { ...folded, community: ['5c', '4h', '8c', 'Kd'] };
    act(() => { rerender(<Probe game={turned} lastDecision={null} chatMessages={[]} />); });
    expect(latest()).toBe(folded);          // still the fold — 1500ms is 1500ms

    act(() => { vi.advanceTimersByTime(DWELL_MS.fold - 100); });
    expect(latest()).toBe(folded);
    act(() => { vi.advanceTimersByTime(200); });
    expect(latest()).toBe(turned);
  });

  // The four fields travel together, so a line of table talk can never appear a
  // second before the action it was said about.
  it('holds the decision and the chat back with the snapshot they arrived with', () => {
    const { seen, Probe } = harness();
    const first = snap();
    const { rerender } = render(<Probe game={first} lastDecision={null} chatMessages={[]} />);

    const folded = { ...first, seats: [first.seats[0], { folded: true, contribThisStreet: 0 }] };
    const said = [{ text: 'Too rich for me.', isAI: true, seat: 1 }];
    const decision = { seat: 1, action: { type: 'fold' }, reasoning: 'Too rich for me.' };
    act(() => { rerender(<Probe game={folded} lastDecision={decision} chatMessages={said} />); });

    const next = { ...folded, community: ['5c', '4h', '8c', 'Kd'] };
    act(() => { rerender(<Probe game={next} lastDecision={decision} chatMessages={[...said, { text: 'Next.' }]} />); });

    const held = seen[seen.length - 1];
    expect(held.game).toBe(folded);
    expect(held.chatMessages).toBe(said);      // the later line is still queued
    expect(held.lastDecision).toBe(decision);
  });

  // The readout is the wait the frame ON SCREEN served, not the age of whatever
  // is still queued: it is the number a spectator would recognise ("I am two
  // seconds behind the table") and it holds still between releases.
  it('reports how far behind live the felt is running', () => {
    const { seen, Probe } = harness();
    const first = snap();
    const { rerender } = render(<Probe game={first} lastDecision={null} chatMessages={[]} />);
    expect(seen[seen.length - 1].behindMs).toBe(0);   // nothing waited for this

    const folded = { ...first, seats: [first.seats[0], { folded: true, contribThisStreet: 0 }] };
    act(() => { rerender(<Probe game={folded} lastDecision={null} chatMessages={[]} />); });
    const next = { ...folded, community: ['5c', '4h', '8c', 'Kd'] };
    act(() => { rerender(<Probe game={next} lastDecision={null} chatMessages={[]} />); });

    act(() => { vi.advanceTimersByTime(DWELL_MS.fold + 50); });
    const latest = seen[seen.length - 1];
    expect(latest.game).toBe(next);
    // The street waited out the fold's beat, so that is what it was behind by.
    expect(latest.behindMs).toBeGreaterThanOrEqual(DWELL_MS.fold - 100);
    expect(latest.behindMs).toBeLessThan(DWELL_MS.fold + 300);
  });

  it('hands the live stream straight through when it is switched off', () => {
    const { seen, Probe: _p } = harness();
    function Off({ game }) {
      const paced = usePacedTable({ game, lastDecision: null, paceFrame: null, chatMessages: [] },
        { enabled: false });
      seen.push(paced);
      return null;
    }
    const a = snap();
    const b = snap({ toAct: 0 });
    const { rerender } = render(<Off game={a} />);
    act(() => { rerender(<Off game={b} />); });
    expect(seen[seen.length - 1].game).toBe(b);
    expect(seen[seen.length - 1].behindMs).toBe(0);
  });
});
