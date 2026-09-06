// client/src/components/home/carry.test.jsx — HOME-2 job 5
//
// Where you can put him down. Pure arithmetic about the plan, so this asks the
// question a thumb asks — "what is under this point" — without a browser, a
// pointer or a room.

import { describe, expect, it } from 'vitest';

import {
  DROP_PAD, DROP_TARGETS, LONG_PRESS_MS, PRESS_SLOP,
  clampToRoom, fixtureAt, midHand, toRoom, verbFor,
} from './carry.js';
import { FLAT, TV_SCREEN, F_W, F_H } from './flat.js';

const centre = (box) => ({ x: box.x + box.w / 2, y: box.y + box.h / 2 });

describe('HOME-2 job 5 · the five things you can drop him on', () => {
  it('is five, and the safe is not one of them', () => {
    const names = DROP_TARGETS.map((t) => t.fixture);
    expect(names.sort()).toEqual(['couch', 'door', 'fridge', 'table', 'tv']);
    // Dropping a man on the money is the one gesture in this room that would
    // read as spending him.
    expect(names).not.toContain('safe');
  });

  it('every fixture catches a drop on its own middle', () => {
    expect(fixtureAt(centre(FLAT.couch).x, centre(FLAT.couch).y)).toBe('couch');
    expect(fixtureAt(centre(FLAT.fridge).x, centre(FLAT.fridge).y)).toBe('fridge');
    expect(fixtureAt(centre(FLAT.door).x, centre(FLAT.door).y)).toBe('door');
    expect(fixtureAt(centre(TV_SCREEN).x, centre(TV_SCREEN).y)).toBe('tv');
    expect(fixtureAt(FLAT.table.cx, FLAT.table.cy)).toBe('table');
  });

  it('and every one of them says what dropping him there means', () => {
    for (const t of DROP_TARGETS) expect(verbFor(t.fixture)).toBeTruthy();
    expect(verbFor('safe')).toBeNull();
  });

  // The floor is most of the room and dropping him on it is a REAL answer: he
  // goes back where he was rather than doing something almost-right.
  it('the floor is nothing, and nothing is a real answer', () => {
    expect(fixtureAt(180, 400)).toBeNull();
    expect(fixtureAt(FLAT.safe.x + 4, FLAT.safe.y + 4)).toBeNull();
    expect(fixtureAt(NaN, 100)).toBeNull();
    expect(fixtureAt(undefined, undefined)).toBeNull();
  });

  // A 34px door is a target you miss with a thumb, and a miss is not a no-op —
  // it is the room putting him back and the owner trying again.
  it('a catch is bigger than the thing it draws', () => {
    expect(DROP_PAD).toBeGreaterThan(0);
    expect(fixtureAt(FLAT.door.x - DROP_PAD + 1, FLAT.door.y + 10)).toBe('door');
    expect(fixtureAt(FLAT.door.x - DROP_PAD - 6, FLAT.door.y + 10)).not.toBe('door');
  });

  // The table is a circle. A point just off its corner is on the floor, which a
  // bounding box would have called a drop into the game.
  it('the table is a circle, not the box around it', () => {
    const cornerX = FLAT.table.cx - FLAT.table.rx;
    const cornerY = FLAT.table.cy - FLAT.table.ry;
    expect(fixtureAt(cornerX + 2, cornerY + 2)).toBeNull();
    expect(fixtureAt(FLAT.table.cx, FLAT.table.cy - FLAT.table.ry + 4)).toBe('table');
  });

  // With the pads on, neighbours' catches overlap even though the fixtures do
  // not. The smaller thing wins, because it is the one that is harder to hit.
  it('the harder target wins where two catches meet', () => {
    // The TV screen sits inside the tape room's own footprint, right of the
    // couch and below the table: a point on its edge is the television.
    expect(fixtureAt(TV_SCREEN.x + 1, TV_SCREEN.y + 1)).toBe('tv');
  });
});

describe('HOME-2 job 5 · the finger, in the room own coordinates', () => {
  // The room is authored at 390 and drawn at whatever fits. A pointer's clientX
  // means nothing until it is divided by the scale it is actually drawn at.
  it('divides by the scale the room is drawn at', () => {
    const half = { left: 0, top: 0, width: 195, height: 235 };
    expect(toRoom(half, 97.5, 117.5)).toEqual({ x: 195, y: 235 });
    const full = { left: 10, top: 20, width: 390, height: 470 };
    expect(toRoom(full, 110, 120)).toEqual({ x: 100, y: 100 });
    // The desk draws the same room bigger.
    const desk = { left: 0, top: 0, width: 780, height: 940 };
    expect(toRoom(desk, 390, 470)).toEqual({ x: 195, y: 235 });
  });

  it('has nothing to say about a room with no box', () => {
    expect(toRoom(null, 10, 10)).toBeNull();
    expect(toRoom({ left: 0, top: 0, width: 0, height: 0 }, 10, 10)).toBeNull();
  });

  it('keeps a carried body inside the room', () => {
    expect(clampToRoom(-40, -40)).toEqual({ x: 23, y: 46 });
    expect(clampToRoom(9999, 9999)).toEqual({ x: F_W - 23, y: F_H });
    expect(clampToRoom(200, 300)).toEqual({ x: 200, y: 300 });
  });

  it('a lift is a hold, and a hold that slides is not a hold', () => {
    expect(LONG_PRESS_MS).toBeGreaterThan(250);
    expect(PRESS_SLOP).toBeGreaterThan(0);
  });
});

describe('HOME-2 job 5 · mid-hand, which the room can see without asking', () => {
  const agent = (where = 'home') => ({ id: 'a1', location: { where } });

  it('a man at a casino table is in a hand', () => {
    expect(midHand(agent('table'))).toBe(true);
    expect(midHand(agent('casino'))).toBe(true);
  });

  it('so is a man in a seat at the kitchen table with a game running', () => {
    expect(midHand(agent('home'), { seated: true, gameRunning: true })).toBe(true);
    // A seat at a table nobody is dealing is a chair.
    expect(midHand(agent('home'), { seated: true, gameRunning: false })).toBe(false);
    expect(midHand(agent('home'), { seated: false, gameRunning: true })).toBe(false);
  });

  it('and a man standing in his own front room is not', () => {
    expect(midHand(agent('home'))).toBe(false);
    expect(midHand({})).toBe(false);
  });
});
