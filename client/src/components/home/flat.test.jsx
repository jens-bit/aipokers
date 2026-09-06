// client/src/components/home/flat.test.jsx — HOME-1
//
// The plan of the flat. Pure numbers, so these assert on the arithmetic the
// room is placed by rather than on rendered geometry — which is the whole
// reason flat.js has no React in it.

import { describe, expect, it } from 'vitest';
import {
  F_W, F_H, FLAT, TABLE_SEATS, tableSeats, homePositions,
  bubbleSide, bubbleFits, BUBBLE_W, ALL_SPOTS,
  COUCH_SPOT, TV_SPOT, DOOR_SPOT, WALL_SPOT,
  FOOTPRINTS, TV_SCREEN, TV_CHAIR, bodyRect,
} from './flat.js';

const at = (where, extra = {}) => ({ where, tableId: null, room: null, since: 0, ...extra });
const agent = (id, routine, location = at('home')) => ({
  id, name: id, location, routine: routine ? { key: routine, label: routine } : null,
});

describe('HOME-1 · the plan', () => {
  it('every fixture is inside the room', () => {
    for (const [name, f] of Object.entries(FLAT)) {
      if (f.cx !== undefined) {
        expect(f.cx - f.rx, name).toBeGreaterThanOrEqual(0);
        expect(f.cx + f.rx, name).toBeLessThanOrEqual(F_W);
        continue;
      }
      expect(f.x, name).toBeGreaterThanOrEqual(0);
      expect(f.y, name).toBeGreaterThanOrEqual(0);
      expect(f.x + f.w, name).toBeLessThanOrEqual(F_W);
      expect(f.y + f.h, name).toBeLessThanOrEqual(F_H);
    }
  });

  it('a table seat is a place at the table, not on it', () => {
    // The far-side seat's feet land on the top rim and the near-side seat's
    // just past the bottom one. That IS what sitting looks like from above.
    const [near, far] = TABLE_SEATS[2];
    expect(near.y).toBeGreaterThan(FLAT.table.cy + FLAT.table.ry - 1);
    expect(far.y).toBeGreaterThanOrEqual(FLAT.table.cy - FLAT.table.ry);
    expect(far.y).toBeLessThan(FLAT.table.cy);
  });

  it('seat sets are clamped to what the table has', () => {
    expect(tableSeats(1)).toHaveLength(2);
    expect(tableSeats(9)).toHaveLength(4);
    expect(tableSeats(3)).toHaveLength(3);
  });
});

// ── HOME-2 job 4 · the fixtures, on the ref's own coordinates ───────────────

describe('HOME-2 job 4 · what is on the walls', () => {
  // Verbatim from design-refs/mood-home.jsx's FLAT. The safe and the fridge
  // used to be placed by hand with a note to replace them when the ref landed.
  it('is the ref plan, number for number', () => {
    expect(FLAT.safe).toEqual({ x: 16, y: 94, w: 60, h: 50 });
    expect(FLAT.fridge).toEqual({ x: 250, y: 94, w: 54, h: 86 });
    expect(FLAT.door).toEqual({ x: 356, y: 152, w: 34, h: 112 });
    // The tape room is a band measured up from the floor, which is how the ref
    // writes it: `y: F_H - 126`.
    expect(FLAT.tv).toEqual({ x: 244, y: F_H - 126, w: 132, h: 112 });
  });

  it('the door is cut INTO the right wall, not floating in the room', () => {
    expect(FLAT.door.x + FLAT.door.w).toBe(F_W);
  });

  it('the safe is on the left and the fridge is not', () => {
    expect(FLAT.safe.x + FLAT.safe.w).toBeLessThan(F_W / 2);
    expect(FLAT.fridge.x).toBeGreaterThan(F_W / 2);
    // Both hang under the wall band the frames are on, which is what "on the
    // wall" means in a room seen from above.
    for (const f of [FLAT.safe, FLAT.fridge]) {
      expect(f.y).toBeGreaterThanOrEqual(FLAT.wall.y + FLAT.wall.h);
    }
  });

  it('the television is at the bottom, and there is only one of it', () => {
    expect(FLAT.tv.y).toBeGreaterThan(F_H * 0.6);
    // The chair is below the screen it faces, and both are inside the room.
    expect(TV_CHAIR.y).toBeGreaterThan(TV_SCREEN.y + TV_SCREEN.h);
    expect(TV_CHAIR.y + TV_CHAIR.h).toBeLessThanOrEqual(F_H);
    expect(TV_SCREEN.x + TV_SCREEN.w).toBeLessThanOrEqual(F_W);
  });

  // The bug this catches is the one that put a man's head inside the old set:
  // the furniture and the people lived in separate systems and drifted apart.
  it('nobody stands inside the furniture', () => {
    for (const spot of ALL_SPOTS) {
      const body = bodyRect(spot, 50);   // the seated size, the larger of the two
      for (const [name, f] of Object.entries(FOOTPRINTS)) {
        // The couch is the one fixture a body is MEANT to be inside: he sits
        // on it. Everything else he stands clear of.
        if (name === 'couch') continue;
        const box = { left: f.x, right: f.x + f.w, top: f.y, bottom: f.y + f.h };
        const hit = body.left < box.right && box.left < body.right
          && body.top < box.bottom && box.top < body.bottom;
        expect(hit, `a body at ${spot.x},${spot.y} is inside the ${name}`).toBe(false);
      }
    }
  });

  // Nothing clips at 390 wide. A body is 50px of ghost centred on his own x,
  // and the room has overflow: hidden, so a body over the edge is cut in
  // silence rather than reported.
  it('nothing a body carries leaves the room', () => {
    for (const spot of ALL_SPOTS) {
      const body = bodyRect(spot, 50);
      expect(body.left, `x=${spot.x}`).toBeGreaterThanOrEqual(0);
      expect(body.right, `x=${spot.x}`).toBeLessThanOrEqual(F_W);
      expect(body.top, `y=${spot.y}`).toBeGreaterThanOrEqual(0);
      expect(body.bottom, `y=${spot.y}`).toBeLessThanOrEqual(F_H);
    }
  });

  // The tape room's chair is where the man watching it sits — the ref's own
  // STAND.tape, below the screen rather than in front of the old corner set.
  it('the tape spot is the chair, in front of the television', () => {
    expect(TV_SPOT.x).toBeGreaterThanOrEqual(TV_CHAIR.x);
    expect(TV_SPOT.x).toBeLessThanOrEqual(TV_CHAIR.x + TV_CHAIR.w);
    expect(TV_SPOT.y).toBeGreaterThan(TV_SCREEN.y + TV_SCREEN.h);
  });
});

describe('HOME-1 · bubbles flip rather than clip', () => {
  it('a body near the right wall opens its bubble to the left', () => {
    expect(bubbleSide(DOOR_SPOT.x)).toBe('left');
    expect(bubbleSide(60)).toBe('right');
  });

  it('every place a body can stand has room for its bubble', () => {
    for (const spot of ALL_SPOTS) {
      expect(bubbleFits(spot.x), `x=${spot.x}`).toBe(true);
    }
  });

  it('the bubble is narrower than the room, or nothing above could be true', () => {
    expect(BUBBLE_W).toBeLessThan(F_W);
  });
});

describe('HOME-1 · placing the household', () => {
  it('a routine with a place of its own happens there', () => {
    const positions = homePositions([
      agent('sleeper', 'sleeps'),
      agent('student', 'tape'),
      agent('waiter', 'waits'),
      agent('sulker', 'sulks'),
    ]);
    expect(positions.get('sleeper')).toMatchObject({ ...COUCH_SPOT, spot: 'sleeps' });
    expect(positions.get('student')).toMatchObject({ ...TV_SPOT, spot: 'tape' });
    expect(positions.get('waiter')).toMatchObject({ ...DOOR_SPOT, spot: 'waits' });
    expect(positions.get('sulker')).toMatchObject({ ...WALL_SPOT, spot: 'sulks' });
  });

  it('the idle habits take the open floor, in a stable order', () => {
    const roster = [agent('a', 'paces'), agent('b', 'reads'), agent('c', 'counts')];
    const first = homePositions(roster);
    const again = homePositions(roster);
    expect([...first.entries()]).toEqual([...again.entries()]);
    expect(first.get('a').spot).toBe('floor:0');
    expect(first.get('b').spot).toBe('floor:1');
    expect(first.get('c').spot).toBe('floor:2');
  });

  it('a seat at the home game beats whatever else he was doing', () => {
    const positions = homePositions(
      [agent('a', 'paces'), agent('b', 'sleeps')],
      { gameAgentIds: ['a', 'b'] },
    );
    expect(positions.get('a').spot).toBe('table:0');
    expect(positions.get('b').spot).toBe('table:1');
    expect(positions.get('b').seat).toBe(1);
  });

  it('an agent who is out stands at the door — that is where he walks from', () => {
    const positions = homePositions([
      agent('out', null, at('table', { tableId: 't1', room: 'floor' })),
    ]);
    expect(positions.get('out')).toMatchObject({ ...DOOR_SPOT, spot: 'door:away' });
  });

  it('every agent gets a position — a body with no coordinate renders on the wall', () => {
    const roster = Array.from({ length: 8 }, (_, i) => agent(`a${i}`, null));
    const positions = homePositions(roster);
    expect(positions.size).toBe(8);
    for (const [, p] of positions) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('the same agent never gets two places', () => {
    const positions = homePositions([agent('a', 'sleeps')], { gameAgentIds: ['a'] });
    expect(positions.size).toBe(1);
    expect(positions.get('a').spot).toBe('table:0');
  });
});

describe('HOME-1 · a walk is a change of PLACE', () => {
  // The screen animates on `spot`, not on coordinates. These are the three
  // transitions the brief names, expressed the way useWalks reads them.
  it('couch → table when the home game starts', () => {
    const roster = [agent('a', 'sleeps'), agent('b', 'paces')];
    const before = homePositions(roster);
    const after = homePositions(roster, { gameAgentIds: ['a', 'b'] });
    expect(before.get('a').spot).toBe('sleeps');
    expect(after.get('a').spot).toBe('table:0');
    expect(before.get('a').spot).not.toBe(after.get('a').spot);
  });

  it('out the door when he is sent', () => {
    const home = homePositions([agent('a', 'paces')]);
    const sent = homePositions([agent('a', null, at('table', { tableId: 't1' }))]);
    expect(home.get('a').spot).toBe('floor:0');
    expect(sent.get('a').spot).toBe('door:away');
  });

  it('in from the door when he comes home', () => {
    const away = homePositions([agent('a', null, at('table', { tableId: 't1' }))]);
    const back = homePositions([agent('a', 'waits')]);
    expect(away.get('a').spot).toBe('door:away');
    expect(back.get('a').spot).toBe('waits');
  });

  it('standing still is not a walk', () => {
    const roster = [agent('a', 'reads')];
    expect(homePositions(roster).get('a').spot).toBe(homePositions(roster).get('a').spot);
  });
});
