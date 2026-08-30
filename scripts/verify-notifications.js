#!/usr/bin/env node
// scripts/verify-notifications.js
// Drives a scripted day of events through the notification budget and asserts
// that the ladder, holds, caps, and rotation behave exactly as specified.
//
// Run:   node scripts/verify-notifications.js
// Smoke: NOTIFY_SMOKE=1 node scripts/verify-notifications.js
//        (sends one real Telegram message — requires TELEGRAM_BOT_TOKEN and
//         NOTIFY_TARGET_CHAT_ID env vars with valid values)
//
// NOTIFY_ENABLED is forced ON by this script before loading telegram.js.

// ── MUST be set before the dynamic import below evaluates telegram.js ─────────
process.env.NOTIFY_ENABLED = '1';

// ── Built-in imports (no NOTIFY_ENABLED dependency) ──────────────────────────
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Dynamic import — evaluates AFTER process.env is patched ──────────────────
const telegram = await import('../src/server/notifications/telegram.js');
const {
  _injectTestSender,
  _setTimeProvider,
  _flushDueHolds,
  ownerState,
  saveNotifState,
  notifySessionRecap,
  notifyProposal,
  notifyMoodAlert,
  notifyQuietWin,
  notifyMilestone,
  recordSessionOutcome,
  clearProposalPending,
  ENABLED,
} = telegram;

if (!ENABLED) {
  console.error('ERROR: NOTIFY_ENABLED did not propagate — check dynamic import order');
  process.exit(1);
}

// ── Test helpers ──────────────────────────────────────────────────────────────
const OWNER  = 'verify_owner_777';
const CHAT   = OWNER;
const AGENT1 = 'agent_verify_001';
const AGENT2 = 'agent_verify_002';

let _fakeClock = new Date(2026, 7, 30, 5, 0, 0, 0); // Aug 30 05:00 — quiet window
let sends = [];

function clock(h, m, day) {
  _fakeClock = new Date(2026, 7, day !== undefined ? day : 30, h, m || 0, 0, 0);
}

_setTimeProvider(() => new Date(_fakeClock));

_injectTestSender((chatId, text, button) => {
  sends.push({ chatId, text, button, sentAt: new Date(_fakeClock) });
  return true;
});

function resetOwner() {
  const os = ownerState(OWNER);
  os.dailyCounts      = { date: '', count: 0 };
  os.moodAlertDate    = null;
  os.quietWinWeek     = null;
  os.sentMilestones   = {};
  os.pendingHolds     = [];
  os.lastAlternates   = {};
  os.proposalNotified = false;
  os.agentOutcomes    = {};
  os.sentLog          = [];
  sends               = [];
}

let passed = 0;
let failed = 0;

function expect(name, cond, hint) {
  if (cond) {
    console.log('  PASS  ' + name);
    passed++;
  } else {
    console.error('  FAIL  ' + name + (hint ? ' — ' + hint : ''));
    failed++;
  }
}

// ── Test 1: quiet window hold + 08:00 delivery ───────────────────────────────
console.log('\nTest 1: quiet window hold + 08:00 delivery (worked example row 1)');
resetOwner();
clock(2, 14);

await notifySessionRecap(OWNER, CHAT, AGENT1, 'The Grinder', {
  pnl: 340, hands: 64, sessionEndTime: _fakeClock.getTime(),
});

expect('no send at 02:14', sends.length === 0, 'got ' + sends.length);

const os1 = ownerState(OWNER);
expect('hold queued', os1.pendingHolds.length === 1, 'got ' + os1.pendingHolds.length);
if (os1.pendingHolds.length > 0) {
  expect('hold type=session_recap', os1.pendingHolds[0].type === 'session_recap');
  expect('hold text mentions 02:14', os1.pendingHolds[0].text.includes('02:14'),
    os1.pendingHolds[0].text);
  expect('hold has Open the floor button', os1.pendingHolds[0].button === 'Open the floor');
  expect('hold deliverAfter is 08:00', (() => {
    const da = new Date(os1.pendingHolds[0].deliverAfter);
    return da.getHours() === 8 && da.getMinutes() === 0;
  })());
}

// Flush at 08:00.
clock(8, 0);
await _flushDueHolds(OWNER, CHAT, _fakeClock);

expect('send fired at 08:00 flush', sends.length === 1, 'got ' + sends.length);
expect('budget slot 1 used', ownerState(OWNER).dailyCounts.count === 1);
expect('holds empty after flush', ownerState(OWNER).pendingHolds.length === 0);
expect('sentLog has session_recap', ownerState(OWNER).sentLog[0]?.type === 'session_recap');

// ── Test 2: proposal fills second budget slot ─────────────────────────────────
console.log('\nTest 2: proposal fills second budget slot (worked example row 2)');
clock(9, 40);

await notifyProposal(OWNER, CHAT, AGENT1, 'The Grinder', {
  proposalText: 'I keep folding when I\'m ahead. Can I loosen up?',
});

expect('proposal sent immediately (not quiet hours)', sends.length === 2, 'got ' + sends.length);
expect('proposal has See his idea button', sends[1]?.button === 'See his idea');
expect('budget at 2/2', ownerState(OWNER).dailyCounts.count === 2);

// ── Test 3: mood alert dropped at 15:02 — budget spent ───────────────────────
console.log('\nTest 3: mood alert DROPPED at 15:02 — budget spent (worked example row 3)');
clock(15, 2);

await notifyMoodAlert(OWNER, CHAT, AGENT1, 'The Grinder', {
  moodState: 'tilted', cause: 'lost two big pots as favourite',
});

expect('mood alert not sent (budget spent)', sends.length === 2, 'got ' + sends.length);
expect('moodAlertDate not set', ownerState(OWNER).moodAlertDate === null);

// ── Test 4: quiet win dropped at 22:10 — budget spent ────────────────────────
console.log('\nTest 4: quiet win DROPPED at 22:10 — budget spent, not in quiet window');
clock(22, 10);

recordSessionOutcome(OWNER, AGENT2, true);
recordSessionOutcome(OWNER, AGENT2, true);
recordSessionOutcome(OWNER, AGENT2, true); // 3rd consecutive

await notifyQuietWin(OWNER, CHAT, AGENT2, 'Balanced v2.1');

expect('quiet win not sent (budget spent, outside quiet window)', sends.length === 2,
  'got ' + sends.length);
expect('quietWinWeek not set', ownerState(OWNER).quietWinWeek === null);

// ── Test 5: budget resets next day ───────────────────────────────────────────
console.log('\nTest 5: budget resets the next day');
clock(10, 0, 31); // Aug 31

await notifySessionRecap(OWNER, CHAT, AGENT1, 'The Grinder', {
  pnl: 210, hands: 42, sessionEndTime: _fakeClock.getTime(),
});

expect('recap sent on new day', sends.length === 3, 'got ' + sends.length);
expect('budget at 1/2 on new day', ownerState(OWNER).dailyCounts.count === 1);

// ── Test 6: mood alert hard cap once/day/owner ───────────────────────────────
console.log('\nTest 6: mood alert hard cap once/day/owner');

await notifyMoodAlert(OWNER, CHAT, AGENT1, 'The Grinder', { moodState: 'tilted' });
expect('first mood alert sent', sends.length === 4, 'got ' + sends.length);
expect('moodAlertDate set', ownerState(OWNER).moodAlertDate === '2026-08-31');

await notifyMoodAlert(OWNER, CHAT, AGENT2, 'Balanced v2.1', { moodState: 'sulking' });
expect('second mood alert blocked by daily owner cap', sends.length === 4, 'got ' + sends.length);

// ── Test 7: proposal one-pending cap ─────────────────────────────────────────
console.log('\nTest 7: proposal one-pending-at-a-time cap');
resetOwner();
clock(14, 0, 31);

await notifyProposal(OWNER, CHAT, AGENT1, 'The Grinder', { proposalText: 'Proposal A' });
expect('first proposal sent', sends.length === 1);
expect('proposalNotified=true', ownerState(OWNER).proposalNotified === true);

await notifyProposal(OWNER, CHAT, AGENT1, 'The Grinder', { proposalText: 'Proposal B' });
expect('second proposal blocked', sends.length === 1, 'got ' + sends.length);

clearProposalPending(OWNER);
expect('proposalNotified cleared', ownerState(OWNER).proposalNotified === false);

await notifyProposal(OWNER, CHAT, AGENT1, 'The Grinder', { proposalText: 'Proposal C' });
expect('proposal after clear is sent', sends.length === 2);

// ── Test 8: milestone once per threshold ─────────────────────────────────────
console.log('\nTest 8: milestone once per threshold');
resetOwner();

await notifyMilestone(OWNER, CHAT, AGENT1, 'The Grinder', { hands: 1000, threshold: 1000 });
expect('milestone sent', sends.length === 1);

await notifyMilestone(OWNER, CHAT, AGENT1, 'The Grinder', { hands: 1000, threshold: 1000 });
expect('duplicate milestone blocked', sends.length === 1, 'got ' + sends.length);

// ── Test 9: alternates rotation (never same twice in a row) ──────────────────
console.log('\nTest 9: alternates rotation');
resetOwner();
clock(10, 0, 31);

const textsSent = [];
for (let i = 0; i < 6; i++) {
  ownerState(OWNER).dailyCounts = { date: '', count: 0 };
  await notifySessionRecap(OWNER, CHAT, AGENT1, 'The Grinder', { pnl: 100, hands: 10 });
  textsSent.push(sends[sends.length - 1]?.text || '');
}

let rotOk = true;
for (let i = 1; i < textsSent.length; i++) {
  if (textsSent[i] === textsSent[i - 1]) { rotOk = false; break; }
}
expect('session_recap alternates never repeat consecutively', rotOk,
  'repeated: ' + textsSent.slice(0, 3).join(' | '));

// ── Test 10: priority ladder at flush — recap beats proposal ─────────────────
console.log('\nTest 10: priority ladder — recap beats proposal when only 1 budget slot left');
resetOwner();
ownerState(OWNER).dailyCounts = { date: '2026-08-30', count: 1 }; // 1 slot spent

clock(3, 0); // quiet window — Aug 30

// Queue proposal (priority 2) then recap (priority 1).
await notifyProposal(OWNER, CHAT, AGENT1, 'The Grinder', { proposalText: 'Hold proposal' });
await notifySessionRecap(OWNER, CHAT, AGENT1, 'The Grinder', { pnl: 50, hands: 5 });

expect('two items held', ownerState(OWNER).pendingHolds.length === 2,
  'got ' + ownerState(OWNER).pendingHolds.length);

// Flush at 08:00 — only 1 slot remaining; recap (priority 1) should win.
clock(8, 0);
await _flushDueHolds(OWNER, CHAT, _fakeClock);

expect('exactly one send at flush', sends.length === 1, 'got ' + sends.length);
expect('recap sent (priority 1 wins)', sends[0]?.button === 'Open the floor',
  'button was: ' + sends[0]?.button);
expect('holds empty after flush', ownerState(OWNER).pendingHolds.length === 0);

// ── Smoke test (optional real send) ──────────────────────────────────────────
if (process.env.NOTIFY_SMOKE === '1') {
  console.log('\nSmoke test: one real Telegram message...');
  _injectTestSender(null); // restore real sender
  const targetChat = process.env.NOTIFY_TARGET_CHAT_ID;
  if (!targetChat) {
    console.warn('  SKIP  NOTIFY_TARGET_CHAT_ID not set');
  } else {
    const { sendTelegram } = telegram;
    const ok = await sendTelegram(targetChat,
      '<b>NTF-4 smoke.</b> Notification verify script manual test. Disregard.',
      null);
    if (ok) { console.log('  PASS  smoke message sent to ' + targetChat); passed++; }
    else     { console.error('  FAIL  smoke send failed — check TELEGRAM_BOT_TOKEN'); failed++; }
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
  console.error('verify-notifications: SOME TESTS FAILED');
  process.exitCode = 1;
} else {
  console.log('verify-notifications: all tests passed');
}
