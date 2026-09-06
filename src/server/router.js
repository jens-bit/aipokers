// src/server/router.js — COST-1
//
// Which decisions are worth paying for.
//
// Every AI turn in this product was a model call. That is the right answer for
// the hand that matters and a ridiculous one for the seventh consecutive 72o
// in the big blind, and the two were indistinguishable to the server: 100
// hands of heads-up poker cost the same whether anything happened in them or
// not. The bill was flat because the ATTENTION was flat.
//
// So before every decision the server now asks a question it can answer for
// free: is this spot decided already?
//
//   margin   |equity − pot odds|. How far the hand is from the price.
//   options  how many legal actions the compiled policy cannot separate
//            (rated within OPTION_BAND of each other — see policyPlay.js).
//
// A spot with a big margin and one option is not a decision, it is arithmetic,
// and the compiled policy does arithmetic for nothing. Everything else — every
// close spot, every big pot, every river, every all-in, a man on tilt, a read
// on the wire, a nemesis in the seat opposite — goes to the model, because
// those are the hands somebody is going to watch.
//
// Three rules the shape of this file comes from:
//
//   1. THE GATES ARE ALL-OR-NOTHING AND THEY ARE ALL "SPEND". Four conditions
//      have to hold at once for the cheap path, and any one of a longer list
//      sends it to the model. That asymmetry is deliberate: the failure mode
//      of routing a hard spot to the policy is a character playing badly in
//      front of his owner, and the failure mode of routing an easy spot to the
//      model is a tenth of a cent. They are not the same size of mistake, so
//      they do not get the same benefit of the doubt.
//
//   2. THE REASON IS PART OF THE ANSWER. Every route carries the reason it
//      took, because "we saved 60% of the calls" is not a finding until you
//      can say WHICH calls, and because a route that starts sending rivers to
//      the policy should be visible in a log rather than in a bill.
//
//   3. TILT IS NOT NEGOTIABLE. Past HEAT_MAX everything goes to the model,
//      including the folds. A tilted agent is the one time the interesting
//      thing about a hand is not the hand — it is him — and a template line
//      attached to a compiled fold cannot do that. This is the one gate that
//      costs money on purpose.
//
// One word in the brief that had to be read carefully: "a read on the wire".
// Taken as "he has a formed read", the gate fires on every decision from hand
// ten onwards — heads-up there is always a read, so the router would have sent
// three quarters of everything to the model and saved almost nothing
// (measured: 34 of 59 decisions in a 40-pair arena run). ON THE WIRE means what
// it says: a READ message has just gone out, because the picture of that
// opponent CHANGED (see Table._maybeBroadcastReads, which broadcasts on the
// fingerprint changing and not on the read existing). A read that has been true
// for thirty hands is background; a read that just moved is news, and news is
// what is worth paying to react to.
//
// Pure: no clock, no randomness, no I/O. Everything arrives on the game state
// table.js already builds.
//
// It lives in src/server rather than next to policyPlay.js in src/agent
// because every gate above the margin is a SERVER fact — the pot in blinds
// against PACE_HEAT_BB, his stored mood, the reads the table has formed, the
// needle somebody queued, whether this is the kitchen table. src/agent has
// never imported src/server and this is not the file to start with: it would
// have meant a second definition of PACE_HEAT_BB, and one dial with two
// readings is worse than one import in the wrong direction.

import { marginOf, rateActions, countOptions } from '../agent/policyPlay.js';
import { heatThresholdBb, potInBb } from './pace.js';

export const Route = Object.freeze({
  POLICY: 'policy',
  MODEL: 'model',
});

/** Why a decision went where it went. Closed set — the log and the meter both
 *  switch on it, so a sixth reason means teaching both. */
export const Reason = Object.freeze({
  // → policy
  CLEAR: 'clear',          // big margin, one option, small pot, level head
  HOME: 'home',            // the kitchen table never calls a model, ever
  // → model
  OFF: 'off',              // the router is switched off; everything is a call
  BLIND: 'blind',          // no equity estimate — nothing here can judge it
  RIVER: 'river',          // last street, last chance, nothing left to learn
  ALLIN: 'allin',          // a stack is in the middle
  BIG_POT: 'bigPot',       // past PACE_HEAT_BB the felt is warm and so is he
  HEAT: 'heat',            // he is on tilt; see rule 3
  NEMESIS: 'nemesis',      // the man he has history with is at the table
  READ: 'read',            // a read on him has just changed — act on it now
  TALK: 'talk',            // somebody said something to him
  CLOSE: 'close',          // margin under MARGIN_MIN — the hand is near the price
  OPTIONS: 'options',      // the policy cannot separate two actions
});

// The margin at which a spot stops being a decision. A quarter is wide: with
// EDGE_WEIGHT at 180 it is the point where the compiled policy rates the
// passive line at ~95 and giving up at ~5, which is not an opinion, it is a
// fact about the price.
export const MARGIN_MIN = Number(process.env.ROUTE_MARGIN_MIN ?? 0.25);

// More than one option and the policy has no view worth acting on alone.
export const OPTIONS_MAX = 1;

// Heat at or above this and every decision is the model's. Sits above the
// tilted band's floor (mood.js puts `tilted` at 60 mid) on purpose: the last
// few points before tilt are where he is starting to go, and that is already
// worth watching.
export const HEAT_MAX = Number(process.env.ROUTE_HEAT_MAX ?? 55);

/**
 * The kill switch.
 *
 * `DECISION_ROUTER=off` sends every decision to the model, which is exactly
 * the pre-COST-1 behaviour. It exists because this is the largest change to
 * how the product spends money that anyone has shipped, and a change that size
 * needs a way back that is not a deploy: if the routed play reads wrong on the
 * live floor at nine on a Friday, the fix is one env var and a restart rather
 * than a revert under pressure.
 *
 * Read live rather than captured at import, so a test can flip it and the VPS
 * can change it without anyone reasoning about module load order.
 */
export function routingEnabled() {
  return String(process.env.DECISION_ROUTER ?? 'on').toLowerCase() !== 'off';
}

/**
 * Where this decision goes.
 *
 * @param gs   the game state table.js built for the seat
 * @param opts.home     this is the kitchen table — policy only, no exceptions
 * @param opts.nemesis  somebody he has history with is sitting here
 * @returns { route, reason, margin, options, tag }
 *
 * `tag` is the one-token form for the log and the meter: "policy/clear",
 * "model/river".
 */
export function routeFor(gs, { home = false, nemesis = false } = {}) {
  const margin = marginOf(gs);
  const rated = rateActions(gs);
  const options = countOptions(rated);

  // HOME-STATE-1 x COST-1: a friendly game in his own front room may not spend
  // a cent. Checked before everything else, because every other gate below is
  // a reason to spend and there is no reason good enough here.
  if (home) return answer(Route.POLICY, Reason.HOME, margin, options);

  // The switch is read AFTER the home check on purpose: the kitchen table
  // spending nothing is not a routing optimisation, it is HOME-STATE-1's rule
  // that a friendly game at home may never stand in for a night's work, and
  // turning the router off must not turn that off with it.
  if (!routingEnabled()) return answer(Route.MODEL, Reason.OFF, margin, options);

  const reason = modelReason(gs, { margin, options, nemesis });
  return reason
    ? answer(Route.MODEL, reason, margin, options)
    : answer(Route.POLICY, Reason.CLEAR, margin, options);
}

// The first reason this spot deserves a model call, or null when it does not.
// Ordered cheapest-and-most-structural first, so the tag names the most
// fundamental thing true about the spot rather than whichever test ran first.
function modelReason(gs, { margin, options, nemesis }) {
  if (margin === null) return Reason.BLIND;
  if (String(gs?.street) === 'river') return Reason.RIVER;
  if (isAllIn(gs)) return Reason.ALLIN;
  if (potInBb(gs?.pot ?? 0, gs?.bb ?? 0) >= heatThresholdBb()) return Reason.BIG_POT;
  if (Number(gs?.mood?.heat) >= HEAT_MAX) return Reason.HEAT;
  if (nemesis) return Reason.NEMESIS;
  if (gs?.readOnWire) return Reason.READ;
  if (typeof gs?.tableTalk === 'string' && gs.tableTalk.trim()) return Reason.TALK;
  if (isPriced(gs) && margin < MARGIN_MIN) return Reason.CLOSE;
  if (options > OPTIONS_MAX) return Reason.OPTIONS;
  return null;
}

/**
 * Is there a price to be close to?
 *
 * The margin gate is |equity − pot odds| against MARGIN_MIN, and that is a
 * question about a CALL: how far is what the hand is worth from what it costs.
 * With nothing to call it costs nothing, the pot odds are zero, and the margin
 * collapses into the equity itself — at which point the gate stops asking "is
 * this spot close" and starts asking "is this hand any good", which is a
 * different question with a wrong answer. A total whiff on the flop has an
 * equity of 0.19 and a check that the policy rates 99 to 1; sending it to the
 * model because 0.19 < 0.25 would spend the most money on the least decision
 * in poker, and free streets are most of the volume.
 *
 * So on a free decision the closeness test is `options` alone, which asks the
 * same policy the same question in the unit that actually applies: can it
 * separate checking from betting. Every other gate — the pot, the street, the
 * stack, his head, the reads — is untouched and still fires.
 */
export function isPriced(gs) {
  return Number(gs?.toCall) > 0;
}

/**
 * Is a stack in the middle?
 *
 * Two ways: somebody at the table is already all-in, or calling would put HIM
 * all-in. The second is the one that matters most — the decision to stack off
 * is the single most watched moment in a session, and it is never routed to a
 * template.
 */
export function isAllIn(gs) {
  if (gs?.anyAllIn) return true;
  const toCall = Number(gs?.toCall) || 0;
  const stack = Number(gs?.myStack);
  return toCall > 0 && Number.isFinite(stack) && toCall >= stack;
}

function answer(route, reason, margin, options) {
  return {
    route,
    reason,
    margin: margin === null ? null : Number(margin.toFixed(4)),
    options,
    tag: `${route}/${reason}`,
  };
}

// ── Counting ────────────────────────────────────────────────────────────────
//
// The arena and the table both want the same tally and neither should have to
// invent the shape of it. `byReason` is what makes a reduction readable: 60%
// fewer calls is a number, and "because 58% of decisions were clear preflop
// folds" is the finding.

export function newRouteCounter() {
  return { total: 0, policy: 0, model: 0, byReason: {} };
}

export function countRoute(counter, decision) {
  if (!counter || !decision?.route) return counter;
  counter.total++;
  if (decision.route === Route.POLICY) counter.policy++;
  else counter.model++;
  counter.byReason[decision.reason] = (counter.byReason[decision.reason] ?? 0) + 1;
  return counter;
}

/** The share of decisions that never reached a model, 0..1, or null for none. */
export function policyShare(counter) {
  if (!counter || counter.total === 0) return null;
  return counter.policy / counter.total;
}

/** "142 decisions · 58 model (41%) · 84 policy — clear 84, close 31, river 18" */
export function formatRoutes(counter) {
  if (!counter || counter.total === 0) return 'no decisions';
  const pct = Math.round((counter.model / counter.total) * 100);
  const reasons = Object.entries(counter.byReason)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, n]) => `${reason} ${n}`)
    .join(', ');
  return `${counter.total} decisions · ${counter.model} model (${pct}%) · ${counter.policy} policy — ${reasons}`;
}
