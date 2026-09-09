import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { AgentProfileOverview, profileRecent, profileSession } from './AgentProfileOverview.jsx';
import { fetchMock, telegram } from '../../test/harness.js';

const agent = { id:'c4', name:'Balanced v2.1', mood:{state:'confident',heat:22}, fatigue:'worn', nature:{name:'Rock'}, pocket:{balance:1200}, attrs:{READS:62}, bornAt:Date.UTC(2026,7,4), sessionLog:[] };
beforeEach(() => { telegram.signIn(); });
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
