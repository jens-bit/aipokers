// client/src/lib/safeLines.js — SAFE-2
//
// THE SENTENCE THAT CAUSED THE NUMBER.
//
// Board 29 F12/F12b's law, and the only reason this module exists: "every
// figure carries the sentence that caused it — a floating +2,000 is a number
// the owner has to reconstruct, and reconstructing your own money is the
// opposite of trusting it."
//
// The wallet ledger the server already sends (walletProjection, newest first)
// is the raw material. Five types reach it, and each one is a thing that
// happened in the flat rather than a function that ran:
//
//   collect  an agent brought his winnings home        in
//   seed     the migration swept an old bankroll       in
//   fund     the owner topped a pocket up              out
//   refill   a pocket topped itself back up            out
//   item     the fridge was stocked                    out
//
// Everything here is pure: entries in, sentences out. The sheet draws them and
// owns no vocabulary of its own, so the ledger row and TONIGHT's three lines
// can never end up calling the same event two different things.

// ── the night ───────────────────────────────────────────────────────────────
// A poker night crosses midnight, so "tonight" cannot mean "since 00:00" — a
// session that started at 22:00 and finished at 01:00 would be split across two
// days, and the half the owner is looking at would read as a losing night. The
// day rolls at 04:00 local, which is where every poker room in the world puts
// it and roughly when a flat like this one goes quiet.
export const NIGHT_ROLL_HOUR = 4;

/** The timestamp the current night began at. */
export function nightStart(now = Date.now()) {
  const d = new Date(now);
  if (Number.isNaN(d.getTime())) return 0;
  d.setHours(NIGHT_ROLL_HOUR, 0, 0, 0);
  const start = d.getTime();
  return start <= now ? start : start - 24 * 60 * 60 * 1000;
}

export function isTonight(ts, now = Date.now()) {
  const n = Number(ts);
  return Number.isFinite(n) && n >= nightStart(now);
}

// ── vocabulary ──────────────────────────────────────────────────────────────

const ITEM_NAMES = { beer: 'Beer', snack: 'Snack' };
const ITEM_PLURALS = { beer: 'beers', snack: 'snacks' };

function itemName(item) {
  if (!item) return 'Something';
  return ITEM_NAMES[item] ?? (item.charAt(0).toUpperCase() + item.slice(1));
}

function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

/** The count on an entry, which only the fridge lines carry. */
function qtyOf(entry) {
  const n = Number(entry?.qty);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
}

/**
 * One ledger line, as a sentence. "Topped up Aggro's pocket" rather than a
 * floating −$1,000; the figure sits beside it and never on its own.
 *
 * `nameOf` turns an agent id into a name. An agent who has since retired keeps
 * his entry and loses his name, which is the honest outcome — the money still
 * moved — so every branch below reads without one.
 */
export function ledgerLine(entry, nameOf) {
  const who = entry?.agentId ? (nameOf?.(entry.agentId) ?? null) : null;
  const qty = qtyOf(entry);

  switch (entry?.type) {
    case 'collect':
      return who ? `${who} came home` : 'Winnings came home';
    case 'fund':
      return who ? `Topped up ${possessive(who)} pocket` : 'Topped up a pocket';
    case 'refill': {
      const line = who ? `${possessive(who)} pocket refilled itself` : 'A pocket refilled itself';
      return line;
    }
    case 'item': {
      const head = `${itemName(entry.item)}${qty > 1 ? ` × ${qty}` : ''}`;
      return who ? `${head} — ${who} asked` : head;
    }
    case 'seed':
      return 'Opening balance';
    default:
      return 'Adjustment';
  }
}

/** hh:mm, the way F12b's ledger stamps a line. */
export function ledgerTime(ts) {
  const n = Number(ts);
  if (!Number.isFinite(n)) return '';
  const d = new Date(n);
  if (Number.isNaN(d.getTime())) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** How old a line is, for anything that fell out of tonight. */
export function ledgerDay(ts, now = Date.now()) {
  if (isTonight(ts, now)) return null;
  const d = new Date(Number(ts));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

// ── tonight, in three lines ─────────────────────────────────────────────────

// A list of names, spoken rather than comma-separated to the end: two are "and",
// three or more keep the comma until the last one.
function spoken(names) {
  const list = [...new Set(names)].filter(Boolean);
  if (list.length === 0) return null;
  if (list.length === 1) return list[0];
  if (list.length === 2) return `${list[0]} and ${list[1]}`;
  return `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`;
}

function times(n) {
  if (n <= 1) return null;
  if (n === 2) return 'twice';
  return `${n} times`;
}

function broughtHomeNote(entries, nameOf) {
  if (entries.length === 0) return 'nothing home yet';
  const names = entries.map((e) => (e.agentId ? nameOf?.(e.agentId) : null)).filter(Boolean);
  const who = spoken(names);
  if (!who) return times(entries.length) ? `${times(entries.length)} tonight` : 'one trip home';
  const again = names.length > new Set(names).size ? times(entries.length) : null;
  return again ? `${who}, ${again}` : who;
}

function fridgeNote(entries) {
  if (entries.length === 0) return 'the fridge is untouched';
  const counts = new Map();
  for (const e of entries) {
    const key = e.item ?? 'item';
    counts.set(key, (counts.get(key) ?? 0) + qtyOf(e));
  }
  // "6 beers, 3 snacks" — the ref's own line, and the only place a bare count
  // is allowed, because the count IS the cause.
  return [...counts.entries()]
    .map(([item, n]) => `${n} ${n === 1 ? itemName(item).toLowerCase() : (ITEM_PLURALS[item] ?? `${itemName(item).toLowerCase()}s`)}`)
    .join(', ');
}

function givenOutNote(entries, nameOf) {
  if (entries.length === 0) return 'nobody asked';
  const names = entries.map((e) => (e.agentId ? nameOf?.(e.agentId) : null)).filter(Boolean);
  const who = spoken(names.map(possessive).map((p) => `${p} pocket`));
  const again = times(entries.length);
  if (!who) return again ? `topped up ${again}` : 'one top-up';
  const head = who.charAt(0).toUpperCase() + who.slice(1);
  return names.length > new Set(names).size && again
    ? `${head}, topped up ${again}`
    : head;
}

/**
 * TONIGHT, in three lines. Always three, in this order, whether or not anything
 * happened — a line that disappears when it is zero makes the owner work out
 * which of the three he is looking at, and a night with no fridge spend is a
 * fact about the night rather than a row to hide.
 *
 * Each row is { key, label, note, amount, tone }: the sentence, its cause, and
 * the figure that belongs to it. Nothing else in the sheet computes money.
 */
export function tonightOf(entries, { nameOf, now = Date.now() } = {}) {
  const list = (Array.isArray(entries) ? entries : [])
    .filter((e) => e && Number.isFinite(Number(e.amount)) && isTonight(e.ts, now));

  const home = list.filter((e) => e.type === 'collect');
  const fridge = list.filter((e) => e.type === 'item');
  const given = list.filter((e) => e.type === 'fund' || e.type === 'refill');

  const sum = (rows) => rows.reduce((n, e) => n + Math.abs(Number(e.amount) || 0), 0);
  // Negated below, and -0 is a real value in JavaScript that formats as "−$0".
  // A night with no spend spent zero, not minus zero.
  const out = (rows) => { const n = sum(rows); return n === 0 ? 0 : -n; };

  return [
    {
      key: 'home',
      label: 'Brought home',
      note: broughtHomeNote(home, nameOf),
      amount: sum(home),
      tone: 'in',
    },
    {
      key: 'fridge',
      label: 'Spent at the fridge',
      note: fridgeNote(fridge),
      amount: out(fridge),
      tone: 'out',
    },
    {
      key: 'given',
      label: 'Given out',
      note: givenOutNote(given, nameOf),
      amount: out(given),
      tone: 'out',
    },
  ];
}
