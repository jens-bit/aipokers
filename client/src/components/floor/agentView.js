// Maps a raw /api/agents record onto what the floor needs to draw.
//
// Tree 3.5 will add mood / lastMoment / unseenRecap / presence to the API.
// Until then every one of them is derived from fields that exist today, so
// the floor is fully presentable on the current backend and simply gets
// truer once the real fields land.

import { safeMood } from './atoms.jsx';

// WALLET-1 added a fourth presence: 'broke' is an agent who is idle AND has no
// way back to a felt without the owner. It is a presence, not a status, so the
// floor draws him apart from the bar rather than in a seat.
export function presenceOf(agent) {
  if (agent?.presence === 'playing' || agent?.presence === 'resting' || agent?.presence === 'broke') {
    return agent.presence;
  }
  return agent?.activeTableId || agent?.status === 'playing' ? 'playing' : 'resting';
}

// FL-1: broke is the server's word, from the wallet projection. The pocket is
// the fallback for a projection that predates the presence value.
export function isBroke(agent) {
  return presenceOf(agent) === 'broke' || agent?.pocket?.broke === true;
}

export function moodOf(agent) {
  return safeMood(agent?.mood?.state);
}

// Only real when the API supplies it — never invented from stats.
export function causeOf(agent) {
  const cause = agent?.mood?.cause;
  return typeof cause === 'string' && cause.trim() ? cause.trim() : null;
}

export function hasUnseenRecap(agent) {
  return agent?.unseenRecap === true;
}

// live > recap > resting. Drives the chip marker and the zoom's state tag.
export function stateOf(agent) {
  if (presenceOf(agent) === 'playing') return 'live';
  if (hasUnseenRecap(agent)) return 'recap';
  return 'resting';
}

// One line in the agent's voice. Real when Tree 3.5 supplies lastMoment;
// otherwise derived from what today's record actually knows.
export function lastMomentOf(agent) {
  const text = agent?.lastMoment?.text;
  if (typeof text === 'string' && text.trim()) return text.trim();

  if (presenceOf(agent) === 'playing') return 'At the table.';

  const hands = agent?.recentHands;
  if (Array.isArray(hands) && hands.length > 0) {
    const won = hands.filter((h) => h.won).length;
    if (won === hands.length) return 'Won every hand I finished. Good session.';
    if (won === 0) return 'Rough run — lost the last few.';
    return `Won ${won} of my last ${hands.length}.`;
  }

  const played = agent?.stats?.handsPlayed;
  if (played) return 'Resting between sessions.';
  return 'Never played a hand yet.';
}

// Pot for the felt ticker. Only shown when a live number exists.
export function potOf(agent, liveGame) {
  const pot = liveGame?.pot;
  return Number.isFinite(pot) && pot > 0 ? pot.toLocaleString() : null;
}

export function splitFloor(agents) {
  const playing = [];
  const resting = [];
  const lounge = [];
  for (const agent of agents) {
    if (presenceOf(agent) === 'playing') { playing.push(agent); continue; }
    // FL-1: the one who cannot play sits apart from the bar, in the corner —
    // the ref draws him there with a drink he is not enjoying. Sulking and
    // tilted agents keep him company.
    const mood = moodOf(agent);
    if (isBroke(agent) || mood === 'sulking' || mood === 'tilted') lounge.push(agent);
    else resting.push(agent);
  }
  return { playing, resting, lounge };
}

// ── FL-1 · news at his feet ──────────────────────────────────────────────────
// A ghost carries one pip, and only when he has news. No news, no pip.
//
// Growth ticks land in agent.attrLog as { ts, key, from, to, cause }. A run
// happens once at the end of a session and every tick in it shares a ts, so
// the newest ts is the last thing that happened to him and the count of
// upward ticks in it is "+N GREW".
const GREW_WINDOW_MS = 36 * 60 * 60 * 1000;

export function grewCount(agent, now = Date.now()) {
  const log = Array.isArray(agent?.attrLog) ? agent.attrLog : [];
  let newest = 0;
  for (const e of log) {
    if (!e || !(e.to > e.from)) continue;
    if (e.ts > newest) newest = e.ts;
  }
  if (!newest || now - newest > GREW_WINDOW_MS) return 0;
  return log.filter((e) => e && e.ts === newest && e.to > e.from).length;
}

// His bands narrowed this session — the character system's transient caret,
// which rides one session and then retires. The closest thing the record has
// to "he has been worn into shape"; true fatigue is not readable here, because
// presentAgent projects `fatigue: 'fresh'` for anyone not currently playing.
export function narrowedCount(agent) {
  return Array.isArray(agent?.narrowed) ? agent.narrowed.length : 0;
}

// Priority is the order of consequence: money he does not have beats an
// attribute that moved, which beats a band that settled.
export function newsPipFor(agent, now = Date.now()) {
  if (isBroke(agent)) return 'broke';
  if (grewCount(agent, now) > 0) return 'grew';
  if (narrowedCount(agent) > 0) return 'worn';
  return null;
}

// ── FL-2 · a resting room still breathes ─────────────────────────────────────
// "Everyone's resting." is retired by wave 34: it was a dead room, a sentence
// that told the owner nothing had happened and gave him nothing to look at.
// The standup now says what actually happened — who grew, who is out of money
// — and falls back to a count rather than a verdict.

const WORDS = ['nobody', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
function count(n) {
  return n < WORDS.length ? WORDS[n] : String(n);
}
function sentence(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// The one thing worth saying about a room where nothing is being played. News
// is ranked the same way the pips are: money he does not have, then an
// attribute that moved, then a band that settled.
export function roomNews(agents, now = Date.now()) {
  const list = Array.isArray(agents) ? agents : [];
  const broke = list.find((a) => isBroke(a));
  if (broke) return `${broke.name} is out of money`;
  const grew = list.find((a) => grewCount(a, now) > 0);
  if (grew) return `${grew.name} grew tonight`;
  const worn = list.find((a) => narrowedCount(a) > 0);
  if (worn) return `${worn.name} settled into shape`;
  return null;
}

export function standupLine({ playing, resting, lounge, total, agents = null, now = Date.now() }) {
  if (total === 0) return 'The room is open.';
  const rest = resting.length + lounge.length;

  if (playing.length === 0) {
    // Never a verdict on the room. A count, and the thing that happened in it.
    const head = sentence(`${count(rest)} resting`);
    const news = roomNews(agents ?? [...resting, ...lounge], now);
    return news ? `${head} · ${news}` : `${head} · the room is quiet`;
  }

  const p = `${playing.length} playing`;
  return rest > 0 ? `${p} · ${rest} resting` : p;
}
