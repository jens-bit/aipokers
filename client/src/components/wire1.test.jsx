// client/src/components/wire1.test.jsx — WIRE-1
//
// The glue five branches each left for somebody else. Every case here is a
// seam between two trees, which is exactly the kind of thing that works in
// isolation and is broken in the app.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentChat } from './AgentChat.jsx';
import { CasinoFloor } from './floor/CasinoFloor.jsx';
import { openerFor } from './desktop/useAgentThread.js';
import { ChatsScreen } from '../screens/ChatsScreen.jsx';
import { flaggedResponse, badBeatHand } from '../test/fixtures/flagged.js';
import { fetchMock, telegram } from '../test/harness.js';

const HANDS = [{ won: true }, { won: false }, { won: true }];

// MOOD-2c writes this; formatOpener() in src/agent/moment.js picks it by how
// hot he is and by the one hand he cannot let go of.
const SERVED_OPENER = 'Still buzzing. That king-nine bluff went through.';

const AGENT = {
  id: 'a1',
  name: 'Bluff Master',
  status: 'resting',
  stats: { netWon: 4120, handsPlayed: 210 },
  mood: { state: 'confident', cause: 'closed +$4,120' },
  opener: SERVED_OPENER,
  sessionRecap: { text: 'four hours, +$4,120', at: 1788609400000 },
};

// ── 1 · the thread opener ───────────────────────────────────────────────────

describe('WIRE-1/1 the opener is his, not the client\'s', () => {
  it('WIRE-1: openerFor prefers the served line', () => {
    expect(openerFor(AGENT, HANDS)).toBe(SERVED_OPENER);
  });

  it('WIRE-1: falls back to the tally only for a record written before MOOD-2c', () => {
    const legacy = { ...AGENT, opener: null };
    expect(openerFor(legacy, HANDS)).toMatch(/^Hey — I just finished 3 hands\. Won 2, lost 1\./);
  });

  it('WIRE-1: and to "ready to play" when he has not played at all', () => {
    expect(openerFor({ id: 'x' }, [])).toMatch(/^Ready to play/);
    expect(openerFor(undefined, [])).toMatch(/^Ready to play/);
  });

  it('WIRE-1: a blank served opener is not an opener', () => {
    expect(openerFor({ opener: '   ' }, HANDS)).toMatch(/^Hey — I just finished/);
  });

  it('WIRE-1: the mobile thread opens with his line', async () => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [AGENT] });
    fetchMock.route('/api/agents/a1/hands', { recentHands: HANDS });
    fetchMock.route('/api/agents/a1/flagged', { flaggedHands: [] });

    render(<ChatsScreen selectedAgent={AGENT} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />);

    expect(await screen.findByText(SERVED_OPENER)).toBeInTheDocument();
    expect(screen.queryByText(/I just finished/)).not.toBeInTheDocument();
  });

  it('WIRE-1: the legacy chat screen opens with his line too', async () => {
    telegram.signIn();
    fetchMock.route('/api/agents/a1/hands', { recentHands: HANDS });

    render(<AgentChat agent={AGENT} onBack={() => {}} onDeploy={() => {}} />);

    expect(await screen.findByText(SERVED_OPENER)).toBeInTheDocument();
    expect(screen.queryByText(/I just finished/)).not.toBeInTheDocument();
  });

  it('WIRE-1: and still offers the session review, which no longer sniffs the greeting', async () => {
    telegram.signIn();
    fetchMock.route('/api/agents/a1/hands', { recentHands: HANDS });

    render(<AgentChat agent={AGENT} onBack={() => {}} onDeploy={() => {}} />);
    await screen.findByText(SERVED_OPENER);
    // The affordance keyed off the string the client used to build; it now
    // keys off the record saying he has played.
    expect(screen.getByText(/review/i)).toBeInTheDocument();
  });
});

// ── 3 · the floor offers the newborn's first hand ───────────────────────────

describe('WIRE-1/3 floor → watch', () => {
  const newborn = {
    id: 'nb', name: 'Grinder v1.0', status: 'playing',
    activeTableId: 'tbl-1',
    liveGame: { street: 'preflop', pot: 30, board: [] },
    mood: { state: 'neutral' },
  };
  const resting = { id: 'other', name: 'Value Bot', status: 'resting', mood: { state: 'neutral' } };

  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [newborn, resting] });
  });

  it('WIRE-1: offers to watch him once he has sat down', async () => {
    const { container } = render(<CasinoFloor newbornId="nb" onWatch={() => {}} />);
    await screen.findByText(/just sat down/);
    expect(within(container.querySelector('.floor-standup')).getByText('WATCH HIM')).toBeInTheDocument();
  });

  it('WIRE-1: taking the offer opens the watch screen for him', async () => {
    const user = userEvent.setup();
    const onWatch = vi.fn();
    const { container } = render(<CasinoFloor newbornId="nb" onWatch={onWatch} />);
    await screen.findByText(/just sat down/);

    await user.click(container.querySelector('.floor-standup'));
    expect(onWatch).toHaveBeenCalledWith(expect.objectContaining({ id: 'nb' }));
  });

  it('WIRE-1: says nothing until he is actually at a table', async () => {
    fetchMock.reset();
    fetchMock.route('/api/agents', {
      agents: [{ ...newborn, status: 'resting', liveGame: null, activeTableId: null }],
    });
    const { container } = render(<CasinoFloor newbornId="nb" onWatch={() => {}} />);
    await screen.findByText(/Standup/);
    expect(container.querySelector('.floor-standup').textContent).not.toContain('WATCH HIM');
  });

  it('WIRE-1: and nothing at all when there is no newborn', async () => {
    const { container } = render(<CasinoFloor onWatch={() => {}} />);
    await screen.findByText(/Standup/);
    expect(container.querySelector('.floor-standup').textContent).not.toContain('WATCH HIM');
  });

  it('WIRE-1: the newborn takes the row from the flagged review', async () => {
    fetchMock.reset();
    fetchMock.route('/api/agents', {
      agents: [newborn, { ...resting, flaggedCount: 3 }],
    });
    const user = userEvent.setup();
    const onWatch = vi.fn();
    const { container } = render(<CasinoFloor newbornId="nb" onWatch={onWatch} />);
    await screen.findByText(/just sat down/);

    // The FLAGGED chip stands down; the row is his.
    expect(container.querySelector('.floor-standup').textContent).not.toContain('FLAGGED');
    await user.click(container.querySelector('.floor-standup'));
    expect(onWatch).toHaveBeenCalled();
  });
});

// ── 5 · the replay poster in the recap ──────────────────────────────────────

describe('WIRE-1/5 the replay poster in the thread', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [AGENT] });
    fetchMock.route('/api/agents/a1/hands', { recentHands: HANDS });
    fetchMock.route('/api/agents/a1/flagged', flaggedResponse);
  });

  const renderThread = () =>
    render(<ChatsScreen selectedAgent={AGENT} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />);

  it('WIRE-1: posters the newest flagged hand, and only that one', async () => {
    const { container } = renderThread();
    await screen.findByText(SERVED_OPENER);

    const cards = container.querySelectorAll('.replay-card');
    expect(cards).toHaveLength(1);
    expect(within(cards[0]).getByText('BAD BEAT')).toBeInTheDocument();
  });

  it('WIRE-1: tapping the poster opens the theatre', async () => {
    const user = userEvent.setup();
    const { container } = renderThread();
    await screen.findByText(SERVED_OPENER);

    await user.click(container.querySelector('.replay-card'));
    expect(container.querySelector('.replay-theatre')).toBeTruthy();
    // Watch v3's own felt, not a second one.
    expect(container.querySelector('.watch-felt')).toBeTruthy();
    expect(container.querySelector('.replay-scrub')).toBeTruthy();
  });

  it('WIRE-1: and leaving it comes back to the thread', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { container } = renderThread();
    await screen.findByText(SERVED_OPENER);

    await user.click(container.querySelector('.replay-card'));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(container.querySelector('.replay-theatre')).toBeNull();
    expect(screen.getByText(SERVED_OPENER)).toBeInTheDocument();
    // The thread's own back button is not the theatre's.
    expect(onBack).not.toHaveBeenCalled();
  });

  it('WIRE-1: no flagged hands, no poster', async () => {
    fetchMock.route('/api/agents/a1/flagged', { flaggedHands: [] });
    const { container } = renderThread();
    await screen.findByText(SERVED_OPENER);
    expect(container.querySelector('.replay-card')).toBeNull();
  });

  it('WIRE-1: one request serves both the poster and the cost lines', async () => {
    renderThread();
    await screen.findByText(SERVED_OPENER);
    expect(fetchMock.requestsMatching('/flagged')).toHaveLength(1);
  });
});
