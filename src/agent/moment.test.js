// src/agent/moment.test.js — MOOD-2c

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { formatMoment, formatOpener, OPENER_MAX_WORDS } from './moment.js';
import { HEAT_MIDPOINT } from './mood.js';
import { buildAgentChatSystem } from '../server/agentProfiles.js';

const wordsIn = (s) => s.trim().split(/\s+/).filter(Boolean).length;

const BAD_BEAT = [{ flagType: 'badBeat', holeCards: ['Qh', '3d'] }];

describe('formatOpener', () => {
  it('is his voice, not a form letter', () => {
    const line = formatOpener({ mood: { state: 'tilted', heat: 70 }, flagged: BAD_BEAT });
    assert.doesNotMatch(line, /just finished/i);
    assert.doesNotMatch(line, /want to review/i);
    assert.doesNotMatch(line, /^Hey —/);
  });

  it('carries no counts — stats live on the profile', () => {
    for (const state of ['confident', 'neutral', 'frustrated', 'tilted', 'sulking']) {
      for (let seed = 0; seed < 3; seed++) {
        const line = formatOpener({ mood: { state, heat: HEAT_MIDPOINT[state] }, flagged: BAD_BEAT, seed });
        assert.doesNotMatch(line, /\b\d+\s*(hands?|chips?)\b/i, line);
        assert.doesNotMatch(line, /\bwon \d+|lost \d+/i, line);
      }
    }
  });

  it(`is at most ${OPENER_MAX_WORDS} words, whatever the band`, () => {
    for (const state of ['confident', 'neutral', 'frustrated', 'tilted', 'sulking']) {
      for (let seed = 0; seed < 6; seed++) {
        const line = formatOpener({ mood: { state, heat: HEAT_MIDPOINT[state] }, flagged: BAD_BEAT, seed });
        assert.ok(wordsIn(line) <= OPENER_MAX_WORDS, `${wordsIn(line)} words: ${line}`);
      }
    }
  });

  it('names the hand he cannot stop thinking about', () => {
    const line = formatOpener({ mood: { state: 'tilted', heat: 70 }, flagged: BAD_BEAT });
    assert.match(line, /Q3o/);
  });

  it('says it the way the flag means it', () => {
    const bluff = formatOpener({
      mood: { state: 'confident', heat: 10 },
      flagged: [{ flagType: 'bigBluff', holeCards: ['7c', '2d'] }],
    });
    assert.match(bluff, /72o bluff got through/);
    const cooler = formatOpener({
      mood: { state: 'frustrated', heat: 50 },
      flagged: [{ flagType: 'cooler', holeCards: ['Ah', 'Ad'] }],
    });
    assert.match(cooler, /AA was never getting away/);
  });

  it('says something even with nothing flagged', () => {
    const line = formatOpener({ mood: { state: 'neutral', heat: 30 }, flagged: [] });
    assert.ok(wordsIn(line) >= 2);
    assert.doesNotMatch(line, /undefined|null/);
  });

  it('survives a flagged hand it cannot read', () => {
    for (const flagged of [
      [{ flagType: 'badBeat', holeCards: [] }],
      [{ flagType: 'somethingNew', holeCards: ['Qh', '3d'] }],
      [{}],
      null,
    ]) {
      const line = formatOpener({ mood: { state: 'neutral', heat: 30 }, flagged });
      assert.ok(wordsIn(line) >= 2, JSON.stringify(flagged));
      assert.doesNotMatch(line, /undefined|null/);
    }
  });

  it('a cold night and a hot one do not sound alike', () => {
    const cold = formatOpener({ mood: { state: 'confident', heat: 10 }, flagged: BAD_BEAT, seed: 1 });
    const hot = formatOpener({ mood: { state: 'sulking', heat: 90 }, flagged: BAD_BEAT, seed: 1 });
    assert.notEqual(cold, hot);
  });

  it('is stable — a reopened thread does not rewrite itself', () => {
    const args = { mood: { state: 'tilted', heat: 70 }, flagged: BAD_BEAT, seed: 34 };
    assert.equal(formatOpener(args), formatOpener(args));
  });

  it('does not repeat itself across neighbouring sessions', () => {
    const seen = new Set();
    for (let seed = 0; seed < 3; seed++) {
      seen.add(formatOpener({ mood: { state: 'neutral', heat: 30 }, flagged: [], seed }));
    }
    assert.equal(seen.size, 3);
  });

  it('defaults to a level line when it is handed nothing', () => {
    const line = formatOpener();
    assert.ok(wordsIn(line) >= 2);
    assert.ok(wordsIn(line) <= OPENER_MAX_WORDS);
  });
});

// ── Reply tone ──────────────────────────────────────────────────────────────
// The "fixed model stub" is a function that returns the part of the system
// prompt the model would actually be answering from. If two moods hand it the
// same string, no model could tell them apart either.
describe('reply tone reads heat', () => {
  const agentAt = (state, heat) => ({
    id: 'a1',
    name: 'The Closer',
    strategy: 'tight aggressive',
    stats: { handsPlayed: 120, winRate: 52 },
    recentHands: [],
    mood: { state, heat, cause: 'lost as the ~78% favorite' },
  });

  // The stub: whatever the model is told about his state, verbatim.
  const stub = (agent) => buildAgentChatSystem(agent).split('\n').find((l) => l.startsWith('STATE:')) ?? '';

  it('a 90-heat tilt and a 40-heat tilt are told different things', () => {
    const boiling = stub(agentAt('tilted', 90));
    const simmering = stub(agentAt('tilted', 40));
    assert.notEqual(boiling, simmering);
  });

  it('and the difference is the voice, not just the number', () => {
    const boiling = stub(agentAt('tilted', 92));
    const warm = stub(agentAt('tilted', 62));
    assert.match(boiling, /boiling/);
    assert.match(warm, /blunt and unhappy/);
    assert.doesNotMatch(warm, /boiling/);
  });

  it('carries the heat itself, so nothing has to infer it', () => {
    assert.match(stub(agentAt('tilted', 92)), /heat 92\/100/);
  });

  it('says something even when he is level — silence is what invited the customer-service voice', () => {
    const level = stub(agentAt('neutral', 30));
    assert.match(level, /^STATE: neutral/);
    assert.match(level, /level/);
  });

  it('names the cause so the reply can be about the hand', () => {
    assert.match(stub(agentAt('tilted', 70)), /78% favorite/);
  });

  it('tells a sulking agent he has stopped expecting it to turn around', () => {
    assert.match(stub(agentAt('sulking', 85)), /stopped expecting/);
  });

  it('every band produces a distinct instruction', () => {
    const lines = [
      stub(agentAt('confident', 10)),
      stub(agentAt('neutral', 30)),
      stub(agentAt('frustrated', 50)),
      stub(agentAt('tilted', 70)),
      stub(agentAt('tilted', 95)),
    ];
    assert.equal(new Set(lines).size, lines.length);
  });
});

describe('formatMoment still works', () => {
  it('writes a line per hand', () => {
    const m = formatMoment({ won: true, potChips: 800, bb: 20, decisions: [], moodState: 'confident' });
    assert.ok(m.text.length > 0);
    assert.equal(m.mood, 'confident');
  });
});
