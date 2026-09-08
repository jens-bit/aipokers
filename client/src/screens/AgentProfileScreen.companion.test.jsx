import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { AgentProfileScreen } from './AgentProfileScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';
const agent = { id:'first',name:'First',attrs:{READS:50},mood:{state:'neutral'},presence:'resting',location:{where:'home'},pocket:{balance:2000},sessionLog:[] };
beforeEach(()=>{telegram.signIn();fetchMock.route('/hands',{recentHands:[]});fetchMock.route('/flagged',{flaggedHands:[]});});
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
