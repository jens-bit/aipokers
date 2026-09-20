import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App.jsx';
import { AgentProfileScreen } from './AgentProfileScreen.jsx';
import { fetchMock, socketMock, telegram } from '../test/harness.js';

const compact = {
  id: 'a1', name: 'The Clock', location: { where: 'home' },
  routine: { key: 'reads', label: 'reading' }, mood: { state: 'neutral', heat: 20 },
  fatigue: 'fresh', nature: 'Grinder', liveGame: null, homeTableId: null,
};
const detailed = {
  ...compact, nature: { name: 'Grinder' },
  attrs: { READS: 62, FOCUS: 41, DISCIPLINE: 53, COMPOSURE: 37, DECEPTION: 0, STAMINA: 68 },
  attrLog: [{ key: 'READS', from: 61, to: 62, cause: 'Read the river sizing.', ts: Date.now() }],
  careerStats: { hands: 123, sessions: 4, winRate: 42, biggestPot: 840, bankroll: 2000 },
  pocket: { balance: 2000 }, sessionLog: [],
};

function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

const career = () => within(screen.getByRole('region', { name: 'Career' }));
const profile = agent => <AgentProfileScreen companion agent={agent} />;
const detailsRead = id => fetchMock.requestsMatching(`/api/agents/${id}?`);

beforeEach(() => {
  telegram.signIn();
  fetchMock.route('/hands?', { recentHands: [] });
  fetchMock.route('/flagged?', { flaggedHands: [] });
  fetchMock.route('/thread?', { sessionId: 'home', lines: [], count: 0 });
});

describe('HOME-3: Profile hydrates the agent opened from Home', () => {
  it('does not request or invent a profile when no agent is selected', () => {
    const { container } = render(profile(null));
    expect(container).toBeEmptyDOMElement();
    expect(fetchMock.requests).toHaveLength(0);
  });

  it('BUG-264 / CHARACTER-MENU: Stats hydrates a compact Home agent while the character and unsent chat stay mounted', async () => {
    const roster = deferred(), chatDetail = deferred(), detail = deferred(), user = userEvent.setup();
    let profileReads = 0;
    fetchMock.route('/api/agents?', () => roster.promise);
    fetchMock.route('/api/agents/a1?', () => ++profileReads === 1 ? chatDetail.promise : detail.promise);
    render(<App />);
    await screen.findByTestId('home-screen');
    act(() => {
      const socket = socketMock.last();
      socket.open();
      socket.emit({ type: 'home_state', userId: '4242', agents: [compact], game: null });
    });
    await user.click(await screen.findByRole('button', { name: /^The Clock — / }));
    await waitFor(() => expect(detailsRead('a1')).toHaveLength(2));
    const chatRequest = fetch.mock.calls.find(([url]) => url.startsWith('/api/agents/a1?'));
    expect(chatRequest[1].signal.aborted).toBe(false);
    const stage = screen.getByTestId('agent-stage');
    await user.type(screen.getByPlaceholderText('Whisper to him…'), 'Keep this thought.');
    await user.click(screen.getByRole('tab', { name: 'Stats', exact: true }));
    await screen.findByRole('region', { name: 'Career' });
    expect(career().getAllByText('—')).toHaveLength(5);
    expect(career().queryByText('0')).toBeNull();

    // The new menu deliberately keeps Chat mounted. Stats still owns its
    // authenticated detail read; neither a late Home roster nor a lower
    // revision private read may replace its confirmed record.
    await act(async () => { roster.resolve({ agents: [detailed] }); });
    await waitFor(() => expect(detailsRead('a1')).toHaveLength(2));
    const requests = fetch.mock.calls.filter(([url]) => url.startsWith('/api/agents/a1?'));
    expect(chatRequest[1].signal.aborted).toBe(false);
    expect(requests[1][1].signal.aborted).toBe(false);
    for (const request of detailsRead('a1')) expect(request).toMatchObject({
        url: '/api/agents/a1?userId=4242',
        headers: { 'x-telegram-init-data': telegram.webApp.initData },
      });
    await act(async () => { detail.resolve({...detailed, ownerCommandRevision:1}); });
    await act(async () => { chatDetail.resolve({ ...detailed, ownerCommandRevision:0, careerStats:{hands:999} }); });
    expect(career().queryByText('999')).toBeNull();
    expect(career().getByText('123')).toBeInTheDocument();
    expect(career().getByText('42%')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'READS 62' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'DECEPTION 0' })).toBeInTheDocument();
    expect(screen.getByText('Read the river sizing.')).toBeInTheDocument();
    await user.click(screen.getByRole('tab', { name: 'Chat', exact: true }));
    expect(screen.getByPlaceholderText('Whisper to him…')).toHaveValue('Keep this thought.');
    expect(screen.getByTestId('agent-stage')).toBe(stage);
    await user.click(screen.getByRole('tab', { name: 'Stats', exact: true }));
    expect(career().getByText('123')).toBeInTheDocument();
  });

  it('CHARACTER-MENU: mounted Stats follows later owner receipts and keeps omitted private history', async () => {
    fetchMock.route('/api/agents/a1?', detailed);
    const {rerender} = render(<AgentProfileScreen embedded agent={compact}/>);
    expect(await career().findByText('123')).toBeInTheDocument();
    rerender(<AgentProfileScreen embedded agent={{...compact, ownerCommandRevision:1,
      attrs:{...detailed.attrs, READS:64}, careerStats:{...detailed.careerStats,hands:125}}}/>);
    expect(career().getByText('125')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'READS 64'})).toBeInTheDocument();
    expect(screen.getByText('Read the river sizing.')).toBeInTheDocument();
  });

  it('keeps cached stats while refreshing and replaces them with the same agent server record', async () => {
    const detail = deferred(), onOpenChat = vi.fn();
    fetchMock.route('/api/agents/a1?', () => detail.promise);
    render(<AgentProfileScreen companion agent={detailed} onOpenChat={onOpenChat} />);
    expect(career().getByText('123')).toBeInTheDocument();
    await waitFor(() => expect(detailsRead('a1')).toHaveLength(1));
    const updated = { ...detailed, careerStats: { ...detailed.careerStats, hands: 124 } };
    await act(async () => { detail.resolve({ agent: updated }); });
    expect(career().getByText('124')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to chat' }));
    expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({
      id: 'a1', attrs: detailed.attrs, careerStats: updated.careerStats,
    }));
  });

  it('preserves cached readings on failure and keeps absent readings unknown', async () => {
    const detail = deferred();
    fetchMock.route('/api/agents/a1?', () => detail.promise);
    const cached = { ...compact, careerStats: { hands: 0 } };
    render(profile(cached));
    expect(career().getAllByText('0')).toHaveLength(1);
    expect(career().getAllByText('—')).toHaveLength(4);
    await waitFor(() => expect(detailsRead('a1')).toHaveLength(1));
    await act(async () => { detail.resolve({ status: 503, body: {} }); });
    expect(career().getAllByText('0')).toHaveLength(1);
    expect(career().getAllByText('—')).toHaveLength(4);
    expect(screen.queryByRole('button', { name: 'READS 50' })).toBeNull();
  });

  it('drops the previous agent immediately and ignores its late response', async () => {
    const first = deferred(), second = deferred();
    fetchMock.route('/api/agents/a1?', () => first.promise);
    fetchMock.route('/api/agents/a2?', () => second.promise);
    const { rerender } = render(profile(detailed));
    await waitFor(() => expect(detailsRead('a1')).toHaveLength(1));
    rerender(profile({ ...compact, id: 'a2', name: 'River Rat' }));
    expect(career().queryByText('123')).toBeNull();
    await waitFor(() => expect(detailsRead('a2')).toHaveLength(1));
    await act(async () => { second.resolve({ ...detailed, id: 'a2', name: 'River Rat', careerStats: { hands: 17 }, attrLog: [] }); });
    expect(career().getByText('17')).toBeInTheDocument();
    await act(async () => { first.resolve({ ...detailed, careerStats: { hands: 999 } }); });
    expect(career().getByText('17')).toBeInTheDocument();
    expect(career().queryByText('999')).toBeNull();
    expect(screen.queryByText('Read the river sizing.')).toBeNull();
  });

  it('rejects a response naming another agent, including its attribute history', async () => {
    const detail = deferred();
    fetchMock.route('/api/agents/a1?', () => detail.promise);
    render(profile({ ...detailed, attrLog: undefined }));
    await waitFor(() => expect(detailsRead('a1')).toHaveLength(1));
    await act(async () => { detail.resolve({ ...detailed, id: 'other', name: 'Wrong agent', careerStats: { hands: 999 } }); });
    expect(career().getByText('123')).toBeInTheDocument();
    expect(career().queryByText('999')).toBeNull();
    expect(screen.queryByText('Wrong agent')).toBeNull();
    expect(screen.queryByText('Read the river sizing.')).toBeNull();
  });

  it('cancels the old request when the profile closes', async () => {
    const detail = deferred();
    fetchMock.route('/api/agents/a1?', () => detail.promise);
    const { unmount } = render(profile(compact));
    await waitFor(() => expect(detailsRead('a1')).toHaveLength(1));
    const request = fetch.mock.calls.find(([url]) => url.startsWith('/api/agents/a1?'));
    expect(request[1].signal.aborted).toBe(false);
    unmount();
    expect(request[1].signal.aborted).toBe(true);
    await act(async () => { detail.resolve(detailed); });
  });
});
