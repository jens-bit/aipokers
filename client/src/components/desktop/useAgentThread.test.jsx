import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { fetchMock, telegram } from '../../test/harness.js';
import { useAgentThread } from './useAgentThread.js';

const agent={id:'a1',name:'Balance',opener:'Sit down.',chatHistory:[{role:'user',content:'Why did you call?'},{role:'assistant',content:'It was the sizing.'}]};
beforeEach(()=>{telegram.signIn();fetchMock.route('/hands',{recentHands:[]});});
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
