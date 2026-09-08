import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { TableChairs } from './HomeGame.jsx';
import { tableSeats } from './flat.js';

it('BUG-72: spare chairs do not sit underneath the two seated bodies', () => {
  const {container}=render(<TableChairs taken={2} of={4}/>);
  const seats=tableSeats(2);
  const chairs=[...container.querySelectorAll('.home-chair')];
  expect(chairs).toHaveLength(2);
  for(const chair of chairs){
    const x=parseFloat(chair.style.left),y=parseFloat(chair.style.top);
    expect(seats.every(s=>Math.hypot(s.x-x,s.y-y)>32)).toBe(true);
  }
});
it('C6: an away agent has one named empty chair and no extra chair', () => {
  const {container}=render(<TableChairs taken={2} of={4} away={[{id:'bal',name:'Balanced v2.1',nickname:'Bal'}]}/>);
  expect(screen.getByLabelText("Bal's empty chair")).toBeInTheDocument();
  expect(container.querySelectorAll('.home-chair')).toHaveLength(2);
});
it('empty and full households keep their actual chair counts',()=>{
  const {container,rerender}=render(<TableChairs taken={0} of={1}/>);
  expect(container.querySelectorAll('.home-chair')).toHaveLength(1);
  rerender(<TableChairs taken={4} of={4}/>);
  expect(container.querySelectorAll('.home-chair')).toHaveLength(0);
});
