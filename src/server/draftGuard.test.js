// src/server/draftGuard.test.js — ATTR-3 rider
//
// The transcript that caused this module is the last test in the file, run
// end to end through the real endpoint. Everything above it is the unit.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';

import {
  DRAFT_MAX_WORDS,
  DRAFT_FALLBACK_LINE,
  sanitizeDraftReply,
  lastGoodDraft,
  isGoSignal,
  slidersFromBrief,
  draftReply,
} from './draftGuard.js';
import { installAgentProfileRoutes } from './agentProfiles.js';

describe('sanitizeDraftReply', () => {
  it('passes an ordinary recruiter line through untouched', () => {
    const line = 'Got it — loose and aggressive. How often should he bluff?';
    const r = sanitizeDraftReply(line);
    assert.equal(r.ok, true);
    assert.equal(r.text, line);
  });

  it('rejects the python class that started all this', () => {
    const raw = '```python\nclass ChaoticAgent:\n    def decide(self, state):\n        return random.choice(ACTIONS)\n```';
    const r = sanitizeDraftReply(raw);
    assert.equal(r.ok, false);
    assert.equal(r.text, null);
  });

  it('rejects code even when it arrives without a fence', () => {
    for (const raw of [
      'def decide(state): return "fold"',
      'function decide(state) { return fold; }',
      'const agent = { tightness: 10 };',
      'class Agent:',
      'import random',
      '{"tightness": 10, "aggression": 90}',
    ]) {
      assert.equal(sanitizeDraftReply(raw).ok, false, `should have rejected: ${raw}`);
    }
  });

  it('rejects a fence with a sentence stapled on top', () => {
    const raw = 'Sure!\n\n```js\nconst x = 1;\n```';
    assert.equal(sanitizeDraftReply(raw).ok, false);
  });

  it('rejects an indented listing', () => {
    assert.equal(sanitizeDraftReply('Here is the plan:\n    step one\n    step two').ok, false);
  });

  it('rejects empty and near-empty output', () => {
    assert.equal(sanitizeDraftReply('').ok, false);
    assert.equal(sanitizeDraftReply('   ').ok, false);
    assert.equal(sanitizeDraftReply(null).ok, false);
    assert.equal(sanitizeDraftReply('ok').ok, false);
  });

  it(`trims a long reply to ${DRAFT_MAX_WORDS} words at a sentence end`, () => {
    const long = `${'He plays a lot of hands and raises with most of them. '.repeat(6)}`;
    const r = sanitizeDraftReply(long);
    assert.equal(r.ok, true);
    assert.ok(r.text.split(/\s+/).length <= DRAFT_MAX_WORDS, 'within the budget');
    assert.ok(/\.$/.test(r.text), 'ends on a full stop, not mid-sentence');
  });

  it('collapses newlines so the reply stays one conversational block', () => {
    const r = sanitizeDraftReply('Loose and aggressive.\nHow often should he bluff?');
    assert.equal(r.ok, true);
    assert.ok(!r.text.includes('\n'));
  });
});

describe('lastGoodDraft', () => {
  it('finds the most recent usable assistant line', () => {
    const chat = [
      { role: 'user', content: 'be chaotic' },
      { role: 'assistant', content: 'Chaotic how — raising everything, or calling everything?' },
      { role: 'user', content: 'lets go' },
      { role: 'assistant', content: '```python\nclass A: pass\n```' },
    ];
    assert.equal(lastGoodDraft(chat), 'Chaotic how — raising everything, or calling everything?');
  });

  it('is null when the recruiter has never said anything usable', () => {
    assert.equal(lastGoodDraft([{ role: 'assistant', content: '```js\nx\n```' }]), null);
    assert.equal(lastGoodDraft([]), null);
  });
});

describe('isGoSignal', () => {
  it('recognises the ways an owner says he is done', () => {
    for (const t of ['lets go', "let's go", 'go', 'do it', 'build it', 'ship it', 'yes', 'ok', 'ready', 'build the agent', 'GO!']) {
      assert.equal(isGoSignal(t), true, `should be GO: ${t}`);
    }
  });

  it('is not fooled by a sentence that merely contains go', () => {
    for (const t of ['go with a tight player who folds a lot', 'I want him to go all in constantly', 'be sporadic and chaotic', '']) {
      assert.equal(isGoSignal(t), false, `should not be GO: ${t}`);
    }
  });
});

describe('slidersFromBrief', () => {
  it('reads "sporadic and chaotic" as loose, aggressive, bluffy, undisciplined', () => {
    const v = slidersFromBrief('be sporadic and chaotic');
    assert.ok(v, 'a vague brief is still a brief');
    assert.equal(v.key, 'chaotic');
    assert.ok(v.profile.tightness < 30, 'loose');
    assert.ok(v.profile.aggression > 80, 'aggressive');
    assert.ok(v.profile.bluffFreq > 50, 'bluffs often');
    assert.ok(v.profile.discipline < 30, 'not much respect for the rules');
  });

  it('says the mapping out loud in one line, so it can be corrected', () => {
    const v = slidersFromBrief('be sporadic and chaotic');
    assert.ok(v.line.split(/\s+/).length <= DRAFT_MAX_WORDS);
    assert.ok(!/\?/.test(v.line), 'a statement, not another question');
  });

  it('maps the other vague briefs too', () => {
    assert.equal(slidersFromBrief('make him scary').key, 'scary');
    assert.equal(slidersFromBrief('something boring and safe').key, 'boring');
    assert.equal(slidersFromBrief('a really smart one').key, 'smart');
  });

  it('is null when the brief says nothing about play', () => {
    assert.equal(slidersFromBrief('call him Steve'), null);
    assert.equal(slidersFromBrief(''), null);
  });
});

describe('draftReply', () => {
  it('prefers a clean model reply', () => {
    const r = draftReply({ raw: 'Loose and aggressive it is. How often should he bluff?' });
    assert.equal(r.source, 'model');
  });

  it('answers a fumbled vague brief with the mapping instead of raw text', () => {
    const r = draftReply({ raw: '```python\nclass A: pass\n```', brief: 'be sporadic and chaotic' });
    assert.equal(r.source, 'brief:chaotic');
    assert.ok(!/```|class/.test(r.text), 'no raw model text ever reaches the caller');
  });

  it('falls back to the last good draft state', () => {
    const chat = [{ role: 'assistant', content: 'Loose or selective — which is he?' }];
    const r = draftReply({ raw: 'def x(): pass', brief: 'call him Steve', chat });
    assert.equal(r.source, 'last-good');
    assert.equal(r.text, 'Loose or selective — which is he?');
  });

  it('falls back to a real question, never an apology', () => {
    const r = draftReply({ raw: '```\n{}\n```' });
    assert.equal(r.text, DRAFT_FALLBACK_LINE);
    assert.ok(!/sorry|wrong|error/i.test(r.text));
  });
});

// ── The transcript ──────────────────────────────────────────────────────────
// No ANTHROPIC_API_KEY here, so callClaude returns null and every reply comes
// from the guard's own fallbacks — which is exactly the path that has to be
// safe, because it is the one a model outage lands on.
describe('the transcript: "be sporadic and chaotic" then "lets go"', () => {
  const userId = 'draft-guard-transcript';

  async function boot() {
    const app = express();
    app.use(express.json());
    installAgentProfileRoutes(app);
    const server = http.createServer(app);
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = async (path, body) => {
      const res = await fetch(base + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: res.status, body: await res.json() };
    };
    return { server, post };
  }

  it('answers the brief in words, then builds an agent that is actually chaotic', async () => {
    const { server, post } = await boot();
    try {
      await post('/api/agents/chat/reset', { userId });

      const first = await post('/api/agents/chat', { userId, content: 'be sporadic and chaotic' });
      assert.equal(first.status, 200);
      const reply = first.body.chat.filter((m) => m.role === 'assistant').pop().content;

      assert.ok(!/```|~~~/.test(reply), 'no code fence');
      assert.ok(!/\bclass\s+\w+|\bdef\s+\w+\(/.test(reply), 'no code');
      assert.ok(reply.split(/\s+/).length <= DRAFT_MAX_WORDS, `at most ${DRAFT_MAX_WORDS} words`);
      assert.ok(!/\?/.test(reply), 'the mapping is stated, not asked about again');
      assert.match(reply, /chaos|loose|aggress|bluff/i, 'it says what it understood');
      assert.equal(first.body.agentId, undefined, 'nothing is built on the first turn');

      const second = await post('/api/agents/chat', { userId, content: 'lets go' });
      assert.equal(second.status, 200);
      assert.ok(second.body.agentId, 'GO builds the agent — this is the "and no profile" half of the bug');

      const agent = second.body.createdAgent;
      assert.ok(agent, 'the built agent comes back with the turn');
      assert.ok(agent.profile, 'it has a profile');
      assert.ok(agent.profile.tightness < 30, `loose: ${agent.profile.tightness}`);
      assert.ok(agent.profile.aggression > 80, `aggressive: ${agent.profile.aggression}`);
      assert.ok(agent.profile.bluffFreq > 50, `bluffs often: ${agent.profile.bluffFreq}`);
      assert.ok(agent.profile.discipline < 30, `undisciplined: ${agent.profile.discipline}`);

      // The character has to match the dials. A chaotic profile wearing the
      // default "calculated, adaptive player" strategy is the same bug wearing
      // a better disguise.
      assert.match(agent.strategy, /chaotic|unpredictable|relentless|bluff/i);
      assert.doesNotMatch(agent.strategy, /calculated, adaptive/i);
      assert.equal(agent.style, 'Aggressive');
      assert.equal(agent.risk, 'High');

      // ATTR-1/3: he is born a character, not just a profile.
      assert.ok(agent.nature?.name, 'he has a nature');
      assert.ok(agent.firstWords, 'he has something to say');
      assert.equal(agent.attrLog.length, 6, 'his log opens with six birth entries');

      const closing = second.body.chat.filter((m) => m.role === 'assistant').pop().content;
      assert.ok(!/```/.test(closing), 'the closing line is not code either');
      assert.ok(closing.split(/\s+/).length <= DRAFT_MAX_WORDS);
    } finally {
      server.close();
    }
  });

  it('never returns raw model text when the model misbehaves', async () => {
    const { server, post } = await boot();
    try {
      await post('/api/agents/chat/reset', { userId: `${userId}-2` });
      const r = await post('/api/agents/chat', { userId: `${userId}-2`, content: 'call him Steve' });
      const reply = r.body.chat.filter((m) => m.role === 'assistant').pop().content;
      assert.ok(!/```|\bdef\s|\bclass\s/.test(reply));
      assert.ok(reply.length > 10);
    } finally {
      server.close();
    }
  });
});
