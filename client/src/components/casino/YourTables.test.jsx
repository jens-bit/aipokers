// client/src/components/casino/YourTables.test.jsx — CASINO-2 job 4
//
// One page per man, and the rule that took the work: NEVER A PLACEHOLDER
// GHOST. The ref is explicit — "a miniature of a game he is not in would be
// the one outright lie on the screen" — so a man who is not at a felt gets a
// page that says where he actually is, and no felt is drawn for him at all.
//
// The flick itself is the browser's (scroll-snap), so what is asserted here is
// the structure it snaps through and the dots that report where it landed.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { YourTables, whereLine } from './YourTables.jsx';
import { myFelt, felt } from '../../test/fixtures/rooms.js';
import { playingAgent, restingAgent } from '../../test/fixtures/agents.js';

// The fixture roster's playing agent sits at 'tbl-fixture'; the felt fixture
// that has him in a seat is 'tbl-mine'. His liveGame is the field feltForAgent
// asks first — it is the one the server says he is genuinely playing at — so
// both have to move for him to be at the other table.
const atFelt = {
  ...playingAgent,
  activeTableId: 'tbl-mine',
  liveGame: { ...playingAgent.liveGame, tableId: 'tbl-mine' },
};
const pages = () => [...document.querySelectorAll('.csn-your__page')];
const dots = () => screen.getAllByRole('tab');

describe('CASINO-2 job 4 · a page is a man', () => {
  it('one page per agent, in roster order', () => {
    render(<YourTables agents={[atFelt, restingAgent]} felts={[myFelt()]} />);
    expect(pages().map((p) => p.dataset.agent)).toEqual([atFelt.id, restingAgent.id]);
  });

  it('and one dot per page, the first one on', () => {
    render(<YourTables agents={[atFelt, restingAgent]} felts={[myFelt()]} />);
    expect(dots()).toHaveLength(2);
    expect(dots()[0]).toHaveAttribute('aria-selected', 'true');
    expect(dots()[1]).toHaveAttribute('aria-selected', 'false');
  });

  it('a single man needs no dots — there is nowhere to flick to', () => {
    render(<YourTables agents={[atFelt]} felts={[myFelt()]} />);
    expect(screen.queryAllByRole('tab')).toHaveLength(0);
    expect(pages()).toHaveLength(1);
  });

  it('an empty roster says so rather than drawing an empty felt', () => {
    render(<YourTables agents={[]} felts={[]} />);
    expect(screen.getByText('You have nobody in the building yet.')).toBeInTheDocument();
    expect(document.querySelector('.csn-felt')).toBeNull();
  });

  it('a dot moves the carousel to its man', async () => {
    const user = userEvent.setup();
    render(<YourTables agents={[atFelt, restingAgent]} felts={[myFelt()]} />);
    // jsdom has no layout and no scrollTo at all — the component falls back to
    // scrollLeft rather than throwing (CI #82; nothing here stubs it, because
    // a carousel that needs a stub to survive is a carousel that breaks on any
    // scroller without smooth behaviour). What is asserted is that the control
    // reports the page it moved to, which is what a dot is for.
    await user.click(dots()[1]);
    expect(dots()[1]).toHaveAttribute('aria-selected', 'true');
    expect(dots()[0]).toHaveAttribute('aria-selected', 'false');
  });
});

describe('CASINO-2 job 4 · his page is his real game', () => {
  it('draws the live felt he is actually at', () => {
    render(<YourTables agents={[atFelt]} felts={[myFelt({ pot: 940 })]} />);
    const page = pages()[0];
    expect(within(page).getByText('YOUR TABLE · 10/20')).toBeInTheDocument();
    expect(within(page).getByText('$940')).toBeInTheDocument();
    expect(within(page).getByText('The Grinder')).toBeInTheDocument();
  });

  it('and never somebody else\'s — a felt he is not at is not his page', () => {
    // 'tbl-fixture' is running and he is not in a seat at it.
    const elsewhere = {
      ...playingAgent,
      activeTableId: 'tbl-nowhere',
      liveGame: { ...playingAgent.liveGame, tableId: 'tbl-nowhere' },
    };
    render(<YourTables agents={[elsewhere]} felts={[felt()]} />);
    expect(document.querySelector('.csn-felt')).toBeNull();
  });

  it('tapping it watches his table', async () => {
    const onWatch = vi.fn();
    const user = userEvent.setup();
    render(<YourTables agents={[atFelt]} felts={[myFelt()]} onWatch={onWatch} />);
    await user.click(screen.getByRole('button', { name: /Watch The Grinder at 10\/20/ }));
    expect(onWatch).toHaveBeenCalledWith('tbl-mine');
  });
});

describe('CASINO-2 job 4 · never a placeholder ghost', () => {
  it('a man who is not at a felt gets a page that says where he is', () => {
    render(<YourTables agents={[restingAgent]} felts={[myFelt()]} />);
    expect(document.querySelector('.csn-felt')).toBeNull();
    expect(document.querySelector('.csn-your__away')).not.toBeNull();
    expect(screen.getByText(/Loose Cannon is /)).toBeInTheDocument();
  });

  it('and an offer to send him, when there is somewhere to send him from', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    render(<YourTables agents={[restingAgent]} felts={[]} onSend={onSend} />);
    await user.click(screen.getByRole('button', { name: 'SEND HIM TO PLAY' }));
    expect(onSend).toHaveBeenCalledWith(restingAgent);
  });

  it('the line is specific — "resting" is the same sentence on every empty page', () => {
    expect(whereLine({ pocket: { balance: 0, broke: true } })).toBe('his pocket is empty');
    expect(whereLine({ location: { where: 'casino' } })).toBe('in the casino, looking for a seat');
    expect(whereLine({ routine: { label: 'at the fridge' } })).toBe('at home · at the fridge');
    expect(whereLine({ fatigue: 'worn' })).toBe('at home · worn out');
    expect(whereLine({})).toBe('at home, waiting to be sent');
  });

  it('a mixed roster draws a felt for the one at a table and a page for the one who is not', () => {
    render(<YourTables agents={[atFelt, restingAgent]} felts={[myFelt()]} />);
    expect(document.querySelectorAll('.csn-felt')).toHaveLength(1);
    expect(document.querySelectorAll('.csn-your__away')).toHaveLength(1);
  });
});
