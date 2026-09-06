// The app header's "N agents live" pill.
//
// BUGS-B/6 built the server half: /api/stats answers BOTH `activeAgents` (how
// many agents are seated on the casino floor this instant) and `totalAgents`
// (how many exist at all, playing or not). The pill is the floor's number —
// a roster count would say the room is busy while every chair is empty.

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { Header } from './Header.jsx';
import { fetchMock } from '../test/harness.js';

describe('agents-live pill', () => {
  beforeEach(() => { fetchMock.reset(); });

  it('BUGS-B/7: counts the agents SEATED, not the agents that exist', async () => {
    fetchMock.route('/api/stats', { activeAgents: 3, totalAgents: 11, activeTables: 2, handsPlayedToday: 40 });
    render(<Header />);

    expect(await screen.findByText('3 agents live')).toBeInTheDocument();
    expect(screen.queryByText('11 agents live')).not.toBeInTheDocument();
  });

  it('an empty floor says so — nobody is playing is a fact, not a broken pill', async () => {
    fetchMock.route('/api/stats', { activeAgents: 0, totalAgents: 11, activeTables: 0, handsPlayedToday: 0 });
    render(<Header />);

    expect(await screen.findByText('0 agents live')).toBeInTheDocument();
  });

  it('shows a dash until the count arrives', async () => {
    fetchMock.route('/api/stats', { activeAgents: 3, totalAgents: 11 });
    render(<Header />);

    expect(screen.getByText('—')).toBeInTheDocument();
    // Let the fetch land before the test ends, so the state update happens
    // inside act() rather than after teardown.
    expect(await screen.findByText('3 agents live')).toBeInTheDocument();
  });
});
