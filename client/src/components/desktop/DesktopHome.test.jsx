// client/src/components/desktop/DesktopHome.test.jsx — ATTR-2e-4
//
// DesktopHome is the desktop shell: it owns which surface the panel is showing
// and the per-agent draft map. The behaviour worth pinning is the promise
// DSK2-2 made — a half-typed message survives switching agents, because the
// panel remounts and the map does not.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { DesktopHome } from './DesktopHome.jsx';
import { agentsResponse, playingAgent, restingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, telegram } from '../../test/harness.js';

function renderHome(props = {}) {
  return render(
    <DesktopHome
      onWatchAgent={() => {}}
      onDeployAgent={() => {}}
      onCreateAgent={() => {}}
      {...props}
    />,
  );
}

// Every agent appears twice on this shell: once as a ghost on the floor, once
// as a roster row in the panel. These helpers pick the roster row, the way
// CasinoFloor.test.jsx picks occupants.
function rosterRow(name) {
  const row = screen
    .getAllByRole('button', { name: new RegExp(name) })
    .find((el) => el.classList.contains('dsk-roster-row'));
  if (!row) throw new Error(`no roster row for ${name}`);
  return row;
}

// DESK-2: the desk opens on the ROOM — the flat, as the phone's HOME tab shows
// it — so the standup is one click away rather than already up. Everything
// below that used to start from the standup starts from this instead; the rules
// they pin (the roster is complete, a row opens his thread, the draft map
// survives a switch, Escape backs out) are unchanged.
async function openStandup() {
  await userEvent.click(screen.getByRole('button', { name: /Standup/ }));
  await waitFor(() => rosterRow(playingAgent.name));
}

async function openAgent(name) {
  await openStandup();
  await userEvent.click(rosterRow(name));
}

// "Standup" is both the panel head and the top bar's pill label.
function panelHead(text) {
  return screen
    .getAllByText(text)
    .some((el) => el.classList.contains('dsk-panel-head__title'));
}

describe('DesktopHome roster', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/hands', { recentHands: [] });
  });

  it('sends the Telegram initData header when reading the roster (FLOOR-3)', async () => {
    renderHome();
    // Two things read the roster on this shell now — the desk itself, and the
    // room on its stage — so the rule is asserted of EVERY read rather than of
    // whichever one happened to be first. Header names are case-insensitive on
    // the wire and the two callers spell it differently.
    await waitFor(() => {
      const reads = fetchMock.calls.filter((c) => c.url.includes('/api/agents?'));
      expect(reads.length).toBeGreaterThan(0);
      for (const call of reads) {
        const sent = Object.entries(call.headers ?? {})
          .find(([k]) => k.toLowerCase() === 'x-telegram-init-data');
        expect(sent?.[1]).toBeTruthy();
      }
    });
  });

  // SUPERSEDED RULE, deliberately: DESK-2 makes the desk open on the room, not
  // on the standup. HOME is the flat on both platforms now (board 31 P15), and
  // the standup is Command Center furniture reached from the button that has
  // always been named after it. What is still pinned is the other half of the
  // old assertion — the desk does not open on a thread.
  it('opens on the room, with the standup one click away', async () => {
    renderHome();
    await waitFor(() => expect(screen.getByTestId('home-screen')).toBeInTheDocument());
    expect(screen.getByTestId('room-thread')).toBeInTheDocument();
    expect(screen.queryByRole('tab', { name: /player card/i })).not.toBeInTheDocument();

    await openStandup();
    expect(panelHead('Standup')).toBe(true);
  });

  it('lists every agent in the stable', async () => {
    renderHome();
    await openStandup();
    expect(rosterRow(playingAgent.name)).toBeInTheDocument();
    expect(rosterRow(restingAgent.name)).toBeInTheDocument();
  });
});

describe('DesktopHome panel', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/hands', { recentHands: [] });
  });

  it('opens that agent thread when a roster row is chosen', async () => {
    renderHome();
    await openAgent(restingAgent.name);

    await waitFor(() => {
      expect(screen.getByRole('tab', { name: /player card/i })).toBeInTheDocument();
    });
  });

  it('keeps a half-typed draft when the open agent changes', async () => {
    renderHome();
    await openAgent(restingAgent.name);

    const composer = await screen.findByRole('textbox');
    await userEvent.type(composer, 'tighten up');
    expect(composer).toHaveValue('tighten up');

    // Away to the other agent — his composer is his own, and empty.
    await userEvent.click(screen.getByRole('button', { name: /close panel/i }));
    await openAgent(playingAgent.name);
    expect(await screen.findByRole('textbox')).toHaveValue('');

    // Back again — the draft is where it was left.
    await userEvent.click(screen.getByRole('button', { name: /close panel/i }));
    await openAgent(restingAgent.name);
    await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue('tighten up'));
  });

  it('closes the panel on Escape', async () => {
    renderHome();
    await openAgent(restingAgent.name);
    await waitFor(() => expect(screen.getByRole('tab', { name: /player card/i })).toBeInTheDocument());

    await userEvent.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('tab', { name: /player card/i })).not.toBeInTheDocument();
    });
    // ...and back to the resting panel, which on the HOME stage is the room.
    expect(screen.getByTestId('room-thread')).toBeInTheDocument();
  });
});
