import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { BirthScreen } from './BirthScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';
import { rememberPendingVisitor, pendingVisitorName } from '../lib/visit.js';

const STORAGE='railbird:draft:4242';
const initial={draftId:'draft-one',draftStep:'briefing',ready:false,draftName:null,chat:[]};
const naming={...initial,draftStep:'naming',ready:true,natureHint:'Rock',chat:[{role:'user',content:'Tight and patient'},{role:'assistant',content:'Patient it is. What do you call him?'}]};
const ready={...naming,draftStep:'ready',draftName:'Go',chat:[...naming.chat,{role:'user',content:'Go'},{role:'assistant',content:'Go. Ready to meet him?'}]};
const newborn={id:'a-born',name:'Go',strategy:'Patient.',identity:{hood:'moss',glow:'ice'},nature:{name:'Rock',line:'He waits.'},firstWords:'I pick my spot.',attrs:{READS:34,FOCUS:39,DISCIPLINE:47,COMPOSURE:38,DECEPTION:22,STAMINA:41},mood:{state:'neutral',heat:5}};
const created={...ready,draftStep:'created',agentId:newborn.id,agentName:newborn.name,strategy:newborn.strategy,createdAgent:newborn,firstAgent:true};
const begin=body=>fetchMock.route('/api/agents/draft',body,{method:'POST'});
const chat=body=>fetchMock.route('/api/agents/chat',body,{method:'POST'});
const dealReady=async()=>{
  await waitFor(()=>expect(screen.getByRole('button',{name:'Deal him in',exact:true})).toBeEnabled(),{timeout:2500});
  return screen.getByRole('button',{name:'Deal him in',exact:true});
};
const open=async props=>{
  const ui=render(<BirthScreen onBack={()=>{}} onBirth={()=>{}} {...props}/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'Tight and patient'})).toBeEnabled());
  return ui;
};
beforeEach(()=>{telegram.signIn();sessionStorage.clear();begin(initial);});
afterEach(()=>sessionStorage.clear());

it('BUG-145: the name question keeps an input and a name like Go is sent as a name', async()=>{
  const user=userEvent.setup();chat(naming);await open();
  await user.click(screen.getByRole('button',{name:'Tight and patient'}));
  const name=await screen.findByPlaceholderText('His name…');
  expect(screen.queryByRole('button',{name:'Deal him in',exact:true})).toBeNull();
  expect(screen.getByTestId('draft-count')).toHaveAccessibleName(/Name/);
  await waitFor(()=>expect(screen.getByTestId('draft-forming')).toHaveAttribute('data-stage','2'));
  await waitFor(()=>expect(screen.getByTestId('draft-forming')).toHaveAttribute('data-stage','3'));
  chat(ready);await user.type(name,'Go');await user.click(screen.getByRole('button',{name:'Send'}));
  expect(fetchMock.requestsMatching('/api/agents/chat').at(-1).body).toMatchObject({draftId:'draft-one',draftIntent:'name',content:'Go'});
  await waitFor(()=>expect(screen.getByRole('button',{name:'Deal him in',exact:true})).toBeEnabled());
  expect(screen.getByTestId('draft-count')).toHaveAccessibleName(/Ready/);
  expect(screen.getByTestId('draft-cap')).toHaveTextContent('Go');
});

it.each([429,503])('BUG-145: HTTP%s preserves text and reports a retry without advancing the draft',async status=>{
  const user=userEvent.setup();chat({status,body:{error:'backend internal detail'}});await open();
  await user.type(screen.getByRole('textbox'),'Tight and patient');await user.click(screen.getByRole('button',{name:'Send'}));
  expect(await screen.findByRole('alert')).toHaveTextContent(/try again|retry/i);
  expect(screen.getByRole('alert')).not.toHaveTextContent('backend internal detail');
  expect(screen.getByRole('textbox')).toHaveValue('Tight and patient');
  expect(screen.getByTestId('draft-forming')).toHaveAttribute('data-stage','1');
});

it('BUG-145: unrelated replies do not count their way to a finished character',async()=>{
  const user=userEvent.setup();chat({...initial,chat:[{role:'assistant',content:'How should he play?'}]});await open();
  for(let n=0;n<4;n++){await user.type(screen.getByRole('textbox'),'lol');await user.click(screen.getByRole('button',{name:'Send'}));await waitFor(()=>expect(screen.getByRole('textbox')).toBeEnabled());}
  expect(screen.getByTestId('draft-forming')).not.toHaveAttribute('data-stage','4');
  expect(screen.getByTestId('draft-count')).toHaveAccessibleName(/Style/);
  expect(screen.queryByRole('button',{name:'Deal him in',exact:true})).toBeNull();
});

it('BUG-145: createdAgent reaches the birth card without a roster fetch and confirms only once',async()=>{
  const user=userEvent.setup(),onBirth=vi.fn();begin(ready);chat(created);
  render(<BirthScreen onBack={()=>{}} onBirth={onBirth}/>);
  await user.click(await dealReady());
  await waitFor(()=>expect(document.querySelector('.birth-card3')).toBeTruthy(),{timeout:3500});
  expect(document.querySelector('.birth-card3 .mood-ghost')).toHaveAttribute('data-hood','moss');
  expect(document.querySelector('.birth-card3__first')).toHaveTextContent('I pick my spot.');
  expect(fetchMock.requestsMatching(/^\/api\/agents\?/)).toHaveLength(0);
  await user.dblClick(screen.getByRole('button',{name:'Deal him in',exact:true}));
  expect(onBirth).toHaveBeenCalledTimes(1);
  expect(onBirth).toHaveBeenCalledWith(expect.objectContaining({id:newborn.id,name:'Go'}));
  expect(sessionStorage.getItem(STORAGE)).toBeNull();
});

it('BUG-145: remount resumes the same draft and an uncertain creation retry keeps its attempt id',async()=>{
  const user=userEvent.setup();begin(ready);chat({status:503,body:{error:'retry'}});
  const {unmount}=render(<BirthScreen onBack={()=>{}} onBirth={()=>{}}/>);
  await user.click(await dealReady());
  await screen.findByRole('alert');
  const first=fetchMock.requestsMatching('/api/agents/chat').at(-1).body;
  expect(first.attemptId).toEqual(expect.any(String));
  expect(first.draftIntent).toBe('create');
  unmount();render(<BirthScreen onBack={()=>{}} onBirth={()=>{}}/>);
  await user.click(await dealReady());
  await screen.findByRole('alert');
  expect(fetchMock.requestsMatching('/api/agents/draft').at(-1).body.draftId).toBe('draft-one');
  expect(fetchMock.requestsMatching('/api/agents/chat').at(-1).body.attemptId).toBe(first.attemptId);
});

it('BUG-145: an expired draft never silently replays creation into another draft',async()=>{
  sessionStorage.setItem(STORAGE,JSON.stringify({draftId:'expired',attemptId:'old-attempt'}));
  begin({status:409,body:{error:'draftExpired'}});
  render(<BirthScreen onBack={()=>{}} onBirth={()=>{}}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent(/no longer available|expired/i);
  expect(screen.getByRole('button',{name:'Start a new draft'})).toBeEnabled();
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(0);
});

it('BUG-145: leaving while a creation response is pending cannot fire a later birth',async()=>{
  const user=userEvent.setup(),onBirth=vi.fn();let finish;
  begin(ready);chat(()=>new Promise(resolve=>{finish=resolve;}));
  const {unmount}=render(<BirthScreen onBack={()=>{}} onBirth={onBirth}/>);
  await user.click(await dealReady());
  unmount();await act(async()=>finish(created));
  expect(onBirth).not.toHaveBeenCalled();
  expect(sessionStorage.getItem(STORAGE)).not.toBeNull();
});

it('BUG-145: the visitor promise survives the authoritative opening response',async()=>{
  rememberPendingVisitor('Away Day');
  begin({...initial,chat:[{role:'assistant',content:'Tell me how he should play.'}]});
  await open();
  expect(screen.getByText(/Away Day is waiting at the door/)).toBeInTheDocument();
  expect(screen.queryByText('Tell me how he should play.')).toBeNull();
  expect(pendingVisitorName()).toBeNull();
});

it('BUG-145: the owner can keep words while an unavailable draft opens and retry safely',async()=>{
  const user=userEvent.setup();begin({status:503,body:{error:'private server detail'}});
  render(<BirthScreen onBack={()=>{}} onBirth={()=>{}}/>);
  await screen.findByRole('alert');
  await user.type(screen.getByRole('textbox'),'A patient player');
  expect(screen.getByRole('button',{name:'Send'})).toBeDisabled();
  expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(0);
  begin(initial);await user.click(screen.getByRole('button',{name:'Try again'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Send'})).toBeEnabled());
  expect(screen.getByRole('textbox')).toHaveValue('A patient player');
  expect(screen.queryByRole('alert')).toBeNull();
});
