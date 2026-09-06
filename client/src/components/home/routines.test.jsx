// client/src/components/home/routines.test.jsx — HOME-1
//
// State → routine → how it is drawn.
//
// The LADDER itself (nature picks the idle, state overrides it, and in what
// order) belongs to the server and is asserted there — src/server/home.test.js.
// What is asserted here is the half this file owns: that every routine the
// server can send has a drawing, that the drawing is the one the brief names,
// and that the nature fallback only ever fires when the server sent nothing.

import { describe, expect, it } from 'vitest';
import { ROUTINES, ROUTINE_KEYS, presentRoutine, routineKeyOf, isBusy } from './routines.js';
import { HAND_POSES } from '../system/GhostHands.jsx';
import { FACE_EVENTS } from '../system/GhostFace.jsx';

// The server's vocabulary, copied here on purpose: if src/server/home.js grows
// a tenth routine, this list does not, and the first test below goes red.
const SERVER_ROUTINE_KEYS = [
  'plays', 'tape', 'sulks', 'sleeps', 'waits', 'paces', 'reads', 'shuffles', 'counts',
];

const agent = (routine, nature) => ({
  id: 'a', name: 'A',
  routine: routine ? { key: routine, label: routine } : null,
  nature: nature ? { name: nature } : null,
});

describe('HOME-1 · every routine the server can send has a body', () => {
  it('the vocabularies match, both ways', () => {
    expect([...ROUTINE_KEYS].sort()).toEqual([...SERVER_ROUTINE_KEYS].sort());
  });

  it('every pose is a real pose and every face a real face', () => {
    for (const key of ROUTINE_KEYS) {
      const r = ROUTINES[key];
      expect(HAND_POSES, key).toContain(r.pose);
      if (r.face) expect(FACE_EVENTS, key).toContain(r.face);
      expect(r.label, key).toBeTruthy();
    }
  });
});

describe('HOME-1 · the brief\'s routines are drawn the way it names them', () => {
  it('the four idle habits carry their prop', () => {
    expect(presentRoutine(agent('reads')).prop).toBe('paper');
    expect(presentRoutine(agent('shuffles')).prop).toBe('cards');
    expect(presentRoutine(agent('counts')).prop).toBe('chips');
    // Pacing is a walk, not a prop — it is the one idle that moves the body.
    expect(presentRoutine(agent('paces')).anim).toBeTruthy();
    expect(presentRoutine(agent('paces')).prop).toBeUndefined();
  });

  it('sleep closes his eyes', () => {
    const r = presentRoutine(agent('sleeps'));
    expect(r.face).toBe('bored');
    expect(r.prop).toBe('zzz');
  });

  it('sulking turns his back — no face at all, which is the point', () => {
    expect(presentRoutine(agent('sulks')).back).toBe(true);
  });

  it('waiting by the door is still and empty-handed', () => {
    const r = presentRoutine(agent('waits'));
    expect(r.pose).toBe('rest');
    expect(r.prop).toBeUndefined();
    expect(r.back).toBeUndefined();
  });

  it('at the table and in the tape room he is holding something', () => {
    expect(presentRoutine(agent('plays')).pose).toBe('hold');
    expect(presentRoutine(agent('tape')).pose).toBe('hold');
  });
});

describe('HOME-1 · the nature fallback is a last-ditch, not a second ladder', () => {
  it('the served routine always wins', () => {
    // A Hothead the server says is asleep is asleep. If this ever inverted, the
    // client would be running its own ladder against the server's.
    expect(routineKeyOf(agent('sleeps', 'Hothead'))).toBe('sleeps');
    expect(routineKeyOf(agent('reads', 'Shark'))).toBe('reads');
  });

  it('only an agent with NO routine falls back to his nature', () => {
    expect(routineKeyOf(agent(null, 'Hothead'))).toBe('paces');
    expect(routineKeyOf(agent(null, 'Rock'))).toBe('reads');
    expect(routineKeyOf(agent(null, 'Shark'))).toBe('shuffles');
    expect(routineKeyOf(agent(null, 'Grinder'))).toBe('counts');
  });

  it('an unknown routine and an unknown nature both land somewhere real', () => {
    expect(ROUTINE_KEYS).toContain(routineKeyOf(agent('sunbathing', 'Wizard')));
    expect(ROUTINE_KEYS).toContain(routineKeyOf({ id: 'x' }));
    expect(presentRoutine(null).label).toBeTruthy();
  });
});

describe('HOME-1 · busy means out of the home game', () => {
  it('the tape room and sleep take him out of it; an idle habit does not', () => {
    expect(isBusy(agent('tape'))).toBe(true);
    expect(isBusy(agent('sleeps'))).toBe(true);
    expect(isBusy(agent('paces'))).toBe(false);
    expect(isBusy(agent('sulks'))).toBe(false);
  });
});
