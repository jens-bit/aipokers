import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AwayWall, plateLine } from './AwayWall.jsx';

it('BUG-73: a visiting agent is named at his friend’s home, not at the casino',async()=>{
  const ag={id:'v',name:'Bluff Master',nickname:'Bluff',visiting:{hostName:'Fidde'},location:{where:'casino',since:1}};
  expect(plateLine(ag)).toContain("Fidde's");
  const onOpenAgent=vi.fn(), onWatch=vi.fn();
  render(<AwayWall away={[ag]} accentFor={()=>'#00D4AA'} onOpenAgent={onOpenAgent} onWatch={onWatch}/>);
  await userEvent.setup().click(screen.getByRole('button',{name:/Bluff Master visiting Fidde/}));
  expect(onOpenAgent).toHaveBeenCalledWith(ag);
  expect(onWatch).not.toHaveBeenCalled();
});
