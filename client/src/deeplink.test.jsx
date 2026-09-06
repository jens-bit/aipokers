// client/src/deeplink.test.jsx — DEEPLINK-1
//
// The shell's half of it. NOTIFY has been putting `?startapp=agent_<id>` under
// every inline button since NOTIFY-1 and SHARE has been putting
// `?startapp=hand_<agentId>_<handId>` under every card; both landed on the home
// screen. These assert on where the app actually stands afterwards.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import App from './App.jsx';
import { agentsResponse, playingAgent, restingAgent } from './test/fixtures/agents.js';
import { badBeatHand, flaggedResponse } from './test/fixtures/flagged.js';
import { fetchMock, socketMock, telegram } from './test/harness.js';

describe('DEEPLINK-1 start params', () => {
  beforeEach(() => {
    telegram.signIn();
    window.location.hash = '';
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/memory', { memoryContext: '' });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', flaggedResponse);
  });

  // ── agent_<id> ───────────────────────────────────────────────────────────
  //
  // Every notification button carries this one. The message is about him, so
  // the tap has to land on him — the thread, not the roster and not the floor.

  it('agent_<id>: opens that agent\'s thread on a cold start', async () => {
    telegram.startWith(`agent_${restingAgent.id}`);
    render(<App />);

    expect(await screen.findByPlaceholderText(`Message ${restingAgent.name}…`)).toBeInTheDocument();
    const nav = document.querySelector('.tab-bar');
    expect(within(nav).getByText('CHATS').closest('button')).toHaveClass('tab-bar__tab--active');
  });

  it('agent_<id>: opens the thread when the app is ALREADY open', async () => {
    render(<App />);
    await screen.findByText('Standup');   // the floor, where a launch with no link lands

    telegram.startWith(`agent_${restingAgent.id}`);
    telegram.emit('activated');

    expect(await screen.findByPlaceholderText(`Message ${restingAgent.name}…`)).toBeInTheDocument();
  });

  it('agent_<id>: a link to an agent this owner does not have leaves him on the floor', async () => {
    telegram.startWith('agent_agent_someone_else');
    render(<App />);

    expect(await screen.findByText('Standup')).toBeInTheDocument();
    // Give the resolve a turn to finish before deciding nothing happened.
    await waitFor(() => expect(fetchMock.requestsMatching('/api/agents').length).toBeGreaterThan(0));
    expect(screen.queryByPlaceholderText(/^Message /)).not.toBeInTheDocument();
  });

  // ── hand_<agentId>_<handId> ──────────────────────────────────────────────
  //
  // The link under a shared card. The agent id has an underscore of its own,
  // which is the whole reason the parser takes the hand id off the end.

  it('hand_<agentId>_<handId>: opens that hand in the replay theatre', async () => {
    telegram.startWith(`hand_${playingAgent.id}_${badBeatHand.handNumber}`);
    render(<App />);

    expect(await screen.findByText(/Aces\. Building the pot/)).toBeInTheDocument();
    expect(screen.getByText('BAD BEAT')).toBeInTheDocument();
  });

  it('hand_<agentId>_<handId>: back from the theatre lands in his thread', async () => {
    const user = userEvent.setup();
    telegram.startWith(`hand_${playingAgent.id}_${badBeatHand.handNumber}`);
    render(<App />);
    await screen.findByText(/Aces\. Building the pot/);

    await user.click(screen.getByRole('button', { name: /back/i }));

    expect(await screen.findByPlaceholderText(`Message ${playingAgent.name}…`)).toBeInTheDocument();
  });

  it('hand_<agentId>_<handId>: a hand that has aged out still lands on the agent', async () => {
    fetchMock.route('/flagged', { flaggedHands: [] });
    telegram.startWith(`hand_${playingAgent.id}_999`);
    render(<App />);

    expect(await screen.findByPlaceholderText(`Message ${playingAgent.name}…`)).toBeInTheDocument();
  });

  // ── table_<id> ───────────────────────────────────────────────────────────

  it('table_<id>: opens the watch on that table', async () => {
    telegram.startWith(`table_${playingAgent.activeTableId}`);
    render(<App />);

    await waitFor(() => expect(socketMock.last()).toBeTruthy());
    socketMock.last().open();

    await waitFor(() => {
      const watch = socketMock.last().sent.find((m) => m.type === 'watch');
      expect(watch).toBeTruthy();
      expect(watch.tableId).toBe(playingAgent.activeTableId);
    });
  });

  it('table_<id>: carries the agent of ours who is at it, so the watch knows whose it is', async () => {
    telegram.startWith(`table_${playingAgent.activeTableId}`);
    render(<App />);

    await waitFor(() => expect(socketMock.last()).toBeTruthy());
    socketMock.last().open();

    await waitFor(() => {
      const watch = socketMock.last().sent.find((m) => m.type === 'watch');
      expect(watch?.agentId).toBe(playingAgent.id);
      expect(watch?.displayName).toBe(playingAgent.name);
    });
  });

  // ── everything else ──────────────────────────────────────────────────────

  it('a param from some other campaign is not an error — the app opens as it always does', async () => {
    telegram.startWith('promo_summer');
    render(<App />);
    expect(await screen.findByText('Standup')).toBeInTheDocument();
    expect(socketMock.last()).toBeNull();
  });

  it('no param at all opens the casino floor', async () => {
    render(<App />);
    expect(await screen.findByText('Standup')).toBeInTheDocument();
  });
});
