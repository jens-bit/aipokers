import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { fetchMock, telegram } from '../../test/harness.js';
import { useAgentThread } from './useAgentThread.js';

const agent={id:'a1',name:'Balance',opener:'Sit down.',chatHistory:[{role:'user',content:'Why did you call?'},{role:'assistant',content:'It was the sizing.'}]};
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
