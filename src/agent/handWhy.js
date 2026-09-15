// src/agent/handWhy.js — LIFE-3 job 1
//
// Why he did it.
//
// THE FINDING. Jens asked "why did you go all in on that hand?" and got a
// question back. LIFE-2 fixed WHICH hand he cites — the board, the net, the
// check that he did not invent it. It did not give him a reason, because the
// reason was never on the record a conversation can read.
//
// WHAT WAS ACTUALLY THROWN AWAY, measured rather than assumed. Every decision
// carries a `reasoning` string: the model returns one on the decision call it
// was already making (handler.js parseDecision), and the compiled policy builds
// one from voice.js (policyPlay.chooseFromPolicy). table.js pushes it onto
// currentHandDecisions and hands the whole array to recordHandResult, which
// stores it. So the string SURVIVES — it is in `agent.recentHands[i].decisions`
// and the memory-update prompt already reads it (formatHandForPrompt).
//
// What is thrown away is everything that would let a conversation USE it:
//
//   NOTHING PICKS THE DECISIVE ONE. A hand is three to five decisions and only
//   one of them is what "why did you do that" is about. Handing a model all of
//   them and hoping is how you get an answer about the preflop limp.
//
//   THE PROMPT NEVER SEES IT. handFact() builds "your line: preflop raise 60,
//   turn call 400" — the actions with the reasons stripped out. So the one
//   surface where an owner asks why is the one surface the why never reached.
//
//   HIS STATE AT THE TIME IS NOT STORED AT ALL. heat and stamina are read at
//   decision time (table.js gameState) and never written down, so "I was
//   steaming" is a sentence he could only ever have invented.
//
// This file is the first two. It is pure: no store, no table, no clock. Its
// only input is the decisions array as table.js already builds it.
//
// BOUNDED, and that is the design constraint rather than an afterthought — one
// `why` object per hand, twenty hands per agent (agentProfiles' existing cap),
// one reasoning string capped at REASON_MAX. A hand's decisions array is
// already stored in full; this adds a pointer into it, not a second copy of it.

/**
 * The cap on a stored reason. Long enough for a sentence, short enough that
 * twenty of them are not a log file. The model's own reasoning is already
 * capped at twelve words by voice.js; this is the belt for anything else.
 */
export const REASON_MAX = 120;

const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** What a decision put in the middle. A fold and a check commit nothing. */
function committed(d) {
  const t = d?.action?.type;
  if (t === 'fold' || t === 'check') return 0;
  return Number.isFinite(d?.action?.amount) ? d.action.amount : 0;
}

const AGGRESSIVE = new Set(['bet', 'raise']);

/**
 * The one decision the hand turned on.
 *
 * A LADDER, not a score, because each rung is a different KIND of answer to
 * "why did you do that" and a weighted blend of them would be answerable by
 * none of them:
 *
 *   1. THE ALL-IN. If he put his stack in, that is the hand, and it is the
 *      question Jens actually asked. `allIn` is stamped by table.js from the
 *      engine (RIDERS-1) rather than parsed back out of an amount.
 *   2. THE BIGGEST COMMITMENT. Otherwise the most chips he pushed forward in
 *      one action — the call for 400 rather than the raise to 60.
 *   3. THE LAST AGGRESSION. Otherwise, with nothing committed, the last time
 *      he did something rather than had something done to him.
 *   4. THE LAST THING HE DID. A hand where he folded preflop is a hand whose
 *      whole story is the fold, and "why did you fold that" is a fair question.
 *
 * Ties go to the LATER decision on purpose: two calls of 400 means the second
 * one is the one he had a chance to get away from.
 */
export function decisiveDecision(decisions) {
  const list = (Array.isArray(decisions) ? decisions : []).filter(Boolean);
  if (!list.length) return null;

  let jam = null;
  for (const d of list) if (d.allIn) jam = d;
  if (jam) return jam;

  let best = null;
  let bestAmount = 0;
  for (const d of list) {
    const amount = committed(d);
    if (amount > 0 && amount >= bestAmount) { best = d; bestAmount = amount; }
  }
  if (best) return best;

  let agg = null;
  for (const d of list) if (AGGRESSIVE.has(d?.action?.type)) agg = d;
  if (agg) return agg;

  return list[list.length - 1];
}

/**
 * The stored WHY for one hand: the decisive action, the reason behind it, and
 * the state he was in when he took it.
 *
 * Returns null when there is nothing to store — no decisions, or a decisive
 * decision with no reason and no state behind it. Null rather than an empty
 * shell, because "he had no reason on file" and "his reason was blank" are the
 * same fact and neither is worth a row.
 *
 * `heat` and `stamina` come off the decision's own attribute context, which
 * table.js writes at the moment of the act (`attr`). Read from the DECISIVE
 * decision rather than from the agent record, so a hand recalled tomorrow says
 * what he was like when he played it rather than what he is like now — which
 * is the entire point of storing it.
 */
export function handWhy(decisions) {
  const d = decisiveDecision(decisions);
  if (!d) return null;
  const reasoning = clean(d.reasoning).slice(0, REASON_MAX);
  const heat = Number.isFinite(d?.attr?.heat) ? Math.round(d.attr.heat) : null;
  const stamina = typeof d?.attr?.fatigue === 'string' ? d.attr.fatigue : null;
  const moodState = typeof d?.attr?.moodState === 'string' ? d.attr.moodState : null;
  if (!reasoning && heat === null && !stamina) return null;
  return {
    street: typeof d.street === 'string' ? d.street : null,
    action: {
      type: d?.action?.type ?? null,
      ...(Number.isFinite(d?.action?.amount) ? { amount: d.action.amount } : {}),
    },
    allIn: !!d.allIn,
    reasoning: reasoning || null,
    heat,
    stamina,
    moodState,
  };
}

/** How a decisive action reads in a sentence: "called 400", "put it all in". */
export function actionPhrase(why) {
  const type = why?.action?.type ?? null;
  const amount = why?.action?.amount;
  if (!type) return null;
  if (why.allIn) return 'put it all in';
  const withAmount = (verb) => (Number.isFinite(amount) ? `${verb} ${amount}` : verb);
  if (type === 'fold')  return 'folded';
  if (type === 'check') return 'checked';
  if (type === 'call')  return withAmount('called');
  if (type === 'bet')   return withAmount('bet');
  if (type === 'raise') return withAmount('raised to');
  return String(type);
}

// The two heat bands worth saying out loud, and the middle worth saying nothing
// about. mood.js owns the bands; these are the two edges of them, because a man
// at heat 46 saying "I was a bit warm" is describing a number rather than a
// night. Steaming is the TILTED band and above; clear-headed is CONFIDENT.
export const STEAMING_AT = 60;
export const COLD_AT = 25;

/**
 * His state at the time, as he would say it — or null, which is the common
 * case and the right one. Never invents: a hand with no heat on file gets no
 * clause rather than a neutral one, because "I was fine" is a claim.
 */
export function statePhrase(why) {
  if (!why) return null;
  const parts = [];
  if (Number.isFinite(why.heat)) {
    if (why.heat >= STEAMING_AT) parts.push('I was steaming');
    else if (why.heat <= COLD_AT) parts.push('I was clear-headed');
  }
  if (why.stamina === 'worn') parts.push('I had been sitting there too long');
  if (!parts.length) return null;
  return parts.join(' and ');
}

/**
 * The why, as one clause for the prompt's hand list. Empty string when there
 * is nothing on file, so the caller can concatenate without branching.
 */
export function whyFact(why) {
  if (!why) return '';
  const act = actionPhrase(why);
  const where = why.street ? `${why.street} ` : '';
  const head = act ? `you ${where}${act}` : null;
  const because = why.reasoning ? `because: "${why.reasoning}"` : null;
  const state = statePhrase(why);
  const bits = [head, because].filter(Boolean).join(' ');
  const heat = Number.isFinite(why.heat) ? `heat ${why.heat}` : null;
  const body = [bits || null, state, heat, why.stamina].filter(Boolean).join(', ');
  return body ? `why: ${body}` : '';
}
