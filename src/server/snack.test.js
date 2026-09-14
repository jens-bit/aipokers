// src/server/snack.test.js — LIFE-1 follow-up 3
//
// THE SNACK, and the reason the fridge appeared to do nothing.
//
// design-refs/mood-snack.jsx draws the item and states the scope law: items
// touch STATE, never SKILL. Stamina is state, so a snack that puts some of the
// reserve back is the board's own item pointed at the state that exists now.
//
// The bug underneath it was shared with the beer, which is why one fix covers
// both: giveItemTo refused any item to an agent who was not SOOTHABLE, and
// applyItem floors heat at the neutral midpoint — which is where a resting
// agent sits by default. So for the commonest state in the product, EVERY item
// was refused, nothing left the fridge, and nothing happened.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { _closeForTests } from './store.js';

const ORIGINAL_CWD = process.cwd();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-snack-'));
_closeForTests();
process.chdir(dir);
process.on('exit', () => {
  _closeForTests();
  process.chdir(ORIGINAL_CWD);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
});

const { saveProfile, loadProfile, saveWallet, loadWallet } = await import('./store.js');
const profiles = await import('./agentProfiles.js');
const { SNACK_STAMINA, itemHelp, staminaEffectOf } = await import('./fridge.js');
const { STAMINA_MAX, WORN_AT, SETTLED_AT } = await import('../agent/stamina.js');
const { isEating, routineFor, Routine } = await import('./home.js');

let seq = 0;

// One owner per case, so a refusal in one cannot look like stock in another.
function household({ heat = 30, left = STAMINA_MAX, stage = 'fresh', snacks = 3, beers = 3 } = {}) {
  const userId = `snack-${seq++}`;
  saveProfile(userId, { userId, chat: [], agents: [{
    id: 'stone', name: 'Stone', status: 'idle', nature: { name: 'Rock' },
    mood: { state: heat > 60 ? 'tilted' : heat > 40 ? 'frustrated' : 'neutral', heat },
    stamina: { left, at: Date.now(), stage },
    attrs: { READS: 50, FOCUS: 50, DISCIPLINE: 50, COMPOSURE: 50, DECEPTION: 50, STAMINA: 50 },
    pocket: { balance: 5000, mode: 'auto', cap: 5000, ledger: [] },
  }] });
  saveWallet(userId, { balance: 50_000, fridge: { beer: beers, snack: snacks } });
  // agentProfiles caches owners it has seen; a row written straight to the
  // store after that cache exists is invisible until the owner is re-read.
  profiles.reloadOwners(userId);
  return userId;
}

const him = (userId) => loadProfile(userId).agents[0];
const give = (userId, item) => profiles.giveItemFrom(
  profiles.agentsOf(userId).find((a) => a.id === 'stone'), userId, item);

// ── The gate, which is the bug ──────────────────────────────────────────────

test('LIFE-1 follow-up: the fridge did nothing because the gate asked one question', () => {
  // A calm agent at the default heat with a full reserve: nothing either item
  // can do for him, so both are refused and the stock is untouched. That part
  // is the board's own "He's fine. Save it." and it is correct.
  const u = household();
  for (const item of ['beer', 'snack']) {
    const out = give(u, item);
    assert.equal(out.status, 400, item);
    assert.equal(out.body.error, "He's fine. Save it.");
  }
  assert.deepEqual(loadWallet(u).fridge, { beer: 3, snack: 3 }, 'a refusal costs nothing');
});

test('LIFE-1 follow-up: a SPENT but calm agent is no longer refused a snack', () => {
  // The regression. Before the fix this was a 400 and nothing moved — which
  // is precisely the case a snack exists for.
  const u = household({ left: 20, stage: 'worn' });
  const out = give(u, 'snack');
  assert.equal(out.status, 200, JSON.stringify(out.body));
  assert.equal(loadWallet(u).fridge.snack, 2, 'consumed on use');
});

test('LIFE-1 follow-up: a beer is still refused to a man who is fine', () => {
  // Correct rather than an oversight: the beer's only benefit is the cooling,
  // and its other half is a penalty he carries into his next session. Handing
  // it to a calm agent is all cost.
  const u = household({ left: 20, stage: 'worn' });
  const out = give(u, 'beer');
  assert.equal(out.status, 400);
  assert.equal(out.body.reason, 'level');
  assert.equal(loadWallet(u).fridge.beer, 3);
});

test('LIFE-1 follow-up: a beer still works on a man who is steaming', () => {
  const u = household({ heat: 80 });
  const out = give(u, 'beer');
  assert.equal(out.status, 200);
  assert.equal(out.body.soothed, true);
  assert.ok(him(u).mood.heat < 80);
  assert.equal(him(u).drinkPending, true, 'and it still follows him to work');
  assert.equal(loadWallet(u).fridge.beer, 2);
});

// ── What the snack does ─────────────────────────────────────────────────────

test('LIFE-1 follow-up: the snack restores a BOUNDED amount of the reserve', () => {
  const u = household({ left: 30, stage: 'worn' });
  const out = give(u, 'snack');
  assert.equal(out.status, 200);
  assert.equal(out.body.stamina.restored, SNACK_STAMINA);
  assert.ok(Math.abs(him(u).stamina.left - (30 + SNACK_STAMINA)) < 1,
    `expected about ${30 + SNACK_STAMINA}, got ${him(u).stamina.left}`);
});

test('LIFE-1 follow-up: it can never put more in than the reserve holds', () => {
  const u = household({ left: STAMINA_MAX - 2, heat: 80 });
  give(u, 'snack');
  assert.ok(him(u).stamina.left <= STAMINA_MAX, `overfilled to ${him(u).stamina.left}`);
});

test('LIFE-1 follow-up: one snack does not undo a night; three of them can', () => {
  // The hysteresis wants him back at SETTLED_AT before he gets up, so feeding
  // a sleeping agent awake is a real decision about stock rather than a free
  // button — which is the shape a Tamagotchi wants.
  const u = household({ left: 10, stage: 'worn', snacks: 6 });
  give(u, 'snack');
  assert.equal(him(u).stamina.stage, 'worn', 'one snack is not a night in bed');
  give(u, 'snack');
  give(u, 'snack');
  assert.ok(him(u).stamina.left >= SETTLED_AT, `only reached ${him(u).stamina.left}`);
  assert.equal(him(u).stamina.stage, 'fresh', 'fed all the way back to rested, he gets up');
  assert.equal(loadWallet(u).fridge.snack, 3, 'and it cost three of them');
});

test('LIFE-1 follow-up: an empty shelf is not a punishment, it is a sentence', () => {
  const u = household({ left: 20, stage: 'worn', snacks: 0 });
  const out = give(u, 'snack');
  assert.equal(out.status, 409);
  assert.equal(out.body.needs, 'stock');
  assert.match(out.body.error, /out of snacks/);
});

// ── The visible effect, and the ledger ──────────────────────────────────────

test('LIFE-1 follow-up: it shows on him — he goes and eats it', () => {
  const u = household({ left: 20, stage: 'worn' });
  give(u, 'snack');
  const agent = him(u);
  // The routine ladder's EATS rung, which is what the room draws.
  assert.ok(isEating(agent.lastSnackAt), 'the fridge stamps when he was fed');
  assert.equal(routineFor({ id: 'stone', nature: 'Rock', fedAt: agent.lastSnackAt }).key, Routine.EATS);
  // And a line in his own voice, plus the accepted-action stamp the flat draws.
  assert.match(agent.lastMoment.text, /keep me going/i);
  assert.equal(agent.homeItem.item, 'snack');
});

test('LIFE-1 follow-up: it writes a ledger line, as every owner act does', () => {
  const u = household({ left: 20, stage: 'worn' });
  const before = (him(u).ownerMemory ?? []).length;
  give(u, 'snack');
  const ledger = him(u).ownerMemory ?? [];
  assert.ok(ledger.length > before, 'the owner ledger gained a line');
  assert.ok(ledger.some((e) => e.type === 'item_given'), JSON.stringify(ledger));
});

// ── The pure half ───────────────────────────────────────────────────────────

test('LIFE-1 follow-up: itemHelp asks over every effect an item has', () => {
  const level = { state: 'neutral', heat: 30 };
  const hot = { state: 'tilted', heat: 80 };
  // Rested and level: neither item has anything to offer.
  assert.equal(itemHelp('snack', { mood: level, staminaLeft: 100 }).any, false);
  assert.equal(itemHelp('beer', { mood: level, staminaLeft: 100 }).any, false);
  // Tired but level: the snack does, the beer does not.
  assert.equal(itemHelp('snack', { mood: level, staminaLeft: 20 }).feeds, true);
  assert.equal(itemHelp('beer', { mood: level, staminaLeft: 20 }).any, false);
  // Steaming: both cool him.
  assert.equal(itemHelp('beer', { mood: hot, staminaLeft: 100 }).cools, true);
  assert.equal(itemHelp('snack', { mood: hot, staminaLeft: 100 }).cools, true);
  // Cooled back to neutral, he is FINE — a number still above the floor is not
  // a reason to sell him a second beer. verify-personality-layer.js pins this.
  assert.equal(itemHelp('beer', { mood: { state: 'neutral', heat: 35 }, staminaLeft: 100 }).any, false);
  // Nonsense in, a refusal out — never a crash and never a free item.
  assert.equal(itemHelp('caviar', { mood: hot, staminaLeft: 10 }).any, false);
  assert.equal(itemHelp('snack', {}).any, false, 'no facts given reads as "he is fine"');
});

test('LIFE-1 follow-up: only the snack feeds, and nothing in the fridge buys a skill', () => {
  assert.equal(staminaEffectOf('snack'), SNACK_STAMINA);
  assert.equal(staminaEffectOf('beer'), 0);
  assert.ok(SNACK_STAMINA > 0 && SNACK_STAMINA < STAMINA_MAX - WORN_AT,
    'a snack is a help, not a night in bed');
});
