// src/agent/ownerHands.js — LIFE-1 job 6
//
// The hand he just played against YOU.
//
// "He comments on the owner's actual play afterwards — 'you folded that? I had
// nothing' — using the real hand, and he can be asked about it later."
//
// WHY THERE WAS NOTHING TO COMMENT ON. table.js's hand-completion loop splits
// on `this.home`, and the split is deliberate and mostly right: a hand at the
// kitchen table writes the BIOGRAPHY (who he sat with, what they did to him)
// but not the EVIDENCE and not the career record, because an evening in is not
// a hand of poker he played for anyone. The consequence nobody wanted is that
// `recordHandResult` is inside the `if (!this.home)`, so the one hand an owner
// most wants talked about — the one he was IN — was the only hand in the
// product that left no trace at all.
//
// This is that trace, and it is deliberately a THIRD book rather than a
// loosening of the split. What it holds is not his poker record and not his
// read on an opponent: it is the small number of hands he has played against
// the person holding the phone, from his side, with what YOU did in them.
// Keeping it separate is what lets the career record stay honest about what a
// kitchen game is while the conversation still knows the hand happened.
//
// FOUR RULES.
//
//   1. BOUNDED, NEWEST FIRST. OWNER_HANDS_MAX, oldest evicted. Same shape as
//      every other memory here and for the same reason.
//   2. ONLY WHAT WAS TRUE AT THE TABLE. Every field is written from the engine
//      result. Nothing in this file infers a holding, and the comment can only
//      name cards that were actually shown or that are his own.
//   3. THE COMMENT IS A TEMPLATE. No model call, ever. The kitchen table's
//      standing rule (handTalk.js rule 2) is that home gets templates and
//      nothing else, and a line about the owner's own play is not the place to
//      start making an exception.
//   4. IT IS ABOUT HIS PLAY, NOT ABOUT THE CARDS. "You folded that? I had
//      nothing" is interesting because it is a judgement on a decision the
//      owner made. A line that recites the board is a hand history.

export const OWNER_HANDS_MAX = 6;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

export function ensureOwnerHands(agent) {
  if (!Array.isArray(agent.ownerHands)) agent.ownerHands = [];
  return agent.ownerHands;
}

/**
 * File one hand played against the owner.
 *
 * Returns the stored entry, or null when there is not enough to be worth
 * keeping — a hand the owner was not dealt into is not a hand between you.
 */
export function recordOwnerHand(agent, entry, { now = Date.now() } = {}) {
  if (!agent || !entry) return null;
  if (!Array.isArray(entry.ownerActions) || entry.ownerActions.length === 0) return null;
  const stored = {
    at: now,
    handNumber: entry.handNumber ?? null,
    ownerName: clean(entry.ownerName) || 'you',
    ownerActions: entry.ownerActions.map((a) => ({
      street: a?.street ?? '?',
      type: a?.type ?? '?',
      ...(Number.isFinite(a?.amount) ? { amount: Math.round(a.amount) } : {}),
    })),
    ownerFolded: !!entry.ownerFolded,
    ownerWon: !!entry.ownerWon,
    ownerShowed: Array.isArray(entry.ownerShowed) && entry.ownerShowed.length
      ? [...entry.ownerShowed] : null,
    mine: Array.isArray(entry.mine) ? [...entry.mine] : [],
    myHand: clean(entry.myHand) || null,
    board: Array.isArray(entry.board) ? [...entry.board] : [],
    pot: Number.isFinite(entry.pot) ? Math.round(entry.pot) : 0,
    iWon: !!entry.iWon,
    showdown: !!entry.showdown,
  };
  const list = ensureOwnerHands(agent);
  list.unshift(stored);
  if (list.length > OWNER_HANDS_MAX) list.length = OWNER_HANDS_MAX;
  return stored;
}

/** The last hand between the two of you, or null. */
export function lastOwnerHand(agent) {
  return ensureOwnerHands(agent ?? {})[0] ?? null;
}

// ── What he says about it ───────────────────────────────────────────────────
//
// A ladder, and the order is the order of what is worth saying. Each rung is a
// judgement on a decision the owner made; the cards are evidence for the
// judgement rather than the point of the line.

// Was what he was holding actually nothing? Only ever asked of HIS OWN hand,
// so this can never leak an opponent's cards. The label comes from the engine
// (plainHandName) — this file does not evaluate anything.
function wasNothing(myHand) {
  return !myHand || /^(?:high card|ace high|king high|queen high|jack high)/i.test(myHand);
}

const aggressive = (a) => a?.type === 'bet' || a?.type === 'raise';

/**
 * His line about the hand, or null when there is nothing worth saying.
 *
 * Null is a real answer and a common one: most hands are a fold preflop and a
 * shrug, and an agent who produces a remark after every single one of them is
 * the table-talk pathology TLK-1 already capped once.
 */
export function ownerHandComment(entry) {
  if (!entry) return null;
  const acts = entry.ownerActions ?? [];
  const last = acts[acts.length - 1] ?? null;
  const streets = new Set(acts.map((a) => a.street));
  const sawFlop = streets.has('flop') || streets.has('turn') || streets.has('river');

  // He bluffed you off it and you will never know unless he tells you. The
  // line the job names, and the best one in the list.
  if (entry.ownerFolded && entry.iWon && !entry.showdown && sawFlop && wasNothing(entry.myHand)) {
    return `You folded that? I had nothing. ${entry.pot} chips for a story.`;
  }

  // You folded and he had it. Worth saying because it tells you your read was
  // right, which is the only way a fold ever gets confirmed.
  if (entry.ownerFolded && entry.iWon && entry.myHand && !wasNothing(entry.myHand)) {
    return `Good fold. I had ${entry.myHand.toLowerCase()}.`;
  }

  // You folded before it ever got going.
  if (entry.ownerFolded && !sawFlop) {
    return null;   // a preflop fold is not an event
  }

  // You paid him off.
  if (entry.iWon && entry.showdown) {
    const yours = entry.ownerShowed?.length ? ` against ${entry.ownerShowed.join(' ')}` : '';
    return `You called me down${yours}. I had ${entry.myHand ? entry.myHand.toLowerCase() : 'the better one'}.`;
  }

  // You beat him at showdown.
  if (entry.ownerWon && entry.showdown) {
    return entry.myHand
      ? `You had me. I was drawing at it with ${entry.myHand.toLowerCase()}.`
      : 'You had me there.';
  }

  // You bet him off it. He is not thrilled about it.
  if (entry.ownerWon && !entry.showdown && acts.some(aggressive)) {
    const size = Number.isFinite(last?.amount) ? ` That ${last.amount} did it.` : '';
    return `I folded.${size} I hope you had it.`;
  }

  // You checked it all the way down and won anyway.
  if (entry.ownerWon && acts.every((a) => a.type === 'check' || a.type === 'call')) {
    return 'You never bet once and still took it. That is one way to play.';
  }

  return null;
}

/**
 * The prompt block, so he can be asked about it later.
 *
 * Only the two most recent, and only the facts: the point is that he can
 * answer "why did you bet the turn there" three hours afterwards, not that he
 * has a transcript to read out.
 */
export function ownerHandsContext(agent) {
  const list = ensureOwnerHands(agent ?? {});
  if (list.length === 0) return '';
  const lines = list.slice(0, 2).map((h) => {
    const yours = h.ownerActions.map((a) => `${a.street} ${a.type}${Number.isFinite(a.amount) ? ` ${a.amount}` : ''}`).join(', ');
    const mine = h.mine.length ? h.mine.join(' ') : 'unknown';
    const board = h.board.length ? h.board.join(' ') : 'no board';
    return `- Hand ${h.handNumber ?? '?'} at your kitchen table, pot ${h.pot}. `
      + `You held ${mine}${h.myHand ? ` (${h.myHand})` : ''}; board ${board}. `
      + `HE played it: ${yours}. `
      + `${h.ownerFolded ? 'He folded.' : h.ownerWon ? 'He won it.' : 'You won it.'}`
      + `${h.ownerShowed ? ` He showed ${h.ownerShowed.join(' ')}.` : ''}`;
  });
  return `

HANDS YOU HAVE PLAYED AGAINST YOUR OWNER, newest first. You were both at the
kitchen table for these and you remember them. If he asks about one, talk
about HIS play in it — what he did and what you thought of it — not the board.
Never claim to have seen a card that is not listed here.
${lines.join('\n')}`;
}
