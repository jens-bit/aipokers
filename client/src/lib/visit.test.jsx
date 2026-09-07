// client/src/lib/visit.test.jsx — VISIT-1
//
// The link that goes out, and the two POSTs that come back through it: the
// knock and the answer.

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { visitLink, shareVisitLink, requestVisit, answerVisit, VISIT_START_PREFIX } from './visit.js';
import { fetchMock, telegram } from '../test/harness.js';

beforeEach(() => {
  telegram.install();
  telegram.signIn();
});

describe('VISIT_START_PREFIX', () => {
  it('is the sibling of GUEST_START_PREFIX — visit_, not something a link could collide with', () => {
    expect(VISIT_START_PREFIX).toBe('visit_');
  });
});

describe('visitLink', () => {
  it('builds the deep link off GET /api/auth/config', async () => {
    fetchMock.route('/api/auth/config', { botUsername: 'AigenicPokerBot' });
    expect(await visitLink('a1')).toBe('https://t.me/AigenicPokerBot?start=visit_a1');
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
    expect(res).toEqual({ ok: true, via: 'share' });
    expect(share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://t.me/AigenicPokerBot?start=visit_a1' }));
    delete navigator.share;
  });

  it('falls back to the clipboard where there is no share sheet', async () => {
    fetchMock.route('/api/auth/config', { botUsername: 'AigenicPokerBot' });
    const writeText = vi.fn().mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });

    const res = await shareVisitLink('a1', 'Away Day');
    expect(res).toEqual({ ok: true, via: 'clipboard', url: 'https://t.me/AigenicPokerBot?start=visit_a1' });
    expect(writeText).toHaveBeenCalledWith('https://t.me/AigenicPokerBot?start=visit_a1');
  });

  it('reports failure honestly when there is no link to give', async () => {
    fetchMock.route('/api/auth/config', { botUsername: '' });
    expect(await shareVisitLink('a1')).toEqual({ ok: false, reason: 'noLink' });
  });

  it('a cancelled share sheet is not a failure', async () => {
    fetchMock.route('/api/auth/config', { botUsername: 'AigenicPokerBot' });
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockRejectedValue(new Error('cancelled')), configurable: true,
    });
    expect(await shareVisitLink('a1')).toEqual({ ok: true, via: 'share' });
    delete navigator.share;
  });
});

describe('requestVisit / answerVisit', () => {
  it('POSTs the knock with the CALLER as hostUserId', async () => {
    let posted = null;
    fetchMock.route(/\/agents\/a1\/visit/, ({ body }) => { posted = body; return { visitId: 'v1' }; }, { method: 'POST' });

    const res = await requestVisit('a1');
    expect(res.ok).toBe(true);
    expect(posted).toEqual(expect.objectContaining({ hostUserId: '4242', stake: 0 }));
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
    const res = await requestVisit('a1');
    expect(res).toEqual({ ok: false, status: 0, body: null });
  });
});
