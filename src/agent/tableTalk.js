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

// MOOD-2d: past boiling he stops performing and starts snapping. Three lines
// each, deliberately shorter than the tilted pool — a player this far gone does
// not compose a sentence.
const BOILING_LINES = {
  wonBigPot: [
    'About time.',
    'One. Finally.',
    'Took long enough.',
  ],
  lostAsFavorite: [
    'Of course.',
    'This game is rigged.',
    'Deal.',
  ],
  shownBluff: [
    'Whatever.',
    'Take it.',
    'Fine.',
  ],
  cardDead: [
    'Nothing. Again.',
    'Deal me something.',
    'This deck hates me.',
  ],
};

// ── BIO-2c: the relationship talks ─────────────────────────────────────────
// Law 2 of the biography sheet: a relationship changes the line the strip shows
// when they are seated together. A nemesis at the table sharpens him; a victim
// gets the smug ones; a rival gets the needle you save for someone your own
// size.
//
// Split by heat band exactly as the trigger pools are, because "Granite again."
// and "GRANITE. Of course it is." are the same thought at two temperatures.
const ROLE_LINES = {
  nemesis: {
    // {who} is the opponent's display name. The ref's line is "Granite again."
    // — the NAME is the line, so it cannot be baked in.
    seated: [
      '{who} again.',
      '{who}. Of course.',
      'Of course {who} is here.',
    ],
    cool: [
      'You and I have unfinished business.',
      'I remember the last one.',
      'Not this time.',
      'I have been waiting for this seat.',
      'We both know how the last three went.',
    ],
    hot: [
      'Not you. Not again.',
      'Every single time it is you.',
      'I am not paying you tonight.',
      'You have had enough of my chips.',
      'This one is coming back.',
    ],
  },
  rival: {
    seated: [
      '{who} again. Good.',
      '{who}. Here we go.',
      '{who} again. Still nothing between us.',
    ],
    cool: [
      'We are still level. It bothers me too.',
      'Four hundred hands and neither of us is ahead.',
      'One of us has to win eventually.',
      'You are the only one here I have to think about.',
      'Same as always, then.',
    ],
    hot: [
      'Not today. Today I am ahead of you.',
      'I am tired of even.',
      'Break the tie or get out of the way.',
      'One of us is leaving with it.',
      'Enough of this.',
    ],
  },
  victim: {
    seated: [
      'Good. {who} is here.',
      '{who}. My favourite seat at the table.',
      '{who} again. This should go well.',
    ],
    cool: [
      'You fold to the second barrel. Every time.',
      'I know exactly how this ends.',
      'Thank you, as always.',
      'You have been paying for my week.',
      'Do the thing you do.',
    ],
    hot: [
      'Not you as well. Come on.',
      'Even you are getting there tonight.',
      'You do not get to win this one.',
      'Today of all days.',
      'Give it back.',
    ],
  },
};

export const _ROLE_LINES = ROLE_LINES;

/**
 * A line about the relationship rather than about the hand.
 *
 * `kind` is 'seated' for the moment they sit down together, or omitted for a
 * needle chosen by heat band. Returns null for an unknown role, so a caller
 * with no relationship falls through to the ordinary trigger pools.
 */
export function pickRoleLine(role, { heat = null, kind = null, who = null } = {}) {
  const pools = ROLE_LINES[role];
  if (!pools) return null;
  const pool = kind === 'seated'
    ? pools.seated
    : (Number.isFinite(heat) && heat >= TALK_TILTED_HEAT ? pools.hot : pools.cool);
  if (!pool || pool.length === 0) return null;
  const line = pool[Math.floor(Math.random() * pool.length)];
  // A seated line without a name to put in it is not a line. Fall back to the
  // needle pool rather than saying "{who} again." out loud.
  if (line.includes('{who}')) {
    if (!who) return pickRoleLine(role, { heat, kind: null });
    return line.replaceAll('{who}', who);
  }
  return line;
}

// How hot he has to be before the louder pools open. The tilted band starts at
// 60, so the middle pool matches the band exactly; boiling is the top quarter.
export const TALK_TILTED_HEAT = 60;
export const TALK_BOILING_HEAT = 80;

// Pick a line for the trigger and the mood. MOOD-2d: sharpness is chosen by
// HEAT, so a 62 and a 94 do not say the same thing at the table — which is the
// only place a watcher can hear the difference without opening a panel.
//
// Backwards compatible: called with just a state, a tilted or sulking agent
// still draws from the tilted pool exactly as before.
export function pickTalkLine(trigger, moodState = 'neutral', { heat = null, role = null, who = null } = {}) {
  // Heat wins when it is given; the band is only the fallback for a caller
  // that predates it. Otherwise a record whose state and heat disagree would
  // be read two ways at once.
  const banded = moodState === 'tilted' || moodState === 'sulking';
  const hot = Number.isFinite(heat) ? heat : (banded ? TALK_TILTED_HEAT : 0);

  // BIO-2c: when there IS a relationship it is the salient thing at the table,
  // so it wins the line. "Granite again." says more than "That one was mine."
  if (role) {
    const relLine = pickRoleLine(role, { heat: hot, who });
    if (relLine) return relLine;
  }

  let pool = null;
  if (hot >= TALK_BOILING_HEAT) pool = BOILING_LINES[trigger];
  if (!pool && hot >= TALK_TILTED_HEAT) pool = TILTED_LINES[trigger];
  if (!pool) pool = TALK_LINES[trigger];
  if (!pool || pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

// Exposed so a test can assert the pools stay distinct.
export const _TALK_POOLS = { TALK_LINES, TILTED_LINES, BOILING_LINES };

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
