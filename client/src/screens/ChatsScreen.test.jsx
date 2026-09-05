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
    expect(await screen.findByText(/Ready to play/)).toBeInTheDocument();
  });

  // FIX-1c. Mobile playtest 2026-09-05: opening a thread threw the iOS keyboard
  // up before the owner had read a word of it, covering half the screen.
  describe('FIX-1c keyboard on entry', () => {
    it('FIX-1c: does not take focus when the thread opens', async () => {
      renderThread();
      const composer = await screen.findByPlaceholderText('Message Aggressive v1.3…');

      // Give any mount effect a chance to fire before asserting.
      await waitFor(() => expect(screen.getByText(/Ready to play/)).toBeInTheDocument());

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
