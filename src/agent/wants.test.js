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
  wantTrigger, buildWant, isItem,
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
    assert.equal(isItem(id), true);
    // FRIDGE-1: the PRICE is not here any more, and its absence is the point.
    // An item is no longer bought at the moment he asks for one — it comes out
    // of a fridge somebody stocked earlier — so this module knows what the
    // items ARE and nothing about what they cost. The prices live with the
    // fridge that sells them (src/server/fridge.js, and fridge.test.js).
    assert.equal('priceChips' in item, false, `${id} must not carry a price here`);
  }
  assert.equal(isItem('nuclear_option'), false);
  assert.equal(isItem(''), false);
  assert.equal(isItem(DEFAULT_ITEM), true);
});

test('no item grants anything that touches how well he plays', () => {
  const SKILL = /equity|range|odds|attr|focus|discipline|reads|composure|deception|stamina|edge|win/i;
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.equal(SKILL.test(item.effect), false, `${id} effect touches skill: ${item.effect}`);
  }
});

// ═════════════════════════════════════════════════════════════════════════════
// WANTS-1 — the ask layer
// ═════════════════════════════════════════════════════════════════════════════
//
// One test per want (does it fire, and only when it should), one per rule
// (one active, priority replaces, no timer but the snooze), and one per line.
// `askFor` takes plain values, so the whole trigger table is testable without
// an agent, a table or a clock — which is also the structural reason the
// no-guilt guardrail is checkable rather than merely intended.

import {
  ASKS, ASK_KINDS, ASK_LINES,
  ASK_IDLE_MS, ASK_HOT_HEAT, ASK_JUST_LEFT_MS, ASK_BRAG_MULTIPLE,
  ASK_SNOOZE_MS, ASK_REASK_MS,
  askFor, askLine, askSpec, askPriority, buildAsk,
  isAnswered, isActiveWant, isSnoozed, replaces, askSatisfied,
} from './wants.js';

// A man at home with nothing wrong: fresh, cool, solvent, just sat down.
const IDLE = Object.freeze({
  fatigue: 'fresh', atTable: false, idleMs: 0, heat: 20,
  sinceLeftMs: 60 * 60_000, broke: false, sessionNet: null,
  weekBiggestPot: 0, nemesis: null,
});
const NEMESIS = Object.freeze({ name: 'Marlow', room: 'backroom', roomPhrase: 'in the back room', tableId: 't-9' });

// ── one test per want ────────────────────────────────────────────────────────

test('WANTS-1 · worn: he asks to sit one out, and it is the one ask he can make from a seat', () => {
  assert.equal(askFor({ ...IDLE, fatigue: 'worn' }).kind, 'rest');
  // At a table is exactly where being cooked is true, so it fires there too.
  assert.equal(askFor({ ...IDLE, fatigue: 'worn', atTable: true }).kind, 'rest');
  // Settled is not worn. Half-tired is not a request.
  assert.equal(askFor({ ...IDLE, fatigue: 'settled' }), null);
  // And no other ask can be raised from a seat.
  for (const over of [
    { heat: 100 }, { broke: true }, { sessionNet: 9_000, weekBiggestPot: 100 }, { nemesis: NEMESIS },
  ]) {
    assert.equal(askFor({ ...IDLE, atTable: true, ...over }), null,
      `at the table, ${JSON.stringify(over)} must not raise a want`);
  }
});

test('WANTS-1 · idle: fresh and at home for over twenty minutes is "put me in"', () => {
  assert.equal(askFor({ ...IDLE, idleMs: ASK_IDLE_MS + 1 }).kind, 'deploy');
  // The threshold is exclusive, and nineteen minutes is a man who just sat down.
  assert.equal(askFor({ ...IDLE, idleMs: ASK_IDLE_MS }), null);
  assert.equal(askFor({ ...IDLE, idleMs: 19 * 60_000 }), null);
  // Only when he is actually rested — a settled man waiting is not asking.
  assert.equal(askFor({ ...IDLE, fatigue: 'settled', idleMs: ASK_IDLE_MS * 10 }), null);
});

test('WANTS-1 · hot at home: a beer, unless he has only just stood up', () => {
  const hot = { ...IDLE, heat: ASK_HOT_HEAT };
  assert.equal(askFor(hot).kind, 'beer');
  assert.equal(askFor({ ...hot, heat: ASK_HOT_HEAT - 1 }), null, '69 is not hot enough');

  // Straight off the felt he does not want a drink, he wants his seat back —
  // and that ask is born flagged.
  const justLeft = askFor({ ...hot, sinceLeftMs: ASK_JUST_LEFT_MS - 1 });
  assert.equal(justLeft.kind, 'back_in');
  assert.equal(justLeft.dangerous, true);
  // The beer is not dangerous, and it is the only other thing on that rung.
  assert.equal(askFor(hot).dangerous, false);
  assert.equal(askPriority('back_in'), askPriority('beer'));
});

test('WANTS-1 · busted: "front me?"', () => {
  assert.equal(askFor({ ...IDLE, broke: true }).kind, 'fund');
  assert.equal(askFor({ ...IDLE, broke: true }).needs, 'fund');
});

test('WANTS-1 · a night worth telling you about: three times the week\'s biggest pot', () => {
  const big = { ...IDLE, weekBiggestPot: 1_000 };
  assert.equal(askFor({ ...big, sessionNet: 3_000 }).kind, 'brag');
  assert.equal(askFor({ ...big, sessionNet: 2_999 }), null, 'just under the bar is not a story');
  assert.equal(askFor({ ...big, sessionNet: -9_000 }), null, 'losing is never a brag');
  // The bar scales with the stakes he plays, which is the point of measuring
  // against a pot rather than a fixed number of chips.
  assert.equal(askFor({ ...IDLE, weekBiggestPot: 10_000, sessionNet: 3_000 }), null);
  assert.equal(askFor({ ...IDLE, weekBiggestPot: 10_000, sessionNet: 30_000 }).kind, 'brag');
  // No pot on record is no claim — a first session cannot clear a bar of zero.
  assert.equal(askFor({ ...IDLE, weekBiggestPot: 0, sessionNet: 50_000 }), null);
  assert.equal(ASK_BRAG_MULTIPLE, 3);
});

test('WANTS-1 · nemesis: he names the man and the room', () => {
  const ask = askFor({ ...IDLE, nemesis: NEMESIS });
  assert.equal(ask.kind, 'nemesis');
  assert.equal(ask.room, 'backroom');
  assert.equal(ask.tableId, 't-9');
  const want = buildAsk(ask, { nemesisName: NEMESIS.name, roomPhrase: NEMESIS.roomPhrase });
  assert.equal(want.text, 'Marlow is in the back room. Send me.');
  // He cannot be sent anywhere while he is already sitting down.
  assert.equal(askFor({ ...IDLE, atTable: true, nemesis: NEMESIS }), null);
});

// ── the rules ────────────────────────────────────────────────────────────────

test('WANTS-1 · one want: everything true at once still produces exactly one, the highest', () => {
  const everything = {
    fatigue: 'worn', atTable: false, idleMs: ASK_IDLE_MS * 10, heat: 100,
    sinceLeftMs: 0, broke: true, sessionNet: 99_000, weekBiggestPot: 100, nemesis: NEMESIS,
  };
  const ask = askFor(everything);
  assert.equal(ask.kind, 'rest', 'being cooked outranks everything else');
  assert.equal(typeof ask.kind, 'string', 'one ask, not a list');
});

test('WANTS-1 · the priority ladder is the spec\'s order, and it is total', () => {
  assert.deepEqual(
    ASK_KINDS.map((k) => [k, askPriority(k)]),
    [['rest', 1], ['deploy', 2], ['beer', 3], ['back_in', 3], ['fund', 4], ['brag', 5], ['nemesis', 6]],
  );
  // Peeling one condition off at a time walks the ladder down in order.
  const all = {
    fatigue: 'worn', atTable: false, idleMs: ASK_IDLE_MS * 10, heat: 100,
    sinceLeftMs: 60 * 60_000, broke: true, sessionNet: 99_000, weekBiggestPot: 100, nemesis: NEMESIS,
  };
  assert.equal(askFor(all).kind, 'rest');
  assert.equal(askFor({ ...all, fatigue: 'fresh' }).kind, 'deploy');
  assert.equal(askFor({ ...all, fatigue: 'fresh', idleMs: 0 }).kind, 'beer');
  assert.equal(askFor({ ...all, fatigue: 'fresh', idleMs: 0, heat: 10 }).kind, 'fund');
  assert.equal(askFor({ ...all, fatigue: 'fresh', idleMs: 0, heat: 10, broke: false }).kind, 'brag');
  assert.equal(askFor({ ...all, fatigue: 'fresh', idleMs: 0, heat: 10, broke: false, sessionNet: 0 }).kind, 'nemesis');
});

test('WANTS-1 · a new want replaces an older one ONLY if it outranks it', () => {
  const beer = buildAsk(ASKS.beer);
  assert.equal(replaces(ASKS.rest, beer), true, 'sit one out beats a drink');
  assert.equal(replaces(ASKS.deploy, beer), true);
  assert.equal(replaces(ASKS.fund, beer), false, 'lower priority is dropped, not queued');
  assert.equal(replaces(ASKS.brag, beer), false);
  assert.equal(replaces(ASKS.beer, beer), false, 'the same ask does not restate itself');
  // back_in and beer share a rung, so neither displaces the other.
  assert.equal(replaces(ASKS.back_in, beer), false);
  // Nothing pending: anything lands.
  assert.equal(replaces(ASKS.nemesis, null), true);
  // Answered is not pending.
  const answered = buildAsk(ASKS.rest);
  answered.answered = 'no';
  assert.equal(replaces(ASKS.nemesis, answered), true);
});

test('WANTS-1 · no timer: an unanswered want is still there a week later, saying the same thing', () => {
  const now = 1_700_000_000_000;
  const want = buildAsk(ASKS.fund, { now });
  const aWeekOn = now + 7 * 24 * 60 * 60_000;
  assert.equal(isActiveWant(want, { now: aWeekOn }), true);
  assert.equal(want.text, buildAsk(ASKS.fund, { now: aWeekOn }).text, 'and it has not soured');
  // The guardrail as a property of askSatisfied: no branch of it reads a
  // clock, so nothing but the world giving him what he asked for clears it.
  assert.equal(askSatisfied(want, { broke: true }), false, 'still broke, still asking');
  assert.equal(askSatisfied(want, { broke: false }), true, 'staked — the ask is over');
  assert.equal(askSatisfied.length <= 2, true, 'askSatisfied takes a want and a state, never a time');
});

test('WANTS-1 · later is the only clock, and it brings back the SAME want', () => {
  const now = 1_700_000_000_000;
  const want = buildAsk(ASKS.beer, { now });
  want.snoozedUntil = now + ASK_SNOOZE_MS;

  assert.equal(isActiveWant(want, { now: now + 1 }), false, 'quiet during the snooze');
  assert.equal(isSnoozed(want, { now: now + 1 }), true);
  assert.equal(isAnswered(want), false, 'later is not an answer');

  assert.equal(isActiveWant(want, { now: now + ASK_SNOOZE_MS + 1 }), true, 'and it comes back by itself');
  assert.equal(ASK_SNOOZE_MS, 30 * 60_000);
  // A snoozed want is still pending, so it is not a door for a lower ask.
  assert.equal(replaces(ASKS.brag, want), false);
  // But being cooked still gets through.
  assert.equal(replaces(ASKS.rest, want), true);
});

test('WANTS-1 · the world can answer a want too, and only by giving him what he asked for', () => {
  assert.equal(askSatisfied(buildAsk(ASKS.deploy), { atTable: true }), true);
  assert.equal(askSatisfied(buildAsk(ASKS.deploy), { atTable: false }), false);
  assert.equal(askSatisfied(buildAsk(ASKS.rest), { atTable: false, fatigue: 'fresh' }), true);
  assert.equal(askSatisfied(buildAsk(ASKS.rest), { atTable: false, fatigue: 'worn' }), false);
  assert.equal(askSatisfied(buildAsk(ASKS.beer), { heat: 10 }), true);
  assert.equal(askSatisfied(buildAsk(ASKS.beer), { heat: 90 }), false);
  // A story is the one thing only you can give him.
  assert.equal(askSatisfied(buildAsk(ASKS.brag), { atTable: true, broke: false, heat: 0, fatigue: 'fresh' }), false);
});

// ── the lines ────────────────────────────────────────────────────────────────

test('WANTS-1 · every kind has a line, and it is a template — never a model call', () => {
  for (const kind of ASK_KINDS) {
    const line = askLine(kind, { nemesisName: 'Marlow', roomPhrase: 'upstairs' });
    assert.equal(typeof line, 'string', `${kind} has no line`);
    assert.ok(line.length > 0 && line.length < 90, `${kind} line length: "${line}"`);
    assert.ok(askSpec(kind), `${kind} has no spec`);
  }
  // The canonical line of each kind is the first alternate, which is what the
  // trigger tests above read.
  assert.equal(askLine('rest', { seed: 0 }), ASK_LINES.rest[0]);
  assert.equal(askLine('deploy', { seed: 0 }), 'Put me in.');
  assert.equal(askLine('beer', { seed: 0 }), 'Get me a beer.');
  assert.equal(askLine('back_in', { seed: 0 }), "Let me back in there, I'm fine.");
  assert.equal(askLine('fund', { seed: 0 }), 'Front me?');
  assert.equal(askLine('brag', { seed: 0 }), 'You have to hear about this hand.');
});

test('WANTS-1 · the line is deterministic — a reopened screen does not rewrite what he said', () => {
  for (const seed of [0, 1, 7, 412]) {
    assert.equal(askLine('beer', { seed }), askLine('beer', { seed }));
  }
  assert.notEqual(askLine('beer', { seed: 0 }), askLine('beer', { seed: 1 }));
});

test('WANTS-1 · a nemesis line without a name or a room is no line at all', () => {
  // Better silent than "undefined is in undefined. Send me."
  assert.equal(askLine('nemesis', { nemesisName: 'Marlow' }), null);
  assert.equal(askLine('nemesis', { roomPhrase: 'upstairs' }), null);
  assert.equal(buildAsk(ASKS.nemesis, {}), null);
});

test('WANTS-1 · the re-ask cooldown is about the NEXT want, not the one on the table', () => {
  // An hour of quiet per kind after yes or no, so "no" to a beer at heat 74 is
  // not followed thirty seconds later by another beer at heat 74.
  assert.ok(ASK_REASK_MS > ASK_SNOOZE_MS, 'a snooze must come back before the same question may be re-asked');
  assert.equal(ASK_REASK_MS, 60 * 60_000);
});
