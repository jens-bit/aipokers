// src/server/draftScript.test.js — BUG-198
//
// The template recruiter's script. Everything here is about the two failures
// BUG-198 was filed for:
//
//   1. Every chip label the design offers — Tight, Balanced, Loose, Rarely,
//      Sometimes, Often, Fold, Call it down, Push — failed to advance the
//      draft, because the old path needed TWO nature signals and a single word
//      only ever carries one.
//   2. A miss appended DRAFT_FALLBACK_LINE verbatim, so the recruiter asked the
//      identical question again, forever.
//
// The contract below is what makes both impossible.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  STAGES,
  STAGE_KEYS,
  chipsFor,
  questionFor,
  readAnswer,
  restate,
  profileFromAnswers,
  nextStage,
  isComplete,
  MISS_LINE,
} from './draftScript.js';

describe('BUG-198 — every chip label advances its own stage', () => {
  // The whole bug, as one table. Before the repair not one of these matched.
  const CHIP_VALUES = {
    style: { Tight: 'tight', Balanced: 'balanced', Loose: 'loose' },
    bluffing: { Rarely: 'rarely', Sometimes: 'sometimes', Often: 'often' },
    unsure: { Fold: 'fold', 'Call it down': 'call', Push: 'push' },
  };

  for (const key of ['style', 'bluffing', 'unsure']) {
    it(`${key}: each chip is understood as its own answer`, () => {
      const chips = chipsFor(key);
      assert.deepEqual(chips, Object.keys(CHIP_VALUES[key]),
        `the chips offered for ${key} must be exactly the ones the design names`);
      for (const chip of chips) {
        const heard = readAnswer(chip, { stage: key });
        assert.equal(heard[key], CHIP_VALUES[key][chip],
          `tapping "${chip}" must answer ${key}`);
      }
    });
  }

  it('a chip tap fills its stage and nothing else', () => {
    // "Balanced" is a word two stages could claim. The one being asked wins,
    // so a tap can never silently answer a question nobody asked.
    const heard = readAnswer('Balanced', { stage: 'style' });
    assert.equal(heard.style, 'balanced');
    assert.equal(heard.bluffing, undefined);
  });
});

describe('BUG-198 — free text is matched loosely', () => {
  const HITS = [
    ['loose', 'style', 'loose'],
    ['Loose', 'style', 'loose'],
    ['LOOSE', 'style', 'loose'],
    ['pretty loose I think', 'style', 'loose'],
    ['selective', 'style', 'tight'],
    ['tight', 'style', 'tight'],
    ['passive', 'style', 'tight'],
    ['aggressive', 'style', 'loose'],
    ['never', 'bluffing', 'rarely'],
    ['often', 'bluffing', 'often'],
    ['he bluffs a lot', 'bluffing', 'often'],
    ['fold', 'unsure', 'fold'],
    ['call it down', 'unsure', 'call'],
    ['push', 'unsure', 'push'],
  ];

  for (const [text, stage, want] of HITS) {
    it(`"${text}" answers ${stage} as ${want}`, () => {
      assert.equal(readAnswer(text, { stage })[stage], want);
    });
  }

  it('forgives a couple of common misspellings', () => {
    // Not a spell checker — the handful somebody actually types.
    assert.equal(readAnswer('lose', { stage: 'style' }).style, 'loose');
    assert.equal(readAnswer('agressive', { stage: 'style' }).style, 'loose');
    assert.equal(readAnswer('tigth', { stage: 'style' }).style, 'tight');
    assert.equal(readAnswer('ofen', { stage: 'bluffing' }).bluffing, 'often');
  });

  it('one sentence can answer more than one question', () => {
    // The restated example from the brief: "Loose, bluffs often. Got it."
    const heard = readAnswer('loose and bluffs often', { stage: 'style' });
    assert.equal(heard.style, 'loose');
    assert.equal(heard.bluffing, 'often');
  });

  it('hears the "not" in front of the word', () => {
    // "not often" contains "often", and taking the longest token would read it
    // as its own opposite — the one misreading that turns a working draft into
    // a character the owner explicitly asked against.
    assert.equal(readAnswer('not often', { stage: 'bluffing' }).bluffing, 'rarely');
    assert.equal(readAnswer('not much', { stage: 'bluffing' }).bluffing, 'rarely');
    assert.equal(readAnswer('not really', { stage: 'bluffing' }).bluffing, 'rarely');
  });

  it('the bare word "bluff" is not a frequency', () => {
    // It is the subject of the question, not an answer to it. Reading it as
    // "often" would make "rarely bluffs" and "bluffs" mean the same thing.
    assert.deepEqual(readAnswer('bluff', { stage: 'bluffing' }), {});
    assert.equal(readAnswer('rarely bluffs', { stage: 'bluffing' }).bluffing, 'rarely');
    assert.equal(readAnswer('never bluffs', { stage: 'bluffing' }).bluffing, 'rarely');
    assert.equal(readAnswer('bluffs a lot', { stage: 'bluffing' }).bluffing, 'often');
  });

  it('a word two stages share never answers the stage nobody asked', () => {
    // "Balanced" is a style and a bluffing frequency. Asked about bluffing it
    // is a frequency and ONLY a frequency; it must not also decide his style.
    const asBluff = readAnswer('balanced', { stage: 'bluffing' });
    assert.equal(asBluff.bluffing, 'sometimes');
    assert.equal(asBluff.style, undefined);

    const asStyle = readAnswer('balanced', { stage: 'style' });
    assert.equal(asStyle.style, 'balanced');
    assert.equal(asStyle.bluffing, undefined);
  });

  it('a miss is a miss, and says so without a question', () => {
    const heard = readAnswer('banana', { stage: 'style' });
    assert.equal(Object.keys(heard).length, 0);
    assert.ok(!/\?/.test(MISS_LINE), 'the miss line must not ask anything');
    assert.match(MISS_LINE, /Tap one/i);
  });
});

describe('BUG-198 — the recruiter restates what it heard', () => {
  it('names both facts it just took', () => {
    assert.equal(restate({ style: 'loose', bluffing: 'often' }), 'Loose, bluffs often. Got it.');
  });

  it('names one when it only heard one', () => {
    assert.equal(restate({ style: 'tight' }), 'Tight. Got it.');
  });

  it('has nothing to say when it heard nothing', () => {
    assert.equal(restate({}), null);
  });
});

describe('BUG-198 — the draft never asks the same question twice in a row', () => {
  it('advances past every stage already answered', () => {
    assert.equal(nextStage({}), 'style');
    assert.equal(nextStage({ style: 'loose' }), 'bluffing');
    // One sentence answered two, so the next question skips the one it filled.
    assert.equal(nextStage({ style: 'loose', bluffing: 'often' }), 'unsure');
    assert.equal(nextStage({ style: 'loose', bluffing: 'often', unsure: 'push' }), 'name');
  });

  it('is complete once the three playing questions are answered', () => {
    assert.equal(isComplete({ style: 'loose', bluffing: 'often' }), false);
    assert.equal(isComplete({ style: 'loose', bluffing: 'often', unsure: 'push' }), true);
  });

  it('finishes in four answers', () => {
    // Four taps, and the fourth is his name. Any more is the bug.
    const answers = {};
    const taps = [];
    for (let i = 0; i < 10; i++) {
      const stage = nextStage(answers);
      if (stage === 'name') break;
      const chip = chipsFor(stage)[0];
      taps.push(chip);
      Object.assign(answers, readAnswer(chip, { stage }));
    }
    assert.equal(taps.length, 3, 'three playing questions, then the name');
    assert.equal(nextStage(answers), 'name');
  });

  it('every stage has a question and a distinct one', () => {
    const asked = STAGE_KEYS.filter((k) => k !== 'name').map(questionFor);
    assert.equal(asked.length, 3);
    assert.equal(new Set(asked).size, 3, 'two stages must never share a question');
    for (const q of asked) assert.ok(q.trim().length > 0);
  });
});

describe('BUG-198 — the answers become a profile the rest of the product already reads', () => {
  it('produces the four dials', () => {
    const p = profileFromAnswers({ style: 'loose', bluffing: 'often', unsure: 'push' });
    for (const k of ['tightness', 'aggression', 'bluffFreq', 'discipline']) {
      assert.equal(typeof p[k], 'number', `${k} must be a number`);
      assert.ok(p[k] >= 0 && p[k] <= 100, `${k} must be 0..100, got ${p[k]}`);
    }
  });

  it('tight and loose are not the same man', () => {
    const tight = profileFromAnswers({ style: 'tight', bluffing: 'rarely', unsure: 'fold' });
    const loose = profileFromAnswers({ style: 'loose', bluffing: 'often', unsure: 'push' });
    assert.ok(tight.tightness > loose.tightness);
    assert.ok(loose.bluffFreq > tight.bluffFreq);
    assert.ok(loose.aggression > tight.aggression);
  });

  it('an incomplete draft still yields a usable profile', () => {
    // Stage 4 offers a name before the dials are perfect; nothing may be NaN.
    const p = profileFromAnswers({ style: 'balanced' });
    for (const k of ['tightness', 'aggression', 'bluffFreq', 'discipline']) {
      assert.ok(Number.isFinite(p[k]), `${k} must be finite on a partial draft`);
    }
  });
});

describe('BUG-198 — the script is data, and stays honest', () => {
  it('has exactly the four stages the sheet counts', () => {
    assert.deepEqual(STAGE_KEYS, ['style', 'bluffing', 'unsure', 'name']);
    assert.equal(STAGES.length, 4);
  });

  it('the name stage offers no chips, because it offers a field', () => {
    assert.deepEqual(chipsFor('name'), []);
  });
});
