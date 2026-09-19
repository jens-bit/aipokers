import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it, vi } from 'vitest';
import { fetchMock, telegram } from '../../test/harness.js';
import { useAgentThread } from './useAgentThread.js';

const agent={id:'a1',name:'Balance',opener:'Sit down.',chatHistory:[{role:'user',content:'Why did you call?'},{role:'assistant',content:'It was the sizing.'}]};
const proposed = { ...agent, profile: { tightness: 60 }, proposal: { createdAt: 123, text: 'Can I loosen up?', suggestedPatch: { profileDelta: { tightness: -8 } } } };
const accepted = { ...proposed, profile: { tightness: 52 }, proposal: null, ownerCommandRevision: 1,
  proposalAcceptance: { proposalId: '123', reply: 'Strategy change saved. Tightness: 60% → 52%.' } };

it('BUG-260: an equal-revision first profile hydrates saved history and proposal while keeping a locally pending message', async () => {
  let profileReply, chatReply;
  fetchMock.route('/api/agents/a1?userId=', () => new Promise(resolve => { profileReply = resolve; }));
  fetchMock.route('/api/agents/chat', () => new Promise(resolve => { chatReply = resolve; }));
  const compact = { id: 'a1', name: 'Balance', ownerCommandRevision: 0, opener: 'Sit down.' };
  const { result } = renderHook(() => useAgentThread(compact));
  await waitFor(() => expect(result.current.chat).toHaveLength(1));
  let pending;
  act(() => { pending = result.current.send('Can we talk?'); });
  await act(async () => { profileReply({ ...proposed, ownerCommandRevision: 0 }); });
  await waitFor(() => expect(result.current.chat.some(m => m.role === 'proposal')).toBe(true));
  expect(result.current.chat.filter(m => m.role === 'user' || m.role === 'assistant').map(m => m.content))
    .toEqual(['Why did you call?', 'It was the sizing.', 'Can we talk?']);
  expect(result.current.sending).toBe(true);
  await act(async () => { chatReply({ chat: [{ role: 'assistant', content: 'Go ahead.' }] }); await pending; });
  expect(result.current.chat.at(-1).content).toBe('Go ahead.');
});

it('BUG-260: an open thread adds a newly proposed change once and never replays its accepted card', async () => {
  const { result, rerender } = renderHook(({ current }) => useAgentThread(current), { initialProps: { current: agent } });
  await waitFor(() => expect(result.current.chat).toHaveLength(2));
  rerender({ current: { ...proposed, ownerCommandRevision: 1 } });
  await waitFor(() => expect(result.current.chat.filter(m => m.role === 'proposal')).toHaveLength(1));
  const id = result.current.chat.find(m => m.role === 'proposal')._id;
  rerender({ current: { ...proposed, ownerCommandRevision: 1 } });
  expect(result.current.chat.filter(m => m.role === 'proposal')).toHaveLength(1);
  fetchMock.route('/proposal/accept', { ...accepted, ownerCommandRevision: 2 });
  await act(async () => { await result.current.acceptProposal(id); });
  rerender({ current: { ...proposed, ownerCommandRevision: 1 } });
  expect(result.current.chat.filter(m => m.role === 'proposal')).toHaveLength(0);
  expect(result.current.chat.filter(m => m.role === 'accepted')).toHaveLength(1);
});

it('BUG-260: accepting uses the returned profile and one saved receipt without generating another chat', async () => {
  fetchMock.route('/proposal/accept', accepted);
  const onCommand = vi.fn(() => Promise.reject(new Error('Refresh offline')));
  const { result } = renderHook(() => useAgentThread(proposed, { onCommand }));
  await waitFor(() => expect(result.current.chat.some(m => m.role === 'proposal')).toBe(true));
  const id = result.current.chat.find(m => m.role === 'proposal')._id;
  await act(async () => { await result.current.acceptProposal(id); });
  expect(result.current.agent.profile.tightness).toBe(52);
  expect(result.current.agent.proposal).toBeNull();
  expect(result.current.chat.at(-1).content).toBe(accepted.proposalAcceptance.reply);
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(0);
  expect(fetchMock.requestsMatching('/proposal/accept')[0].body).toMatchObject({ userId: '4242', proposalId: '123' });
  expect(onCommand).toHaveBeenCalledTimes(1);
  expect(result.current.error).toBe('');
  await act(async () => { await result.current.acceptProposal(id); });
  expect(fetchMock.requestsMatching('/proposal/accept')).toHaveLength(1);
});

it('BUG-260: acceptance failure is visible and the same card can be retried', async () => {
  fetchMock.route('/proposal/accept', { status: 503, body: { error: 'offline' } });
  const { result } = renderHook(() => useAgentThread(proposed));
  await waitFor(() => expect(result.current.chat.some(m => m.role === 'proposal')).toBe(true));
  const id = result.current.chat.find(m => m.role === 'proposal')._id;
  await act(async () => { await result.current.acceptProposal(id); });
  expect(result.current.error).toMatch(/could not save.*try/i);
  expect(result.current.chat.find(m => m._id === id).role).toBe('proposal');
  fetchMock.route('/proposal/accept', accepted);
  await act(async () => { await result.current.acceptProposal(id); });
  expect(result.current.error).toBe('');
  expect(result.current.agent.profile.tightness).toBe(52);
});

it('BUG-260: rapid accepts send once and a late receipt cannot enter another agent conversation', async () => {
  let release;
  fetchMock.route('/proposal/accept', () => new Promise(resolve => { release = resolve; }));
  const { result, rerender } = renderHook(({ current }) => useAgentThread(current), { initialProps: { current: proposed } });
  await waitFor(() => expect(result.current.chat.some(m => m.role === 'proposal')).toBe(true));
  const id = result.current.chat.find(m => m.role === 'proposal')._id;
  let pending;
  act(() => { pending = result.current.acceptProposal(id); result.current.acceptProposal(id); });
  expect(fetchMock.requestsMatching('/proposal/accept')).toHaveLength(1);
  rerender({ current: { ...agent, id: 'a2', chatHistory: [], opener: 'Another companion.' } });
  await waitFor(() => expect(result.current.chat[0]?.content).toBe('Another companion.'));
  expect(result.current.accepting).toBe(false);
  await act(async () => { release(accepted); await pending; });
  expect(result.current.chat.map(m => m.content)).toEqual(['Another companion.']);
  expect(result.current.agent.id).toBe('a2');
});

it.each(['sync', 'async'])('BUG-251: a %s refresh failure cannot erase a successful command receipt or invite retry', async kind => {
  fetchMock.route('/api/agents/chat', { chat: [{ role: 'assistant', content: 'I took $500 from your safe.' }],
    command: { status: 'done' }, agent: { ...agent, ownerCommandRevision: 1 } });
  const onCommand = () => { if (kind === 'sync') throw new Error('Refresh failed'); return Promise.reject(new Error('Refresh failed')); };
  const { result } = renderHook(() => useAgentThread(agent, { onCommand }));
  await waitFor(() => expect(result.current.chat).toHaveLength(2));
  await act(async () => { expect(await result.current.send('give me 500 chips')).toBe(true); });
  expect(result.current.chat.at(-1).content).toBe('I took $500 from your safe.');
  expect(result.current.error).toBe('');
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(1);
});
beforeEach(()=>{telegram.signIn();fetchMock.route('/hands',{recentHands:[]});});
it('FIRST-CHAT-1: malformed success is retryable but a saved unavailable reply remains a completed turn', async()=>{
  fetchMock.route('/api/agents/chat',{chat:[]});
  const {result}=renderHook(()=>useAgentThread(agent));
  await waitFor(()=>expect(result.current.chat).toHaveLength(2));
  await act(async()=>{expect(await result.current.send('Hello')).toBe(false);});
  expect(result.current.chat).toHaveLength(2);
  expect(result.current.error).toMatch(/try again/i);
  fetchMock.route('/api/agents/chat',{chat:[{role:'assistant',content:'I cannot answer that right now.'}],replyUnavailable:true});
  await act(async()=>{expect(await result.current.send('Hello')).toBe(true);});
  expect(result.current.chat).toHaveLength(4);
  expect(result.current.error).toBe('');
});
it('FIRST-CHAT-1: switching agents ignores an old response and unlocks the new conversation', async()=>{
  let release;
  fetchMock.route('/api/agents/chat',()=>new Promise(resolve=>{release=resolve;}));
  const {result,rerender}=renderHook(({current})=>useAgentThread(current),{initialProps:{current:agent}});
  await waitFor(()=>expect(result.current.chat).toHaveLength(2));
  let pending;
  act(()=>{pending=result.current.send('Old message');});
  rerender({current:{...agent,id:'a2',chatHistory:[],opener:'New agent.'}});
  await waitFor(()=>expect(result.current.chat.some(m=>m.content==='New agent.')).toBe(true));
  expect(result.current.sending).toBe(false);
  await act(async()=>{release({chat:[{role:'assistant',content:'Old answer'}]});await pending;});
  expect(result.current.chat.map(m=>m.content)).toEqual(['New agent.']);
});
it('FIRST-CHAT-1: two sends in the same turn issue one authenticated request', async()=>{
  let release;
  fetchMock.route('/api/agents/chat',()=>new Promise(resolve=>{release=resolve;}));
  const {result}=renderHook(()=>useAgentThread(agent));
  await waitFor(()=>expect(result.current.chat).toHaveLength(2));
  let first,second;
  act(()=>{first=result.current.send('Hello');second=result.current.send('Hello');});
  expect(await second).toBe(false);
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(1);
  expect(fetchMock.requestsMatching('/api/agents/chat')[0].body).toMatchObject({existingAgentId:'a1',userId:'4242'});
  await act(async()=>{release({chat:[{role:'assistant',content:'Hello.'}]});await first;});
  expect(result.current.chat.filter(m=>m.content==='Hello')).toHaveLength(1);
});
it('BUG-80 restores the saved private conversation when the desktop column reopens',async()=>{
  const {result}=renderHook(()=>useAgentThread(agent));
  await waitFor(()=>expect(result.current.chat.some(m=>m.content==='It was the sizing.')).toBe(true));
  expect(result.current.chat.map(m=>m.content)).toEqual(['Why did you call?','It was the sizing.']);
});

it('BUG-264: reopening an existing desktop conversation keeps each saved activity report once', async () => {
  const reports = [{ role: 'assistant', reportKind: 'session', reportId: 's1', content: 'I finished 8 hands at +$340 net.' },
    { role: 'assistant', reportKind: 'study', reportId: '10:42', content: 'I finished hand #42. Granite paid off the river.' }];
  const returned = { ...agent, chatHistory: [...agent.chatHistory, ...reports], unseenRecap: false };
  const first = renderHook(() => useAgentThread(returned));
  await waitFor(() => expect(first.result.current.chat).toHaveLength(4));
  first.unmount();
  const second = renderHook(() => useAgentThread(returned));
  await waitFor(() => expect(second.result.current.chat).toHaveLength(4));
  expect(second.result.current.chat.map(m => m.content)).toEqual(returned.chatHistory.map(m => m.content));
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(0);
});

it('BUG-264: an open conversation merges a fresh activity report once without losing its pending message', async () => {
  let release;
  fetchMock.route('/api/agents/chat', () => new Promise(resolve => { release = resolve; }));
  const { result, rerender } = renderHook(({ current }) => useAgentThread(current), { initialProps: { current: agent } });
  await waitFor(() => expect(result.current.chat).toHaveLength(2));
  let pending;
  act(() => { pending = result.current.send('What did you learn?'); });
  const report = { role: 'assistant', reportKind: 'study', reportId: 'study1', content: 'The tape showed his river sizing.' };
  const updated = { ...agent, chatHistory: [...agent.chatHistory, report], ownerCommandRevision: 1 };
  rerender({ current: updated });
  await waitFor(() => expect(result.current.chat.filter(m => m.reportId === 'study1')).toHaveLength(1));
  expect(result.current.chat.some(m => m.content === 'What did you learn?')).toBe(true);
  expect(result.current.sending).toBe(true);
  rerender({ current: { ...updated, chatHistory: [...updated.chatHistory] } });
  expect(result.current.chat.filter(m => m.reportId === 'study1')).toHaveLength(1);
  await act(async () => { release({ chat: [{ role: 'assistant', content: 'He sized for value.' }] }); await pending; });
  expect(result.current.chat.at(-1).content).toBe('He sized for value.');
});

it('BUG-264: opening a snapshot-backed thread reads its current authenticated profile and merges the report', async () => {
  const report = { role: 'assistant', reportKind: 'study', reportId: 'fresh', content: 'The tape has finished.' };
  fetchMock.route('/api/agents/a1?userId=', { ...agent, ownerCommandRevision: 1, chatHistory: [...agent.chatHistory, report] });
  const { result } = renderHook(() => useAgentThread(agent));
  await waitFor(() => expect(result.current.chat.some(m => m.reportId === 'fresh')).toBe(true));
  expect(fetchMock.requestsMatching('/api/agents/a1?userId=')[0].headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(0);
});

it('BUG-264: a late initial seed cannot duplicate a new report or carry one across agents', async () => {
  let seed;
  fetchMock.route('/hands', () => new Promise(resolve => { seed = resolve; }));
  const report = { role: 'assistant', reportKind: 'session', reportId: 's1', content: 'My session is finished.' };
  const current = { ...agent, chatHistory: [...agent.chatHistory, report] };
  const { result, rerender } = renderHook(({ value }) => useAgentThread(value), { initialProps: { value: current } });
  rerender({ value: { ...current, chatHistory: [...current.chatHistory] } });
  await act(async () => { seed({ recentHands: [] }); });
  expect(result.current.chat.filter(m => m.reportId === 's1')).toHaveLength(1);
  fetchMock.route('/hands', { recentHands: [] });
  rerender({ value: { ...agent, id: 'a2', chatHistory: [], opener: 'Someone else.' } });
  await waitFor(() => expect(result.current.chat.map(m => m.content)).toEqual(['Someone else.']));
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(0);
});
it('BUG-81 returns a failed send and exposes a retryable error for a refused response',async()=>{
  fetchMock.route('/api/agents/chat',{status:503,body:{error:'unavailable'}});
  const {result}=renderHook(()=>useAgentThread(agent));
  await waitFor(()=>expect(result.current.chat.length).toBeGreaterThan(0));
  let sent;
  await act(async()=>{sent=await result.current.send('Wait for the button.');});
  expect(sent).toBe(false);
  expect(result.current.error).toMatch(/try again/i);
});
it('BUG-80 a late initial load preserves a message sent while it was loading',async()=>{
  let resolve;
  fetchMock.route('/hands',()=>new Promise(r=>{resolve=r;}));
  fetchMock.route('/api/agents/chat',{chat:[{role:'assistant',content:'Fine. I will wait.'}]});
  const {result}=renderHook(()=>useAgentThread(agent));
  await act(async()=>{await result.current.send('Wait for the button.');});
  await act(async()=>{resolve({recentHands:[]});});
  expect(result.current.chat.map(m=>m.content)).toEqual(['Why did you call?','It was the sizing.','Wait for the button.','Fine. I will wait.']);
});

it('BUG-95 a refused whisper can be retried without duplicating an unsent message',async()=>{
  let attempts=0;
  fetchMock.route('/api/agents/chat',()=>++attempts===1 ? {status:503,body:{error:'unavailable'}} : {chat:[{role:'assistant',content:'Fine. I will wait.'}]});
  const {result}=renderHook(()=>useAgentThread(agent));
  await waitFor(()=>expect(result.current.chat).toHaveLength(2));
  await act(async()=>{expect(await result.current.send('Wait for the button.')).toBe(false);});
  expect(result.current.chat.map(m=>m.content)).toEqual(['Why did you call?','It was the sizing.']);
  let response;
  await act(async()=>{expect(await result.current.send('Wait for the button.',{onResult:data=>{response=data;}})).toBe(true);});
  expect(result.current.chat.map(m=>m.content)).toEqual(['Why did you call?','It was the sizing.','Wait for the button.','Fine. I will wait.']);
  expect(response.chat[0].content).toBe('Fine. I will wait.');
  expect(result.current.error).toBe('');
});
