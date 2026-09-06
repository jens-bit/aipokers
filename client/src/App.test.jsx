// client/src/App.test.jsx — TEST-1
//
// The shell: three tabs, and BirthScreen as the only way to make an agent.
// These assert on what the user sees after a click, not on component internals.
//
// CASINO-1 changed the nav these tests navigate BY — HOME · CASINO · YOU, with
// CHATS off the bar and its thread reached from Home and from a profile — and
// it changed where a deploy happens: the casino is the only place you deploy,
// so Home and the profile hand the agent over rather than opening a socket.
// The rules asserted below are unchanged; the routes to them are the new ones.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App.jsx';
import { agentsResponse, playingAgent, restingAgent } from './test/fixtures/agents.js';
import { fetchMock, telegram } from './test/harness.js';
import { brokeAgent, wallet } from './test/fixtures/wallet.js';
import { roomsResponse } from './test/fixtures/rooms.js';

function tab(name) {
  return screen.getByRole('button', { name });
}

describe('App shell', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('renders the three tabs', async () => {
    render(<App />);
    await screen.findByText('Standup');
    const nav = document.querySelector('.tab-bar');
    expect(within(nav).getByText('HOME')).toBeInTheDocument();
    expect(within(nav).getByText('CASINO')).toBeInTheDocument();
    expect(within(nav).getByText('YOU')).toBeInTheDocument();
    // CASINO-1: the thread is not a place you go, it is a person you open.
    expect(within(nav).queryByText('CHATS')).not.toBeInTheDocument();
  });

  it('opens on HOME, which is the floor', async () => {
    render(<App />);
    // The standup line is the floor's own header — it is only on HOME.
    expect(await screen.findByText('Standup')).toBeInTheDocument();
  });

  it('switches to CASINO and back to HOME', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/rooms', roomsResponse);
    fetchMock.route('/api/events', { events: [], lastId: 0 });
    render(<App />);
    await screen.findByText('Standup');

    await user.click(tab('CASINO'));
    await waitFor(() => expect(screen.queryByText('Standup')).not.toBeInTheDocument());
    // The building names its rooms; the floor never did.
    expect(await screen.findByText('the back room')).toBeInTheDocument();

    await user.click(tab('HOME'));
    expect(await screen.findByText('Standup')).toBeInTheDocument();
  });

  // CHATS left the tab bar; the thread it used to open did not go anywhere.
  it('CASINO-1: the thread is still reachable from HOME', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Standup');

    await user.click(await screen.findByRole('button', { name: /^The Grinder — / }));
    const zoom = await waitFor(() => {
      const el = document.querySelector('.floor-zoom');
      expect(el).toBeTruthy();
      return el;
    });
    await user.click(within(zoom).getByRole('button', { name: 'Chat' }));

    expect(await screen.findByPlaceholderText('Message The Grinder…')).toBeInTheDocument();
  });

  it('switches to YOU', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Standup');

    await user.click(tab('YOU'));
    await waitFor(() => expect(screen.queryByText('Standup')).not.toBeInTheDocument());
    // YouScreen greets the Telegram user by name.
    expect(await screen.findByText(/Jens/)).toBeInTheDocument();
  });

  it('marks the active tab so the user can tell where they are', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Standup');

    expect(tab('HOME')).toHaveClass('tab-bar__tab--active');
    await user.click(tab('YOU'));
    expect(tab('YOU')).toHaveClass('tab-bar__tab--active');
    expect(tab('HOME')).not.toHaveClass('tab-bar__tab--active');
  });

  // KEY-1 through the real app: App calls initViewportTracking() on mount, so
  // Telegram's viewportChanged has to reach the --tg-h custom property every
  // keyboard-aware container is sized by.
  it('tracks Telegram viewport changes into --tg-h (KEY-1)', async () => {
    render(<App />);
    await screen.findByText('Standup');

    telegram.setViewportHeight(412);
    expect(document.documentElement.style.getPropertyValue('--tg-h')).toBe('412px');

    telegram.setViewportHeight(731);
    expect(document.documentElement.style.getPropertyValue('--tg-h')).toBe('731px');
  });
});

describe('agent creation is BirthScreen and nothing else', () => {
  beforeEach(() => {
    telegram.signIn();
  });

  it('the empty floor offers exactly one way in, and it is BirthScreen', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/agents', { agents: [] });
    render(<App />);

    // The first-time stool is the only create affordance on an empty floor.
    const stool = await screen.findByRole('button', { name: /Draft your first agent/i });
    await user.click(stool);

    // BirthScreen's own composer — the creation chat.
    expect(await screen.findByPlaceholderText(/Describe how it should play/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
  });

  it('leaving BirthScreen returns to the floor without creating anything', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/agents', { agents: [] });
    render(<App />);

    await user.click(await screen.findByRole('button', { name: /Draft your first agent/i }));
    await screen.findByPlaceholderText(/Describe how it should play/i);

    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(await screen.findByText('Standup')).toBeInTheDocument();
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

    // Open the agent's profile from the floor zoom.
    await user.click(await screen.findByRole('button', { name: /^Value Bot — / }));
    const zoom = await waitFor(() => {
      const el = document.querySelector('.floor-zoom');
      expect(el).toBeTruthy();
      return el;
    });
    await user.click(within(zoom).getByRole('button', { name: 'Profile' }));

    const pocketLine = await waitFor(() => {
      const el = document.querySelector('.wal-line');
      expect(el).toBeTruthy();
      return el;
    });

    const fund = within(pocketLine).getByRole('button', { name: 'Give him chips' });
    await user.click(fund);

    // The YOU screen owns the wallet and the funding sheet.
    expect(await screen.findByText('Your wallet')).toBeInTheDocument();
    expect(tab('YOU')).toHaveClass('tab-bar__tab--active');
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
    await screen.findByText('Standup');
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

  it('WIRE-1: and tells the floor which agent was just born', () => {
    const src = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'App.jsx'), 'utf8');
    expect(src).toMatch(/newbornId=\{newlyBornAgent\?\.id \?\? null\}/);
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
    await user.click(await screen.findByRole('button', { name: /^The Grinder — / }));
    const zoom = await waitFor(() => {
      const el = document.querySelector('.floor-zoom');
      expect(el).toBeTruthy();
      return el;
    });
    await user.click(within(zoom).getByRole('button', { name: 'Watch the table' }));
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
    // land on. CASINO-1: no tab is lit, because a thread is a person and not a
    // tab; what proves we arrived is his composer.
    await waitFor(() => expect(document.querySelector('.watch-screen')).toBeNull());
    expect(tab('HOME')).not.toHaveClass('tab-bar__tab--active');
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

    await user.click(await screen.findByRole('button', { name: /Draft an agent/i }));

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
    await user.click(await screen.findByRole('button', { name: /^Loose Cannon — / }));
    const zoom = await waitFor(() => {
      const el = document.querySelector('.floor-zoom');
      expect(el).toBeTruthy();
      return el;
    });
    await user.click(within(zoom).getByRole('button', { name: 'Chat' }));
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
    await screen.findByText('Standup');

    await deployFromThread(user);
    await user.click(screen.getByRole('button', { name: 'Leave table' }));

    expect(await screen.findByPlaceholderText('Message Loose Cannon…')).toBeInTheDocument();
    expect(screen.queryByText('Standup')).not.toBeInTheDocument();
  });

  it('CHAT-2: back from a watch started on the floor still lands on the floor', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Standup');

    // The floor zoom hands him to the casino; the casino deals him in.
    await user.click(await screen.findByRole('button', { name: /^Loose Cannon — / }));
    const zoom = await waitFor(() => {
      const el = document.querySelector('.floor-zoom');
      expect(el).toBeTruthy();
      return el;
    });
    await user.click(within(zoom).getByRole('button', { name: 'Deal him in' }));
    await dealHimIn(user);

    await user.click(screen.getByRole('button', { name: 'Leave table' }));
    expect(await screen.findByText('Standup')).toBeInTheDocument();
  });

  it('CHAT-2: a tab the owner actually taps still wins over the origin', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Standup');

    await deployFromThread(user);
    // The watch screen has no tab bar; leave first, then choose.
    await user.click(screen.getByRole('button', { name: 'Leave table' }));
    await screen.findByPlaceholderText('Message Loose Cannon…');
    await user.click(tab('HOME'));

    expect(await screen.findByText('Standup')).toBeInTheDocument();
  });

  // The origin is spent on use and re-armed by the next watch. A one-shot that
  // never re-arms would send the second round trip to the floor.
  it('CHAT-2: it holds for the second round trip too', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Standup');

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
