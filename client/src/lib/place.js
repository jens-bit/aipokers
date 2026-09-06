// client/src/lib/place.js — HOME-2 job 5
//
// PUTTING HIM DOWN SOMEWHERE, AND TELLING THE SERVER.
//
// One route answers all five fixtures — POST /api/agents/:id/place { fixture }
// — because "he is on the couch now" is one fact about one man, and five routes
// for it would be five places for the room and the record to disagree. That
// route is SERVER-5's, and this client ships before it.
//
// So every call here has TWO answers, and the second one is not an error path:
//
//   404   the server has not got /place yet. Fall back to the per-fixture call
//         that already exists for that fixture, where one does.
//   409   he refused, and the body carries HIS LINE for why. Mid-hand is the
//         case job 5 names; the server may have others.
//
// SERVER-5 has since landed, and /place answers all five — couch and table
// included, through the doors that already existed (couch is the same bench a
// want's yes sets; table is homeGame's own sync). The pre-SERVER-5 note that
// used to stand here said those two had no route and were reported
// `unsupported`; they have one now, so the fallbacks below cover only the two
// fixtures that had a route of their own BEFORE /place existed.

import { getTelegramInitData, getUserId } from './telegram.js';

/** The five things you can drop a man on. The safe is deliberately not one. */
export const FIXTURES = Object.freeze(['couch', 'table', 'fridge', 'tv', 'door']);

function headers() {
  const initData = getTelegramInitData();
  return {
    'Content-Type': 'application/json',
    ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
  };
}

async function post(url, body) {
  const res = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify(body) });
  const parsed = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, body: parsed };
}

/** His line for a refusal, in the order the server offers one. */
export function lineOf(body) {
  return body?.moment?.text ?? body?.line ?? body?.says ?? body?.error ?? null;
}

// ── The fallbacks ───────────────────────────────────────────────────────────

/** The fridge: FRIDGE-1's own route, which the fridge sheet already calls. */
async function snack(agentId, userId) {
  const r = await post(
    `/api/agents/${encodeURIComponent(agentId)}/give?userId=${encodeURIComponent(userId)}`,
    { userId, item: 'snack' },
  );
  return { ...r, via: 'give' };
}

/**
 * The television: the tape room's own route.
 *
 * It needs a HAND to watch, which is the one thing a drop cannot carry — so
 * this reads his flagged hands and puts on the first, which is what "put a hand
 * back on" means when the owner has not named one. No flagged hands is not an
 * error: there is nothing to watch, and he says so.
 */
async function study(agentId, userId) {
  const res = await fetch(
    `/api/agents/${encodeURIComponent(agentId)}/flagged?userId=${encodeURIComponent(userId)}`,
    { headers: headers() },
  );
  const body = await res.json().catch(() => null);
  const first = (body?.flaggedHands ?? [])[0];
  const handId = first?.handId ?? first?.handNumber ?? null;
  if (handId === null || handId === undefined) {
    return { ok: false, status: 409, body: { error: 'Nothing flagged to watch back.' }, via: 'study' };
  }
  const r = await post(`/api/agents/${encodeURIComponent(agentId)}/study`, { userId, handId });
  return { ...r, via: 'study' };
}

/**
 * Drop him on a fixture.
 *
 * @returns {{ok: boolean, status: number, line: string|null, via: string,
 *            unsupported?: boolean}}
 *   `via` names which route actually answered, so a test asserts the fallback
 *   was taken rather than assuming it. The DOOR never has one: walking to the
 *   casino is navigation, and the client has always owned it.
 */
export async function placeAgent(agentId, fixture, { userId = null } = {}) {
  const uid = userId ?? getUserId();
  if (!agentId || !FIXTURES.includes(fixture)) {
    return { ok: false, status: 0, line: null, via: 'none', unsupported: true };
  }

  // The door is not a request. It is where the owner is going, with the man in
  // his hand — CASINO-1's rule, that a deploy is decided in the building.
  if (fixture === 'door') return { ok: true, status: 0, line: null, via: 'walk' };

  const first = await post(
    `/api/agents/${encodeURIComponent(agentId)}/place?userId=${encodeURIComponent(uid)}`,
    { userId: uid, fixture },
  ).catch(() => ({ ok: false, status: 0, body: null }));

  if (first.status !== 404) {
    return { ok: first.ok, status: first.status, line: lineOf(first.body), via: 'place', body: first.body };
  }

  // Pre-SERVER-5. What the fixture could already do, and nothing more.
  if (fixture === 'fridge') {
    const r = await snack(agentId, uid).catch(() => null);
    if (!r) return { ok: false, status: 0, line: null, via: 'give' };
    return { ok: r.ok, status: r.status, line: lineOf(r.body), via: r.via, body: r.body };
  }
  if (fixture === 'tv') {
    const r = await study(agentId, uid).catch(() => null);
    if (!r) return { ok: false, status: 0, line: null, via: 'study' };
    return { ok: r.ok, status: r.status, line: lineOf(r.body), via: r.via, body: r.body };
  }

  return { ok: false, status: 404, line: null, via: 'none', unsupported: true };
}
