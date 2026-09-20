import {act,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach,expect,it,vi} from 'vitest';
import App from './App.jsx';
import {WatchScreen} from './components/WatchScreen.jsx';
import {fetchMock,socketMock,telegram} from './test/harness.js';
import {restingAgent} from './test/fixtures/agents.js';
import {midHandGame,spectatorConfig} from './test/fixtures/game.js';

afterEach(()=>vi.restoreAllMocks());
it('BUG-279: a hungry deployment keeps its recovery remedy through the wire and returns Home without retrying', async () => {
  const socket = await refusedLink();
  act(() => socket.emit({ type: 'error', message: 'Two snacks should do it.', refusal: {
    error: 'agentSpent', kind: 'food', needs: 'stock', action: 'feed', snacksNeeded: 2, stock: 0,
  } }));
  expect(await screen.findByText('Time to recover')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Buy snacks from the fridge at Home. He will eat while you watch the room.');
  const count = socket.sent.filter(frame => frame.type === 'watch').length;
  await userEvent.click(screen.getByRole('button', { name: 'Back home', exact: true }));
  expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
  expect(socket.sent.filter(frame => frame.type === 'watch')).toHaveLength(count);
});
async function refusedLink(desktop=false){
  if(desktop)vi.spyOn(window,'matchMedia').mockImplementation(query=>({matches:query.includes('1100'),media:query,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}}));
  telegram.signIn();telegram.startWith('table_home-someone-else');
  fetchMock.route('/api/agents',{agents:[restingAgent]});
  render(<App/>);
  let socket;
  await waitFor(()=>{act(()=>{for(const s of socketMock.instances)if(s.readyState===0)s.open();});socket=socketMock.instances.find(s=>s.sent.some(m=>m.type==='watch'&&m.tableId==='home-someone-else'));expect(socket).toBeTruthy();});
  if(desktop)await screen.findByTestId('home-screen',{}, {timeout:5000});
  act(()=>socket.emit({type:'error',message:'This kitchen is private'}));
  return socket;
}
it.each([false,true])('BUG-161: cold private kitchen wire refusal is readable and Back home exits (desktop=%s)',async desktop=>{
  const socket=await refusedLink(desktop);
  expect(await screen.findByRole('alert')).toHaveTextContent('This kitchen is private');
  expect(screen.queryByText('LIVE',{exact:true})).not.toBeInTheDocument();
  expect(screen.queryByText(/SHUFFLING/)).not.toBeInTheDocument();
  await userEvent.click(screen.getByRole('button',{name:'Back home',exact:true}));
  expect(await screen.findByTestId('home-screen')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(socket.readyState).toBe(3);
});
it('BUG-161: a connection retry without server refusal retains the waiting camera',()=>{
  render(<WatchScreen game={null} connection="reconnecting" config={spectatorConfig} chatMessages={[]} displayNames={{}}/>);
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(document.querySelector('.watch-felt')).toBeTruthy();
});
it('BUG-161: an admitted snapshot after a retry replaces the refusal with the real game',async()=>{
  const socket=await refusedLink();
  expect(await screen.findByRole('alert')).toHaveTextContent('This kitchen is private');
  act(()=>{
    socket.emit({type:'watching',tableId:'home-someone-else',spectatorSeat:0});
    socket.emit({type:'state',state:{...midHandGame,tableId:'home-someone-else'},yourSeat:0,legalActions:[]});
  });
  await waitFor(()=>expect(document.querySelector('.watch-felt')).toBeTruthy());
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('BUG-161: an action error after a valid snapshot does not replace the live game',()=>{
  render(<WatchScreen game={midHandGame} error="That action is not legal" config={spectatorConfig} chatMessages={[]} displayNames={{}}/>);
  expect(document.querySelector('.watch-felt')).toBeTruthy();
  expect(screen.queryByRole('button',{name:'Back home',exact:true})).not.toBeInTheDocument();
});
