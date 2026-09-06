// client/src/App.test.jsx — TEST-1
//
// The shell, and BirthScreen as the only way to make an agent. These assert on
// what the user sees after a click, not on component internals.
//
// CASINO-1 changed the nav these tests navigate BY — HOME · CASINO · YOU, with
// CHATS off the bar and its thread reached from Home and from a profile — and
// it changed where a deploy happens: the casino is the only place you deploy,
// so Home and the profile hand the agent over rather than opening a socket.
// The rules asserted below are unchanged; the routes to them are the new ones.
//
// HOME-1 then changed what HOME IS. CASINO-1 left the floor standing in on that
// tab and said so; HOME is the flat now, board 29. So `Standup` — the floor's
// own header — stopped being the "the app has mounted" anchor, and `bootedOnHome`
// is. The floor is not on a mobile tab at all any more (DesktopHome still draws
// it), so the tests that used to reach an agent through a floor ghost reach him
// through his body in the room instead. Again: same rules, new routes.
//
// HOME-2 job 1 then took the bar itself away, which is the one place in this
// file where a RULE changed rather than a route: "renders the three tabs" and
// "marks the active tab" asserted a bottom bar, and wave 53 retired it — the
// bar sat under the home composer, so the screen ended in two stacked bars with
// the composer the smaller of them. The three destinations are things in the
// world now (avatar, door, the room you are in), so the navigation assertions
// below are made through those and every screen carries its own way home.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App.jsx';
import { agentsResponse, playingAgent, restingAgent } from './test/fixtures/agents.js';
import { fetchMock, socketMock, telegram } from './test/harness.js';
import { brokeAgent, wallet } from './test/fixtures/wallet.js';
import { roomsResponse } from './test/fixtures/rooms.js';

// HOME-1: the app boots into the room. This is what `Standup` used to be.
const bootedOnHome = () => screen.findByTestId('home-screen');

// An agent's body in the room. Tapping it opens his thread — the room's own
// version of the floor zoom's Chat button.
const bodyOf = (name) => screen.findByRole('button', { name: new RegExp(`^${name} — `) });

describe('App shell', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  // HOME-2 job 1 · THERE IS NO BOTTOM BAR.
  //
  // The rule this replaces ("renders the three tabs") is the one wave 53
  // retired, and it was retired for a measured reason rather than a taste: the
  // bar sat directly under the home thread's composer, so the screen ended in
  // two stacked bars and the composer — the one thing you type into — was the
  // smaller of them. The three destinations are things in the world now: YOU is
  // the avatar top-right, CASINO is the door, HOME is where you already are.
  it('HOME-2 job 1: no bottom bar — the three destinations are in the world', async () => {
    render(<App />);
    await bootedOnHome();

    expect(document.querySelector('.tab-bar')).toBeNull();
    // ...and the two that are not "where you already are" are reachable.
    expect(screen.getByRole('button', { name: 'Your agents' })).toBeInTheDocument();
    expect(screen.getByTestId('home-door')).toBeInTheDocument();
  });

  it('opens on HOME, which is the room', async () => {
    render(<App />);
    // HOME-1: the flat, not the floor. The floor's own header is on no mobile
    // tab any more, and this asserts both halves rather than only the new one.
    expect(await bootedOnHome()).toBeInTheDocument();
    expect(screen.queryByText('Standup')).not.toBeInTheDocument();
  });

  // Same rule as the old "switches to CASINO and back to HOME", by the routes
  // wave 53 leaves: the door out, and ← HOME back.
  it('HOME-2 job 1: the door is the casino, and back from it is the room', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/rooms', roomsResponse);
    fetchMock.route('/api/events', { events: [], lastId: 0 });
    render(<App />);
    await bootedOnHome();

    await user.click(screen.getByTestId('home-door'));
    await waitFor(() => expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument());
    // The building names its rooms; the flat has none.
    expect(await screen.findByText('the back room')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back home' }));
    expect(await bootedOnHome()).toBeInTheDocument();
  });

  // CHATS left the tab bar; the thread it used to open did not go anywhere.
  it('CASINO-1: the thread is still reachable from HOME', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    // HOME-1: in the room you tap the man, not a zoom card about him.
    await user.click(await bodyOf('The Grinder'));

    expect(await screen.findByPlaceholderText('Message The Grinder…')).toBeInTheDocument();
  });

  // The old "switches to YOU". YOU is the avatar, the roster is what it opens,
  // and the money and the record sit behind it as one line.
  it('HOME-2 job 1: YOU is the avatar, with the money behind the roster', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/wallet', wallet);
    render(<App />);
    await bootedOnHome();

    await user.click(screen.getByRole('button', { name: 'Your agents' }));
    expect(await screen.findByTestId('roster-sheet')).toBeInTheDocument();

    await user.click(await screen.findByTestId('roster-ledger'));
    await waitFor(() => expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument());
    // YouScreen greets the Telegram user by name.
    expect(await screen.findByText(/Jens/)).toBeInTheDocument();
  });

  // "the money sheet behind it": the wallet line is one tap deeper than the
  // roster and it lands on YOU-2's own sheet, not on a second copy of it.
  it('HOME-2 job 1: the roster wallet line opens the money sheet', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/wallet', wallet);
    render(<App />);
    await bootedOnHome();

    await user.click(screen.getByRole('button', { name: 'Your agents' }));
    await user.click(await screen.findByTestId('roster-wallet'));

    expect(await screen.findByText('Your wallet')).toBeInTheDocument();
  });

  // The bar used to be the way back. Every screen you can reach now carries its
  // own way home, so "back from anywhere returns to the room" is a rule about
  // the screens rather than about a bar over them.
  it('HOME-2 job 1: back from YOU returns to the room', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/wallet', wallet);
    render(<App />);
    await bootedOnHome();

    await user.click(screen.getByRole('button', { name: 'Your agents' }));
    await user.click(await screen.findByTestId('roster-ledger'));
    await screen.findByText(/Jens/);

    await user.click(await screen.findByRole('button', { name: 'Back home' }));
    expect(await bootedOnHome()).toBeInTheDocument();
  });

  // KEY-1 through the real app: App calls initViewportTracking() on mount, so
  // Telegram's viewportChanged has to reach the --tg-h custom property every
  // keyboard-aware container is sized by.
  it('tracks Telegram viewport changes into --tg-h (KEY-1)', async () => {
    render(<App />);
    await bootedOnHome();

    telegram.setViewportHeight(412);
    expect(document.documentElement.style.getPropertyValue('--tg-h')).toBe('412px');

    telegram.setViewportHeight(731);
    expect(document.documentElement.style.getPropertyValue('--tg-h')).toBe('731px');
  });
});

// ── BUGS-A job 9 ────────────────────────────────────────────────────────────

describe('BUGS-A job 9 · the roster behind the avatar', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
    fetchMock.route('/thread', { sessionId: 's1', lines: [], count: 0 });
  });

  it('the top-right avatar opens it, over whatever tab is showing', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    await user.click(screen.getByRole('button', { name: 'Your agents' }));
    const sheet = await screen.findByTestId('roster-sheet');
    expect(within(sheet).getByText('The Grinder')).toBeInTheDocument();
    expect(within(sheet).getByText('Loose Cannon')).toBeInTheDocument();
    // A sheet, not a screen: the room is still behind it.
    expect(screen.getByTestId('home-screen')).toBeInTheDocument();
  });

  it('a row opens his thread, and Back goes to the tab it came down over', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    await user.click(screen.getByRole('button', { name: 'Your agents' }));
    // Scoped to the sheet: the man's body in the room behind it answers to a
    // very similar name, which is the point — one man, two places to find him.
    const sheet = await screen.findByTestId('roster-sheet');
    await user.click(within(sheet).getByRole('button', { name: /^Loose Cannon — / }));

    expect(await screen.findByPlaceholderText('Message Loose Cannon…')).toBeInTheDocument();
    expect(screen.queryByTestId('roster-sheet')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await bootedOnHome()).toBeInTheDocument();
  });
});

// ── BUGS-A job 4 ────────────────────────────────────────────────────────────

describe('BUGS-A job 4 · back out of a thread goes to the door you came in by', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
    fetchMock.route('/thread', { sessionId: 's1', lines: [], count: 0 });
  });

  it('a thread opened from the room goes back to the room', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    await user.click(await bodyOf('The Grinder'));
    expect(await screen.findByPlaceholderText('Message The Grinder…')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    expect(await bootedOnHome()).toBeInTheDocument();
  });

  it('a thread opened from a profile goes back to that profile', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    // Somebody resting: his card's primary action is Chat rather than Watch.
    await user.click(await bodyOf('Loose Cannon'));
    await user.click(await screen.findByRole('button', { name: "Open Loose Cannon's profile" }));
    // The profile's own Chat, which is the second way into the same thread.
    await user.click(await screen.findByRole('button', { name: 'Chat' }));
    expect(await screen.findByPlaceholderText('Message Loose Cannon…')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back' }));
    // The card he was reading, not the room and not a list.
    expect(await screen.findByRole('button', { name: 'More actions' })).toBeInTheDocument();
  });

  it('the CHATS list is not reachable from the tab flow at all', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    await user.click(await bodyOf('The Grinder'));
    await user.click(await screen.findByRole('button', { name: 'Back' }));
    await bootedOnHome();

    // The roster's own furniture — its header count and its draft card — is on
    // no route a tab can reach.
    expect(screen.queryByText('NOBODY TO TALK TO YET')).toBeNull();
    expect(screen.queryByRole('button', { name: /Draft your first agent/ })).toBeNull();
  });
});

// ── BUGS-A job 3 ────────────────────────────────────────────────────────────

describe('BUGS-A job 3 · retiring him lands on HOME', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
    fetchMock.route('/thread', { sessionId: 's1', lines: [], count: 0 });
  });

  it('retiring from a thread-opened profile ends in the room, not in the dead thread', async () => {
    const user = userEvent.setup();
    fetchMock.route(/\/api\/agents\/agent_cannon$/, { success: true }, { method: 'DELETE' });
    render(<App />);
    await bootedOnHome();

    // Room -> his thread -> his profile, which is how an owner actually gets
    // to Retire.
    await user.click(await bodyOf('Loose Cannon'));
    await user.click(await screen.findByRole('button', { name: "Open Loose Cannon's profile" }));
    await user.click(await screen.findByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Retire' }));
    await user.click(screen.getByRole('button', { name: 'Retire him' }));

    // The room, with the household he still has — not the thread of the man
    // who has just gone.
    expect(await bootedOnHome()).toBeInTheDocument();
    expect(screen.queryByPlaceholderText('Message Loose Cannon…')).toBeNull();
  });
});

describe('agent creation is BirthScreen and nothing else', () => {
  beforeEach(() => {
    telegram.signIn();
  });

  it('an empty room offers exactly one way in, and it is BirthScreen', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/agents', { agents: [] });
    render(<App />);

    // HOME-1: nobody lives here yet, and there is one thing to do about it.
    // (The floor's first-time stool is asserted where the floor now lives:
    // CasinoFloor.test.jsx and the desktop shell.)
    const only = await screen.findAllByRole('button', { name: /Make an agent/i });
    expect(only).toHaveLength(1);
    await user.click(only[0]);

    // BirthScreen's own composer — the creation chat.
    expect(await screen.findByPlaceholderText(/Describe how it should play/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('leaving BirthScreen returns to the room without creating anything', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/agents', { agents: [] });
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Make an agent/i }));
    await screen.findByPlaceholderText(/Describe how it should play/i);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
    expect(fetchMock.posts).toHaveLength(0);
  });
});

// WUI-4 — the one line that makes the profile's pocket action real. Without
// onFund the pocket line renders its state and no button, by design; with it
// the owner has a way from the player card to the money.
describe('the profile card can reach the funding sheet', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/wallet', wallet);
    fetchMock.route('/api/agents?', { agents: [brokeAgent] });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('renders the give-him-chips button on the profile pocket line and lands on the YOU screen', async () => {
    const user = userEvent.setup();
    render(<App />);

    // HOME-1: from his body in the room to his thread, and from the thread
    // header to his profile — the two hops CASINO-1 left in place of the zoom.
    await user.click(await screen.findByRole('button', { name: /^Value Bot — / }));
    await screen.findByPlaceholderText('Message Value Bot…');
    await user.click(screen.getByRole('button', { name: /Open Value Bot's profile/ }));

    const pocketLine = await waitFor(() => {
      const el = document.querySelector('.wal-line');
      expect(el).toBeTruthy();
      return el;
    });

    const fund = within(pocketLine).getByRole('button', { name: 'Give him chips' });
    await user.click(fund);

    // The YOU screen owns the wallet and the funding sheet. HOME-2 job 1 took
    // the bar away, so what says we arrived is the screen itself and its own
    // way back rather than a lit tab.
    expect(await screen.findByText('Your wallet')).toBeInTheDocument();
  });
});

// ── WIRE-1 · the glue ───────────────────────────────────────────────────────

describe('WIRE-1 the app shell wiring', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  // Item 2. CasinoFloor works out a birth for itself (FLOOR-2 FL-3) and walks
  // the newborn in; App used to draw a second body for the same agent on top of
  // that one. One agent, one ghost.
  it('WIRE-1: App draws no newborn overlay of its own', async () => {
    render(<App />);
    await bootedOnHome();
    // MaterializingOccupant's own line. It was App's overlay talking over the
    // floor's walk-in; the floor never says this.
    expect(screen.queryByText(/Deal me in whenever/)).not.toBeInTheDocument();

    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'App.jsx'), 'utf8');
    expect(src).not.toMatch(/MaterializingOccupant/);
  });

  // Item 4. useTable keeps the staged runout and merges it onto the view model
  // as a fallback; the container hands it over explicitly.
  it('WIRE-1: the container forwards paceFrame to the watch screen', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'App.jsx'), 'utf8');
    // Destructured off useTable...
    expect(src).toMatch(/paceFrame,/);
    // ...and handed to WatchScreen rather than left to the merge.
    //
    // W5-1: the frame now travels through the pacing queue with the snapshot it
    // belongs to, so the thing forwarded is `paced.paceFrame`. The rule this
    // test exists for is unchanged and still asserted — the container hands the
    // frame over explicitly rather than relying on useTable merging it onto the
    // view model.
    expect(src).toMatch(/paceFrame=\{paced\.paceFrame\}/);
  });

  // HOME-1 took the floor off the mobile HOME tab and the newborn walk-in went
  // with it. BIRTH-5 landed it, so this is no longer a todo.
  //
  // WHAT IT ASSERTS CHANGED, AND THE RULE DID NOT. It used to pin the FLOOR-2
  // mechanism — App holding `newlyBornAgent` and handing the id down as
  // `newbornId` — and that mechanism is not the one that shipped: the SERVER
  // marks a newborn on HOME_STATE (src/server/home.js), which is the only
  // version of this that survives a reload, works on the desk as well as the
  // phone, and cannot go out of step with the roster the room is drawn from.
  // The rule was never "App passes a prop", it was "the room is told who was
  // just born", so that is what is asserted now — through the app, not through
  // its source.
  it('BUG-32 WIRE-1: and tells the room which agent was just born', async () => {
    const newborn = {
      id: 'agent_newborn', name: 'Fresh Meat',
      nature: { name: 'Rock' }, mood: { state: 'neutral', heat: 40 },
      fatigue: 'fresh', routine: { key: 'reads', label: 'reading' },
      location: { where: 'home', tableId: null, room: null, since: Date.now() },
      newborn: true, bornAt: Date.now(),
    };
    // Served over REST as well as pushed: the room's REST backfill is the base
    // the push is re-laid over (useHomeState rule 2), so a roster that has him
    // on one and not the other is a race, not a test.
    fetchMock.route('/api/agents', { agents: [newborn] });

    render(<App />);
    await bootedOnHome();
    const sock = await waitFor(() => {
      const s = socketMock.last();
      expect(s).toBeTruthy();
      return s;
    });
    sock.open();
    sock.emit({ type: 'home_state', userId: '4242', agents: [newborn], game: null });

    // Through the door, like anyone arriving — not materialised in a chair.
    const him = await screen.findByRole('button', { name: /^Fresh Meat — / });
    expect(him).toHaveAttribute('data-spot', 'door:born');
  });
});

// ── CLEAN-1 · the leftovers ─────────────────────────────────────────────────

describe('CLEAN-1 Chat on the watch screen goes to his thread', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/memory', { memoryContext: '' });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  const watchTheGrinder = async (user) => {
    // HOME-1: the room hands him over through his thread and his profile, which
    // is where CASINO-1 put every action on an agent.
    await user.click(await screen.findByRole('button', { name: /^The Grinder — / }));
    await screen.findByPlaceholderText('Message The Grinder…');
    await user.click(screen.getByRole('button', { name: /Open The Grinder's profile/ }));
    const row = await waitFor(() => {
      const el = document.querySelector('.profile-actions');
      expect(el).toBeTruthy();
      return el;
    });
    // A live agent's row reads "Call him in"; watching him is the profile's own
    // header action, which is where CASINO-1 put it.
    expect(within(row).getByRole('button', { name: 'Call him in' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Watch' }));
    await waitFor(() => expect(document.querySelector('.watch-screen')).toBeTruthy());
  };

  // W4-5 left WatchScreen's onOpenThread optional and nobody handed it in, so
  // the button that says Chat opened a tab inside the same screen. It is the
  // same navigation the floor and the roster use: his thread, by his id.
  it('CLEAN-1: leaves the watch screen and opens the thread for that agent', async () => {
    const user = userEvent.setup();
    render(<App />);
    await watchTheGrinder(user);

    await user.click(screen.getByRole('button', { name: 'Chat' }));

    // Off the watch screen, and into his thread — the roster is not what we
    // land on. CASINO-1: a thread is a person and not a tab, and HOME-2 job 1
    // left no bar for one to be lit in; what proves we arrived is his composer,
    // over a room that is no longer on screen.
    await waitFor(() => expect(document.querySelector('.watch-screen')).toBeNull());
    expect(screen.queryByTestId('home-screen')).not.toBeInTheDocument();
    expect(await screen.findByPlaceholderText('Message The Grinder…')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getAllByText('The Grinder').length).toBeGreaterThan(0);
    expect(screen.queryByText('Loose Cannon')).not.toBeInTheDocument();
  });
});

describe('CLEAN-1 the desk shell stays around the draft (DP-4)', () => {
  const realMatchMedia = window.matchMedia;
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/wallet', wallet);
    window.matchMedia = (query) => ({
      matches: query.includes('1100'),
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    });
  });
  afterEach(() => { window.matchMedia = realMatchMedia; });

  it('CLEAN-1: drafting on desktop keeps the desk, rather than dropping to the phone flow', async () => {
    const user = userEvent.setup();
    render(<App />);

    // The desk's own chrome, before the draft.
    const topBar = await waitFor(() => {
      const el = document.querySelector('.dsk-top');
      expect(el).toBeTruthy();
      return el;
    });

    // DESK-2: the desk opens on the room, so an empty desk is an empty ROOM —
    // HOME-1's "Nobody lives here yet" and its one action, the same first step
    // the phone offers. The rule below is unchanged: wherever the draft starts,
    // it stands ON the desk.
    await user.click(await screen.findByRole('button', { name: /Make an agent/i }));

    // BirthScreen is up...
    expect(await screen.findByPlaceholderText(/Describe how it should play/i)).toBeInTheDocument();
    // ...and it is standing on the desk, not instead of it.
    expect(document.querySelector('.dsk-root')).toBeTruthy();
    expect(document.querySelector('.dsk-top')).toBe(topBar);
  });
});


// ── CHAT-2 item 4 · leaving a table puts you back where you started ─────────
//
// The watch screen's back button ran handleLeave and nothing else, so where
// the owner landed was whatever tab happened to be active — and every deploy
// path cleared the open thread on its way to the socket. The result was that
// watching one hand of an agent you were mid-conversation with cost you the
// conversation. The origin is captured when the watch begins and spent when it
// ends; an explicit destination (a tab, or "Chat") still wins over it.
describe('CHAT-2 the watch screen returns to where you came from', () => {
  // CASINO-1: Loose Cannon needs a pocket now, because the room he is dealt
  // into is picked in the casino and the buy-in has to come from somewhere.
  const cannonWithChips = {
    ...restingAgent,
    pocket: { balance: 2_500, mode: 'allowance', cap: 5_000, broke: false, collectable: 0, pnl: 0 },
  };

  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [playingAgent, cannonWithChips] });
    fetchMock.route('/api/rooms', roomsResponse);
    fetchMock.route('/api/events', { events: [], lastId: 0 });
    fetchMock.route('/api/wallet', wallet);
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
    fetchMock.route('/memory', { memoryContext: '' });
    fetchMock.route('/queue', {
      tableId: 'tbl-new', agentId: 'agent_cannon', agentName: 'Loose Cannon',
      strategy: 'Bets big, bluffs often.', memoryContext: '',
    }, { method: 'POST' });
  });

  // Open his thread from HOME. CASINO-1 took CHATS off the tab bar, so the
  // way in is the one the floor always had: his ghost, then Chat.
  async function openThread(user) {
    // HOME-1: tapping the man in the room IS opening his thread.
    await user.click(await screen.findByRole('button', { name: /^Loose Cannon — / }));
    return screen.findByPlaceholderText('Message Loose Cannon…');
  }

  // The casino tray, once an agent has been handed to it.
  async function dealHimIn(user) {
    await screen.findByText('placing Loose Cannon');
    await user.click(await screen.findByRole('button', { name: 'Deal him in' }));
    return waitFor(() => {
      const el = document.querySelector('.watch-screen');
      expect(el).toBeTruthy();
      return el;
    });
  }

  // thread -> profile -> Deploy -> casino -> Deal him in -> watch -> back
  //
  // CASINO-1 put the casino in the middle of this journey, which is the real
  // test of CHAT-2's rule: the origin is captured where the DECISION was made
  // (the thread), not where the socket was opened (the building).
  async function deployFromThread(user) {
    await openThread(user);

    // CHAT-2: the thread has no Deploy; the face opens the control centre.
    await user.click(screen.getByRole('button', { name: /Open Loose Cannon's profile/ }));
    const row = await waitFor(() => {
      const el = document.querySelector('.profile-actions');
      expect(el).toBeTruthy();
      return el;
    });
    await user.click(within(row).getByRole('button', { name: 'Deploy' }));
    return dealHimIn(user);
  }

  it('CHAT-2: back from a watch started in a thread lands in that thread', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    await deployFromThread(user);
    await user.click(screen.getByRole('button', { name: 'Leave table' }));

    expect(await screen.findByPlaceholderText('Message Loose Cannon…')).toBeInTheDocument();
  });

  it('CHAT-2: back from a watch started in the room still lands in the room', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    // From the room, through his profile, to the casino tray — CASINO-1's own
    // route, which is the one the origin has to survive.
    await user.click(await screen.findByRole('button', { name: /^Loose Cannon — / }));
    await screen.findByPlaceholderText('Message Loose Cannon…');
    await user.click(screen.getByRole('button', { name: /Open Loose Cannon's profile/ }));
    const row = await waitFor(() => {
      const el = document.querySelector('.profile-actions');
      expect(el).toBeTruthy();
      return el;
    });
    await user.click(within(row).getByRole('button', { name: 'Deploy' }));
    await dealHimIn(user);

    await user.click(screen.getByRole('button', { name: 'Leave table' }));
    // The thread he came through is where he lands; the room is behind it.
    expect(await screen.findByPlaceholderText('Message Loose Cannon…')).toBeInTheDocument();
  });

  // HOME-2 job 1: the tap that used to be a tab is Back out of the thread. The
  // rule is unchanged — a move the owner MAKES beats the origin the watch was
  // holding for him — and it now runs through the door BUGS-A job 4 gave the
  // thread, which is the only way left out of one.
  it('CHAT-2: a move the owner actually makes still wins over the origin', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    await deployFromThread(user);
    // The watch screen has no bar of any kind; leave first, then choose.
    await user.click(screen.getByRole('button', { name: 'Leave table' }));
    await screen.findByPlaceholderText('Message Loose Cannon…');
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
  });

  // The origin is spent on use and re-armed by the next watch. A one-shot that
  // never re-arms would send the second round trip to the floor.
  it('CHAT-2: it holds for the second round trip too', async () => {
    const user = userEvent.setup();
    render(<App />);
    await bootedOnHome();

    await deployFromThread(user);
    await user.click(screen.getByRole('button', { name: 'Leave table' }));
    await screen.findByPlaceholderText('Message Loose Cannon…');

    // Straight back out and in again, from the thread we just landed in.
    await user.click(screen.getByRole('button', { name: /Open Loose Cannon's profile/ }));
    const row = await waitFor(() => {
      const el = document.querySelector('.profile-actions');
      expect(el).toBeTruthy();
      return el;
    });
    await user.click(within(row).getByRole('button', { name: 'Deploy' }));
    await dealHimIn(user);

    await user.click(screen.getByRole('button', { name: 'Leave table' }));
    expect(await screen.findByPlaceholderText('Message Loose Cannon…')).toBeInTheDocument();
  });
});
