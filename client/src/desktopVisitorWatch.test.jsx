import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import App from './App.jsx';
import {fetchMock,socketMock,telegram} from './test/harness.js';
import {restingAgent} from './test/fixtures/agents.js';

afterEach(()=>vi.restoreAllMocks());
async function desktopAgent(agent){
  vi.spyOn(window,'matchMedia').mockImplementation(query=>({matches:query.includes('1100'),media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
  telegram.signIn();fetchMock.route('/api/agents',{agents:[agent]});
  render(<App/>);
  const frame=await screen.findByTestId(`home-frame-${agent.id}`,{}, {timeout:5000});
  await userEvent.click(frame);
  let watched;
  await waitFor(()=>{
    act(()=>{for(const s of socketMock.instances)if(s.readyState===0)s.open();});
    watched=socketMock.instances.flatMap(s=>s.sent).find(m=>m.type==='watch');
    expect(watched).toBeTruthy();
  });
  return watched;
}

it('BUG-193: an own accepted visitor watches the actual host kitchen with its existing authenticated viewpoint',async()=>{
  const agent={...restingAgent,id:'owned-visitor',name:'Professor Oak',activeTableId:null,
    homeTableId:'home-5151',visiting:{hostName:'Fidde'},location:{where:'casino',tableId:null,room:null},
    liveGame:{tableId:'home-5151',home:true,board:[],pot:30,seats:[]}};
  const watched=await desktopAgent(agent);
  expect(watched).toMatchObject({tableId:'home-5151',agentId:'owned-visitor',userId:'4242',displayName:'Professor Oak'});
  expect(JSON.stringify(watched)).toContain(telegram.webApp.initData);
  expect(fetchMock.requestsMatching('/api/agents/owned-visitor/memory').at(-1).headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
});

it('BUG-193: an established own casino agent keeps its active table and full identity',async()=>{
  const agent={...restingAgent,id:'owned-casino',name:'Big Slick',activeTableId:'casino-table',
    location:{where:'casino',tableId:'casino-table',room:'upstairs'},
    liveGame:{tableId:'casino-table',board:[],pot:30,seats:[]}};
  const watched=await desktopAgent(agent);
  expect(watched).toMatchObject({tableId:'casino-table',agentId:'owned-casino',userId:'4242',displayName:'Big Slick'});
});
