import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RosterRow } from './RosterSheet.jsx';
import { DeskRoster } from './desktop/DeskRoster.jsx';

const cast = [
  { id:'casino', name:'Balanced v2.1', location:{where:'table',room:'upstairs'}, liveGame:{tableId:'casino-1',blinds:'25/50',net:3694}, pocket:{balance:1200} },
  { id:'home', name:'Aggressive v1.3', location:{where:'home'}, routine:{key:'paces',label:'pacing'}, pocket:{balance:640}, sessionLog:[{net:-820}] },
  { id:'visit', name:'Bluff Master', visiting:{hostName:'Fidde'}, location:{where:'casino'}, homeTableId:'home-fidde', liveGame:{tableId:'home-fidde',blinds:'1/2',net:95}, pocket:{balance:410} },
  { id:'kitchen', name:'Value Bot', location:{where:'home'}, routine:{key:'plays',label:'in the home game'}, homeTableId:'home-owner', liveGame:{tableId:'home-owner',blinds:'1/2',net:70}, pocket:{balance:80} },
];
const expected = [
  ['at the casino','25/50'], ['at home','pacing'], ["visiting Fidde's",'1/2'], ['at your table','kitchen'],
];

describe('BUG-167: authored C5 whereabouts', () => {
  it.each(cast.map((agent,i)=>[agent,expected[i]]))('separates location and factual detail for $name', (agent,[where,detail]) => {
    const {container} = render(<RosterRow agent={agent} index={0}/>);
    expect(container.querySelector('.roster__where')).toHaveTextContent(where);
    expect(container.querySelector('.roster__where').textContent).toBe(where);
    expect(container.querySelector('.roster__routine')).toHaveTextContent(detail);
    expect(screen.getByRole('button')).toHaveAccessibleName(`${agent.name} — ${where} · ${detail}. Open his thread.`);
    expect(screen.getByText(agent.name)).toBeInTheDocument();
  });

  it('keeps unknown stakes absent and stale kitchen metadata from claiming current play', () => {
    const {container} = render(<>
      <RosterRow agent={{id:'unknown',name:'Visitor',visiting:{},location:{where:'casino'}}} index={0}/>
      <RosterRow agent={{id:'stale',name:'Home reader',location:{where:'home'},homeTableId:'ended',routine:{key:'reads',label:'reading'}}} index={1}/>
    </>);
    const [visitor,home] = container.querySelectorAll('.roster__row');
    expect(visitor.querySelector('.roster__where')).toHaveTextContent('visiting a friend');
    expect(visitor.querySelector('.roster__routine')).toBeNull();
    expect(visitor).toHaveAccessibleName('Visitor — visiting a friend. Open his thread.');
    expect(home.querySelector('.roster__where').textContent).toBe('at home');
    expect(home.querySelector('.roster__routine')).toHaveTextContent('reading');
    expect(within(home).getAllByText('—')).toHaveLength(2);
  });

  it('uses the desktop detail once while preserving wants and row navigation', async () => {
    const onSelect = vi.fn();
    const {container} = render(<DeskRoster agents={cast} onSelect={onSelect}/>);
    const rows = container.querySelectorAll('.dsk-roster-row');
    expect(rows[0].querySelector('.dsk-roster-place').textContent).toBe('at the casino');
    expect(rows[0].querySelector('.dsk-roster-row__line')).toHaveTextContent('25/50 · +$3,694');
    expect(rows[3].querySelector('.dsk-roster-place')).toHaveTextContent('at your table');
    expect(rows[3].querySelector('.dsk-roster-row__line').textContent).toBe('kitchen');
    await userEvent.setup().click(rows[3]);
    expect(onSelect).toHaveBeenCalledWith(cast[3]);
  });

  it('keeps the desktop want ahead of the routine detail', () => {
    render(<DeskRoster agents={[{...cast[1],want:{text:'May I have a beer?'}}]}/>);
    expect(screen.getByText(/May I have a beer/)).toBeInTheDocument();
    expect(screen.queryByText(/^pacing/)).toBeNull();
  });
});
