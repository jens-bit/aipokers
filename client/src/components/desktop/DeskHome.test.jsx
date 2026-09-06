// client/src/components/desktop/DeskHome.test.jsx — DESK-2
//
// HOME at 1440: the same room, and the rail.
//
// What is worth pinning here is exactly what the brief and board 31 promise,
// and nothing about pixels:
//
//   1. IT IS THE SAME ROOM. One .home-flat, in the same coordinate space, with
//      the same bodies — not a second desktop room drawn beside the phone's.
//   2. THE THREAD IS PERMANENT. No collapsed band, no sheet: the room's thread
//      is in the rail from the first frame, and it is THREAD-2's room thread
//      (/api/home/thread) rather than one agent's.
//   3. EVERY LINE SAYS WHO TO WHOM. THREAD-2's whole point.
//   4. A FIXTURE OPENS IN THE RAIL, and the room dims rather than being
//      covered — safe, fridge, table.
//   5. NOTHING INSERTS A ROW. The composer POSTs to /api/home/say and reloads.

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { DeskHome } from './DeskHome.jsx';
import { fetchMock, socketMock, telegram } from '../../test/harness.js';

const WS = 'ws://localhost:8765';

const loc = (where = 'home', extra = {}) => ({
  where, tableId: null, room: null, since: Date.now() - 41 * 60_000, ...extra,
});

const mkAgent = (id, name, over = {}) => ({
  id,
  name,
  nature: { name: 'Rock' },
  mood: { state: 'neutral', heat: 40 },
  fatigue: 'fresh',
  location: loc('home'),
  routine: { key: 'reads', label: 'reading' },
  unseenRecap: false,
  want: null,
  opener: 'Sit down.',
  activeTableId: null,
  pocket: { balance: 2000, mode: 'topup', cap: null },
  ...over,
});

const BALANCE = mkAgent('a1', 'Balance');
const GRANITE = mkAgent('a2', 'Granite', { nature: { name: 'Grinder' } });

// THREAD-2's own shapes: an attributed `him` line, the owner's `you` line
// addressed to the room, and the nightly exchange as ONE `overheard` entry.
const ROOM_LINES = [
  {
    id: 1,
    kind: 'overheard',
    who: 'HIM',
    text: 'You always raise that.',
    ts: Date.now() - 900_000,
    source: 'home',
    from: 'a1',
    to: 'a2',
    lines: [
      { from: 'a1', to: 'a2', who: 'HIM', text: 'You always raise that. Always.' },
      { from: 'a2', to: 'a1', who: 'HIM', text: 'And you always fold.' },
    ],
  },
  { id: 2, kind: 'you', who: 'YOU', text: 'Who wants 25/50 tonight?', ts: Date.now() - 600_000, source: 'home', from: 'owner', to: 'all' },
  { id: 3, kind: 'him', who: 'HIM', text: 'Me. Obviously me.', ts: Date.now() - 500_000, source: 'home', from: 'a1', to: 'owner' },
  // Pre-THREAD-2: no from, no to. It prints its sentence and claims nothing.
  { id: 4, kind: 'him', who: 'HIM', text: 'Long night in here.', ts: Date.now() - 400_000, source: 'home', from: null, to: null },
];

function serve({ agents = [BALANCE, GRANITE], room = ROOM_LINES, slots = null } = {}) {
  fetchMock.route(/\/study\?/, () => ({ book: [], study: null, count: 0 }));
  fetchMock.route('/api/home/thread', () => ({ sessionId: 'home-1', lines: room, count: room.length }));
  fetchMock.route('/api/slots', () => slots ?? { used: 2, cap: 4, next: { index: 3, price: 50_000, earned: 12_000, unlocked: false } });
  fetchMock.route('/api/wallet', () => ({ balance: 54_000, ledger: [] }));
  fetchMock.route('/api/agents?', () => ({ agents }));
  return agents;
}

async function boot({ agents = [BALANCE, GRANITE], game = null, ...rest } = {}) {
  serve({ agents, ...rest });
  const view = render(<DeskHome wsUrl={WS} onCreateAgent={() => {}} />);
  const sock = await waitFor(() => {
    const s = socketMock.last();
    expect(s).toBeTruthy();
    return s;
  });
  sock.open();
  sock.emit({ type: 'home_state', userId: 'u1', agents, game });
  await screen.findByTestId('home-screen');
  return { view, sock };
}

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

describe('DESK-2 · the same room, bigger', () => {
  it('draws ONE room, and it is the phone\'s — same flat, same coordinate space', async () => {
    await boot();
    const rooms = document.querySelectorAll('.home-flat');
    expect(rooms).toHaveLength(1);
    // flat.js's box, untouched: the desk scales it, it does not re-author it.
    expect(rooms[0]).toHaveStyle({ width: '390px', height: '470px' });
    expect(document.querySelector('.home1--desk')).not.toBeNull();
  });

  it('puts every agent at home in the room', async () => {
    await boot();
    await waitFor(() => {
      expect(document.querySelector('.home-one[data-agent="a1"]')).not.toBeNull();
      expect(document.querySelector('.home-one[data-agent="a2"]')).not.toBeNull();
    });
  });
});

describe('DESK-2 · the thread is a rail, not a sheet', () => {
  it('is open from the first frame, with no band to tap', async () => {
    await boot();
    expect(await screen.findByTestId('room-thread')).toBeInTheDocument();
    expect(screen.queryByTestId('home-thread')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-thread-line')).not.toBeInTheDocument();
  });

  it('reads THE ROOM\'s thread, not one agent\'s', async () => {
    await boot();
    await waitFor(() => {
      expect(fetchMock.calls.some((c) => c.url.includes('/api/home/thread'))).toBe(true);
    });
  });

  it('says who is talking to whom', async () => {
    await boot();
    const rows = await screen.findByTestId('room-thread-rows');
    await within(rows).findByText('Me. Obviously me.');
    expect(within(rows).getByText('BALANCE → YOU')).toBeInTheDocument();
    expect(within(rows).getByText('YOU → THE ROOM')).toBeInTheDocument();
  });

  it('a line written before THREAD-2 claims nothing rather than guessing', async () => {
    await boot();
    const rows = await screen.findByTestId('room-thread-rows');
    const line = within(rows).getByText('Long night in here.').closest('.room-thread__line');
    expect(line.querySelector('.room-thread__who')).toBeNull();
  });

  it('the nightly exchange is ONE entry, and it opens', async () => {
    await boot();
    const entry = await screen.findByTestId('room-thread-overheard');
    expect(document.querySelectorAll('[data-testid="room-thread-overheard"]')).toHaveLength(1);

    await userEvent.click(within(entry).getByRole('button'));
    expect(within(entry).getByText('And you always fold.')).toBeInTheDocument();
    expect(within(entry).getByText('GRANITE → BALANCE')).toBeInTheDocument();
  });

  it('the composer POSTs to the house and never inserts the line itself', async () => {
    await boot();
    const input = await screen.findByTestId('room-thread-input');
    await userEvent.type(input, 'Everybody in tonight?');
    await userEvent.click(screen.getByRole('button', { name: /say it/i }));

    const post = await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes('/api/home/say') && c.method === 'POST');
      expect(call).toBeTruthy();
      return call;
    });
    expect(post.body.text).toBe('Everybody in tonight?');
    // The room's fixture never grew a row, and neither did the rail.
    expect(screen.queryByText('Everybody in tonight?')).toBeNull();
  });

  it('an empty flat says so instead of swallowing the sentence', async () => {
    await boot({ agents: [mkAgent('a1', 'Balance', { location: loc('table', { tableId: 't1' }) })] });
    expect(await screen.findByTestId('room-thread-empty-flat')).toBeInTheDocument();
  });
});

describe('DESK-2 · the fixtures open in the rail', () => {
  const dimmed = () => document.querySelector('.home1__room')?.getAttribute('data-dim');

  it('the safe is the money surface, in the rail, over a dimmed room', async () => {
    await boot();
    expect(dimmed()).toBe('false');

    await userEvent.click(await screen.findByTestId('home-safe'));
    expect(await screen.findByText('The safe')).toBeInTheDocument();
    // The room is dimmed, not covered: it is still on screen and still playing.
    expect(document.querySelectorAll('.home-flat')).toHaveLength(1);
    expect(dimmed()).toBe('true');
  });

  it('the fridge is HOME-1\'s own sheet, mounted inline instead of as glass', async () => {
    await boot();
    await userEvent.click(await screen.findByTestId('home-fridge'));

    const sheet = await screen.findByTestId('home-fridge-sheet');
    expect(sheet.className).toContain('home-sheet--rail');
    // No scrim, because there is nothing to close over.
    expect(within(sheet).queryByRole('button', { name: '^Close$' })).toBeNull();
    expect(screen.getByTestId('home-give-beer')).toBeInTheDocument();
  });

  it('the table prices the next chair from the server, and does not offer a locked one', async () => {
    await boot();
    await userEvent.click(await screen.findByTestId('home-table'));

    const sheet = await screen.findByTestId('home-table-sheet');
    expect(within(sheet).getByText('3RD SEAT')).toBeInTheDocument();
    expect(within(sheet).getByText('50,000 won')).toBeInTheDocument();
    // Not unlocked yet: the distance is stated and there is no action at all,
    // because there is no path from a wallet to a chair.
    expect(within(sheet).getByTestId('home-table-locked')).toHaveTextContent('38,000 to go');
    expect(within(sheet).queryByTestId('home-table-draft')).toBeNull();
  });

  it('an unlocked chair drafts him', async () => {
    let drafted = 0;
    serve({ slots: { used: 1, cap: 4, next: { index: 2, price: 10_000, earned: 24_000, unlocked: true } } });
    render(<DeskHome wsUrl={WS} onCreateAgent={() => { drafted += 1; }} />);
    const sock = await waitFor(() => {
      const s = socketMock.last();
      expect(s).toBeTruthy();
      return s;
    });
    sock.open();
    sock.emit({ type: 'home_state', userId: 'u1', agents: [BALANCE], game: null });

    await userEvent.click(await screen.findByTestId('home-table'));
    await userEvent.click(await screen.findByTestId('home-table-draft'));
    expect(drafted).toBe(1);
  });

  it('closing a fixture puts the room\'s thread back and un-dims the room', async () => {
    await boot();
    await userEvent.click(await screen.findByTestId('home-table'));
    await screen.findByTestId('home-table-sheet');

    await userEvent.click(screen.getByRole('button', { name: /close panel/i }));
    expect(await screen.findByTestId('room-thread')).toBeInTheDocument();
    expect(dimmed()).toBe('false');
  });
});

describe('DESK-2 · the man in the room', () => {
  it('tapping a body swaps the rail to HIS thread, and the room stays', async () => {
    await boot();
    const body = await waitFor(() => {
      const el = document.querySelector('.home-one[data-agent="a2"]');
      expect(el).not.toBeNull();
      return el;
    });
    await userEvent.click(body);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /player card/i })).toBeInTheDocument();
    });
    expect(screen.queryByTestId('room-thread')).not.toBeInTheDocument();
    expect(document.querySelectorAll('.home-flat')).toHaveLength(1);
  });
});
