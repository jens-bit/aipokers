// client/src/screens/AgentProfileScreen.activity.test.jsx — BUGS-C job 9
//
// F-3's rule is unchanged: an attribute explains itself the first time it
// costs him something, in one sentence, on a tap, and after that the label
// is just a label. What changed is WHERE — it used to interrupt the
// conversation as its own card in the chat thread (ChatsScreen.jsx); the
// playtest called that unreadable, and it is a Recent activity entry on the
// profile now, newest hand first, beside the flagged-hand highlights that
// already lived there.
//
// This file replaces screens/firstCost.test.jsx, which asserted the same
// behaviour against ChatsScreen. ChatsScreen.test.jsx now asserts the
// negative (no cost line in the chat at all).

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { AgentProfileScreen } from './AgentProfileScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

// Oldest hand first — the native order agent.sessionFlagged is stored in
// (pushed as they happen), not the newest-first order the old /flagged
// endpoint answered in.
const AGENT = {
  id: 'a1',
  name: 'Hothead v1.0',
  status: 'resting',
  presence: 'resting',
  activeTableId: null,
  mood: { state: 'frustrated', cause: 'closed −$180 · first session' },
  attrs: { READS: 33, FOCUS: 38, DISCIPLINE: 31, COMPOSURE: 24, DECEPTION: 47, STAMINA: 36 },
  potential: { FOCUS: { lo: 62, hi: 88 }, DISCIPLINE: { lo: 52, hi: 74 } },
  careerStats: { hands: 140, sessions: 2, net: -180, biggestPot: 900, winRate: 41 },
  sessionLog: [],
  sessionFlagged: [
    {
      handNumber: 12,
      attrCosts: [
        { key: 'FOCUS', line: 'He misjudged equity by 7% on the river', street: 'river' },
        // A second FOCUS cost, later in the same session: not the first time.
        { key: 'FOCUS', line: 'He priced a turn call wrong', street: 'turn' },
      ],
    },
    {
      handNumber: 41,
      attrCosts: [{ key: 'DISCIPLINE', line: 'He called a river jam he had already decided to fold', street: 'river' }],
    },
  ],
};

function renderProfile(agent = AGENT, props = {}) {
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

const activity = () => screen.getByText('Recent activity').closest('div').nextElementSibling;

describe('BUGS-C job 9: the cost line is a Recent activity entry', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
    try { localStorage.clear(); } catch { /* private mode */ }
  });

  it('BUGS-C-9: puts the cost in Recent activity, in his own terms', () => {
    renderProfile();
    expect(within(activity()).getByText(/misjudged equity by 7%/)).toBeInTheDocument();
  });

  it('BUGS-C-9: says nothing until the label is tapped', () => {
    renderProfile();
    const row = within(activity());
    expect(row.queryByText(/It grows from/)).toBeNull();
    expect(row.getByText('HAND #12 · TAP THE LABEL')).toBeInTheDocument();
  });

  it('BUGS-C-9: explains the attribute in one sentence on a tap, with his own number', async () => {
    const user = userEvent.setup();
    renderProfile();
    await user.click(within(activity()).getByRole('button', { name: /what FOCUS means/i }));

    const row = within(activity());
    expect(row.getByText(/Math precision\. It grows from sheer decision volume\./)).toBeInTheDocument();
    expect(row.getByText('FIRST TIME ONLY')).toBeInTheDocument();
    expect(row.getByText(/His is 38\./)).toBeInTheDocument();
  });

  it('BUGS-C-9: one line per attribute — the first time it cost him, not every time', () => {
    renderProfile();
    expect(within(activity()).queryByText(/priced a turn call wrong/)).toBeNull();
  });

  it('BUGS-C-9: carries a line for each attribute that has cost him something, newest hand first', () => {
    renderProfile();
    const text = activity().textContent;
    expect(text).toContain('He called a river jam');
    expect(text).toContain('misjudged equity by 7%');
    // Hand #41 (DISCIPLINE) is newer than hand #12 (FOCUS).
    expect(text.indexOf('He called a river jam')).toBeLessThan(text.indexOf('misjudged equity by 7%'));
  });

  it('BUGS-C-9: after the first time, the label is just a label', async () => {
    try { localStorage.setItem('agentic_attr_explained', JSON.stringify(['FOCUS'])); } catch { /* private */ }
    renderProfile();
    const row = within(activity());
    expect(row.queryByRole('button', { name: /what FOCUS means/i })).toBeNull();
    expect(row.getByText('+FOCUS')).toBeInTheDocument();
    expect(row.getByText('HAND #12')).toBeInTheDocument();
  });

  it('BUGS-C-9: remembers across mounts that it has already explained one', async () => {
    const user = userEvent.setup();
    const { unmount } = renderProfile();
    await user.click(within(activity()).getByRole('button', { name: /what FOCUS means/i }));
    await screen.findByText(/Math precision/);
    unmount();

    renderProfile();
    expect(within(activity()).queryByRole('button', { name: /what FOCUS means/i })).toBeNull();
  });

  it('BUGS-C-9: draws no Recent activity section when nothing has cost him anything and nothing is flagged', () => {
    renderProfile({ ...AGENT, sessionFlagged: [] });
    expect(screen.queryByText('Recent activity')).toBeNull();
  });
});
