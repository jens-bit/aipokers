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
  FOOTPRINTS, TV_SCREEN, TV_CHAIR, bodyRect, SIGN, DESK_ROOM,
} from './flat.js';

const at = (where, extra = {}) => ({ where, tableId: null, room: null, since: 0, ...extra });
const agent = (id, routine, location = at('home')) => ({
  id, name: id, location, routine: routine ? { key: routine, label: routine } : null,
});

describe('C9 · desktop room destinations', () => {
  it('keeps each resting body on the drawn couch and arrivals beside the door', () => {
    const positions = homePositions([agent('sleep', 'sleeps'), agent('away', null, at('casino')), agent('tape', 'tape')], { geometry: DESK_ROOM });
    const couch = DESK_ROOM.flat.couch;
    const sleeper = bodyRect(positions.get('sleep'), DESK_ROOM.bodySize);
    expect(sleeper.left).toBeGreaterThanOrEqual(couch.x);
    expect(sleeper.right).toBeLessThanOrEqual(couch.x + couch.w);
    expect(sleeper.top).toBeGreaterThanOrEqual(couch.y);
    expect(sleeper.bottom).toBeLessThanOrEqual(couch.y + couch.h);
    expect(positions.get('away').x).toBeLessThan(DESK_ROOM.flat.door.x);
    expect(positions.get('away').y).toBeGreaterThan(DESK_ROOM.flat.door.y);
    expect(positions.get('tape').x).toBe(DESK_ROOM.tvScreen.x + DESK_ROOM.tvScreen.w / 2);
    expect(positions.get('tape').y).toBeGreaterThan(DESK_ROOM.tvScreen.y + DESK_ROOM.tvScreen.h);
  });
  it('puts every live home player in a distinct chair around the actual table', () => {
    for (const count of [2, 3, 4]) {
      const ids = Array.from({ length: count }, (_, i) => String(i));
      const positions = [...homePositions(ids.map(id => agent(id)), { gameAgentIds: ids, geometry: DESK_ROOM }).values()];
      expect(new Set(positions.map(p => `${p.x},${p.y}`)).size).toBe(count);
      for (const p of positions) {
        expect(p.x).toBeGreaterThan(0);
        expect(p.x).toBeLessThan(DESK_ROOM.width);
        expect(p.y).toBeGreaterThan(DESK_ROOM.flat.table.cy - 100);
        expect(p.y).toBeLessThan(DESK_ROOM.flat.table.cy + 150);
      }
    }
  });
  it('uses the extra floor width when choosing a readable speech side', () => {
    expect(bubbleSide(390, DESK_ROOM.width)).toBe('right');
    expect(bubbleFits(390, 'right', DESK_ROOM.width)).toBe(true);
    expect(bubbleFits(520, 'right', DESK_ROOM.width)).toBe(false);
  });
});

describe('HOME-1 · the plan', () => {
  it('BUG-51: uses the reference room height and keeps the TV clear of the draft action', () => {
    expect(F_H).toBe(612);
    // First-agent invitation below the table: text and 44px action end by 420.
    expect(TV_SCREEN.y).toBeGreaterThan(420);
  });
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

// ── BUGS-C job 4 · the sign is one fixture with the door ────────────────────

describe('BUGS-C job 4: the CASINO sign', () => {
  it('BUGS-C-4 / C6: the sole sign occupies the doorway per current DoorTap', () => {
    // The current reference explicitly moved the word down the jamb; the old
    // non-overlap assertion described the superseded horizontal marquee.
    expect(SIGN).toEqual({x:FLAT.door.x,y:FLAT.door.y,w:FLAT.door.w,h:FLAT.door.h});
  });

  it('BUGS-C-4: no agent target point falls inside the sign rect', () => {
    for (const spot of ALL_SPOTS) {
      const inside = spot.x >= SIGN.x && spot.x <= SIGN.x + SIGN.w
        && spot.y >= SIGN.y && spot.y <= SIGN.y + SIGN.h;
      expect(inside, `${spot.x},${spot.y} is inside the sign`).toBe(false);
    }
  });

  it('BUGS-C-4: the sign is flush with the room the way the door is', () => {
    expect(SIGN.x + SIGN.w).toBe(F_W);
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
