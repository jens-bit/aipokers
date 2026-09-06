// client/src/lib/notifyApi.js — DEEPLINK-1
//
// The two things the app says to the notifier. Both are small, both are
// owner-gated server-side, and both fail soft: a screen that cannot reach the
// notifier shows what it showed before there was one rather than an error the
// owner can do nothing about.

import { getTelegramInitData, getUserId } from './telegram.js';

const headers = () => ({
  'Content-Type': 'application/json',
  'x-telegram-init-data': getTelegramInitData(),
});

/**
 * POST /api/agents/:id/notify — silence one agent, or give him his voice back.
 * Resolves to the flag the SERVER now holds, so the toggle draws what was
 * actually stored rather than what was asked for. Throws on a refusal; the
 * caller decides whether that is worth showing.
 */
export async function setAgentMuted(agentId, muted) {
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/notify`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ userId: getUserId(), muted: !!muted }),
  });
  if (!res.ok) throw new Error(`notify toggle failed (${res.status})`);
  const data = await res.json().catch(() => ({}));
  return !!data.muted;
}

/**
 * GET /api/notifications/budget — how much of today's three the bot has spent.
 * Null when the deployment has no notifier, which is a first-class answer: the
 * row then says nothing rather than lying about a cap nobody is enforcing.
 */
export async function fetchNotifyBudget() {
  try {
    const res = await fetch(
      `/api/notifications/budget?userId=${encodeURIComponent(getUserId())}`,
      { headers: { 'x-telegram-init-data': getTelegramInitData() } },
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!Number.isFinite(Number(data?.used)) || !Number.isFinite(Number(data?.max))) return null;
    return {
      used: Number(data.used),
      max: Number(data.max),
      held: Number.isFinite(Number(data.held)) ? Number(data.held) : 0,
      enabled: !!data.enabled,
    };
  } catch {
    return null;
  }
}
