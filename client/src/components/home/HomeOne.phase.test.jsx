import { render } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeOne } from './atoms.jsx';
import '../../styles/home1.css';

const agent=id=>({id,name:'Same name',routine:{key:'paces'},mood:{state:'neutral',heat:30}});
const at={x:140,y:400,spot:'floor'};
const phase=node=>Number.parseFloat(node.style.getPropertyValue('--home-idle-phase'));

it('HOME-2: simultaneous idles start at distinct stable phases for each agent identity',()=>{
  const {container,rerender}=render(<><HomeOne agent={agent('one')} at={at}/><HomeOne agent={agent('two')} at={at}/></>);
  const original=[...container.querySelectorAll('.home-one')].map(phase);
  expect(original.every(value=>value<0&&value>=-4000)).toBe(true);
  expect(original[0]).not.toBe(original[1]);
  rerender(<><HomeOne agent={{...agent('two'),name:'Renamed',mood:{state:'tilted',heat:80}}} at={{...at,x:200}}/><HomeOne agent={agent('one')} at={at}/></>);
  expect([...container.querySelectorAll('.home-one')].map(phase)).toEqual([original[1],original[0]]);
});

it('HOME-2: idle phase never offsets a walking, carried or departing body',()=>{
  const {container,rerender}=render(<HomeOne agent={agent('walker')} at={at}/>);
  const idle=phase(container.querySelector('.home-one'));
  expect(idle).toBeLessThan(0);
  for(const change of [{walking:true},{carried:{x:180,y:350}},{away:true}]) {
    rerender(<HomeOne agent={agent('walker')} at={at} {...change}/>);
    expect(phase(container.querySelector('.home-one'))).toBe(0);
  }
  rerender(<HomeOne agent={agent('walker')} at={at}/>);
  expect(phase(container.querySelector('.home-one'))).toBe(idle);
});
