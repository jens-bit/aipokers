import { render, screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { DeskRoster } from './DeskRoster.jsx';

const agent={id:'a1',name:'Granite',identity:{hood:'sand',glow:'gold'},location:{where:'home'},homeTableId:'home-u1',liveGame:{tableId:'home-u1'},fatigue:'settled',mood:{state:'frustrated',heat:48},routine:{label:'in a hand'},careerStats:{net:9000},sessionLog:[{net:-200}]};
it('BUG-84 the desktop roster shows his room and actual session result, not lifetime profit',()=>{
  render(<DeskRoster agents={[agent]}/>);
  expect(screen.getByText(/at your table/i)).toBeInTheDocument();
  expect(screen.queryByText(/9,000/)).toBeNull();
  expect(screen.getByText(/−\$200/)).toBeInTheDocument();
});
it('C9 roster retains the saved identity and opens that agent',async()=>{
  const onSelect=vi.fn();
  const {container}=render(<DeskRoster agents={[agent]} onSelect={onSelect}/>);
  expect(container.querySelector('stop[stop-color="#6E5836"]')).not.toBeNull();
  await userEvent.click(screen.getByRole('button',{name:/Granite/}));
  expect(onSelect).toHaveBeenCalledWith(agent);
});
