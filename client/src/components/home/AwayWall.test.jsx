import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AwayWall, plateLine } from './AwayWall.jsx';

it('BUG-162: a visiting Home frame never reports practice chips as a money result',()=>{
  expect(plateLine({homeTableId:'kitchen',liveGame:{tableId:'kitchen',net:75},pocket:{sessionNet:900},visiting:{hostName:'Fidde'}})).toBe("Fidde's");
});

it('BUG-73: a visiting agent is named at his friend’s home, not at the casino',async()=>{
  const ag={id:'v',name:'Bluff Master',nickname:'Bluff',visiting:{hostName:'Fidde'},location:{where:'casino',since:1}};
  expect(plateLine(ag)).toContain("Fidde's");
  const onOpenAgent=vi.fn(), onWatch=vi.fn();
  render(<AwayWall away={[ag]} accentFor={()=>'#00D4AA'} onOpenAgent={onOpenAgent} onWatch={onWatch}/>);
  await userEvent.setup().click(screen.getByRole('button',{name:/Bluff Master visiting Fidde/}));
  expect(onOpenAgent).toHaveBeenCalledWith(ag);
  expect(onWatch).not.toHaveBeenCalled();
});

// BUG190: current AwayFrame uses the same compact policy as Home's small name
// surfaces. Its accessible identity and callback still carry the full agent.
describe('BUG-190: the AwayFrame plate has a compact name and a full destination',()=>{
  it.each([
    ['Big Slick',null,'Big Sl'],
    ['The Clock',null,'The Cl'],
    ['The Grinder',null,'The Gr'],
    ['Bluff Master Supreme',null,'Bluff'],
    ['Loose Cannon','Cannon','Cannon'],
    ['Aggressive v1.3','Hothead','Hothea'],
    ['Rocky','Rock','Rocky'],
  ])('writes %s with saved nickname %s as %s',async(name,nickname,expected)=>{
    const agent={id:'away',name,nickname,location:{where:'casino'}};
    const onOpenAgent=vi.fn(),onWatch=vi.fn();
    render(<AwayWall away={[agent]} accentFor={()=>'#00D4AA'} onOpenAgent={onOpenAgent} onWatch={onWatch}/>);
    const frame=screen.getByRole('button',{name:`${name} at the casino. Open him.`,exact:true});
    expect(frame.querySelector('.home-frame__name')).toHaveTextContent(new RegExp(`^${expected}$`));
    expect(frame.querySelector('.home-frame__name').textContent).not.toContain('…');
    await userEvent.setup().click(frame);
    expect(onOpenAgent).toHaveBeenCalledTimes(1);
    expect(onOpenAgent).toHaveBeenCalledWith(agent);
    expect(onWatch).not.toHaveBeenCalled();
  });

  it('keeps duplicate compact prefixes independently accessible and opens each actual table',async()=>{
    const agents=[
      {id:'oak',name:'Professor Oak',location:{where:'casino'},liveGame:{tableId:'table-oak'}},
      {id:'plum',name:'Professor Plum',location:{where:'casino'},liveGame:{tableId:'table-plum'}},
    ];
    const onOpenAgent=vi.fn(),onWatch=vi.fn();
    render(<AwayWall away={agents} accentFor={()=>'#00D4AA'} onOpenAgent={onOpenAgent} onWatch={onWatch}/>);
    for(const [index,agent] of agents.entries()){
      const frame=screen.getByRole('button',{name:`${agent.name} at the casino. Watch him.`,exact:true});
      expect(frame.querySelector('.home-frame__name')).toHaveTextContent(/^Profes$/);
      await userEvent.setup().click(frame);
      expect(onWatch).toHaveBeenNthCalledWith(index+1,agent);
    }
    expect(onWatch).toHaveBeenCalledTimes(2);
    expect(onOpenAgent).not.toHaveBeenCalled();
  });
});
