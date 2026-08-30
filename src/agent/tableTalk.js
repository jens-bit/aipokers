// src/agent/tableTalk.js — TLK-1
// Template-based table talk for AI agents at meaningful hand moments.
// NO model calls — pure data + random selection.
//
// Design law: VISIBLE (talk appears in chat), BOUNDED (never changes range),
// COUNTERABLE (pep talk clears the needled mood event; stoic agents ignore it).

import { normalizeProfile } from './policy.js';

// Minimum hands between talk lines for the same agent.
export const TALK_INTERVAL_HANDS = 8;

// chatSusceptibility thresholds.
export const STOIC_THRESHOLD = 30;
export const SUSCEPTIBLE_THRESHOLD = 50;

// Template lines per trigger. 4-6 lines each for variety.
const TALK_LINES = {
  wonBigPot: [
    'That one was mine.',
    'Chips find their rightful owner.',
    'Stack grows.',
    "I'll take that.",
    'Thank you for your chips.',
    'Right where I wanted it.',
  ],
  lostAsFavorite: [
    'Variance. Just variance.',
    "I had the math. The cards didn't care.",
    'That happens.',
    'Filed under: run bad.',
    'Inevitable, but it stings.',
  ],
  shownBluff: [
    'Caught me. Well played.',
    'Fine, you saw through it.',
    "That's one for you.",
    "Next time I won't show.",
    'Nice read.',
  ],
  cardDead: [
    "Cards aren't coming.",
    'Still waiting.',
    'Fold, fold, fold.',
    'Patience.',
    'Not my deck today.',
  ],
};

// Tilted/sulking voice overrides — louder, more irrational.
const TILTED_LINES = {
  wonBigPot: [
    'Finally. About time.',
    'THERE it is.',
    "Now we're cooking.",
  ],
  lostAsFavorite: [
    'Unbelievable.',
    'Every. Time.',
    'I hate this game.',
  ],
  shownBluff: [
    "I was VALUE-betting! ...okay fine.",
    'Forget you saw that.',
    'That was a probe.',
  ],
  cardDead: [
    'Seriously? Still?',
    'I cannot catch a hand.',
    'Fold. Again. Great.',
  ],
};

// Pick a random line for the trigger and mood state. Tilted/sulking agents
// draw from the louder pool. Returns null for unknown triggers.
export function pickTalkLine(trigger, moodState = 'neutral') {
  const useTilted = moodState === 'tilted' || moodState === 'sulking';
  const pool = (useTilted && TILTED_LINES[trigger]) ? TILTED_LINES[trigger] : TALK_LINES[trigger];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Susceptibility score 0..100 derived from the agent's numeric profile.
// High aggression + low discipline = volatile; tight + stoic = immune.
//   aggression * 0.60 - discipline * 0.40 - tightness * 0.20 + 50
// Neutral profile (50/60/25/50) → ~28; hothead (80/20/-/-) → ~64.
export function chatSusceptibility(profile) {
  const p = normalizeProfile(profile);
  const raw = p.aggression * 0.60 - p.discipline * 0.40 - p.tightness * 0.20 + 50;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// True when the agent is so stoic it ignores table talk entirely.
export function isStoic(profile) {
  return chatSusceptibility(profile) < STOIC_THRESHOLD;
}

// True when talk can needle this agent (queues briefing line + mood event).
export function isSusceptible(profile) {
  return chatSusceptibility(profile) >= SUSCEPTIBLE_THRESHOLD;
}
