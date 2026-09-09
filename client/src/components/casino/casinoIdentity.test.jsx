import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { normalizeFelts } from '../../hooks/useCasinoRooms.js';
import { TinyGhost } from './TheFloor.jsx';
import { TableFelt } from './TableFelt.jsx';
import { DeployTray } from './CasinoBuilding.jsx';
import { HOODS, GLOWS } from '../../lib/identity.js';
const identity={hood:'oxblood',glow:'ice'};
const hood=HOODS.find(h=>h.id===identity.hood),glow=GLOWS.find(g=>g.id===identity.glow);
function appearance(svg){
  expect(svg).toHaveAttribute('data-hood',identity.hood);
  expect(svg.querySelector('linearGradient stop')).toHaveAttribute('stop-color',hood.top);
  expect(svg.querySelector('radialGradient stop')).toHaveAttribute('stop-color',glow.c);
}
it('BUG-111: saved floor identity survives table position, heat and ownership changes',()=>{
  const {container,rerender}=render(<TinyGhost identity={identity} i={1}/>);
  for(const props of [{i:1},{i:85,hot:true,mine:true}]){
    rerender(<TinyGhost identity={identity} {...props}/>);
    expect(container.querySelector('svg')).toHaveAttribute('data-hood',identity.hood);
    expect(container.querySelector('path')).toHaveAttribute('fill',hood.top);
    expect(container.querySelector('ellipse')).toHaveAttribute('fill',glow.c);
  }
});
it('BUG-111: miniature table keeps saved identity when changing the watched seat',()=>{
  const felt={tableId:'identity',seats:[{seat:0,agentId:'a',name:'A',identity},{seat:1,agentId:'b',name:'B',identity}],pot:0};
  const {container,rerender}=render(<TableFelt felt={felt} agentId="a"/>);
  for(const agentId of ['a','b',null]){
    rerender(<TableFelt felt={felt} agentId={agentId}/>);
    const ghosts=container.querySelectorAll('svg.mood-ghost');expect(ghosts).toHaveLength(2);ghosts.forEach(appearance);
  }
});
it('BUG-111: the carried agent keeps his birth appearance in the casino tray',()=>{
  const {container}=render(<DeployTray agent={{id:'a',name:'A',identity}} affordable={false}/>);
  appearance(container.querySelector('svg.mood-ghost'));
});

it('BUG-111: room normalization retains palette IDs without copying stored metadata',()=>{
  const raw=[{tableId:'a',seats:[{identity:{...identity,privateNote:'hidden'}},{}]}];
  const seats=normalizeFelts(raw)[0].seats;
  expect(seats[0].identity).toEqual(identity);expect(seats[1].identity).toBeNull();
});
