// client/src/components/floor/CasinoFloor.test.jsx — TEST-1
//
// The floor is the product's front door, and two of the open bugs live here.
//   BUG-16 — presence lied: an agent read "playing" while its table was
//            frozen. The API now only reports presence 'playing' when a
//            liveGame exists, and the floor has to render that faithfully.
//   BUG-17 — WATCH looked like it started a new game. Watching is passive: it
//            must not POST anything.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CasinoFloor } from './CasinoFloor.jsx';
import { agentsResponse, playingAgent, restingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, telegram } from '../../test/harness.js';

// Every agent on the floor is one Occupant button, labelled "<name> — <mood>".
function occupant(name) {
  return screen.getByRole('button', { name: new RegExp(`^${name} — `) });
}
function occupants() {
  return screen.getAllByRole('button', { name: /^.+ — (confident|neutral|frustrated|tilted|sulking)$/ });
}

function renderFloor(props = {}) {
  return render(
    <CasinoFloor
      onCreateAgent={() => {}}
      onChat={() => {}}
      onWatch={() => {}}
      onProfile={() => {}}
      onDeploy={() => {}}
      {...props}
    />,
  );
}

describe('CasinoFloor roster', () => {
  beforeEach(() => { telegram.signIn(); });

  it('draws one occupant per agent in the snapshot', async () => {
    fetchMock.route('/api/agents', agentsResponse);
    renderFloor();

    await waitFor(() => expect(occupants()).toHaveLength(2));
    expect(occupant('The Grinder')).toBeInTheDocument();
    expect(occupant('Loose Cannon')).toBeInTheDocument();
  });

  it('reads the room in the standup line', async () => {
    fetchMock.route('/api/agents', agentsResponse);
    renderFloor();

    expect(await screen.findByText('1 playing · 1 resting')).toBeInTheDocument();
  });

  it('says the room is open when the owner has no agents yet', async () => {
    fetchMock.route('/api/agents', { agents: [] });
    renderFloor();

    expect(await screen.findByText('The room is open.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Draft your first agent/i })).toBeInTheDocument();
  });

  it('sends the Telegram initData header when reading the roster', async () => {
    fetchMock.route('/api/agents', agentsResponse);
    renderFloor();

    await waitFor(() => expect(fetchMock.requestsMatching('/api/agents')).not.toHaveLength(0));
    const [req] = fetchMock.requestsMatching('/api/agents');
    expect(req.headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  });
});

// BUG-16 regression. presence and liveGame move together: an agent the
// snapshot marks live is drawn live — live marker, its felt, its board.
describe('an agent the snapshot marks live is shown live (BUG-16)', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('gives the playing agent the live marker and the resting one none', async () => {
    renderFloor();
    await waitFor(() => expect(occupants()).toHaveLength(2));

    expect(occupant('The Grinder').querySelector('.floor-dot')).toBeTruthy();
    expect(occupant('Loose Cannon').querySelector('.floor-dot')).toBeNull();
  });

  it('lights a felt for the live agent and shows its pot', async () => {
    const { container } = renderFloor();
    await waitFor(() => expect(occupants()).toHaveLength(2));

    // layoutFor(1 table) — one lit felt, and the ticker carries the live pot.
    expect(container.querySelectorAll('.floor-pot')).toHaveLength(1);
    expect(screen.getByText('100')).toBeInTheDocument();
  });

  it('draws nothing live when the same agent has no liveGame', async () => {
    fetchMock.reset();
    // A stored status of "playing" is not evidence of anything — this is
    // exactly the stale flag that made the floor lie about frozen tables.
    fetchMock.route('/api/agents', {
      agents: [{ ...playingAgent, presence: 'resting', liveGame: null }, restingAgent],
    });
    const { container } = renderFloor();

    await waitFor(() => expect(occupants()).toHaveLength(2));
    // FL-2 retired "Everyone's resting." for a line that says what happened.
    // What BUG-16 pins here is unchanged: nothing on this floor reads as live.
    expect(screen.getByText(/resting ·/)).toBeInTheDocument();
    expect(occupant('The Grinder').querySelector('.floor-dot')).toBeNull();
    expect(container.querySelectorAll('.floor-pot')).toHaveLength(0);
  });
});

// BUG-17 regression. WATCH joins the hand in progress; it must never look like
// (or be) a fresh deploy. The deploy path is the one that POSTs to /queue.
describe('WATCH on a live agent opens watching and creates no game (BUG-17)', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('hands the live agent to onWatch and makes no POST at all', async () => {
    const user = userEvent.setup();
    const onWatch = vi.fn();
    const onDeploy = vi.fn();
    renderFloor({ onWatch, onDeploy });

    await waitFor(() => expect(occupants()).toHaveLength(2));
    await user.click(occupant('The Grinder'));

    await user.click(await screen.findByRole('button', { name: 'Watch the table' }));

    expect(onWatch).toHaveBeenCalledTimes(1);
    expect(onWatch.mock.calls[0][0]).toMatchObject({ id: 'agent_grinder', activeTableId: 'tbl-fixture' });
    expect(onDeploy).not.toHaveBeenCalled();

    // The whole point: nothing was created.
    expect(fetchMock.posts).toHaveLength(0);
    expect(fetchMock.requestsMatching('/queue')).toHaveLength(0);
  });

  it('offers DEPLOY, not WATCH, for an agent that is not at a table', async () => {
    const user = userEvent.setup();
    const onWatch = vi.fn();
    const onDeploy = vi.fn();
    renderFloor({ onWatch, onDeploy });

    await waitFor(() => expect(occupants()).toHaveLength(2));
    await user.click(occupant('Loose Cannon'));

    expect(await screen.findByRole('button', { name: 'Deal him in' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Watch the table' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Deal him in' }));
    expect(onDeploy).toHaveBeenCalledTimes(1);
    expect(onWatch).not.toHaveBeenCalled();
    // Deploying is CasinoFloor's caller's job; the floor itself still POSTs
    // nothing.
    expect(fetchMock.posts).toHaveLength(0);
  });
});
