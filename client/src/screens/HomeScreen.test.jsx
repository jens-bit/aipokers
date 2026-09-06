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
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { HomeScreen, studyTag, moneyLine } from './HomeScreen.jsx';
import { fetchMock, socketMock, telegram } from '../test/harness.js';
import { bubbleRect, overlaps, pillRect } from '../components/home/roomBubbles.js';
import { LONG_PRESS_MS } from '../components/home/carry.js';
import { lockedSeatLine } from '../lib/slots.js';
import { FLAT, TV_SCREEN, F_W, F_H } from '../components/home/flat.js';

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

// ── The empty state ─────────────────────────────────────────────────────────

describe('BUGS-A job 2 · the room renders while the roster is in flight', () => {
  it('an unanswered roster is not an empty household', async () => {
    defaults();
    // The roster never answers. This is the width of every trip back to HOME:
    // CASINO -> HOME, a profile closing, a retire with agents left.
    let answer;
    fetchMock.route('/api/agents?', () => new Promise((resolve) => { answer = resolve; }));
    render(<HomeScreen wsUrl={WS} />);

    // The flat is on screen and the claim about the owner is not made.
    expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
    expect(screen.getByTestId('home-fridge')).toBeInTheDocument();
    expect(screen.queryByTestId('home-ftu')).toBeNull();
    expect(screen.queryByRole('button', { name: 'DRAFT YOUR FIRST AGENT' })).toBeNull();

    // ...and when it answers with a household, the household is what appears.
    answer({ agents: [mkAgent('a1', 'The Clock')] });
    expect(await screen.findByRole('button', { name: /The Clock — / })).toBeInTheDocument();
    expect(screen.queryByTestId('home-ftu')).toBeNull();
  });

  // HOME-2 job 7: and the answer is still the ROOM. An empty room is a room —
  // this used to be a centred card on a blank screen, which is the one thing
  // FTU-1's own rule forbids.
  it('a roster that answers with zero is the one thing that shows the empty state', async () => {
    defaults();
    serve([]);
    render(<HomeScreen wsUrl={WS} />);
    expect(await screen.findByTestId('home-ftu')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DRAFT YOUR FIRST AGENT' })).toBeInTheDocument();
    // Still the room, with its furniture in it.
    expect(screen.getByTestId('home-fridge')).toBeInTheDocument();
    expect(screen.getByTestId('home-safe')).toBeInTheDocument();
  });

  it('a roster request that FAILS keeps the room, because a 500 is not an answer', async () => {
    defaults();
    fetchMock.route('/api/agents?', () => ({ status: 500, body: {} }));
    render(<HomeScreen wsUrl={WS} />);
    const room = await screen.findByTestId('home-screen');
    await waitFor(() => expect(within(room).getByTestId('home-fridge')).toBeInTheDocument());
    expect(screen.queryByTestId('home-ftu')).toBeNull();
  });
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

    expect(await screen.findByRole('button', { name: /The Clock — / })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /River Rat — / })).toBeInTheDocument();

    const frame = screen.getByTestId('home-frame-a3');
    expect(frame).toHaveTextContent('Big');
    expect(frame).toHaveTextContent('25/50');
    expect(frame).toHaveTextContent('+$340');
    expect(frame).toHaveTextContent(/\d+ min/);
    // He is on the wall and NOT standing in the room.
    expect(screen.queryByRole('button', { name: /Big Slick —/ })).not.toBeInTheDocument();
  });

  // FIX-6 job 4 replaces the rule this test used to encode. The felt carried
  // the words FOR NOTHING, on the theory that saying there are no stakes is the
  // opposite of naming one. Design 52's rule is flatter and it is the one that
  // stands: NO MONEY WORDS on the home table. A running table says nothing.
  it('the home table never shows money, and never talks about it either', async () => {
    await boot(
      [mkAgent('a1', 'The Clock'), mkAgent('a2', 'River Rat')],
      { tableId: 'home-u1', state: 'running', seats: [{ agentId: 'a1' }, { agentId: 'a2' }], handsPlayed: 3 },
    );
    await screen.findByTestId('home-board');
    const flat = document.querySelector('.home-flat');
    // No pot, no stack, no P&L, and no label saying there is none of it.
    expect(flat).not.toHaveTextContent(/\$/);
    expect(flat).not.toHaveTextContent(/FOR NOTHING/);
    expect(screen.queryByTestId('home-game-label')).toBeNull();
  });

  it('an empty table still says it is empty — that is a fact about the room', async () => {
    await boot([mkAgent('a1', 'The Clock')]);
    expect(await screen.findByTestId('home-game-label')).toHaveTextContent('NOBODY AT THE TABLE');
  });

  it('no status label is printed under anybody', async () => {
    // Jens's correction: the routine is something you SEE. The ref printed
    // "PACING" under every body; labelling the animation is admitting it failed.
    await boot([mkAgent('a1', 'The Clock', { routine: { key: 'paces', label: 'pacing' } })]);
    const body = await screen.findByRole('button', { name: /The Clock — / });
    expect(body.textContent).not.toMatch(/PACING/);
    expect(body.textContent).not.toMatch(/pacing/);
  });

  it('the pill sits above the head and carries stamina and heat', async () => {
    await boot([mkAgent('a1', 'The Clock', { fatigue: 'worn', mood: { state: 'tilted', heat: 82 } })]);
    const body = await screen.findByRole('button', { name: /The Clock — / });
    const pill = body.querySelector('.home-pill');
    expect(pill).toBeTruthy();
    expect(pill).toHaveAttribute('data-fatigue', 'worn');
    // HOME-2 job 2: the four steps have one vocabulary now, the ref's own.
    expect(pill).toHaveAttribute('data-heat', 'fire');
    // Above: the pill precedes the body in document order, which is what the
    // column-flex renders as "over his head".
    const ghost = body.querySelector('.home-one__body');
    expect(pill.compareDocumentPosition(ghost) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  // HOME-2 job 2 · SIX CHARACTERS OVER HIS HEAD.
  //
  // BUGS-A job 1's rule is unchanged and is the reason this is a CUT and not
  // `name.split(' ')[0]`: a first word is a different name, and "The Clock"
  // and "The Grinder" both became "The". Six characters of a name is still
  // that name's beginning. The plate and the roster still write it whole —
  // this rule is the pill's alone, because the pill hangs over a 46px body
  // with two 44px bars inside it.
  it('the pill writes six characters, and never a first word', async () => {
    await boot([mkAgent('a1', 'The Clock')]);
    const body = await screen.findByRole('button', { name: /The Clock — / });
    expect(body.querySelector('.home-pill__name').textContent).toBe('The Cl');
  });

  it('a name that already fits is written whole, with no ellipsis', async () => {
    await boot([mkAgent('a1', 'Rocky')]);
    const body = await screen.findByRole('button', { name: /Rocky — / });
    expect(body.querySelector('.home-pill__name').textContent).toBe('Rocky');
  });

  // The server does not send a nickname yet. It is read the moment it does —
  // the same forward read job 3 makes of `identity`.
  it('prefers the nickname the server gives over the first six', async () => {
    await boot([mkAgent('a1', 'The Clock', { nickname: 'Tick' })]);
    const body = await screen.findByRole('button', { name: /The Clock — / });
    expect(body.querySelector('.home-pill__name').textContent).toBe('Tick');
  });

  // HOME-2 job 2 · the two bars run in opposite directions, and both start at
  // the left wall. A worn, tilted agent is a short red stub over a long red
  // bar — two opposite shapes, which is what separates the two causes.
  it('draws a short stamina stub over a long heat bar for a worn, tilted man', async () => {
    await boot([mkAgent('a1', 'The Clock', { fatigue: 'worn', mood: { state: 'tilted', heat: 82 } })]);
    const body = await screen.findByRole('button', { name: /The Clock — / });
    const stam = body.querySelector('[data-bar="stamina"] i');
    const heat = body.querySelector('[data-bar="heat"] i');
    expect(stam.style.width).toBe('16%');
    expect(heat.style.width).toBe('82%');
    // Both fills start at the left edge of their own track, so the empty end
    // of both bars is the same end.
    for (const el of [stam, heat]) {
      expect(window.getComputedStyle(el).left).toBe('0px');
    }
  });

  it('and a fresh, cold man is the opposite pair', async () => {
    await boot([mkAgent('a1', 'The Clock', { fatigue: 'fresh', mood: { state: 'neutral', heat: 8 } })]);
    const body = await screen.findByRole('button', { name: /The Clock — / });
    expect(body.querySelector('[data-bar="stamina"] i').style.width).toBe('100%');
    expect(body.querySelector('[data-bar="heat"] i').style.width).toBe('8%');
  });
});

// ── Walks ───────────────────────────────────────────────────────────────────

describe('HOME-1 · walks', () => {
  it('a change of place puts him in the walking class, and it wears off', async () => {
    const one = mkAgent('a1', 'The Clock', { routine: { key: 'sleeps', label: 'asleep' } });
    const two = mkAgent('a2', 'River Rat');
    const { sock } = await boot([one, two]);

    const before = await screen.findByRole('button', { name: /The Clock — / });
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
      const el = screen.getByRole('button', { name: /The Clock — / });
      expect(el).toHaveAttribute('data-spot', 'table:0');
      expect(el).toHaveAttribute('data-walking', 'true');
    });

    // And it is a crossing, not a state: it ends.
    await waitFor(
      () => expect(screen.getByRole('button', { name: /The Clock — / })).toHaveAttribute('data-walking', 'false'),
      { timeout: 4000 },
    );
  }, 10_000);

  it('being in the room at mount is not a walk', async () => {
    await boot([mkAgent('a1', 'The Clock', { routine: { key: 'sleeps', label: 'asleep' } })]);
    const body = await screen.findByRole('button', { name: /The Clock — / });
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
    await userEvent.click(await screen.findByRole('button', { name: /River Rat — / }));
    expect(opened).toBe('a2');
  });

  it('with nowhere to send him, the band is the thread', async () => {
    // Standalone (no onOpenThread), the room keeps the conversation in itself
    // rather than dropping the tap on the floor.
    await boot([mkAgent('a1', 'The Clock')]);
    await userEvent.click(await screen.findByRole('button', { name: /The Clock — / }));
    expect(await screen.findByRole('dialog', { name: /The Clock/i })).toBeInTheDocument();
  });

  // BUGS-A job 11 REVERSED HALF OF THIS RULE, deliberately.
  //
  // The rule was "the composer never inserts a row". It still holds for every
  // row about HIM — his voice is the server's to write, or the room and the
  // record tell two different stories. It does not hold for YOUR OWN line:
  // that is not a claim about the world the client might get wrong, it is a
  // thing the owner did a moment ago, and holding it back for a round trip
  // plus a model call made send look like a broken button.
  it('shows YOUR line at once, and never puts words in his mouth', async () => {
    let resolveSend;
    const onSend = () => new Promise((r) => { resolveSend = r; });
    await boot([mkAgent('a1', 'The Clock')], null, { onSend });

    const input = await screen.findByTestId('home-thread-input');
    await userEvent.type(input, 'you punted that');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    // Immediately, with no server anywhere near it: the band carries it.
    expect(await screen.findByText('you punted that')).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveValue(''));

    // ...and nothing at all has been said in HIS voice.
    expect(screen.queryByText(/Nothing said yet/)).toBeNull();
    resolveSend(null);
  });

  it('attributes it to YOU, in order, once the sheet is open', async () => {
    let resolveSend;
    const onSend = () => new Promise((r) => { resolveSend = r; });
    await boot([mkAgent('a1', 'The Clock')], null, { onSend });
    // Registered after boot: routes match newest-first, so this wins over the
    // empty thread `defaults()` puts in.
    fetchMock.route(/\/thread\?/, () => ({
      sessionId: 's1',
      count: 1,
      lines: [{ id: 1, kind: 'him', who: 'HIM', text: 'Rough one.', ts: 1000 }],
    }));

    await userEvent.click(screen.getByTestId('home-thread-line'));
    const sheet = await screen.findByTestId('home-thread-rows');
    await waitFor(() => expect(within(sheet).getByText('Rough one.')).toBeInTheDocument());

    await userEvent.type(screen.getByTestId('home-thread-input'), 'take it off him');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    const rows = [...(await screen.findByTestId('home-thread-rows')).querySelectorAll('.thread-row')];
    expect(rows.map((r) => r.querySelector('.thread-row__who').textContent)).toEqual(['HIM', 'YOU']);
    expect(rows[1].querySelector('.thread-row__text').textContent).toBe('take it off him');
    resolveSend(null);
  });

  it('a line the server never stored does not stay — then it was never said', async () => {
    // The reload is the truth, and this thread endpoint returns nothing ever.
    let resolveSend;
    const onSend = () => new Promise((r) => { resolveSend = r; });
    await boot([mkAgent('a1', 'The Clock')], null, { onSend });

    await userEvent.type(await screen.findByTestId('home-thread-input'), 'you punted that');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(await screen.findByText('you punted that')).toBeInTheDocument();

    resolveSend(null);
    await waitFor(() => expect(screen.queryByText('you punted that')).toBeNull());
  });
});

// ── BUGS-A job 7 ────────────────────────────────────────────────────────────

describe('BUGS-A job 7 · the taps that did nothing', () => {
  const GAME = {
    tableId: 'home-u1',
    state: 'running',
    seats: [
      { seat: 0, agentId: 'a1', name: 'The Clock', house: false },
      { seat: 1, agentId: 'a2', name: 'River Rat', house: false },
    ],
  };

  // SIT-1 CHANGED THE ROUTE, NOT THE PROMISE. BUGS-A job 7's rule is "no tap
  // that does nothing", and a kitchen table with a game on it must still be a
  // table you can go and watch. It just is not the room's own tap any more.
  //
  // The tap used to fork — a running game watched, an empty table opened the
  // sheet — and the cost of that fork was that the TableSheet was unreachable
  // for exactly as long as a game was running. That is when SIT-1's free chair
  // is worth having, so the chair had nowhere to live. Board 31 P17 had already
  // answered it: the sheet is three labelled sections with a button each — the
  // live game, the free chair, the priced one — and "no hidden taps anywhere".
  // So the table has one destination now and watching is a section of it.
  it('the kitchen table with a game on it is a table you can watch', async () => {
    fetchMock.route('/api/slots', { used: 2, cap: 4, next: null });
    const onWatchTable = vi.fn();
    await boot(
      [mkAgent('a1', 'The Clock'), mkAgent('a2', 'River Rat')],
      GAME,
      { onWatchTable },
    );
    await userEvent.click(await screen.findByTestId('home-table'));
    await userEvent.click(await screen.findByTestId('home-table-watch'));
    expect(onWatchTable).toHaveBeenCalledWith('home-u1');
  });

  it('and it is a table you can sit down at', async () => {
    fetchMock.route('/api/slots', { used: 2, cap: 4, next: null });
    const onSitTable = vi.fn();
    await boot(
      [mkAgent('a1', 'The Clock'), mkAgent('a2', 'River Rat')],
      GAME,
      { onSitTable },
    );
    await userEvent.click(await screen.findByTestId('home-table'));
    await userEvent.click(await screen.findByTestId('home-table-sit'));
    expect(onSitTable).toHaveBeenCalledWith('home-u1');
  });

  it('offers neither verb at a table with no game on it', async () => {
    fetchMock.route('/api/slots', { used: 1, cap: 4, next: null });
    await boot([mkAgent('a1', 'The Clock')], null, { onWatchTable: vi.fn(), onSitTable: vi.fn() });
    await userEvent.click(await screen.findByTestId('home-table'));
    await screen.findByTestId('home-table-sheet');
    // A table that is not standing has nothing to watch and no chair to pull
    // up. A SIT DOWN here would be a second way to start a home game, and
    // homeGame.js's sync() is the only one.
    expect(screen.queryByTestId('home-table-watch')).not.toBeInTheDocument();
    expect(screen.queryByTestId('home-table-sit')).not.toBeInTheDocument();
  });

  it('an empty table is not a dead button either — it opens the chairs', async () => {
    // BUGS-A wrote this as "an empty table stays furniture", because at the
    // time an empty table led nowhere and a button that leads nowhere is the
    // bug this job is about. BIRTH-5 then gave it somewhere to lead: the
    // chairs, priced in the TableSheet. The rule is still "no tap that does
    // nothing" — what changed is that the empty table now does something, so
    // the assertion is that it leads to the chairs and NOT to a watch.
    const onWatchTable = vi.fn();
    await boot([mkAgent('a1', 'The Clock')], null, { onWatchTable });
    const table = await screen.findByTestId('home-table');
    expect(table).toHaveAttribute('aria-label', 'The chairs');
    await userEvent.click(table);
    expect(onWatchTable).not.toHaveBeenCalled();
  });

  it('an away frame goes to the table in the picture', async () => {
    const onWatch = vi.fn();
    const away = mkAgent('a3', 'Big Slick', {
      location: loc('table', { tableId: 't1', room: 'upstairs' }),
      activeTableId: 't1',
      liveGame: { tableId: 't1', pot: 480, board: ['Ah', 'Kd', '2c'], street: 'flop' },
    });
    await boot([mkAgent('a1', 'The Clock'), away], null, { onWatch });
    await userEvent.click(await screen.findByTestId('home-frame-a3'));
    expect(onWatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'a3' }));
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

  // SAFE-2 changed WHERE the money opens, not whether the fixture is the way
  // to it. It used to send the owner to the YOU tab — a screen change and a
  // second tap to answer "how much is in the safe"; board 29 F12 opens the
  // safe where he is standing, over the room he opened it from. The other half
  // of the rule is untouched: the fixture itself still says nothing.
  it('the safe is the way to the money and is not a number in the room', async () => {
    await boot([mkAgent('a1', 'The Clock')]);
    const safe = await screen.findByTestId('home-safe');
    expect(safe.textContent).toBe('');

    await userEvent.click(safe);
    expect(await screen.findByTestId('safe-sheet')).toBeInTheDocument();
    // Over the room, not instead of it.
    expect(document.querySelector('.home-flat')).toBeTruthy();
  });
});

// ── BUG-32 · the newborn comes in through the door ──────────────────────────

describe('BUG-32 · a birth is an arrival', () => {
  it('a newborn stands in the doorway and then walks to his chair', async () => {
    const sitting = mkAgent('a1', 'The Clock');
    const { sock } = await boot([sitting]);

    const born = mkAgent('a2', 'Fresh Meat', { newborn: true, bornAt: Date.now() });
    sock.emit({ type: 'home_state', userId: 'u1', agents: [sitting, born], game: null });

    // Beat one: he is at the door, which is a place of its own — not the
    // 'door:away' an agent at the casino gets.
    const doorway = await screen.findByRole('button', { name: /Fresh Meat/ });
    expect(doorway).toHaveAttribute('data-spot', 'door:born');

    // Beat two: he crosses the room, and the crossing is the walking class.
    await waitFor(() => {
      const el = screen.getByRole('button', { name: /Fresh Meat/ });
      expect(el).not.toHaveAttribute('data-spot', 'door:born');
      expect(el).toHaveAttribute('data-walking', 'true');
    }, { timeout: 4000 });

    // And it ends, like every other walk in this room.
    await waitFor(
      () => expect(screen.getByRole('button', { name: /Fresh Meat/ })).toHaveAttribute('data-walking', 'false'),
      { timeout: 4000 },
    );
  }, 15_000);

  it('an agent who has been here a while is not walked in again on a reconnect', async () => {
    const settled = mkAgent('a1', 'The Clock', { newborn: false, bornAt: Date.now() - 10 * 60_000 });
    await boot([settled]);
    // Not byRole(/The Clock/) any more: BUGS-A job 11 turned a thread line into
    // a button captioned with who spoke, so his name now labels two controls.
    // The body in the room is the one this rule is about.
    const body = await screen.findByLabelText('The Clock — reading');
    expect(body).not.toHaveAttribute('data-spot', 'door:born');
    expect(body).toHaveAttribute('data-walking', 'false');
  });

  it('falls back to the birth time when the server sent no marker', async () => {
    const sitting = mkAgent('a1', 'The Clock');
    const { sock } = await boot([sitting]);

    // No `newborn` field at all — an older server. The timestamp is enough.
    const born = mkAgent('a2', 'Fresh Meat', { bornAt: Date.now() - 2_000 });
    sock.emit({ type: 'home_state', userId: 'u1', agents: [sitting, born], game: null });

    expect(await screen.findByRole('button', { name: /Fresh Meat/ }))
      .toHaveAttribute('data-spot', 'door:born');
  });

  it('an agent from before BIRTH-5 has no birth time and is placed where he stands', async () => {
    const sitting = mkAgent('a1', 'The Clock');
    const { sock } = await boot([sitting]);

    const legacy = mkAgent('a2', 'The Old Man', { routine: { key: 'sleeps', label: 'asleep' } });
    sock.emit({ type: 'home_state', userId: 'u1', agents: [sitting, legacy], game: null });

    expect(await screen.findByRole('button', { name: /The Old Man/ }))
      .toHaveAttribute('data-spot', 'sleeps');
  });
});

// ── BIRTH-5 · the table, on the phone ───────────────────────────────────────
//
// DESK-2 built the TableSheet and gave it to the rail; the phone's table was
// still furniture, so an owner on a phone had no way to see what a chair costs.
// Same sheet, phone chrome — these assert the ROUTE to it, not the sheet's own
// contents (DeskHome.test.jsx already owns those).

describe('BIRTH-5 · the table, on the phone', () => {
  const SLOTS = { used: 2, cap: 4, next: { index: 3, price: 50_000, earned: 12_000, unlocked: false } };

  it('tapping the table opens it, and it says who is at it and what the next chair costs', async () => {
    fetchMock.route('/api/slots', SLOTS);
    await boot(
      [mkAgent('a1', 'The Clock'), mkAgent('a2', 'River Rat')],
      { tableId: 'home-u1', state: 'running', seats: [{ agentId: 'a1' }, { agentId: 'a2' }], handsPlayed: 3 },
    );

    await userEvent.click(await screen.findByTestId('home-table'));
    const sheet = await screen.findByTestId('home-table-sheet');
    expect(within(sheet).getByTestId('home-table-seated')).toHaveTextContent('2 at the table · 2 chairs free');
    expect(sheet).toHaveTextContent('3RD SEAT');
    expect(sheet).toHaveTextContent('50,000 won');
    // SLOTS-1 rule 1, said out loud on the one screen that names a price.
    expect(sheet).toHaveTextContent(/chips he has won/i);
  });

  it('the kitchen table still shows no money, sheet or no sheet', async () => {
    fetchMock.route('/api/slots', SLOTS);
    await boot([mkAgent('a1', 'The Clock'), mkAgent('a2', 'River Rat')]);
    await userEvent.click(await screen.findByTestId('home-table'));
    const sheet = await screen.findByTestId('home-table-sheet');
    // FIX-6 job 4: and no money words on the felt either. What is left on it is
    // who is at the table and how many chairs are free.
    expect(sheet.textContent).not.toMatch(/FOR NOTHING/);
    expect(sheet.textContent).not.toMatch(/\$/);
    expect(within(sheet).getByTestId('home-table-seated')).toHaveTextContent('at the table');
  });

  it('a locked chair offers no action at all — it states the distance', async () => {
    fetchMock.route('/api/slots', SLOTS);
    let created = 0;
    await boot([mkAgent('a1', 'The Clock')], null, { onCreateAgent: () => { created += 1; } });
    await userEvent.click(await screen.findByTestId('home-table'));
    expect(await screen.findByTestId('home-table-locked')).toHaveTextContent('38,000 to go');
    expect(screen.queryByTestId('home-table-draft')).not.toBeInTheDocument();
    expect(created).toBe(0);
  });

  // HOME-2 job 6 · AND IT SAYS IT IN BIRTH-5's WORDS.
  //
  // The two surfaces where an owner meets a locked seat are the birth screen's
  // 409 slotLocked and this sheet — which that refusal SENDS HIM TO. One
  // sentence, one function (lib/slots.js lockedSeatLine), so the price he is
  // turned away with and the price he then comes and looks at cannot be two
  // different numbers phrased two different ways.
  it('HOME-2 job 6: a locked chair says BIRTH-5 own line', async () => {
    fetchMock.route('/api/slots', SLOTS);
    await boot([mkAgent('a1', 'The Clock')]);
    await userEvent.click(await screen.findByTestId('home-table'));

    const refusal = await screen.findByTestId('home-table-refusal');
    expect(refusal).toHaveTextContent(lockedSeatLine(SLOTS.next));
    expect(refusal).toHaveTextContent('3rd seat costs 50,000 won');
    expect(refusal).toHaveTextContent('you have 12,000');
  });

  it('HOME-2 job 6: an unlocked chair has nothing to refuse', async () => {
    fetchMock.route('/api/slots', { used: 1, cap: 4, next: { index: 2, price: 10_000, earned: 26_000, unlocked: true } });
    await boot([mkAgent('a1', 'The Clock')]);
    await userEvent.click(await screen.findByTestId('home-table'));
    await screen.findByTestId('home-table-draft');
    expect(screen.queryByTestId('home-table-refusal')).toBeNull();
  });

  // ONE SHEET. Three trees wanted the table's tap — watch the game, price the
  // chair, sit down — and all three are sections of this one surface.
  it('HOME-2 job 6: the table opens ONE sheet, with every section in it', async () => {
    fetchMock.route('/api/slots', SLOTS);
    await boot(
      [mkAgent('a1', 'The Clock'), mkAgent('a2', 'River Rat')],
      { tableId: 'home-u1', state: 'running', seats: [{ agentId: 'a1' }, { agentId: 'a2' }], handsPlayed: 3 },
      { onSitTable: () => {}, onWatchTable: () => {} },
    );
    await userEvent.click(await screen.findByTestId('home-table'));

    expect(document.querySelectorAll('[data-testid="home-table-sheet"]')).toHaveLength(1);
    const sheet = await screen.findByTestId('home-table-sheet');
    expect(within(sheet).getByTestId('home-table-watch')).toBeInTheDocument();
    expect(within(sheet).getByTestId('home-table-sit')).toBeInTheDocument();
    expect(within(sheet).getByText('Create an agent')).toBeInTheDocument();
  });

  it('an unlocked chair drafts him, and the sheet gets out of the way', async () => {
    fetchMock.route('/api/slots', { used: 1, cap: 4, next: { index: 2, price: 10_000, earned: 26_000, unlocked: true } });
    let created = 0;
    await boot([mkAgent('a1', 'The Clock')], null, { onCreateAgent: () => { created += 1; } });
    await userEvent.click(await screen.findByTestId('home-table'));
    await userEvent.click(await screen.findByTestId('home-table-draft'));
    expect(created).toBe(1);
    await waitFor(() => expect(screen.queryByTestId('home-table-sheet')).not.toBeInTheDocument());
  });

  it("the shell can send the owner straight into it — BirthScreen's refusal does", async () => {
    fetchMock.route('/api/slots', SLOTS);
    await boot([mkAgent('a1', 'The Clock')], null, { openTable: true });
    expect(await screen.findByTestId('home-table-sheet')).toBeInTheDocument();
  });

  it('closes on the scrim, like every other sheet over this room', async () => {
    fetchMock.route('/api/slots', SLOTS);
    await boot([mkAgent('a1', 'The Clock')]);
    await userEvent.click(await screen.findByTestId('home-table'));
    const sheet = await screen.findByTestId('home-table-sheet-mobile');
    await userEvent.click(within(sheet).getAllByRole('button', { name: 'Close' })[0]);
    await waitFor(() => expect(screen.queryByTestId('home-table-sheet')).not.toBeInTheDocument());
  });

  it('is still a table on a deployment whose server has no seats to describe', async () => {
    fetchMock.route('/api/slots', () => ({ status: 404, body: {} }));
    await boot([mkAgent('a1', 'The Clock')]);
    await userEvent.click(await screen.findByTestId('home-table'));
    const sheet = await screen.findByTestId('home-table-sheet');
    // The felt and the count are still there — the room has a table either way.
    expect(within(sheet).getByTestId('home-table-seated')).toBeInTheDocument();
  });
});

// ── FIX-6 job 3 ─────────────────────────────────────────────────────────────

describe('FIX-6 · the room queues what it has to say', () => {
  const wanting = (id, name) => mkAgent(id, name, {
    want: { kind: 'play', text: `Put ${name} in something bigger.`, needs: 'deploy', dangerous: false },
  });

  it('one man wears one bubble, however many things he has to say', async () => {
    // A want AND an unread session: two boxes over one head, before this.
    await boot([mkAgent('a1', 'The Clock', {
      want: { kind: 'beer', text: 'Can I have a beer.', needs: null, dangerous: false },
      unseenRecap: true,
      sessionRecap: { text: 'Took it off him on the river.' },
    })]);

    const him = await waitFor(() => {
      const el = document.querySelector('.home-one[data-agent="a1"]');
      expect(el).not.toBeNull();
      return el;
    });
    expect(him.querySelectorAll('.home-bubble')).toHaveLength(1);
    // The want is the thing waiting on an answer, so the want is what he wears.
    expect(within(him).getByTestId('home-news-a1')).toHaveTextContent('Can I have a beer.');
  });

  it('at most two bubbles in the room, whoever else is talking', async () => {
    await boot([
      wanting('a1', 'Balance'),
      wanting('a2', 'Granite'),
      wanting('a3', 'Big Slick'),
      wanting('a4', 'The Clock'),
    ]);

    await waitFor(() => {
      expect(document.querySelectorAll('.home-one').length).toBe(4);
    });
    expect(document.querySelectorAll('.home-bubble').length).toBeLessThanOrEqual(2);
  });

  it('a man still waiting his turn still reads as having news', async () => {
    await boot([wanting('a1', 'Balance'), wanting('a2', 'Granite'), wanting('a3', 'Big Slick')]);

    await waitFor(() => expect(document.querySelectorAll('.home-one').length).toBe(3));
    // Whoever the queue held back, his pill is still gold — queueing a line is
    // not the same as swallowing it.
    expect(document.querySelectorAll('.home-pill--news').length).toBe(3);
  });

  it('no bubble is drawn over another bubble, or over a name pill', async () => {
    await boot([
      wanting('a1', 'Balance'),
      wanting('a2', 'Granite'),
      wanting('a3', 'Big Slick'),
      wanting('a4', 'The Clock'),
    ]);

    await waitFor(() => expect(document.querySelectorAll('.home-one').length).toBe(4));

    // jsdom has no layout, so the boxes are recomputed from the same model the
    // room places them with — the room's own coordinates, off the DOM.
    const bodies = [...document.querySelectorAll('.home-one')].map((el) => ({
      id: el.dataset.agent,
      x: parseFloat(el.style.left),
      y: parseFloat(el.style.top),
      size: el.dataset.spot?.startsWith('table:') ? 50 : 46,
      name: el.getAttribute('aria-label').split(' — ')[0],
    }));
    const boxes = [...document.querySelectorAll('.home-bubble')].map((el) => {
      const body = bodies.find((b) => b.id === el.closest('.home-one').dataset.agent);
      return bubbleRect(body, el.dataset.side);
    });
    const pills = bodies.map(pillRect);

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false);
      }
      for (const pill of pills) expect(overlaps(boxes[i], pill)).toBe(false);
    }
  });
});
