// client/src/screens/CasinoScreen.desk.test.jsx — DESK-2, UI-3 job A
//
// The casino at 1440. UI-3 job A deleted the building/lobby split this file
// used to pin (.csn-desk__stage / .csn-desk__rail, three doorways on the
// stage, the board in the rail): there is one floor now, and FloorView
// already knows how to lay itself out at desktop width — a right-hand column
// for the deploy panel (`.csn-floor--desk .csn-floor__board`), full width
// otherwise. What is still worth pinning:
//
//   1. THE SHELL'S OWN HEADER carries the room's title and controls — the
//      screen itself renders no header of its own when one is given.
//   2. THE TICKER is a single line at the very top, same as the phone.
//   3. THE TRAY IS UNCHANGED — same component, same place, at the foot.
//   4. A STAKE PICKER (not a doorway) is the right-hand column while placing
//      a man, and his chips open there too rather than taking the whole desk.

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';

import { CasinoScreen } from './CasinoScreen.jsx';
import { rooms, felt } from '../test/fixtures/rooms.js';
import { fetchMock, telegram } from '../test/harness.js';

const fundedCannon = {
  id: 'agent_cannon', name: 'Loose Cannon',
  pocket: { mode: 'allowance', cap: 5_000, broke: false, collectable: 0, pnl: 0, balance: 2_500 },
};

function routeFloor({ agents = [], felts = [] } = {}) {
  fetchMock.route('/api/rooms', { rooms, hotWindowMs: 20_000 });
  fetchMock.route(/\/api\/rooms\/([^/]+)\/tables$/, ({ url }) => {
    const room = url.match(/\/api\/rooms\/([^/]+)\/tables$/)?.[1];
    return { room, tables: felts.filter((f) => f.room === room), hotWindowMs: 20_000 };
  });
  fetchMock.route('/api/events', { events: [], lastId: 0 });
  fetchMock.route('/api/agents', { agents });
  fetchMock.route('/api/wallet', { balance: 9_000, staked: 0, session: 0, ledger: [] });
}

beforeEach(() => { telegram.signIn(); });

describe('DESK-2 · the casino on the desk', () => {
  it('is one floor, not two columns of a building — the same floor the phone shows', async () => {
    routeFloor({ felts: [felt({ tableId: 't1' })] });
    render(<CasinoScreen desktop />);

    const view = await screen.findByTestId('floor-view');
    expect(view.classList.contains('csn-floor--desk')).toBe(true);
    expect(document.querySelector('.csn-desk__stage')).toBeNull();
    expect(document.querySelector('.csn-desk__rail')).toBeNull();
    expect(document.querySelector('.csn-room-door')).toBeNull();
  });

  it('the ticker sits above everything, at the very top', async () => {
    routeFloor();
    render(<CasinoScreen desktop />);

    await screen.findByTestId('floor-view');
    const ticker = screen.getByTestId('casino-ticker');
    const view = screen.getByTestId('floor-view');
    // DOCUMENT_POSITION_FOLLOWING (4): ticker comes before the room in the tree.
    expect(ticker.compareDocumentPosition(view) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('the shell header carries the room, and this screen draws none of its own', async () => {
    routeFloor();
    const header = document.createElement('header');
    document.body.appendChild(header);
    try {
      const view = render(<CasinoScreen desktop headerTarget={header} />);
      await screen.findByTestId('floor-view');
      expect(within(header).getByRole('heading', { name: 'The casino floor' })).toBeVisible();
      expect(view.container.querySelector('.csn-floor__head')).toBeNull();
      view.unmount();
      expect(header).toBeEmptyDOMElement();
    } finally { header.remove(); }
  });

  it('the deploy tray is unchanged: same tray, at the foot of the screen', async () => {
    routeFloor({ agents: [fundedCannon] });
    render(<CasinoScreen desktop deployAgent={fundedCannon} />);

    expect(await screen.findByRole('button', { name: /deal him in/i })).toBeInTheDocument();
  });

  it('a stake picker is the right-hand column while placing a man, not a doorway — with or without tables already on the floor', async () => {
    routeFloor({ agents: [fundedCannon], felts: [felt({ tableId: 't1', room: 'floor' })] });
    render(<CasinoScreen desktop deployAgent={fundedCannon} />);

    const view = await screen.findByTestId('floor-view');
    const board = view.querySelector('.csn-floor__board');
    expect(board).not.toBeNull();
    expect(within(board).getByRole('group', { name: 'Choose a stake' })).toBeInTheDocument();
    expect(document.querySelector('.csn-door')).toBeNull();
  });

  it('his chips open where the deploy card was, not the whole desk', async () => {
    routeFloor({ agents: [fundedCannon] });
    const user = userEvent.setup();
    render(<CasinoScreen desktop deployAgent={fundedCannon} />);

    const view = await screen.findByTestId('floor-view');
    await user.click(within(view).getByRole('button', { name: /\$50\/\$100/ }));

    const dialog = await screen.findByRole('dialog', { name: 'Fund Loose Cannon' });
    expect(view.querySelector('.csn-floor__board').contains(dialog)).toBe(true);
  });

  it('"Not now" stops placing him, from the shell header', async () => {
    routeFloor({ agents: [fundedCannon] });
    const header = document.createElement('header');
    document.body.appendChild(header);
    const onCancelDeploy = vi.fn();
    try {
      render(<CasinoScreen desktop deployAgent={fundedCannon} headerTarget={header} onCancelDeploy={onCancelDeploy} />);
      await screen.findByTestId('floor-view');
      await userEvent.click(within(header).getByRole('button', { name: 'Stop placing him' }));
      expect(onCancelDeploy).toHaveBeenCalled();
    } finally { header.remove(); }
  });
});
