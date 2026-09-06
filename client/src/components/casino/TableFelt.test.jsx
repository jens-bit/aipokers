// client/src/components/casino/TableFelt.test.jsx — CASINO-2 job 4
//
// A real game, in miniature. The ref's reason for it is the assertion this
// file keeps coming back to: "a lone ghost with three cards floating beside
// him was a picture OF poker rather than a view of his hand". So nothing on
// this felt may be decoration — every body is a seat the table has, every card
// has been dealt, the pot is the money in the middle, and the ring on a body
// is whose turn it is.
//
// And the fish-tank law at this size: his own two face up, everybody else's
// face down. The felt payload does not carry another man's cards at all, so
// the law is enforced on the wire and only drawn here — which is what the last
// block checks.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TableFelt, ringOf, heroSeatOf, MINI_RING } from './TableFelt.jsx';
import { felt, myFelt, feltSeat } from '../../test/fixtures/rooms.js';

const ghosts = (c) => c.querySelectorAll('svg.mood-ghost');
// The board row and his own pair are marked, because "what is drawn face up
// and where" is the one thing about this felt with a law attached to it.
const board = (c) => c.querySelector('[data-board]');
const hole = (c) => c.querySelector('[data-hole]');

describe('CASINO-2 job 4 · the ring', () => {
  it('is everybody at the table except him', () => {
    const ring = ringOf(myFelt(), 2);
    expect(ring.map((s) => s.seat)).toEqual([0]);
  });

  it('starts at the seat after his, so the man on his left is on his left', () => {
    const seats = [0, 1, 2, 3, 4].map((seat) => feltSeat({ seat }));
    const ring = ringOf(felt({ seats }), 2);
    expect(ring.map((s) => s.seat)).toEqual([3, 4, 0, 1]);
  });

  it('never asks for more places than the ring has', () => {
    const seats = Array.from({ length: 9 }).map((_, seat) => feltSeat({ seat }));
    expect(ringOf(felt({ seats }), 0)).toHaveLength(MINI_RING.length);
  });

  it('finds his seat by his agent id, and says so when he is not at this table', () => {
    expect(heroSeatOf(myFelt(), 'agent_grinder')).toBe(2);
    expect(heroSeatOf(myFelt(), 'agent_other')).toBeNull();
    expect(heroSeatOf(myFelt(), null)).toBeNull();
  });
});

describe('CASINO-2 job 4 · nothing on the felt is invented', () => {
  it('draws one body per seat the table actually has', () => {
    const { container } = render(<TableFelt felt={myFelt()} agentId="agent_grinder" />);
    // Two seats on the fixture: him, and one opponent.
    expect(ghosts(container)).toHaveLength(2);
  });

  it('draws the board as far as it has run and no further', () => {
    const { container } = render(<TableFelt felt={felt({ board: ['Ah', 'Kd'] })} />);
    expect(board(container).children).toHaveLength(2);
  });

  it('and no board at all before the flop', () => {
    const { container } = render(<TableFelt felt={felt({ board: [], street: 'preflop' })} />);
    expect(board(container)).toBeNull();
  });

  it('a felt between hands has nothing in the middle, and says so by drawing nothing', () => {
    render(<TableFelt felt={felt({ pot: 0, board: [], street: 'waiting' })} />);
    expect(screen.queryByText('POT')).not.toBeInTheDocument();
  });

  it('the money in the middle is the money in the middle', () => {
    render(<TableFelt felt={felt({ pot: 4_180 })} />);
    expect(screen.getByText('POT')).toBeInTheDocument();
    expect(screen.getByText('$4,180')).toBeInTheDocument();
  });

  it('the one to act carries the only ring on the felt', () => {
    render(<TableFelt felt={myFelt({ toAct: 0 })} agentId="agent_grinder" />);
    expect(screen.getAllByText('TO ACT')).toHaveLength(1);
  });

  it('and nobody carries it when nobody is to act', () => {
    render(<TableFelt felt={myFelt({ toAct: null })} agentId="agent_grinder" />);
    expect(screen.queryByText('TO ACT')).not.toBeInTheDocument();
  });

  it('names him at his own seat', () => {
    render(<TableFelt felt={myFelt()} agentId="agent_grinder" />);
    expect(screen.getByText('The Grinder')).toBeInTheDocument();
  });

  it('a felt with no live table behind it draws nothing at all', () => {
    const { container } = render(<TableFelt felt={null} agentId="agent_grinder" />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('CASINO-2 job 4 · the fish-tank law, at this size', () => {
  it('his own two are face up when the roster gave them to us', () => {
    const { container } = render(
      <TableFelt felt={myFelt()} agentId="agent_grinder" heroHole={['As', 'Kh']} />,
    );
    const his = hole(container);
    expect(his.dataset.hole).toBe('up');
    expect(his.children).toHaveLength(2);
    expect(his.textContent).toContain('A');
    expect(his.textContent).toContain('K');
  });

  it('and are backs when they were withheld — he IS holding two', () => {
    const { container } = render(
      <TableFelt felt={myFelt()} agentId="agent_grinder" heroHole={null} />,
    );
    const his = hole(container);
    expect(his.dataset.hole).toBe('down');
    expect(his.children).toHaveLength(2);
    // A back carries no rank, which is the whole of "we do not know them".
    expect(his.textContent).toBe('');
  });

  it('nobody else\'s cards can leak, because the payload does not carry them', () => {
    const payload = JSON.stringify(myFelt());
    expect(payload).not.toMatch(/holeCards|heroHole/);
  });
});

describe('CASINO-2 job 4 · a felt you can go to', () => {
  it('is a button when there is somewhere to go', async () => {
    const onWatch = vi.fn();
    const user = userEvent.setup();
    render(<TableFelt felt={myFelt({ tableId: 'tbl-9' })} agentId="agent_grinder" onWatch={onWatch} />);
    await user.click(screen.getByRole('button'));
    expect(onWatch).toHaveBeenCalledWith('tbl-9');
  });

  it('and a picture when there is not', () => {
    render(<TableFelt felt={myFelt()} agentId="agent_grinder" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('marks a hot felt and one of yours, so the room can style them', () => {
    const { container } = render(
      <TableFelt felt={myFelt({ hot: true })} agentId="agent_grinder" />,
    );
    const el = container.querySelector('.csn-felt');
    expect(el.dataset.hot).toBe('true');
    expect(el.dataset.mine).toBe('true');
    expect(el.dataset.table).toBe('tbl-mine');
  });
});
