import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { HomeOne } from './atoms.jsx';
const base={id:'a1',name:'Bal',location:{where:'home'},mood:{state:'neutral',heat:20},fatigue:'fresh',routine:{key:'reads'}};
describe('BUG-135: the authored carry states use one body',()=>{
  it.each([
    ['rested',{},'Where are we going?','rest','-4deg','2.6s'],
    ['worn',{fatigue:'worn'},'Fine. Carry me.','rest','-14deg','4.2s'],
    ['hot',{mood:{state:'tilted',heat:84}},'Put me down.','clench','6deg','0.9s'],
  ])('%s has its own voice, tilt and float',(state,over,line,pose,tilt,bob)=>{
    const {container}=render(<HomeOne agent={{...base,...over}} at={{x:190,y:300}} carried={{x:360,y:260,over:'door'}} bubble={{text:'An old room line',side:'right'}}/>);
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.queryByText('An old room line')).toBeNull();
    expect(container.querySelector('.home-one')).toHaveAttribute('data-carry-state',state);
    expect(container.querySelector('.home-one__figure').style.getPropertyValue('--carry-tilt')).toBe(tilt);
    expect(container.querySelector('.home-one__figure').style.getPropertyValue('--carry-bob')).toBe(bob);
    expect(container.querySelector('.home-one__hands [data-pose]')).toHaveAttribute('data-pose',pose);
    expect(container.querySelector('.home-carry-shadow')).toBeTruthy();
    expect(container.querySelector('.home-one__body').style.width).toBe('62px');
    expect(container.querySelector('.home-prop')).toBeNull();
  });
});