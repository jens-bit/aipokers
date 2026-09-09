import {act,renderHook,waitFor} from '@testing-library/react';
import {expect,it} from 'vitest';
import {useHomeState} from './useHomeState.js';
import {fetchMock,socketMock,telegram} from '../test/harness.js';

const roster=[{id:'home-known-agent',name:'Home Friend',location:{where:'home'}}];
async function boot(){telegram.signIn();fetchMock.route('/api/agents',{agents:roster});const hook=renderHook(()=>useHomeState({wsUrl:'ws://localhost:8765'}));await waitFor(()=>expect(hook.result.current.loaded).toBe(true));const socket=socketMock.last();act(()=>socket.open());return {...hook,socket};}
it('BUG-157: REST knows the roster but cannot confirm an empty home game',async()=>{
  const {result}=await boot();expect(result.current.agents).toHaveLength(1);expect(result.current.gameKnown).toBe(false);expect(result.current.game).toBeNull();
});
it.each([null,{state:'running',tableId:'home-4242',seats:[{agentId:roster[0].id}]}])('BUG-157: HOME_STATE explicitly confirms game knowledge including null (%j)',async game=>{
  const {result,socket}=await boot();act(()=>socket.emit({type:'home_state',agents:roster,game}));expect(result.current.gameKnown).toBe(true);expect(result.current.game).toEqual(game);
});
it('BUG-157: a roster-only push cannot manufacture game knowledge',async()=>{
  const {result,socket}=await boot();act(()=>socket.emit({type:'home_state',agents:roster}));expect(result.current.gameKnown).toBe(false);
});
it('BUG-157: refresh failures and roster-only pushes retain the last confirmed game',async()=>{
  const {result,socket}=await boot();const game={state:'running',tableId:'home-4242',seats:[{agentId:roster[0].id}]};act(()=>socket.emit({type:'home_state',agents:roster,game}));
  fetchMock.route('/api/agents',{status:503,body:{}});await act(()=>result.current.refresh());act(()=>socket.emit({type:'home_state',agents:roster}));expect(result.current.gameKnown).toBe(true);expect(result.current.game).toEqual(game);
  fetchMock.route('/api/agents',{agents:roster});await act(()=>result.current.refresh());expect(result.current.gameKnown).toBe(true);expect(result.current.game).toEqual(game);
});
