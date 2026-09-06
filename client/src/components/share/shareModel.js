// SHARE-1 — the card's data, and nothing else.
//
// Ref: design-refs/mood-share.jsx. The ref hard-codes a SHARE object and draws
// from it; this is that object, derived from a real flagged hand. Everything
// the card can show is decided here, once, so the DOM preview and the canvas
// export cannot disagree about what they are showing — they read the same
// model and only differ in how they paint it.
//
// The ref's rule, kept: nothing on this card is composed. His line is his own
// last words in the hand, the amount is the pot the server recorded, and the
// name of the hand is read off the cards. No invite code, no referral link, no
// "get your own agent" — "a card that asks for a signup is an ad, and people
// do not forward ads." The only mark is agenticpoker.app.
//
// Input is one entry from GET /api/agents/:id/flagged (buildFlaggedEntry in
// src/server/flaggedHands.js), the same shape the replay theatre plays.

import { buildTimeline } from '../replay/timeline.js';
import { handName } from './handName.js';
import { UNCONTESTED } from '../../lib/handResult.js';

export const MARK = 'agenticpoker.app';

// The mood palette, from MoodGhost. The ghost owns the face; the card uses the
// same colour for the aura behind it and for his line.
export const MOOD_COLOR = {
  confident: '#00D4AA',
  neutral: '#888888',
  frustrated: '#CDB380',
  tilted: '#FF4D4F',
  sulking: '#6B6B6B',
};

// The flag tones, from replay/timeline.js FLAGS.
export const TONE_COLOR = {
  teal: '#00D4AA',
  gold: '#CDB380',
  red: '#FF4D4F',
  purple: '#9B7BFF',
};

export const WON_COLOR = '#00D4AA';
export const LOST_COLOR = '#FF4D4F';

/**
 * The last thing he said in the hand. Same rule as ReplayCard's poster line:
 * never composed — if he said nothing, the card says nothing.
 */
export function talkLine(hand) {
  const streets = Array.isArray(hand?.streets) ? hand.streets : [];
  for (let i = streets.length - 1; i >= 0; i--) {
    const line = streets[i]?.reasoning;
    if (typeof line === 'string' && line.trim()) return line.trim();
  }
  return null;
}

/** −$1,840 / +$3,694. A true minus sign, as everywhere else in the app. */
export function formatAmount(pot, won) {
  const n = Number.isFinite(pot) ? Math.abs(pot) : 0;
  return `${won ? '+' : '−'}$${n.toLocaleString('en-US')}`;
}

/** Only the cards that are actually readable — a card back is not shareable. */
function knownCards(cards) {
  return (Array.isArray(cards) ? cards : [])
    .filter((c) => typeof c === 'string' && c.length >= 2);
}

/**
 * @param {object} hand one flagged-hand entry
 * @param {{ agentName?: string, mood?: string, heat?: number }} who
 * @returns {{
 *   name: string, mood: string, moodColor: string, heat: number,
 *   flag: { label: string, tone: string, color: string },
 *   holeCards: string[], board: string[],
 *   won: boolean, amount: string, hand: string|null, result: string,
 *   resultColor: string, talk: string|null,
 *   stamp: string|null, mark: string,
 * }}
 */
export function buildShareModel(hand, { agentName, mood, heat } = {}) {
  const timeline = buildTimeline(hand);
  // The board as it finished — the last beat is the end of the hand, and its
  // board is the one that decided it.
  const board = knownCards(timeline.beats[timeline.beats.length - 1]?.board);
  const holeCards = knownCards(timeline.holeCards).slice(0, 2);

  const moodKey = MOOD_COLOR[mood] ? mood : 'neutral';
  // BIRTH-4: the poster carries his tier too, so the shared face is the face
  // that was on the felt. The PNG serializes this same node, so both agree.
  const heatValue = Number.isFinite(heat) ? Math.max(0, Math.min(100, heat)) : 45;
  const amount = formatAmount(timeline.pot, timeline.won);
  // Two hole cards and three board cards are the least that names a hand. Show
  // his hand, not the board's — so the name is only offered when his own cards
  // are in it, which is exactly when the API let us see them.
  const named = holeCards.length === 2 && board.length >= 3
    ? handName([...holeCards, ...board])
    : null;
  // WATCH-10 job 3 · the result line names the hand EVERYWHERE, and a pot he
  // took with nobody left to call is still an answer to "with what". The felt
  // has said "uncontested" since BUGS-A job 12; a card off the same hand used
  // to show the amount and nothing, which reads as a hand the app could not
  // work out rather than one nobody contested. Only when he WON: a hand he
  // lost with no showdown is one he folded, and there is nothing to name.
  //
  // "No opponent showdown cards" is the same fact replay/timeline.js already
  // treats as "this hand had no showdown"; the word here is not a second guess,
  // it is that one, said out loud.
  const contested = Array.isArray(hand?.opponentShowdownCards)
    && hand.opponentShowdownCards.length > 0;
  const handWord = named || (timeline.won && !contested ? UNCONTESTED : null);

  return {
    name: (typeof agentName === 'string' && agentName.trim())
      || (typeof hand?.agentName === 'string' && hand.agentName.trim())
      || 'Your agent',
    mood: moodKey,
    moodColor: MOOD_COLOR[moodKey],
    heat: heatValue,
    flag: { ...timeline.flag, color: TONE_COLOR[timeline.flag.tone] ?? TONE_COLOR.teal },
    holeCards,
    board,
    won: timeline.won,
    amount,
    hand: handWord,
    result: handWord ? `${amount} · ${handWord}` : amount,
    resultColor: timeline.won ? WON_COLOR : LOST_COLOR,
    talk: talkLine(hand),
    stamp: timeline.handNumber != null ? `HAND #${timeline.handNumber}` : null,
    mark: MARK,
  };
}

/**
 * The words that travel with the picture — a Telegram caption, a Web Share
 * text, the clipboard fallback on a desktop that can do neither. Same order as
 * the card reads: his line, then who and what it cost, then the mark.
 */
export function shareCaption(model) {
  const parts = [];
  if (model.talk) parts.push(`“${model.talk}”`);
  parts.push(`${model.name} · ${model.result}`);
  parts.push(model.mark);
  return parts.join('\n');
}

/** A filename someone will recognise in their downloads folder. */
export function shareFilename(model) {
  const slug = model.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'agent';
  const hand = model.stamp ? `-${model.stamp.replace(/[^0-9]/g, '')}` : '';
  return `agenticpoker-${slug}${hand}.png`;
}
