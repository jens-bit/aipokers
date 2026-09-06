// client/src/components/Header.test.jsx — BUGS-A job 2, BUGS-B/7
//
// The app header's one live number: how many agents are on the floor.
//
// Two rules, from two branches, and they are about different things:
//   BUGS-A job 2 — never announce a count you have not been given. No pill
//                  while the request is in the air, and none if it fails.
//   BUGS-B/7     — announce the SEATED count (`activeAgents`), not the roster
//                  (`totalAgents`). A roster count says the room is busy while
//                  every chair is empty.
// The fixtures below therefore hand over `activeAgents`: BUGS-A wrote them
// against `totalAgents`, which is the field the pill deliberately stopped
// reading, so left alone they would assert against a pill that draws nothing.

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

    answer({ activeAgents: 12, totalAgents: 30 });
    expect(await screen.findByText('12 agents live')).toBeInTheDocument();
  });

  it('zero is a real answer and is reported as one', async () => {
    fetchMock.route('/api/stats', () => ({ activeAgents: 0, totalAgents: 11 }));
    render(<Header status="idle" hasConfig={false} />);
    expect(await screen.findByText('0 agents live')).toBeInTheDocument();
  });

  it('one agent is one agent, not one agents', async () => {
    fetchMock.route('/api/stats', () => ({ activeAgents: 1, totalAgents: 9 }));
    render(<Header status="idle" hasConfig={false} />);
    expect(await screen.findByText('1 agent live')).toBeInTheDocument();
  });

  it('a failed request leaves the pill unsaid rather than showing a dash', async () => {
    fetchMock.route('/api/stats', () => ({ status: 500, body: {} }));
    render(<Header status="idle" hasConfig={false} />);
    await waitFor(() => expect(screen.getByText('AGENTIC POKER')).toBeInTheDocument());
    expect(screen.queryByText(/agents? live/)).toBeNull();
  });
  // BUGS-B/7's own case: the two numbers /api/stats answers with are different
  // questions, and the pill asks the floor's.
  it('BUGS-B/7: counts the agents SEATED, not the agents that exist', async () => {
    fetchMock.route('/api/stats', () => ({ activeAgents: 3, totalAgents: 11 }));
    render(<Header status="idle" hasConfig={false} />);

    expect(await screen.findByText('3 agents live')).toBeInTheDocument();
    expect(screen.queryByText('11 agents live')).toBeNull();
  });
});
