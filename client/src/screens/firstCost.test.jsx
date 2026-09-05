// client/src/screens/firstCost.test.jsx — F-3
//
// Wave 34, finding 2's other half: onboarding, the only way it is allowed to
// happen. No tutorial screen, no text wall, no six-card carousel. An attribute
// explains itself the first time it costs him something, in the thread, in one
// sentence, on a tap. After the first time the label is just a label.
//
// attrCosts is the ATTR-3 contract, computed per hand by table.js and stored on
// the flagged entry — so the flagged endpoint is where a cost line can be read
// from. recentHands does not carry it.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { ChatsScreen } from './ChatsScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const AGENT = {
  id: 'a1', name: 'Hothead v1.0', status: 'resting',
  mood: { state: 'frustrated', cause: 'closed −$180 · first session' },
  attrs: { READS: 33, FOCUS: 38, DISCIPLINE: 31, COMPOSURE: 24, DECEPTION: 47, STAMINA: 36 },
  potential: { FOCUS: { lo: 62, hi: 88 }, DISCIPLINE: { lo: 52, hi: 74 } },
  attrLog: [],
};

// Newest-first, as the server stores them.
const FLAGGED = {
  flaggedHands: [
    {
      handNumber: 41,
      attrCosts: [{ key: 'DISCIPLINE', line: 'He called a river jam he had already decided to fold', street: 'river' }],
    },
    {
      handNumber: 12,
      attrCosts: [
        { key: 'FOCUS', line: 'He misjudged equity by 7% on the river', street: 'river' },
        // A second FOCUS cost, later in the same session: not the first time.
        { key: 'FOCUS', line: 'He priced a turn call wrong', street: 'turn' },
      ],
    },
  ],
  count: 2,
};

function renderThread(flagged = FLAGGED) {
  fetchMock.route('/api/agents', { agents: [AGENT] });
  fetchMock.route('/api/agents/a1/hands', { recentHands: [] });
  fetchMock.route('/flagged', flagged);
  return render(
    <ChatsScreen selectedAgent={AGENT} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />,
  );
}

describe('F-3: the first cost line explains itself', () => {
  beforeEach(() => {
    telegram.signIn();
    try { localStorage.clear(); } catch { /* private mode */ }
  });

  it('puts the cost in the thread in his own terms', async () => {
    renderThread();
    expect(await screen.findByText(/misjudged equity by 7%/)).toBeInTheDocument();
  });

  it('sends the owner header — without it the flagged rows come back stripped', async () => {
    renderThread();
    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes('/flagged'));
      expect(call?.headers['x-telegram-init-data']).toBeTruthy();
    });
  });

  it('says nothing until the label is tapped', async () => {
    renderThread();
    await screen.findByText(/misjudged equity by 7%/);

    expect(screen.queryByText(/It grows from/)).toBeNull();
    expect(screen.getByText('HAND #12 · TAP THE LABEL')).toBeInTheDocument();
  });

  it('explains the attribute in one sentence on a tap', async () => {
    renderThread();
    await screen.findByText(/misjudged equity by 7%/);
    await userEvent.click(screen.getByRole('button', { name: /what FOCUS means/i }));

    expect(await screen.findByText(/Math precision\. It grows from sheer decision volume\./)).toBeInTheDocument();
    expect(screen.getByText('FIRST TIME ONLY')).toBeInTheDocument();
  });

  it('shows his own number, not the concept', async () => {
    renderThread();
    await screen.findByText(/misjudged equity by 7%/);
    await userEvent.click(screen.getByRole('button', { name: /what FOCUS means/i }));

    expect(await screen.findByText(/His is 38\./)).toBeInTheDocument();
  });

  it('one line per attribute — the first time it cost him, not every time', async () => {
    renderThread();
    await screen.findByText(/misjudged equity by 7%/);

    expect(screen.queryByText(/priced a turn call wrong/)).toBeNull();
  });

  it('carries a line for each attribute that has cost him something', async () => {
    renderThread();
    expect(await screen.findByText(/misjudged equity by 7%/)).toBeInTheDocument();
    expect(screen.getByText(/called a river jam/)).toBeInTheDocument();
  });

  it('after the first time, the label is just a label', async () => {
    try { localStorage.setItem('agentic_attr_explained', JSON.stringify(['FOCUS'])); } catch { /* private */ }
    renderThread();
    await screen.findByText(/misjudged equity by 7%/);

    expect(screen.queryByRole('button', { name: /what FOCUS means/i })).toBeNull();
    expect(screen.getByText('FOCUS')).toBeInTheDocument();
    expect(screen.getByText('HAND #12')).toBeInTheDocument();
  });

  it('remembers across threads that it has already explained one', async () => {
    const { unmount } = renderThread();
    await screen.findByText(/misjudged equity by 7%/);
    await userEvent.click(screen.getByRole('button', { name: /what FOCUS means/i }));
    await screen.findByText(/Math precision/);
    unmount();

    renderThread();
    await screen.findByText(/misjudged equity by 7%/);
    expect(screen.queryByRole('button', { name: /what FOCUS means/i })).toBeNull();
  });

  it('draws no cost line at all when nothing has cost him anything', async () => {
    renderThread({ flaggedHands: [], count: 0 });
    await screen.findByText(/Ready to play|just finished/i);

    expect(screen.queryByText(/TAP THE LABEL/)).toBeNull();
    expect(screen.queryByText(/It grows from/)).toBeNull();
  });
});
