// src/server/opponentStats.js
// Rolling per-opponent stat counters, keyed by playerId (with displayName
// tracked as a soft alias so the briefing can print a human-friendly name).
//
// Data model: for each opponent we keep a ring buffer of the last N hand
// records. Each record is a compact per-hand summary derived from that
// hand's full action log — one entry per hand, not per action, so VPIP/PFR
// remain per-hand flags in the standard poker sense.
//
// Derived reads are computed on demand from the ring (cheap, N ≤ 50).

import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'opponents.json');
const RING_SIZE = 50;
const SAVE_THROTTLE_MS = 2000;

let store = {};
let persistEnabled = true;
let pendingSaveTimer = null;
let lastSaveAt = 0;

// Cold start: try to load persisted state.
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
try { store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')); } catch { store = {}; }

function scheduleSave() {
  if (!persistEnabled) return;
  if (pendingSaveTimer) return;
  const delay = Math.max(0, SAVE_THROTTLE_MS - (Date.now() - lastSaveAt));
  pendingSaveTimer = setTimeout(() => {
    pendingSaveTimer = null;
    lastSaveAt = Date.now();
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2), 'utf8');
    } catch (err) {
      console.error('[opponentStats] save failed:', err.message);
    }
  }, delay);
  pendingSaveTimer.unref?.();
}

function ensureEntry(playerId, displayName) {
  if (!store[playerId]) {
    store[playerId] = { playerId, displayName: displayName || playerId, hands: [] };
  } else if (displayName) {
    store[playerId].displayName = displayName;
  }
  return store[playerId];
}

// Record one completed hand. Callers assemble:
//   playerIdsBySeat     — seat → playerId (null for empty seat)
//   displayNamesBySeat  — seat → displayName (fallback to playerId)
//   actionLog           — [{ seat, street, actionType }] in play order across all seats
//   showdownSeats       — array of seat indices that reached showdown
export function recordHand({ playerIdsBySeat, displayNamesBySeat, actionLog, showdownSeats = [] }) {
  if (!Array.isArray(playerIdsBySeat) || !Array.isArray(actionLog)) return;
  const N = playerIdsBySeat.length;

  for (let seat = 0; seat < N; seat++) {
    const playerId = playerIdsBySeat[seat];
    if (!playerId) continue;
    const entry = ensureEntry(playerId, displayNamesBySeat?.[seat]);

    const mine = actionLog.filter((a) => a.seat === seat);
    if (mine.length === 0) continue;

    const vpip = mine.some((a) => a.street === 'preflop' && (a.actionType === 'call' || a.actionType === 'raise'));
    const pfr  = mine.some((a) => a.street === 'preflop' && a.actionType === 'raise');
    let calls = 0, betsRaises = 0, folds = 0;
    let facedAgg = 0, foldsWhenFacingAgg = 0;

    for (let i = 0; i < actionLog.length; i++) {
      const a = actionLog[i];
      if (a.seat !== seat) continue;
      if (a.actionType === 'call')  calls++;
      if (a.actionType === 'bet' || a.actionType === 'raise') betsRaises++;
      if (a.actionType === 'fold')  folds++;
      // Faced-aggression: any earlier bet/raise on the same street from a different seat.
      let facing = false;
      for (let j = 0; j < i; j++) {
        const p = actionLog[j];
        if (p.street !== a.street) continue;
        if (p.seat === seat) continue;
        if (p.actionType === 'bet' || p.actionType === 'raise') { facing = true; break; }
      }
      if (facing) {
        facedAgg++;
        if (a.actionType === 'fold') foldsWhenFacingAgg++;
      }
    }

    entry.hands.push({
      vpip, pfr,
      calls, betsRaises, folds,
      facedAgg, foldsWhenFacingAgg,
      wentToShowdown: Array.isArray(showdownSeats) && showdownSeats.includes(seat),
    });
    if (entry.hands.length > RING_SIZE) {
      entry.hands.splice(0, entry.hands.length - RING_SIZE);
    }
  }
  scheduleSave();
}

// Compute a fresh read from the ring for a single playerId. Returns null if
// the opponent is unknown, or an object with derived percentages if not.
export function getRead(playerId) {
  const entry = store[playerId];
  if (!entry || entry.hands.length === 0) return null;
  const n = entry.hands.length;
  let vpipHits = 0, pfrHits = 0, showdownHits = 0;
  let sumCalls = 0, sumBetsRaises = 0;
  let sumFacedAgg = 0, sumFoldsFacingAgg = 0;
  for (const h of entry.hands) {
    if (h.vpip) vpipHits++;
    if (h.pfr)  pfrHits++;
    if (h.wentToShowdown) showdownHits++;
    sumCalls += h.calls;
    sumBetsRaises += h.betsRaises;
    sumFacedAgg += h.facedAgg;
    sumFoldsFacingAgg += h.foldsWhenFacingAgg;
  }
  return {
    playerId,
    displayName: entry.displayName,
    handsObserved: n,
    vpip: Number(((vpipHits / n) * 100).toFixed(1)),
    pfr:  Number(((pfrHits  / n) * 100).toFixed(1)),
    af:   sumCalls > 0 ? Number((sumBetsRaises / sumCalls).toFixed(2)) : (sumBetsRaises > 0 ? Infinity : 0),
    foldToRaise: sumFacedAgg > 0 ? Number(((sumFoldsFacingAgg / sumFacedAgg) * 100).toFixed(1)) : null,
    wentToShowdown: Number(((showdownHits / n) * 100).toFixed(1)),
  };
}

// Toggle disk persistence (arena uses `false` so runs don't pollute prod state).
export function setPersistEnabled(enabled) {
  persistEnabled = !!enabled;
}

// Wipe in-memory state (used between arena matchups so reads don't leak
// across pairings). Does not touch the disk file — if persist is enabled
// the next save will overwrite it.
export function reset() {
  store = {};
}

// For tests / diagnostics.
export function _snapshot() {
  return JSON.parse(JSON.stringify(store));
}
