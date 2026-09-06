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
// predates the triggers below and says two a day, four hours apart, quiet from
// 00:00) and than the legacy notifier's (two a day, quiet from 00:00): three
// per owner per day, never two inside thirty minutes, quiet hours 23:00–08:00
// owner-local. One budget for all ten types, which is the point of folding
// them together — two notifiers with two budgets is not a cap, it is a pair of
// caps that add up. The MECHANISM is the ref's, unchanged —
//   · quiet hours HOLD, they do not cancel; an overnight recap arrives at 08:00
//     and still names the 02:14 it describes, which is why the delay does not
//     read as a bug;
//   · the minimum gap is a delay, not a queue-jump — the second message waits;
//   · losing on BUDGET is a drop, not a delay, because a ping that arrives a
//     day late is worse than one that never arrives;
//   · when more events qualify than the budget allows, the ladder decides, and
//     the session recap wins every tie.
//
// NOTIFY-2 folded the legacy NOTIFY_ENABLED notifier
// (src/server/notifications/telegram.js) into this file. There is now ONE
// notifier, ONE ledger and ONE budget; NOTIFY_ENABLED is what turns it on.
// Everything that notifier could say still has a rung on the ladder below —
// broke, proposal, collected, want, milestone, quiet win — and every cap it
// enforced out of a bespoke state blob is now a `dedupe_key` on the ledger
// row, so a cap and a send can no longer disagree about what happened.
//
// Wiring: attachNotify() once, at the end of src/index.js. Two ways in:
//
//   · the bus (src/server/events.js). Where a floor headline and an owner ping
//     are the same fact — a bust, the biggest pot of the night — the table
//     emits ONCE and hangs the owner-addressed half off the event as `detail`.
//     attachNotify subscribes to that channel; nothing has to be kept in step
//     by hand.
//   · notifyEvent() directly, for the facts the bus does not carry, because
//     they are nobody's business but the owner's: a session that merely ended,
//     a mood crossing into tilt, a pocket that ran dry, a proposal he wrote.

import {
  recordNotificationSent,
  listNotificationsSince,
  countNotificationsOfType,
  hasNotificationKey,
  putNotificationHold,
  listNotificationHolds,
  setNotificationHoldDeliverAt,
  deleteNotificationHold,
} from './store.js';
import { isAgentNotifyMuted, setAgentNotifyMuted } from './agentProfiles.js';
import { telegramAuthMiddleware, isOwner } from './auth.js';
import { bus as eventBus } from './events.js';

// The switch, inherited from the legacy notifier so that a deployment that had
// notifications off keeps them off. It gates the SENDER only: the mute route
// is registered either way, so an owner's preference is recorded on a
// deployment that is not yet sending.
export const ENABLED = process.env.NOTIFY_ENABLED === '1' || process.env.NOTIFY_ENABLED === 'true';

// ── The ladder ───────────────────────────────────────────────────────────────
//
// Lower wins. The recap is the only ping the owner implicitly asked for — he
// deployed the agent, so the result is owed — and it takes every tie. A bust
// is money that has stopped moving and the owner has a decision to make, so it
// sits directly under it. Tilt is money moving badly right now. The biggest pot
// is news about him that asks for nothing, which is what makes it safe to send
// and the first thing to lose when the budget is tight.
//
// NOTIFY-2 slotted the legacy notifier's six types into the same order it had
// them in. `broke` sits directly under `busted` because they are the same
// shape of news one step apart — the stack is gone, then the roll behind it is
// — and both end in a decision. A proposal is him asking to be changed, which
// only the owner can answer. `collected` and `want` are errands. Below the
// mood line sit the three that ask for nothing at all, and those are the first
// to lose when the budget is tight.
export const LADDER = {
  session_ended:  1,
  busted:         2,
  broke:          3,
  proposal:       4,
  collected:      5,
  want:           6,
  tilted:         7,
  milestone:      8,
  biggest_pot:    9,
  quiet_win:     10,
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

// YYYY-MM-DD and ISO YYYY-Www, both owner-local, both built the same way as
// everything else here: shift the epoch, read UTC. They exist for the cap keys
// the legacy notifier expressed as "once a day" and "once a week".
function localDayStr(ts, offMin) {
  return new Date(ts + offMin * 60_000).toISOString().slice(0, 10);
}
function localWeekStr(ts, offMin) {
  const d = new Date(ts + offMin * 60_000);
  // Thursday of this week decides the year and the number (ISO 8601).
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const jan1 = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - jan1) / DAY_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
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

// ── The six folded in from the legacy notifier (NOTIFY-2) ────────────────────
//
// Copy kept as it was written — it had already been through the three laws —
// with one change: `<b>` survives because this file also sends parse_mode
// HTML, and the deep link under a button now lands on the agent's thread
// rather than the home screen, like every other button here.

function buildBroke(i, { agentName, mode }) {
  // `cut` means the owner has already decided not to fund him. Asking again
  // with a button would be nagging about a decision he has made.
  const alts = mode === 'cut'
    ? [
        { text: `${agentName} is out and cut off. He is at the bar, and nothing he has learned is lost.`, button: null },
        { text: `${agentName}'s pocket is empty. Cut off, so he is not asking.`, button: null },
      ]
    : [
        { text: `${agentName} is out of money. He is at the bar — your call.`, button: 'Fund him' },
        { text: `${agentName}'s pocket is empty. He keeps his reads either way.`, button: 'Fund him' },
        { text: `That is ${agentName}'s roll gone. He takes a seat at the bar.`, button: 'Fund him' },
      ];
  return alts[i % alts.length];
}

function buildProposal(i, { agentName, proposalText }) {
  const preambles = ['', 'Quick one: ', ''];
  const text = `${preambles[i % preambles.length]}${proposalText}
<i>— ${agentName}</i>`;
  return { text, button: 'See his idea' };
}

function buildCollected(i, { agentName, moved }) {
  const amt = `<b>${money(moved)}</b>`;
  const alts = [
    `${agentName} brought home ${amt}. It is in your wallet.`,
    `${agentName} cashed out ${amt} to your wallet and kept his float.`,
    `${amt} from ${agentName}. He wants to go again on what is left.`,
  ];
  return { text: alts[i % alts.length], button: OPEN };
}

function buildWant(i, { agentName, line }) {
  // The line is his, so it is the message. No frame around it beyond his name.
  return { text: `${agentName}: "${line}"`, button: 'Sort him out' };
}

function buildMilestone(i, { agentName, threshold }) {
  const n = `<b>${Number(threshold).toLocaleString('en-US')} hands</b>`;
  const alts = [
    { text: `${n}. ${agentName} wants a harder table.`, button: 'Move him up' },
    { text: `${n} played. ${agentName} is asking about the next level.`, button: 'Move him up' },
    { text: `That is ${n}. ${agentName} thinks he has outgrown the table.`, button: null },
  ];
  return alts[i % alts.length];
}

function buildQuietWin(i, { agentName }) {
  const alts = [
    `${agentName} had a third winning night in a row. He has not mentioned it. He has mentioned it four times.`,
    `${agentName} just posted a third profitable session. He described it as "discipline."`,
    `${agentName} keeps winning and keeps acting like it is nothing. Third session in a row.`,
  ];
  return { text: alts[i % alts.length], button: null };
}

const BUILDERS = {
  session_ended: buildSessionEnded,
  busted:        buildBusted,
  broke:         buildBroke,
  proposal:      buildProposal,
  collected:     buildCollected,
  want:          buildWant,
  tilted:        buildTilted,
  milestone:     buildMilestone,
  biggest_pot:   buildBiggestPot,
  quiet_win:     buildQuietWin,
};

// ── Caps (NOTIFY-2) ──────────────────────────────────────────────────────────
//
// The budget says how MUCH the bot may say. A cap says how often one
// particular thing may be said, and it is a different question: three sends a
// day is no comfort if all three are "he is broke" about the same agent.
//
// The legacy notifier kept one of these per type in a state blob beside the
// ledger, which is how a cap and a send end up disagreeing after a crash. Here
// a cap IS the ledger: the key goes on the row, and the row is only written
// when the message actually goes out. A held message reserves its key and
// releases it if it later loses on budget, which is right — it never arrived.
//
// A type with no entry has no cap of its own and is bounded by the budget
// alone. Returning null from an entry means "not this time".
const CAP_KEYS = {
  // Out of money is a state, not an event. He stays out until the owner acts,
  // and saying so twice is nagging.
  broke:     ({ agentId }, { day }) => `broke:${agentId}:${day}`,
  // He asks and then drops it.
  want:      ({ agentId }, { day }) => `want:${agentId}:${day}`,
  // Once per threshold, ever — crossing 1,000 hands does not un-happen.
  milestone: ({ agentId, threshold }) => `milestone:${agentId}:${threshold}`,
  // One per proposal rather than the legacy "one pending at a time", which
  // needed an explicit clear on accept/reject and silently lost the next
  // proposal if that clear was ever missed. A proposal's createdAt identifies
  // it, so a new one always gets its ping and the old one never gets a second.
  proposal:  ({ agentId, proposalAt }) => (proposalAt ? `proposal:${agentId}:${proposalAt}` : null),
  // Owner-wide and weekly: the point of the line is that it is rare.
  quiet_win: (_ctx, { week }) => `quiet_win:${week}`,
};

function capKeyFor(type, ctx, at, offMin) {
  const fn = CAP_KEYS[type];
  if (!fn) return null;
  try {
    return fn(ctx, { day: localDayStr(at, offMin), week: localWeekStr(at, offMin) }) || null;
  } catch {
    return null;
  }
}

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
  hasNotificationKey,
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
  enabled = ENABLED,
} = {}) {
  // The mute route is not a send. It stands whether or not the bot is talking,
  // so an owner who silences an agent while notifications are off still has
  // that on record when they are turned on.
  if (app) installNotifyRoutes(app);

  if (!enabled) {
    console.log('[notify] NOTIFY_ENABLED is not set — notifier off, mute route still installed');
    return null;
  }

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

  // NOTIFY-2: the bus half of the wiring. off-then-on is idempotent because
  // `onBusDetail` is a stable module-level function, so a process that
  // composes several servers (the tests do) still has exactly one listener.
  eventBus.off('detail', onBusDetail);
  eventBus.on('detail', onBusDetail);

  // A hold that came due while the process was down still goes out, and one
  // that has not gets its timer back. Held, not cancelled, survives a restart.
  Promise.resolve().then(() => {
    const owners = new Set(store.listNotificationHolds(null).map((h) => h.ownerId));
    return Promise.all([...owners].map((ownerId) => serialize(ownerId, () => flushDue(ownerId, now()))));
  }).catch((err) => console.error('[notify] restart flush failed:', err.message));

  console.log(`[notify] attached — ${BUDGET.maxPerDay}/day, ${BUDGET.minGapMs / 60000}min gap, quiet ${BUDGET.quietFrom}:00–0${BUDGET.quietUntil}:00 local`);
  return n;
}

// A record on the bus's private channel is a notification request that a table
// has already decided is worth making — the trigger rules live at the emit
// site, next to the state that proves them. This end only budgets it.
function onBusDetail(record) {
  if (!record || !record.type) return;
  notifyEvent(record.type, record);
}

// Tests only: drop the notifier so the next attach starts clean.
export function detachNotify() {
  eventBus.off('detail', onBusDetail);
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
  active.store.recordNotificationSent(ownerId, type, at, payload.key ?? null);
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

// ── The one entry point ──────────────────────────────────────────────────────
//
// Reached either directly, from the code that knows the fact, or from the bus
// via onBusDetail. Both land here, so there is one budget and one ledger no
// matter which door the event came through.
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

      // A cap that has already been spent stops here, before the message is
      // built and before it can take a budget slot from something the owner
      // has not already heard.
      const key = capKeyFor(type, { agentId: String(agentId), ...ctx }, at, off);
      if (key && active.store.hasNotificationKey(owner, key)) {
        console.log(`[notify] capped ${type} for ${owner} — ${key} already spent`);
        return;
      }

      const msg = BUILDERS[type](idx, { agentName: agentName || 'Your agent', tzOffsetMin: off, ...ctx });
      const payload = { text: msg.text, button: msg.button, agentId: String(agentId), agentName, key };

      await flushDue(owner, at);

      const d = decide(owner, at);
      if (d.holdUntil) {
        active.store.putNotificationHold(owner, type, d.holdUntil, payload, key);
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

  // GET /api/notifications/budget — DEEPLINK-1
  //
  // The cap is part of the design, not a setting, so the YOU screen shows what
  // is left of it rather than offering a dial. Read off the same ledger and
  // through the same owner-local day boundary decide() uses, because a row and
  // a notifier that disagree about what "today" is are worse than no row.
  app.get('/api/notifications/budget', telegramAuthMiddleware, (req, res) => {
    const userId = String(req.query.userId || 'anon');
    if (!isOwner(req, userId)) return res.status(403).json({ error: 'Not your budget' });
    res.setHeader('Cache-Control', 'no-store');
    res.json(notifyBudget(userId));
  });
}

// What the owner has already been sent today, out of what he may be sent.
// Works with the notifier detached — the mute route is installed on a
// deployment that is not sending, and so is this: nothing has been spent, and
// saying so is the truth rather than a failure. `enabled` is what tells the
// two apart.
export function notifyBudget(ownerId, at = active ? active.now() : Date.now()) {
  const owner = String(ownerId);
  const store = active?.store ?? defaultStore;
  const off   = active ? active.tzOffsetFor(owner) : DEFAULT_TZ_OFFSET_MIN;

  const dayStart = startOfLocalDay(at, off);
  const used = store.listNotificationsSince(owner, dayStart).filter((r) => r.ts >= dayStart).length;
  const held = store.listNotificationHolds(owner).length;

  return {
    used,
    max: BUDGET.maxPerDay,
    held,
    // When the counter goes back to zero, in owner-local terms.
    resetsAt: dayStart + DAY_MS,
    enabled: active !== null,
  };
}
