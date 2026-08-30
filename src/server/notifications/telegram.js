// src/server/notifications/telegram.js
// Telegram sender + per-owner notification state.
// All exports are no-ops when NOTIFY_ENABLED is not set.

import fs from 'fs';
import path from 'path';

// ── Feature flag ──────────────────────────────────────────────────────────────
export const ENABLED = process.env.NOTIFY_ENABLED === '1' || process.env.NOTIFY_ENABLED === 'true';
const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const MINI_APP_URL = process.env.MINI_APP_URL || 'https://t.me/AigenicPokerBot/game';

// ── Persistent state ──────────────────────────────────────────────────────────
const DATA_DIR = path.join(process.cwd(), 'data');
const STATE_FILE = path.join(DATA_DIR, 'notifications.json');

let notifState = {};
try {
  notifState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
} catch { notifState = {}; }

export function saveNotifState() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STATE_FILE, JSON.stringify(notifState, null, 2), 'utf8');
  } catch (err) {
    console.error('[notify] state save failed:', err.message);
  }
}

// Returns (creating if absent) the per-owner notification record.
//
// Shape:
//   dailyCounts:      { date: 'YYYY-MM-DD', count: 0 }
//   moodAlertDate:    'YYYY-MM-DD' | null   (last mood alert sent this day)
//   quietWinWeek:     'YYYY-Www'   | null   (last quiet win sent this week)
//   sentMilestones:   { '<agentId>:<threshold>': true }
//   pendingHolds:     [{ type, priority, text, button, agentId, chatId, queuedAt, deliverAfter }]
//   lastAlternates:   { <type>: lastIndex }   rotation state per type
//   proposalNotified: false                   one pending proposal notification at a time
//   agentOutcomes:    { <agentId>: [bool...] } last-5 session profitability (quiet win)
//   sentLog:          [{ type, agentId, sentAt }]  last 50 sends
export function ownerState(ownerId) {
  const id = String(ownerId);
  if (!notifState[id]) {
    notifState[id] = {
      dailyCounts:      { date: '', count: 0 },
      moodAlertDate:    null,
      quietWinWeek:     null,
      sentMilestones:   {},
      pendingHolds:     [],
      lastAlternates:   {},
      proposalNotified: false,
      agentOutcomes:    {},
      sentLog:          [],
    };
  }
  return notifState[id];
}

// ── Mockable time provider ────────────────────────────────────────────────────
let _now = () => new Date();

// For tests: override the clock. Pass null to restore real time.
export function _setTimeProvider(fn) {
  _now = typeof fn === 'function' ? fn : () => new Date();
}

// ── Test sender injection ─────────────────────────────────────────────────────
let __testSender = null;

// For tests only: inject a stub. Pass null to restore the real sender.
export function _injectTestSender(fn) {
  __testSender = typeof fn === 'function' ? fn : null;
}

// ── Date / time helpers ───────────────────────────────────────────────────────
export function localDateStr(d) {
  const t = d || _now();
  return t.getFullYear() + '-' +
    String(t.getMonth() + 1).padStart(2, '0') + '-' +
    String(t.getDate()).padStart(2, '0');
}

export function isoWeekStr(d) {
  const t = d || _now();
  const tmp = new Date(Date.UTC(t.getFullYear(), t.getMonth(), t.getDate()));
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7));
  const jan1 = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 1));
  const wk = Math.ceil((((tmp - jan1) / 86400000) + 1) / 7);
  return tmp.getUTCFullYear() + '-W' + String(wk).padStart(2, '0');
}

export function hhMM(ts) {
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

// ── Alternate rotation ────────────────────────────────────────────────────────
// Increments the index for `type`, never reusing the same one twice in a row.
export function pickAlternate(os, type, count) {
  if (count <= 1) return 0;
  const last = (os.lastAlternates && os.lastAlternates[type] !== undefined)
    ? os.lastAlternates[type] : -1;
  const next = (last + 1) % count;
  if (!os.lastAlternates) os.lastAlternates = {};
  os.lastAlternates[type] = next;
  return next;
}

// ── Message builders ──────────────────────────────────────────────────────────
// Each returns { text, button }.

function buildSessionRecap(os, agentName, pnl, hands, sessionEndTime) {
  const sign    = pnl >= 0 ? '+' : '-';
  const amtStr  = sign + '$' + Math.abs(Math.round(pnl));
  const dir     = pnl >= 0 ? 'up' : 'down';
  const timeStr = hhMM(sessionEndTime);
  const alts = [
    { text: agentName + ' sat out at ' + timeStr + ', ' + dir + ' <b>' + amtStr + '</b>. Wants to talk.', button: 'Open the floor' },
    { text: agentName + ' finished at ' + timeStr + ' — ' + dir + ' <b>' + amtStr + '</b> across ' + hands + ' hands. Flagged two spots not sure about.', button: 'Open the floor' },
    { text: 'Session done. ' + (pnl >= 0 ? 'Up' : 'Down') + ' <b>' + amtStr + '</b>, and ' + agentName + ' sat out before the table got worse.', button: 'Open the floor' },
  ];
  return alts[pickAlternate(os, 'session_recap', alts.length)];
}

function buildProposal(os, agentName, proposalText) {
  const preambles = ['', 'Quick one: ', ''];
  const idx = pickAlternate(os, 'proposal', preambles.length);
  const text = preambles[idx] + proposalText + '\n<i>— ' + agentName + '</i>';
  return { text, button: 'See his idea' };
}

function buildMoodAlert(os, agentName, moodState, cause) {
  const causeStr = cause || (moodState === 'tilted' ? 'a rough stretch' : 'a cold deck');
  const alts = [
    { text: agentName + ' is ' + moodState + '. ' + causeStr + '. A pep talk would land right now.' },
    { text: agentName + ' is steaming — ' + causeStr + '. He is still playing.' },
    { text: agentName + ' has gone quiet. ' + causeStr + '.' },
  ];
  return alts[pickAlternate(os, 'mood_alert', alts.length)];
}

function buildQuietWin(os, agentName) {
  const alts = [
    { text: agentName + ' had a third winning night in a row. He has not mentioned it. He has mentioned it four times.' },
    { text: agentName + ' just posted a third profitable session. He described it as “discipline.”' },
    { text: agentName + ' keeps winning and keeps acting like it is nothing. Third session in a row.' },
  ];
  return alts[pickAlternate(os, 'quiet_win', alts.length)];
}

function buildMilestone(os, agentName, threshold) {
  const n = threshold.toLocaleString();
  const alts = [
    { text: '<b>' + n + ' hands.</b> ' + agentName + ' wants a harder table.', button: 'Move him up' },
    { text: '<b>' + n + ' hands</b> played. ' + agentName + ' is asking about the next level.', button: 'Move him up' },
    { text: 'That’s <b>' + n + ' hands</b>. ' + agentName + ' thinks he has outgrown the table.' },
  ];
  return alts[pickAlternate(os, 'milestone', alts.length)];
}

// ── Session outcome tracking (quiet win) ──────────────────────────────────────
// Records whether this session was profitable. Returns true if the last 3 sessions
// were all profitable (trigger for quiet win notification).
export function recordSessionOutcome(ownerId, agentId, profitable) {
  const os = ownerState(ownerId);
  if (!os.agentOutcomes) os.agentOutcomes = {};
  const outcomes = (os.agentOutcomes[agentId] || []).concat([!!profitable]);
  os.agentOutcomes[agentId] = outcomes.slice(-5);
  saveNotifState();
  if (outcomes.length < 3) return false;
  return outcomes.slice(-3).every(Boolean);
}

// ── Reset proposal-pending flag ───────────────────────────────────────────────
// Call when the owner accepts or rejects a proposal so the next one can notify.
export function clearProposalPending(ownerId) {
  if (!ENABLED) return;
  const os = ownerState(ownerId);
  os.proposalNotified = false;
  saveNotifState();
}

// ── Raw Telegram send ─────────────────────────────────────────────────────────
// Returns true on success, false on any error. Does NOT touch state.
export async function sendTelegram(chatId, text, button) {
  if (__testSender) {
    return __testSender(String(chatId), text, button || null);
  }
  if (!BOT_TOKEN) {
    console.warn('[notify] TELEGRAM_BOT_TOKEN not set — skipping send');
    return false;
  }
  const payload = {
    chat_id: String(chatId),
    text,
    parse_mode: 'HTML',
  };
  if (button) {
    payload.reply_markup = {
      inline_keyboard: [[{ text: button, url: MINI_APP_URL }]],
    };
  }
  try {
    const res = await fetch(
      'https://api.telegram.org/bot' + BOT_TOKEN + '/sendMessage',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[notify] Telegram error ' + res.status + ': ' + body.slice(0, 200));
      return false;
    }
    return true;
  } catch (err) {
    console.error('[notify] send failed:', err.message);
    return false;
  }
}

// ── Budget constants ──────────────────────────────────────────────────────────
const MAX_DAILY = 2;
const TYPE_PRIORITY = { session_recap: 1, proposal: 2, mood_alert: 3, milestone: 4, quiet_win: 5 };

function getDailyCount(os, now) {
  const today = localDateStr(now || _now());
  if (os.dailyCounts.date !== today) os.dailyCounts = { date: today, count: 0 };
  return os.dailyCounts.count;
}

function incDailyCount(os, now) {
  getDailyCount(os, now); // ensure reset
  os.dailyCounts.count++;
}

function isQuietHour(now) {
  const h = (now || _now()).getHours();
  return h >= 0 && h < 8;
}

function next8am(from) {
  const f = from || _now();
  const d = new Date(f.getFullYear(), f.getMonth(), f.getDate(), 8, 0, 0, 0);
  if (d.getTime() <= f.getTime()) d.setDate(d.getDate() + 1);
  return d;
}

// Called after a successful send to update per-type tracking.
function applyTypeSentSideEffects(os, type, now) {
  if (type === 'mood_alert') os.moodAlertDate = localDateStr(now || _now());
  if (type === 'quiet_win')  os.quietWinWeek  = isoWeekStr(now || _now());
  if (type === 'proposal')   os.proposalNotified = true;
}

// Flush holds whose deliverAfter <= now. Sorted by priority, within daily budget.
// Exported so the verify script can call it directly in tests.
export async function _flushDueHolds(ownerId, chatId, now) {
  const t  = now || _now();
  const os = ownerState(ownerId);
  if (!os.pendingHolds || os.pendingHolds.length === 0) return;

  const nowMs = t.getTime();
  const due  = os.pendingHolds.filter((h) => h.deliverAfter <= nowMs);
  if (due.length === 0) return;
  os.pendingHolds = os.pendingHolds.filter((h) => h.deliverAfter > nowMs);

  // Priority order; recap (1) wins every tie.
  due.sort((a, b) => a.priority - b.priority);

  const budget = Math.max(0, MAX_DAILY - getDailyCount(os, t));
  const toSend = due.slice(0, budget);
  const toDrop = due.slice(budget);

  for (const h of toDrop) {
    console.log('[notify] dropped held ' + h.type + ' for ' + ownerId + ' (budget spent at flush)');
  }

  for (const h of toSend) {
    // Mood alert has a daily hard cap that must be re-checked at flush time.
    if (h.type === 'mood_alert' && os.moodAlertDate === localDateStr(t)) {
      console.log('[notify] mood_alert cap hit at flush — skipping held event for ' + ownerId);
      continue;
    }
    const cid = h.chatId || String(chatId);
    const ok  = await sendTelegram(cid, h.text, h.button || null);
    if (ok) {
      incDailyCount(os, t);
      applyTypeSentSideEffects(os, h.type, t);
      os.sentLog.unshift({ type: h.type, agentId: h.agentId, sentAt: t.getTime() });
      os.sentLog = os.sentLog.slice(0, 50);
      console.log('[notify] flushed ' + h.type + ' for ' + ownerId);
    }
  }
  saveNotifState();
}

// Core scheduler: enforces quiet hours, daily budget, per-type deduplication.
// Caller is responsible for per-type caps (moodAlertDate, proposalNotified, etc.)
// before calling this function.
async function scheduleNotification(ownerId, chatId, type, text, button, agentId, now) {
  const t  = now || _now();
  const os = ownerState(ownerId);

  // Flush any holds that have come due (e.g. it's now past 08:00).
  await _flushDueHolds(ownerId, chatId, t);

  // Quiet window 00:00–08:00 → hold until 08:00.
  if (isQuietHour(t)) {
    // Deduplicate single-instance types already in holds.
    if (type === 'mood_alert' && os.pendingHolds.some((h) => h.type === 'mood_alert')) {
      console.log('[notify] duplicate mood_alert hold suppressed for ' + ownerId);
      return;
    }

    const deliverAfter = next8am(t).getTime();
    const priority     = TYPE_PRIORITY[type] || 9;
    os.pendingHolds.push({
      type, priority, text, button: button || null,
      agentId, chatId: String(chatId), queuedAt: t.getTime(), deliverAfter,
    });
    if (type === 'proposal') os.proposalNotified = true;

    // Schedule a timer to flush at 08:00. Unref so the process can exit.
    const delay = deliverAfter - t.getTime();
    const timer = setTimeout(async () => {
      await _flushDueHolds(ownerId, chatId, _now());
      saveNotifState();
    }, delay);
    if (timer && typeof timer.unref === 'function') timer.unref();

    console.log('[notify] held ' + type + ' for ' + ownerId + ' until ' + hhMM(deliverAfter));
    saveNotifState();
    return;
  }

  // Daily budget.
  if (getDailyCount(os, t) >= MAX_DAILY) {
    console.log('[notify] budget spent — dropped ' + type + ' for ' + ownerId);
    return;
  }

  // Send.
  const ok = await sendTelegram(chatId, text, button || null);
  if (ok) {
    incDailyCount(os, t);
    applyTypeSentSideEffects(os, type, t);
    os.sentLog.unshift({ type, agentId, sentAt: t.getTime() });
    os.sentLog = os.sentLog.slice(0, 50);
    saveNotifState();
  }
}

// On module init: flush any holds that expired during a server restart.
// Also reschedule timers for future holds.
if (ENABLED) {
  Promise.resolve().then(async () => {
    const now = _now();
    for (const [ownerId, os] of Object.entries(notifState)) {
      const holds = os.pendingHolds || [];
      const chatId = holds.length > 0 ? holds[0].chatId : null;
      if (!chatId) continue;
      const hasDue = holds.some((h) => h.deliverAfter <= now.getTime());
      if (hasDue) {
        await _flushDueHolds(ownerId, chatId, now);
        saveNotifState();
      }
      // Reschedule flush timers for future holds.
      for (const h of (os.pendingHolds || [])) {
        const delay = Math.max(0, h.deliverAfter - now.getTime());
        const timer = setTimeout(async () => {
          await _flushDueHolds(ownerId, h.chatId, _now());
          saveNotifState();
        }, delay);
        if (timer && typeof timer.unref === 'function') timer.unref();
      }
    }
  }).catch((err) => console.error('[notify] init flush error:', err.message));
}

// ── Public trigger functions ──────────────────────────────────────────────────
// Per-type caps are checked here; budget + quiet-hours are handled by scheduleNotification.

// Fires when a session ends while the owner was not watching.
export async function notifySessionRecap(ownerId, chatId, agentId, agentName, opts) {
  if (!ENABLED) return;
  const now            = _now();
  const pnl            = (opts && opts.pnl !== undefined) ? opts.pnl : 0;
  const hands          = (opts && opts.hands !== undefined) ? opts.hands : 0;
  const sessionEndTime = (opts && opts.sessionEndTime) ? opts.sessionEndTime : now.getTime();
  const os  = ownerState(ownerId);
  const msg = buildSessionRecap(os, agentName, pnl, hands, sessionEndTime);
  await scheduleNotification(ownerId, chatId, 'session_recap', msg.text, msg.button, agentId, now);
}

// Fires when a self-change proposal is freshly created.
export async function notifyProposal(ownerId, chatId, agentId, agentName, opts) {
  if (!ENABLED) return;
  const now          = _now();
  const proposalText = (opts && opts.proposalText) ? opts.proposalText : '';
  const os           = ownerState(ownerId);
  if (os.proposalNotified) return; // one pending notification at a time
  const msg = buildProposal(os, agentName, proposalText);
  await scheduleNotification(ownerId, chatId, 'proposal', msg.text, msg.button, agentId, now);
}

// Fires when an agent enters tilted or sulking (hard cap once/day/owner).
export async function notifyMoodAlert(ownerId, chatId, agentId, agentName, opts) {
  if (!ENABLED) return;
  const now       = _now();
  const moodState = (opts && opts.moodState) ? opts.moodState : 'tilted';
  const cause     = (opts && opts.cause) ? opts.cause : null;
  const os        = ownerState(ownerId);
  if (os.moodAlertDate === localDateStr(now)) return; // hard cap once/day/owner
  const msg = buildMoodAlert(os, agentName, moodState, cause);
  await scheduleNotification(ownerId, chatId, 'mood_alert', msg.text, null, agentId, now);
}

// Fires on third consecutive profitable session (once per week).
export async function notifyQuietWin(ownerId, chatId, agentId, agentName) {
  if (!ENABLED) return;
  const now  = _now();
  const os   = ownerState(ownerId);
  if (os.quietWinWeek === isoWeekStr(now)) return; // weekly cap
  const msg = buildQuietWin(os, agentName);
  await scheduleNotification(ownerId, chatId, 'quiet_win', msg.text, null, agentId, now);
}

// Fires when lifetime hands cross a milestone threshold (once per threshold).
export async function notifyMilestone(ownerId, chatId, agentId, agentName, opts) {
  if (!ENABLED) return;
  const now       = _now();
  const threshold = (opts && opts.threshold) ? opts.threshold : 1000;
  const os        = ownerState(ownerId);
  if (!os.sentMilestones) os.sentMilestones = {};
  const key = agentId + ':' + threshold;
  if (os.sentMilestones[key]) return; // once per milestone, never re-sent
  os.sentMilestones[key] = true; // mark before schedule (trigger fires once per threshold crossing)
  const msg = buildMilestone(os, agentName, threshold);
  await scheduleNotification(ownerId, chatId, 'milestone', msg.text, msg.button || null, agentId, now);
}
