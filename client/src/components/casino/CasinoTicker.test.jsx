// client/src/components/casino/CasinoTicker.test.jsx — CASINO-2 job 2, UI-3 job A
//
// The ranking logic (liveRows/tonightRows/whoIn/tonightLabel/replayable, the
// pot-tick hook) is unchanged from the old two-panel board and is tested the
// same way it always was. What changed is the wall it hangs on: UI-3 job A
// deletes the board (LiveNow, Tonight, FloorBoard) and replaces it with one
// line pinned to the top of the screen — CasinoTicker, tested below.

import { render, screen, act, renderHook } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  CasinoTicker, liveRows, tonightRows, whoIn, tonightLabel, replayable, usePotTicks,
} from './CasinoTicker.jsx';
import { felt, myFelt, casinoEvent, rooms } from '../../test/fixtures/rooms.js';

const mine = new Set(['agent_grinder']);

// ── LIVE NOW · what is in the middle right now ──────────────────────────────

describe('CASINO-2 job 2 · LIVE NOW ranking', () => {
  it('is the pots being built, biggest first — not the newest thing that happened', () => {
    const rows = liveRows([
      felt({ tableId: 'a', pot: 300 }),
      felt({ tableId: 'b', pot: 8_400 }),
      felt({ tableId: 'c', pot: 1_100 }),
    ], { rooms });
    expect(rows.map((r) => r.tableId)).toEqual(['b', 'c', 'a']);
  });

  it('leaves out a table with nothing in the middle rather than padding to a length', () => {
    const rows = liveRows([
      felt({ tableId: 'a', pot: 0, street: 'waiting', board: [] }),
      felt({ tableId: 'b', pot: 900 }),
    ], { rooms });
    expect(rows.map((r) => r.tableId)).toEqual(['b']);
  });

  it('names who is in the pot, and marks your own man as yours', () => {
    expect(whoIn(myFelt(), mine)).toBe('your The Grinder, Ozymandias');
  });

  it('names two and counts the rest — a row is a line, not a seating chart', () => {
    expect(whoIn(felt(), mine)).toBe('Ozymandias, Granite +1');
  });

  it('counts only the players still in the hand', () => {
    const folded = felt({
      seats: felt().seats.map((s, i) => ({ ...s, inHand: i === 0 })),
    });
    expect(whoIn(folded, mine)).toBe('Ozymandias');
  });
});

describe('CASINO-2 job 2 · the pot ticks when it grows', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('says nothing on the first sight of a pot — there is no "before" to grow from', () => {
    const { result } = renderHook(({ rows }) => usePotTicks(rows), {
      initialProps: { rows: liveRows([felt({ tableId: 't', pot: 940 })], { rooms }) },
    });
    expect(result.current.t).toBeUndefined();
  });

  it('shows what went in, and only what went in', () => {
    const { result, rerender } = renderHook(({ rows }) => usePotTicks(rows), {
      initialProps: { rows: liveRows([felt({ tableId: 't', pot: 940 })], { rooms }) },
    });
    rerender({ rows: liveRows([felt({ tableId: 't', pot: 1_180 })], { rooms }) });
    expect(result.current.t).toBe(240);
  });

  it('a pot that did not move is silent', () => {
    const { result, rerender } = renderHook(({ rows }) => usePotTicks(rows), {
      initialProps: { rows: liveRows([felt({ tableId: 't', pot: 940 })], { rooms }) },
    });
    rerender({ rows: liveRows([felt({ tableId: 't', pot: 940, board: ['Ah', 'Kd', '7c', '2s'] })], { rooms }) });
    expect(result.current.t).toBeUndefined();
  });

  it('the tick expires — a stale one would say a pot is still growing', () => {
    const { result, rerender } = renderHook(({ rows }) => usePotTicks(rows), {
      initialProps: { rows: liveRows([felt({ tableId: 't', pot: 940 })], { rooms }) },
    });
    rerender({ rows: liveRows([felt({ tableId: 't', pot: 1_180 })], { rooms }) });
    expect(result.current.t).toBe(240);
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(result.current.t).toBeUndefined();
  });
});

// ── TONIGHT · what is over ──────────────────────────────────────────────────

describe('CASINO-2 job 2 · TONIGHT ranking', () => {
  const feed = [
    casinoEvent({ id: 1, type: 'bigPot', headline: 'Ozymandias cracked aces', tableId: 'tbl-a', pot: 14_200 }),
    casinoEvent({ id: 2, type: 'cooler', headline: 'quads into a straight flush', tableId: 'tbl-b', pot: 6_100 }),
    casinoEvent({ id: 3, type: 'heater', headline: 'Nightjar, six in a row', tableId: 'tbl-c', pot: 9_400 }),
    casinoEvent({ id: 4, type: 'bust', headline: 'Fold_Equity out, third time today', tableId: 'tbl-d', pot: 0 }),
    casinoEvent({
      id: 5, type: 'nemesisSeated', headline: 'Granite just sat down at your table',
      tableId: 'tbl-e', pot: 0, agentIds: ['agent_grinder'], handNumber: 41,
    }),
  ];

  it('speaks the house vocabulary, not the wire\'s', () => {
    expect(tonightLabel('bigPot')).toBe('BIGGEST POT');
    expect(tonightLabel('cooler')).toBe('COOLER');
    expect(tonightLabel('heater')).toBe('HEATER');
    expect(tonightLabel('bust')).toBe('BUST');
    expect(tonightLabel('nemesisSeated')).toBe('NEMESIS');
  });

  it('ranks by money — the biggest pot of the night is the headline until something beats it', () => {
    const rows = tonightRows(feed, mine, 5);
    expect(rows.map((r) => r.id)).toEqual([1, 3, 2, 5, 4]);
  });

  it('a live pot is not "tonight" — a hot table is a hand still being played', () => {
    const rows = tonightRows([casinoEvent({ id: 9, type: 'hot', pot: 20_000 })], mine, 5);
    expect(rows).toHaveLength(0);
  });

  it('marks the one line that is about your agent', () => {
    const rows = tonightRows(feed, mine, 5);
    expect(rows.filter((r) => r.mine).map((r) => r.id)).toEqual([5]);
  });

  // The law from the ref, stated twice because it is the one that matters:
  // the verb has to be true about what the tap does.
  it('only your own hands can be replayed — there is no record for a stranger\'s cooler', () => {
    const [head, ...rest] = tonightRows(feed, mine, 5);
    expect(replayable(head)).toBe(false);
    expect(replayable(rest.find((r) => r.id === 5))).toBe(true);
  });

  it('and a line with no hand number behind it is not a destination either', () => {
    expect(replayable({ mine: true, agentIds: ['agent_grinder'], handNumber: 0 })).toBe(false);
  });
});

// ── The ticker bar ───────────────────────────────────────────────────────────

describe('UI-3 job A · CasinoTicker, one line at the top', () => {
  it('prefers the biggest live pot over anything already finished', () => {
    render(
      <CasinoTicker
        felts={[felt({ tableId: 'live', pot: 8_400 })]}
        events={[casinoEvent({ id: 1, headline: 'the biggest', pot: 20_000 })]}
        rooms={rooms}
        onWatch={() => {}}
      />,
    );
    expect(screen.getByText('$8,400')).toBeInTheDocument();
    expect(screen.queryByText('the biggest')).not.toBeInTheDocument();
  });

  it('a hot table says so in the verb', () => {
    render(<CasinoTicker felts={[felt({ hot: true })]} rooms={rooms} onWatch={() => {}} />);
    expect(screen.getByText('HOT · WATCH')).toBeInTheDocument();
  });

  it('tapping it watches the live table', async () => {
    const onWatch = vi.fn();
    const user = userEvent.setup();
    render(<CasinoTicker felts={[felt({ tableId: 'tbl-7', pot: 900 })]} rooms={rooms} onWatch={onWatch} />);
    await user.click(screen.getByTestId('casino-ticker'));
    expect(onWatch).toHaveBeenCalledWith('tbl-7');
  });

  it('with nothing in the middle, falls back to the biggest thing that finished tonight', () => {
    render(
      <CasinoTicker
        felts={[]}
        events={[
          casinoEvent({ id: 1, headline: 'the small one', pot: 500 }),
          casinoEvent({ id: 2, headline: 'the biggest', pot: 9_000 }),
        ]}
        onReplay={() => {}}
      />,
    );
    expect(screen.getByText('the biggest')).toBeInTheDocument();
    expect(screen.getByText('BIGGEST POT')).toBeInTheDocument();
  });

  it('offers REPLAY only for a hand of yours that can actually be replayed', async () => {
    const onReplay = vi.fn();
    const user = userEvent.setup();
    render(
      <CasinoTicker
        events={[casinoEvent({
          id: 5, type: 'nemesisSeated', headline: 'Granite sat down', pot: 0,
          agentIds: ['agent_grinder'], handNumber: 41,
        })]}
        mineIds={mine}
        onReplay={onReplay}
      />,
    );
    await user.click(screen.getByTestId('casino-ticker'));
    expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
  });

  it('a stranger\'s finished hand is not a button — there is no record to replay it from', () => {
    render(<CasinoTicker events={[casinoEvent({ id: 1, pot: 900 })]} onReplay={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('a quiet floor says so rather than drawing nothing at all', () => {
    render(<CasinoTicker felts={[]} events={[]} />);
    expect(screen.getByText('The floor is quiet.')).toBeInTheDocument();
  });
});
