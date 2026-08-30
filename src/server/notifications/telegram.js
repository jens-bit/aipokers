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

// ── Public trigger functions ──────────────────────────────────────────────────
// Each is a no-op when ENABLED is false. Budget enforcement is added in NTF-3.

// Fires when a session ends while the owner was not watching.
export async function notifySessionRecap(ownerId, chatId, agentId, agentName, opts) {
  if (!ENABLED) return;
  const pnl            = (opts && opts.pnl !== undefined) ? opts.pnl : 0;
  const hands          = (opts && opts.hands !== undefined) ? opts.hands : 0;
  const sessionEndTime = (opts && opts.sessionEndTime) ? opts.sessionEndTime : _now().getTime();
  const os  = ownerState(ownerId);
  const msg = buildSessionRecap(os, agentName, pnl, hands, sessionEndTime);
  const ok  = await sendTelegram(chatId, msg.text, msg.button);
  if (ok) {
    os.sentLog.unshift({ type: 'session_recap', agentId, sentAt: _now().getTime() });
    os.sentLog = os.sentLog.slice(0, 50);
    saveNotifState();
  }
}

// Fires when a self-change proposal is freshly created.
export async function notifyProposal(ownerId, chatId, agentId, agentName, opts) {
  if (!ENABLED) return;
  const proposalText = (opts && opts.proposalText) ? opts.proposalText : '';
  const os  = ownerState(ownerId);
  if (os.proposalNotified) return;
  const msg = buildProposal(os, agentName, proposalText);
  const ok  = await sendTelegram(chatId, msg.text, msg.button);
  if (ok) {
    os.proposalNotified = true;
    os.sentLog.unshift({ type: 'proposal', agentId, sentAt: _now().getTime() });
    os.sentLog = os.sentLog.slice(0, 50);
    saveNotifState();
  }
}

// Fires when an agent enters tilted or sulking (hard cap once/day/owner).
export async function notifyMoodAlert(ownerId, chatId, agentId, agentName, opts) {
  if (!ENABLED) return;
  const moodState = (opts && opts.moodState) ? opts.moodState : 'tilted';
  const cause     = (opts && opts.cause) ? opts.cause : null;
  const os        = ownerState(ownerId);
  const today     = localDateStr();
  if (os.moodAlertDate === today) return;
  const msg = buildMoodAlert(os, agentName, moodState, cause);
  const ok  = await sendTelegram(chatId, msg.text, null);
  if (ok) {
    os.moodAlertDate = today;
    os.sentLog.unshift({ type: 'mood_alert', agentId, sentAt: _now().getTime() });
    os.sentLog = os.sentLog.slice(0, 50);
    saveNotifState();
  }
}

// Fires on third consecutive profitable session (once per week).
export async function notifyQuietWin(ownerId, chatId, agentId, agentName) {
  if (!ENABLED) return;
  const os   = ownerState(ownerId);
  const week = isoWeekStr();
  if (os.quietWinWeek === week) return;
  const msg = buildQuietWin(os, agentName);
  const ok  = await sendTelegram(chatId, msg.text, null);
  if (ok) {
    os.quietWinWeek = week;
    os.sentLog.unshift({ type: 'quiet_win', agentId, sentAt: _now().getTime() });
    os.sentLog = os.sentLog.slice(0, 50);
    saveNotifState();
  }
}

// Fires when lifetime hands cross a milestone threshold (once per threshold).
export async function notifyMilestone(ownerId, chatId, agentId, agentName, opts) {
  if (!ENABLED) return;
  const threshold = (opts && opts.threshold) ? opts.threshold : 1000;
  const os  = ownerState(ownerId);
  if (!os.sentMilestones) os.sentMilestones = {};
  const key = agentId + ':' + threshold;
  if (os.sentMilestones[key]) return;
  os.sentMilestones[key] = true;
  const msg = buildMilestone(os, agentName, threshold);
  const ok  = await sendTelegram(chatId, msg.text, msg.button || null);
  if (ok) {
    os.sentLog.unshift({ type: 'milestone', agentId, sentAt: _now().getTime() });
    os.sentLog = os.sentLog.slice(0, 50);
    saveNotifState();
  } else {
    delete os.sentMilestones[key];
  }
}
