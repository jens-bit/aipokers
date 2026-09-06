// client/src/lib/identity.js — HOME-2 job 3
//
// WHO HE IS, ROLLED AT BIRTH AND FIXED FOR LIFE.
//
// Six hoods by six glows, thirty-six creatures. The roll happens once, from his
// id, and nothing afterwards moves it: MOOD MOVES THE FACE, NEVER THE COLOUR.
// That is the whole point of drawing identity in colour and expression in
// geometry — you can tell four agents apart while all four of them are tilted,
// which is exactly the moment an owner most needs to.
//
// Ported from design-refs/mood-atoms.jsx (`HOODS`, `GLOWS`, `h32`, `idFor`,
// `rollRoster`), verbatim in its numbers. What this file adds is the seam to
// the server: `identityOf` reads `agent.identity` when it is there and rolls
// when it is not, so the day the server starts storing the roll, the client
// stops guessing and nothing else changes.
//
// ── Why the hoods are these six colours ────────────────────────────────────
//
// The first set was six near-blacks (L* 8–14) and read as ONE GREY. At 40px a
// hood is barely 900 painted pixels, and hue does nothing at that luminance.
// These sit at L* 26–36 — still muted enough to be cloth in a dim room, far
// enough apart in hue and lightness that a four-agent room reads as four
// individuals. Board 29 measured the shipped set: four agents in four hoods,
// closest pair 42 RGB units apart, from a set spanning 42–120.
//
// ── Why the roster claims the hood ─────────────────────────────────────────
//
// A uniform hash is not enough and no better hash would be. Four agents drawn
// from six hoods collide about half the time — that is the birthday problem,
// not a defect in the mixing — and "tellable apart at 40px" is a claim about
// THE OWNER'S ROOM rather than about the hash. So the roll is a PREFERENCE and
// the roster is the authority: a hood already worn in your room is taken, and
// the next free one along is worn instead. Deterministic in birth order, which
// is the right semantics — a hood is claimed at birth and never changes hands.

export const HOODS = [
  { id: 'ash',     name: 'ASH',     top: '#5A5F63', bot: '#383C40' },
  { id: 'oxblood', name: 'OXBLOOD', top: '#5E2027', bot: '#361216' },
  { id: 'moss',    name: 'MOSS',    top: '#2E4E37', bot: '#182C20' },
  { id: 'indigo',  name: 'INDIGO',  top: '#4A2E78', bot: '#281846' },
  { id: 'sand',    name: 'SAND',    top: '#6E5836', bot: '#413320' },
  { id: 'slate',   name: 'SLATE',   top: '#33526B', bot: '#1B2E3D' },
];

export const GLOWS = [
  { id: 'teal',   name: 'TEAL',   c: '#3FB6A8' },
  { id: 'gold',   name: 'GOLD',   c: '#C9A227' },
  { id: 'ember',  name: 'EMBER',  c: '#D2632F' },
  { id: 'violet', name: 'VIOLET', c: '#8B6BC4' },
  { id: 'ice',    name: 'ICE',    c: '#7FA8C9' },
  { id: 'lime',   name: 'LIME',   c: '#8FB03F' },
];

/**
 * FNV-1a with a final avalanche.
 *
 * The ref's own note on why it is not something simpler: a `*31` sum folded
 * through `mod 9973` and then `mod 6` put THREE OF THE FOUR house agents on the
 * same hood, because three-letter ids ("bal", "agg", "val") differ only in
 * their low bits and every fold kept them there. Hood and glow are hashed under
 * DIFFERENT SEEDS so the two are independent rather than both derived from the
 * same end of one number.
 */
export function h32(str, seed) {
  let n = seed >>> 0;
  for (let i = 0; i < str.length; i += 1) {
    n ^= str.charCodeAt(i);
    n = Math.imul(n, 16777619) >>> 0;
  }
  n ^= n >>> 15;
  n = Math.imul(n, 2246822507) >>> 0;
  n ^= n >>> 13;
  return n >>> 0;
}

/** The roll he WANTS, from his id alone. A preference; see rollRoster. */
export function idFor(seed) {
  const s = String(seed ?? '');
  return { hood: HOODS[h32(s, 2166136261) % 6], glow: GLOWS[h32(s, 91649) % 6] };
}

const byId = (list, id) => list.find((x) => x.id === id) ?? null;

/**
 * What the server says he is, if it says anything.
 *
 * SERVER-5 may grow an `identity` on the record; until it does this returns
 * null and the roll stands in. Read defensively on purpose — a payload from a
 * future server naming a hood this client has never heard of falls back to the
 * roll rather than drawing a body with no hood at all.
 */
export function storedIdentity(agent) {
  const raw = agent?.identity;
  if (!raw || typeof raw !== 'object') return null;
  const hood = byId(HOODS, typeof raw.hood === 'string' ? raw.hood : raw.hood?.id);
  const glow = byId(GLOWS, typeof raw.glow === 'string' ? raw.glow : raw.glow?.id);
  if (!hood && !glow) return null;
  const rolled = idFor(agent?.id ?? agent?.name);
  return { hood: hood ?? rolled.hood, glow: glow ?? rolled.glow, stored: true };
}

/**
 * One agent's identity, with no roster to check against.
 *
 * Use this where there IS no roster — a single agent on a felt full of other
 * people's, a notification, a card reached by deep link. In the owner's own
 * room, use `identitiesFor` instead: only the roster can promise four hoods.
 */
export function identityOf(agent) {
  return storedIdentity(agent) ?? { ...idFor(agent?.id ?? agent?.name), stored: false };
}

/**
 * The whole household's identities, with the hoods claimed.
 *
 * The roll is a preference and this is the authority. An agent the SERVER has
 * given an identity claims his hood and glow outright — the server's word is
 * final and is not something a neighbour can take — and everyone else takes the
 * next free one along from the one he wanted.
 *
 * Deterministic in the order it is handed the roster, which must therefore be
 * birth order for the claim to mean "claimed at birth". The roster comes off
 * /api/agents in creation order, which is that.
 *
 * @param {Array} agents  the household, in birth order
 * @returns {Map<string, {hood, glow, stored}>} keyed by agent id
 */
export function identitiesFor(agents = []) {
  const out = new Map();
  const hoodsUsed = new Set();
  const glowsUsed = new Set();

  const free = (list, used, from) => {
    for (let k = 0; k < list.length; k += 1) {
      const c = list[(from + k) % list.length];
      if (!used.has(c.id)) { used.add(c.id); return c; }
    }
    // More agents than hoods: the room is over the cap and somebody wears a
    // hood twice, which is better than somebody wearing none.
    return list[from];
  };

  // Two passes, because a claim has to be honoured before it can be taken. The
  // server's identities are claimed first whatever their birth order.
  const stored = new Map();
  for (const agent of agents) {
    const id = String(agent?.id ?? '');
    if (!id) continue;
    const said = storedIdentity(agent);
    if (!said) continue;
    stored.set(id, said);
    hoodsUsed.add(said.hood.id);
    glowsUsed.add(said.glow.id);
  }

  for (const agent of agents) {
    const id = String(agent?.id ?? '');
    if (!id) continue;
    const said = stored.get(id);
    if (said) { out.set(id, said); continue; }
    const want = idFor(agent?.id ?? agent?.name);
    out.set(id, {
      hood: free(HOODS, hoodsUsed, HOODS.indexOf(want.hood)),
      glow: free(GLOWS, glowsUsed, GLOWS.indexOf(want.glow)),
      stored: false,
    });
  }
  return out;
}
