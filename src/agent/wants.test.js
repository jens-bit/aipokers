// src/agent/wants.test.js — RELATE-1d
//
// What he asks for, and — more importantly — what he never asks for. The
// trigger takes plain numbers rather than an agent record, which is the
// structural reason a want cannot be produced by an absence: there is no clock
// and no "last seen" in scope to read.

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  ITEMS, DEFAULT_ITEM, WANT_TRIGGERS,
  WANT_MIN_HEAT, WANT_MIN_LOSING_RUN, WANT_COOLDOWN_HANDS,
  wantTrigger, buildWant, isItem, priceOf,
} from './wants.js';

// ── the trigger table ────────────────────────────────────────────────────────

test('he asks only when the heat AND the run are both there', () => {
  // Heat alone is one bad beat.
  assert.equal(wantTrigger({ heat: 90, losingRun: 0 }), null);
  assert.equal(wantTrigger({ heat: 90, losingRun: 1 }), null);
  // A run alone at low heat is a man having a quiet night.
  assert.equal(wantTrigger({ heat: 20, losingRun: 6 }), null);
  assert.equal(wantTrigger({ heat: 54, losingRun: 6 }), null);
  // Both together is the night where a drink is the obvious thing to say.
  assert.ok(wantTrigger({ heat: 55, losingRun: 2 }));
});

test('the trigger table resolves most-specific first', () => {
  assert.equal(wantTrigger({ heat: 60, losingRun: 2 }).id, 'rough_run');
  assert.equal(wantTrigger({ heat: 75, losingRun: 2 }).id, 'tilting');
  assert.equal(wantTrigger({ heat: 60, losingRun: 5 }).id, 'long_grind');
});

test('every trigger clears the documented floors and names a real item', () => {
  for (const t of WANT_TRIGGERS) {
    assert.ok(t.minHeat >= WANT_MIN_HEAT, `${t.id} heat floor`);
    assert.ok(t.minRun >= WANT_MIN_LOSING_RUN, `${t.id} run floor`);
    assert.equal(isItem(t.item), true, `${t.id} item`);
    assert.ok(t.line.length > 0 && t.line.length < 80, `${t.id} line`);
  }
});

test('he asks rarely — the cooldown holds him off', () => {
  const hot = { heat: 90, losingRun: 5 };
  assert.ok(wantTrigger({ ...hot, handsPlayed: 100, lastWantAtHand: null }));
  assert.equal(wantTrigger({ ...hot, handsPlayed: 100, lastWantAtHand: 80 }), null, 'inside the cooldown');
  assert.ok(wantTrigger({ ...hot, handsPlayed: 100, lastWantAtHand: 100 - WANT_COOLDOWN_HANDS }));
});

test('RELATE-1d: nothing about time or absence can produce a want', () => {
  // The signature is the guarantee: heat, run, hands, last-want. No clock, no
  // "last seen", no session gap. Passing them changes nothing.
  const base = { heat: 10, losingRun: 0, handsPlayed: 500 };
  assert.equal(wantTrigger({ ...base, daysSinceLogin: 30, lastSeen: 0, hoursAway: 999 }), null);
  assert.equal(wantTrigger({}), null);
  assert.equal(wantTrigger(), null);
});

// ── the moment ───────────────────────────────────────────────────────────────

test('the want is a moment of its own kind, unanswered to start', () => {
  const w = buildWant(wantTrigger({ heat: 60, losingRun: 2 }), { moodState: 'frustrated' });
  assert.equal(w.kind, 'want');
  assert.equal(w.item, 'beer');
  assert.equal(w.text, "Can I have a beer. It's been rough.");
  assert.equal(w.answered, null);
  assert.equal(w.mood, 'frustrated');
  assert.ok(w.at > 0);
});

test('no trigger, no moment', () => {
  assert.equal(buildWant(null), null);
});

test('no want line pleads, guilts, or asks twice', () => {
  const BAD = /please|pretty please|you never|you owe|why won'?t you|again\?|come on/i;
  for (const t of WANT_TRIGGERS) {
    assert.equal(BAD.test(t.line), false, `${t.id}: "${t.line}"`);
  }
});

// ── the item ─────────────────────────────────────────────────────────────────

test('there is one item, with one effect and no store', () => {
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.equal(item.effect, 'soothe', `${id} must touch STATE, never SKILL`);
    assert.ok(item.priceChips > 0);
    assert.equal(isItem(id), true);
  }
  assert.equal(isItem('nuclear_option'), false);
  assert.equal(isItem(''), false);
  assert.equal(priceOf('nope'), 0);
  assert.equal(isItem(DEFAULT_ITEM), true);
});

test('no item grants anything that touches how well he plays', () => {
  const SKILL = /equity|range|odds|attr|focus|discipline|reads|composure|deception|stamina|edge|win/i;
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.equal(SKILL.test(item.effect), false, `${id} effect touches skill: ${item.effect}`);
  }
});
