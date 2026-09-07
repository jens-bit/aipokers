// src/server/visit.js — VISIT-1
//
// Send him to a friend's flat.
//
// Every other way an agent leaves home goes through his OWN owner's door
// (place.js, deployAgent). This is the one that does not: somebody else's
// agent walks in, plays a while at no stakes he did not already agree to, and
// walks home again — never at a casino table, and never without the host
// saying yes first.
//
// THREE RULES THE SHAPE COMES FROM.
//
//   1. HE LEAVES HIS OWN HOUSE THE MOMENT HE IS SENT, NOT WHEN HE IS ACCEPTED.
//      `agent.visiting` is set on POST /visit, before any answer exists, so his
//      own household's kitchen table (homeGame.eligible, via the CASINO-shaped
//      location presentAgent now forces on him) never double-books him while
//      he is standing in somebody else's doorway waiting on a yes.
//   2. THE VISIT GOES THROUGH THE EXISTING KITCHEN TABLE, NEVER AROUND IT.
//      Accepting seats him with homeGame.sync — the same derive-and-diff
//      machinery that seats the host's own roster — by handing it one more
//      body through the `visitorsFor` injection. Nothing here re-implements a
//      hand, a bio note or a grudge; that is what "the same as at the casino"
//      already gets for free from table.js and agentProfiles.js.
//   3. A WAGER IS ESCROWED, NEVER INVENTED. The stake leaves both pockets at
//      accept, through wallet.js's own buy-in ledger, and the whole pot comes
//      back through its own cash-out ledger at the end — so a crash between
//      the two can lose nobody's chips, only the memory of whose they were,
//      and the honest answer to that is a refund.

import { randomUUID } from 'node:crypto';
import {
  allOwnerIds, agentsOf, saveOwner, seatStatusOf, presentAgentById, presentedRoster,
} from './agentProfiles.js';
import { Where } from './home.js';
import * as homeGameMod from './homeGame.js';
import { notifyEvent } from './notify.js';
import { notifyHomeChanged } from './floorChannel.js';
import { guestCannotVisit } from './guest.js';
import { telegramAuthMiddleware, isOwner } from './auth.js';
import { ensurePocket, debitBuyIn, creditCashOut } from './wallet.js';

// ── Dials ────────────────────────────────────────────────────────────────────

// Half an hour to answer the door. Long enough to notice a push, short enough
// that a friend left standing there is a fact somebody can act on tonight.
export const VISIT_RESPOND_MS = 30 * 60_000;

// Two hours, or forty hands — whichever comes first. Forty happens to match
// HOME_MAX_HANDS's own default, and that is not a coincidence: a change of
// composition tears the table down and stands it back up (homeGame.js rule 2),
// which already resets the hand counter the moment he is seated. This is the
// independent backstop for a deployment that has retuned HOME_MAX_HANDS out
// from under it.
export const VISIT_MAX_MS = 2 * 60 * 60_000;
export const VISIT_MAX_HANDS = 40;

// What a wager may be, whichever pocket is smaller. Ten per cent of an evening
// is a real bet and not a way to strip a pocket bare over one bad session.
export const WAGER_CAP_PCT = 0.10;

const VISIT_TICK_MS = 30_000;

// ── Wiring ───────────────────────────────────────────────────────────────────
// Injected exactly like homeGame.js's own liveTables — this module reads a
// live table's seats to settle a wager, and importing table.js directly would
// be the same cycle homeGame.js's injection already exists to avoid.
let liveTables = null;
export function configure({ liveTables: tables = null } = {}) {
  liveTables = tables;
}

// id -> record. In memory only, like homeGame's households: a visit is an
// evening, not a career, and a process restart losing an unanswered knock at
// the door costs nobody a chip — see agent.visiting below, which IS persisted,
// for the one fact that must survive one (he does not silently reappear at
// his own kitchen table).
const visits = new Map();
let tick = null;

// ── The refusal vocabulary ───────────────────────────────────────────────────

const REFUSAL_LINES = Object.freeze({
  inHand: 'He is in a hand. He will go when it is over.',
  notHome: 'He is not home — bring him back first.',
  self: 'He cannot visit his own house.',
  alreadyVisiting: 'He is already out visiting somebody.',
  guestCannotVisit: 'Keep him and he can go visiting.',
  hostBusy: 'Somebody is already at the door.',
});

const refuse = (status, reason, extra = {}) => ({
  status,
  body: { error: REFUSAL_LINES[reason] ?? 'Not now.', reason, ...extra },
});

// ── Finding him ──────────────────────────────────────────────────────────────

/** Whose agent is this, and the record itself. Walks the whole building, like
 * SERVER-5 job 2's nightly pass — this is the second thing in the product
 * that has to. */
function findAgentOwner(agentId) {
  for (const ownerId of allOwnerIds()) {
    const agent = agentsOf(ownerId).find((a) => a.id === agentId);
    if (agent) return { ownerId, agent };
  }
  return null;
}

function activeVisitFor(hostUserId) {
  for (const v of visits.values()) {
    if (v.hostUserId === String(hostUserId) && (v.status === 'pending' || v.status === 'accepted')) return v;
  }
  return null;
}

function clearVisiting(record) {
  const found = findAgentOwner(record.agentId);
  if (found?.agent?.visiting?.visitId === record.id) {
    found.agent.visiting = null;
    saveOwner(found.ownerId);
  }
}

// ── The knock ────────────────────────────────────────────────────────────────

/**
 * POST /api/agents/:agentId/visit { hostUserId, stake }
 *
 * Called by the HOST'S own client, at the far end of the deep link he opened
 * (visit_<agentId>) — the agent's own owner never touches this route, which
 * is what lets it validate ownership on the door being knocked on rather than
 * the man doing the knocking.
 */
export function requestVisit({ agentId, hostUserId, stake = 0 } = {}) {
  const found = findAgentOwner(agentId);
  if (!found) return { status: 404, body: { error: 'Agent not found' } };
  const { ownerId: guestUserId, agent } = found;

  if (String(guestUserId) === String(hostUserId)) return refuse(400, 'self');
  if (agent.archived) return { status: 410, body: { error: 'agentRetired' } };
  if (guestCannotVisit(guestUserId)) return refuse(403, 'guestCannotVisit');
  if (agent.visiting) return refuse(409, 'alreadyVisiting');

  const seat = seatStatusOf(agent);
  if (seat.inHand) return refuse(409, 'inHand', { tableId: seat.tableId });
  if (seat.atTable) return refuse(409, 'notHome', { tableId: seat.tableId });
  // Freshly derived, not the raw stored field (home.js rule 1) — an agent who
  // has never been presented has no `.location` on his record at all, and
  // trusting that absence would refuse every agent nobody has looked at yet.
  const presented = presentAgentById(agentId, guestUserId, { owner: true });
  if (presented?.location?.where !== Where.HOME) {
    return refuse(409, 'notHome', { tableId: presented?.location?.tableId ?? null });
  }

  // GUEST-1 job 5: a guest may HOST — nothing here refuses hostUserId — but
  // may never be sent, which the check above already covers for the agent
  // doing the visiting.
  if (activeVisitFor(hostUserId)) return refuse(409, 'hostBusy');

  const now = Date.now();
  const record = {
    id: randomUUID(),
    agentId,
    agentName: agent.name || 'Agent',
    guestUserId: String(guestUserId),
    hostUserId: String(hostUserId),
    hostAgentId: null,           // named at accept — see answerVisit
    stake: Math.max(0, Math.floor(Number(stake) || 0)),
    stakeAmount: 0,              // what was actually escrowed, after the cap
    status: 'pending',
    createdAt: now,
    respondBy: now + VISIT_RESPOND_MS,
    acceptedAt: null,
    endsAt: null,
  };
  visits.set(record.id, record);

  agent.visiting = { visitId: record.id, hostUserId: record.hostUserId, since: now };
  saveOwner(guestUserId);
  armTick();

  try { notifyHomeChanged(hostUserId); } catch (err) { console.error('[visit] push failed:', err.message); }
  notifyEvent('visitor', { ownerId: hostUserId, agentId, agentName: record.agentName })
    .catch((err) => console.error('[visit] notify failed:', err.message));

  return {
    status: 200,
    body: { visitId: record.id, agentId, agentName: record.agentName, hostUserId: record.hostUserId, respondBy: record.respondBy },
  };
}

// ── The answer ───────────────────────────────────────────────────────────────

const ACCEPT_LINES = ['Pull up a chair.', 'Deal him in — plenty of room.', "Room's yours."];
const DECLINE_LINES = Object.freeze({
  Rock:    ['Not tonight. I do not know his game.', "I'll pass. Some other night."],
  Hothead: ["Not while I'm hot. Tell him to come back.", 'Not tonight — I am not in the mood.'],
  default: ['Not tonight.', 'The house is full tonight.'],
});

function hostGreeterNature(hostUserId) {
  const home = presentedRoster(hostUserId, { owner: false }).find((a) => a.location?.where === Where.HOME);
  return home?.nature ?? null;
}

function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function answerLine(visitId, hostUserId, accept) {
  const pool = accept ? ACCEPT_LINES : (DECLINE_LINES[hostGreeterNature(hostUserId)] ?? DECLINE_LINES.default);
  return pool[hash(visitId) % pool.length];
}

/** The wager, capped at WAGER_CAP_PCT of whichever pocket is smaller. */
function cappedStake(requested, guestBalance, hostBalance) {
  if (!(requested > 0)) return 0;
  const cap = Math.floor(WAGER_CAP_PCT * Math.min(guestBalance, hostBalance));
  return Math.max(0, Math.min(Math.floor(requested), cap));
}

/**
 * POST /api/home/visitors/:visitId/answer { accept }
 *
 * The host's own answer, in his own resident's voice — a nature-flavoured
 * line, never a model call (SEATS-1 / HOME-STATE-1's own law for this table).
 */
export function answerVisit(visitId, hostUserId, accept) {
  const record = visits.get(visitId);
  if (!record || record.hostUserId !== String(hostUserId)) return { status: 404, body: { error: 'Visit not found' } };
  if (record.status !== 'pending') return { status: 409, body: { error: 'alreadyAnswered', status: record.status } };

  const line = answerLine(visitId, hostUserId, !!accept);

  if (accept) {
    const now = Date.now();
    record.status = 'accepted';
    record.acceptedAt = now;
    record.endsAt = now + VISIT_MAX_MS;

    const guestFound = findAgentOwner(record.agentId);
    if (guestFound?.agent && record.stake > 0) {
      // Presented, not the raw record — location is derived (home.js rule 1)
      // and a raw agent that has never been presented yet has no `.location`
      // to read at all.
      const greeter = presentedRoster(hostUserId, { owner: true }).find((a) => a.location?.where === Where.HOME);
      const hostAgent = greeter ? agentsOf(hostUserId).find((a) => a.id === greeter.id) : null;
      if (hostAgent) {
        ensurePocket(guestFound.agent);
        ensurePocket(hostAgent);
        const finalStake = cappedStake(record.stake, guestFound.agent.pocket.balance, hostAgent.pocket.balance);
        if (finalStake > 0
          && debitBuyIn(guestFound.agent.pocket, finalStake).ok
          && debitBuyIn(hostAgent.pocket, finalStake).ok) {
          record.hostAgentId = hostAgent.id;
          record.stakeAmount = finalStake;
          saveOwner(guestFound.ownerId);
          saveOwner(hostUserId);
        }
      }
    }

    homeGameMod.sync(hostUserId);
  } else {
    record.status = 'declined';
    clearVisiting(record);
  }

  try { notifyHomeChanged(hostUserId); } catch (err) { console.error('[visit] push failed:', err.message); }
  try { notifyHomeChanged(record.guestUserId); } catch (err) { console.error('[visit] push failed:', err.message); }

  return {
    status: 200,
    body: { visitId, accepted: !!accept, line, game: accept ? homeGameMod.state(hostUserId) : null },
  };
}

// ── What homeGame.js is injected with ───────────────────────────────────────

/** Accepted, unexpired visitors — homeGame's `visitorsFor`. Only these play. */
export function listVisitorsFor(hostUserId) {
  const out = [];
  for (const v of visits.values()) {
    if (v.hostUserId !== String(hostUserId) || v.status !== 'accepted') continue;
    const p = presentAgentById(v.agentId, v.guestUserId, { owner: false });
    if (!p) continue;
    out.push({
      ...p,
      guest: true,
      ownerId: v.guestUserId,
      // He is standing in THIS flat, whatever his own owner's projection of
      // him says — see the note on presentAgent's own VISIT-1 guard.
      location: { where: Where.HOME, tableId: null, room: null, since: v.acceptedAt ?? Date.now() },
    });
  }
  return out;
}

// ── What HOME_STATE is injected with ────────────────────────────────────────

/** Every guest body that should be drawn in this flat — pending too, standing
 * by the door before an answer exists. */
export function visitBodiesFor(hostUserId) {
  const bodies = listVisitorsFor(hostUserId);
  for (const v of visits.values()) {
    if (v.hostUserId !== String(hostUserId) || v.status !== 'pending') continue;
    const p = presentAgentById(v.agentId, v.guestUserId, { owner: false });
    if (!p) continue;
    bodies.push({ ...p, guest: true, ownerId: v.guestUserId, location: { where: Where.HOME, tableId: null, room: null, since: v.createdAt } });
  }
  return bodies;
}

/** The one pending knock this host has not answered, or null. */
export function pendingVisitorFor(hostUserId) {
  for (const v of visits.values()) {
    if (v.hostUserId === String(hostUserId) && v.status === 'pending') {
      return { id: v.id, agentId: v.agentId, agentName: v.agentName, respondBy: v.respondBy };
    }
  }
  return null;
}

// ── Endings ──────────────────────────────────────────────────────────────────

/** money(n) — same formatting law as every other file that prints one. */
const money = (n) => `$${Math.abs(Math.round(Number(n) || 0)).toLocaleString('en-US')}`;

function settleWager(record) {
  if (!record.stakeAmount) return null;
  const guestFound = findAgentOwner(record.agentId);
  const hostFound = record.hostAgentId ? findAgentOwner(record.hostAgentId) : null;
  if (!guestFound?.agent || !hostFound?.agent) return null;
  ensurePocket(guestFound.agent);
  ensurePocket(hostFound.agent);

  const tableId = homeGameMod.homeTableId(record.hostUserId);
  const table = liveTables?.getTable?.(tableId) ?? null;
  const guestSeat = table && !table.closed ? table.agentIds.indexOf(record.agentId) : -1;
  const hostSeat = table && !table.closed ? table.agentIds.indexOf(record.hostAgentId) : -1;

  let outcome = 'push';
  if (guestSeat >= 0 && hostSeat >= 0 && typeof table.seatStack === 'function') {
    const guestNet = table.seatStack(guestSeat) - homeGameMod.HOME_BUYIN;
    const hostNet = table.seatStack(hostSeat) - homeGameMod.HOME_BUYIN;
    if (guestNet > hostNet) outcome = 'guest';
    else if (hostNet > guestNet) outcome = 'host';
  }

  const pot = record.stakeAmount * 2;
  if (outcome === 'guest') {
    creditCashOut(guestFound.agent.pocket, pot, tableId);
  } else if (outcome === 'host') {
    creditCashOut(hostFound.agent.pocket, pot, tableId);
  } else {
    creditCashOut(guestFound.agent.pocket, record.stakeAmount, tableId);
    creditCashOut(hostFound.agent.pocket, record.stakeAmount, tableId);
  }
  saveOwner(guestFound.ownerId);
  saveOwner(record.hostUserId);

  return {
    outcome,
    guestLine: outcome === 'guest' ? `Brought home ${money(pot)} from the visit.`
      : outcome === 'host' ? `Dropped ${money(record.stakeAmount)} on the visit.`
      : `The bet was a wash — ${money(record.stakeAmount)} back.`,
    hostLine: outcome === 'host' ? `Took ${money(pot)} off the visitor.`
      : outcome === 'guest' ? `Dropped ${money(record.stakeAmount)} to the visitor.`
      : `The bet was a wash — ${money(record.stakeAmount)} back.`,
  };
}

function endVisit(record, now) {
  record.status = 'ended';
  record.result = settleWager(record);
  clearVisiting(record);
  try { homeGameMod.sync(record.hostUserId); } catch (err) { console.error('[visit] resync failed:', err.message); }
  try { notifyHomeChanged(record.hostUserId); } catch (err) { console.error('[visit] push failed:', err.message); }
  try { notifyHomeChanged(record.guestUserId); } catch (err) { console.error('[visit] push failed:', err.message); }
}

// Every accepted visit's own cap, independent of whatever a table happened to
// already report — see VISIT_MAX_HANDS above.
function stillRunning(record) {
  const game = homeGameMod.state(record.hostUserId);
  if (!game || game.state !== 'running') return false;
  if ((game.handsPlayed ?? 0) >= VISIT_MAX_HANDS) return false;
  return (game.seats ?? []).some((s) => s.agentId === record.agentId);
}

function sweep(now) {
  let active = 0;
  for (const record of [...visits.values()]) {
    if (record.status === 'pending') {
      if (now >= record.respondBy) {
        record.status = 'timeout';
        clearVisiting(record);
        try { notifyHomeChanged(record.hostUserId); } catch (err) { console.error('[visit] push failed:', err.message); }
        try { notifyHomeChanged(record.guestUserId); } catch (err) { console.error('[visit] push failed:', err.message); }
      } else active++;
      continue;
    }
    if (record.status === 'accepted') {
      if (now >= record.endsAt || !stillRunning(record)) endVisit(record, now);
      else active++;
    }
  }
  if (active === 0) stopTick();
}

function armTick() {
  if (tick) return;
  tick = setInterval(() => {
    try { sweep(Date.now()); } catch (err) { console.error('[visit] sweep failed:', err.message); }
  }, VISIT_TICK_MS);
  tick.unref?.();
}
function stopTick() {
  if (!tick) return;
  clearInterval(tick);
  tick = null;
}

/** Tests only: run the sweep a timer would have run, and forget every visit. */
export function _sweepNow(now = Date.now()) { sweep(now); }
export function reset() {
  stopTick();
  visits.clear();
  liveTables = null;
}

// ── Routes ───────────────────────────────────────────────────────────────────

export function installVisitRoutes(app) {
  app.post('/api/agents/:agentId/visit', telegramAuthMiddleware, (req, res) => {
    const hostUserId = String(req.body?.hostUserId || req.query.hostUserId || '');
    if (!hostUserId || !isOwner(req, hostUserId)) return res.status(403).json({ error: 'Not your household' });
    const { agentId } = req.params;
    const stake = Number(req.body?.stake) || 0;
    const out = requestVisit({ agentId, hostUserId, stake });
    res.status(out.status).json(out.body);
  });

  app.post('/api/home/visitors/:visitId/answer', telegramAuthMiddleware, (req, res) => {
    const hostUserId = String(req.body?.hostUserId || req.query.hostUserId || req.query.userId || '');
    if (!hostUserId || !isOwner(req, hostUserId)) return res.status(403).json({ error: 'Not your household' });
    if (typeof req.body?.accept !== 'boolean') return res.status(400).json({ error: 'accept must be a boolean' });
    const out = answerVisit(req.params.visitId, hostUserId, req.body.accept);
    res.status(out.status).json(out.body);
  });

  // GET /api/agents/:agentId/visit-preview — job 6, and deliberately public.
  //
  // A recipient with no account holds no credential at all, and the guest
  // landing has to say whose door he is answering before one exists — his
  // NAME, and only his name. No auth, no owner check, the same public-facing
  // law GET /share/<id>.png already draws on: a name is not the flat.
  app.get('/api/agents/:agentId/visit-preview', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    const found = findAgentOwner(req.params.agentId);
    if (!found || found.agent.archived) return res.status(404).json({ error: 'Agent not found' });
    res.json({ agentId: req.params.agentId, agentName: found.agent.name || 'Agent' });
  });
}
