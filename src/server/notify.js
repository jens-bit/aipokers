// src/server/notify.js — NOTIFY-1
//
// The bot's voice when the owner is away. Refs: design-refs/mood-notify.jsx
// (the ladder, the budget board, the violations board) and
// design-refs/Agentic Poker Notifications.html.
//
// These are not screens. They are Telegram messages: one sentence, and at most
// one inline button. The three laws off the ref board, which every builder in
// this file is written against:
//
//   1. Every message lives in the agent's world. Poker, moods, money. Never
//      "we miss you", never a streak about the owner, never guilt.
//   2. Every message names its cause — a time, a number, a hand. If a line
//      cannot be checked against the floor within one tap, it does not ship.
//   3. The cap is part of the design, not a setting.
//
// The cap here is NOTIFY-1's, which is looser than the ref board's (that board
// predates the four triggers below and says two a day, four hours apart, quiet
// from 00:00): three per owner per day, never two inside thirty minutes, quiet
// hours 23:00–08:00 owner-local. The MECHANISM is the ref's, unchanged —
//   · quiet hours HOLD, they do not cancel; an overnight recap arrives at 08:00
//     and still names the 02:14 it describes, which is why the delay does not
//     read as a bug;
//   · the minimum gap is a delay, not a queue-jump — the second message waits;
//   · losing on BUDGET is a drop, not a delay, because a ping that arrives a
//     day late is worse than one that never arrives;
//   · when more events qualify than the budget allows, the ladder decides, and
//     the session recap wins every tie.
//
// Wiring: attachNotify() once, at the end of src/index.js. src/server/events.js
// does not exist on main, so table.js calls notifyEvent() directly at the four
// points that produce these events (session close, seat retire on a bust, the
// biggest-pot flag, the mood transition into tilted). If an event bus ever
// lands, those four call sites are the whole migration.

import {
  recordNotificationSent,
  listNotificationsSince,
  countNotificationsOfType,
  putNotificationHold,
  listNotificationHolds,
  setNotificationHoldDeliverAt,
  deleteNotificationHold,
} from './store.js';
import { isAgentNotifyMuted, setAgentNotifyMuted } from './agentProfiles.js';
import { telegramAuthMiddleware, isOwner } from './auth.js';

// ── The ladder ───────────────────────────────────────────────────────────────
//
// Lower wins. The recap is the only ping the owner implicitly asked for — he
// deployed the agent, so the result is owed — and it takes every tie. A bust
// is money that has stopped moving and the owner has a decision to make, so it
// sits directly under it. Tilt is money moving badly right now. The biggest pot
// is news about him that asks for nothing, which is what makes it safe to send
// and the first thing to lose when the budget is tight.
export const LADDER = {
  session_ended: 1,
  busted:        2,
  tilted:        3,
  biggest_pot:   4,
};

export const BUDGET = {
  maxPerDay:  3,
  minGapMs:   30 * 60 * 1000,
  quietFrom:  23,   // local hour the window closes
  quietUntil:  8,   // local hour it opens again
};

// Owner-local time. We do not yet collect a timezone anywhere, so every owner
// resolves to the default; the hook exists so that the day this is known per
// owner, only tzOffsetFor changes.
const DEFAULT_TZ_OFFSET_MIN = Number(process.env.NOTIFY_TZ_OFFSET_MIN ?? 120); // UTC+2

const MINI_APP_URL = process.env.MINI_APP_URL || 'https://t.me/AigenicPokerBot/game';

const HEAT_TILTED = 70;   // NOTIFY-1: the heat at which tilt is worth a ping

// ── Module state ─────────────────────────────────────────────────────────────

let active = null;   // the attached notifier, or null

export function isAttached() { return active !== null; }

// ── Local-time helpers ───────────────────────────────────────────────────────
// Everything is computed by shifting the epoch and reading UTC getters, so
// there is no dependence on the SERVER's timezone anywhere in this file.

const DAY_MS = 86_400_000;

function localHour(ts, offMin)  { return new Date(ts + offMin * 60_000).getUTCHours(); }
function startOfLocalDay(ts, offMin) {
  return Math.floor((ts + offMin * 60_000) / DAY_MS) * DAY_MS - offMin * 60_000;
}
function isQuiet(ts, offMin) {
  const h = localHour(ts, offMin);
  return h >= BUDGET.quietFrom || h < BUDGET.quietUntil;
}
// The next moment the window is open at or after `ts`.
function nextOpen(ts, offMin) {
  let open = startOfLocalDay(ts, offMin) + BUDGET.quietUntil * 3600_000;
  while (open <= ts) open += DAY_MS;
  return open;
}
// hh:mm in the owner's local time — the "sat out at 02:14" every recap carries.
function hhmm(ts, offMin) {
  const d = new Date(ts + offMin * 60_000);
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

const money = (n) => `$${Math.abs(Math.round(Number(n) || 0)).toLocaleString('en-US')}`;

// ── Message builders ─────────────────────────────────────────────────────────
//
// Each returns { text, button }. Two to three alternates per type, so the bot
// never repeats itself twice running; the alternate is chosen by how many of
// that type this owner has already been sent, so the rotation needs no state
// of its own beyond the ledger.
//
// A button means a decision. The recap and the bust have one — there is a
// thread to open and a call to make. Tilt and the biggest pot carry none: an
// invitation with a call-to-action becomes a chore, and a flavour ping with a
// button is a growth mechanic in costume.

const OPEN = 'Open the floor';

function buildSessionEnded(i, { agentName, opener, pnl, hands, endedAt, tzOffsetMin }) {
  const t   = hhmm(endedAt, tzOffsetMin);
  const dir = pnl >= 0 ? 'up' : 'down';
  const amt = money(pnl);
  // The opener IS the message — it is the line he would open the thread with,
  // already in his voice, already about the night he just had. The signature
  // line under it is what makes the message checkable: a time, and a number.
  const subs = [
    `— ${agentName} · sat out at ${t}, ${dir} ${amt}`,
    `— ${agentName} · ${hands} hand${hands === 1 ? '' : 's'}, finished ${t} ${dir} ${amt}`,
    `— ${agentName} · ${dir} ${amt} when he stopped at ${t}`,
  ];
  return { text: `${opener}\n${subs[i % subs.length]}`, button: OPEN };
}

function buildBusted(i, { agentName, buyIn, hands, endedAt, tzOffsetMin }) {
  const t = hhmm(endedAt, tzOffsetMin);
  const alts = [
    `${agentName} is out — the last of ${money(buyIn)} went at ${t}, ${hands} hands in.`,
    `${agentName} busted at ${t}. ${hands} hands, and he keeps every read he made.`,
    `That is ${agentName}'s stack gone at ${t} — ${hands} hands from ${money(buyIn)}.`,
  ];
  return { text: alts[i % alts.length], button: OPEN };
}

function buildBiggestPot(i, { agentName, pot, handNumber }) {
  const amt = money(pot);
  const alts = [
    `${agentName} just took the biggest pot of the night — ${amt} on hand ${handNumber}.`,
    `${amt} on hand ${handNumber}. That is ${agentName}'s biggest pot tonight.`,
    `Biggest pot of ${agentName}'s night: ${amt}, hand ${handNumber}.`,
  ];
  return { text: alts[i % alts.length], button: null };
}

function buildTilted(i, { agentName, heat, cause }) {
  const why = cause ? ` after ${cause}` : '';
  const alts = [
    `${agentName} is tilted — heat ${heat}${why}. A pep talk would land right now.`,
    `${agentName} is steaming, heat ${heat}${why}. He is still playing.`,
    `${agentName} has gone quiet at heat ${heat}${why}.`,
  ];
  return { text: alts[i % alts.length], button: null };
}

const BUILDERS = {
  session_ended: buildSessionEnded,
  busted:        buildBusted,
  biggest_pot:   buildBiggestPot,
  tilted:        buildTilted,
};

// ── The default Telegram sender ──────────────────────────────────────────────
//
// The bot is injected so the tests can hold a fake one. The contract is one
// method, shaped like every Telegram library's:
//   sendMessage(chatId, text, { parse_mode, reply_markup }) -> Promise<boolean>

function defaultBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  if (!token) {
    return {
      async sendMessage(chatId, text) {
        console.warn(`[notify] TELEGRAM_BOT_TOKEN not set — would have sent to ${chatId}: ${text.split('\n')[0]}`);
        return false;
      },
    };
  }
  return {
    async sendMessage(chatId, text, opts = {}) {
      try {
        const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: String(chatId), text, ...opts }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          console.error(`[notify] telegram ${res.status}: ${body.slice(0, 200)}`);
          return false;
        }
        return true;
      } catch (err) {
        console.error('[notify] send failed:', err.message);
        return false;
      }
    },
  };
}

const defaultStore = {
  recordNotificationSent,
  listNotificationsSince,
  countNotificationsOfType,
  putNotificationHold,
  listNotificationHolds,
  setNotificationHoldDeliverAt,
  deleteNotificationHold,
};

// ── attachNotify ─────────────────────────────────────────────────────────────
//
// One call, at the end of src/index.js. `app` is optional and only carries the
// mute route; everything else works without it, which is what lets the tests
// drive the ladder with no HTTP server at all.
export function attachNotify({
  store = defaultStore,
  bot = null,
  app = null,
  now = () => Date.now(),
  tzOffsetFor = () => DEFAULT_TZ_OFFSET_MIN,
  muted = (agentId, ownerId) => isAgentNotifyMuted(agentId, ownerId),
} = {}) {
  const n = {
    store,
    bot: bot || defaultBot(),
    now,
    tzOffsetFor,
    muted,
    chains: new Map(),   // ownerId -> promise, so one owner's sends never interleave
    timers: new Map(),   // ownerId -> the pending flush timer
  };
  active = n;

  if (app) installNotifyRoutes(app);

  // A hold that came due while the process was down still goes out, and one
  // that has not gets its timer back. Held, not cancelled, survives a restart.
  Promise.resolve().then(() => {
    const owners = new Set(store.listNotificationHolds(null).map((h) => h.ownerId));
    return Promise.all([...owners].map((ownerId) => serialize(ownerId, () => flushDue(ownerId, now()))));
  }).catch((err) => console.error('[notify] restart flush failed:', err.message));

  console.log(`[notify] attached — ${BUDGET.maxPerDay}/day, ${BUDGET.minGapMs / 60000}min gap, quiet ${BUDGET.quietFrom}:00–0${BUDGET.quietUntil}:00 local`);
  return n;
}

// Tests only: drop the notifier so the next attach starts clean.
export function detachNotify() {
  if (!active) return;
  for (const t of active.timers.values()) clearTimeout(t);
  active = null;
}

// ── Budget arithmetic ────────────────────────────────────────────────────────
//
// Read entirely off the (owner, type, ts) ledger. Nothing about a decision is
// stored; the decision is recomputed from what was actually sent.
//
// Returns one of:
//   { send: true }
//   { holdUntil: <ts> }   quiet hours, or inside the 30-minute gap
//   { drop: 'budget' }
function decide(ownerId, at) {
  const off = active.tzOffsetFor(ownerId);

  // Quiet hours first: an overnight event is held to 08:00 and is then judged
  // against the NEW day's budget, which is the whole reason the hold is not a
  // drop. Ordering the other way would spend a slot that no longer exists.
  if (isQuiet(at, off)) return { holdUntil: nextOpen(at, off) };

  const dayStart = startOfLocalDay(at, off);
  const recent   = active.store.listNotificationsSince(ownerId, Math.min(dayStart, at - DAY_MS));
  const today    = recent.filter((r) => r.ts >= dayStart);
  if (today.length >= BUDGET.maxPerDay) return { drop: 'budget' };

  const lastTs = recent.length ? recent[recent.length - 1].ts : null;
  if (lastTs !== null && at - lastTs < BUDGET.minGapMs) {
    return { holdUntil: lastTs + BUDGET.minGapMs };
  }
  return { send: true };
}

function scheduleFlush(ownerId, at) {
  const existing = active.timers.get(ownerId);
  if (existing) clearTimeout(existing);
  const delay = Math.max(0, at - active.now());
  const timer = setTimeout(() => {
    active?.timers.delete(ownerId);
    serialize(ownerId, () => flushDue(ownerId, active.now()))
      .catch((err) => console.error('[notify] flush failed:', err.message));
  }, delay);
  timer.unref?.();
  active.timers.set(ownerId, timer);
}

// One owner's decisions are strictly sequential: each send lands in the ledger
// before the next message reads it, which is what makes the gap and the daily
// cap hold under concurrent events.
function serialize(ownerId, fn) {
  if (!active) return Promise.resolve();
  const chain = (active.chains.get(ownerId) ?? Promise.resolve()).then(fn, fn);
  active.chains.set(ownerId, chain.catch(() => {}));
  return chain;
}

async function send(ownerId, type, payload, at) {
  const opts = { parse_mode: 'HTML' };
  if (payload.button) {
    // The deep link opens the Mini App on this agent's thread rather than the
    // home screen — the message is about him, so the tap has to land on him.
    opts.reply_markup = {
      inline_keyboard: [[{ text: payload.button, url: `${MINI_APP_URL}?startapp=agent_${payload.agentId}` }]],
    };
  }
  let ok = false;
  try {
    ok = await active.bot.sendMessage(String(ownerId), payload.text, opts);
  } catch (err) {
    console.error('[notify] bot threw:', err.message);
    ok = false;
  }
  // A failed send is not written to the ledger: it did not spend a slot, and
  // the owner did not get a message. It is simply gone.
  if (ok === false) return false;
  active.store.recordNotificationSent(ownerId, type, at);
  console.log(`[notify] sent ${type} to ${ownerId}`);
  return true;
}

// Everything whose hold has come due, in ladder order. A recap that queued at
// 02:14 and a quiet-win-shaped ping that queued at 22:10 both come due at
// 08:00; the recap goes first, and if the budget only has room for one, it is
// the one that survives.
async function flushDue(ownerId, at) {
  if (!active) return;
  const due = active.store.listNotificationHolds(ownerId)
    .filter((h) => h.deliverAt <= at)
    .sort((a, b) => (LADDER[a.type] ?? 9) - (LADDER[b.type] ?? 9) || a.queuedAt - b.queuedAt);

  for (const hold of due) {
    const d = decide(ownerId, at);
    if (d.holdUntil) {
      active.store.setNotificationHoldDeliverAt(hold.id, d.holdUntil);
      scheduleFlush(ownerId, d.holdUntil);
      continue;
    }
    if (d.drop) {
      active.store.deleteNotificationHold(hold.id);
      console.log(`[notify] dropped held ${hold.type} for ${ownerId} — budget spent`);
      continue;
    }
    active.store.deleteNotificationHold(hold.id);
    await send(ownerId, hold.type, hold.payload, at);
  }
}

// ── The one entry point table.js calls ───────────────────────────────────────
//
// A no-op when nothing is attached, which is every test that is not this
// module's own and every script that imports table.js without booting a server.
export function notifyEvent(type, { ownerId, agentId, agentName, ...ctx } = {}) {
  if (!active || !ownerId || !agentId) return Promise.resolve();
  if (!BUILDERS[type]) return Promise.resolve();

  return serialize(String(ownerId), async () => {
    const owner = String(ownerId);
    try {
      // Mute is per agent and is checked before anything is built or stored: a
      // muted agent leaves no trace in the ledger, so muting him does not eat
      // into the budget his stablemates share.
      if (active.muted(agentId, owner)) return;

      const at  = active.now();
      const off = active.tzOffsetFor(owner);

      // Rotation index: sends of this type already in the ledger, plus any of
      // the same type still waiting in a hold, so two queued at once do not
      // both come out as the same alternate.
      const held = active.store.listNotificationHolds(owner).filter((h) => h.type === type).length;
      const idx  = active.store.countNotificationsOfType(owner, type) + held;

      const msg = BUILDERS[type](idx, { agentName: agentName || 'Your agent', tzOffsetMin: off, ...ctx });
      const payload = { text: msg.text, button: msg.button, agentId: String(agentId), agentName };

      await flushDue(owner, at);

      const d = decide(owner, at);
      if (d.holdUntil) {
        active.store.putNotificationHold(owner, type, d.holdUntil, payload);
        scheduleFlush(owner, d.holdUntil);
        console.log(`[notify] held ${type} for ${owner} until ${hhmm(d.holdUntil, off)} local`);
        return;
      }
      if (d.drop) {
        console.log(`[notify] dropped ${type} for ${owner} — budget spent`);
        return;
      }
      await send(owner, type, payload, at);
    } catch (err) {
      console.error(`[notify] ${type} failed:`, err.message);
    }
  });
}

export { HEAT_TILTED };

// Tests only: run the flush that a timer would have run, without waiting out
// an eight-hour quiet window in wall-clock time.
export function _flushNow(ownerId) {
  if (!active) return Promise.resolve();
  const owner = String(ownerId);
  return serialize(owner, () => flushDue(owner, active.now()));
}

// ── The mute route ───────────────────────────────────────────────────────────
//
// POST /api/agents/:agentId/notify  { muted: true|false }
//
// Registered from attachNotify, which index.js calls after the SPA fallback.
// That is safe and deliberate: the fallback only answers GET and calls next()
// for everything else, so a POST still reaches here.
export function installNotifyRoutes(app) {
  app.post('/api/agents/:agentId/notify', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || req.body?.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your agent' });
    if (typeof req.body?.muted !== 'boolean') return res.status(400).json({ error: 'muted must be a boolean' });

    const agent = setAgentNotifyMuted(req.params.agentId, userId, req.body.muted);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json({ agentId: agent.id, muted: !!agent.notifyMuted });
  });
}
