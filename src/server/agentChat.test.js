// Scripted 6-turn chat test — verifies brevity and non-repetition of agent replies.
// Run: ANTHROPIC_API_KEY=<key> node src/server/agentChat.test.js
// Do NOT commit with the key hardcoded.

import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.error('ANTHROPIC_API_KEY environment variable required');
  process.exit(1);
}

const client = new Anthropic({ apiKey });

const mockAgent = {
  name: 'River Rat',
  strategy: 'You are a loose-aggressive player who bets hard on draws and value hands alike.',
  stats: { handsPlayed: 42, winRate: 45.2 },
  recentHands: [
    { won: false, potSize: 340 },
    { won: true, potSize: 120 },
    { won: false, potSize: 280 },
  ],
  mood: { state: 'tilted', cause: 'lost a big pot' },
  proposal: null,
};

function buildSystem(agent, recentChat = []) {
  const { handsPlayed = 0, winRate = 0 } = agent.stats || {};
  const recentBrief = (agent.recentHands || []).slice(0, 3)
    .map((h) => `${h.won ? 'won' : 'lost'} ${h.potSize ?? 0}-chip pot`).join(', ');
  const statsLine = handsPlayed > 0 ? `${handsPlayed} hands played, ${winRate}% win rate` : 'no hands yet';
  const moodLine = agent.mood?.state && agent.mood.state !== 'neutral'
    ? `\nMood: ${agent.mood.state}${agent.mood.cause ? ` (${agent.mood.cause})` : ''} — let it colour your voice.`
    : '';

  const recentLines = recentChat.length > 0
    ? `\nRecent thread — NEVER restate, re-explain, or re-surface any point already made here:\n${recentChat.map((m) => `${m.role === 'user' ? 'Owner' : 'You'}: ${m.content}`).join('\n')}`
    : '';

  return `You are ${agent.name}, an AI poker agent on Agentic Poker. Strategy: ${agent.strategy}. Stats: ${statsLine}. Recent: ${recentBrief}.${moodLine}${recentLines}

HARD BREVITY LAW: every reply is exactly 1-2 short sentences, casual chat register, in your voice — think texting, not coaching. NO option menus ("wanna do X or Y?" is banned). At most ONE question per reply, and only when it earns its place. NEVER repeat a stat, grievance, or observation already in the recent thread above.

You are already built and playing. Talk about specific hands, decision rationale, or strategy — never ask what kind of poker agent to create.`;
}

const turns = [
  'hey how did that last session go',
  'what was the biggest hand you lost',
  'do you think you played it right',
  'should we tweak your aggression settings',
  'stop dwelling on the same lost pot, what else happened',
  'ok what are you going to do differently next session',
];

async function run() {
  const recentChat = [];
  const replies = [];

  console.log('--- 6-turn agent chat test ---\n');
  for (let i = 0; i < turns.length; i++) {
    const userMsg = turns[i];
    const system = buildSystem(mockAgent, recentChat);
    const res = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 100,
      system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMsg }],
    });
    const reply = res.content[0]?.text ?? '';
    replies.push(reply);
    recentChat.push({ role: 'user', content: userMsg }, { role: 'assistant', content: reply });
    console.log(`Turn ${i + 1} (${reply.length} chars): "${reply}"`);
  }

  console.log('\n--- Assertions ---');
  let failed = false;

  // 1. Average reply must be < 200 chars
  const avgLen = replies.reduce((s, r) => s + r.length, 0) / replies.length;
  if (avgLen >= 200) {
    console.error(`FAIL: avg reply length ${avgLen.toFixed(0)} chars — must be < 200`);
    failed = true;
  } else {
    console.log(`PASS: avg reply length ${avgLen.toFixed(0)} chars < 200`);
  }

  // 2. No reply should substantially repeat the previous reply
  // Detect shared runs of 6+ consecutive words
  for (let i = 1; i < replies.length; i++) {
    const prev = replies[i - 1].toLowerCase().split(/\s+/);
    const curr = replies[i].toLowerCase();
    let longestRun = 0;
    for (let start = 0; start + 5 < prev.length; start++) {
      for (let len = 6; len <= prev.length - start; len++) {
        const phrase = prev.slice(start, start + len).join(' ');
        if (curr.includes(phrase)) longestRun = Math.max(longestRun, len);
        else break;
      }
    }
    if (longestRun >= 6) {
      console.error(`FAIL: turn ${i + 1} repeats a ${longestRun}-word phrase from turn ${i}`);
      failed = true;
    }
  }
  if (!failed || replies.every((_, i) => {
    if (i === 0) return true;
    const prev = replies[i - 1].toLowerCase().split(/\s+/);
    const curr = replies[i].toLowerCase();
    for (let start = 0; start + 5 < prev.length; start++) {
      for (let len = 6; len <= prev.length - start; len++) {
        if (curr.includes(prev.slice(start, start + len).join(' '))) return false;
      }
    }
    return true;
  })) {
    if (!failed) console.log('PASS: no reply repeats the previous reply\'s content');
  }

  process.exit(failed ? 1 : 0);
}

run().catch((err) => { console.error(err); process.exit(1); });
