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
