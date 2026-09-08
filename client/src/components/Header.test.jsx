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

import { Header, RoomHeader } from './Header.jsx';
import { fetchMock, telegram } from '../test/harness.js';

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

it('C5: the Home roster pill distinguishes unknown, nobody live and a known live agent',()=>{
  const {rerender}=render(<RoomHeader title="Home" onOpenRoster={()=>{}}/>);
  expect(screen.queryByText('NOBODY LIVE')).toBeNull();
  rerender(<RoomHeader title="Home" onOpenRoster={()=>{}} liveCount={0}/>);
  expect(screen.getByRole('button',{name:'Your agents'})).toHaveTextContent('NOBODY LIVE');
  rerender(<RoomHeader title="Home" onOpenRoster={()=>{}} liveCount={1}/>);
  expect(screen.getByRole('button',{name:'Your agents'})).toHaveTextContent('1 AGENT LIVE');
});

describe('BUGS-A job 2 · the agents-live pill', () => {
  it('BUG-57: labels the casino count and shows the Railbird identity', async () => {
    fetchMock.route('/api/stats', () => ({ activeAgents: 0, totalAgents: 15 }));
    render(<Header status="idle" hasConfig={false} />);
    expect(await screen.findByText('0 in casino')).toBeInTheDocument();
    expect(screen.getByText('RAILBIRD')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Railbird' })).toBeInTheDocument();
  });
  it('says nothing at all until /api/stats has answered', async () => {
    let answer;
    fetchMock.route('/api/stats', () => new Promise((resolve) => { answer = resolve; }));
    render(<Header status="idle" hasConfig={false} />);

    expect(screen.queryByText(/in casino/)).toBeNull();
    expect(screen.queryByText('—')).toBeNull();

    answer({ activeAgents: 12, totalAgents: 30 });
    expect(await screen.findByText('12 in casino')).toBeInTheDocument();
  });

  it('zero is a real answer and is reported as one', async () => {
    fetchMock.route('/api/stats', () => ({ activeAgents: 0, totalAgents: 11 }));
    render(<Header status="idle" hasConfig={false} />);
    expect(await screen.findByText('0 in casino')).toBeInTheDocument();
  });

  it('one casino seat is reported as one', async () => {
    fetchMock.route('/api/stats', () => ({ activeAgents: 1, totalAgents: 9 }));
    render(<Header status="idle" hasConfig={false} />);
    expect(await screen.findByText('1 in casino')).toBeInTheDocument();
  });

  it('a failed request leaves the pill unsaid rather than showing a dash', async () => {
    fetchMock.route('/api/stats', () => ({ status: 500, body: {} }));
    render(<Header status="idle" hasConfig={false} />);
    await waitFor(() => expect(screen.getByText('RAILBIRD')).toBeInTheDocument());
    expect(screen.queryByText(/in casino/)).toBeNull();
  });
  // BUGS-B/7's own case: the two numbers /api/stats answers with are different
  // questions, and the pill asks the floor's.
  it('BUGS-B/7: counts the agents SEATED, not the agents that exist', async () => {
    fetchMock.route('/api/stats', () => ({ activeAgents: 3, totalAgents: 11 }));
    render(<Header status="idle" hasConfig={false} />);

    expect(await screen.findByText('3 in casino')).toBeInTheDocument();
    expect(screen.queryByText('11 in casino')).toBeNull();
  });
});
