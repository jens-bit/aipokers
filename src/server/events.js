// src/server/events.js — EVENT-1
//
// The casino's wire: one bus every table shouts into, and the last 200 things
// that happened anywhere in the building.
//
// This is the foundation for the floor ticker — the strip that tells you a
// table you are NOT watching just got interesting, so you can go and watch it.
// That is the whole product argument for it: a casino you cannot hear is a
// lobby with a list of tables in it.
//
// Three rules the shape of this file comes from:
//
//   1. AN EVENT IS A HEADLINE, NOT A HAND. Names, a type, a pot size, the hand
//      number it happened on, a short line of plain words. No hole cards, no
//      reasoning, no equity. The ticker
//      is public — it goes to every floor subscriber, not just the owner of the
//      agents in it — so nothing may travel on it that AGE-33/37 would have
//      withheld at the table. If you ever want to say more, link to the table
//      and let the normal ownership checks decide what the spectator sees.
//   2. THE BUFFER IS A RING, NOT A LOG. 200 events, in memory, gone on restart.
//      The ticker is a "what is happening right now" surface; history is what
//      hand records and biographies are for. A ring also means this module can
//      never be the thing that fills a disk or leaks a process.
//   3. NOTHING HERE KNOWS ABOUT A TABLE. Tables call in; this file never calls
//      out except through the emitter. That is what lets the whole thing be
//      tested by emitting six events and reading them back.
//
// The `hot` event is the one with a deadline attached: it fires when a big pot
// reaches the river with two or more players still live, BEFORE the showdown,
// because an event that says "something good happened" thirty seconds after it
// finished is a newspaper, not a ticker.

import { EventEmitter } from 'node:events';
import { heatThresholdBb } from './pace.js';

// ── The vocabulary ──────────────────────────────────────────────────────────

export const EventType = Object.freeze({
  BIG_POT: 'bigPot',                 // a pot worth talking about, at hand end
  COOLER: 'cooler',                  // cooler.js classified the finished hand
  HEATER: 'heater',                  // an agent is running over the table
  BUST: 'bust',                      // a seat has nothing left
  NEMESIS_SEATED: 'nemesisSeated',   // he just sat down across from his nemesis
  HOT: 'hot',                        // live: big pot, on the river, still open
});

const TYPES = new Set(Object.values(EventType));

// ── Thresholds ──────────────────────────────────────────────────────────────
//
// Both pot thresholds are derived from PACE_HEAT_BB rather than set on their
// own, so a deployment that retunes what "big" means at the felt retunes what
// the floor shouts about at the same time. One dial, not three.

// `hot` uses the felt's own threshold (PACE_HEAT_BB, default 25bb): if the
// table is warm enough for the client to change its pacing, it is warm enough
// to be worth walking over to.
export const HOT_THRESHOLD_MULTIPLE = 1;

// `bigPot` is three times that (default 75bb). A finished hand is competing
// with every other table in the casino for one line of a ticker, so the bar is
// higher than the bar for warming up a felt somebody is already looking at.
export const BIG_POT_MULTIPLE = 3;

export function hotThresholdBb() {
  return heatThresholdBb() * HOT_THRESHOLD_MULTIPLE;
}

export function bigPotThresholdBb() {
  return heatThresholdBb() * BIG_POT_MULTIPLE;
}

// A heater is five of the last six. Six is short enough that it means "right
// now" and long enough that it is not one lucky pot; five of it is rare enough
// that the line is worth reading. The window is per AGENT and casino-wide, not
// per table — the claim is about him, and he keeps it when he changes seats.
export const HEATER_WINDOW = 6;
export const HEATER_WINS = 5;

// ── The ring ────────────────────────────────────────────────────────────────

export const EVENT_RING_SIZE = 200;

// Windows for agents nobody has thought about in a while are dropped rather
// than kept forever: this map is a live view, not a record.
const HEATER_MEMORY_AGENTS = 500;

// Two signals ride this emitter, and the difference between them is the whole
// of rule 1 above.
//
//   'event'  (event)          — the public headline. It is what the ring
//                               stores, what GET /api/events answers, and what
//                               floorChannel fans out to every subscriber.
//   'detail' (record, event)  — NOTIFY-2: the owner-addressed half of the same
//                               fact, passed in as `detail` and delivered
//                               ONLY here. It never enters the ring, never
//                               reaches /api/events and never reaches the
//                               ticker, which is what lets it carry an owner
//                               id and a buy-in that rule 1 forbids in a
//                               headline. events.js does not read these
//                               records; it only carries them, so what a
//                               record means is entirely between the table
//                               that emits it and notify.js, which subscribes.
export const bus = new EventEmitter();
// Every floor subscriber does NOT get its own listener (floorChannel attaches
// exactly one and fans out itself), but tests and future surfaces attach their
// own, and the default of 10 is low enough to produce a scary warning for a
// situation that is entirely fine.
bus.setMaxListeners(50);

const ring = [];
let nextId = 1;

// agentId -> { results: boolean[], hot: boolean }
const heaterWindows = new Map();

/**
 * Put one event on the wire. Returns the frozen event that was stored, so a
 * caller can assert on the id it got.
 *
 * @param {string} type      one of EventType
 * @param {string} tableId   where it happened
 * @param {string[]} agentIds the agents it is about (empty for a table of
 *                            humans or House regulars — the event is still
 *                            real, it just cannot be filtered by agent)
 * @param {string} headline  short, plain words, no cards
 * @param {number} pot       the pot in chips at the moment it fired
 * @param {number} handNumber EVENTS-3: which hand it was, so a consumer can
 *                            address the hand this headline is about. An
 *                            address is not a hand: it carries no card, no
 *                            reasoning and no owner, and it is the same
 *                            counter the client already sees on the felt. The
 *                            channel ticker uses it to ask SHARE-2 whether a
 *                            card exists for exactly this hand rather than
 *                            guessing from a timestamp. 0 when there is no
 *                            hand in progress (a man sitting down).
 * @param {object[]} detail  NOTIFY-2: the private half of the same fact — see
 *                           the note above `bus`
 */
export function emitCasinoEvent({ type, tableId = null, agentIds = [], headline = '', pot = 0, handNumber = 0, detail = [] } = {}) {
  if (!TYPES.has(type)) throw new Error(`unknown event type: ${type}`);

  const chips = Number(pot);
  const event = Object.freeze({
    id: nextId++,
    ts: Date.now(),
    type,
    tableId: tableId == null ? null : String(tableId),
    agentIds: Object.freeze([...new Set((agentIds ?? []).filter(Boolean).map(String))]),
    headline: String(headline),
    pot: Number.isFinite(chips) ? Math.round(chips) : 0,
    handNumber: Number.isFinite(Number(handNumber)) ? Math.max(0, Math.floor(Number(handNumber))) : 0,
  });

  ring.push(event);
  if (ring.length > EVENT_RING_SIZE) ring.splice(0, ring.length - EVENT_RING_SIZE);

  // A listener that throws is a bug in the listener. It must not take the hand
  // that emitted the event down with it.
  try {
    bus.emit('event', event);
  } catch (err) {
    console.error('[events] listener threw:', err.message);
  }

  // NOTIFY-2: the owner-addressed half, one signal per record, on a channel of
  // its own. Emitted after the public event so the ticker is never behind a
  // notifier, and separately wrapped so a slow or throwing subscriber cannot
  // cost the floor its headline.
  for (const d of Array.isArray(detail) ? detail : []) {
    if (!d) continue;
    try {
      bus.emit('detail', d, event);
    } catch (err) {
      console.error('[events] detail listener threw:', err.message);
    }
  }
  return event;
}

/**
 * Everything newer than `since`, oldest first. A client that has been away
 * longer than the ring gets the newest `limit` rather than the oldest, because
 * a ticker that is catching up should show what is happening now.
 */
export function eventsSince(since = 0, { limit = EVENT_RING_SIZE } = {}) {
  const from = Number(since);
  const after = Number.isFinite(from) && from > 0 ? from : 0;
  const cap = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.min(Math.floor(Number(limit)), EVENT_RING_SIZE)
    : EVENT_RING_SIZE;
  const out = ring.filter((e) => e.id > after);
  return out.slice(Math.max(0, out.length - cap));
}

// ROOMS-1: how recently a table must have shouted `hot` for the floor to still
// be pointing at it. Short on purpose — the whole value of the flag is that
// there is still time to walk over and watch, so a stale one is worse than
// none. It is the ticker's own deadline read a second way.
export const HOT_RECENT_MS = Number(process.env.ROOMS_HOT_WINDOW_MS ?? 20_000);

/**
 * The tableIds that fired a `hot` event inside the last `windowMs`, most
 * recent first. Deduped: a table that went hot three times in the window is
 * one entry, because the caller is asking "which tables", not "how often".
 */
export function hotTableIds({ windowMs = HOT_RECENT_MS, now = Date.now() } = {}) {
  const span = Number(windowMs);
  const cutoff = Number(now) - (Number.isFinite(span) && span > 0 ? span : HOT_RECENT_MS);
  const ids = new Set();
  // The ring is in time order, so the first event older than the cutoff ends
  // the walk — this stays O(events in the window), not O(200), on every push.
  for (let i = ring.length - 1; i >= 0; i--) {
    const event = ring[i];
    if (event.ts < cutoff) break;
    if (event.type === EventType.HOT && event.tableId) ids.add(event.tableId);
  }
  return [...ids];
}

/** The id a client should send back as `since` next time. */
export function lastEventId() {
  return ring.length > 0 ? ring[ring.length - 1].id : 0;
}

export function ringSize() {
  return ring.length;
}

/**
 * Record one finished hand for one agent and say whether he is on a heater.
 *
 * `crossed` is the field the caller acts on: it is true only on the hand that
 * TOOK him over the line. Without it the ticker would repeat "he has won 5 of
 * the last 6" every hand for as long as it stayed true, which is how a ticker
 * stops being read.
 */
export function noteHandWin(agentId, won) {
  if (!agentId) return null;
  const key = String(agentId);
  let w = heaterWindows.get(key);
  if (!w) {
    w = { results: [], hot: false };
    if (heaterWindows.size >= HEATER_MEMORY_AGENTS) {
      // Maps iterate in insertion order, so the first key is the least
      // recently introduced agent.
      const oldest = heaterWindows.keys().next().value;
      if (oldest !== undefined) heaterWindows.delete(oldest);
    }
    heaterWindows.set(key, w);
  }

  w.results.push(!!won);
  if (w.results.length > HEATER_WINDOW) w.results.splice(0, w.results.length - HEATER_WINDOW);

  const wins = w.results.filter(Boolean).length;
  // The window is capped at six, so "5 wins in the window" IS "5 of the last
  // 6" — and a man who has won his first five hands qualifies on five, which
  // is the stronger claim, not a weaker one.
  const hot = wins >= HEATER_WINS;
  const crossed = hot && !w.hot;
  w.hot = hot;
  return { hot, crossed, wins, hands: w.results.length };
}

/** Test helper: empty the ring, the id counter and the heater windows. */
export function resetEvents() {
  ring.length = 0;
  nextId = 1;
  heaterWindows.clear();
}

// ── REST ────────────────────────────────────────────────────────────────────

/**
 * GET /api/events?since=<id> — the ticker's poll, and the fallback for any
 * client that is not holding a socket open.
 *
 * Public, like the ticker itself: it carries headlines only. It sits under
 * /api, so index.js's rate limiter already covers it, and it triggers no model
 * call, so there is nothing here to spend.
 */
export function installEventRoutes(app) {
  app.get('/api/events', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const since = Number(req.query?.since ?? 0);
    res.json({
      events: eventsSince(Number.isFinite(since) ? since : 0),
      lastId: lastEventId(),
    });
  });
}
