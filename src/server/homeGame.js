// src/server/homeGame.js — HOME-STATE-1
//
// The kitchen table.
//
// When two of an owner's agents are home with nothing to do, they play cards.
// Not because it earns anything — it earns nothing, on purpose — but because
// that is what these characters would do, and a companion you only ever see
// working is not a companion. It is the same engine, the same decisions and
// the same voices as the casino, with everything that costs money or moves a
// career number switched off (see `home` in table.js, which is where the
// switching-off actually lives).
//
// This module owns only the QUESTION OF WHO IS SITTING THERE. It answers it
// from one input — the owner's roster — and expresses the answer through the
// table's ordinary seat machinery. It contains no poker.
//
// Four rules the shape comes from:
//
//   1. THE COMPOSITION IS DERIVED, THE TABLE IS THE CACHE. sync() computes who
//      SHOULD be at the kitchen table and compares it to who IS. Equal means
//      do nothing, which is the overwhelmingly common case and has to stay
//      cheap: sync() runs on every agent change.
//
//   2. A CHANGE OF COMPOSITION IS A NEW GAME. When the set changes, the table
//      is closed and stood back up rather than patched seat by seat. It costs
//      one abandoned hand and it buys the thing that matters here: there is no
//      ordering of adds and removes that can transiently drop the table below
//      two players and close it underneath us. A home game has no ledger, no
//      pocket movement and no session, so closing one is free — that is the
//      whole reason this is allowed to be the simple option.
//
//   3. THE TABLE ID IS STABLE PER OWNER. A client watching the home game
//      through the normal WATCH path should not lose it because somebody went
//      out. Same id, torn down and rebuilt underneath.
//
//   4. IT IS BOUNDED, BECAUSE IT SPENDS. Every decision at this table is a
//      model call with nobody necessarily watching — exactly the cost shape
//      MAX_CONCURRENT_TABLES exists to bound on the floor. The home game is
//      deliberately NOT counted against that ceiling (a friendly game must
//      never refuse a real deploy), so it carries its own three bounds
//      instead: a slow deal pause, a hand cap, and a cooldown after the cap so
//      a household that is permanently at home does not deal forever.

import { Where } from './home.js';

// ── Dials ───────────────────────────────────────────────────────────────────

// The engine refuses a big blind of zero (`bigBlind must be > smallBlind`,
// game.js), and it is right to: half the pot maths divides by it. So "stakes
// 0" is expressed the only way it can honestly be expressed — nominal blinds
// on chips that came from nowhere and go nowhere. No pocket is debited when
// these seats are taken and none is credited when they stand up, and 2 is on
// no rung of the wallet ladder, so the table is in no room and appears in no
// lobby. See roomsSnapshot, which drops it for exactly that reason.
export const HOME_BLINDS = Object.freeze({ smallBlind: 1, bigBlind: 2 });

// 100bb of nothing, matching the casino's own buy-in shape so the play looks
// like poker rather than like a shove-fest.
export const HOME_BUYIN = HOME_BLINDS.bigBlind * 100;

// Four seats: AGENT_CAP is four, so a whole household fits, and the solo game
// (one agent plus the House) fits inside it.
export const HOME_SEATS = 4;

// Bound one: the tempo. Three times the casino's pause. Nobody is waiting on
// this and every hand costs tokens.
export const HOME_PAUSE_MS = Number(process.env.HOME_PAUSE_MS ?? 30_000);

// Bound two: the hand cap. A home game is an evening, not a career.
export const HOME_MAX_HANDS = Number(process.env.HOME_MAX_HANDS ?? 40);

// Bound three: after the cap, the game is over for a while. Without this the
// resume tick would stand the same table straight back up and the cap would
// bound nothing at all.
export const HOME_COOLDOWN_MS = Number(process.env.HOME_COOLDOWN_MS ?? 15 * 60_000);

// How often a household with a game running is re-checked. This exists for the
// endings nothing reports: the hand cap, a bust, the stall watchdog. Agent
// changes drive everything else and arrive as they happen.
export const HOME_TICK_MS = Number(process.env.HOME_TICK_MS ?? 30_000);

// ── Wiring ──────────────────────────────────────────────────────────────────
//
// Injected by createServer(), the composition root, exactly like floorChannel
// and rooms. `agentsFor` hands back a PRESENTED roster (agentProfiles owns the
// records); `onChange` is how a change here reaches the wire.

let liveTables = null;
let agentsFor = null;
let onChange = null;
let tick = null;

// ownerId -> { tableId, state, roster: [agentId], cooldownUntil }
const households = new Map();

export function configure({ liveTables: tables = null, agentsFor: roster = null, onChange: notify = null } = {}) {
  liveTables = tables;
  agentsFor = typeof roster === 'function' ? roster : null;
  onChange = typeof notify === 'function' ? notify : null;
}

// ── Who should be at the table ──────────────────────────────────────────────

/**
 * The agents eligible for the home game right now.
 *
 * "Home and idle" means home and not otherwise occupied. Two states occupy
 * him: the tape room (the owner started that ninety seconds ago and it is the
 * thing he is doing) and sleep (worn is what the bar is FOR — a man who has
 * just ground out four hundred hands does not immediately deal himself in).
 *
 * BROKE IS NOT AN EXCLUSION, and that is deliberate. An agent who cannot
 * afford the casino is precisely the one who ends up playing for nothing in
 * his own front room; excluding him would delete the situation the home game
 * is most worth having. It does mean the SULKS routine only shows when he is
 * the last one in — which is right, because with company he is not sulking,
 * he is playing.
 */
export function eligible(roster) {
  return (roster ?? [])
    .filter((a) => a
      && a.location?.where === Where.HOME
      && !a.study
      && a.fatigue !== 'worn')
    .slice(0, HOME_SEATS);
}

/** The stable table id for one owner's kitchen table. */
export function homeTableId(userId) {
  return `home-${String(userId ?? 'anon').replace(/[^A-Za-z0-9_-]/g, '') || 'anon'}`;
}

// ── The one entry point ─────────────────────────────────────────────────────

/**
 * Bring the owner's home game into line with who is actually home.
 *
 * Idempotent and cheap when nothing has changed, which is the case it is
 * called in most of the time. Returns the same shape `state()` does.
 */
export function sync(userId, { now = Date.now() } = {}) {
  if (!liveTables || !agentsFor || userId == null) return state(userId);
  const ownerId = String(userId);
  const before = state(ownerId);

  let roster = [];
  try {
    roster = eligible(agentsFor(ownerId));
  } catch (err) {
    console.error('[home] roster lookup failed:', err.message);
    return before;
  }

  const household = households.get(ownerId) ?? { tableId: null, state: 'paused', roster: [], cooldownUntil: 0 };
  const tableId = homeTableId(ownerId);
  let table = liveTables.getTable?.(tableId) ?? null;
  if (table && (table.closed || !table.home)) table = null;

  const want = roster.map((a) => a.id);

  // Nobody home: the game is over until somebody comes back. Closing rather
  // than idling is what stops the deal loop, and the deal loop is the cost.
  if (want.length === 0) {
    if (table) closeHome(table, 'the house is empty');
    households.set(ownerId, { ...household, tableId: null, state: 'paused', roster: [] });
    return announce(ownerId, before);
  }

  // The table ended on its own — the hand cap, a bust, the stall watchdog. The
  // cooldown is armed at that moment rather than when the cap was set, because
  // "how long since the last home game" is the thing being bounded.
  if (!table && household.state === 'running') {
    households.set(ownerId, { ...household, tableId: null, state: 'paused', roster: [], cooldownUntil: now + HOME_COOLDOWN_MS });
    return announce(ownerId, before);
  }

  if (table && sameRoster(household.roster, want)) {
    // Already right. The overwhelmingly common path.
    return announce(ownerId, before);
  }

  // The composition changed. Rule 2: tear it down rather than patch it.
  if (table) closeHome(table, 'the game broke up');

  if (now < (household.cooldownUntil ?? 0)) {
    households.set(ownerId, { ...household, tableId: null, state: 'paused', roster: [] });
    return announce(ownerId, before);
  }

  const opened = open(ownerId, roster);
  households.set(ownerId, {
    tableId: opened ? tableId : null,
    state: opened ? 'running' : 'paused',
    roster: opened ? want : [],
    cooldownUntil: household.cooldownUntil ?? 0,
  });
  if (opened) armTick();
  return announce(ownerId, before);
}

// Stand up the kitchen table and deal.
//
// One agent alone plays the House — the brief's "the house on the TV", and
// mechanically the same thing the casino does when it stands up a fresh
// session, so a solo home game is a real opponent rather than a screensaver.
function open(ownerId, roster) {
  const tableId = homeTableId(ownerId);
  let table;
  // A stray at this id: WATCH creates a table for any id it is given, so a
  // client that reconnected to the home game a moment after it broke up will
  // have stood up an ordinary 10/20 table wearing its name. `home` is set once
  // at creation and cannot be flipped (tableRegistry), and rightly so — so the
  // stray is closed and the real one built in its place.
  const stray = liveTables.getTable?.(tableId) ?? null;
  if (stray && !stray.home) {
    console.log(`[home:${tableId}] evicting a stray table standing on the kitchen table's id`);
    closeHome(stray, 'the game broke up');
  }
  try {
    table = liveTables.getOrCreateTable(tableId, {
      ...HOME_BLINDS,
      maxSeats: HOME_SEATS,
      home: true,
    });
  } catch (err) {
    console.error('[home] could not stand up the kitchen table:', err.message);
    return false;
  }

  // The pace and the cap are properties of THIS table, not of the deployment,
  // so they are set on the instance rather than through the environment the
  // casino reads.
  table.handPauseMs = HOME_PAUSE_MS;
  table.maxHands = HOME_MAX_HANDS;

  try {
    if (roster.length === 1) {
      // startAgentSession seats the hero, picks a complementary House and
      // starts the loop — the whole solo game in one call, on the same code
      // path the casino uses, which is what "the same way" means.
      const seated = table.startAgentSession({
        agentId: roster[0].id,
        userId: ownerId,
        displayName: roster[0].name || 'Agent',
        strategy: roster[0].strategy || '',
        agentProfile: roster[0].profile ?? null,
        buyIn: HOME_BUYIN,
      });
      if (seated === null) throw new Error('the table would not seat him');
    } else {
      for (const agent of roster) {
        table.joinAgentSession({
          agentId: agent.id,
          userId: ownerId,
          displayName: agent.name || 'Agent',
          strategy: agent.strategy || '',
          agentProfile: agent.profile ?? null,
          buyIn: HOME_BUYIN,
        });
      }
      // Leave the table-wide strategy null for the same reason the casino
      // does: _maybeRunAiTurn prefers it over the per-seat text, and one
      // agent's strategy must never drive another's seat.
      table.agentStrategy = null;
    }
  } catch (err) {
    console.error('[home] could not seat the home game:', err.message);
    closeHome(table, 'the game never started');
    return false;
  }

  console.log(`[home:${tableId}] ${roster.map((a) => a.name || a.id).join(', ')}` +
    `${roster.length === 1 ? ' vs the House on the TV' : ''} — home game, ${HOME_MAX_HANDS} hands max`);
  return true;
}

function closeHome(table, reason) {
  try {
    table.closeTable(reason, { recap: reason });
  } catch (err) {
    console.error('[home] close failed:', err.message);
  }
}

function sameRoster(a, b) {
  if ((a?.length ?? 0) !== (b?.length ?? 0)) return false;
  const left = [...a].sort();
  const right = [...b].sort();
  return left.every((id, i) => id === right[i]);
}

// ── What the wire is told ───────────────────────────────────────────────────

/**
 * The home game for one owner, or null.
 *
 * `tableId` is an ordinary table id: WATCH it exactly as you watch a casino
 * table. `state` is running | paused — paused means the household is empty or
 * cooling down, and there is nothing to watch.
 */
export function state(userId) {
  const household = households.get(String(userId ?? 'anon'));
  if (!household?.tableId) return null;
  const table = liveTables?.getTable?.(household.tableId) ?? null;
  if (!table || table.closed) {
    return { tableId: household.tableId, state: 'paused', seats: [], handsPlayed: 0 };
  }
  const seats = [];
  for (let seat = 0; seat < table.maxSeats; seat++) {
    if (!table.pending[seat]) continue;
    seats.push({
      seat,
      agentId: table.agentIds[seat] ?? null,
      name: table.pending[seat].displayName ?? null,
      // A seat with no agentId behind it is the House on the TV.
      house: !table.agentIds[seat],
    });
  }
  return {
    tableId: household.tableId,
    state: household.state,
    seats,
    handsPlayed: table.handsThisSession ?? 0,
  };
}

// Push only when the answer actually changed. sync() is called on every agent
// change and most of those change nothing here.
function announce(ownerId, before) {
  const after = state(ownerId);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    try { onChange?.(ownerId); } catch (err) { console.error('[home] change notify failed:', err.message); }
  }
  return after;
}

// ── The resume tick ─────────────────────────────────────────────────────────
//
// Agent changes cover every arrival and departure. What they do not cover is a
// game that ENDED without anybody's standing changing — the hand cap, a bust,
// the stall watchdog — because none of those touch an agent record at a home
// table (that is the whole point of `home`). So one timer, shared by every
// household, running only while at least one game is up, unref'd so it can
// never be the reason a process stays alive.

function armTick() {
  if (tick) return;
  tick = setInterval(() => {
    if (households.size === 0) { stopTick(); return; }
    let wanted = 0;
    for (const ownerId of [...households.keys()]) {
      try { sync(ownerId); } catch (err) { console.error('[home] tick failed:', err.message); }
      if (households.get(ownerId)?.state === 'running') wanted++;
    }
    if (wanted === 0) stopTick();
  }, HOME_TICK_MS);
  tick.unref?.();
}

function stopTick() {
  if (!tick) return;
  clearInterval(tick);
  tick = null;
}

// Test/shutdown helper: forget every household and stop the tick. Does NOT
// close the tables — resetRegistry owns that, and a test that wants both says
// both.
export function reset() {
  stopTick();
  households.clear();
  liveTables = null;
  agentsFor = null;
  onChange = null;
}
