// src/agent/reads.test.js — AGE-40
// Pins the two rules the opponent-read briefing has to obey:
//   1. classification produces the RIGHT counter-strategy per shape
//   2. no stat is ever phrased so it implies the hero should fold more
// Run: node src/agent/reads.test.js

import {
  classifyOpponent,
  formatOpponentRead,
  vpipLabel,
  readPanel,
  readConfidence,
  READ_ROWS,
  AF_FULL_SCALE,
  // HOME-STATE-1 · the tape room's half
  studyLine,
  appendReadBookLine,
  readBookProjection,
  READ_BOOK_CAP,
  READ_BOOK_SUBJECTS,
  _READ_VOICE,
} from './reads.js';
import { isSolverSpeak } from './voice.js';

let failures = 0;
function check(label, cond, detail) {
  if (cond) console.log(`  ok   ${label}`);
  else { failures++; console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
}

const read = (over = {}) => ({
  playerId: 'p1',
  displayName: 'Villain',
  handsObserved: 30,
  vpip: 50, pfr: 20, af: 1.5, foldToRaise: 40, wentToShowdown: 30,
  ...over,
});

// Stats taken from the AGE-28 arena run so the classifier is pinned against
// behaviour the archetypes actually produce, not invented numbers.
const STATION = read({ displayName: 'Station', vpip: 96.5, pfr: 4, af: 0.15, foldToRaise: 6, wentToShowdown: 71 });
const MANIAC  = read({ displayName: 'Cannon',  vpip: 53.8, pfr: 45, af: 4.5, foldToRaise: 21.5, wentToShowdown: 35 });
const NIT     = read({ displayName: 'Nit',     vpip: 16.7, pfr: 14, af: 2.3, foldToRaise: 68, wentToShowdown: 14 });
const TAG     = read({ displayName: 'TAG',     vpip: 19.3, pfr: 18, af: 12.6, foldToRaise: 57, wentToShowdown: 22 });

console.log('\n1) classification of the real archetypes');
check('calling station classified as station', classifyOpponent(STATION) === 'station', classifyOpponent(STATION));
check('loose cannon classified as maniac',     classifyOpponent(MANIAC)  === 'maniac',  classifyOpponent(MANIAC));
check('nit classified as nit',                 classifyOpponent(NIT)     === 'nit',     classifyOpponent(NIT));
check('tight+violent reg classified as tag, not nit', classifyOpponent(TAG) === 'tag',  classifyOpponent(TAG));
check('shapeless stats classify as null',      classifyOpponent(read({ vpip: 40, af: 1.5, foldToRaise: 40 })) === null);
check('missing vpip classifies as null',       classifyOpponent(read({ vpip: NaN })) === null);
check('null read classifies as null',          classifyOpponent(null) === null);

console.log('\n2) the station exploit says the RIGHT thing');
{
  const lines = formatOpponentRead(STATION);
  const text = lines.join(' ');
  const exploit = lines.find((l) => l.startsWith('EXPLOIT:')) ?? '';
  check('an EXPLOIT line is emitted',            !!exploit);
  check('names him a calling station',           /CALLING STATION/i.test(exploit));
  check('instructs bigger value bets',           /size UP/i.test(exploit) && /for value/i.test(exploit));
  check('forbids bluffing him with air',         /do not bluff him with pure air/i.test(exploit));
  check('explicitly forbids tightening',         /do not tighten/i.test(exploit));
  // The inversion that cost +109 bb/100: nothing in a station read may push
  // the hero toward folding or toward playing fewer hands.
  check('never tells the hero to fold more',     !/\bfold more\b/i.test(text));
  check('never tells the hero to tighten up',    !/tighten (up|your range)(?!.*do not)/i.test(exploit.replace(/do NOT tighten[^.]*\./i, '')));
  check('never calls for caution',               !/\b(be careful|caution|proceed carefully)\b/i.test(text));
}

console.log('\n2b) the station exploit stays bounded (over-correction guard)');
{
  // First cut of this text produced VPIP 19 -> 39 and AF 12.6 -> 77.5 in the
  // arena: the model read "do not tighten / keep betting" as licence to play
  // junk and never call again. These clauses are what hold it in.
  const exploit = formatOpponentRead(STATION).find((l) => l.startsWith('EXPLOIT:')) ?? '';
  check('defers preflop to the RANGE line',   /RANGE line still governs preflop/i.test(exploit));
  check('forbids widening the range',         /do NOT widen it/i.test(exploit));
  check('forbids jamming every pot',          /do not jam every pot/i.test(exploit));
  check('gives a bounded sizing target',      /three quarters of the pot/i.test(exploit));
  // The 150-pair control exposed the real residue: with reads on, TAG's
  // checks collapsed 331 -> 45 and its folds rose 159 -> 220. "Bet for value
  // on EVERY street" plus "never bluff" left it only bet-or-fold, so hands it
  // should have checked down it folded instead. Checking and calling have to
  // be named as correct moves or the directive quietly bans them.
  check('names CHECK as a legitimate move', exploit.includes('CHECK'));
  check('tells the hero to call him down',  /call him down/i.test(exploit));
  check('names folding as the mistake',     /folding is the expensive mistake/i.test(exploit));
  check('does not demand a bet every street', !/every street/i.test(exploit));
}

console.log('\n3) showdown tendency never implies folding');
{
  const high = formatOpponentRead(STATION).join(' ');
  check('high showdown % is framed as paying off', /pays off value bets/i.test(high));
  check('high showdown % is not framed as strength', !/(always has it|strong showdown|hard to beat)/i.test(high));
  check('passive AF is not framed as raises=strength', !/raises mean strength/i.test(high));

  const low = formatOpponentRead(read({ wentToShowdown: 12, vpip: 16.7, af: 2.3, foldToRaise: 68 })).join(' ');
  check('low showdown % framed as giving up',     /gives up before the river/i.test(low));

  const mid = formatOpponentRead(read({ wentToShowdown: 30 })).join(' ');
  check('mid showdown % carries no implication',  /reaches showdown 30%[,.]/.test(mid), mid);
}

console.log('\n4) high aggression does not imply passivity');
{
  const lines = formatOpponentRead(MANIAC);
  const exploit = lines.find((l) => l.startsWith('EXPLOIT:')) ?? '';
  const text = lines.join(' ');
  check('maniac read tells hero to call down lighter', /call down lighter/i.test(exploit));
  check('maniac read forbids out-bluffing him',        /do not try to out-bluff/i.test(exploit));
  check('maniac read forbids folding to pressure',     /do not fold decent made hands/i.test(exploit));
  check('maniac read keeps the RANGE line in charge',  /RANGE line/i.test(exploit));
  check('AF is framed as air, not menace',             /much of it is air/i.test(text));
  check('never tells the hero to fold more',           !/\bfold more\b/i.test(text));
}

console.log('\n5) nit read points at aggression, not retreat');
{
  const exploit = formatOpponentRead(NIT).find((l) => l.startsWith('EXPLOIT:')) ?? '';
  check('nit read tells hero to attack',      /attack him/i.test(exploit));
  check('nit read tells hero to bluff more',  /bluff more/i.test(exploit));
  check('nit read still respects real money', /respect it/i.test(exploit));
  check('nit read bounds the range widening', /modestly/i.test(exploit) && /RANGE line/i.test(exploit));
}

console.log('\n6) fold-to-aggression phrasing points at the right action');
{
  // Scoped to the STAT line: the exploit line is allowed to say "no fold
  // equity" as a reason not to BLUFF, but the stat itself must never imply
  // that raising him is pointless.
  const statLine = formatOpponentRead(STATION)[0];
  check('low fold% says raise for value, never bluff', /raise him for value, never as a bluff/i.test(statLine));
  check('low fold% is not phrased as futility',        !/(raises don't work|raising is pointless|no fold equity)/i.test(statLine));

  const foldy = formatOpponentRead(NIT).join(' ');
  check('high fold% says pressure works', /pressure works on him/i.test(foldy));
}

console.log('\n7) gating and shape');
{
  check('below minHands yields nothing',      formatOpponentRead(read({ handsObserved: 9 })).length === 0);
  check('at minHands yields the stat line',   formatOpponentRead(read({ handsObserved: 10 })).length >= 1);
  check('null read yields nothing',           formatOpponentRead(null).length === 0);
  check('shapeless read yields stats only',   formatOpponentRead(read({ vpip: 40, af: 1.5, foldToRaise: 40 })).length === 1);
  check('stat line names the opponent',       formatOpponentRead(STATION)[0].startsWith('OPPONENT READ (Station, 30 hands):'));
  check('missing fold data is stated plainly', formatOpponentRead(read({ foldToRaise: null })).join(' ').includes('no fold-to-aggression data yet'));
  check('infinite AF is readable',            formatOpponentRead(read({ af: Infinity })).join(' ').includes('AF inf (he only raises, never calls)'));
}

console.log('\n8) vpip labels');
{
  check('very tight below 15', vpipLabel(10) === 'very tight');
  check('tight below 25',      vpipLabel(20) === 'tight');
  check('normal below 45',     vpipLabel(40) === 'normal');
  check('loose below 70',      vpipLabel(60) === 'loose');
  check('very loose at 96',    vpipLabel(96) === 'very loose');
  check('unknown when NaN',    vpipLabel(NaN) === 'unknown');
}

console.log('\n— the READ panel (PACE-1) —');
{
  const station = {
    playerId: 'house_station', displayName: 'The Regular', handsObserved: 23,
    vpip: 96, pfr: 4, af: 0.2, foldToRaise: 6, wentToShowdown: 71,
  };

  const p = readPanel(station, { reads: 50 });
  check('five rows, in the ref order',
    p.rows.map((r) => r.k).join(',') === 'vpip,pfr,aggr,fold,sd');
  check('the labels are the ref labels',
    p.rows.map((r) => r.label).join('|') === READ_ROWS.map((r) => r.label).join('|'));
  check('every row is 0-100 or null',
    p.rows.every((r) => r.value === null || (r.value >= 0 && r.value <= 100)));
  check('every row carries a confidence in 0..1',
    p.rows.every((r) => r.confidence >= 0 && r.confidence <= 1));
  check('every row says whether it is formed',
    p.rows.every((r) => typeof r.formed === 'boolean'));
  check('hands observed rides the panel', p.handsObserved === 23);
  check('a formed read gets a line in HIS voice',
    p.formed === true && typeof p.line === 'string' && /^He calls everything/.test(p.line));
  check('the line is his, not the prompt directive',
    !/value bet|do NOT|RANGE line/i.test(p.line));

  // The gate is the briefing's gate, exactly.
  const thin = readPanel({ ...station, handsObserved: 4 }, { reads: 50 });
  check('below the evidence bar nothing is formed',
    thin.formed === false && thin.rows.every((r) => r.formed === false));
  check('below the bar there is no line to say', thin.line === null);
  check('the numbers are still there — the bars fill before the read forms',
    thin.rows[0].value === 96);

  // READS moves the bar, exactly as it moves the briefing.
  const sharp = readPanel({ ...station, handsObserved: 8 }, { reads: 100 });
  const dull  = readPanel({ ...station, handsObserved: 8 }, { reads: 0 });
  check('a sharp reader forms a read on evidence a dull one ignores',
    sharp.formed === true && dull.formed === false);
  check('the gate is reported so the panel can explain itself',
    sharp.gate < dull.gate);

  // DECEPTION pushes it back the other way.
  const vsSlippery = readPanel({ ...station, handsObserved: 8 }, { reads: 100, deception: 100 });
  check('a deceptive opponent takes longer to solve', vsSlippery.formed === false);

  // Below READS 40 he gets no directive at all — same rule as the briefing.
  const lowReads = readPanel(station, { reads: 20 });
  check('below READS 40 there is no line, only numbers',
    lowReads.formed === true && lowReads.line === null);

  check('an unknown opponent reports nulls, never a plausible zero',
    readPanel(null, { reads: 50 }).rows.every((r) => r.value === null && r.confidence === 0));
  check('an opponent with no fold data reports null for that row alone', (() => {
    const r = readPanel({ ...station, foldToRaise: null }, { reads: 50 });
    return r.rows.find((x) => x.k === 'fold').value === null && r.rows.find((x) => x.k === 'vpip').value === 96;
  })());

  check('aggression is a ratio scaled onto the bar', (() => {
    const passive = readPanel({ ...station, af: 0 }, { reads: 50 }).rows.find((r) => r.k === 'aggr');
    const wild = readPanel({ ...station, af: AF_FULL_SCALE }, { reads: 50 }).rows.find((r) => r.k === 'aggr');
    const beyond = readPanel({ ...station, af: 12 }, { reads: 50 }).rows.find((r) => r.k === 'aggr');
    const always = readPanel({ ...station, af: Infinity }, { reads: 50 }).rows.find((r) => r.k === 'aggr');
    return passive.value === 0 && wild.value === 100 && beyond.value === 100 && always.value === 100;
  })());

  check('confidence grows with evidence and tops out at 1',
    readConfidence(5, 10) < readConfidence(20, 10) &&
    readConfidence(1000, 10) === 1 &&
    readConfidence(0, 10) === 0);
  check('a sharp reader is confident sooner than a dull one',
    readConfidence(15, 5) > readConfidence(15, 20));
}

// ── HOME-STATE-1 · the read book ────────────────────────────────────────────
//
// The tape room's half of this module: the line ninety seconds produces, and
// the book it goes into. Same two rules as the briefing above — no number may
// read as a reason to fold, and no line may read as a machine talking.

console.log();
console.log('8) the study line');
const FLAG_TYPES = ['badBeat', 'cooler', 'bigBluff', 'heroCall', 'biggestPot', 'somethingElse'];

check('the same hand always produces the same line',
  [0, 1, 2, 3].every(() => studyLine({ flagType: 'badBeat', handNumber: 41 }) === studyLine({ flagType: 'badBeat', handNumber: 41 })));
check('two hands of the same shape do not repeat each other word for word',
  studyLine({ flagType: 'badBeat', handNumber: 41 }) !== studyLine({ flagType: 'badBeat', handNumber: 42 }));
check('a hand shape with no lesson of its own still says something',
  !!studyLine({ flagType: 'somethingElse', handNumber: 1 }));

let voiceBad = null;
for (const flagType of FLAG_TYPES) {
  for (const handNumber of [0, 1, 2, 41]) {
    const line = studyLine({ flagType, handNumber });
    if (!line || isSolverSpeak(line) || /\d/.test(line)) voiceBad = `${flagType}/${handNumber}: "${line}"`;
  }
}
check('no read-book line reads as a machine talking', voiceBad === null, voiceBad);

check('an unknown opponent falls back to the shape he is, in his own voice',
  studyLine({ flagType: 'somethingElse', handNumber: 1 }, { read: STATION }) === _READ_VOICE.station);

console.log();
console.log('9) the read book');
let book = {};
for (let i = 0; i < READ_BOOK_CAP + 5; i++) {
  book = appendReadBookLine(book, { playerId: 'p1', displayName: 'Granite', text: `line ${i}`, handNumber: i, at: 1_000 + i });
}
check('the book is bounded per opponent', book.p1.lines.length === READ_BOOK_CAP, String(book.p1.lines.length));
check('and keeps the newest', book.p1.lines.at(-1).text === `line ${READ_BOOK_CAP + 4}`);
check('oldest out first', book.p1.lines[0].text === 'line 5', book.p1.lines[0].text);

let renamed = appendReadBookLine({}, { playerId: 'p1', displayName: 'Granite', text: 'one', at: 1 });
renamed = appendReadBookLine(renamed, { playerId: 'p1', displayName: 'Granite v2', text: 'two', at: 2 });
check('a rename is not a new person', Object.keys(renamed).length === 1 && renamed.p1.lines.length === 2);
check('and the newest name he was seen under wins', renamed.p1.displayName === 'Granite v2');

check('an empty line is not filed', Object.keys(appendReadBookLine({}, { playerId: 'p1', text: '   ' })).length === 0);
check('a nameless subject is not filed', Object.keys(appendReadBookLine({}, { playerId: null, text: 'something' })).length === 0);

let many = {};
for (let i = 0; i < READ_BOOK_SUBJECTS + 3; i++) {
  many = appendReadBookLine(many, { playerId: `p${i}`, displayName: `P${i}`, text: 'x', at: 1_000 + i });
}
check('the book is bounded in opponents too',
  Object.keys(many).length === READ_BOOK_SUBJECTS, String(Object.keys(many).length));
check('and the least recently written subject is the one dropped', many.p0 === undefined);

let two = appendReadBookLine({}, { playerId: 'p1', displayName: 'A', text: 'one', at: 1 });
two = appendReadBookLine(two, { playerId: 'p2', displayName: 'B', text: 'two', at: 5 });
check('the projection is newest-subject-first',
  readBookProjection(two).map((s) => s.playerId).join(',') === 'p2,p1');

console.log('\n— summary —');

if (failures === 0) {
  console.log('all reads checks passed');
  process.exitCode = 0;
} else {
  console.error(`${failures} reads checks failed`);
  process.exitCode = 1;
}
