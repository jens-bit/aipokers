// src/server/fridgeBrim.test.js — AGENT-4 job C
//
// "He's fine. Save it." — at one dot.
//
// ── The threshold, and why it was the wrong number ──────────────────────────
//
// `itemHelp` decided whether food would do anything with:
//
//     feeds = staminaEffectOf(item) > 0 && staminaLeft < 100
//
// and `staminaLeft` is the STAMINA RESERVE. That is not the number the owner
// is looking at. The card draws `worseStage(session fatigue, reserve stage)` —
// the WORSE of two readings, kept deliberately apart by LIFE-1 so that neither
// can hide the other — and lights one dot for 'worn'. An agent who comes off a
// long session carries a session stage of 'worn' for two hours whatever the
// reserve says, so the card showed one dot while the fridge, asking the other
// number, answered "He's fine. Save it."
//
// ── Why widening the gate alone would have been worse ───────────────────────
//
// Accepting the snack without changing the visible reading would consume stock
// and change nothing an owner can see. So food credits the SESSION ladder too,
// by moving `restedAt` back one FATIGUE_RECOVERY_HOURS — the existing curve
// does the arithmetic, the hours already banked are not thrown away, and it
// floors at 'fresh' on its own. Not a skill effect: `effectiveAttrs` derives
// fatigue from the hand count of the seat he is in and never reads the stored
// field, so a man fed at home sits down exactly as sharp as he would have.
//
// The rule this pins: A REFUSAL IS ONLY CORRECT AT MAXIMUM.

delete process.env.ANTHROPIC_API_KEY;
process.env.NOTIFY_ENABLED = '0';

import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { itemHelp, SNACK_STAMINA } from './fridge.js';

const originalCwd = process.cwd();
const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'aipoker-brim-'));

let store, profiles;

const seedAgent = (id) => ({
  id, name: id.toUpperCase(), status: 'idle', activeTableId: null,
  style: 'Balanced', risk: 'Medium', strategy: 'Play carefully.', bankroll: 5_000,
  pocket: { agentId: id, balance: 5_000, mode: 'allowance', cap: null, realised: 0, ledger: [], recall: false },
  profile: { tightness: 55, aggression: 60, bluffFreq: 25, discipline: 65 },
  nature: { name: 'Hothead' },
  mood: { state: 'neutral', heat: 30 }, stats: { handsPlayed: 0, handsWon: 0 },
  sessionLog: [], ledger: [],
});

before(async () => {
  store = await import('./store.js');
  store._closeForTests();
  process.chdir(scratch);
  profiles = await import('./agentProfiles.js');
});

after(() => {
  store._closeForTests();
  process.chdir(originalCwd);
  try { fs.rmSync(scratch, { recursive: true, force: true }); } catch { /* scratch cleanup */ }
});

let seq = 0;
let owner;
let agent;

beforeEach(() => {
  owner = `brim-${seq++}`;
  store.saveWallet(owner, { ownerId: owner, balance: 100_000, ledger: [], fridge: { beer: 9, snack: 9 } });
  store.saveProfile(owner, { userId: owner, chat: [], agents: [seedAgent('a1')] });
  profiles.reloadOwners(owner);
  agent = profiles._agentRecordForTests('a1', owner);
});

/** The reading the owner is actually looking at, as presentAgent draws it. */
const dots = () => profiles.presentAgent(agent, { owner: true, userId: owner }).body.stamina;

/** Put him at one dot by the route that produced Jens's case: a long session. */
function wornFromSession({ reserve = 100 } = {}) {
  agent.stamina = { left: reserve, at: Date.now(), stage: reserve >= 67 ? 'fresh' : 'worn' };
  agent.fatigue = 'worn';
  agent.restedAt = Date.now();
}

// ── the unit, on its own ────────────────────────────────────────────────────

test('BUG-221: itemHelp asks about the reading the owner can see, not the reserve alone', () => {
  // The exact shape of the bug: nothing left to restore in the reserve, and a
  // man the card is drawing at one dot.
  assert.equal(itemHelp('snack', { staminaLeft: 100, stage: 'worn' }).feeds, true,
    'one dot is exactly when he should eat');
  assert.equal(itemHelp('snack', { staminaLeft: 100, stage: 'settled' }).feeds, true,
    'and two dots is still not maximum');
  assert.equal(itemHelp('snack', { staminaLeft: 100, stage: 'fresh' }).feeds, false,
    'refusal is correct only at maximum');
  assert.equal(itemHelp('snack', { staminaLeft: 99, stage: 'fresh' }).feeds, true,
    'the reserve half still counts on its own');
  // A caller with no stage to give keeps exactly the old behaviour.
  assert.equal(itemHelp('snack', { staminaLeft: 100 }).feeds, false);
  assert.equal(itemHelp('snack', { staminaLeft: 50 }).feeds, true);
});

test('BUG-221: the beer is untouched — its only benefit is still the cooling', () => {
  // Widening the FOOD gate must not turn the beer into a free button. Handing
  // a drink to a man who is fine is all cost (fridge.js § the beer's second
  // half), and being tired is not a reason for one.
  assert.equal(itemHelp('beer', { staminaLeft: 100, stage: 'worn' }).any, false);
  assert.equal(itemHelp('beer', { staminaLeft: 10, stage: 'worn' }).any, false);
  assert.equal(itemHelp('beer', { mood: { state: 'tilted', heat: 80 }, stage: 'fresh' }).cools, true);
});

// ── the case Jens hit ───────────────────────────────────────────────────────

test('BUG-221: food is accepted at one dot, even with a full reserve', () => {
  wornFromSession({ reserve: 100 });
  assert.equal(dots().dots, 1, 'the card shows one dot');

  const given = profiles.giveItemTo(agent, owner, 'snack');
  assert.equal(given.ok, true, `refused with: ${given.body?.error}`);
});

test('BUG-221: repeated feeding tops him up to full', () => {
  wornFromSession({ reserve: 15 });
  assert.equal(dots().dots, 1);

  let fed = 0;
  for (let i = 0; i < 9; i++) {
    const given = profiles.giveItemTo(agent, owner, 'snack');
    if (!given.ok) break;
    fed++;
    dots();   // presentAgent is what commits the recovery, as it does in life
  }

  assert.ok(fed >= 2, `he ate something — ${fed} snack(s)`);
  const reading = dots();
  assert.equal(reading.value, 100, 'the reserve is at the brim');
  assert.equal(reading.dots, 3, 'and so is the dot the owner is looking at');
  assert.equal(reading.level, 'fresh');
});

test('BUG-221: and only then is he refused', () => {
  wornFromSession({ reserve: 15 });
  for (let i = 0; i < 9; i++) {
    if (!profiles.giveItemTo(agent, owner, 'snack').ok) break;
    dots();
  }
  assert.equal(dots().dots, 3, 'he is at maximum');

  const refused = profiles.giveItemTo(agent, owner, 'snack');
  assert.equal(refused.ok, false, 'a man at the brim is told to save it');
  assert.match(String(refused.body.error), /Save it/);
  assert.equal(refused.body.reason, 'rested and level');
});

test('BUG-221: an empty shelf is still not a refusal — it opens the fridge', () => {
  // FRIDGE-1 rule 3 is untouched by any of this.
  store.saveWallet(owner, { ownerId: owner, balance: 100_000, ledger: [], fridge: { beer: 0, snack: 0 } });
  wornFromSession({ reserve: 20 });
  const given = profiles.giveItemTo(agent, owner, 'snack');
  assert.equal(given.ok, false);
  assert.equal(given.body.outOfStock, true);
  assert.equal(given.body.needs, 'stock');
});

test('BUG-221: feeding does not make him play better — only the seat decides that', async () => {
  // fridge.js rule 2: items touch STATE, never SKILL. The session ladder is a
  // stored word; `effectiveAttrs` recomputes fatigue from the hand count of
  // the seat he is actually in and never reads it.
  const { effectiveAttrs } = await import('../agent/attributes.js');
  wornFromSession({ reserve: 15 });
  const before = effectiveAttrs(agent, { sessionHands: 400 });
  profiles.giveItemTo(agent, owner, 'snack');
  const after = effectiveAttrs(agent, { sessionHands: 400 });
  assert.equal(after.fatigue, before.fatigue, 'a snack at home is not a rested seat');
  assert.equal(after.FOCUS, before.FOCUS);
  assert.equal(after.DISCIPLINE, before.DISCIPLINE);
});

// ── the reserve half still works exactly as it did ──────────────────────────

test('BUG-221: a snack still puts SNACK_STAMINA back, clamped at the brim', () => {
  agent.stamina = { left: 20, at: Date.now(), stage: 'worn' };
  agent.fatigue = 'fresh';
  agent.restedAt = Date.now();
  const given = profiles.giveItemTo(agent, owner, 'snack');
  assert.equal(given.ok, true);
  assert.equal(given.body.stamina.restored, SNACK_STAMINA);
  assert.equal(given.body.stamina.left, 20 + SNACK_STAMINA);
});
