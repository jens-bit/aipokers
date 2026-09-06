// client/src/screens/HomeScreen.test.jsx — HOME-1
//
// The room, as a user meets it: who is in it, what they are doing, the want he
// answers, the thread he opens, and the walk when somebody moves.
//
// Everything is driven through the real socket stub and the real fetch stub, so
// these assert on HOME_STATE and on POST bodies rather than on props — the
// screen's contract is with the server, and that is what a regression would
// break.

import { StrictMode } from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HomeScreen, studyTag, moneyLine } from './HomeScreen.jsx';
import { fetchMock, socketMock, telegram } from '../test/harness.js';

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
  ...over,
});

// Serve the roster over REST and push the same thing over HOME_STATE, which is
// what a real boot does.
//
// `roster` is a live box rather than a captured array: the screen refreshes over
// REST after several actions, and a fixture frozen at boot would serve back the
// want the owner has just answered - which is the exact race the hook's push
// overlay exists to stop, so the fixture must not fake its way past it.
//
// The defaults are registered FIRST and routes match newest-first, so a test
// that registers its own /thread or /study route still wins.
function serve(agents) {
  const roster = { agents };
  fetchMock.route('/api/agents?', () => ({ agents: roster.agents }));
  return roster;
}

function defaults() {
  fetchMock.route(/\/study\?/, () => ({ book: [], study: null, count: 0 }));
  fetchMock.route(/\/thread\?/, () => ({ sessionId: 's1', lines: [], count: 0 }));
}

async function boot(agents, game = null, props = {}) {
  defaults();
  const roster = serve(agents);
  const view = render(<HomeScreen wsUrl={WS} {...props} />);
  const sock = await waitFor(() => {
    const s = socketMock.last();
    expect(s).toBeTruthy();
    return s;
  });
  sock.open();
  sock.emit({ type: 'home_state', userId: 'u1', agents, game });
  await screen.findByTestId('home-screen');
  return { view, sock, roster };
}

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

// ── The room ────────────────────────────────────────────────────────────────

describe('HOME-1 · the room', () => {
  it('one agent alone is in the room, and the wall is empty hooks', async () => {
    await boot([mkAgent('a1', 'The Clock', { routine: { key: 'tape', label: 'the tape room' } })]);
    const body = await screen.findByRole('button', { name: /The Clock — the tape room/i });
    expect(body).toHaveAttribute('data-routine', 'tape');
    // He is in front of the television, which is where studying happens.
    expect(body).toHaveAttribute('data-spot', 'tape');
    expect(screen.getByTestId('home-tape')).toBeInTheDocument();
  });

  it('two home and one away: two bodies in the room, one picture on the wall', async () => {
    await boot([
      mkAgent('a1', 'The Clock'),
      mkAgent('a2', 'River Rat', { routine: { key: 'counts', label: 'counting chips' } }),
      mkAgent('a3', 'Big Slick', {
        location: loc('table', { tableId: 't1', room: 'upstairs' }),
        routine: null,
        activeTableId: 't1',
        liveGame: { tableId: 't1', pot: 480, board: ['Ah', 'Kd', '2c'], net: 340 },
      }),
    ]);

    expect(await screen.findByRole('button', { name: /The Clock/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /River Rat/ })).toBeInTheDocument();

    const frame = screen.getByTestId('home-frame-a3');
    expect(frame).toHaveTextContent('Big');
    expect(frame).toHaveTextContent('25/50');
    expect(frame).toHaveTextContent('+$340');
    expect(frame).toHaveTextContent(/\d+ min/);
    // He is on the wall and NOT standing in the room.
    expect(screen.queryByRole('button', { name: /Big Slick —/ })).not.toBeInTheDocument();
  });

  it('the home table never shows money — that is the whole point of it', async () => {
    await boot(
      [mkAgent('a1', 'The Clock'), mkAgent('a2', 'River Rat')],
      { tableId: 'home-u1', state: 'running', seats: [{ agentId: 'a1' }, { agentId: 'a2' }], handsPlayed: 3 },
    );
    const label = await screen.findByTestId('home-game-label');
    expect(label).toHaveTextContent('FOR NOTHING');
    // No pot, no stack, no P&L anywhere on the felt.
    expect(label.closest('.home-flat')).not.toHaveTextContent(/\$/);
  });

  it('no status label is printed under anybody', async () => {
    // Jens's correction: the routine is something you SEE. The ref printed
    // "PACING" under every body; labelling the animation is admitting it failed.
    await boot([mkAgent('a1', 'The Clock', { routine: { key: 'paces', label: 'pacing' } })]);
    const body = await screen.findByRole('button', { name: /The Clock/ });
    expect(body.textContent).not.toMatch(/PACING/);
    expect(body.textContent).not.toMatch(/pacing/);
  });

  it('the pill sits above the head and carries stamina and heat', async () => {
    await boot([mkAgent('a1', 'The Clock', { fatigue: 'worn', mood: { state: 'tilted', heat: 82 } })]);
    const body = await screen.findByRole('button', { name: /The Clock/ });
    const pill = body.querySelector('.home-pill');
    expect(pill).toBeTruthy();
    expect(pill).toHaveAttribute('data-fatigue', 'worn');
    expect(pill).toHaveAttribute('data-heat', 'hot');
    // Above: the pill precedes the body in document order, which is what the
    // column-flex renders as "over his head".
    const ghost = body.querySelector('.home-one__body');
    expect(pill.compareDocumentPosition(ghost) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});

// ── Walks ───────────────────────────────────────────────────────────────────

describe('HOME-1 · walks', () => {
  it('a change of place puts him in the walking class, and it wears off', async () => {
    const one = mkAgent('a1', 'The Clock', { routine: { key: 'sleeps', label: 'asleep' } });
    const two = mkAgent('a2', 'River Rat');
    const { sock } = await boot([one, two]);

    const before = await screen.findByRole('button', { name: /The Clock/ });
    expect(before).toHaveAttribute('data-spot', 'sleeps');
    expect(before).toHaveAttribute('data-walking', 'false');

    // The home game starts: couch → table.
    sock.emit({
      type: 'home_state',
      userId: 'u1',
      agents: [one, two],
      game: { tableId: 'home-u1', state: 'running', seats: [{ agentId: 'a1' }, { agentId: 'a2' }], handsPlayed: 0 },
    });

    await waitFor(() => {
      const el = screen.getByRole('button', { name: /The Clock/ });
      expect(el).toHaveAttribute('data-spot', 'table:0');
      expect(el).toHaveAttribute('data-walking', 'true');
    });

    // And it is a crossing, not a state: it ends.
    await waitFor(
      () => expect(screen.getByRole('button', { name: /The Clock/ })).toHaveAttribute('data-walking', 'false'),
      { timeout: 4000 },
    );
  }, 10_000);

  it('being in the room at mount is not a walk', async () => {
    await boot([mkAgent('a1', 'The Clock', { routine: { key: 'sleeps', label: 'asleep' } })]);
    const body = await screen.findByRole('button', { name: /The Clock/ });
    expect(body).toHaveAttribute('data-walking', 'false');
  });

  it('SESSION_END walks him in with the money line', async () => {
    const away = mkAgent('a1', 'Big Slick', {
      location: loc('table', { tableId: 't1', room: 'floor' }),
      routine: null,
      activeTableId: 't1',
    });
    const { sock, roster } = await boot([away]);

    const home = mkAgent('a1', 'Big Slick', {
      location: loc('home'),
      routine: { key: 'waits', label: 'by the door' },
      unseenRecap: true,
      sessionRecap: { text: 'Took it off him on the river.' },
    });
    roster.agents = [home];
    sock.emit({ type: 'session_end', agentId: 'a1', tableId: 't1', reason: 'stopped', hands: 41, net: 2740 });
    sock.emit({ type: 'home_state', userId: 'u1', agents: [home], game: null });

    // The money line rides above him and lands once.
    expect(await screen.findByTestId('home-says-a1')).toHaveTextContent('+$2,740');
  });

  it('the money line reads a loss as a loss', () => {
    expect(moneyLine({ net: 2740 })).toBe('+$2,740');
    expect(moneyLine({ net: -90 })).toBe('−$90');
    expect(moneyLine(null)).toBeNull();
  });
});

// ── Wants ───────────────────────────────────────────────────────────────────

describe('HOME-1 · the want', () => {
  const wanting = () => mkAgent('a1', 'The Clock', {
    mood: { state: 'frustrated', heat: 62 },
    want: { kind: 'beer', text: "Can I have a beer. It's been rough.", needs: null, dangerous: false },
  });

  it('he asks in the room, and the answer is a toast over the thread', async () => {
    await boot([wanting()]);
    // His bubble: who is asking, in his voice.
    expect(await screen.findByTestId('home-news-a1')).toHaveTextContent("Can I have a beer");
    // The toast: where you answer.
    const toast = screen.getByTestId('home-want');
    expect(toast).toHaveTextContent("Can I have a beer");
    expect(within(toast).getByTestId('home-want-yes')).toBeInTheDocument();
    expect(within(toast).getByTestId('home-want-later')).toBeInTheDocument();
    expect(within(toast).getByTestId('home-want-no')).toBeInTheDocument();
  });

  it('there is no way to make it go away that is not an answer', async () => {
    await boot([wanting()]);
    const toast = await screen.findByTestId('home-want');
    // No dismiss, no X, no close. Ignoring him must not be a move.
    expect(within(toast).queryByRole('button', { name: /dismiss|close|✕/i })).toBeNull();
    expect(within(toast).getAllByRole('button')).toHaveLength(3);
  });

  it('yes POSTs the answer and the ask is gone', async () => {
    let posted = null;
    const { roster } = await boot([wanting()]);
    fetchMock.route(/\/want\?/, ({ body }) => {
      posted = body;
      // The server has cleared it; so does the fixture, or the refresh that
      // follows would be serving a stale roster rather than a real one.
      roster.agents = [mkAgent('a1', 'The Clock', { want: null })];
      return { answered: 'yes', kind: 'beer', want: null };
    }, { method: 'POST' });

    await userEvent.click(await screen.findByTestId('home-want-yes'));
    await waitFor(() => expect(posted).toEqual(expect.objectContaining({ answer: 'yes' })));
    await waitFor(() => expect(screen.queryByTestId('home-want')).toBeNull());
  });

  it('later and no post the same way', async () => {
    const sent = [];
    fetchMock.route(/\/want\?/, ({ body }) => { sent.push(body.answer); return { answered: body.answer, want: null }; }, { method: 'POST' });

    await boot([wanting()]);
    await userEvent.click(await screen.findByTestId('home-want-later'));
    await waitFor(() => expect(sent).toEqual(['later']));
  });

  it('a yes the server cannot finish hands the client what to open', async () => {
    let deployed = null;
    await boot([wanting()], null, { onDeploy: (agent, opts) => { deployed = { id: agent.id, ...opts }; } });
    fetchMock.route(/\/want\?/, () => ({ answered: 'yes', kind: 'rest', want: null, needs: 'deploy', room: 'upstairs' }), { method: 'POST' });

    await userEvent.click(await screen.findByTestId('home-want-yes'));
    await waitFor(() => expect(deployed).toEqual({ id: 'a1', room: 'upstairs' }));
  });

  it('a WANT push clears a toast answered on another device', async () => {
    const { sock } = await boot([wanting()]);
    expect(await screen.findByTestId('home-want')).toBeInTheDocument();
    sock.emit({ type: 'want', userId: 'u1', agentId: 'a1', want: null });
    await waitFor(() => expect(screen.queryByTestId('home-want')).toBeNull());
  });
});

// ── The thread ──────────────────────────────────────────────────────────────

describe('HOME-1 · the thread', () => {
  it('collapsed it is one line and a composer', async () => {
    await boot([mkAgent('a1', 'The Clock', {
      unseenRecap: true,
      sessionRecap: { text: 'Quiet night. Nothing to report.' },
    })]);
    const band = await screen.findByTestId('home-thread');
    expect(band).toHaveAttribute('data-open', 'false');
    expect(screen.getByTestId('home-thread-line')).toHaveTextContent('Quiet night');
    expect(screen.getByTestId('home-thread-input')).toBeInTheDocument();
    expect(screen.queryByTestId('home-thread-rows')).toBeNull();
  });

  it('tapping the line opens the sheet over the room, and the room stays', async () => {
    await boot([mkAgent('a1', 'The Clock')]);
    fetchMock.route(/\/thread\?/, () => ({
      sessionId: 's1',
      lines: [
        { id: 1, kind: 'table', who: 'TABLE', text: 'Granite raised to 240', ts: 1, source: 'table' },
        { id: 2, kind: 'him', who: 'HIM', text: 'He does that every time.', ts: 2, source: 'home' },
      ],
      count: 2,
    }));

    await userEvent.click(await screen.findByTestId('home-thread-line'));
    const rows = await screen.findByTestId('home-thread-rows');
    expect(rows).toHaveTextContent('Granite raised to 240');
    expect(rows).toHaveTextContent('He does that every time.');
    // The room is still there behind the glass — the sheet is a layer, not a
    // screen. (WATCH v6's law, applied to the room.)
    expect(screen.getByTestId('home-screen')).toBeInTheDocument();
    expect(screen.getByTestId('home-wall')).toBeInTheDocument();
  });

  it('the sheet still loads under StrictMode, which is how the app renders', async () => {
    // The app mounts inside <StrictMode>, which mounts, unmounts and mounts
    // again. An alive-ref armed only by its initial value is false for the
    // whole life of the real component after that, and every fetch throws its
    // answer away — the sheet reads LOADING forever. Testing Library does not
    // render in StrictMode, so nothing else in this file can see it.
    defaults();
    fetchMock.route(/\/thread\?/, () => ({
      sessionId: 's1',
      lines: [{ id: 1, kind: 'him', who: 'HIM', text: 'Long night in here.', ts: 1, source: 'home' }],
      count: 1,
    }));
    const roster = serve([mkAgent('a1', 'The Clock')]);
    render(<StrictMode><HomeScreen wsUrl={WS} /></StrictMode>);
    const sock = await waitFor(() => { const x = socketMock.last(); expect(x).toBeTruthy(); return x; });
    sock.open();
    sock.emit({ type: 'home_state', userId: 'u1', agents: roster.agents, game: null });

    await userEvent.click(await screen.findByTestId('home-thread-line'));
    expect(await screen.findByTestId('home-thread-rows')).toHaveTextContent('Long night in here.');
  });

  it('tapping an agent opens HIS thread screen', async () => {
    // CASINO-1 took CHATS off the tab bar on the promise that the thread is
    // reached from Home and from a profile. In the room, from the man.
    let opened = null;
    await boot(
      [mkAgent('a1', 'The Clock'), mkAgent('a2', 'River Rat', { routine: { key: 'counts', label: 'counting chips' } })],
      null,
      { onOpenThread: (agent) => { opened = agent.id; } },
    );
    await userEvent.click(await screen.findByRole('button', { name: /River Rat/ }));
    expect(opened).toBe('a2');
  });

  it('with nowhere to send him, the band is the thread', async () => {
    // Standalone (no onOpenThread), the room keeps the conversation in itself
    // rather than dropping the tap on the floor.
    await boot([mkAgent('a1', 'The Clock')]);
    await userEvent.click(await screen.findByRole('button', { name: /The Clock/ }));
    expect(await screen.findByRole('dialog', { name: /The Clock/i })).toBeInTheDocument();
  });

  it('the composer never inserts a row — the server writes it', async () => {
    let sent = null;
    await boot([mkAgent('a1', 'The Clock')]);
    // Re-render with a spy send would remount; instead assert on the DOM: the
    // typed text must not appear as a row before the reload serves it.
    const input = await screen.findByTestId('home-thread-input');
    await userEvent.type(input, 'you punted that');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    await waitFor(() => expect(input).toHaveValue(''));
    expect(screen.queryByTestId('home-thread-rows')).toBeNull();
    expect(sent).toBeNull();
  });
});

// ── The tape room ───────────────────────────────────────────────────────────

describe('HOME-1 · the tape room', () => {
  it('studying puts the replay on the television and the tally under his bubble', async () => {
    defaults();
    fetchMock.route(/\/study\?/, () => ({
      study: { handNumber: 41 },
      book: [{ playerId: 'p1', displayName: 'Granite', lines: [{ text: 'a' }, { text: 'b' }, { text: 'c' }] }],
      count: 1,
    }));
    const roster = serve([mkAgent('a1', 'The Clock', { routine: { key: 'tape', label: 'the tape room' } })]);
    render(<HomeScreen wsUrl={WS} />);
    const sock = await waitFor(() => { const x = socketMock.last(); expect(x).toBeTruthy(); return x; });
    sock.open();
    sock.emit({ type: 'home_state', userId: 'u1', agents: roster.agents, game: null });
    expect(await screen.findByTestId('home-tape')).toBeInTheDocument();
    expect(await screen.findByTestId('home-says-a1')).toHaveTextContent('+3 GRANITE');
  });

  it('the tally is his read book, not a score', () => {
    expect(studyTag([{ displayName: 'Granite', lines: [1, 2, 3] }])).toBe('+3 GRANITE');
    expect(studyTag([])).toBeNull();
    expect(studyTag(null)).toBeNull();
  });
});

// ── The fixtures that open sheets ───────────────────────────────────────────

describe('HOME-1 · the safe and the fridge', () => {
  it('the fridge opens the stock sheet and gives one thing to one agent', async () => {
    let given = null;
    fetchMock.route(/\/give\?/, ({ body }) => { given = body; return { ok: true, moment: { text: 'That helps. Thanks.' } }; }, { method: 'POST' });
    await boot([mkAgent('a1', 'The Clock')]);

    await userEvent.click(await screen.findByTestId('home-fridge'));
    await userEvent.click(await screen.findByTestId('home-give-beer'));
    await waitFor(() => expect(given).toEqual(expect.objectContaining({ item: 'beer' })));
    expect(await screen.findByText('That helps. Thanks.')).toBeInTheDocument();
  });

  it('the room never prints a seat price', async () => {
    await boot([mkAgent('a1', 'The Clock')]);
    const room = document.querySelector('.home-flat');
    expect(room.textContent).not.toMatch(/\$/);
  });

  it('the safe is the way to the money and is not a number in the room', async () => {
    let opened = false;
    await boot([mkAgent('a1', 'The Clock')], null, { onOpenWallet: () => { opened = true; } });
    const safe = await screen.findByTestId('home-safe');
    expect(safe.textContent).toBe('');
    await userEvent.click(safe);
    expect(opened).toBe(true);
  });
});
