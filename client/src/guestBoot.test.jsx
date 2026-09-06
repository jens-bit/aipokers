// client/src/guestBoot.test.jsx — GUEST-1 job 4 (G1)
//
// Which door a visitor comes through, and what the app does once he is in.
//
// main.jsx now has four branches and the order of them is the whole contract:
// a credential the page already holds beats a round trip, and the guest door
// is only ever taken when the SERVER says it is open. The one that would hurt
// most if it broke is the last: with GUEST_ENABLED off, everything below has
// to behave exactly as it did before this tree, including the marketing
// redirect on the production domain. That is what makes the switch a real way
// back rather than a hidden button.
//
// G1 is the other claim here. A guest who has just been minted opens INTO the
// flat with the recruiter already talking — not onto a screen with a button
// that opens one — because wave 61's rule is that the landing is the game.

import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';

import App from './App.jsx';
import { fetchMock, telegram } from './test/harness.js';
import { _resetForTests } from './lib/guest.js';
import { agentsResponse } from './test/fixtures/agents.js';

const realLocation = window.location;

function stubLocation(hostname) {
  const replace = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...realLocation, hostname, protocol: 'https:', host: hostname, search: '', replace },
  });
  return replace;
}

function mountPoint() {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  return root;
}

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '';
  _resetForTests();
  localStorage.clear();
  fetchMock.route('/api/agents', agentsResponse);
});

afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, writable: true, value: realLocation });
});

// ── The four doors ──────────────────────────────────────────────────────────

describe('GUEST-1 · which door', () => {
  it('mints a guest and mounts the app when the server says the door is open', async () => {
    stubLocation('agenticpoker.app');
    telegram.signOut();
    const root = mountPoint();
    fetchMock.route('/api/auth/config', { botUsername: 'bot', guest: true });
    fetchMock.route('/api/guest/me', { status: 404, body: { error: 'noGuest' } });
    fetchMock.route('/api/guest', { ownerId: 'g_boot', kind: 'guest' }, { method: 'POST' });

    await act(async () => { await (await import('./main.jsx')).booted; });

    // No redirect to the marketing page: on this deployment the landing IS the
    // game, and he is already in it.
    expect(window.location.replace).not.toHaveBeenCalled();
    expect(fetchMock.requestsMatching('/api/guest').some((c) => c.method === 'POST')).toBe(true);
    await waitFor(() => expect(root).not.toBeEmptyDOMElement());
  });

  it('with the door shut, the production redirect is exactly what it was', async () => {
    const replace = stubLocation('agenticpoker.app');
    telegram.signOut();
    const root = mountPoint();
    fetchMock.route('/api/auth/config', { botUsername: 'bot', guest: false });

    await (await import('./main.jsx')).booted;

    expect(replace).toHaveBeenCalledWith('/welcome');
    expect(root).toBeEmptyDOMElement();
    // And no guest was minted on the way past.
    expect(fetchMock.posts.filter((c) => c.url.includes('/api/guest'))).toHaveLength(0);
  });

  it('a Mini App session never asks about guests at all', async () => {
    stubLocation('agenticpoker.app');
    telegram.signIn({ id: 4242 });
    mountPoint();
    fetchMock.route('/api/auth/config', { guest: true });

    await act(async () => { await (await import('./main.jsx')).booted; });

    expect(fetchMock.requestsMatching('/api/auth/config')).toHaveLength(0);
    expect(fetchMock.requestsMatching('/api/guest')).toHaveLength(0);
  });

  it('a returning guest is restored from the cookie and mints nothing', async () => {
    stubLocation('agenticpoker.app');
    telegram.signOut();
    mountPoint();
    fetchMock.route('/api/auth/config', { guest: true });
    fetchMock.route('/api/guest/me', { ownerId: 'g_back', kind: 'guest' });

    await act(async () => { await (await import('./main.jsx')).booted; });

    expect(fetchMock.posts.filter((c) => c.url.includes('/api/guest'))).toHaveLength(0);
  });

  it('a server that refuses to mint one falls through rather than mounting an ownerless app', async () => {
    const replace = stubLocation('agenticpoker.app');
    telegram.signOut();
    mountPoint();
    fetchMock.route('/api/auth/config', { guest: true });
    fetchMock.route('/api/guest/me', { status: 404, body: {} });
    fetchMock.route('/api/guest', { status: 429, body: { error: 'guestCap' } }, { method: 'POST' });

    await (await import('./main.jsx')).booted;

    expect(replace).toHaveBeenCalledWith('/welcome');
  });
});

// ── G1 · what a new guest lands on ──────────────────────────────────────────

describe('GUEST-1 · G1, the recruiter is already talking', () => {
  beforeEach(() => {
    telegram.install();
    telegram.signOut();
    // guestBoot="new" only ever reaches App for a browser that has just been
    // minted one, so the session it would be holding is set up here too — the
    // hook refuses to open the draft for anybody who is not a guest.
    localStorage.setItem('agentic_guest_owner', 'g_g1');
    fetchMock.route('/api/slots', { used: 0, cap: 4, next: { index: 1, price: 0, earned: 0, unlocked: true } });
    fetchMock.route('/api/agents', { agents: [] });
  });

  it('a new guest opens into the draft, not onto a button that opens one', async () => {
    await act(async () => { render(<App guestBoot="new" />); });
    // The recruiter's opening question — the draft's first row.
    expect(await screen.findByText(/Tell me how it should play/)).toBeInTheDocument();
  });

  it('a returning guest lands in his room instead', async () => {
    await act(async () => { render(<App guestBoot="returning" />); });
    expect(screen.queryByText(/Tell me how it should play/)).not.toBeInTheDocument();
  });

  it('and an owner with an account is untouched by any of it', async () => {
    telegram.signIn({ id: 4242 });
    await act(async () => { render(<App />); });
    expect(screen.queryByText(/Tell me how it should play/)).not.toBeInTheDocument();
  });
});
