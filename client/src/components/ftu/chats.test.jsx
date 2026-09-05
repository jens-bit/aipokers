// client/src/components/ftu/chats.test.jsx — FTU-3
//
// Two empty states in CHATS: the roster before he has hired anyone, and his
// first recap, where nothing was worth flagging and that is the news.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ChatsScreen } from '../../screens/ChatsScreen.jsx';
import { assertNoPlaceholders } from './ftu.test.jsx';
import { flaggedResponse } from '../../test/fixtures/flagged.js';
import { fetchMock, telegram } from '../../test/harness.js';

const AGENT = {
  id: 'a1',
  name: 'Rock v1.0',
  status: 'resting',
  stats: { netWon: 18, handsPlayed: 40 },
  mood: { state: 'neutral', cause: 'first session — +$18 over 40 hands' },
  opener: 'Forty hands. I folded thirty-one of them and I am up eighteen dollars.',
  sessionRecap: { text: 'first session', at: 1788609400000 },
};

describe('FTU-3 the empty roster', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
  });

  const renderRoster = (props = {}) =>
    render(<ChatsScreen onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} {...props} />);

  it('FTU-3: a thread is a person, so what is missing is a person', async () => {
    const { container } = renderRoster();
    await screen.findByText('NOBODY TO TALK TO YET');

    const notYet = container.querySelector('.not-yet');
    expect(within(notYet).getByText(/somebody who works for you/)).toBeInTheDocument();
    expect(within(notYet).getByText(/how the night went/)).toBeInTheDocument();
  });

  it('FTU-3: no placeholder copy', async () => {
    const { container } = renderRoster();
    await screen.findByText('NOBODY TO TALK TO YET');
    assertNoPlaceholders(container);
  });

  it('FTU-3: exactly one primary action, naming the next thing', async () => {
    const user = userEvent.setup();
    const onCreateAgent = vi.fn();
    const { container } = renderRoster({ onCreateAgent });
    await screen.findByText('NOBODY TO TALK TO YET');

    const primaries = container.querySelectorAll('.ftu-primary');
    expect(primaries).toHaveLength(1);
    expect(primaries[0].textContent).toBe('Draft your first agent');

    await user.click(primaries[0]);
    expect(onCreateAgent).toHaveBeenCalledTimes(1);
  });

  it('FTU-3: and the roster is a roster again once he has one', async () => {
    fetchMock.reset();
    fetchMock.route('/api/agents', { agents: [AGENT] });
    const { container } = renderRoster();
    await screen.findByText('Rock v1.0');

    expect(container.querySelector('.not-yet')).toBeNull();
    expect(container.querySelector('.ftu-primary')).toBeNull();
  });
});

describe('FTU-3 his first recap', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [AGENT] });
    fetchMock.route('/api/agents/a1/hands', { recentHands: [{ won: true }, { won: false }] });
  });

  const renderThread = () =>
    render(<ChatsScreen selectedAgent={AGENT} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />);

  it('FTU-3: a quiet first shift is news, not a gap', async () => {
    fetchMock.route('/api/agents/a1/flagged', { flaggedHands: [] });
    const { container } = renderThread();

    await screen.findByText('NOTHING WORTH FLAGGING');
    const notYet = container.querySelector('.not-yet');
    expect(within(notYet).getByText(/No big bluffs, no bad beats/)).toBeInTheDocument();
    expect(within(notYet).getByText(/a replay you can scrub/)).toBeInTheDocument();
  });

  it('FTU-3: it opens with his own line, not a tally', async () => {
    fetchMock.route('/api/agents/a1/flagged', { flaggedHands: [] });
    renderThread();
    expect(await screen.findByText(/I folded thirty-one of them/)).toBeInTheDocument();
    expect(screen.queryByText(/I just finished/)).not.toBeInTheDocument();
  });

  it('FTU-3: no placeholder copy in the thread either', async () => {
    fetchMock.route('/api/agents/a1/flagged', { flaggedHands: [] });
    const { container } = renderThread();
    await screen.findByText('NOTHING WORTH FLAGGING');
    assertNoPlaceholders(container);
  });

  it('FTU-3: a hand worth watching replaces the note with the poster', async () => {
    fetchMock.route('/api/agents/a1/flagged', flaggedResponse);
    const { container } = renderThread();

    await screen.findByText(/I folded thirty-one of them/);
    expect(container.querySelector('.replay-card')).toBeTruthy();
    expect(screen.queryByText('NOTHING WORTH FLAGGING')).not.toBeInTheDocument();
  });

  it('FTU-3: and before he has played at all the thread says nothing about flags', async () => {
    fetchMock.route('/api/agents/a1/hands', { recentHands: [] });
    fetchMock.route('/api/agents/a1/flagged', { flaggedHands: [] });
    renderThread();

    await screen.findByText(/I folded thirty-one of them/);
    expect(screen.queryByText('NOTHING WORTH FLAGGING')).not.toBeInTheDocument();
  });
});
