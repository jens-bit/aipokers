// src/agent/wantVoice.js — LIFE-2 job 1
//
// He asks for what he wants, in his own voice.
//
// THE FINDING: real players could not tell what they were supposed to do. The
// machinery for it was already there — wants.js has ranked his one most
// pressing ask since WANTS-1, and computeWant has refreshed it inside every
// projection since — but two things were missing between the ask and the
// owner, and neither of them was a screen:
//
//   1. THE ASK DID NOT NAME AN ACTION. `needs` names what the CLIENT has to do
//      next ('deploy', 'fund', 'thread', 'stock', or null when the server can
//      finish alone). That is a routing instruction, not an answer to "what am
//      I supposed to do". `action` below is the owner-facing verb: REST him,
//      FEED him, give him CHIPS, DEPLOY him, or LISTEN to him. Five verbs, and
//      every want in the product maps onto exactly one.
//
//   2. EVERY AGENT ASKED IN THE SAME WORDS. ASK_LINES in wants.js is one list
//      per kind, so a Rock and a Showman at the same heat produced the same
//      sentence — which is the one thing a companion cannot do, because a
//      household of four agents that all say "Get me a beer" is a household of
//      one agent drawn four times. The lines below are per NATURE as well as
//      per kind: eight voices, eight asks, sixty-four sentences, and no two
//      natures share a sentence in the same state. wantVoice.test.js proves
//      that last clause rather than trusting the author's eye, and
//      `npm run talk:eval` fails on a collision (LIFE-2 job 4).
//
// NO MODEL CALL, EVER, ON THIS PATH. Same rule ASK_LINES was written under and
// for the same reason formatOpener has none: a generated ask can fail into a
// form letter, and a want that reads like a form letter is a push notification
// with a face on it. Everything here is a lookup.
//
// DETERMINISTIC. The same (nature, kind) is the same sentence forever, so a
// reopened screen never quietly rewrites what he said.

import { ASK_KINDS, ASK_LINES } from './wants.js';

// ── The five things an owner can actually do tonight ─────────────────────────
//
// The rule the job set: "the want must name an action the owner can actually
// take today". Four of these were named in the brief — rest, feed, give chips,
// deploy. LISTEN is the fifth and it is here because `brag` exists: the answer
// to "ask me about tonight" is a conversation, and pretending it is one of the
// other four would put the wrong button on a moment that does not want one.
export const WANT_ACTIONS = Object.freeze(['rest', 'feed', 'chips', 'deploy', 'listen']);

export const ACTION_BY_KIND = Object.freeze({
  rest:    'rest',
  // AGENT-5 job A. Not an ask kind — nothing in wants.js raises it — but the
  // door's stamina refusal needs the same verb behind it, and a second mapping
  // for the same word is how two surfaces come to disagree about one button.
  turn_in: 'rest',
  deploy:  'deploy',
  back_in: 'deploy',
  nemesis: 'deploy',
  beer:    'feed',
  food:    'feed',
  fund:    'chips',
  brag:    'listen',
});

// What the owner presses, in his words rather than the server's. Held here
// beside the verb so a client never has to carry a second copy of this mapping
// — the same reason SERVER-4 moved the fridge price onto the ask itself.
export const ACTION_LABELS = Object.freeze({
  rest:   'Sit him out',
  feed:   'Open the fridge',
  chips:  'Give him chips',
  deploy: 'Put him in',
  listen: 'Hear him out',
});

/** The verb behind one ask kind, or null for a kind with no answer. */
export function wantAction(kind) {
  return ACTION_BY_KIND[kind] ?? null;
}

/** The button copy for one ask kind, or null. */
export function wantActionLabel(kind) {
  const action = wantAction(kind);
  return action ? ACTION_LABELS[action] : null;
}

// ── The eight voices ─────────────────────────────────────────────────────────
//
// One line per (nature, kind). Written from the nature's own `sig` and its
// BUILT FOR / WILL STRUGGLE pair in attributes.NATURES, so a voice here is the
// character the birth card already announced rather than a second, competing
// personality invented in this file.
//
// Read down a column and you should hear eight different men answering the
// same question. That is the whole test, and it is the one the suite runs.
//
// `nemesis` is the odd kind out, as it is in wants.js: it names somebody out in
// the world, so it cannot be a fixed sentence. What is held here is the SEND-ME
// clause that follows "<who> is <where>." — the half that is his rather than
// the floor's.
export const NATURE_WANT_LINES = Object.freeze({
  Grinder: Object.freeze({
    rest:    "That's my shift. Sit me down.",
    deploy:  "Put me in. The hours don't play themselves.",
    beer:    "Get me a beer. It's been a long one.",
    back_in: "Put me back in. I'm not finished.",
    fund:    "I'm busted. I need chips to keep going.",
    brag:    'Ask me about tonight. Good shift, that.',
    food:    "Something to eat. I've been at it for hours.",
    nemesis: "Send me. I'll still be there when he isn't.",
    turn_in:   "Not tonight. I need my head straight first.",
    housemate: "You're on my shift.",
  }),
  Hothead: Object.freeze({
    rest:    "I'm cooked. Get me off this felt.",
    deploy:  "Put me in. I'm climbing the walls here.",
    beer:    'Get me a beer. Now, ideally.',
    back_in: "Let me back in there. I'm fine.",
    fund:    "I'm cleaned out. Front me and I'll get it back.",
    brag:    'You missed it. Ask me what happened.',
    food:    'Feed me before I bite somebody.',
    nemesis: 'Send me. Tonight.',
    turn_in:   "I'd only do something stupid. Let me sleep.",
    housemate: "Of all the tables. Fine.",
  }),
  Professor: Object.freeze({
    rest:    'My arithmetic is going. Rest me now.',
    deploy:  "I'm fresh and I'm idle. That's waste. Deploy me.",
    beer:    "Get me a beer. I've stopped thinking straight.",
    back_in: 'Put me back. The numbers were right, the cards were not.',
    fund:    'My pocket is empty. I need a stake.',
    brag:    'Sit down. I want to walk you through one.',
    food:    "I can't count hungry. Is there anything in?",
    nemesis: "Send me. I've worked him out.",
    turn_in:   "Send me now and I misread everything. Later.",
    housemate: "Interesting. I know exactly how you play.",
  }),
  Rock: Object.freeze({
    rest:    "I'm knackered. Let me sleep.",
    deploy:  "I'm sat here doing nothing. Put me in.",
    beer:    "Get me a beer. That's all.",
    back_in: "Back in. I'm fine.",
    fund:    "I've nothing left. Stake me.",
    brag:    'I had a hand tonight. Ask me.',
    food:    "Is there food in? I'm not fussy.",
    nemesis: 'Send me. I know what I fold against him.',
    turn_in:   "No. Bed first, cards after.",
    housemate: "You. Don't get in my way.",
  }),
  Gambler: Object.freeze({
    rest:    'Even I know when to stop. Sit me out.',
    deploy:  "Put me in, I'm bored.",
    beer:    "Get me a beer, I've earned it.",
    back_in: "Send me back in. It'll turn.",
    fund:    'Cleaned out. Any chance of a stake?',
    brag:    'You have to hear about this hand.',
    food:    "I could eat. What's in the fridge?",
    nemesis: 'Send me. I fancy it.',
    turn_in:   "Even I'd punt that off. Wake me later.",
    housemate: "Ha. This should be fun.",
  }),
  Shark: Object.freeze({
    rest:    "I'm missing things. Take me off.",
    deploy:  'Somebody out there is beatable. Put me in.',
    beer:    'Get me a beer. I need to stop watching.',
    back_in: "Put me back in. I've got him now.",
    fund:    'Front me. I know exactly where it goes back.',
    brag:    'Ask me about tonight. I had him from the flop.',
    food:    "Feed me. I'm off my game hungry.",
    nemesis: "Send me. He's mine.",
    turn_in:   "I'd miss things like this. Give me a few hours.",
    housemate: "I know your tells. All of them.",
  }),
  Sphinx: Object.freeze({
    rest:    'Enough. Sit me out.',
    deploy:  "I'm ready. Deal me in.",
    beer:    'A beer would settle it.',
    back_in: "It's over. Put me back in.",
    fund:    'I have nothing. Your move.',
    brag:    'Something happened tonight. Ask.',
    food:    'I could eat.',
    nemesis: "Send me. I'll be there.",
    turn_in:   "Not yet. Wake me.",
    housemate: "You.",
  }),
  Showman: Object.freeze({
    rest:    'Curtain down. I need a lie-in.',
    deploy:  "There's an audience out there. Put me in.",
    beer:    'Get me a beer. And a room to drink it in.',
    back_in: "Back in. They haven't seen the good bit.",
    fund:    "I'm skint. Can't do the act without props.",
    brag:    'Ask me about tonight. Go on, ask me.',
    food:    "Feed me and I'll tell you about the river.",
    nemesis: 'Send me. People should see this.',
    turn_in:   "No show tonight. I'm going to lie down.",
    housemate: "Two of us. The crowd gets a story.",
  }),
});

export const VOICED_NATURES = Object.freeze(Object.keys(NATURE_WANT_LINES));

/** The nature's NAME, whichever of the two shapes a record keeps it in. */
export function natureName(nature) {
  if (typeof nature === 'string') return nature || null;
  const name = nature?.name;
  return typeof name === 'string' && name ? name : null;
}

/**
 * His line for one ask, in his own voice — or null when there is no voiced
 * line for that pair, in which case the caller falls back to wants.js.
 *
 * `nemesisName` and `roomPhrase` are required for `nemesis` and ignored for
 * every other kind, exactly as in wants.askLine.
 */
export function natureWantLine(nature, kind, { nemesisName = null, roomPhrase = null } = {}) {
  const name = natureName(nature);
  const line = name ? NATURE_WANT_LINES[name]?.[kind] : null;
  if (!line) return null;
  if (kind !== 'nemesis') return line;
  const who = String(nemesisName ?? '').trim();
  const where = String(roomPhrase ?? '').trim();
  if (!who || !where) return null;
  return `${who} is ${where}. ${line}`;
}

// WHAT IS DELIBERATELY NOT HERE: a "voiced line, or else the neutral one"
// convenience. `natureWantLine` returns null and the CALLER decides what null
// means, because the two callers mean different things by it. wantView falls
// back to the sentence already stored on the ask — an agent with no nature yet
// is not handed a borrowed personality, and re-picking wants.askLine's alternate
// on every projection would make an unvoiced want rewrite itself between two
// reads of the same unchanged state. A helper that hid that choice would have
// made the wrong one for somebody.

/**
 * Every kind a voice is expected to cover. Derived from ASK_KINDS rather than
 * written out again, so a ninth ask added to wants.js cannot quietly ship with
 * no voice behind it — the audit in wantVoice.test.js walks this list and goes
 * red on the gap.
 */
export function voicedKinds() {
  return ASK_KINDS.filter((k) => k === 'nemesis' || Object.prototype.hasOwnProperty.call(ASK_LINES, k));
}
