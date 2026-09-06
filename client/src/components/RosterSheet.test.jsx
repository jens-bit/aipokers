// client/src/components/RosterSheet.test.jsx — BUGS-A job 9
//
// The roster behind the avatar. It answers one question — who have I got and
// where are they — and every row is a door into his thread.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RosterSheet, whereLine, hasUnread } from './RosterSheet.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const agent = (id, name, over = {}) => ({
  id,
  name,
  mood: { state: 'neutral', heat: 40 },
  location: { where: 'home', room: null, tableId: null },
  pocket: { balance: 2400 },
  unseenRecap: false,
  want: null,
  ...over,
});

const AT_TABLE = agent('a3', 'Big Slick', {
  status: 'playing',
  location: { where: 'table', room: 'upstairs', tableId: 't1' },
  activeTableId: 't1',
  liveGame: { tableId: 't1', heroStack: 1800, pot: 480 },
});

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

describe('BUGS-A job 9 · where he is, in the room own words', () => {
  it('at a table names the room he is in', () => {
    expect(whereLine(AT_TABLE)).toBe('at a table · 25/50');
  });

  it('at the casino without a hand yet is still not "at home"', () => {
    expect(whereLine(agent('a1', 'x', { location: { where: 'casino', room: 'floor' } })))
      .toBe('at the casino · 10/20');
  });

  it('home is home', () => {
    expect(whereLine(agent('a1', 'x'))).toBe('at home');
    expect(whereLine({})).toBe('at home');
  });

  it('the dot is about YOU: something said that you have not read', () => {
    expect(hasUnread(agent('a1', 'x'))).toBe(false);
    expect(hasUnread(agent('a1', 'x', { unseenRecap: true }))).toBe(true);
    expect(hasUnread(agent('a1', 'x', { want: { text: 'can I have a beer' } }))).toBe(true);
  });
});

describe('BUGS-A job 9 · the sheet', () => {
  it('lists everybody with his whole name, where he is and his stack', async () => {
    fetchMock.route('/api/agents', { agents: [agent('a1', 'The Clock'), AT_TABLE] });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} />);

    const clock = await screen.findByRole('button', { name: /^The Clock — at home/ });
    expect(within(clock).getByText('The Clock')).toBeInTheDocument();
    expect(within(clock).getByText('at home')).toBeInTheDocument();
    expect(within(clock).getByText('$2,400')).toBeInTheDocument();

    const slick = screen.getByRole('button', { name: /^Big Slick — at a table/ });
    // At a table it is the stack he is sitting behind, not the pocket.
    expect(within(slick).getByText('$1,800')).toBeInTheDocument();
    expect(within(slick).getByText('at a table · 25/50')).toBeInTheDocument();
  });

  it('the row is the way into his thread', async () => {
    const user = userEvent.setup();
    const onOpenThread = vi.fn();
    fetchMock.route('/api/agents', { agents: [agent('a1', 'The Clock')] });
    render(<RosterSheet onOpenThread={onOpenThread} onClose={() => {}} />);

    await user.click(await screen.findByRole('button', { name: /^The Clock — / }));
    expect(onOpenThread).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }));
  });

  it('marks the ones who have said something unread, and only those', async () => {
    fetchMock.route('/api/agents', {
      agents: [agent('a1', 'The Clock'), agent('a2', 'River Rat', { unseenRecap: true })],
    });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} />);

    await screen.findByRole('button', { name: /^The Clock — / });
    expect(screen.queryByTestId('roster-unread-a1')).toBeNull();
    expect(screen.getByTestId('roster-unread-a2')).toBeInTheDocument();
  });

  it('claims no count until the roster has answered', async () => {
    let answer;
    fetchMock.route('/api/agents', () => new Promise((resolve) => { answer = resolve; }));
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} />);

    expect(screen.getByText('Reading the room…')).toBeInTheDocument();
    expect(screen.queryByText('Nobody works for you yet.')).toBeNull();

    answer({ agents: [agent('a1', 'The Clock')] });
    await screen.findByRole('button', { name: /^The Clock — / });
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('an owner with nobody is offered the one thing that fills it', async () => {
    const user = userEvent.setup();
    const onCreateAgent = vi.fn();
    fetchMock.route('/api/agents', { agents: [] });
    render(<RosterSheet onOpenThread={() => {}} onClose={() => {}} onCreateAgent={onCreateAgent} />);

    expect(await screen.findByText('Nobody works for you yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Make an agent' }));
    expect(onCreateAgent).toHaveBeenCalled();
  });

  it('closes on the scrim and on the ✕', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    fetchMock.route('/api/agents', { agents: [] });
    const { container } = render(<RosterSheet onOpenThread={() => {}} onClose={onClose} />);
    await waitFor(() => expect(container.querySelector('.roster__scrim')).not.toBeNull());

    await user.click(container.querySelector('.roster__scrim'));
    expect(onClose).toHaveBeenCalledTimes(1);
    await user.click(container.querySelector('.roster__close'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
