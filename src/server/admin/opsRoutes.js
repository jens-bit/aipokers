// src/server/admin/opsRoutes.js — ADMIN-2
//
// The write panel's routes: same x-admin-key header ADMIN-1 already checks,
// its own tighter/separate rate window (writeGuard.js), a mandatory confirm
// field on anything destructive, and one audit-log line per successful
// write. See ops.js for what each action actually calls, and its own header
// for the two recorded gaps (a reversible retire that does not collect
// money, and no setter for "routine" because nothing stores one).
//
// No action here ever takes more than one ownerId and one agentId — every
// route names exactly one of each in its path, never an array in the body.

import { adminGuard } from './key.js';
import { adminWriteGuard } from './writeGuard.js';
import { appendAudit, readAudit } from './audit.js';
import {
  adjustOwnerChips, resetOwnerWallet, ownerLedger,
  renameAgent, retireAgent, unretireAgent, unseatAgent, forceAgentState,
} from './ops.js';

function requireConfirm(req, res) {
  if (req.body?.confirm === true) return true;
  res.status(400).json({ error: 'confirm must be true for this action' });
  return false;
}

function respond(res, req, { action, target, reason }, result) {
  if (!result.ok) return res.status(result.status).json({ error: result.error });
  appendAudit({
    key: req.headers?.['x-admin-key'], action, target, reason,
    before: result.before, after: result.after,
  });
  return res.json({ ok: true, before: result.before, after: result.after });
}

export function installAdminWriteRoutes(app) {
  // ── Owner actions ──────────────────────────────────────────────────────
  //
  // POST /api/admin/owners/:ownerId/adjust  { amount, reason, confirm? }
  // confirm is required only when amount is negative — a debit is the
  // destructive direction; a credit is not.
  app.post('/api/admin/owners/:ownerId/adjust', adminWriteGuard(), (req, res) => {
    const { ownerId } = req.params;
    const amount = Number(req.body?.amount);
    if (Number.isFinite(amount) && amount < 0 && !requireConfirm(req, res)) return;
    const result = adjustOwnerChips(ownerId, { amount, reason: req.body?.reason });
    respond(res, req, { action: 'owner.adjust', target: ownerId, reason: req.body?.reason }, result);
  });

  // POST /api/admin/owners/:ownerId/reset  { reason?, confirm }
  app.post('/api/admin/owners/:ownerId/reset', adminWriteGuard(), (req, res) => {
    if (!requireConfirm(req, res)) return;
    const { ownerId } = req.params;
    const result = resetOwnerWallet(ownerId, { reason: req.body?.reason });
    respond(res, req, { action: 'owner.reset', target: ownerId, reason: req.body?.reason }, result);
  });

  // GET /api/admin/owners/:ownerId/ledger?limit=&offset= — a read, so the
  // read guard and no audit line (nothing changed).
  app.get('/api/admin/owners/:ownerId/ledger', adminGuard(), (req, res) => {
    const { ownerId } = req.params;
    res.json(ownerLedger(ownerId, { limit: req.query.limit, offset: req.query.offset }));
  });

  // ── Agent actions ──────────────────────────────────────────────────────
  //
  // POST /api/admin/owners/:ownerId/agents/:agentId/rename  { name, reason? }
  app.post('/api/admin/owners/:ownerId/agents/:agentId/rename', adminWriteGuard(), (req, res) => {
    const { ownerId, agentId } = req.params;
    const result = renameAgent(ownerId, agentId, { name: req.body?.name });
    respond(res, req, { action: 'agent.rename', target: `${ownerId}/${agentId}`, reason: req.body?.reason }, result);
  });

  // POST /api/admin/owners/:ownerId/agents/:agentId/retire  { confirm, reason? }
  // Hides him from the roster. Reversible — see ops.js's retireAgent for why
  // this is deliberately NOT the one-way /retire route.
  app.post('/api/admin/owners/:ownerId/agents/:agentId/retire', adminWriteGuard(), (req, res) => {
    if (!requireConfirm(req, res)) return;
    const { ownerId, agentId } = req.params;
    const result = retireAgent(ownerId, agentId);
    respond(res, req, { action: 'agent.retire', target: `${ownerId}/${agentId}`, reason: req.body?.reason }, result);
  });

  // POST /api/admin/owners/:ownerId/agents/:agentId/unretire  { reason? }
  // Restorative, not destructive — no confirm required.
  app.post('/api/admin/owners/:ownerId/agents/:agentId/unretire', adminWriteGuard(), (req, res) => {
    const { ownerId, agentId } = req.params;
    const result = unretireAgent(ownerId, agentId);
    respond(res, req, { action: 'agent.unretire', target: `${ownerId}/${agentId}`, reason: req.body?.reason }, result);
  });

  // POST /api/admin/owners/:ownerId/agents/:agentId/unseat  { confirm, reason? }
  app.post('/api/admin/owners/:ownerId/agents/:agentId/unseat', adminWriteGuard(), (req, res) => {
    if (!requireConfirm(req, res)) return;
    const { ownerId, agentId } = req.params;
    const result = unseatAgent(ownerId, agentId);
    respond(res, req, { action: 'agent.unseat', target: `${ownerId}/${agentId}`, reason: req.body?.reason }, result);
  });

  // POST /api/admin/owners/:ownerId/agents/:agentId/force-state  { fatigue?, mood?, reason? }
  // Not in ADMIN-2's list of destructive actions — no confirm required.
  app.post('/api/admin/owners/:ownerId/agents/:agentId/force-state', adminWriteGuard(), (req, res) => {
    const { ownerId, agentId } = req.params;
    const result = forceAgentState(ownerId, agentId, { fatigue: req.body?.fatigue, mood: req.body?.mood });
    respond(res, req, { action: 'agent.forceState', target: `${ownerId}/${agentId}`, reason: req.body?.reason }, result);
  });

  // ── The audit log itself ────────────────────────────────────────────────
  //
  // GET /api/admin/audit?limit=&offset= — a read, so the read guard.
  app.get('/api/admin/audit', adminGuard(), (req, res) => {
    res.json(readAudit({ limit: req.query.limit, offset: req.query.offset }));
  });
}
