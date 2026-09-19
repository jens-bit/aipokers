// client/src/components/casino/FloorView.test.jsx — BUGS-A job 7, CASINO-2 job 5, UI-3 job A
//
// A room you no longer walk into a doorway to reach. The rules under test are
// about HONESTY as much as about wiring: the room may only draw a table it
// actually knows about, and it must say how many it could not name.
//
// Two eras, both still live. The pure helpers below are BUGS-A's — what the
// client could name from the room payload alone — and they are still the
// answer when no felts have arrived. Everything after them is CASINO-2 job 5:
// once every table in a room is on the wire, the room stops being a list and
// becomes a place. UI-3 job A deleted the swipe between three such rooms —
// there is only one now, so `room` here is CasinoScreen's merged venue and
// `onClose`/`toggle`/`roomIndex` are gone with the building they belonged to.

import { describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { FloorView, liveTablesIn, unnamedCount, tableIdOf, feltsForRoom } from './FloorView.jsx';
import { felt, myFelt } from '../../test/fixtures/rooms.js';

const room = (over = {}) => ({
  id: 'floor',
  name: 'The floor',
  tables: 3,
  seated: 44,
  hot: [],
  biggestPot: null,
  ...over,
});

const agent = (id, name, over = {}) => ({ id, name, activeTableId: null, ...over });

describe('CASINO-PLAY: the deploy panel keeps one stable position', () => {
  it('BUG-236: companions still at home are not invented as bodies at the casino bar', () => {
    render(<FloorView room={room()} felts={[felt()]} agents={[
      agent('home', 'Homebody', { location: { where: 'home' } }),
      agent('visitor', 'Visitor', { location: { where: 'visiting' } }),
      agent('bar', 'Waiting', { location: { where: 'casino' } }),
    ]} />);
    const bar = document.querySelector('.csn-floor58__standing');
    expect(bar.children).toHaveLength(1);
    expect(bar.querySelector('[title="Waiting"]')).not.toBeNull();
  });
  // It used to move from the empty room's own space into the rail the
  // instant the first felt arrived — a different parent in the tree, so
  // React unmounted and remounted it. An owner mid-tap on it when a table
  // appeared lost the tap: the node `findByRole` (or his own finger) was
  // holding a reference to was gone before the click landed. One position,
  // always, closes that race.
  it.each([false, true])('never moves parents when tables arrive (desktop=%s)', async desktop => {
    const onPlay = vi.fn();
    const props = { room: room({ tables: 1 }), desktop,
      deployPanel: <button onClick={onPlay}>Send Milo to play</button>,
    };
    const view = render(<FloorView {...props} />);
    const before = screen.getByRole('button', { name: 'Send Milo to play' });
    expect(before.closest('.csn-floor__board')).toBeTruthy();
    view.rerender(<FloorView {...props} felts={[felt()]} />);
    const play = screen.getByRole('button', { name: 'Send Milo to play' });
    expect(play).toBe(before);
    expect(play.closest('.csn-floor__board')).toBeTruthy();
    expect(screen.getByTestId('the-floor').closest('.csn-floor__room')).toBeTruthy();
    await userEvent.click(play);
    expect(onPlay).toHaveBeenCalledOnce();
  });

  it('clears the deploy panel during a pinch zoom', () => {
    const table = felt();
    const props = { room: room({ tables: 1 }), felts: [table], deployPanel: <button>Send Milo to play</button> };
    const view = render(<FloorView {...props} />);
    expect(screen.getByRole('button', { name: 'Send Milo to play' })).toBeVisible();
    const originalFloor = screen.getByTestId('the-floor');
    view.rerender(<FloorView {...props} zoom={table} />);
    expect(screen.queryByRole('button', { name: 'Send Milo to play' })).toBeNull();
    expect(screen.getByTestId('the-floor')).toBe(originalFloor);
  });
});

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

  it('CASINO-2 job 5: yours comes first, on top of the server ranking', () => {
    const ranked = feltsForRoom(
      [{ tableId: 'loud' }, { tableId: 'his' }],
      [agent('a1', 'The Clock', { activeTableId: 'his' })],
    );
    expect(ranked.map((f) => f.tableId)).toEqual(['his', 'loud']);
  });
});

// ── CASINO-2 job 5 · the room itself ────────────────────────────────────────
//
// The block that stood here tested RoomTablesSheet — a LIST of the tables the
// client could name. Job 1 put every table in a room on the wire, so the room
// stopped being a list and became a place, and these are the same claims
// asserted about the place: what is in it, that it can be walked into, that a
// room the floor has not described is never drawn as an empty one.
//
// The list itself did not go anywhere. It is the fallback below, for a client
// whose felts have not arrived, and its own rules are still asserted above.

describe('CASINO-2 job 5 · the room, from above', () => {
  it('draws one felt per live table in the room', () => {
    const { container } = render(
      <FloorView
        room={room({ tables: 2 })}
        felts={[felt({ tableId: 't1' }), felt({ tableId: 't2' })]}
        onHome={() => {}}
      />,
    );
    expect(container.querySelectorAll('.csn-felt58')).toHaveLength(2);
  });

  it('and it is a ROOM, not a list of its tables', () => {
    const { container } = render(
      <FloorView room={room()} felts={[felt()]} onHome={() => {}} />,
    );
    // The furniture is the point: the bar is why "not playing" has somewhere to
    // be, and the stairs are why the building has floors — UI-3 job A: and
    // now the only door out of it.
    expect(screen.getByTestId('the-floor')).toBeInTheDocument();
    expect(screen.getByText('THE BAR')).toBeInTheDocument();
    expect(screen.getByText('HOME')).toBeInTheDocument();
    // Bodies on the rim, at floor scale.
    expect(container.querySelectorAll('.csn-tiny').length).toBeGreaterThan(0);
  });

  it('the only text on a felt is its stake', () => {
    render(<FloorView room={room()} felts={[felt({ blinds: '10/20' })]} onHome={() => {}} />);
    const drawn = document.querySelector('.csn-felt58');
    expect(drawn.textContent).toBe('10/20');
  });

  it('a busy room says how many more it holds rather than shrinking them', () => {
    const many = Array.from({ length: 9 }).map((_, i) => felt({ tableId: `t${i}` }));
    const { container } = render(
      <FloorView room={room({ tables: 9 })} felts={many} onHome={() => {}} />,
    );
    expect(container.querySelectorAll('.csn-felt58')).toHaveLength(6);
    expect(screen.getByText(/3 more tables running than the room has space to draw/))
      .toBeInTheDocument();
  });

  // UI-3 job A: stakes are a fact about each table now, not the room, so the
  // header states only the census.
  it('names the room and the census — stakes are on the tables, not the room', () => {
    render(<FloorView room={room({ tables: 3, seated: 44 })} felts={[felt()]} onHome={() => {}} />);
    expect(screen.getByText('The floor')).toBeInTheDocument();
    expect(screen.getByText('44 in · 3 tables')).toBeInTheDocument();
  });

  it('puts your own man\'s table first, however quiet it is', () => {
    const { container } = render(
      <FloorView
        room={room({ tables: 3 })}
        felts={[felt({ tableId: 'loud', pot: 9_000, hot: true }), myFelt({ tableId: 'his', pot: 0 })]}
        agents={[agent('agent_grinder', 'The Grinder', { activeTableId: 'his' })]}
        onHome={() => {}}
      />,
    );
    const drawn = [...container.querySelectorAll('.csn-felt58')].map((el) => el.dataset.table);
    expect(drawn[0]).toBe('his');
  });

  it('tapping a felt watches it', async () => {
    const onWatch = vi.fn();
    const user = userEvent.setup();
    render(
      <FloorView room={room()} felts={[felt({ tableId: 't9' })]} onWatch={onWatch} onHome={() => {}} />,
    );
    await user.click(screen.getByRole('button', { name: /Watch table t9/ }));
    expect(onWatch).toHaveBeenCalledWith('t9');
  });

  it('and names him when the felt is his', async () => {
    const onWatch = vi.fn();
    const user = userEvent.setup();
    render(
      <FloorView
        room={room()}
        felts={[myFelt({ tableId: 'his' })]}
        agents={[agent('agent_grinder', 'The Grinder', { activeTableId: 'his' })]}
        onWatch={onWatch}
        onHome={() => {}}
      />,
    );
    await user.click(screen.getByRole('button', { name: /Watch The Grinder at this table/ }));
    expect(onWatch).toHaveBeenCalledWith('his');
  });

  it('the fish-tank law holds in a room you are walking through', () => {
    const { container } = render(
      <FloorView
        room={room()}
        felts={[myFelt({ tableId: 'his' })]}
        agents={[agent('agent_grinder', 'The Grinder', { activeTableId: 'his' })]}
        onHome={() => {}}
      />,
    );
    // Not a card is drawn in here — his or anybody's. A hand happens at a
    // table; a room is where the tables are. Face-up cards belong to HIS felt,
    // in the carousel, off his own liveGame.
    expect(container.querySelector('[data-hole]')).toBeNull();
    expect(container.querySelector('[data-board]')).toBeNull();
  });

  it('and yours is the one body you can find without looking', () => {
    const { container } = render(
      <FloorView
        room={room()}
        felts={[myFelt({ tableId: 'his' })]}
        agents={[agent('agent_grinder', 'The Grinder', { activeTableId: 'his' })]}
        onHome={() => {}}
      />,
    );
    expect(container.querySelector('.csn-felt58[data-mine="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.csn-tiny[data-mine="true"]')).toHaveLength(1);
  });

  it('a man in the room at no felt is standing at the bar', () => {
    render(
      <FloorView
        room={room()}
        felts={[felt({ tableId: 'someone-elses' })]}
        agents={[agent('a1', 'The Clock', { activeTableId: null })]}
        onHome={() => {}}
      />,
    );
    // The ref stands four anonymous bodies at the bar; there is no "who is at
    // the bar" on the wire, so the only bodies there are the ones we know
    // about — and an agent in this room at no felt is a man looking for a seat.
    expect(document.querySelector('.csn-floor58__standing')).not.toBeNull();
  });

  it('the staircase inside the room goes home when tapped', async () => {
    const onHome = vi.fn();
    const user = userEvent.setup();
    render(<FloorView room={room()} felts={[felt()]} onHome={onHome} />);
    await user.click(screen.getByRole('button', { name: /go home/i }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('leaves by the header, too', async () => {
    const user = userEvent.setup();
    const onHome = vi.fn();
    render(<FloorView room={room()} felts={[felt()]} onHome={onHome} />);
    await user.click(screen.getByRole('button', { name: 'Back home' }));
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it('is full width on the desk, with the deploy panel as a right column', () => {
    const { container } = render(
      <FloorView room={room()} felts={[felt()]} desktop deployPanel={<div>b</div>} onHome={() => {}} />,
    );
    // Not a rail sheet: it replaces the building rather than sitting beside it.
    expect(container.querySelector('.csn-floor--desk')).not.toBeNull();
    expect(container.querySelector('.home-sheet__scrim')).toBeNull();
    expect(container.querySelector('.csn-floor__board')).not.toBeNull();
  });
});

describe('CASINO-2 job 5 · when the floor has not said', () => {
  it('falls back to the list of what the client can name', () => {
    render(
      <FloorView
        room={room({ hot: ['t9'], biggestPot: { tableId: 't9', pot: 4180 } })}
        felts={[]}
        onHome={() => {}}
      />,
    );
    expect(screen.getByText('#t9')).toBeInTheDocument();
    expect(screen.getByText('HOT')).toBeInTheDocument();
    expect(screen.getByText('$4,180 in the middle')).toBeInTheDocument();
  });

  it('says "Watch him" for a table one of yours is at, and names him whole', () => {
    render(
      <FloorView
        room={room()}
        felts={[]}
        agents={[agent('a1', 'The Clock', { activeTableId: 't3' })]}
        onHome={() => {}}
      />,
    );
    expect(screen.getByText('The Clock is in here')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Watch him' })).toBeInTheDocument();
  });

  it('never pretends the room is only as big as what it drew', () => {
    render(<FloorView room={room({ tables: 8, hot: ['t9'] })} felts={[]} onHome={() => {}} />);
    expect(screen.getByText('7 more tables the floor has not named.')).toBeInTheDocument();
  });

  it('counts the felts too, not just the fallback rows', () => {
    render(
      <FloorView room={room({ tables: 8 })} felts={[felt({ tableId: 'a' })]} onHome={() => {}} />,
    );
    expect(screen.getByText('7 more tables the floor has not named.')).toBeInTheDocument();
  });

  it('a busy room with nothing named says so, rather than reading as empty', () => {
    render(<FloorView room={room({ tables: 3 })} felts={[]} onHome={() => {}} />);
    expect(screen.getByText(/has not named a table yet/)).toBeInTheDocument();
  });

  it('a genuinely empty room says THAT instead', () => {
    render(<FloorView room={room({ tables: 0, seated: 0 })} felts={[]} onHome={() => {}} />);
    expect(screen.getByText('Nothing is running right now.')).toBeInTheDocument();
  });
});


describe('BUG-103 · a floor that arrives after the room opens', () => {
  it.each([false, true])('measures late tables and subsequent resizes (desktop=%s)', desktop => {
    let width = desktop ? 800 : 362, height = 800, observer;
    const widthSpy = vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockImplementation(function () { return this.classList.contains('csn-floor__plan') ? width : 0; });
    const heightSpy = vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockImplementation(function () { return this.classList.contains('csn-floor__plan') ? height : 0; });
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class { constructor(fn) { observer = fn; } observe() {} disconnect() { disconnect(); } });
    const view = render(<FloorView room={room()} desktop={desktop} />);
    const expected = () => desktop ? Math.min(width, height * 390 / 470) : width;
    try {
      view.rerender(<FloorView room={room()} desktop={desktop} felts={[felt()]} />);
      expect(parseFloat(screen.getByTestId('the-floor').style.width)).toBeCloseTo(expected(), 4);
      width = desktop ? 480 : 300; height = 420;
      act(() => observer());
      expect(parseFloat(screen.getByTestId('the-floor').style.width)).toBeCloseTo(expected(), 4);
      view.rerender(<FloorView room={room()} desktop={desktop} />);
      expect(disconnect).toHaveBeenCalledTimes(1);
      view.rerender(<FloorView room={room()} desktop={desktop} felts={[felt()]} />);
      expect(parseFloat(screen.getByTestId('the-floor').style.width)).toBeCloseTo(expected(), 4);
    } finally { view.unmount(); widthSpy.mockRestore(); heightSpy.mockRestore(); vi.unstubAllGlobals(); }
  });
});

// UI-3 job A deleted the swipe between rooms along with the rooms — there is
// one floor now and nothing to swipe to. See CasinoScreen.test.jsx for the
// deep-link resolution that used to seed which room a swipe opened on.
