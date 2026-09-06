// client/src/screens/CasinoScreen.desk.test.jsx — DESK-2
//
// The casino at 1440. Board 31's frame, applied to board 27's building: the
// shell's top bar is already across the top, the BUILDING is the stage, and the
// TICKER moves into the rail.
//
// Three rules, and they are the whole of the desktop change:
//
//   1. THE BOARD IS IN THE RAIL, and there is exactly one of it. A ticker in
//      both columns would be the same evening told twice.
//   2. IT HOLDS THE RUN OF THE EVENING, not the top of it. The phone caps at
//      five because the board is stacked above the doorways; the rail has a
//      column of its own, so a sixth line is not a line it has to drop.
//   3. THE TRAY IS UNCHANGED — same component, same place, at the foot of the
//      stage under the rooms it is deciding between.
//
// Everything about WHAT the casino does — the pocket gate, the shut room, the
// deploy POST — is unchanged and stays asserted in CasinoScreen.test.jsx. This
// file only pins where the two columns put things.

import { render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { CasinoScreen } from './CasinoScreen.jsx';
import { rooms, casinoEvent } from '../test/fixtures/rooms.js';
import { playingAgent, restingAgent } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';
import userEvent from '@testing-library/user-event';

const fundedCannon = {
  ...restingAgent,
  pocket: { mode: 'allowance', cap: 5_000, broke: false, collectable: 0, pnl: 0, balance: 2_500 },
};

// Eight lines: more than the phone's five, so "the rail is not capped at the
// phone's cap" is a claim the fixture can actually test.
const EIGHT = Array.from({ length: 8 }).map((_, i) => casinoEvent({
  id: i + 1,
  type: 'bigPot',
  headline: `pot number ${i + 1}`,
  tableId: `tbl-${i + 1}`,
}));

function routeFloor({ agents = [], events = EIGHT } = {}) {
  fetchMock.route('/api/rooms', { rooms, hotWindowMs: 20_000 });
  fetchMock.route('/api/events', { events, lastId: events.length });
  fetchMock.route('/api/agents', { agents });
  fetchMock.route('/api/wallet', { balance: 9_000, staked: 0, session: 0, ledger: [] });
}

const rail = () => document.querySelector('.csn-desk__rail');
const stage = () => document.querySelector('.csn-desk__stage');

beforeEach(() => {
  telegram.signIn();
});

describe('DESK-2 · the casino on the desk', () => {
  // CASINO-2 job 3: at rest the rooms are the three small doors under the sign
  // (the tall doorway is the deploy choice — see the tray tests below). The
  // rule this asserts is unchanged and is the one that matters here: the rooms
  // are on the stage, the board is in the rail, and there is exactly one board.
  it('is two columns: the building on the stage, the ticker in the rail', async () => {
    routeFloor();
    render(<CasinoScreen desktop />);

    await waitFor(() => expect(document.querySelectorAll('.csn-room-door').length).toBe(rooms.length));
    expect(stage()).not.toBeNull();
    expect(rail()).not.toBeNull();

    // Every door is on the stage; the board is not.
    for (const door of document.querySelectorAll('.csn-room-door')) {
      expect(stage().contains(door)).toBe(true);
    }
    const boards = document.querySelectorAll('.csn-board');
    expect(boards).toHaveLength(1);
    expect(rail().contains(boards[0])).toBe(true);
  });

  it('the rail holds the run of the evening, not the phone\'s top five', async () => {
    routeFloor();
    render(<CasinoScreen desktop />);

    const board = await waitFor(() => {
      const el = document.querySelector('.csn-board');
      expect(el).toBeTruthy();
      return el;
    });
    await waitFor(() => {
      expect(within(board).getByText('pot number 8')).toBeInTheDocument();
    });
    // ...and the phone still stops at five, from the same fixture.
    expect(within(board).getByText('pot number 4')).toBeInTheDocument();
  });

  it('the phone keeps the board stacked above the doorways, and caps it', async () => {
    routeFloor();
    render(<CasinoScreen />);

    const board = await waitFor(() => {
      const el = document.querySelector('.csn-board');
      expect(el).toBeTruthy();
      return el;
    });
    expect(document.querySelector('.csn-desk__rail')).toBeNull();
    await waitFor(() => expect(within(board).getByText('pot number 8')).toBeInTheDocument());
    expect(within(board).queryByText('pot number 3')).toBeNull();
  });

  it('the deploy tray is unchanged: same tray, at the foot of the stage', async () => {
    routeFloor({ agents: [fundedCannon] });
    render(<CasinoScreen desktop deployAgent={fundedCannon} />);

    const deal = await screen.findByRole('button', { name: /deal him in/i });
    expect(stage().contains(deal)).toBe(true);
    expect(rail().contains(deal)).toBe(false);
  });

  it('the ticker stays in the rail while you are placing him — the rail is not the stage', async () => {
    routeFloor({ agents: [fundedCannon] });
    render(<CasinoScreen desktop deployAgent={fundedCannon} />);

    await screen.findByRole('button', { name: /deal him in/i });
    const boards = document.querySelectorAll('.csn-board');
    expect(boards).toHaveLength(1);
    expect(rail().contains(boards[0])).toBe(true);
  });
});

// ── FIX-6 job 5 ─────────────────────────────────────────────────────────────
//
// Playtest 6 Sep, desktop. Two things about the casino at 1440 read as a phone
// that got bigger: the doorways were still stacked in a column down the middle
// of a 900px stage, and a doorway opened a BOTTOM SHEET — a full-width strip
// across a two-column layout, covering the room it was about and the ticker it
// was not.

describe('FIX-6 · the building across the desk', () => {
  beforeEach(() => { telegram.signIn(); });

  // Since CASINO-2 job 3 this is the DEPLOY view: the tall doorways arrive with
  // the tray. What FIX-6 fixed is unchanged — three across, all one height.
  it('lays the rooms out as three cards side by side, not a column', async () => {
    routeFloor({ agents: [fundedCannon] });
    render(<CasinoScreen desktop deployAgent={fundedCannon} />);

    const row = await waitFor(() => {
      const el = document.querySelector('.csn-rooms__row');
      expect(el).toBeTruthy();
      return el;
    });
    const doors = [...document.querySelectorAll('.csn-door')];
    expect(doors).toHaveLength(rooms.length);
    for (const door of doors) expect(row.contains(door)).toBe(true);

    // Side by side means the same size: a row of cards that differ in height is
    // a broken grid, where a column of doorways that differ is a building.
    const heights = new Set(doors.map((d) => d.style.height));
    expect(heights.size).toBe(1);
  });

  it('the phone keeps its stack — nothing about this is a change to the phone', async () => {
    routeFloor({ agents: [fundedCannon] });
    render(<CasinoScreen deployAgent={fundedCannon} />);

    await waitFor(() => expect(document.querySelectorAll('.csn-door').length).toBe(rooms.length));
    expect(document.querySelector('.csn-rooms__row')).toBeNull();
  });

  // FIX-6's rule was "every SHEET opens in the rail", and it holds: his chips
  // still do, below. CASINO-2 job 5 made a room something else — you walk into
  // it, it replaces the building, and there is nothing left behind it for a
  // rail to sit beside. So it is full width, and it brings the board with it as
  // a right column rather than leaving the ticker behind on a screen you can no
  // longer see.
  it('a doorway takes the whole desk, because a room is not a sheet', async () => {
    routeFloor({ agents: [playingAgent] });
    const user = userEvent.setup();
    render(<CasinoScreen desktop />);

    await user.click(await screen.findByRole('button', { name: /^the floor,/ }));

    const view = await screen.findByTestId('floor-view');
    expect(view.classList.contains('csn-floor--desk')).toBe(true);
    // No rail and no stage: the building is not behind it.
    expect(rail()).toBeNull();
    expect(stage()).toBeNull();
    // No scrim either — nothing is covered, so there is nothing to dismiss by
    // tapping past it.
    expect(view.querySelector('.home-sheet__scrim')).toBeNull();
    // The board came along, as the right column.
    expect(view.querySelector('.csn-floor__board .csn-board')).not.toBeNull();
  });

  it('leaving it puts the building back', async () => {
    routeFloor();
    const user = userEvent.setup();
    render(<CasinoScreen desktop />);

    await user.click(await screen.findByRole('button', { name: /^the floor,/ }));
    await screen.findByTestId('floor-view');
    await user.click(screen.getByRole('button', { name: 'Back to the casino' }));

    await waitFor(() => expect(rail()).not.toBeNull());
    expect(document.querySelector('.csn-board')).not.toBeNull();
    expect(screen.queryByTestId('floor-view')).toBeNull();
  });

  it('his chips open in the rail too, rather than taking the whole desk', async () => {
    routeFloor({ agents: [fundedCannon] });
    const user = userEvent.setup();
    render(<CasinoScreen desktop deployAgent={fundedCannon} />);

    await screen.findByText('placing Loose Cannon');
    await user.click(screen.getByRole('button', { name: /^the back room,/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Fund Loose Cannon' });
    expect(rail().contains(dialog)).toBe(true);
    // The building is still there behind the decision about it.
    expect(document.querySelectorAll('.csn-door')).toHaveLength(rooms.length);
  });
});
