// client/src/App.test.jsx — TEST-1
//
// The shell: three tabs, and BirthScreen as the only way to make an agent.
// These assert on what the user sees after a click, not on component internals.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App.jsx';
import { agentsResponse } from './test/fixtures/agents.js';
import { fetchMock, telegram } from './test/harness.js';
import { brokeAgent, wallet } from './test/fixtures/wallet.js';

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
    expect(within(nav).getByText('CASINO')).toBeInTheDocument();
    expect(within(nav).getByText('CHATS')).toBeInTheDocument();
    expect(within(nav).getByText('YOU')).toBeInTheDocument();
  });

  it('opens on the casino floor', async () => {
    render(<App />);
    // The standup line is the floor's own header — it is only on CASINO.
    expect(await screen.findByText('Standup')).toBeInTheDocument();
  });

  it('switches to CHATS and back to CASINO', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Standup');

    await user.click(tab('CHATS'));
    await waitFor(() => expect(screen.queryByText('Standup')).not.toBeInTheDocument());
    // The chats list is keyed off the same agent roster.
    expect(await screen.findByText('The Grinder')).toBeInTheDocument();

    await user.click(tab('CASINO'));
    expect(await screen.findByText('Standup')).toBeInTheDocument();
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

    expect(tab('CASINO')).toHaveClass('tab-bar__tab--active');
    await user.click(tab('YOU'));
    expect(tab('YOU')).toHaveClass('tab-bar__tab--active');
    expect(tab('CASINO')).not.toHaveClass('tab-bar__tab--active');
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

    // Off the watch screen, and into CHATS with his thread open — the roster
    // is not what we land on.
    await waitFor(() => expect(document.querySelector('.watch-screen')).toBeNull());
    expect(tab('CHATS')).toHaveClass('tab-bar__tab--active');
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
