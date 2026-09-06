// src/server/homeFridge.test.js — SERVER-4 job 5
//
// The fridge on the wire.
//
// FRIDGE-1 put two items behind a route and left the client holding the prices,
// which meant the price list existed in two places: a change was a deploy of
// two things that had to land together, and the one that landed second was
// wrong for as long as it took. So the price travels with the ask, and the
// COUNTS ride HOME_STATE — the flat draws a full or an empty fridge on its
// first paint, and it should not have to make a second request to know which.
//
// Counts on the socket, prices on the route, and that split is deliberate: a
// price never changes between two frames, and pushing three constants down a
// live socket on every home change is three constants over and over.

delete process.env.ANTHROPIC_API_KEY;

import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { homeStateMessage } from './home.js';
import { ITEMS } from './fridge.js';
import { _closeForTests } from './store.js';

// ── The counts on HOME_STATE ────────────────────────────────────────────────

test('SERVER-4: HOME_STATE carries what is on the shelves', () => {
  const msg = homeStateMessage('u1', [], null, { fridge: { beer: 3, snack: 1 } });
  assert.deepEqual(msg.fridge, { beer: 3, snack: 1 });
});

test('SERVER-4: a fridge nobody has ever stocked is zeroes, never absent', () => {
  // Absent would make the client branch on the field not existing rather than
  // on the count being zero, which is the same branch written twice.
  for (const arg of [undefined, {}, { fridge: null }, { fridge: {} }]) {
    const msg = homeStateMessage('u1', [], null, arg);
    assert.deepEqual(msg.fridge, { beer: 0, snack: 0 }, JSON.stringify(arg));
  }
});

test('SERVER-4: a nonsense count is clamped rather than put on the wire', () => {
  const msg = homeStateMessage('u1', [], null, { fridge: { beer: -4, snack: '2.7' } });
  assert.deepEqual(msg.fridge, { beer: 0, snack: 2 },
    'never negative, always a whole number of bottles');
});

test('SERVER-4: the counts only — the prices are the route\'s job', () => {
  const msg = homeStateMessage('u1', [], null, { fridge: { beer: 2, snack: 0 } });
  assert.deepEqual(Object.keys(msg.fridge).sort(), ['beer', 'snack']);
  assert.equal(JSON.stringify(msg.fridge).includes(String(ITEMS.beer.price)), false,
    'a price that never changes has no business on a live socket');
});

// ── The price on the ask ────────────────────────────────────────────────────

test('SERVER-4: the want carries what the item costs and how many are left', async () => {
  const profiles = await import('./agentProfiles.js');
  const wallet = { ownerId: 'own-want', balance: 5_000, fridge: { beer: 2, snack: 0 }, ledger: [] };
  const agent = {
    id: 'thirsty',
    want: { kind: 'beer', text: 'get me a beer', item: 'beer', needs: null, at: Date.now() },
  };

  const view = profiles.wantView(agent, { wallet });
  assert.equal(view.item, 'beer');
  // The client draws "BUY 6 · 1200" from these two and carries no constant of
  // its own to do it.
  assert.equal(view.price, ITEMS.beer.price);
  assert.equal(view.stock, 2);
});

test('SERVER-4: an empty shelf still prices the thing he is asking for', async () => {
  const profiles = await import('./agentProfiles.js');
  const wallet = { ownerId: 'own-out', balance: 5_000, fridge: { beer: 0, snack: 0 }, ledger: [] };
  const agent = {
    id: 'thirsty',
    want: { kind: 'beer', text: 'get me a beer', item: 'beer', needs: null, at: Date.now() },
  };

  const view = profiles.wantView(agent, { wallet });
  // FRIDGE-1 rule 3: an empty fridge is not a punishment, it changes what he
  // SAYS. SERVER-4 adds the half the client needs to answer him: yes opens the
  // fridge, and the button knows what six of them cost.
  assert.equal(view.outOfStock, true);
  assert.equal(view.needs, 'stock');
  assert.equal(view.stock, 0);
  assert.equal(view.price, ITEMS.beer.price);
});

test('SERVER-4: a want that is not about an item is not priced', async () => {
  const profiles = await import('./agentProfiles.js');
  const agent = {
    id: 'tired',
    want: { kind: 'rest', text: 'sit me out', item: null, needs: null, at: Date.now() },
  };
  const view = profiles.wantView(agent, { wallet: { balance: 0, fridge: {} } });
  assert.equal(view.price, null, 'there is no price on being sat out');
  assert.equal(view.stock, null);
});

// ── harness ─────────────────────────────────────────────────────────────────

// A scratch cwd, because importing agentProfiles opens the store.
const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-homefridge-'));

before(() => {
  _closeForTests();
  process.chdir(dir);
});

after(() => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});
