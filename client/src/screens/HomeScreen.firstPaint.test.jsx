import {act,render,screen,waitFor} from '@testing-library/react';
import {expect,it} from 'vitest';
import {HomeScreen} from './HomeScreen.jsx';
import {DeskHome} from '../components/desktop/DeskHome.jsx';
import {fetchMock,socketMock,telegram} from '../test/harness.js';
const agents=[{id:'home-a',name:'Home A',location:{where:'home'}},{id:'home-b',name:'Home B',location:{where:'home'}}];
it.each([false,true])('BUG-157: known room waits for the game before counting seats (desktop=%s)',async desktop=>{
  telegram.signIn();fetchMock.route('/api/agents',{agents});fetchMock.route('/api/slots',{used:2,cap:4,next:{index:3,price:50000,earned:10000,unlocked:false}});
  render(desktop?<DeskHome wsUrl="ws://localhost:8765" panel="table"/>:<HomeScreen wsUrl="ws://localhost:8765" openTable/>);
  await waitFor(()=>expect(screen.getByTestId('home-table-sheet')).toBeInTheDocument());
  await waitFor(()=>expect(document.querySelector('[data-agent="home-a"]')).toBeTruthy());
  expect(screen.queryByText('NOBODY AT THE TABLE')).not.toBeInTheDocument();
  expect(screen.getByTestId('home-table-seated')).toHaveTextContent('Reading the home game…');
  expect(screen.getByTestId('home-table-seated')).not.toHaveTextContent('0 at the table');
  const socket=socketMock.instances[0];act(()=>{socket.open();socket.emit({type:'home_state',agents,game:{state:'running',tableId:'home-4242',maxSeats:4,seats:agents.map((a,seat)=>({seat,agentId:a.id,name:a.name}))}});});
  await waitFor(()=>expect(screen.getByTestId('home-table-seated')).toHaveTextContent('2 at the table · 2 chairs free'));
});
it('BUG-157: confirmed empty new-owner game keeps the first-agent draft available',async()=>{
  telegram.signIn();fetchMock.route('/api/agents',{agents:[]});fetchMock.route('/api/slots',{used:0,cap:4,next:{index:1,price:0,earned:0,unlocked:true}});
  render(<HomeScreen wsUrl="ws://localhost:8765" openTable onCreateAgent={()=>{}}/>);
  await waitFor(()=>expect(screen.getByTestId('home-table-draft')).toBeEnabled());
  const socket=socketMock.instances[0];act(()=>{socket.open();socket.emit({type:'home_state',agents:[],game:null});});
  await waitFor(()=>expect(screen.getByTestId('home-table-seated')).toHaveTextContent('0 at the table'));
  expect(screen.getByText('NOBODY AT THE TABLE')).toBeInTheDocument();expect(screen.getByTestId('home-table-draft')).toBeEnabled();
});
