// client/src/screens/ChatsScreen.test.jsx
//
// The roster and the thread. Covers the playtest fixes that live here plus the
// two invariants underneath them: the thread loads a real conversation, and it
// never grabs the keyboard on its own.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatsScreen } from './ChatsScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

// RAISE-2: the opening bubble is the agent's own line — served by the server,
// or his birth words, or this last-ditch sentence. It is only an anchor here:
// these cases are about layout and lifecycle, not about what he says.
const OPENER = /Sit down\. What do you want to know\?/;

const AGENT = {
  id: 'a1',
  name: 'Aggressive v1.3',
  status: 'resting',
  stats: { netWon: 210, handsPlayed: 140 },
  mood: { state: 'confident', cause: 'closed +$210' },
};

const noop = () => {};
const renderThread = (agent = AGENT) => render(
  <ChatsScreen selectedAgent={agent} onSelectAgent={noop} onBack={noop} onCreateAgent={noop} />,
);

describe('ChatsScreen', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents/a1/hands', { recentHands: [] });
    fetchMock.route('/api/agents', { agents: [AGENT] });
  });

  it('lists the roster from the server', async () => {
    render(<ChatsScreen onSelectAgent={noop} onBack={noop} onCreateAgent={noop} />);
    expect(await screen.findByText('Aggressive v1.3')).toBeInTheDocument();
  });

  it('opens the thread for the selected agent', async () => {
    renderThread();
    expect(await screen.findByPlaceholderText('Message Aggressive v1.3…')).toBeInTheDocument();
    expect(await screen.findByText(OPENER)).toBeInTheDocument();
  });

  // FIX-1c. Mobile playtest 2026-09-05: opening a thread threw the iOS keyboard
  // up before the owner had read a word of it, covering half the screen.
  describe('FIX-1c keyboard on entry', () => {
    it('FIX-1c: does not take focus when the thread opens', async () => {
      renderThread();
      const composer = await screen.findByPlaceholderText('Message Aggressive v1.3…');

      // Give any mount effect a chance to fire before asserting.
      await waitFor(() => expect(screen.getByText(OPENER)).toBeInTheDocument());

      expect(composer).not.toHaveFocus();
      expect(document.activeElement).toBe(document.body);
    });

    it('FIX-1c: focuses the composer when the owner taps it', async () => {
      const user = userEvent.setup();
      renderThread();
      const composer = await screen.findByPlaceholderText('Message Aggressive v1.3…');

      await user.click(composer);
      expect(composer).toHaveFocus();
    });

    it('FIX-1c: still hands focus back when the owner chooses to discuss a proposal', async () => {
      const user = userEvent.setup();
      const withProposal = {
        ...AGENT,
        proposal: {
          reasoning: 'I am folding too much from the blinds.',
          suggestedPatch: { profileDelta: { tightness: -8 } },
        },
        profile: { tightness: 62 },
      };
      renderThread(withProposal);

      const discuss = await screen.findByRole('button', { name: /discuss/i });
      await user.click(discuss);

      expect(screen.getByPlaceholderText('Message Aggressive v1.3…')).toHaveFocus();
    });
  });

  // FIX-1i. The thread's growth lines come from attrLog, which also carries
  // ATTR-3's two book-keeping causes. A 'narrowed' entry rendered as
  // "FOCUS 62 → 62" with the word `narrowed` quoted underneath as his own
  // voice — a step he did not take, in a sentence he never said.
  describe('FIX-1i growth lines skip ledger entries', () => {
    const hoursAgo = (h) => Date.now() - h * 60 * 60 * 1000;

    const withLog = (attrLog) => ({ ...AGENT, attrLog });

    // CHAT-2 retuned this one: the tick is still rendered, but the quote it
    // carries is behind a tap now. The rule the case exists for — a ledger
    // entry never becomes a line, a real tick always does — is unchanged.
    it('FIX-1i: renders a real tick, and his voice on tap', async () => {
      const user = userEvent.setup();
      const { container } = renderThread(withLog([{
        ts: hoursAgo(2), key: 'READS', from: 61, to: 62,
        cause: "I'm starting to see through Granite.",
      }]));

      const lines = await waitFor(() => {
        const found = container.querySelectorAll('.growth-line');
        expect(found).toHaveLength(1);
        return found;
      });
      expect(lines[0].querySelector('.growth-line__delta').textContent).toMatch(/READS\s*61\s*→\s*62/);

      expect(screen.queryByText(/I'm starting to see through Granite/)).toBeNull();
      await user.click(lines[0].querySelector('.growth-line__row'));
      expect(screen.getByText(/I'm starting to see through Granite/)).toBeInTheDocument();
    });

    it('FIX-1i: renders nothing for a narrowed entry', async () => {
      renderThread(withLog([{
        ts: hoursAgo(2), key: 'FOCUS', from: 62, to: 62, cause: 'narrowed',
      }]));

      await screen.findByText(OPENER);
      expect(screen.queryByText('narrowed')).not.toBeInTheDocument();
      expect(screen.queryByText(/FOCUS/)).not.toBeInTheDocument();
      // No TONIGHT TRAINED row either — nothing was trained.
      expect(screen.queryByText('TONIGHT TRAINED')).not.toBeInTheDocument();
    });

    it('FIX-1i: renders nothing for a newborn\'s birth entries', async () => {
      renderThread(withLog(
        ['READS', 'FOCUS', 'DISCIPLINE', 'COMPOSURE', 'DECEPTION', 'STAMINA']
          .map((key) => ({ ts: hoursAgo(0.2), key, from: 36, to: 36, cause: 'birth' })),
      ));

      await screen.findByText(OPENER);
      expect(screen.queryByText('birth')).not.toBeInTheDocument();
      expect(screen.queryByText('TONIGHT TRAINED')).not.toBeInTheDocument();
    });

    it('FIX-1i: shows only the tick when a session both grew and narrowed', async () => {
      const { container } = renderThread(withLog([
        { ts: hoursAgo(3), key: 'READS', from: 61, to: 62, cause: 'Third showdown against the same opponent.' },
        { ts: hoursAgo(3), key: 'READS', from: 62, to: 62, cause: 'narrowed' },
        { ts: hoursAgo(3), key: 'FOCUS', from: 54, to: 54, cause: 'narrowed' },
      ]));

      await screen.findByText('READS +1');
      expect(container.querySelectorAll('.growth-line')).toHaveLength(1);
      expect(screen.queryByText('narrowed')).not.toBeInTheDocument();
    });
  });

  // ── CHAT-2 · the header stops being a control centre ─────────────────────
  describe('CHAT-2 the thread header', () => {
    const LIVE = {
      ...AGENT,
      status: 'playing',
      presence: 'playing',
      activeTableId: 'tbl-1',
      unseenRecap: true,
      liveGame: { tableId: 'tbl-1', heroStack: 2000, heroSeat: 0, seats: [], board: [] },
    };

    it('CHAT-2: carries his stack, in mono', async () => {
      renderThread({ ...AGENT, pocket: { balance: 2000, mode: 'auto' } });
      expect(await screen.findByText('$2,000')).toBeInTheDocument();
    });

    it('CHAT-2: prefers the stack he is sitting behind while he is at a table', async () => {
      fetchMock.route('/api/agents/a1/hands', { recentHands: [] });
      renderThread({ ...LIVE, pocket: { balance: 6400, mode: 'auto' } });
      expect(await screen.findByText('$2,000')).toBeInTheDocument();
      expect(screen.queryByText('$6,400')).toBeNull();
    });

    it('CHAT-2: shows no number at all when the record has none', async () => {
      const { container } = renderThread();
      await screen.findByText(OPENER);
      expect(container.textContent).not.toMatch(/\$/);
    });

    it('CHAT-2: one mood pill, and no state tag beside it', async () => {
      const { container } = renderThread({ ...AGENT, unseenRecap: true });
      await screen.findByText(OPENER);

      const header = container.querySelector('.dr-app').children[0];
      expect(header.querySelectorAll('.floor-mood-chip')).toHaveLength(1);
      // The RECAP tag is a StateTag; the recap itself is the first message.
      expect(header.querySelector('.floor-state-tag')).toBeNull();
      expect(screen.queryByText('RECAP')).toBeNull();
    });

    it('CHAT-2: no cause line — the recap is the first message, not the chrome', async () => {
      renderThread({ ...AGENT, mood: { state: 'confident', cause: 'won a 1072-chip pot' } });
      await screen.findByText(OPENER);
      expect(screen.queryByText('won a 1072-chip pot')).toBeNull();
    });

    it('CHAT-2: DEPLOY is gone from the thread', async () => {
      renderThread();
      await screen.findByText(OPENER);
      expect(screen.queryByRole('button', { name: /deploy/i })).toBeNull();
      expect(screen.queryByRole('button', { name: /^watch$/i })).toBeNull();
    });

    it('CHAT-2: the face opens the profile', async () => {
      const user = userEvent.setup();
      const onOpenProfile = vi.fn();
      render(
        <ChatsScreen selectedAgent={AGENT} onSelectAgent={noop} onBack={noop}
          onCreateAgent={noop} onOpenProfile={onOpenProfile} />,
      );
      await user.click(await screen.findByRole('button', { name: /Open Aggressive v1.3's profile/ }));
      expect(onOpenProfile).toHaveBeenCalledWith(AGENT);
    });

    it('CHAT-2: the name opens the profile', async () => {
      const user = userEvent.setup();
      const onOpenProfile = vi.fn();
      render(
        <ChatsScreen selectedAgent={AGENT} onSelectAgent={noop} onBack={noop}
          onCreateAgent={noop} onOpenProfile={onOpenProfile} />,
      );
      await user.click(await screen.findByRole('button', { name: 'Aggressive v1.3' }));
      expect(onOpenProfile).toHaveBeenCalledWith(AGENT);
    });
  });

  it('sends a message to the chat endpoint with the Telegram header', async () => {
    const user = userEvent.setup();
    fetchMock.route('/api/agents/chat', {
      chat: [{ role: 'assistant', content: 'Understood. Tighter from the blinds.' }],
    }, { method: 'POST' });

    renderThread();
    const composer = await screen.findByPlaceholderText('Message Aggressive v1.3…');
    await user.type(composer, 'Tighten up');
    await user.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Understood. Tighter from the blinds.')).toBeInTheDocument();
    const [post] = fetchMock.requestsMatching('/api/agents/chat');
    expect(post.headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  });
});
