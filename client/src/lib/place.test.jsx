// client/src/lib/place.test.jsx — HOME-2 job 5
//
// Telling the server where you put him.
//
// One route answers all five fixtures, and this client ships before that route
// does — so every case here is really about the SECOND answer: what a drop does
// against a server that has never heard of /place. The rule is that it does
// what the fixture could already do, or nothing at all, and never something it
// only pretends to have done.

import { describe, expect, it, beforeEach } from 'vitest';

import { FIXTURES, lineOf, placeAgent } from './place.js';
import { fetchMock, telegram } from '../test/harness.js';

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

describe('HOME-2 job 5 · POST /place, and what happens without it', () => {
  it('asks the one route first, for every fixture that is a request', () => {
    expect(FIXTURES).toEqual(['couch', 'table', 'fridge', 'tv', 'door']);
  });

  it('takes the server answer when the server has one', async () => {
    let sent = null;
    fetchMock.route(/\/place\?/, ({ body }) => { sent = body; return { ok: true, routine: 'sleeps' }; }, { method: 'POST' });

    const res = await placeAgent('a1', 'couch');
    expect(res.ok).toBe(true);
    expect(res.via).toBe('place');
    expect(sent).toEqual(expect.objectContaining({ fixture: 'couch' }));
  });

  // The refusal job 5 names. The server has the line; the client does not
  // invent one.
  it('carries his line back off a refusal', async () => {
    fetchMock.route(/\/place\?/, { status: 409, body: { line: 'Not now. I am in a hand.' } }, { method: 'POST' });

    const res = await placeAgent('a1', 'table');
    expect(res.ok).toBe(false);
    expect(res.status).toBe(409);
    expect(res.line).toBe('Not now. I am in a hand.');
  });

  it('reads a line off whichever field the server put it in', () => {
    expect(lineOf({ moment: { text: 'That helps.' } })).toBe('That helps.');
    expect(lineOf({ line: 'No.' })).toBe('No.');
    expect(lineOf({ error: 'He is at a table.' })).toBe('He is at a table.');
    expect(lineOf(null)).toBeNull();
  });

  // ── The fallbacks ─────────────────────────────────────────────────────────

  it('the fridge falls back to the give route the fridge sheet already calls', async () => {
    let gave = null;
    // No /place route at all is the pre-SERVER-5 server: the harness answers
    // an unrouted request with a 404, which is exactly what one does.
    fetchMock.route(/\/give\?/, ({ body }) => { gave = body; return { moment: { text: 'That helps. Thanks.' } }; }, { method: 'POST' });

    const res = await placeAgent('a1', 'fridge');
    expect(res.ok).toBe(true);
    expect(res.via).toBe('give');
    expect(gave).toEqual(expect.objectContaining({ item: 'snack' }));
    expect(res.line).toBe('That helps. Thanks.');
  });

  it('the television falls back to the tape room, on the hand he has flagged', async () => {
    let studied = null;
    fetchMock.route(/\/flagged\?/, { flaggedHands: [{ handId: 'h7' }, { handId: 'h9' }] });
    fetchMock.route(/\/study$/, ({ body }) => { studied = body; return { study: { handNumber: 7 } }; }, { method: 'POST' });

    const res = await placeAgent('a1', 'tv');
    expect(res.ok).toBe(true);
    expect(res.via).toBe('study');
    expect(studied).toEqual(expect.objectContaining({ handId: 'h7' }));
  });

  it('...and says so when there is nothing flagged to watch', async () => {
    fetchMock.route(/\/flagged\?/, { flaggedHands: [] });

    const res = await placeAgent('a1', 'tv');
    expect(res.ok).toBe(false);
    expect(res.line).toMatch(/nothing flagged/i);
  });

  // THE TWO WITH NO ROUTE. Resting is a routine and src/server/home.js derives
  // every routine from state; homeGame.js's sync() is the only thing that
  // stands the kitchen table up. Neither is settable, by design — so a drop on
  // either reports that nothing happened rather than claiming something did.
  it('the couch and the table have no fallback, and do not pretend to', async () => {
    for (const fixture of ['couch', 'table']) {
      const res = await placeAgent('a1', fixture);
      expect(res.ok, fixture).toBe(false);
      expect(res.unsupported, fixture).toBe(true);
      expect(res.line, fixture).toBeNull();
    }
  });

  // The door is not a request at all. Walking to the casino is navigation, and
  // CASINO-1 put the deploy decision inside the building.
  it('the door asks nobody — it is where the owner is going', async () => {
    let asked = false;
    fetchMock.route(/\/place\?/, () => { asked = true; return { status: 404, body: null }; }, { method: 'POST' });

    const res = await placeAgent('a1', 'door');
    expect(res.ok).toBe(true);
    expect(res.via).toBe('walk');
    expect(asked).toBe(false);
  });

  it('refuses a fixture that is not one', async () => {
    const res = await placeAgent('a1', 'safe');
    expect(res.ok).toBe(false);
    expect(res.unsupported).toBe(true);
    expect(await placeAgent(null, 'couch')).toMatchObject({ ok: false });
  });
});
