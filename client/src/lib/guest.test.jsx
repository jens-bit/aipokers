// client/src/lib/guest.test.jsx — GUEST-1 job 4
//
// The browser's half of playing without an account.
//
// Two claims carry most of the weight here:
//
//   1. THE PAGE NEVER HOLDS THE CREDENTIAL. It keeps an owner id, which is not
//      a secret — it goes in every query string already — and the cookie stays
//      httpOnly. Losing the id costs nothing, because the server hands it back
//      from the cookie.
//   2. THE WALL IS CAUGHT IN ONE PLACE. Twenty call sites could refuse; one
//      wrapper notices. A refusal shape the client has never been taught about
//      still raises the wall, which is the correct behaviour for a limit
//      decided on the server.

import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  resolveGuest, startGuest, getGuestOwner, isGuest, clearGuest,
  guestDeepLink, claimGuest,
  installClaimCatcher, onClaimWall, openClaimWall, CLAIM_ERRORS,
  _resetForTests,
} from './guest.js';
import { getUserId } from './telegram.js';
import { fetchMock, telegram } from '../test/harness.js';

beforeEach(() => {
  _resetForTests();
  localStorage.clear();
  telegram.install();
  telegram.signOut();
});

// ── The door, and whether it is open ────────────────────────────────────────

describe('GUEST-1 · resolving the session', () => {
  it('is shut when the server says so, and asks nothing further', async () => {
    fetchMock.route('/api/auth/config', { botUsername: 'bot', guest: false });
    const out = await resolveGuest();
    expect(out).toEqual({ enabled: false, ownerId: null });
    // No point asking who we are through a door that does not exist.
    expect(fetchMock.requestsMatching('/api/guest/me')).toHaveLength(0);
  });

  it('is shut when the config cannot be read at all', async () => {
    const out = await resolveGuest();     // no route registered → 404
    expect(out.enabled).toBe(false);
  });

  it('answers with the guest the COOKIE says we are, not the one storage remembers', async () => {
    localStorage.setItem('agentic_guest_owner', 'g_stale');
    fetchMock.route('/api/auth/config', { guest: true });
    fetchMock.route('/api/guest/me', { ownerId: 'g_real', kind: 'guest' });

    const out = await resolveGuest();
    expect(out).toEqual({ enabled: true, ownerId: 'g_real' });
    expect(getGuestOwner()).toBe('g_real');
  });

  it('an open door with nobody behind it is not an error', async () => {
    fetchMock.route('/api/auth/config', { guest: true });
    fetchMock.route('/api/guest/me', { status: 404, body: { error: 'noGuest' } });
    expect(await resolveGuest()).toEqual({ enabled: true, ownerId: null });
  });
});

describe('GUEST-1 · minting one', () => {
  it('remembers the owner id and nothing else', async () => {
    fetchMock.route('/api/guest', { ownerId: 'g_new', kind: 'guest' }, { method: 'POST' });
    expect(await startGuest()).toBe('g_new');
    expect(isGuest()).toBe(true);
    // The whole of what the page holds. No token, anywhere.
    expect(localStorage.getItem('agentic_guest_owner')).toBe('g_new');
    expect(JSON.stringify(localStorage)).not.toContain('token');
  });

  it('a refused mint leaves the browser a non-guest', async () => {
    fetchMock.route('/api/guest', { status: 429, body: { error: 'guestCap' } }, { method: 'POST' });
    expect(await startGuest()).toBe(null);
    expect(isGuest()).toBe(false);
  });
});

// ── Who the app says it is ──────────────────────────────────────────────────

describe('GUEST-1 · getUserId', () => {
  it('is the guest id when there is no Telegram identity', async () => {
    fetchMock.route('/api/guest', { ownerId: 'g_who' }, { method: 'POST' });
    await startGuest();
    expect(getUserId()).toBe('g_who');
  });

  it('a Telegram id always wins, even with a guest id still lying around', async () => {
    fetchMock.route('/api/guest', { ownerId: 'g_who' }, { method: 'POST' });
    await startGuest();
    telegram.signIn({ id: 4242 });
    // The moment after a claim the browser holds both. The account must win,
    // or the first screen after keeping him is the flat he no longer lives in.
    expect(getUserId()).toBe('4242');
  });

  it('clearGuest hands the browser back to the random local id', async () => {
    fetchMock.route('/api/guest', { ownerId: 'g_who' }, { method: 'POST' });
    await startGuest();
    clearGuest();
    expect(isGuest()).toBe(false);
    expect(getUserId()).toMatch(/^u_/);
  });
});

// ── The deep link and the claim ─────────────────────────────────────────────

describe('GUEST-1 · keeping him', () => {
  it('takes the deep link from the server, because the page cannot build one', async () => {
    fetchMock.route('/api/guest/link', { url: 'https://t.me/Bot?start=guest_abc' });
    expect(await guestDeepLink()).toBe('https://t.me/Bot?start=guest_abc');
  });

  it('a deployment with no bot answers null rather than a dead link', async () => {
    fetchMock.route('/api/guest/link', { url: null });
    expect(await guestDeepLink()).toBe(null);
  });

  it('a successful claim forgets the guest', async () => {
    fetchMock.route('/api/guest', { ownerId: 'g_keep' }, { method: 'POST' });
    await startGuest();
    fetchMock.route('/api/guest/claim', { claimed: true, ownerId: '4242', agents: 1 }, { method: 'POST' });

    const out = await claimGuest('user=%7B%22id%22%3A4242%7D');
    expect(out).toEqual({ ok: true, ownerId: '4242', agents: 1 });
    expect(isGuest()).toBe(false);
  });

  it('a failed claim keeps him a guest — nothing was handed over', async () => {
    fetchMock.route('/api/guest', { ownerId: 'g_keep' }, { method: 'POST' });
    await startGuest();
    fetchMock.route('/api/guest/claim', { status: 409, body: { error: 'alreadyClaimed' } }, { method: 'POST' });

    expect(await claimGuest('x')).toEqual({ ok: false, error: 'alreadyClaimed' });
    expect(isGuest()).toBe(true);
  });
});

// ── The wall, caught in one place ───────────────────────────────────────────

describe('GUEST-1 · the claim catcher', () => {
  it('raises the wall on every refusal that carries claim: true', async () => {
    const seen = [];
    const off = onClaimWall((reason) => seen.push(reason));
    const uninstall = installClaimCatcher();

    fetchMock.route('/api/home/say', { status: 403, body: { error: 'claimToTalk', claim: true } }, { method: 'POST' });
    await fetch('/api/home/say', { method: 'POST' });

    await vi.waitFor(() => expect(seen).toEqual(['claimToTalk']));
    off();
    uninstall();
  });

  it('a refusal the client has never been taught about still raises it', async () => {
    const seen = [];
    const off = onClaimWall((reason) => seen.push(reason));
    const uninstall = installClaimCatcher();

    // A limit invented on the server tomorrow. `claim: true` is the contract,
    // not the list of error codes — which is the whole reason this is caught
    // centrally rather than at each call site.
    fetchMock.route('/api/whatever', { status: 409, body: { error: 'somethingNew', claim: true } });
    await fetch('/api/whatever');

    await vi.waitFor(() => expect(seen).toEqual(['somethingNew']));
    off();
    uninstall();
  });

  it('leaves the body intact for whoever asked for it', async () => {
    const uninstall = installClaimCatcher();
    fetchMock.route('/api/home/say', { status: 403, body: { error: 'claimToTalk', claim: true } }, { method: 'POST' });

    const res = await fetch('/api/home/say', { method: 'POST' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'claimToTalk', claim: true });
    uninstall();
  });

  it('says nothing about an ordinary refusal', async () => {
    const seen = [];
    const off = onClaimWall((reason) => seen.push(reason));
    const uninstall = installClaimCatcher();

    fetchMock.route('/api/agents/x/deploy', { status: 402, body: { error: 'broke', broke: true } }, { method: 'POST' });
    fetchMock.route('/api/agents/y/place', { status: 409, body: { error: 'inHand' } }, { method: 'POST' });
    await fetch('/api/agents/x/deploy', { method: 'POST' });
    await fetch('/api/agents/y/place', { method: 'POST' });

    await new Promise((r) => setTimeout(r, 10));
    expect(seen).toEqual([]);
    off();
    uninstall();
  });

  it('installs once, however many times it is asked', async () => {
    const first = installClaimCatcher();
    const before = window.fetch;
    installClaimCatcher();
    expect(window.fetch).toBe(before);
    first();
  });

  it('the wall can also be raised directly, for the moment no refusal marks', () => {
    const seen = [];
    const off = onClaimWall((reason) => seen.push(reason));
    openClaimWall('sessionEnd');
    expect(seen).toEqual(['sessionEnd']);
    off();
  });

  it('names the refusals it knows, and they are the server\'s own codes', () => {
    expect(CLAIM_ERRORS).toEqual(['claimToTalk', 'guestSessionCap', 'guestAgentCap']);
  });
});
