// client/src/screens/AgentProfileScreen.actions.test.jsx — CHAT-2 item 3
//
// The profile is the control centre now. The CHATS thread stopped carrying
// DEPLOY (see ChatsScreen.test.jsx), so everything an owner does TO an agent
// has to be here, has to be reachable without scrolling, and — for the one
// action that cannot be undone — has to ask first.
//
// Three slots, and which primary shows is the whole point: Deploy and "Call
// him in" are opposites and only one of them is ever true.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentProfileScreen } from './AgentProfileScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const RESTING = {
  id: 'a1',
  name: 'Aggressive v1.3',
  status: 'idle',
  presence: 'resting',
  activeTableId: null,
  stats: { handsPlayed: 140, netWon: 210 },
  mood: { state: 'confident', cause: 'closed +$210' },
  sessionLog: [],
  careerStats: { hands: 140, sessions: 2, net: 210, biggestPot: 900, winRate: 52 },
};

const LIVE = {
  ...RESTING,
  status: 'playing',
  presence: 'playing',
  activeTableId: 'tbl-1',
  liveGame: { tableId: 'tbl-1', heroSeat: 0, heroStack: 2000, seats: [], board: [] },
};

function renderProfile(agent = RESTING, props = {}) {
  return render(
    <AgentProfileScreen
      agent={agent}
      onBack={() => {}}
      onOpenChat={() => {}}
      onWatch={() => {}}
      onFund={() => {}}
      onDeploy={() => {}}
      onCallIn={() => {}}
      onRetired={() => {}}
      {...props}
    />,
  );
}

const actionRow = () => document.querySelector('.profile-actions');

describe('CHAT-2 — the profile action row', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('offers Deploy while he is resting', () => {
    renderProfile();
    const row = within(actionRow());
    expect(row.getByRole('button', { name: 'Deploy' })).toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Call him in' })).toBeNull();
  });

  it('offers Call him in while he is at a table — never both', () => {
    renderProfile(LIVE);
    const row = within(actionRow());
    expect(row.getByRole('button', { name: 'Call him in' })).toBeInTheDocument();
    expect(row.queryByRole('button', { name: 'Deploy' })).toBeNull();
  });

  it('always offers the money, whichever of the two applies', () => {
    renderProfile();
    expect(within(actionRow()).getByRole('button', { name: 'Give him chips' })).toBeInTheDocument();
    renderProfile(LIVE);
    for (const row of document.querySelectorAll('.profile-actions')) {
      expect(within(row).getByRole('button', { name: 'Give him chips' })).toBeInTheDocument();
    }
  });

  it('does not scroll away with the card', () => {
    const { container } = renderProfile();
    // The row is a sibling of the scrolling body, not a child of it.
    const scroller = [...container.querySelectorAll('div')]
      .find((el) => el.style.overflowY === 'auto');
    expect(scroller).toBeTruthy();
    expect(scroller.contains(actionRow())).toBe(false);
  });

  it('hands Deploy back to the container with the agent', async () => {
    const user = userEvent.setup();
    const onDeploy = vi.fn();
    renderProfile(RESTING, { onDeploy });
    await user.click(within(actionRow()).getByRole('button', { name: 'Deploy' }));
    expect(onDeploy).toHaveBeenCalledWith(RESTING);
  });

  it('hands Call him in back to the container with the agent', async () => {
    const user = userEvent.setup();
    const onCallIn = vi.fn();
    renderProfile(LIVE, { onCallIn });
    await user.click(within(actionRow()).getByRole('button', { name: 'Call him in' }));
    expect(onCallIn).toHaveBeenCalledWith(LIVE);
  });

  it('hands Give him chips to the funding sheet', async () => {
    const user = userEvent.setup();
    const onFund = vi.fn();
    renderProfile(RESTING, { onFund });
    await user.click(within(actionRow()).getByRole('button', { name: 'Give him chips' }));
    expect(onFund).toHaveBeenCalled();
  });
});

// Retiring is behind an overflow because it is not a neighbour of Deploy: a
// thumb reaching for "deal him in" must never be one pixel from ending him.
describe('CHAT-2 — Retire', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('is not on the row itself — it lives in the overflow', async () => {
    const user = userEvent.setup();
    renderProfile();
    expect(screen.queryByRole('button', { name: 'Retire' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    expect(screen.getByRole('button', { name: 'Retire' })).toBeInTheDocument();
  });

  it('puts the overflow away on a tap outside it', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Close menu' }));
    expect(screen.queryByRole('button', { name: 'Retire' })).toBeNull();
  });

  it('asks first, and says what actually happens to him', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Retire' }));

    const sheet = screen.getByRole('dialog', { name: 'Retire Aggressive v1.3' });
    expect(within(sheet).getByText(
      'He finishes the hand, his chips come home, his record is kept.',
    )).toBeInTheDocument();
    expect(within(sheet).getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('touches no endpoint until the owner confirms', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Retire' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(fetchMock.requests.filter((r) => r.method === 'DELETE')).toHaveLength(0);
  });

  it('DELETEs the agent on confirm, with the Telegram header', async () => {
    const user = userEvent.setup();
    const onRetired = vi.fn();
    fetchMock.route('/api/agents/a1', { success: true }, { method: 'DELETE' });
    renderProfile(RESTING, { onRetired });

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Retire' }));
    await user.click(screen.getByRole('button', { name: 'Retire him' }));

    await waitFor(() => expect(onRetired).toHaveBeenCalledWith(RESTING));
    const [req] = fetchMock.requests.filter((r) => r.method === 'DELETE');
    expect(req.url).toContain('/api/agents/a1');
    expect(req.headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  });

  it('keeps him, and says so, when the server refuses', async () => {
    const user = userEvent.setup();
    const onRetired = vi.fn();
    fetchMock.route('/api/agents/a1', { status: 500, body: { error: 'nope' } }, { method: 'DELETE' });
    renderProfile(RESTING, { onRetired });

    await user.click(screen.getByRole('button', { name: 'More actions' }));
    await user.click(screen.getByRole('button', { name: 'Retire' }));
    await user.click(screen.getByRole('button', { name: 'Retire him' }));

    expect(await screen.findByText('Could not retire him. Try again.')).toBeInTheDocument();
    expect(onRetired).not.toHaveBeenCalled();
    // The sheet stays open — the owner's decision has not been carried out.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
