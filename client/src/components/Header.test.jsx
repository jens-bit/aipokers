// client/src/components/Header.test.jsx — BUGS-A job 2
//
// The app header's one live number: how many agents are on the floor. The rule
// under test is the same one the room obeys — never announce a count you have
// not been given.

import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { Header } from './Header.jsx';
import { fetchMock, telegram } from '../test/harness.js';

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

describe('BUGS-A job 2 · the agents-live pill', () => {
  it('says nothing at all until /api/stats has answered', async () => {
    let answer;
    fetchMock.route('/api/stats', () => new Promise((resolve) => { answer = resolve; }));
    render(<Header status="idle" hasConfig={false} />);

    expect(screen.queryByText(/agents? live/)).toBeNull();
    expect(screen.queryByText('—')).toBeNull();

    answer({ totalAgents: 12 });
    expect(await screen.findByText('12 agents live')).toBeInTheDocument();
  });

  it('zero is a real answer and is reported as one', async () => {
    fetchMock.route('/api/stats', () => ({ totalAgents: 0 }));
    render(<Header status="idle" hasConfig={false} />);
    expect(await screen.findByText('0 agents live')).toBeInTheDocument();
  });

  it('one agent is one agent, not one agents', async () => {
    fetchMock.route('/api/stats', () => ({ totalAgents: 1 }));
    render(<Header status="idle" hasConfig={false} />);
    expect(await screen.findByText('1 agent live')).toBeInTheDocument();
  });

  it('a failed request leaves the pill unsaid rather than showing a dash', async () => {
    fetchMock.route('/api/stats', () => ({ status: 500, body: {} }));
    render(<Header status="idle" hasConfig={false} />);
    await waitFor(() => expect(screen.getByText('AGENTIC POKER')).toBeInTheDocument());
    expect(screen.queryByText(/agents? live/)).toBeNull();
  });
});
