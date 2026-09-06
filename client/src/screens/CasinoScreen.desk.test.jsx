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
import { restingAgent } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

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
  it('is two columns: the building on the stage, the ticker in the rail', async () => {
    routeFloor();
    render(<CasinoScreen desktop />);

    await waitFor(() => expect(document.querySelectorAll('.csn-door').length).toBe(rooms.length));
    expect(stage()).not.toBeNull();
    expect(rail()).not.toBeNull();

    // Every doorway is on the stage; the board is not.
    for (const door of document.querySelectorAll('.csn-door')) {
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
