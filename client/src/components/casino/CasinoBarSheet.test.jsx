import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { CasinoBarSheet } from './CasinoBarSheet.jsx';
import { fetchMock, telegram } from '../../test/harness.js';

const agent = {id:'bird',name:'Moss',location:{where:'table',tableId:'t1'},activeTableId:'t1',mood:{state:'tilted',heat:70},identity:{hood:'moss',glow:'gold'}};
const fridge = {items:[{id:'beer',count:1,price:200},{id:'snack',count:0,price:100}],beer:1,snack:0};
beforeEach(()=>{telegram.signIn();fetchMock.route('/api/fridge',fridge);});
it('BUG-281: opening the bar only reads stock, names the owned casino recipient and existing effects', async()=>{
  render(<CasinoBarSheet agents={[agent,{id:'home',name:'Homebody',location:{where:'home'}}]} onClose={()=>{}}/>);
  expect(await screen.findByRole('button',{name:'Serve one beer from stock'})).toBeEnabled();
  expect(screen.getByRole('combobox',{name:'Who is it for?'})).toHaveValue('bird');
  expect(screen.queryByRole('option',{name:'Homebody'})).toBeNull();
  expect(screen.getByText(/discipline.*bluffing/i)).toBeVisible();
  expect(fetchMock.calls.filter(call=>call.method!=='GET')).toHaveLength(0);
});
it('BUG-281: one explicit buy-and-serve submits the authenticated fixed-price order and shows its receipt',async()=>{
  const onChanged=vi.fn();
  fetchMock.route('/api/agents/bird/bar-order',({body})=>({orderId:body.orderId,given:'snack',spent:100,fridge:{...fridge,snack:0},agent}));
  render(<CasinoBarSheet agents={[agent]} onClose={()=>{}} onChanged={onChanged}/>);
  await userEvent.click(await screen.findByRole('button',{name:'Buy and serve one snack for $100'}));
  expect(await screen.findByRole('status')).toHaveTextContent('Moss had a snack. $100 from your safe.');
  const writes=fetchMock.calls.filter(call=>call.method==='POST');expect(writes).toHaveLength(1);
  expect(writes[0].body).toMatchObject({userId:'4242',item:'snack',buyIfEmpty:true});
  expect(writes[0].body.orderId).toMatch(/^[A-Za-z0-9_-]{8,100}$/);
  expect(writes[0].headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  expect(onChanged).toHaveBeenCalledTimes(1);
});
it('BUG-281: failed orders retain their retry ID, never claim service, and block duplicate clicks while pending',async()=>{
  let finish;
  fetchMock.route('/api/agents/bird/bar-order',()=>new Promise(resolve=>{finish=resolve;}));
  render(<CasinoBarSheet agents={[agent]} onClose={()=>{}}/>);
  const serve=await screen.findByRole('button',{name:'Serve one beer from stock'});
  await userEvent.click(serve);fireEvent.click(serve);
  expect(fetchMock.calls.filter(call=>call.method==='POST')).toHaveLength(1);
  await act(async()=>finish({status:503,body:{error:'Could not serve that order. Please try again.'}}));
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not serve');
  expect(screen.queryByText(/Moss had a beer/)).toBeNull();
  fetchMock.route('/api/agents/bird/bar-order',({body})=>({orderId:body.orderId,given:'beer',spent:0,fridge:{...fridge,beer:0,items:fridge.items.map(i=>({...i,count:0}))},agent}));
  await userEvent.click(serve);
  await waitFor(()=>expect(screen.getByRole('status')).toHaveTextContent('Moss had a beer. From household stock.'));
  const writes=fetchMock.calls.filter(call=>call.method==='POST');
  expect(writes[1].body.orderId).toBe(writes[0].body.orderId);
  expect(writes.every(call=>call.url.endsWith('/bar-order'))).toBe(true);
});
it('BUG-281: a roster with no casino agents has no order control',async()=>{
  render(<CasinoBarSheet agents={[{...agent,activeTableId:null,liveGame:{home:true,tableId:'home-4242'},location:{where:'home'}}]} onClose={()=>{}}/>);
  expect(await screen.findByText('Your agents are at Home. Send one to the casino to order here.')).toBeVisible();
  expect(screen.queryByRole('button',{name:/Serve|Buy and serve/})).toBeNull();
});
