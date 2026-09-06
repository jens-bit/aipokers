// client/src/components/casino/TheFloor.test.jsx — CASINO-2 job 5, wave 58
//
// The floor as a room. The ref's four decisions, as assertions:
//
//   1. a felt is an ellipse with bodies on its rim, and its only label is its
//      stake — "a floor you have to read is a list"
//   2. a body is 14px of hood and two eyes, and yours is the one you can find
//      without looking
//   3. the room is never a map of all 1,600: six is the plan
//   4. the furniture is the point — the bar is why "not playing" has somewhere
//      to be, and the stairs are why the building has floors
//
// Plus the one thing the ref could not decide, because it hand-placed its six:
// where N felts go. floorPlan reproduces those six exactly, which is the test
// that this is a port and not a redesign.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { TheFloor, TinyGhost, floorPlan, seatAngle, FLOOR_CAP } from './TheFloor.jsx';
import { felt, myFelt } from '../../test/fixtures/rooms.js';

const felts = (c) => c.querySelectorAll('.csn-felt58');
const bodies = (c) => c.querySelectorAll('.csn-tiny');

describe('CASINO-2 job 5 · the plan', () => {
  // design-refs/mood-floor58.jsx, MINI_FELTS. If a later wave moves a felt,
  // this is the line that says so.
  const REF = [
    { x: 64, y: 108, r: 44 },
    { x: 190, y: 88, r: 40 },
    { x: 314, y: 112, r: 44 },
    { x: 70, y: 236, r: 42 },
    { x: 196, y: 220, r: 46 },
    { x: 320, y: 244, r: 40 },
  ];

  it('reproduces the ref\'s hand-placed six exactly', () => {
    expect(floorPlan(6)).toEqual(REF);
  });

  it('and the first N of them for a quieter room', () => {
    expect(floorPlan(3)).toEqual(REF.slice(0, 3));
    expect(floorPlan(1)).toEqual(REF.slice(0, 1));
  });

  it('is deterministic — a felt does not hop across the room when a pot changes', () => {
    expect(floorPlan(5)).toEqual(floorPlan(5));
  });

  it('never plans more than the room holds', () => {
    expect(floorPlan(40)).toHaveLength(FLOOR_CAP);
    expect(floorPlan(0)).toEqual([]);
    expect(floorPlan(NaN)).toEqual([]);
  });

  it('leaves the dealer a gap, centred on the bottom axis', () => {
    // Six seats, and none of them standing where the dealer stands.
    const angles = [0, 1, 2, 3, 4, 5].map((i) => seatAngle(i, 6));
    const straightDown = Math.PI / 2;
    for (const a of angles) {
      expect(Math.abs(((a - straightDown) % (Math.PI * 2)))).toBeGreaterThan(0.1);
    }
  });
});

describe('CASINO-2 job 5 · a body at floor scale', () => {
  it('is a hood and two eyes, and nothing else', () => {
    const { container } = render(<TinyGhost i={0} />);
    expect(container.querySelectorAll('path')).toHaveLength(1);
    expect(container.querySelectorAll('ellipse')).toHaveLength(2);
  });

  it('is 14px unless somebody says otherwise', () => {
    const { container } = render(<TinyGhost i={0} />);
    expect(container.querySelector('svg').getAttribute('width')).toBe('14');
  });

  it('a room of strangers reads as individuals, not as one repeated shape', () => {
    const { container } = render(<>{[0, 1, 2, 3].map((i) => <TinyGhost key={i} i={i} />)}</>);
    const fills = [...container.querySelectorAll('path')].map((p) => p.getAttribute('fill'));
    expect(new Set(fills).size).toBeGreaterThan(1);
  });

  it('and yours is teal, whatever hood the index would have given him', () => {
    const { container } = render(<TinyGhost i={3} mine />);
    const eyes = [...container.querySelectorAll('ellipse')].map((e) => e.getAttribute('fill'));
    expect(new Set(eyes)).toEqual(new Set(['#00D4AA']));
    expect(container.querySelector('svg').dataset.mine).toBe('true');
  });
});

describe('CASINO-2 job 5 · the room', () => {
  it('draws one felt per table, with a body per seat on its rim', () => {
    const { container } = render(<TheFloor felts={[felt({ seated: 4 })]} />);
    expect(felts(container)).toHaveLength(1);
    expect(bodies(container)).toHaveLength(4);
  });

  it('the only text on a felt is its stake', () => {
    const { container } = render(<TheFloor felts={[felt({ blinds: '25/50' })]} />);
    expect(felts(container)[0].textContent).toBe('25/50');
  });

  it('the pot is one gold dot, and only when there is money in the middle', () => {
    const { container: live } = render(<TheFloor felts={[felt({ pot: 900 })]} />);
    expect(live.querySelector('.csn-felt58__pot')).not.toBeNull();
    const { container: quiet } = render(<TheFloor felts={[felt({ pot: 0 })]} />);
    expect(quiet.querySelector('.csn-felt58__pot')).toBeNull();
  });

  it('a hot felt burns, and it is the only one that does', () => {
    const { container } = render(
      <TheFloor felts={[felt({ tableId: 'a', hot: true }), felt({ tableId: 'b' })]} />,
    );
    expect(container.querySelectorAll('.csn-felt58__heat')).toHaveLength(1);
    expect(container.querySelector('.csn-felt58[data-hot="true"]').dataset.table).toBe('a');
  });

  it('never draws more than the room holds', () => {
    const many = Array.from({ length: 12 }).map((_, i) => felt({ tableId: `t${i}` }));
    const { container } = render(<TheFloor felts={many} />);
    expect(felts(container)).toHaveLength(FLOOR_CAP);
  });

  it('has a bar and a set of stairs in it, because that is what makes it a room', () => {
    render(<TheFloor felts={[felt()]} />);
    expect(screen.getByText('THE BAR')).toBeInTheDocument();
    expect(screen.getByText('THE BOARD')).toBeInTheDocument();
  });

  it('the bar is empty unless somebody of yours is actually standing at it', () => {
    const { container: alone } = render(<TheFloor felts={[felt()]} />);
    expect(alone.querySelector('.csn-floor58__standing')).toBeNull();

    const { container: waiting } = render(
      <TheFloor felts={[felt()]} standing={[{ id: 'a1', name: 'The Clock' }]} />,
    );
    expect(waiting.querySelector('.csn-floor58__standing').children).toHaveLength(1);
  });

  it('marks his felt and his body on it', () => {
    const { container } = render(
      <TheFloor
        felts={[myFelt({ tableId: 'his' })]}
        mineAt={{ his: { id: 'agent_grinder', name: 'The Grinder' } }}
      />,
    );
    expect(container.querySelector('.csn-felt58[data-mine="true"]')).not.toBeNull();
    expect(container.querySelectorAll('.csn-tiny[data-mine="true"]')).toHaveLength(1);
  });

  it('scales the whole plan to the width it is given, so walkways stay walkways', () => {
    const { container } = render(<TheFloor felts={[felt()]} width={780} height={940} />);
    const room = container.querySelector('.csn-floor58__room');
    expect(room.style.transform).toBe('scale(2)');
    expect(room.style.width).toBe('390px');
  });

  it('a felt is a way into the table, and names whose it is', async () => {
    const onWatch = vi.fn();
    const user = userEvent.setup();
    render(
      <TheFloor
        felts={[myFelt({ tableId: 'his' })]}
        mineAt={{ his: { id: 'agent_grinder', name: 'The Grinder' } }}
        onWatch={onWatch}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Watch The Grinder at this table' }));
    expect(onWatch).toHaveBeenCalledWith('his');
  });

  it('and a stranger\'s felt is a way in too, just an anonymous one', async () => {
    const onWatch = vi.fn();
    const user = userEvent.setup();
    render(<TheFloor felts={[felt({ tableId: 't9' })]} onWatch={onWatch} />);
    await user.click(screen.getByRole('button', { name: 'Watch table t9' }));
    expect(onWatch).toHaveBeenCalledWith('t9');
  });

  it('an empty room draws its furniture and no felts', () => {
    const { container } = render(<TheFloor felts={[]} />);
    expect(felts(container)).toHaveLength(0);
    expect(screen.getByText('THE BAR')).toBeInTheDocument();
  });
});
