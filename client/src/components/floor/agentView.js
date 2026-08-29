// Maps a raw /api/agents record onto what the floor needs to draw.
//
// Tree 3.5 will add mood / lastMoment / unseenRecap / presence to the API.
// Until then every one of them is derived from fields that exist today, so
// the floor is fully presentable on the current backend and simply gets
// truer once the real fields land.

import { safeMood } from './atoms.jsx';

export function presenceOf(agent) {
  if (agent?.presence === 'playing' || agent?.presence === 'resting') return agent.presence;
  return agent?.activeTableId || agent?.status === 'playing' ? 'playing' : 'resting';
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
    // Sulking and tilted agents sit alone in the lounge corner. With no mood
    // data yet this stays empty and everyone rests at the bar.
    const mood = moodOf(agent);
    if (mood === 'sulking' || mood === 'tilted') lounge.push(agent);
    else resting.push(agent);
  }
  return { playing, resting, lounge };
}

export function standupLine({ playing, resting, lounge, total }) {
  if (total === 0) return 'The room is open.';
  if (playing.length === 0) return "Everyone's resting.";
  const rest = resting.length + lounge.length;
  const p = `${playing.length} playing`;
  return rest > 0 ? `${p} · ${rest} resting` : p;
}
