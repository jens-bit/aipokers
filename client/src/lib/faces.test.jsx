// faces.js — SERVER-3's six triggers, and the one expression each of them is.
import { describe, expect, it } from 'vitest';

import { FACE_EVENTS } from '../components/system/GhostFace.jsx';
import { SERVER_FACE_EVENTS, faceFor, faceOf } from './faces.js';

describe('the face triggers', () => {
  it('are the server\'s six, and every one of them is a face the ghost can draw', () => {
    expect(SERVER_FACE_EVENTS).toEqual(
      ['dealtStrong', 'raisedAgainst', 'allIn', 'wonBig', 'badBeat', 'bluffCaught'],
    );
    for (const e of SERVER_FACE_EVENTS) {
      expect(FACE_EVENTS).toContain(faceFor(e));
    }
    // One name, one expression — no two triggers collapse onto the same face.
    expect(new Set(SERVER_FACE_EVENTS.map(faceFor)).size).toBe(6);
  });

  it('draws nothing for a name it does not know', () => {
    expect(faceFor('somethingElse')).toBeNull();
    expect(faceFor(null)).toBeNull();
    expect(faceFor(undefined)).toBeNull();
  });

  // Same vocabulary either way: a client maps one name to one expression and
  // never has to know which message brought it.
  it('takes a decision trigger for the seat that acted, and nobody else', () => {
    const d = { seat: 2, event: 'raisedAgainst' };
    expect(faceOf(2, d, null)).toBe('wary');
    expect(faceOf(1, d, null)).toBeNull();
  });

  it('takes a hand-end trigger off the result, per seat', () => {
    const r = { events: { 0: 'wonBig', 3: 'badBeat' } };
    expect(faceOf(0, null, r)).toBe('smug');
    expect(faceOf(3, null, r)).toBe('stunned');
    expect(faceOf(1, null, r)).toBeNull();
  });

  // Once the hand is over, what he was reacting to before he acted is history.
  it('lets the hand-end trigger outrank the decision it followed', () => {
    const d = { seat: 0, event: 'allIn' };
    expect(faceOf(0, d, { events: { 0: 'badBeat' } })).toBe('stunned');
    expect(faceOf(0, d, { events: {} })).toBeNull();
  });

  it('is silent on a payload from a server that sends neither', () => {
    expect(faceOf(0, null, null)).toBeNull();
    expect(faceOf(0, { seat: 0 }, null)).toBeNull();
    expect(faceOf(0, null, {})).toBeNull();
    expect(faceOf(null, { seat: null, event: 'wonBig' }, null)).toBeNull();
  });
});
