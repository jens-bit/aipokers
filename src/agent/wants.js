// src/agent/wants.js — RELATE-1d
//
// What he wants. One line, at most one pending, raised when the night has been
// rough enough to ask.
//
//   "Can I have a beer. It's been rough."
//
// The design (design-refs/mood-snack.jsx, spec §7): items touch STATE, never
// SKILL. One item, one effect — soothe one mood step, sharing the pep-talk
// cooldown — and one button. The moment reads as feeding a pet, not buying a
// powerup, so there is no store, no price list and no currency iconography
// anywhere near it.
//
// The no-guilt guardrail applies here more than anywhere: he ASKS, once, and
// then drops it. He does not ask again, he does not sulk about being ignored,
// and "no" is a complete answer that costs him nothing but the line in his
// ledger. A want that nags is a guilt mechanic wearing a biscuit costume.

// The one item. §7.1: bought from the WALLET, never from a pocket — a pocket
// that can buy things is a purchase path into the character system.
export const ITEMS = Object.freeze({
  snack: { id: 'snack', label: 'a snack', priceChips: 200, effect: 'soothe' },
  beer:  { id: 'beer',  label: 'a beer',  priceChips: 200, effect: 'soothe' },
});

export const DEFAULT_ITEM = 'beer';

// ── When he asks ─────────────────────────────────────────────────────────────
//
// The trigger table. Heat AND a losing run — heat alone is one bad beat, and a
// run alone at low heat is a man having a quiet night. Both together is the
// night where a drink is the obvious thing to say.

export const WANT_MIN_HEAT = 55;          // frustrated or worse
export const WANT_MIN_LOSING_RUN = 2;     // not one hand
export const WANT_COOLDOWN_HANDS = 40;    // he asks rarely, and drops it

export const WANT_TRIGGERS = Object.freeze([
  { id: 'rough_run',  minHeat: 55, minRun: 2, item: 'beer',  line: "Can I have a beer. It's been rough." },
  { id: 'tilting',    minHeat: 70, minRun: 2, item: 'beer',  line: 'I could do with a drink before the next one.' },
  { id: 'long_grind', minHeat: 55, minRun: 4, item: 'snack', line: "Something to eat wouldn't hurt. Long night." },
]);

/**
 * Should he raise a want right now? Returns the trigger, or null.
 *
 * Deliberately takes plain numbers rather than the agent: nothing here reads a
 * clock or a record, so no code path can turn "he has been left alone" into a
 * want. The caller supplies heat and the losing run from the hand that just
 * finished, which is the only thing that can produce one.
 */
export function wantTrigger({ heat = 0, losingRun = 0, handsPlayed = 0, lastWantAtHand = null } = {}) {
  const h = Number(heat) || 0;
  const run = Number(losingRun) || 0;
  const hands = Number(handsPlayed) || 0;

  if (Number.isFinite(lastWantAtHand) && hands - lastWantAtHand < WANT_COOLDOWN_HANDS) return null;
  if (h < WANT_MIN_HEAT || run < WANT_MIN_LOSING_RUN) return null;

  // Most specific first: the longest grind and the hottest head win over the
  // generic rough night.
  const ordered = [...WANT_TRIGGERS].sort((a, b) => (b.minRun - a.minRun) || (b.minHeat - a.minHeat));
  return ordered.find((t) => h >= t.minHeat && run >= t.minRun) ?? null;
}

/** The moment he raises. One pending at a time — the caller enforces that. */
export function buildWant(trigger, { moodState = 'frustrated' } = {}) {
  if (!trigger) return null;
  return {
    kind: 'want',
    item: trigger.item,
    trigger: trigger.id,
    text: trigger.line,
    mood: moodState,
    at: Date.now(),
    answered: null,        // 'given' | 'ignored'
  };
}

export function isItem(id) {
  return Object.prototype.hasOwnProperty.call(ITEMS, id);
}

export function priceOf(itemId) {
  return ITEMS[itemId]?.priceChips ?? 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// WANTS-1 — the want as an ASK
// ═════════════════════════════════════════════════════════════════════════════
//
// RELATE-1d gave him one thing to ask for: a drink, on a rough night. That was
// the right first want and the wrong shape for the rest of them, because a
// beer is the only want in the list whose answer is a purchase. The others are
// requests to be DEPLOYED, to be BENCHED, to be STAKED, to be LISTENED TO —
// and they all arrive the same way: one line in his voice, with a yes, a later
// and a no under it.
//
// So a want is now an ASK — { kind, priority, needs, dangerous, text }. The
// item want is one kind among seven and keeps its RELATE-1d fields, so
// POST /give and POST /want/dismiss still answer it and no stored record needs
// migrating.
//
// FOUR RULES, and every one of them is a rule about not nagging.
//
//   1. ONE ACTIVE WANT. Not a queue, not a badge with a count. He is a person
//      with a thing on his mind, and a person with six things on his mind is a
//      notification centre.
//   2. HIGHER PRIORITY REPLACES; NOTHING ELSE DOES. The list below is in
//      priority order and that order is the product's judgement about what
//      matters: being cooked beats being bored, being broke beats having a
//      story. A candidate at equal or lower priority is DROPPED, not queued —
//      he does not remember the thing he nearly said.
//   3. NO TIMER EXCEPT THE SNOOZE. A want does not expire, does not sour, and
//      does not decay because nobody came back. `later` is the only clock in
//      this file and it runs for thirty minutes. An unanswered want is still
//      there tomorrow saying exactly what it said, which is the opposite of a
//      guilt mechanic: it costs nothing to leave it.
//   4. A WANT IS ANSWERED BY THE WORLD, TOO. Deploy him from the casino
//      instead of pressing yes and the "put me in" is FULFILLED, not ignored.
//      Clearing a want because he got what he asked for is not decay — see
//      `askSatisfied`, which has a branch per kind and no branch for time.
//
// THE ONE HONEST TENSION, stated rather than buried: `put me in` fires on
// twenty minutes of idleness, and RELATE-1d's own header says no code path
// should turn "he has been left alone" into a want. What keeps the guardrail
// intact is the DIRECTION of the line. He asks to work; he never remarks on
// having been left. Nothing in this file writes a ledger line, moves heat, or
// reads how long the OWNER has been gone — the clock is on the agent's own
// idleness, and `no` to it costs a neutral ledger line, never a hostile one.
// wants.test.js pins all three of those.

// ── The kinds ────────────────────────────────────────────────────────────────
//
// `needs` is what the CLIENT must do when the answer is yes and the server
// cannot finish the job on its own. null means the server does the whole
// thing and the client only has to re-render.

export const ASK_KINDS = Object.freeze(['rest', 'deploy', 'beer', 'back_in', 'fund', 'brag', 'nemesis']);

// Priority: 1 is highest. The spec's order, unchanged.
export const ASKS = Object.freeze({
  rest:    Object.freeze({ kind: 'rest',    priority: 1, needs: null,     dangerous: false, item: null }),
  deploy:  Object.freeze({ kind: 'deploy',  priority: 2, needs: 'deploy', dangerous: false, item: null }),
  beer:    Object.freeze({ kind: 'beer',    priority: 3, needs: null,     dangerous: false, item: 'beer' }),
  // back_in shares the beer's rung because it is the same moment answered a
  // different way: he is hot, and he is at home. The difference is that this
  // one asks to go back to the thing that made him hot, which is why it is the
  // only ask in the table born flagged.
  back_in: Object.freeze({ kind: 'back_in', priority: 3, needs: 'deploy', dangerous: true,  item: null }),
  fund:    Object.freeze({ kind: 'fund',    priority: 4, needs: 'fund',   dangerous: false, item: null }),
  brag:    Object.freeze({ kind: 'brag',    priority: 5, needs: 'thread', dangerous: false, item: null }),
  nemesis: Object.freeze({ kind: 'nemesis', priority: 6, needs: 'deploy', dangerous: false, item: null }),
});

export function askSpec(kind) {
  return ASKS[kind] ?? null;
}

export function askPriority(kind) {
  return ASKS[kind]?.priority ?? Number.MAX_SAFE_INTEGER;
}

// ── The thresholds ───────────────────────────────────────────────────────────

/** "fresh and idle at home > 20 min" — HIS idleness, never the owner's. */
export const ASK_IDLE_MS = 20 * 60_000;

/** "heat >= 70 at home" */
export const ASK_HOT_HEAT = 70;

/** "if he just left a table" — the window in which back_in beats the beer. */
export const ASK_JUST_LEFT_MS = 10 * 60_000;

/** "session net >= 3x the biggest pot of the week" */
export const ASK_BRAG_MULTIPLE = 3;

/** The window the biggest pot is measured over. */
export const ASK_WEEK_MS = 7 * 24 * 60 * 60_000;

/** `later`. The only clock a want has. */
export const ASK_SNOOZE_MS = 30 * 60_000;

/**
 * How long the same KIND stays quiet after it has been answered yes or no.
 *
 * This is not rule 3's timer under another name. Rule 3 is about the want that
 * is already on the table: it never expires, sours or decays. This is about
 * the one AFTER it — the guard that stops `no` to a beer at heat 74 being
 * followed thirty seconds later by another beer at heat 74, which is nagging
 * whatever the trigger table says. An answered want goes; the same question
 * does not come straight back.
 *
 * `later` deliberately does NOT set it: a snooze re-surfaces the very same
 * want object, unanswered, which is the whole difference between later and no.
 */
export const ASK_REASK_MS = 60 * 60_000;

// ── The lines ────────────────────────────────────────────────────────────────
//
// Templates, picked deterministically — the same state produces the same line
// twice, so a reopened screen does not quietly rewrite what he said. The first
// alternate of each kind is the canonical one, and it is what the trigger
// tests assert against.
//
// No model call anywhere in this path, for the same reason `formatOpener` has
// none: a generated ask can fail into a form letter, and a want that reads
// like a form letter is a push notification.

export const ASK_LINES = Object.freeze({
  rest: Object.freeze([
    "Sit one out. I'm cooked.",
    'I need to sit one out.',
    "Bench me for a bit. I've got nothing left.",
  ]),
  deploy: Object.freeze([
    'Put me in.',
    "Put me in. I'm ready.",
    "I'm fresh and I'm sat here doing nothing. Put me in.",
  ]),
  beer: Object.freeze([
    'Get me a beer.',
    "Get me a beer. It's been one of those.",
    'A beer would not hurt about now.',
  ]),
  back_in: Object.freeze([
    "Let me back in there, I'm fine.",
    "Put me back in. I'm fine.",
    "I'm fine. Let me back in there.",
  ]),
  fund: Object.freeze([
    'Front me?',
    "Front me? I'm cleaned out.",
    'Any chance of a stake? I have nothing.',
  ]),
  brag: Object.freeze([
    'You have to hear about this hand.',
    'You have to hear about this hand. Sit down.',
    'Ask me about tonight. Go on, ask me.',
  ]),
});

/** Deterministic pick — the same one moment.js uses, for the same reason. */
function pickLine(list, seed) {
  if (!list || list.length === 0) return null;
  const n = Math.abs(Math.round(Number(seed) || 0));
  return list[n % list.length];
}

/**
 * The line for one ask. `nemesis` is the only kind that names something out in
 * the world, so it is the only one that composes rather than picks.
 */
export function askLine(kind, { seed = 0, nemesisName = null, roomPhrase = null } = {}) {
  if (kind === 'nemesis') {
    const who = String(nemesisName ?? '').trim();
    const where = String(roomPhrase ?? '').trim();
    if (!who || !where) return null;
    return `${who} is ${where}. Send me.`;
  }
  return pickLine(ASK_LINES[kind], seed) ?? null;
}

// ── The trigger ──────────────────────────────────────────────────────────────

/**
 * The ask his state calls for right now, or null.
 *
 * Plain values, not an agent record — the same discipline `wantTrigger` above
 * keeps, and the reason it is provable that nothing here reads a clock it was
 * not handed. The caller assembles the state; this function only ranks it.
 *
 * @param fatigue        'fresh' | 'settled' | 'worn'
 * @param atTable        true while he is actually in a seat
 * @param idleMs         how long he has been at home (Infinity if never seated)
 * @param heat           0-100
 * @param sinceLeftMs    ms since he last stood up (Infinity if never)
 * @param broke          his pocket cannot cover a buy-in
 * @param sessionNet     signed chips from his last finished session
 * @param weekBiggestPot the biggest pot he had money in over the last week
 * @param nemesis        { name, room, roomPhrase, tableId } | null — seated NOW
 * @returns {{ kind, priority, needs, dangerous, item, room?, tableId? }|null}
 */
export function askFor({
  fatigue = 'fresh',
  atTable = false,
  idleMs = 0,
  heat = 0,
  sinceLeftMs = Infinity,
  broke = false,
  sessionNet = null,
  weekBiggestPot = 0,
  nemesis = null,
} = {}) {
  const home = !atTable;
  const h = Number(heat) || 0;

  // 1 — worn. The only ask he can raise FROM a seat, because being cooked is
  //     the only one of these that is true there.
  if (fatigue === 'worn') return { ...ASKS.rest };

  // A man in a seat is busy. Being cooked is the only one of these that is
  // true AT the table, so it is the only one that can be raised from one —
  // everything below this line is an ask from the bar.
  if (!home) return null;

  // 2 — fresh, at home, and has been for a while.
  if (fatigue === 'fresh' && Number(idleMs) > ASK_IDLE_MS) return { ...ASKS.deploy };

  // 3 — hot at home. If he has only just stood up, what he wants is not a
  //     drink, it is his seat back. That one is flagged rather than
  //     suppressed: the job here is to let him ask and let you decide, not to
  //     decide for you and call it care.
  if (h >= ASK_HOT_HEAT) {
    return Number(sinceLeftMs) <= ASK_JUST_LEFT_MS ? { ...ASKS.back_in } : { ...ASKS.beer };
  }

  // 4 — busted.
  if (broke) return { ...ASKS.fund };

  // 5 — a night worth telling you about. Three times the week's biggest pot,
  //     so the bar scales with the stakes he actually plays instead of being a
  //     number that means something different in the back room than it does on
  //     the floor. No pot on record is no claim, so it cannot fire on zero.
  const net = Number(sessionNet);
  const bar = ASK_BRAG_MULTIPLE * (Number(weekBiggestPot) || 0);
  if (Number.isFinite(net) && net > 0 && bar > 0 && net >= bar) return { ...ASKS.brag };

  // 6 — the man he cannot beat is in the building.
  if (nemesis?.name) {
    return { ...ASKS.nemesis, room: nemesis.room ?? null, tableId: nemesis.tableId ?? null };
  }

  return null;
}

// ── Building and answering ───────────────────────────────────────────────────

/**
 * One ask, in the shape that gets stored on the agent. It carries RELATE-1d's
 * fields (`item`, `text`, `answered`) so the older routes keep working on a
 * want they did not raise.
 */
export function buildAsk(ask, {
  seed = 0, moodState = 'neutral', nemesisName = null, roomPhrase = null, now = Date.now(),
} = {}) {
  if (!ask?.kind) return null;
  const text = askLine(ask.kind, { seed, nemesisName, roomPhrase });
  if (!text) return null;
  return {
    kind: ask.kind,
    priority: ask.priority,
    needs: ask.needs ?? null,
    dangerous: !!ask.dangerous,
    item: ask.item ?? null,
    room: ask.room ?? null,
    tableId: ask.tableId ?? null,
    text,
    mood: moodState,
    at: now,
    answered: null,        // 'yes' | 'later' | 'no'   (legacy: 'given' | 'ignored')
    answeredAt: null,
    snoozedUntil: null,
  };
}

/** Answered, in any of the vocabularies this field has ever spoken. */
export function isAnswered(want) {
  return !!want && want.answered != null && want.answered !== '';
}

/**
 * Is this the want to show right now? Unanswered, and not inside a snooze.
 *
 * A snoozed want is not gone — it comes back by itself when the snooze runs
 * out, which is the whole of what makes `later` different from `no`.
 */
export function isActiveWant(want, { now = Date.now() } = {}) {
  if (!want || isAnswered(want)) return false;
  if (Number.isFinite(want.snoozedUntil) && now < want.snoozedUntil) return false;
  return true;
}

/** Pending, but holding its tongue. */
export function isSnoozed(want, { now = Date.now() } = {}) {
  return !!want && !isAnswered(want) && Number.isFinite(want.snoozedUntil) && now < want.snoozedUntil;
}

/**
 * Rule 2. A candidate replaces what is pending only when it outranks it.
 *
 * A snoozed want is still PENDING for this test, so a `later` on the beer does
 * not open the door to a "put me in" thirty seconds afterwards — but it does
 * not hold the door shut against "sit one out" either, because being cooked
 * outranks being bored no matter what was said about a drink.
 */
export function replaces(candidate, current) {
  if (!candidate) return false;
  if (!current || isAnswered(current)) return true;
  if (candidate.kind === current.kind) return false;
  return askPriority(candidate.kind) < askPriority(current.kind);
}

/**
 * Rule 4. Has the world already given him what he asked for?
 *
 * Every branch names the thing he ASKED for. There is deliberately no branch
 * that clears a want because time passed or because nobody looked at it — the
 * absence of that branch is the guardrail, and the test asserts it by holding
 * a want across a week of untouched state.
 */
export function askSatisfied(want, { fatigue = 'fresh', atTable = false, broke = false, heat = 0 } = {}) {
  if (!want || isAnswered(want)) return false;
  switch (want.kind) {
    case 'rest':                                  // off the felt, and rested
      return !atTable && fatigue === 'fresh';
    case 'deploy':
    case 'back_in':
    case 'nemesis':
      return atTable;                             // he is playing; he got his seat
    case 'fund':
      return !broke;                              // somebody staked him
    case 'beer':
      return (Number(heat) || 0) < ASK_HOT_HEAT;  // he calmed down on his own
    default:
      return false;                               // `brag` is only ever answered by you
  }
}
