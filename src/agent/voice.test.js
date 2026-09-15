// src/agent/voice.test.js — PACE-1c

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  VOICE_MAX_WORDS,
  isSolverSpeak,
  capWords,
  cardPhrase,
  fallbackLine,
  voiceLine,
  actionClause,
  VOICED_ACTION_NATURES,
} from './voice.js';

// The line the live build actually produced, verbatim. It is the reason this
// module exists and it is the one string that must never reach a screen again.
const TODAYS_SOLVER_LINE = 'tight aggressive line—open 3bb standard';

describe('the line that started this', () => {
  it('is recognised as solver speak', () => {
    assert.equal(isSolverSpeak(TODAYS_SOLVER_LINE), true);
  });

  it('never survives to the felt', () => {
    const out = voiceLine(TODAYS_SOLVER_LINE, {
      holeCards: ['Ah', 'Td'],
      action: { type: 'raise', amount: 60 },
    });
    assert.equal(out.source, 'template');
    assert.equal(out.reason, 'solver speak');
    assert.notEqual(out.line, TODAYS_SOLVER_LINE);
    assert.doesNotMatch(out.line, /3bb|standard|line/i);
  });

  it('is replaced by something a person would say', () => {
    const out = voiceLine(TODAYS_SOLVER_LINE, {
      holeCards: ['Ah', 'Td'],
      action: { type: 'raise', amount: 60 },
    });
    assert.match(out.line, /^Ace-ten\./);
    assert.ok(out.line.split(/\s+/).length <= VOICE_MAX_WORDS);
  });
});

describe('isSolverSpeak', () => {
  it('catches sizing notation, study vocabulary and percentages', () => {
    for (const t of [
      'open 3bb standard',
      'c-bet 75% pot here',
      'this is +EV against his range',
      'pot odds say call',
      'GTO would fold',
      'value bet for thin value',
      'villain folds too often',
      'good blockers to the nut flush',
      'my equity is 31%',
      'taking the aggressive line',
      'sizing down on this texture',
    ]) {
      assert.equal(isSolverSpeak(t), true, `should be solver speak: ${t}`);
    }
  });

  it('leaves a human line alone', () => {
    for (const t of [
      "Ace-ten. Fine. Let's see who's home.",
      'He has missed this flop twice already.',
      'Nothing here. Away it goes.',
      'I have been waiting all night for this.',
      "He's bluffing. He always does that.",
    ]) {
      assert.equal(isSolverSpeak(t), false, `should be fine: ${t}`);
    }
  });

  it('is false on nothing at all', () => {
    assert.equal(isSolverSpeak(''), false);
    assert.equal(isSolverSpeak(null), false);
  });
});

describe('capWords', () => {
  it(`caps at ${VOICE_MAX_WORDS} words`, () => {
    const long = 'one two three four five six seven eight nine ten eleven twelve thirteen fourteen';
    assert.ok(capWords(long).split(/\s+/).length <= VOICE_MAX_WORDS);
  });

  it('cuts at a sentence end when there is one', () => {
    const t = 'He missed it. He missed it again and again and again and again and again.';
    assert.equal(capWords(t), 'He missed it.');
  });

  it('leaves a short line untouched', () => {
    assert.equal(capWords('Nothing here. Away it goes.'), 'Nothing here. Away it goes.');
  });

  it('unwraps quotes and labels the model likes to add', () => {
    assert.equal(capWords('"Nothing here."'), 'Nothing here.');
    assert.equal(capWords('Reasoning: Nothing here.'), 'Nothing here.');
    assert.equal(capWords('“Nothing here.”'), 'Nothing here.');
  });

  it('collapses a multi-line answer into one line', () => {
    assert.equal(capWords('Nothing here.\n\nAway it goes.'), 'Nothing here. Away it goes.');
  });
});

describe('cardPhrase', () => {
  it('says a hand the way a person says it', () => {
    assert.equal(cardPhrase(['Ah', 'Td']), 'Ace-ten');
    assert.equal(cardPhrase(['Kc', '4c']), 'King-four suited');
    assert.equal(cardPhrase(['9h', '9s']), 'Pocket nines');
    assert.equal(cardPhrase(['2c', '7d']), 'Seven-two');
  });

  it('puts the higher card first however it was dealt', () => {
    assert.equal(cardPhrase(['Td', 'Ah']), 'Ace-ten');
    assert.equal(cardPhrase(['4c', 'Kc']), 'King-four suited');
  });

  it('is null rather than wrong when it cannot tell', () => {
    assert.equal(cardPhrase(null), null);
    assert.equal(cardPhrase(['Ah']), null);
    assert.equal(cardPhrase(['??', 'Td']), null);
  });
});

describe('fallbackLine', () => {
  it('names the hand and what he did with it', () => {
    assert.equal(fallbackLine({ holeCards: ['Ah', 'Td'], action: { type: 'fold' } }),
      'Ace-ten. Not with this one.');
    assert.equal(fallbackLine({ holeCards: ['9h', '9s'], action: { type: 'raise' } }),
      "Pocket nines. Let's make this expensive.");
  });

  it('still says something when the cards are unknown', () => {
    const line = fallbackLine({ action: { type: 'check' } });
    assert.ok(line.length > 0);
    assert.ok(line.split(/\s+/).length <= VOICE_MAX_WORDS);
  });

  it('is deterministic — a replayed hand says the same thing twice', () => {
    const args = { holeCards: ['Kc', '4c'], action: { type: 'call' } };
    assert.equal(fallbackLine(args), fallbackLine(args));
  });

  it('never speaks solver', () => {
    for (const type of ['fold', 'check', 'call', 'bet', 'raise']) {
      const line = fallbackLine({ holeCards: ['Ah', 'Td'], action: { type } });
      assert.equal(isSolverSpeak(line), false, `${type}: ${line}`);
    }
  });
});

describe('voiceLine', () => {
  it('passes a good line through unchanged', () => {
    const line = "Ace-ten. Fine. Let's see who's home.";
    const out = voiceLine(line, { holeCards: ['Ah', 'Td'], action: { type: 'call' } });
    assert.equal(out.source, 'model');
    assert.equal(out.line, line);
  });

  it('caps a long human line rather than throwing it away', () => {
    const long = 'He has been folding to every single bet I have made all night long here';
    const out = voiceLine(long, { holeCards: ['Ah', 'Td'], action: { type: 'bet' } });
    assert.equal(out.source, 'capped');
    assert.ok(out.line.split(/\s+/).length <= VOICE_MAX_WORDS);
  });

  it('falls back when there is nothing to say', () => {
    for (const raw of ['', '   ', null, undefined, 'ok']) {
      const out = voiceLine(raw, { holeCards: ['Ah', 'Td'], action: { type: 'fold' } });
      assert.equal(out.source, 'template');
      assert.equal(out.line, 'Ace-ten. Not with this one.');
    }
  });

  it('every path it can take is inside the cap and free of solver speak', () => {
    for (const raw of [
      TODAYS_SOLVER_LINE,
      'c-bet 75% pot, +EV against his range, standard sizing on this texture',
      'He folds to everything, so I am taking it right now before he wakes up',
      '',
      "Ace-ten. Fine. Let's see who's home.",
    ]) {
      const out = voiceLine(raw, { holeCards: ['Ah', 'Td'], action: { type: 'raise' } });
      assert.ok(out.line.split(/\s+/).length <= VOICE_MAX_WORDS, `too long: ${out.line}`);
      assert.equal(isSolverSpeak(out.line), false, `solver speak survived: ${out.line}`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// LIFE-2 job 4 — the felt line is his, not the house's
// ═══════════════════════════════════════════════════════════════════════════
//
// The audit this job asked for walked every authored nature table in the
// product — birth words, signatures, openers, rest lines, table talk, name
// suggestions, the want lines — and found them all distinct. It found the
// collision here, in the one table that was never keyed on nature: two agents
// at one felt, both folding, both saying "Not with this one." for the whole
// session. Since COST-1 that is not an edge case either — the compiled policy
// answers a large share of decisions and builds `reasoning` from this file.

describe('LIFE-2: the clause under his ghost is in his own register', () => {
  it('two natures in the same spot do not say the same thing', () => {
    const spot = { holeCards: ['Ah', 'Td'], action: { type: 'fold' } };
    const rock = fallbackLine({ ...spot, nature: 'Rock' });
    const showman = fallbackLine({ ...spot, nature: 'Showman' });
    assert.notEqual(rock, showman);
    // …and both still name the hand, which is the half PACE-1c is about.
    for (const line of [rock, showman]) assert.match(line, /^Ace-ten\./);
  });

  it('every nature has a clause for every action, and no two share one', () => {
    for (const type of ['fold', 'check', 'call', 'bet', 'raise']) {
      const seen = new Map();
      for (const nature of VOICED_ACTION_NATURES) {
        const clause = actionClause(nature, type);
        assert.ok(clause, `${nature} has nothing to say when it ${type}s`);
        assert.equal(seen.has(clause), false,
          `${seen.get(clause)} and ${nature} both say "${clause}" on ${type}`);
        seen.set(clause, nature);
      }
    }
  });

  it('a seat with no nature keeps the house clause it always had', () => {
    // A House regular, an anonymous filler, an agent born before natures
    // existed. PACE-1c's own strings, unchanged.
    assert.equal(fallbackLine({ holeCards: ['Ah', 'Td'], action: { type: 'fold' } }),
      'Ace-ten. Not with this one.');
    assert.equal(fallbackLine({ holeCards: ['9h', '9s'], action: { type: 'raise' } }),
      "Pocket nines. Let's make this expensive.");
    // …and no nature borrows it, so a Rock and a House regular are still two
    // different men at the same table.
    for (const nature of VOICED_ACTION_NATURES) {
      for (const type of ['fold', 'check', 'call', 'bet', 'raise']) {
        assert.notEqual(actionClause(nature, type), actionClause(null, type),
          `${nature}/${type} is the house line`);
      }
    }
  });

  it('is deterministic, and takes the nature in either stored shape', () => {
    const args = { holeCards: ['Kc', '4c'], action: { type: 'call' }, nature: 'Sphinx' };
    assert.equal(fallbackLine(args), fallbackLine(args));
    assert.equal(
      fallbackLine({ ...args, nature: { name: 'Sphinx' } }),
      fallbackLine(args),
    );
  });

  it('never speaks solver, in any voice', () => {
    for (const nature of [...VOICED_ACTION_NATURES, null, 'Wizard']) {
      for (const type of ['fold', 'check', 'call', 'bet', 'raise']) {
        const line = fallbackLine({ holeCards: ['Ah', 'Td'], action: { type }, nature });
        assert.equal(isSolverSpeak(line), false, `${nature}/${type}: ${line}`);
        assert.ok(line.split(/\s+/).length <= VOICE_MAX_WORDS, `${nature}/${type}: ${line}`);
      }
    }
  });

  it('a rejected model line is replaced in HIS voice, not the house one', () => {
    const out = voiceLine('tight aggressive line—open 3bb standard', {
      holeCards: ['Ah', 'Td'], action: { type: 'raise' }, nature: 'Gambler',
    });
    assert.equal(out.source, 'template');
    assert.equal(out.reason, 'solver speak');
    assert.equal(out.line, fallbackLine({ holeCards: ['Ah', 'Td'], action: { type: 'raise' }, nature: 'Gambler' }));
    assert.notEqual(out.line, fallbackLine({ holeCards: ['Ah', 'Td'], action: { type: 'raise' } }));
  });

  it('an unknown nature falls back rather than throwing', () => {
    assert.equal(actionClause('Wizard', 'fold'), actionClause(null, 'fold'));
    assert.equal(actionClause('Rock', 'muck'), null);
    assert.equal(fallbackLine({ action: { type: 'muck' }, nature: 'Rock' }), 'Your move.');
  });
});
