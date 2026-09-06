// client/src/components/casino/FloorBoard.test.jsx — CASINO-2 job 2
//
// The board by the stairs, split by tense.
//
// Everything the old CASINO-1 block asserted has a counterpart here — the
// house vocabulary, the gold line that is about your agent, the census, the
// collapse beside the tray, the tap, the quiet floor — with one rule reversed
// on purpose: NEWEST FIRST IS GONE. Both halves rank by money, because a
// stranger has to be able to read this board without knowing poker and the
// size of the pot is the one thing that needs no explaining.
//
// The two halves and the line between them:
//
//   LIVE NOW   pots still being built. Comes off the FELTS, so it can exist at
//              all — a hand that has not ended has fired no event. Ticks when
//              it grows. The verb is WATCH.
//   TONIGHT    hands that are over, ranked by money. Comes off the ticker. The
//              verb is REPLAY, and only where a replay actually exists.

import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

import {
  FloorBoard, LiveNow, Tonight, liveRows, tonightRows, whoIn, tonightLabel, replayable,
} from './FloorBoard.jsx';
import { felt, myFelt, casinoEvent, rooms } from '../../test/fixtures/rooms.js';

const mine = new Set(['agent_grinder']);

// ── LIVE NOW · what is in the middle right now ──────────────────────────────

describe('CASINO-2 job 2 · LIVE NOW', () => {
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

  it('draws the pot, the room and the verb', () => {
    render(<LiveNow felts={[felt({ pot: 8_400 })]} rooms={rooms} mineIds={mine} />);
    expect(screen.getByText('LIVE NOW')).toBeInTheDocument();
    expect(screen.getByText('pot so far')).toBeInTheDocument();
    expect(screen.getByText('$8,400')).toBeInTheDocument();
    expect(screen.getByText('$10/$20')).toBeInTheDocument();
    expect(screen.getByText('WATCH')).toBeInTheDocument();
  });

  it('a hot felt is the loudest row on the board, and says so in the verb', () => {
    render(<LiveNow felts={[felt({ hot: true })]} rooms={rooms} onWatch={() => {}} />);
    expect(screen.getByText('HOT · WATCH')).toBeInTheDocument();
    expect(document.querySelector('.csn-live__row[data-hot="true"]')).toBeTruthy();
  });

  it('tapping a row watches that felt', async () => {
    const onWatch = vi.fn();
    const user = userEvent.setup();
    render(<LiveNow felts={[felt({ tableId: 'tbl-7', pot: 900 })]} rooms={rooms} onWatch={onWatch} />);
    await user.click(screen.getByRole('button', { name: /Watch this table/ }));
    expect(onWatch).toHaveBeenCalledWith('tbl-7');
  });

  it('a quiet middle says so rather than drawing an empty list', () => {
    render(<LiveNow felts={[]} rooms={rooms} />);
    expect(screen.getByText('Nothing is in the middle right now.')).toBeInTheDocument();
  });
});

// ── The "+" tick ────────────────────────────────────────────────────────────

describe('CASINO-2 job 2 · the pot ticks when it grows', () => {
  beforeEach(() => { vi.useFakeTimers({ shouldAdvanceTime: true }); });
  afterEach(() => { vi.useRealTimers(); });

  it('says nothing on the first sight of a pot — there is no "before" to grow from', () => {
    render(<LiveNow felts={[felt({ tableId: 't', pot: 940 })]} rooms={rooms} />);
    expect(screen.queryByTestId('pot-tick-t')).not.toBeInTheDocument();
  });

  it('shows what went in, and only what went in', () => {
    const { rerender } = render(<LiveNow felts={[felt({ tableId: 't', pot: 940 })]} rooms={rooms} />);
    rerender(<LiveNow felts={[felt({ tableId: 't', pot: 1_180 })]} rooms={rooms} />);
    expect(screen.getByTestId('pot-tick-t')).toHaveTextContent('+240');
  });

  it('a pot that did not move is silent', () => {
    const { rerender } = render(<LiveNow felts={[felt({ tableId: 't', pot: 940 })]} rooms={rooms} />);
    rerender(<LiveNow felts={[felt({ tableId: 't', pot: 940, board: ['Ah', 'Kd', '7c', '2s'] })]} rooms={rooms} />);
    expect(screen.queryByTestId('pot-tick-t')).not.toBeInTheDocument();
  });

  it('the tick expires — a stale one would say a pot is still growing', () => {
    const { rerender } = render(<LiveNow felts={[felt({ tableId: 't', pot: 940 })]} rooms={rooms} />);
    rerender(<LiveNow felts={[felt({ tableId: 't', pot: 1_180 })]} rooms={rooms} />);
    expect(screen.getByTestId('pot-tick-t')).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2_000); });
    expect(screen.queryByTestId('pot-tick-t')).not.toBeInTheDocument();
  });
});

// ── TONIGHT · what is over ──────────────────────────────────────────────────

describe('CASINO-2 job 2 · TONIGHT', () => {
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

  it('draws the headline big and the rest under it', () => {
    render(<Tonight events={feed} mineIds={mine} rows={2} />);
    expect(screen.getByText('TONIGHT')).toBeInTheDocument();
    expect(screen.getByText('Ozymandias cracked aces')).toBeInTheDocument();
    expect(screen.getByText('$14,200')).toBeInTheDocument();
    expect(screen.getByText('Nightjar, six in a row')).toBeInTheDocument();
    // rows=2 holds the headline plus two, so the fourth-largest is off the wall.
    expect(screen.queryByText('Granite just sat down at your table')).not.toBeInTheDocument();
  });

  it('an empty evening says so', () => {
    render(<Tonight events={[]} rows={3} />);
    expect(screen.getByText('Nothing has finished tonight yet.')).toBeInTheDocument();
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

  it('a stranger\'s line is not a button — REPLAY on a hand nothing can replay is a lie', () => {
    render(<Tonight events={[feed[0]]} mineIds={mine} rows={3} onReplay={() => {}} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('tapping yours replays that hand', async () => {
    const onReplay = vi.fn();
    const user = userEvent.setup();
    render(<Tonight events={[feed[4]]} mineIds={mine} rows={3} onReplay={onReplay} />);
    await user.click(screen.getByRole('button', { name: /Replay this hand/ }));
    expect(onReplay).toHaveBeenCalledWith(expect.objectContaining({ id: 5, handNumber: 41 }));
  });

  it('carries the stakes chip only when the room is known', () => {
    const stakesFor = (id) => (id === 'tbl-b' ? '$25/$50' : null);
    render(<Tonight events={feed} mineIds={mine} rows={3} stakesFor={stakesFor} />);
    expect(screen.getAllByText('$25/$50')).toHaveLength(1);
  });
});

// ── The board they hang on ──────────────────────────────────────────────────

describe('CASINO-2 job 2 · the wall', () => {
  it('is one object with a header and a census over both halves', () => {
    render(<FloorBoard felts={[felt()]} events={[casinoEvent()]} playing={1604} rooms={rooms} />);
    expect(screen.getByText('ON THE FLOOR RIGHT NOW')).toBeInTheDocument();
    expect(screen.getByText('1,604 playing')).toBeInTheDocument();
    expect(screen.getByText('LIVE NOW')).toBeInTheDocument();
    expect(screen.getByText('TONIGHT')).toBeInTheDocument();
  });

  it('collapses beside the deploy tray — the decision is the tray, so this is two lines', () => {
    render(
      <FloorBoard
        felts={[felt({ tableId: 'a', pot: 900 }), felt({ tableId: 'b', pot: 400 }), felt({ tableId: 'c', pot: 200 })]}
        events={[
          casinoEvent({ id: 1, headline: 'the biggest', pot: 9_000 }),
          casinoEvent({ id: 2, headline: 'the second', pot: 500 }),
        ]}
        rooms={rooms}
        liveLimit={2}
        rows={0}
      />,
    );
    expect(screen.getByText('$900')).toBeInTheDocument();
    expect(screen.queryByText('$200')).not.toBeInTheDocument();
    expect(screen.getByText('the biggest')).toBeInTheDocument();
    expect(screen.queryByText('the second')).not.toBeInTheDocument();
  });
});
