// client/src/lib/feltBubbles.test.jsx — WATCH-10 job 2
//
// NO BUBBLE OR PILL MAY OVERLAP ANOTHER, at 390 wide, for every combination of
// speakers a six-handed felt can produce.
//
// The Playwright pass (client/e2e/watch10.spec.js) measures the real boxes in a
// real browser and is the proof. This is the arithmetic under it, which is what
// makes the proof reproducible: the model is what decides whether a bubble is
// drawn at all, so if the model is wrong the browser is only wrong more slowly.
//
// It also guards the two numbers this file and watch.css both have to know —
// the seats' x's and TAIL_IN — by reading the stylesheet. They cannot be shared
// (a custom property cannot be read out of another rule) so they are checked
// instead.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { overlaps } from './bubblePlace.js';
import {
  BUBBLE_H, BUBBLE_MAX_W, EDGE, FELT_W, POT_TOP, SEAT_X, TAIL_IN,
  bandTop, bubbleRect, bubbleWidth, pillRect, placeOnFelt, seatTop, sidesById, sidesFor,
} from './feltBubbles.js';
import { SEAT_BODY, SEAT_GAP, SEAT_PILL } from '../components/system/SeatGhost.jsx';

const HERE = dirname(fileURLToPath(import.meta.url));
const CSS = readFileSync(resolve(HERE, '../styles/watch.css'), 'utf8');

// The five slots slotsFor() can hand out, and a cast to sit in them.
const SLOTS = ['tl', 'tc', 'tr', 'ml', 'mr'];
const SEATS = SLOTS.map((slot, i) => ({ slot, name: `Opponent ${i + 1}` }));

const say = (slot, text) => ({ id: slot, slot, text });

/** Every subset of the five slots, so nothing is checked only in the easy case. */
function subsets(list) {
  const out = [];
  for (let mask = 1; mask < (1 << list.length); mask += 1) {
    out.push(list.filter((_, i) => mask & (1 << i)));
  }
  return out;
}

describe('WATCH-10 job 2: the felt agrees with the stylesheet', () => {
  it('puts each slot where watch.css puts its seat', () => {
    for (const [slot, frac] of Object.entries(SEAT_X)) {
      const rule = new RegExp(`\\.watch-felt__seat--${slot}\\s*\\{[^}]*left:\\s*([\\d.]+)%`);
      const found = CSS.match(rule);
      expect(found, `watch.css has no left for .watch-felt__seat--${slot}`).toBeTruthy();
      expect(Number(found[1]) / 100).toBe(frac);
    }
  });

  it('carries the same x onto the bubble, so a bubble tracks its speaker', () => {
    for (const [slot, frac] of Object.entries(SEAT_X)) {
      const rule = new RegExp(`\\.watch-felt__bubble--${slot}\\s*\\{[^}]*--seat-x:\\s*([\\d.]+)%`);
      const found = CSS.match(rule);
      expect(found, `watch.css has no --seat-x for .watch-felt__bubble--${slot}`).toBeTruthy();
      expect(Number(found[1]) / 100).toBe(frac);
    }
  });

  it('offsets the box and the tail by the same TAIL_IN the model uses', () => {
    expect(CSS).toContain(`left: calc(var(--seat-x, 50%) - ${TAIL_IN}px)`);
    expect(CSS).toContain(`left: calc(var(--seat-x, 50%) + ${TAIL_IN}px)`);
    expect(CSS).toContain(`.watch-felt__bubble.is-right .bubble__tail { left: ${TAIL_IN}px; }`);
  });

  it('models a seat out of the seat component\'s own numbers', () => {
    const pill = pillRect({ slot: 'tl', name: 'Granite' });
    expect(pill.top).toBe(seatTop('tl') + SEAT_BODY + SEAT_GAP);
    expect(pill.bottom - pill.top).toBe(SEAT_PILL);
  });
});

describe('WATCH-10 job 2: the boxes', () => {
  it('never models a bubble narrower than the box it stands for', () => {
    // Padding and borders alone, before a single character.
    expect(bubbleWidth('')).toBeGreaterThan(22);
    expect(bubbleWidth('Again?')).toBeGreaterThan('Again?'.length * 6);
    // And never wider than the stylesheet's ceiling.
    expect(bubbleWidth('x'.repeat(400))).toBe(BUBBLE_MAX_W);
  });

  it('speaks below the top row and above the rails', () => {
    // Below his own seat AND below the pile he banks under it.
    expect(bandTop('tl')).toBeGreaterThan(seatTop('tl') + SEAT_BODY + SEAT_GAP + SEAT_PILL);
    // And above his — a rail has nothing under it but the board.
    expect(bandTop('ml') + BUBBLE_H).toBeLessThanOrEqual(seatTop('ml'));
  });

  it('opens away from the nearer edge first', () => {
    expect(sidesFor(say('tl', 'x'))[0]).toBe('right');
    expect(sidesFor(say('tr', 'x'))[0]).toBe('left');
    expect(sidesFor(say('ml', 'x'))[0]).toBe('right');
    expect(sidesFor(say('mr', 'x'))[0]).toBe('left');
  });

  it('refuses a side that would run off the felt', () => {
    // A rail seat is 48px from the edge; a 150px box cannot open inward of it.
    expect(bubbleRect(say('ml', 'x'.repeat(60)), 'left')).toBeNull();
    expect(bubbleRect(say('mr', 'x'.repeat(60)), 'right')).toBeNull();
  });
});

describe('WATCH-10 job 2: nothing is drawn over anything', () => {
  const LINES = ['Again?', 'Call.', 'Too rich for me.', 'He does that every single time'];

  it('places two short lines, and both are inside the felt', () => {
    const out = placeOnFelt([say('tl', 'Again?'), say('tc', 'Call.')], SEATS);
    expect(out).toHaveLength(2);
    for (const s of out) {
      const b = bubbleRect(s, s.side);
      expect(b.left).toBeGreaterThanOrEqual(EDGE);
      expect(b.right).toBeLessThanOrEqual(FELT_W - EDGE);
    }
  });

  it('drops the second when two long lines cannot both fit', () => {
    const long = 'x'.repeat(40);
    const out = placeOnFelt([say('tl', long), say('tc', long)], SEATS);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe('tl');
  });

  it('never overlaps, for any pair of slots and any of these lines', () => {
    for (const pair of subsets(SLOTS).filter((s) => s.length === 2)) {
      for (const text of LINES) {
        const out = placeOnFelt(pair.map((slot) => say(slot, text)), SEATS);
        const boxes = out.map((s) => bubbleRect(s, s.side));
        for (let i = 0; i < boxes.length; i += 1) {
          for (let j = i + 1; j < boxes.length; j += 1) {
            expect(overlaps(boxes[i], boxes[j]),
              `${pair.join('+')} "${text}" — two bubbles on top of each other`).toBe(false);
          }
        }
      }
    }
  });

  it('never lands on a name pill, whoever is speaking', () => {
    const pills = SEATS.map((s) => pillRect(s));
    for (const slot of SLOTS) {
      for (const text of LINES) {
        for (const s of placeOnFelt([say(slot, text)], SEATS)) {
          const b = bubbleRect(s, s.side);
          for (const pill of pills) {
            expect(overlaps(b, pill), `${slot} "${text}" — bubble across a name pill`).toBe(false);
          }
        }
      }
    }
  });

  it('holds at most two, whatever the whole table has to say', () => {
    for (const group of subsets(SLOTS)) {
      const out = placeOnFelt(group.map((slot) => say(slot, 'Again?')), SEATS);
      expect(out.length).toBeLessThanOrEqual(2);
    }
  });

  it('stays inside the felt on a shorter phone, where the rails ride higher', () => {
    // A short felt pulls --wv-pot up, which pulls the rails and their band with
    // it — and can put a rail's band level with the top row's.
    const potTop = 130;
    const out = placeOnFelt([say('tl', 'Again?'), say('ml', 'Call.')], SEATS, { potTop });
    const boxes = out.map((s) => bubbleRect(s, s.side, { potTop }));
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) {
        expect(overlaps(boxes[i], boxes[j])).toBe(false);
      }
    }
  });

  it('answers by id, which is what a component asks', () => {
    const sides = sidesById([say('tl', 'Again?'), say('tc', 'Call.')], SEATS);
    expect(sides.get('tl')).toBe('right');
    expect(sides.has('tc')).toBe(true);
    // Somebody nobody placed is simply not in the map, and is not drawn.
    const crowded = sidesById(
      [say('tl', 'x'.repeat(40)), say('tc', 'x'.repeat(40))], SEATS,
    );
    expect(crowded.has('tc')).toBe(false);
  });

  it('is empty for an empty felt rather than a crash', () => {
    expect(placeOnFelt()).toEqual([]);
    expect(placeOnFelt([], [])).toEqual([]);
    expect(sidesById([say('tl', 'Again?')], []).get('tl')).toBe('right');
  });

  it('uses watch.css\'s own fallback for the pot, so the model is not a guess', () => {
    expect(CSS).toContain(`var(--wv-pot, ${POT_TOP}px)`);
  });
});
