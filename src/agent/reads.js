// src/agent/reads.js
// Turns a raw opponent-stat read into the OPPONENT READ briefing text.
//
// Why this is its own module: the A/B run proved the briefing was producing
// the INVERSE of the correct exploit. TAG vs Calling Station made +166 bb/100
// with reads OFF and only +57 with reads ON, and the mechanism was visible in
// the fold rate — 57% with reads vs 31% without. The read line was a bare
// stat dump:
//
//   OPPONENT READ (House, 23 hands): VPIP 96% (very loose), PFR 4%, AF 0.2,
//   folds to raises 6%, goes to showdown 71%.
//
// Every one of those numbers is true, and an LLM reads the whole line as
// menace. "Goes to showdown 71%" says *he keeps showing up with hands* →
// caution. "Folds to raises 6%" says *my raises don't work* → stop raising.
// Against a player who never folds, both conclusions are exactly backwards:
// the correct exploit is to value bet thinner and bigger and never bluff.
//
// Two rules this module enforces, and the tests pin both:
//   1. No stat may be phrased so that it implies the hero should FOLD MORE.
//      A showdown-tendency number in particular is a reason to value bet, not
//      a reason to be afraid.
//   2. Every recognised opponent shape gets an explicit EXPLOIT directive.
//      Handing a model statistics and hoping it derives the counter-strategy
//      is what failed; the counter-strategy is stated.

// Coarse VPIP → label bucket, shown alongside the raw number.
export function vpipLabel(vpip) {
  if (!Number.isFinite(vpip)) return 'unknown';
  if (vpip < 15) return 'very tight';
  if (vpip < 25) return 'tight';
  if (vpip < 45) return 'normal';
  if (vpip < 70) return 'loose';
  return 'very loose';
}

// Classify the opponent into the shape that determines the exploit. Order is
// a priority ladder — the first match wins. Returns null when the stats do
// not describe a clearly exploitable shape, in which case no EXPLOIT line is
// emitted and the model is left with the raw numbers.
export function classifyOpponent(read) {
  if (!read) return null;
  const vpip = Number(read.vpip);
  const af = read.af;
  const ftr = Number.isFinite(read.foldToRaise) ? read.foldToRaise : null;
  if (!Number.isFinite(vpip)) return null;

  const afNum = Number.isFinite(af) ? af : (af === Infinity ? Infinity : null);
  const loosePassive = afNum !== null && afNum < 1.2;
  const hyperAggressive = afNum !== null && afNum >= 3;

  // Calls far too wide, almost never folds. The shape the old briefing got
  // exactly backwards.
  if (vpip >= 50 && loosePassive && (ftr === null || ftr < 30)) return 'station';

  // Fires constantly, mostly with air.
  if (hyperAggressive && vpip >= 45) return 'maniac';

  // Folds far too often. Excludes the tight-but-violent regs below.
  if (vpip < 22 && (afNum === null || afNum < 3) && (ftr === null || ftr >= 45)) return 'nit';

  // Tight and genuinely aggressive — a competent player, not a target.
  if (vpip < 35 && afNum !== null && afNum >= 2) return 'tag';

  return null;
}

// The counter-strategy for each shape, stated as an instruction. These are
// the lines that have to survive review: none of them may tell the hero to
// tighten or fold more against a player who calls too much.
// Each line is bounded on purpose. The first version of the station exploit
// said "value bet THINNER and BIGGER, do not tighten your range, keep betting
// every street" and the 50-pair run showed the model taking that as licence to
// abandon its strategy entirely: VPIP 19 → 39, AF 12.6 → 77.5, and 155
// bets/raises against 2 calls. It stopped folding (the bug) but also stopped
// calling and started playing junk (a new bug, the same shape as the Tree-2
// maniac pathology). So every exploit now says where it does NOT apply:
// preflop still belongs to the RANGE line, and raising is not the only verb.
const EXPLOITS = {
  station:
    'this is a CALLING STATION — he calls with weak hands and almost never folds. ' +
    'Bet your made hands for value and size UP (around three quarters of the pot); he pays ' +
    'off with worse, so thin value is real value. Do not bluff him with pure air — it has ' +
    'no fold equity. But betting is not your only move: when you have neither value nor a ' +
    'plan, CHECK — take the free card, keep your draws and weak pairs to the river, and ' +
    'call him down. He bluffs far too rarely for folding to be right, so folding is the ' +
    'expensive mistake here, not calling. Do NOT tighten your range against him, and do ' +
    'NOT widen it: the RANGE line still governs preflop. Do not jam every pot — leave him ' +
    'a price he is still willing to call.',
  maniac:
    'he bets and raises relentlessly, much of it with air. Do NOT try to out-bluff him, ' +
    'and do NOT fold decent made hands to his pressure — call down lighter and let him ' +
    'barrel into you. Trap with strong hands rather than raising him off his bluffs. ' +
    'Calling is the main weapon here; keep your preflop range as the RANGE line sets it.',
  nit:
    'he folds far too often. Attack him — bet more streets and bluff more than usual when ' +
    'he shows weakness; his folds are where your profit is. Widen your steals modestly ' +
    'rather than abandoning the RANGE line. When he finally commits real money, respect ' +
    'it and release your marginal hands.',
  tag:
    'he is tight and aggressive — a real player. Edges here are thin: play straightforwardly, ' +
    'value bet clearly, avoid large bluffs into his strong ranges, and take the pots he gives up.',
};

// ── Stat phrasing ───────────────────────────────────────────────────────────
// Each of these adds the "so what" to a bare number, and each is written so
// the implication points at ACTION rather than at caution.

function afPhrase(af) {
  if (af === Infinity) return 'AF inf (he only raises, never calls)';
  if (!Number.isFinite(af)) return 'AF n/a';
  const x = af.toFixed(1);
  if (af >= 3)   return `AF ${x} (hyper-aggressive — much of it is air)`;
  // Deliberately does NOT say "his raises mean strength". That reading is
  // textbook against a tight passive player and poison against a loose one:
  // it had TAG folding to a station's occasional raise. What his aggression
  // means is the EXPLOIT line's job, where it can depend on his whole shape.
  if (af < 0.8)  return `AF ${x} (passive — he rarely raises and his calls mean nothing)`;
  return `AF ${x}`;
}

function foldPhrase(foldToRaise) {
  if (!Number.isFinite(foldToRaise)) return 'no fold-to-aggression data yet';
  const x = foldToRaise.toFixed(0);
  if (foldToRaise < 25) return `folds to aggression only ${x}% (he will not fold — raise him for value, never as a bluff)`;
  if (foldToRaise >= 55) return `folds to aggression ${x}% (pressure works on him)`;
  return `folds to aggression ${x}%`;
}

// The line that caused the inversion. A high showdown rate means he PAYS OFF;
// it must never be left to read as "he always has it".
function showdownPhrase(wtsd) {
  if (!Number.isFinite(wtsd)) return null;
  const x = wtsd.toFixed(0);
  if (wtsd >= 40) return `reaches showdown ${x}% (he calls down — he pays off value bets)`;
  if (wtsd < 20)  return `reaches showdown ${x}% (he gives up before the river)`;
  return `reaches showdown ${x}%`;
}

// Render one read as the briefing lines for it. Returns an array of 0–2
// strings: the stat line, and the EXPLOIT directive when the shape is clear.
export function formatOpponentRead(read, { minHands = 10 } = {}) {
  if (!read || !Number.isFinite(read.handsObserved) || read.handsObserved < minHands) return [];
  if (!Number.isFinite(read.vpip)) return [];

  const who = read.displayName || read.playerId;
  const parts = [
    `VPIP ${read.vpip.toFixed(0)}% (${vpipLabel(read.vpip)})`,
    `PFR ${Number.isFinite(read.pfr) ? read.pfr.toFixed(0) : '?'}%`,
    afPhrase(read.af),
    foldPhrase(read.foldToRaise),
  ];
  const sd = showdownPhrase(read.wentToShowdown);
  if (sd) parts.push(sd);

  const lines = [`OPPONENT READ (${who}, ${read.handsObserved} hands): ${parts.join(', ')}.`];

  const shape = classifyOpponent(read);
  if (shape && EXPLOITS[shape]) lines.push(`EXPLOIT: ${EXPLOITS[shape]}`);
  return lines;
}

// Exposed for tests.
export const _EXPLOITS = EXPLOITS;
