// client/src/screens/AgentProfileScreen.notify.test.jsx — DEEPLINK-1
//
// The per-agent mute. It lives behind the same overflow as Retire because it
// is a preference rather than an action on him, and it is per agent because
// that is what the notifier reads: notify.js checks `notifyMuted` off the
// agent record before it builds or stores anything, so silencing one must not
// cost his stablemates the budget they share.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AgentProfileScreen } from './AgentProfileScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const AGENT = {
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

const noop = () => {};

function renderProfile(agent = AGENT) {
  return render(
    <AgentProfileScreen
      agent={agent}
      onBack={noop} onOpenChat={noop} onWatch={noop}
      onFund={noop} onDeploy={noop} onCallIn={noop} onRetired={noop}
    />,
  );
}

const openMenu = async (user) => user.click(screen.getByRole('button', { name: 'More actions' }));

describe('DEEPLINK-1 the per-agent notifications mute', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/notify', ({ body }) => ({ agentId: 'a1', muted: !!body.muted }), { method: 'POST' });
  });

  it('is not in the way — it lives behind the overflow, next to Retire', async () => {
    const user = userEvent.setup();
    renderProfile();
    expect(screen.queryByRole('button', { name: /mute notifications/i })).not.toBeInTheDocument();

    await openMenu(user);
    expect(screen.getByRole('button', { name: 'Mute notifications' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retire' })).toBeInTheDocument();
  });

  it('POSTs the mute to the route the notifier reads', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Mute notifications' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/notify').length).toBe(1));
    const [post] = fetchMock.requestsMatching('/notify');
    expect(post.method).toBe('POST');
    expect(post.url).toContain('/api/agents/a1/notify');
    expect(post.body.muted).toBe(true);
  });

  it('reads back as unmuteable once it is muted', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Mute notifications' }));

    await openMenu(user);
    expect(await screen.findByRole('button', { name: 'Unmute notifications' })).toBeInTheDocument();
  });

  it('opens as muted for an agent the record already has silenced', async () => {
    const user = userEvent.setup();
    renderProfile({ ...AGENT, notifyMuted: true });
    await openMenu(user);
    expect(screen.getByRole('button', { name: 'Unmute notifications' })).toBeInTheDocument();
  });

  it('unmutes him again, and says so to the server', async () => {
    const user = userEvent.setup();
    renderProfile({ ...AGENT, notifyMuted: true });
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Unmute notifications' }));

    await waitFor(() => expect(fetchMock.requestsMatching('/notify')[0]?.body.muted).toBe(false));
    await openMenu(user);
    expect(await screen.findByRole('button', { name: 'Mute notifications' })).toBeInTheDocument();
  });

  // An optimistic toggle that keeps its optimism after a refusal is a toggle
  // that lies about what the notifier will do.
  it('puts the menu back when the server refuses', async () => {
    fetchMock.route('/notify', () => ({ status: 403, body: {} }), { method: 'POST' });
    const user = userEvent.setup();
    renderProfile();
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Mute notifications' }));

    await openMenu(user);
    expect(await screen.findByRole('button', { name: 'Mute notifications' })).toBeInTheDocument();
  });

  it('closes the overflow on the tap, like every other item in it', async () => {
    const user = userEvent.setup();
    renderProfile();
    await openMenu(user);
    await user.click(screen.getByRole('button', { name: 'Mute notifications' }));

    await waitFor(() => expect(screen.queryByRole('button', { name: 'Retire' })).not.toBeInTheDocument());
  });
});
