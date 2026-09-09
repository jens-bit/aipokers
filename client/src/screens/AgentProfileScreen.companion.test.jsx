import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { AgentProfileScreen } from './AgentProfileScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';
const agent = { id:'first',name:'First',attrs:{READS:50},mood:{state:'neutral'},presence:'resting',location:{where:'home'},pocket:{balance:2000},sessionLog:[] };
beforeEach(()=>{telegram.signIn();fetchMock.route('/hands',{recentHands:[]});fetchMock.route('/flagged',{flaggedHands:[]});});
it.each([false,true])('BUG-162: a live Home player offers Watch, not an unsupported casino call-in (visitor %s)', async(visiting)=>{
  const user=userEvent.setup(), onWatch=vi.fn(), onCallIn=vi.fn(), onDeploy=vi.fn();
  const seated={...agent,attrLog:[],homeTableId:'kitchen',liveGame:{tableId:'kitchen',heroStack:200},...(visiting?{visiting:{hostName:'Fidde'}}:{})};
  render(<AgentProfileScreen companion agent={seated} onWatch={onWatch} onCallIn={onCallIn} onDeploy={onDeploy}/>);
  expect(screen.queryByRole('button',{name:'Call him in'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Deploy'})).toBeNull();
  await user.click(screen.getByRole('button',{name:'Watch',exact:true}));
  await user.click(screen.getByRole('button',{name:'Watch live game'}));
  expect(onWatch).toHaveBeenCalledTimes(2);
  expect(onWatch).toHaveBeenLastCalledWith(expect.objectContaining({id:agent.id,homeTableId:'kitchen'}));
  await user.click(screen.getByRole('button',{name:'More actions'}));
  await user.click(screen.getByRole('button',{name:'His sheet'}));
  expect(screen.queryByRole('button',{name:'Call him in'})).toBeNull();
  expect(screen.queryByRole('button',{name:'Deploy'})).toBeNull();
  const watchButtons=screen.getAllByRole('button',{name:'Watch',exact:true});
  await user.click(watchButtons.find(button=>button.classList.contains('profile-actions__primary')));
  expect(onWatch).toHaveBeenCalledTimes(3);
  expect(onCallIn).not.toHaveBeenCalled();
  expect(onDeploy).not.toHaveBeenCalled();
});
it('C4 opens His sheet and returns without losing the profile route', async()=>{
  fetchMock.route('/api/agents',{agent:{...agent,attrLog:[]}});
  const user=userEvent.setup(), onBack=vi.fn();
  render(<AgentProfileScreen companion agent={agent} onBack={onBack}/>);
  await user.click(screen.getByRole('button',{name:'More actions'}));
  await user.click(screen.getByRole('button',{name:'His sheet'}));
  expect(screen.getByText('Skills')).toBeInTheDocument();
  await user.click(screen.getByRole('button',{name:'Back'}));
  expect(screen.getByRole('textbox',{name:'Whisper to him'})).toBeInTheDocument();
  expect(onBack).not.toHaveBeenCalled();
});
it('BUG-70: switching agent never carries the previous agent attribute record', async()=>{
  fetchMock.route('/api/agents/first',{agent:{attrLog:[{key:'READS',from:50,to:51,cause:'First learned this.',ts:Date.now()}]}});
  fetchMock.route('/api/agents/second',{status:503,body:{}});
  const {rerender}=render(<AgentProfileScreen companion agent={agent}/>);
  expect(await screen.findByText('First learned this.')).toBeInTheDocument();
  rerender(<AgentProfileScreen companion agent={{...agent,id:'second',name:'Second'}}/>);
  await waitFor(()=>expect(screen.queryByText('First learned this.')).toBeNull());
});

it('BUG-143: Profile immediately exposes real skills and career, then returns directly to Chat', async()=>{
  const user=userEvent.setup(), onOpenChat=vi.fn();
  const profiled={...agent,attrLog:[],attrs:{READS:62,FOCUS:41,DISCIPLINE:53,COMPOSURE:37,DECEPTION:0,STAMINA:68},careerStats:{hands:123,sessions:4,winRate:42,biggestPot:840,bankroll:2000}};
  render(<AgentProfileScreen companion agent={profiled} onOpenChat={onOpenChat}/>);
  const skills=screen.getByRole('region',{name:'Skills'});
  expect(within(skills).getByRole('button',{name:'READS 62'})).toBeInTheDocument();
  expect(within(skills).getByRole('button',{name:'DECEPTION 0'})).toBeInTheDocument();
  expect(screen.getByText('composure 37')).toBeInTheDocument();
  expect(screen.getByTitle('Stamina: 68')).toHaveTextContent('68');
  const career=screen.getByRole('region',{name:'Career'});
  expect(within(career).getByText('123')).toBeInTheDocument();
  expect(within(career).getByText('42%')).toBeInTheDocument();
  await user.click(within(skills).getByRole('button',{name:'READS 62'}));
  expect(within(skills).getByText('90D')).toBeInTheDocument();
  await user.click(within(skills).getByRole('button',{name:'READS 62'}));
  expect(within(skills).queryByText('90D')).toBeNull();
  await user.click(screen.getByRole('button',{name:'Back to chat'}));
  expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({id:profiled.id}));
});

it('BUG-143: missing readings remain unknown and recorded zeroes remain zero', ()=>{
  render(<AgentProfileScreen companion agent={{...agent,attrLog:[],attrs:{READS:0},careerStats:{hands:0,sessions:0,biggestPot:0}}}/>);
  const skills=screen.getByRole('region',{name:'Skills'});
  expect(within(skills).getByRole('button',{name:'READS 0'})).toBeInTheDocument();
  expect(within(skills).queryByRole('button',{name:'FOCUS 50'})).toBeNull();
  expect(within(skills).getByText('FOCUS · DISCIPLINE · DECEPTION not recorded yet.')).toBeInTheDocument();
  const career=within(screen.getByRole('region',{name:'Career'}));
  expect(career.getAllByText('0')).toHaveLength(3);
  expect(career.getAllByText('—')).toHaveLength(2);
  expect(screen.getByTitle('Stamina not recorded yet')).toHaveTextContent('—');
});

it('BUG-143: an absent career is not presented as five zero statistics', ()=>{
  render(<AgentProfileScreen companion agent={{...agent,attrLog:[]}}/>);
  const career=within(screen.getByRole('region',{name:'Career'}));
  expect(career.getAllByText('—')).toHaveLength(5);
  expect(career.queryByText('0')).toBeNull();
});

it('BUG-143: Escape dismisses the Profile menu and the detailed sheet keeps Chat one tap away', async()=>{
  const user=userEvent.setup(), onOpenChat=vi.fn();
  render(<AgentProfileScreen companion agent={{...agent,attrLog:[]}} onOpenChat={onOpenChat}/>);
  await user.click(screen.getByRole('button',{name:'More actions'}));
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('button',{name:'Retire',exact:true})).toBeNull();
  expect(screen.getByRole('button',{name:'More actions'})).toHaveFocus();
  await user.click(screen.getByRole('button',{name:'More actions'}));
  await user.click(screen.getByRole('button',{name:'His sheet'}));
  await user.click(screen.getByRole('button',{name:'Back to chat'}));
  expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({id:agent.id}));
});
