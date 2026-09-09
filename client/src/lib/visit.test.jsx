// client/src/lib/visit.test.jsx — VISIT-1
//
// The link that goes out, and the two POSTs that come back through it: the
// knock and the answer.

import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import {
  visitLink, shareVisitLink, requestVisit, answerVisit, VISIT_START_PREFIX,
  visitPreview, rememberPendingVisitor, pendingVisitorName, clearPendingVisitor,
} from './visit.js';
import { fetchMock, telegram } from '../test/harness.js';

// BUG-150 replaces the public-id link and false cancellation success contract.
const token = '0123456789abcdefghijklmnopqrstuv';
const url = `https://t.me/AigenicPokerBot?start=visit_${token}`;
const invitation = { agentId:'a1', agentName:'Away Day', invitationToken:token, expiresAt:Date.now()+3600000, maxStake:0, startParam:`visit_${token}` };
const text = 'Away Day wants a game at your place in Railbird. Open this invitation to let him in. Free home game · no chips staked.';

beforeEach(() => {
  telegram.install();
  telegram.signIn();
  fetchMock.route('/api/agents/a1/visit-invite', invitation, { method:'POST' });
  fetchMock.route(`/api/visit-invites/${token}`, { agentId:'a1', agentName:'Away Day', expiresAt:invitation.expiresAt, maxStake:0 });
});
afterEach(() => { delete navigator.share; delete navigator.clipboard; });

describe('VISIT_START_PREFIX', () => {
  it('is the sibling of GUEST_START_PREFIX — visit_, not something a link could collide with', () => {
    expect(VISIT_START_PREFIX).toBe('visit_');
  });
});

describe('visitLink', () => {
  it('builds the deep link off GET /api/auth/config', async () => {
    fetchMock.route('/api/auth/config', { botUsername: 'AigenicPokerBot' });
    expect(await visitLink('a1')).toBe(url);
  });

  it('is null on a deployment with no bot configured — a disabled button, not a link to nowhere', async () => {
    fetchMock.route('/api/auth/config', { botUsername: '' });
    expect(await visitLink('a1')).toBeNull();
  });

  it('is null when the config route cannot be reached at all', async () => {
    fetchMock.route('/api/auth/config', () => ({ status: 500, body: {} }));
    expect(await visitLink('a1')).toBeNull();
  });
});

describe('shareVisitLink', () => {
  it('hands the link to the OS share sheet when there is one', async () => {
    fetchMock.route('/api/auth/config', { botUsername: 'AigenicPokerBot' });
    const share = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });

    const res = await shareVisitLink('a1', 'Away Day');
    expect(res).toEqual({ ok:true, via:'share', url, text, title:'Away Day wants a game', expiresAt:invitation.expiresAt });
    expect(share).toHaveBeenCalledWith({ title:'Away Day wants a game', text, url });
    delete navigator.share;
  });

  it('falls back to the clipboard where there is no share sheet', async () => {
    fetchMock.route('/api/auth/config', { botUsername: 'AigenicPokerBot' });
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const res = await shareVisitLink('a1', 'Away Day');
    expect(res).toEqual({ ok:true, via:'clipboard', url, text, title:'Away Day wants a game', expiresAt:invitation.expiresAt });
    expect(writeText).toHaveBeenCalledWith(`${text}\n\n${url}`);
  });

  it('reports failure honestly when there is no link to give', async () => {
    fetchMock.route('/api/auth/config', { botUsername: '' });
    expect(await shareVisitLink('a1')).toEqual({ ok: false, reason: 'noLink' });
  });

  it('BUG-150: a cancelled share is reported as cancelled with its prepared invitation retained', async () => {
    fetchMock.route('/api/auth/config', { botUsername: 'AigenicPokerBot' });
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(new DOMException('cancelled', 'AbortError')), configurable: true,
    });
    expect(await shareVisitLink('a1')).toEqual({ ok:false, reason:'cancelled', url, text, title:'Away Day wants a game', expiresAt:invitation.expiresAt });
    delete navigator.share;
  });
});

describe('requestVisit / answerVisit', () => {
  it('POSTs the knock with the CALLER as hostUserId', async () => {
    let posted = null;
    fetchMock.route(/\/agents\/a1\/visit/, ({ body }) => { posted = body; return { visitId: 'v1' }; }, { method: 'POST' });

    const res = await requestVisit(token);
    expect(res.ok).toBe(true);
    expect(posted).toEqual({ hostUserId:'4242', stake:0, invitationToken:token });
  });

  it('POSTs the answer the same way', async () => {
    let posted = null;
    fetchMock.route(/\/visitors\/v1\/answer/, ({ body }) => { posted = body; return { accepted: true }; }, { method: 'POST' });

    const res = await answerVisit('v1', true);
    expect(res.ok).toBe(true);
    expect(posted).toEqual(expect.objectContaining({ hostUserId: '4242', accept: true }));
  });

  it('a network failure is reported, not thrown', async () => {
    fetchMock.route(/\/agents\/a1\/visit/, () => { throw new Error('offline'); }, { method: 'POST' });
    const res = await requestVisit(token);
    expect(res).toEqual({ ok: false, status: 0, body: null });
  });
});

// ── VISIT-1 job 6 ────────────────────────────────────────────────────────────

describe('visitPreview', () => {
  it('reads his name off the public route — no auth header at all', async () => {
    const preview = { agentId:'friend1', agentName:'Away Day', expiresAt:invitation.expiresAt, maxStake:0 };
    fetchMock.route(`/api/visit-invites/${token}`, preview);
    expect(await visitPreview(token)).toEqual(preview);
    expect(fetchMock.requestsMatching(`/api/visit-invites/${token}`)[0].headers).toEqual({});
  });

  it('is null for an agent nobody has', async () => {
    fetchMock.route('/api/visit-invites/nobody', { status: 404, body: {} });
    expect(await visitPreview('nobody')).toBeNull();
  });
});

describe('pending visitor handoff', () => {
  beforeEach(() => { sessionStorage.clear(); });

  it('is null until somebody has remembered one', () => {
    expect(pendingVisitorName()).toBeNull();
  });

  it('round-trips the name across the landing → draft handoff', () => {
    rememberPendingVisitor('Away Day');
    expect(pendingVisitorName()).toBe('Away Day');
    clearPendingVisitor();
    expect(pendingVisitorName()).toBeNull();
  });
});
