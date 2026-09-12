// client/src/components/desktop/WatchRail.test.jsx — ATTR-2e-4
//
// The analysis rail has one job that is easy to get wrong: it must go quiet
// with the stage between hands. A live equity readout left standing over a
// cleared table is a lie about a hand nobody is playing.
//
// It also holds rows open for reads the engine does not produce yet, rather
// than swapping in different content — the DSK2-3 placeholder pattern.

import { useState } from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { WatchRail } from './WatchRail.jsx';
import { DesktopHome } from './DesktopHome.jsx';
import { fetchMock, telegram } from '../../test/harness.js';
import { playingAgent } from '../../test/fixtures/agents.js';
import { midHandGame, betweenHandsGame } from '../../test/fixtures/game.js';

const decision = { seat: 0, equity: 0.874, action: { type: 'bet', amount: 240 }, reasoning: 'He is capped.' };

function renderRail(props = {}) {
  return render(
    <WatchRail
      agent={playingAgent}
      game={midHandGame}
      lastDecision={decision}
      heroSeat={0}
      hands={[]}
      draft=""
      onDraftChange={() => {}}
      onSend={() => {}}
      {...props}
    />,
  );
}

describe('WatchRail mid-hand', () => {
  it('names the agent and says he is at the table', () => {
    renderRail();
    expect(screen.getByText(playingAgent.name)).toBeInTheDocument();
    expect(screen.getByText('AT THE TABLE')).toBeInTheDocument();
  });

  it('reports equity as a percentage, not the raw 0..1 fraction', () => {
    renderRail();
    expect(screen.getByText('87.4%')).toBeInTheDocument();
    expect(screen.queryByText(/0\.874/)).not.toBeInTheDocument();
  });

  // WATCH-6 re-expressed: board 31 puts THE TABLE at the top of the rail, so
  // his line is now in two places on purpose — the record keeps it, and the
  // analysis panel still leads with it. Both are his voice; neither is a
  // paraphrase.
  it('carries his reasoning in his own voice', () => {
    const { container } = renderRail();
    expect(container.querySelector('.dsk-apanel__voice').textContent)
      .toContain('He is capped');
    const row = [...container.querySelectorAll('.thread-row')]
      .find((el) => el.textContent.includes('He is capped'));
    expect(row.querySelector('.thread-row__who').textContent).toBe('HIM');
  });

  it('leads with the record, per board 31', () => {
    const { container } = renderRail();
    const titles = [...container.querySelectorAll('.dsk-apanel .dsk-label')]
      .map((el) => el.textContent);
    expect(titles[0]).toBe('The table');
  });

  it('holds the unmodelled reads open with an em dash rather than hiding them', () => {
    renderRail();
    expect(screen.getByText('Fold equity')).toBeInTheDocument();
    expect(screen.getByText('Solver line')).toBeInTheDocument();
    expect(screen.getByText(/not modelled yet/i)).toBeInTheDocument();
  });
});

describe('WatchRail between hands', () => {
  it('switches the head to BETWEEN HANDS', () => {
    renderRail({ game: betweenHandsGame });
    expect(screen.getByText('BETWEEN HANDS')).toBeInTheDocument();
  });

  it('drops the live reads — there is no hand to have a read on', () => {
    renderRail({ game: betweenHandsGame });
    expect(screen.queryByText('Equity')).not.toBeInTheDocument();
    expect(screen.queryByText('Fold equity')).not.toBeInTheDocument();
  });

  it('shows the session numbers instead', () => {
    renderRail({ game: betweenHandsGame });
    expect(screen.getByText('This session')).toBeInTheDocument();
    expect(screen.getByText('Biggest pot')).toBeInTheDocument();
  });

  it('says so plainly when no hand has finished yet', () => {
    renderRail({ game: betweenHandsGame, hands: [] });
    expect(screen.getByText(/no finished hands this session yet/i)).toBeInTheDocument();
  });
});


it('BUG-105: public viewing shows only supplied table speech, without private actions',()=>{
  renderRail({readOnly:true,agent:null,lastDecision:null,stored:[{id:'public-line',kind:'table',who:'Granite',text:'Good hand.',t:1}]});
  expect(screen.getByText('Good hand.')).toBeVisible();
  expect(screen.queryByPlaceholderText('Whisper to him…')).toBeNull();
  expect(screen.queryByText('Live analysis')).toBeNull();
  expect(screen.queryByText('History')).toBeNull();
});


it('DkWatch: the owner conversation rail shows private speech and keeps table speech in Hand log',()=>{
  renderRail({conversationOnly:true, thread:[{role:'assistant',content:'I am listening.'}],
    stored:[{id:'table-line',kind:'table',who:'Granite',text:'Good hand.',t:1}]});
  expect(screen.getByText('I am listening.')).toBeVisible();
  expect(screen.queryByText('Good hand.')).toBeNull();
  expect(screen.getByPlaceholderText('Whisper to him…')).toBeVisible();
  expect(screen.queryByText('Live analysis')).toBeNull();
  expect(screen.queryByText('History')).toBeNull();
  expect(screen.queryByText('He is capped.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
  expect(screen.getByText('He is capped.')).toBeVisible();
  expect(screen.getByText('Good hand.')).toBeVisible();
});

const categorized = [
  { id: 'action', kind: 'table', who: 'TABLE', text: 'Granite bet 10.', category: 'action', t: 1 },
  { id: 'decision', kind: 'him', who: 'HIM', text: 'Stored routine reasoning.', category: 'decision', t: 2 },
  { id: 'reply', kind: 'him', who: 'HIM', text: 'Yes, I heard you.', category: 'chat', t: 3 },
  { id: 'result', kind: 'table', who: 'TABLE', text: 'Your agent won 40.', category: 'result', t: 4 },
  { id: 'session', kind: 'table', who: 'TABLE', text: 'This session ended.', category: 'session', t: 5 },
  { id: 'cost', kind: 'table', who: 'TABLE', text: 'A costly mistake.', category: 'action', cost: true, t: 6 },
  { id: 'legacy', kind: 'him', who: 'HIM', text: 'Older speech without metadata.', t: 7 },
  { id: 'future', kind: 'table', who: 'TABLE', text: 'An event this client cannot classify.', category: 'future-kind', t: 8 },
];

it('WATCH-PRIVATE: owner Chat contains only the private thread; Hand log retains every table event', () => {
  renderRail({ conversationOnly: true, stored: categorized, thread: [
    { _id: 'owner-message', role: 'user', content: 'How are you feeling?' },
    { _id: 'agent-reply', role: 'assistant', content: 'I am feeling settled.' },
  ] });
  expect(screen.getByText('Watching your agent')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Chat' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Hand log' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText('How are you feeling?')).toBeVisible();
  expect(screen.getByText('I am feeling settled.')).toBeVisible();
  for (const row of categorized) expect(screen.queryByText(row.text)).toBeNull();
  expect(screen.queryByText('He is capped.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
  for (const row of categorized) expect(screen.getByText(row.text)).toBeVisible();
  expect(screen.getByText('He is capped.')).toBeVisible();
});

it('WATCH-PRIVATE: an empty private thread never falls back to stored table conversation', () => {
  renderRail({ conversationOnly: true, thread: [], stored: categorized });
  expect(screen.getByText('No private messages yet.')).toBeVisible();
  for (const row of categorized) expect(screen.queryByText(row.text)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
  for (const row of categorized) expect(screen.getByText(row.text)).toBeVisible();
});

it('WATCH-PRIVATE: stored row IDs cannot replace private replies, and non-message entries are not agent speech', () => {
  renderRail({ conversationOnly: true, thread: [
    { _id: 'same-id', role: 'assistant', content: 'My private reply.' },
    { _id: 'proposal', role: 'proposal', content: 'A proposal is not a private reply.' },
  ], stored: [{ id: 'same-id', kind: 'opponent', who: 'Granite', text: 'A different public remark.', t: 1 }] });
  expect(screen.getByText('My private reply.')).toBeVisible();
  expect(screen.queryByText('A different public remark.')).toBeNull();
  expect(screen.queryByText('A proposal is not a private reply.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
  expect(screen.getByText('“A different public remark.”')).toBeVisible();
});

it('FIRST-WATCH-1: public Chat still keeps speech, results, costs and unknown history with actions in Hand log', () => {
  renderRail({ conversationOnly: true, readOnly: true, agent: null, stored: categorized, lastDecision: null });
  for (const row of categorized.slice(2)) expect(screen.getByText(row.text)).toBeVisible();
  expect(screen.queryByText('Granite bet 10.')).toBeNull();
  expect(screen.queryByText('Stored routine reasoning.')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
  for (const row of categorized) expect(screen.getByText(row.text)).toBeVisible();
});

it('FIRST-WATCH-1: switching views preserves the draft, submit action and incoming speech', () => {
  const send = vi.fn();
  function ControlledRail() {
    const [draft, setDraft] = useState('A message in progress');
    return <WatchRail conversationOnly agent={playingAgent} game={midHandGame} heroSeat={0}
      stored={categorized} thread={[{ _id: 'new-reply', role: 'assistant', content: 'I am listening.' }]}
      draft={draft} onDraftChange={setDraft} onSend={send} />;
  }
  render(<ControlledRail />);
  const composer = screen.getByPlaceholderText('Whisper to him…');
  fireEvent.change(composer, { target: { value: 'Take your time.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
  expect(screen.getByPlaceholderText('Whisper to him…')).toBe(composer);
  expect(composer).toHaveValue('Take your time.');
  fireEvent.click(screen.getByRole('button', { name: 'Chat' }));
  expect(screen.getByText('I am listening.')).toBeVisible();
  fireEvent.keyDown(composer, { key: 'Enter' });
  expect(send).toHaveBeenCalledTimes(1);
  expect(send).toHaveBeenCalledWith('Take your time.');
});

it('FIRST-WATCH-1: a public observer keeps unknown table speech and gets no private composer', () => {
  renderRail({ conversationOnly: true, readOnly: true, agent: null, lastDecision: null,
    stored: [{ id: 'untyped', kind: 'opponent', who: 'Granite', text: 'A real public remark.', t: 1 }] });
  expect(screen.getByText('Watching this table')).toBeVisible();
  expect(screen.getByText('“A real public remark.”')).toBeVisible();
  expect(screen.queryByPlaceholderText('Whisper to him…')).toBeNull();
});

describe('WATCH-CONTEXT: agent stats inside the existing rail', () => {
  it('keeps the same draft and composer through Stats, Back and Hand log without leaving the table', () => {
    const send = vi.fn(), leave = vi.fn();
    function ControlledRail() {
      const [draft, setDraft] = useState('Take your time.');
      return <WatchRail conversationOnly agent={playingAgent} game={midHandGame} heroSeat={0}
        thread={[{ _id: 'reply', role: 'assistant', content: 'I am listening.' }]}
        draft={draft} onDraftChange={setDraft} onSend={send} onClose={leave} />;
    }
    render(<ControlledRail />);
    const composer = screen.getByPlaceholderText('Whisper to him…');
    fireEvent.click(screen.getByRole('button', { name: 'Stats', exact: true }));
    expect(screen.getByRole('button', { name: 'Stats', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('I am listening.')).toBeNull();
    expect(screen.getByPlaceholderText('Whisper to him…')).toBe(composer);
    expect(composer).toHaveValue('Take your time.');
    fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }));
    expect(screen.getByText('I am listening.')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Chat', exact: true })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Stats', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(screen.getByRole('button', { name: 'Chat', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(leave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Hand log' }));
    expect(screen.getByPlaceholderText('Whisper to him…')).toBe(composer);
    fireEvent.keyDown(composer, { key: 'Enter' });
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith('Take your time.');
  });

  it('accepts the owned hero opening Stats and returns control to Chat without calling leave', () => {
    const changeView = vi.fn(), leave = vi.fn();
    renderRail({ conversationOnly: true, view: 'stats', onViewChange: changeView, onClose: leave });
    expect(screen.getByRole('button', { name: 'Stats', exact: true })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }));
    expect(changeView).toHaveBeenCalledTimes(1);
    expect(changeView).toHaveBeenCalledWith('chat');
    expect(leave).not.toHaveBeenCalled();
  });

  it('returns a locally selected Stats view to Chat when the watched agent changes', () => {
    const props = { conversationOnly: true, game: midHandGame, heroSeat: 0, draft: '', onDraftChange: vi.fn(), onSend: vi.fn() };
    const { rerender } = render(<WatchRail {...props} agent={playingAgent} />);
    fireEvent.click(screen.getByRole('button', { name: 'Stats', exact: true }));
    rerender(<WatchRail {...props} agent={{ ...playingAgent, id: 'another-agent', name: 'Another agent' }} />);
    expect(screen.getByRole('button', { name: 'Chat', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('button', { name: 'Back to chat' })).toBeNull();
  });

  it('never exposes owner Stats or composer to a public observer, even with a stale Stats view', () => {
    renderRail({ conversationOnly: true, readOnly: true, view: 'stats',
      stored: [{ id: 'public', kind: 'table', text: 'Public table speech.', t: 1 }] });
    expect(screen.queryByRole('button', { name: 'Stats', exact: true })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Back to chat' })).toBeNull();
    expect(screen.queryByPlaceholderText('Whisper to him…')).toBeNull();
    expect(screen.getByRole('button', { name: 'Chat', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Public table speech.')).toBeVisible();
  });

  it('reads the selected seat stack live and shows unknown while the table snapshot is unavailable', () => {
    const props = { conversationOnly: true, view: 'stats', agent: playingAgent, heroSeat: 1,
      draft: '', onDraftChange: vi.fn(), onSend: vi.fn() };
    const { rerender } = render(<WatchRail {...props} game={midHandGame} />);
    expect(screen.getByText('$980')).toBeVisible();
    expect(screen.queryByText('$940')).toBeNull();
    rerender(<WatchRail {...props} game={{ ...midHandGame,
      seats: midHandGame.seats.map((seat, index) => index === 1 ? { ...seat, stack: 0 } : seat) }} />);
    expect(screen.getByText('$0')).toBeVisible();
    rerender(<WatchRail {...props} game={null} />);
    expect(screen.getByText('Not available yet')).toBeVisible();
    expect(screen.queryByText('$980')).toBeNull();
  });

  it('opens Stats from the actual desktop hero while the same table, pending reply and draft survive', async () => {
    telegram.signIn();
    const agent = { ...playingAgent, location: { where: 'casino', tableId: midHandGame.tableId },
      chatHistory: [{ role: 'assistant', content: 'I am listening.' }] };
    fetchMock.route('/api/agents', { agents: [agent] });
    fetchMock.route('/hands', { recentHands: [] });
    let resolveChat;
    fetchMock.route('/api/agents/chat', () => new Promise(resolve => { resolveChat = resolve; }));
    const watch = vi.fn(), leave = vi.fn();
    render(<DesktopHome onWatchAgent={watch} onLeave={leave} onDeployAgent={vi.fn()} onCreateAgent={vi.fn()}
      isWatching watchingAgent={agent} game={midHandGame} mySeat={0} />);
    fireEvent.click(await screen.findByTestId(`home-frame-${agent.id}`));
    const table = await screen.findByTestId('desk-casino-table');
    const composer = await screen.findByPlaceholderText('Whisper to him…');
    expect(await screen.findByText('I am listening.')).toBeVisible();
    fireEvent.change(composer, { target: { value: 'Take your time.' } });
    fireEvent.keyDown(composer, { key: 'Enter' });
    await waitFor(() => expect(resolveChat).toBeTypeOf('function'));
    fireEvent.change(composer, { target: { value: 'A second thought.' } });
    const requestCount = fetchMock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'View your agent at the table', exact: true }));
    expect(screen.getByRole('button', { name: 'Stats', exact: true })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Stack at this table').parentElement).toHaveTextContent('$940');
    expect(screen.getByTestId('desk-casino-table')).toBe(table);
    expect(screen.getByPlaceholderText('Whisper to him…')).toBe(composer);
    expect(composer).toHaveValue('A second thought.');
    expect(fetchMock.calls).toHaveLength(requestCount);
    await act(async () => resolveChat({ chat: [{ role: 'assistant', content: 'I will stay patient.' }] }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }));
    expect(screen.getByText('I will stay patient.')).toBeVisible();
    expect(screen.getByText('Take your time.')).toBeVisible();
    expect(composer).toHaveValue('A second thought.');
    expect(screen.getByTestId('desk-casino-table')).toBe(table);
    expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(1);
    expect(watch).not.toHaveBeenCalled();
    expect(leave).not.toHaveBeenCalled();
  });
});
