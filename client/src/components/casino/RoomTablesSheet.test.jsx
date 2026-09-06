// client/src/components/casino/RoomTablesSheet.test.jsx — BUGS-A job 7
//
// A doorway you can look into. The rules under test are about HONESTY as much
// as about wiring: the sheet may only name a table the client actually knows
// about, and it must say how many it could not name.

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RoomTablesSheet, liveTablesIn, unnamedCount, tableIdOf } from './RoomTablesSheet.jsx';

const room = (over = {}) => ({
  id: 'floor',
  name: 'the floor',
  rung: 0,
  stakes: { smallBlind: 10, bigBlind: 20, buyIn: 800, label: '$10/$20' },
  tables: 3,
  seated: 44,
  hot: [],
  biggestPot: null,
  ...over,
});

const agent = (id, name, over = {}) => ({ id, name, activeTableId: null, ...over });

describe('BUGS-A job 7 · what the client can honestly name in a room', () => {
  it('names the hot tables and the biggest pot', () => {
    const rows = liveTablesIn(room({ hot: ['t9'], biggestPot: { tableId: 't7', pot: 4180 } }));
    expect(rows.map((r) => r.tableId)).toEqual(['t9', 't7']);
    expect(rows[0].hot).toBe(true);
    expect(rows[1].pot).toBe(4180);
  });

  it('names the table each of your own agents is sitting at', () => {
    const rows = liveTablesIn(room(), {
      agents: [
        agent('a1', 'The Clock', { activeTableId: 't3', liveGame: { tableId: 't3', pot: 620 } }),
        agent('a2', 'River Rat', { activeTableId: 't3' }),
      ],
    });
    expect(rows).toHaveLength(1);
    expect(rows[0].tableId).toBe('t3');
    expect(rows[0].mine.map((a) => a.name)).toEqual(['The Clock', 'River Rat']);
    expect(rows[0].pot).toBe(620);
  });

  it('a headline only ever decorates a table already in the list', () => {
    const events = [
      { id: 1, headline: 'Granite took it down', tableId: 't9' },
      // Another room's line. Guessing it belongs here would put somebody
      // else's cooler in this doorway.
      { id: 2, headline: 'A cooler upstairs', tableId: 't-elsewhere' },
    ];
    const rows = liveTablesIn(room({ hot: ['t9'] }), { events });
    expect(rows.map((r) => r.tableId)).toEqual(['t9']);
    expect(rows[0].headline).toBe('Granite took it down');
  });

  it('orders by how loudly a table is asking for you', () => {
    const rows = liveTablesIn(
      room({ hot: ['t-hot'], biggestPot: { tableId: 't-pot', pot: 900 } }),
      { agents: [agent('a1', 'The Clock', { activeTableId: 't-mine' })] },
    );
    expect(rows.map((r) => r.tableId)).toEqual(['t-hot', 't-pot', 't-mine']);
  });

  it('an agent is placed by whichever field says where he is', () => {
    expect(tableIdOf({ liveGame: { tableId: 'lg' }, activeTableId: 'at' })).toBe('lg');
    expect(tableIdOf({ activeTableId: 'at' })).toBe('at');
    expect(tableIdOf({ location: { tableId: 'loc' } })).toBe('loc');
    expect(tableIdOf({})).toBeNull();
  });

  it('counts what it could not name, and never goes negative', () => {
    expect(unnamedCount(room({ tables: 8 }), 3)).toBe(5);
    expect(unnamedCount(room({ tables: 2 }), 3)).toBe(0);
  });
});

describe('BUGS-A job 7 · the sheet', () => {
  it('lists what is running and offers a way in', async () => {
    const user = userEvent.setup();
    const onWatch = vi.fn();
    render(
      <RoomTablesSheet
        room={room({ hot: ['t9'], biggestPot: { tableId: 't9', pot: 4180 } })}
        onWatch={onWatch}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole('dialog', { name: /the floor/ })).toBeInTheDocument();
    expect(screen.getByText('#t9')).toBeInTheDocument();
    expect(screen.getByText('HOT')).toBeInTheDocument();
    expect(screen.getByText('$4,180 in the middle')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Watch' }));
    expect(onWatch).toHaveBeenCalledWith('t9');
  });

  it('says "Watch him" for a table one of yours is at, and names him whole', () => {
    render(
      <RoomTablesSheet
        room={room()}
        agents={[agent('a1', 'The Clock', { activeTableId: 't3' })]}
        onWatch={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('The Clock is in here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watch him' })).toBeInTheDocument();
  });

  it('never pretends the room is only as big as the list', () => {
    render(<RoomTablesSheet room={room({ tables: 8, hot: ['t9'] })} onClose={() => {}} />);
    expect(screen.getByText('7 more tables in here the floor has not named.')).toBeInTheDocument();
  });

  it('a busy room with nothing named says so, rather than reading as empty', () => {
    render(<RoomTablesSheet room={room({ tables: 3 })} onClose={() => {}} />);
    expect(screen.getByText(/has not named a table in here yet/)).toBeInTheDocument();
  });

  it('a genuinely empty room says THAT instead', () => {
    render(<RoomTablesSheet room={room({ tables: 0, seated: 0 })} onClose={() => {}} />);
    expect(screen.getByText('Nothing is running in here right now.')).toBeInTheDocument();
  });

  it('closes on the scrim and on the ✕', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = render(<RoomTablesSheet room={room()} onClose={onClose} />);
    await user.click(container.querySelector('.home-sheet__scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(container.querySelector('.home-sheet__close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
