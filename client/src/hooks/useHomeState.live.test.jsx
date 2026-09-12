import {act,renderHook,waitFor} from '@testing-library/react';
import {expect,it,vi} from 'vitest';
import {useHomeState} from './useHomeState.js';
import {fetchMock,socketMock,telegram} from '../test/harness.js';

const live=(extra={})=>({tableId:'casino-a',street:'flop',board:['Ah','Kd','2c'],pot:60,handNumber:7,heroSeat:0,net:120,seats:[{displayName:'Bird'},{displayName:'House'}],...extra});
const agent=(id='bird',extra={})=>({id,name:id,location:{where:'table',tableId:'casino-a'},activeTableId:'casino-a',liveGame:live(),...extra});
async function boot(roster=[agent()]){
  telegram.signIn();fetchMock.route('/api/agents',{agents:roster});
  const hook=renderHook(()=>useHomeState({wsUrl:'ws://localhost:8765'}));
  await waitFor(()=>expect(hook.result.current.loaded).toBe(true));
  const socket=socketMock.last();act(()=>socket.open());
  await act(async()=>{});
  return {...hook,socket};
}
const delta=(extra={})=>({type:'floor_game',agentId:'bird',tableId:'casino-a',street:'turn',board:['Ah','Kd','2c','9s'],pot:180,handNumber:7,...extra});

it('FIRST-HOME-1: a fresh REST roster can bring a newborn home after an initial empty snapshot',async()=>{
  const {result,socket}=await boot([]);
  act(()=>socket.emit({type:'home_state',agents:[],game:null}));
  fetchMock.route('/api/agents',{agents:[agent('newborn',{location:{where:'home'},activeTableId:null,liveGame:null})]});
  await act(()=>result.current.refresh());
  expect(result.current.home.map(a=>a.id)).toEqual(['newborn']);
});

it('FIRST-HOME-1: FLOOR_STATE inserts a newborn into an initially empty home immediately',async()=>{
  const {result,socket}=await boot([]);
  act(()=>socket.emit({type:'home_state',agents:[],game:null}));
  act(()=>socket.emit({type:'floor_state',agents:[agent('newborn',{location:{where:'home'},activeTableId:null,liveGame:null})]}));
  expect(result.current.home.map(a=>a.id)).toEqual(['newborn']);
});

it('FIRST-HOME-1: a REST response started before birth cannot erase the pushed newborn',async()=>{
  const {result,socket}=await boot([]);let release;
  act(()=>socket.emit({type:'home_state',agents:[],game:null}));
  fetchMock.route('/api/agents',()=>new Promise(resolve=>{release=resolve;}));
  const pending=result.current.refresh();await waitFor(()=>expect(release).toBeTypeOf('function'));
  act(()=>socket.emit({type:'home_state',agents:[agent('newborn',{location:{where:'home'},activeTableId:null,liveGame:null})],game:null}));
  await act(async()=>{release({agents:[]});await pending;});
  expect(result.current.home.map(a=>a.id)).toEqual(['newborn']);
});

it('FIRST-HOME-1: accepting a new REST arrival cannot restore an agent removed by the socket',async()=>{
  const {result,socket}=await boot();
  act(()=>socket.emit({type:'home_state',agents:[],game:null}));
  fetchMock.route('/api/agents',{agents:[agent(),agent('newborn',{location:{where:'home'},activeTableId:null,liveGame:null})]});
  await act(()=>result.current.refresh());
  expect(result.current.agents.map(a=>a.id)).toEqual(['newborn']);
  let release;fetchMock.route('/api/agents',()=>new Promise(resolve=>{release=resolve;}));
  const pending=result.current.refresh();await waitFor(()=>expect(release).toBeTypeOf('function'));
  act(()=>socket.emit({type:'floor_state',agents:[]}));
  await act(async()=>{release({agents:[agent('newborn'),agent('stale-unknown')]});await pending;});
  expect(result.current.agents).toEqual([]);
});

it('BUG-168: existing FLOOR_GAME updates Home board/pot without another request or socket',async()=>{
  const {result,socket}=await boot();const requests=vi.mocked(fetch).mock.calls.length;
  act(()=>socket.emit(delta({heroHole:['Qc','Qd']})));
  expect(result.current.away[0].liveGame).toMatchObject({street:'turn',board:['Ah','Kd','2c','9s'],pot:180,net:120});
  expect(result.current.away[0].liveGame.heroHole).toBeUndefined();
  expect(vi.mocked(fetch).mock.calls.length).toBe(requests);expect(socketMock.last()).toBe(socket);
});
it('BUG-168: deltas cannot create strangers, target another table or transfer another agent cards',async()=>{
  const {result,socket}=await boot([agent(),agent('other',{liveGame:live({heroHole:['Ac','Ad'],heroSeat:1})})]);
  act(()=>socket.emit(delta({agentId:'stranger',heroHole:['Qc','Qd']})));
  act(()=>socket.emit(delta({tableId:'old-table'})));
  act(()=>socket.emit(delta({handNumber:6})));
  expect(result.current.agents[0].liveGame.board).toHaveLength(3);
  act(()=>socket.emit(delta({heroHole:['Qc','Qd']})));
  expect(result.current.agents).toHaveLength(2);
  expect(result.current.agents[1].liveGame.heroHole).toEqual(['Ac','Ad']);
  expect(result.current.agents[0].liveGame.heroHole).toBeUndefined();
});
it('BUG-168: a late REST response cannot rewind a pushed table frame',async()=>{
  const {result,socket}=await boot();let release;
  fetchMock.route('/api/agents',()=>new Promise(resolve=>{release=resolve;}));
  const pending=result.current.refresh();await waitFor(()=>expect(release).toBeTypeOf('function'));
  act(()=>socket.emit(delta()));
  await act(async()=>{release({agents:[agent()]});await pending;});
  expect(result.current.agents[0].liveGame).toMatchObject({street:'turn',pot:180});
});
it('BUG-168: one table delta refreshes both owned seats while preserving each perspective and private cards',async()=>{
  const {result,socket}=await boot([agent(),agent('other',{liveGame:live({heroHole:['Ac','Ad'],heroSeat:1,net:35})})]);
  act(()=>socket.emit(delta({heroHole:['Qc','Qd']})));
  expect(result.current.agents[1].liveGame).toMatchObject({street:'turn',pot:180,board:['Ah','Kd','2c','9s'],heroSeat:1,net:35,heroHole:['Ac','Ad']});
  expect(result.current.agents[0].liveGame.heroSeat).toBe(0);
});
it('BUG-168: FLOOR_STATE moves the same agent to a new table and rejects the old table delta',async()=>{
  const {result,socket}=await boot();
  act(()=>socket.emit({type:'floor_state',agents:[agent('bird',{activeTableId:'casino-b',location:{where:'table',tableId:'casino-b'},liveGame:live({tableId:'casino-b',handNumber:1,board:[],street:'preflop',heroHole:['Ks','Kh']})})]}));
  act(()=>socket.emit(delta()));
  expect(result.current.agents[0].liveGame).toMatchObject({tableId:'casino-b',handNumber:1,board:[]});
  expect(result.current.agents[0].liveGame.heroHole).toBeUndefined();
  act(()=>socket.emit(delta({tableId:'casino-b',handNumber:1})));
  expect(result.current.agents[0].liveGame.pot).toBe(180);
});
it('BUG-168: closing/returning clears the preview and old messages cannot revive it',async()=>{
  const {result,socket}=await boot();
  act(()=>socket.emit({type:'floor_state',agents:[agent('bird',{activeTableId:null,location:{where:'home',tableId:null},liveGame:null})]}));
  act(()=>socket.emit(delta()));await act(()=>result.current.refresh());
  expect(result.current.home[0].liveGame).toBeNull();expect(result.current.away).toHaveLength(0);
});
it('BUG-168: authoritative owner roster removal survives stale REST and preserves guest bodies',async()=>{
  const guest=agent('guest',{guest:true,location:{where:'home'},liveGame:live({tableId:'home-owner',home:true})});
  const {result,socket}=await boot();act(()=>socket.emit({type:'home_state',agents:[agent(),guest]}));
  act(()=>socket.emit({type:'floor_state',agents:[]}));
  act(()=>socket.emit(delta()));await act(()=>result.current.refresh());
  expect(result.current.agents.map(a=>a.id)).toEqual(['guest']);
});
it('BUG-168: another owner snapshot and casino delta for a visiting guest are ignored',async()=>{
  const guest=agent('bird',{guest:true,location:{where:'home'}});
  const {result,socket}=await boot([guest]);
  act(()=>socket.emit({type:'floor_state',userId:'not-this-owner',agents:[agent('intruder')]}));
  act(()=>socket.emit(delta()));
  expect(result.current.agents).toHaveLength(1);expect(result.current.agents[0].liveGame.board).toHaveLength(3);
});
it('BUG-168: a public HOME_STATE preview keeps visitor updates current and departure clears it',async()=>{
  const {result,socket}=await boot([agent('bird',{visiting:{hostName:'Friend'},liveGame:live({tableId:'home-friend',home:true})})]);
  act(()=>socket.emit({type:'home_state',agents:[{id:'bird',location:{where:'table',tableId:'home-friend'},visiting:{hostName:'Friend'},liveGame:live({tableId:'home-friend',home:true,pot:190})}]}));
  expect(result.current.away[0].liveGame.pot).toBe(190);
  act(()=>socket.emit({type:'home_state',agents:[{id:'bird',location:{where:'home'},visiting:null,liveGame:null}]}));
  await act(()=>result.current.refresh());expect(result.current.home[0].liveGame).toBeNull();
});

it('BUG-168: switching owner clears the old roster filter before the new REST answer',async()=>{
  fetchMock.route('/api/agents?userId=owner-a',{agents:[agent('a')]});
  fetchMock.route('/api/agents?userId=owner-b',{agents:[agent('b')]});
  const {result,rerender}=renderHook(props=>useHomeState(props),{initialProps:{wsUrl:'ws://localhost:8765',userId:'owner-a',initData:'signed-a'}});
  await waitFor(()=>expect(result.current.loaded).toBe(true));
  const oldSocket=socketMock.last();
  act(()=>oldSocket.emit({type:'home_state',userId:'owner-a',agents:[agent('a')],game:{tableId:'home-a',state:'running'},visitor:{id:'a-knock'}}));
  rerender({wsUrl:'ws://localhost:8765',userId:'owner-b',initData:'signed-b'});
  await waitFor(()=>expect(result.current.agents.map(a=>a.id)).toEqual(['b']));
  expect(result.current.game).toBeNull();expect(result.current.gameKnown).toBe(false);
  expect(result.current.visitor).toBeNull();
});

it.each(['owner-b','owner-a'])('BUG-168: replaced owner/auth scope ignores delayed REST and old socket events (%s)',async nextOwner=>{
  fetchMock.route('/api/agents',{agents:[agent('a')]});
  const {result,rerender}=renderHook(props=>useHomeState(props),{initialProps:{wsUrl:'ws://localhost:8765',userId:'owner-a',initData:'signed-a'}});
  await waitFor(()=>expect(result.current.loaded).toBe(true));
  const oldSocket=socketMock.last();let release;
  fetchMock.route('/api/agents',()=>new Promise(resolve=>{release=resolve;}));
  const pending=result.current.refresh();await waitFor(()=>expect(release).toBeTypeOf('function'));
  fetchMock.route('/api/agents',{agents:[agent('b')]});
  rerender({wsUrl:'ws://localhost:8765',userId:nextOwner,initData:'signed-new'});
  await waitFor(()=>expect(result.current.agents.map(a=>a.id)).toEqual(['b']));
  const newSocket=socketMock.last();act(()=>newSocket.open());
  await act(async()=>{});
  await act(async()=>{release({agents:[agent('a')]});await pending;});
  expect(result.current.agents.map(a=>a.id)).toEqual(['b']);
  // Current subscription confirms B; late events from the retired socket must
  // not change the room or schedule another connection, even with no userId.
  act(()=>newSocket.emit({type:'home_state',userId:nextOwner,agents:[agent('b')],game:null}));
  act(()=>oldSocket.emit({type:'home_state',agents:[agent('a')],game:{tableId:'home-a'}}));
  act(()=>oldSocket.emit({type:'session_end',agentId:'a',net:99}));
  act(()=>oldSocket.close());
  expect(result.current.agents.map(a=>a.id)).toEqual(['b']);
  expect(result.current.game).toBeNull();expect(result.current.arrival).toBeNull();
  expect(result.current.status).toBe('live');
});

it('BUG-168: reconnecting the same owner retains the last confirmed room and rejects retired socket events',async()=>{
  fetchMock.route('/api/agents',{agents:[agent()]});
  const game={tableId:'home-4242',state:'running'};
  // Changing the endpoint rebuilds the connection, not the owner household.
  // Keep its confirmed table while the replacement subscription catches up.
  const sameOwner=renderHook(props=>useHomeState(props),{initialProps:{wsUrl:'ws://localhost:8766',userId:'same',initData:'signed'}});
  await waitFor(()=>expect(sameOwner.result.current.loaded).toBe(true));
  const original=socketMock.last();
  act(()=>original.emit({type:'home_state',agents:[agent()],game}));
  sameOwner.rerender({wsUrl:'ws://localhost:8767',userId:'same',initData:'signed'});
  expect(sameOwner.result.current.game).toEqual(game);expect(sameOwner.result.current.gameKnown).toBe(true);
  act(()=>original.emit({type:'home_state',agents:[],game:null}));
  expect(sameOwner.result.current.game).toEqual(game);
});
