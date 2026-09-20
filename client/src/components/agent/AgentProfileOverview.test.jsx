import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { AgentProfileOverview, profileRecent, profileSession } from './AgentProfileOverview.jsx';
import { fetchMock, telegram } from '../../test/harness.js';

const agent = { id:'c4', name:'Balanced v2.1', mood:{state:'confident',heat:22}, fatigue:'worn', nature:{name:'Rock'}, pocket:{balance:1200}, attrs:{READS:62}, bornAt:Date.UTC(2026,7,4), sessionLog:[] };
beforeEach(() => { telegram.signIn(); });
it('CHARACTER-MENU: embedded Stats keeps real readings without replacing the character or adding a second chat', () => {
  const { container } = render(<AgentProfileOverview embedded agent={{...agent, attrs:{READS:62, STAMINA:0, COMPOSURE:35}}} attrLog={[]}
    actions={<button>Old profile action</button>} career={<span>42 career hands</span>}/>);
  expect(screen.getByRole('region', {name: `${agent.name}'s stats`})).toBeInTheDocument();
  expect(screen.getByRole('region', {name:'Skills'})).toHaveTextContent('62');
  expect(screen.getByRole('region', {name:'Career'})).toHaveTextContent('42 career hands');
  expect(container.querySelector('.profile-overview__resource')).toHaveTextContent('STAMINA0');
  expect(container.querySelector('.profile-overview__composure')).toHaveTextContent('35');
  expect(container.querySelector('.profile-overview__identity svg')).toBeNull();
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name:'Back'})).not.toBeInTheDocument();
  expect(screen.queryByRole('button', {name:'Old profile action'})).not.toBeInTheDocument();
});
it('BUG-162: Home practice results do not replace real casino history on Profile', () => {
  const home = {...agent,homeTableId:'kitchen',liveGame:{tableId:'kitchen',net:75,heroSessionHands:80}};
  expect(profileSession(home)).toBeNull();
  expect(profileSession({...home,sessionLog:[{net:-820,hands:42}]})).toMatchObject({label:'LAST SESSION',net:-820,hands:42});
});
it('C4 names him once, shows actual condition and keeps the composer', () => {
  render(<AgentProfileOverview agent={agent} attrLog={[]}/>);
  expect(screen.getAllByText(agent.name)).toHaveLength(1);
  expect(screen.getByText('Condition')).toBeInTheDocument();
  expect(screen.getByText('worn', { selector:'.fatigue-line__word' })).toBeInTheDocument();
  expect(screen.getByText('Nothing recorded yet. It comes with play.')).toBeInTheDocument();
  expect(screen.getByRole('textbox',{name:'Whisper to him'})).toBeInTheDocument();
  expect(screen.queryByText('TONIGHT')).toBeNull();
});
it('C4 uses actual signed changes, excludes birth and never marks a cost as growth', () => {
  const now = Date.now();
  const log = [ {key:'READS',from:61,to:62,cause:'Watched his river sizing.',ts:now}, {key:'FOCUS',from:50,to:50,cause:'birth',ts:now}, {key:'COMPOSURE',from:40,to:39,cause:'Rust.',ts:now-1000} ];
  const rows = profileRecent({...agent,sessionFlagged:[{handNumber:7,attrCosts:[{key:'FOCUS',line:'I counted it wrong.'}]}]},log,now);
  expect(rows.map(r=>r.label)).toEqual(['+READS','−COMPOSURE','FOCUS']);
  render(<AgentProfileOverview agent={agent} attrLog={log}/>);
  expect(screen.getByText('Watched his river sizing.')).toBeInTheDocument();
});
it('C4 keeps current session, last session and absent results distinct', () => {
  expect(profileSession(agent)).toBeNull();
  expect(profileSession({...agent,sessionLog:[{net:-820,hands:42}]})).toMatchObject({label:'LAST SESSION',net:-820,hands:42});
  expect(profileSession({...agent,liveGame:{tableId:'t',net:0,heroSessionHands:3},sessionLog:[{net:500,hands:42}]})).toMatchObject({label:'THIS SESSION',net:0,hands:3});
});
it('C4 sends an authenticated whisper and offers the actual reply in the conversation', async () => {
  const user = userEvent.setup(), onOpenChat = vi.fn();
  fetchMock.route('/api/agents/chat',{chat:[{role:'assistant',content:'I saw him fold that river.'}],mood:{state:'neutral',heat:12}});
  render(<AgentProfileOverview agent={agent} attrLog={[]} onOpenChat={onOpenChat}/>);
  await user.type(screen.getByRole('textbox'), 'How was that hand?');
  await user.click(screen.getByRole('button',{name:'Send whisper'}));
  expect(await screen.findByText('I saw him fold that river.')).toBeInTheDocument();
  const request = fetchMock.calls.find(c=>String(c.url).includes('/api/agents/chat'));
  expect(request.body).toMatchObject({content:'How was that hand?',existingAgentId:agent.id});
  expect(request.headers['x-telegram-init-data']).toBeTruthy();
  await user.click(screen.getByRole('button',{name:'Open conversation'}));
  expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({id:agent.id,chatHistory:[{role:'user',content:'How was that hand?'},{role:'assistant',content:'I saw him fold that river.'}],mood:{state:'neutral',heat:12}}));
  await user.click(screen.getByRole('button',{name:'Back to chat'}));
  expect(onOpenChat).toHaveBeenLastCalledWith(expect.objectContaining({id:agent.id,chatHistory:[{role:'user',content:'How was that hand?'},{role:'assistant',content:'I saw him fold that river.'}],mood:{state:'neutral',heat:12}}));
});
it('C4 restores a refused whisper for retry', async () => {
  const user = userEvent.setup();
  fetchMock.route('/api/agents/chat',{status:503,body:{}});
  render(<AgentProfileOverview agent={agent} attrLog={[]}/>);
  await user.type(screen.getByRole('textbox'), 'Keep going.');
  await user.click(screen.getByRole('button',{name:'Send whisper'}));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Could not send'));
  expect(screen.getByRole('textbox')).toHaveValue('Keep going.');
});

it.each([{}, { chat: [] }, { chat: [{ role: 'assistant', content: '   ' }] }, { chat: [{ role: 'assistant', content: 12 }] }])('FIRST-CHAT-1: a malformed profile reply preserves the draft and saved history (%j)', async response => {
  const onOpenChat = vi.fn();
  const history = [{ role: 'assistant', content: 'An earlier answer.' }];
  fetchMock.route('/api/agents/chat', response);
  render(<AgentProfileOverview agent={{ ...agent, chatHistory: history }} attrLog={[]} onOpenChat={onOpenChat}/>);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: 'Keep going.' } });
  fireEvent.submit(input.closest('form'));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not send your whisper. Please try again.');
  expect(input).toHaveValue('Keep going.');
  fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }));
  expect(onOpenChat.mock.lastCall[0].chatHistory).toEqual(history);

  fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: 'I cannot answer that right now.' }], replyUnavailable: true });
  fireEvent.submit(input.closest('form'));
  expect(await screen.findByText('I cannot answer that right now.')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(input).toHaveValue('');
  fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }));
  expect(onOpenChat.mock.lastCall[0].chatHistory).toEqual([...history, { role: 'user', content: 'Keep going.' }, { role: 'assistant', content: 'I cannot answer that right now.' }]);
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(2);
});

it('FIRST-CHAT-1: a late profile reply cannot replace another agent conversation or draft', async () => {
  let release;
  fetchMock.route('/api/agents/chat', () => new Promise(resolve => { release = resolve; }));
  const onOpenChat = vi.fn();
  const { rerender } = render(<AgentProfileOverview agent={agent} attrLog={[]} onOpenChat={onOpenChat}/>);
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Old question.' } });
  fireEvent.submit(screen.getByRole('textbox').closest('form'));
  const next = { ...agent, id: 'next-profile', chatHistory: [{ role: 'assistant', content: 'New conversation.' }] };
  rerender(<AgentProfileOverview agent={next} attrLog={[]} onOpenChat={onOpenChat}/>);
  expect(screen.getByRole('textbox')).toBeEnabled();
  fireEvent.change(screen.getByRole('textbox'), { target: { value: 'New draft.' } });
  await act(async () => { release({ chat: [{ role: 'assistant', content: 'Old answer.' }] }); });
  expect(screen.getByRole('textbox')).toHaveValue('New draft.');
  expect(screen.queryByText('Old answer.')).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Back to chat' }));
  expect(onOpenChat.mock.lastCall[0].chatHistory).toEqual(next.chatHistory);
});

it('BUG-143: returning to Chat preserves prior messages and both sides of repeated profile whispers', async () => {
  const user=userEvent.setup(), onOpenChat=vi.fn();
  const history=[{role:'assistant',content:'I remember that table.'},{role:'user',content:'Read his river.'},{role:'assistant',content:'He bets too big.'}];
  fetchMock.route('/api/agents/chat',{chat:[{role:'assistant',content:'I will wait for value.'}]});
  render(<AgentProfileOverview agent={{...agent,chatHistory:history}} attrLog={[]} onOpenChat={onOpenChat}/>);
  await user.type(screen.getByRole('textbox'), 'Take your time.');
  await user.click(screen.getByRole('button',{name:'Send whisper'}));
  await screen.findByText('I will wait for value.');
  await user.click(screen.getByRole('button',{name:'Back to chat'}));
  expect(onOpenChat.mock.lastCall[0].chatHistory).toEqual([...history,{role:'user',content:'Take your time.'},{role:'assistant',content:'I will wait for value.'}]);
  await user.type(screen.getByRole('textbox'), 'Good.');
  await user.click(screen.getByRole('button',{name:'Send whisper'}));
  await waitFor(()=>expect(screen.getByRole('textbox')).toBeEnabled());
  await user.click(screen.getByRole('button',{name:'Open conversation'}));
  expect(onOpenChat.mock.lastCall[0].chatHistory).toEqual([...history,
    {role:'user',content:'Take your time.'},{role:'assistant',content:'I will wait for value.'},
    {role:'user',content:'Good.'},{role:'assistant',content:'I will wait for value.'}]);
});

// ── BUG-196 · RECENT is a timeline, and a cost is on it ─────────────────────
//
// A flagged hand's clock is `flaggedAt` — the only one buildFlaggedEntry
// writes. Reading `at`/`ts` off it always came back null, so every cost sorted
// as if it happened at the epoch and printed no time at all.
const HOUR = 60 * 60 * 1000;

it('BUG-196: a cost that just happened leads RECENT, ahead of older growth', () => {
  const now = Date.now();
  const log = [
    { key: 'READS', from: 61, to: 62, cause: 'Watched his river sizing.', ts: now - 6 * HOUR },
    { key: 'DISCIPLINE', from: 50, to: 51, cause: 'Folded the second best hand.', ts: now - 3 * HOUR },
  ];
  const flagged = [{ handNumber: 41, flaggedAt: now - 10 * 60 * 1000,
    attrCosts: [{ key: 'FOCUS', line: 'I counted it wrong.' }] }];
  const rows = profileRecent({ ...agent, sessionFlagged: flagged }, log, now);
  expect(rows.map(r => r.label)).toEqual(['FOCUS', '+DISCIPLINE', '+READS']);
  expect(rows[0].at).toBe(now - 10 * 60 * 1000);
});

it('BUG-196: costs and growth interleave by their own clocks, newest first', () => {
  const now = Date.now();
  const log = [
    { key: 'READS', from: 61, to: 62, cause: 'Read the turn.', ts: now - 2 * HOUR },
    { key: 'COMPOSURE', from: 40, to: 39, cause: 'Rust.', ts: now - 8 * HOUR },
  ];
  const flagged = [
    { handNumber: 12, flaggedAt: now - 9 * HOUR, attrCosts: [{ key: 'FOCUS', line: 'Lost the thread.' }] },
    { handNumber: 58, flaggedAt: now - 1 * HOUR, attrCosts: [{ key: 'DISCIPLINE', line: 'Chased it.' }] },
  ];
  const rows = profileRecent({ ...agent, sessionFlagged: flagged }, log, now);
  expect(rows.map(r => r.label)).toEqual(['DISCIPLINE', '+READS', '−COMPOSURE', 'FOCUS']);
});

it('BUG-196: an ISO flaggedAt is the same clock as a numeric one', () => {
  const now = Date.now();
  const flagged = [{ handNumber: 7, flaggedAt: new Date(now - 30 * 60 * 1000).toISOString(),
    attrCosts: [{ key: 'FOCUS', line: 'I counted it wrong.' }] }];
  const rows = profileRecent({ ...agent, sessionFlagged: flagged }, [], now);
  expect(rows[0].at).toBe(now - 30 * 60 * 1000);
});

it('BUG-196: a record with no clock at all still falls to the bottom rather than claiming the epoch', () => {
  const now = Date.now();
  const log = [{ key: 'READS', from: 61, to: 62, cause: 'Read the turn.', ts: now - 5 * HOUR }];
  const flagged = [{ handNumber: 3, attrCosts: [{ key: 'FOCUS', line: 'Nobody wrote the time down.' }] }];
  const rows = profileRecent({ ...agent, sessionFlagged: flagged }, log, now);
  expect(rows.map(r => r.label)).toEqual(['+READS', 'FOCUS']);
  expect(rows[1].at).toBeNull();
});

it('BUG-196: the cost line carries its real time on screen', () => {
  const now = Date.now();
  const flagged = [
    { handNumber: 41, flaggedAt: now - 12 * 60 * 1000, attrCosts: [{ key: 'FOCUS', line: 'I counted it wrong.' }] },
    { handNumber: 20, flaggedAt: now - 3 * HOUR, attrCosts: [{ key: 'DISCIPLINE', line: 'Chased it.' }] },
  ];
  render(<AgentProfileOverview agent={{ ...agent, sessionFlagged: flagged }} attrLog={[]} />);
  const first = screen.getByText('I counted it wrong.').closest('.profile-overview__recent-row');
  const second = screen.getByText('Chased it.').closest('.profile-overview__recent-row');
  expect(first.querySelector('time')).toHaveTextContent('12m');
  expect(second.querySelector('time')).toHaveTextContent('3h');
  // …and the newer one is above the older one in the list.
  expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});
