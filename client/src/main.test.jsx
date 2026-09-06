// client/src/main.test.jsx — TEST-1
//
// LAND-2: on the production domain, a visitor with no Telegram initData is not
// a Mini App user — they are someone who typed the URL, and they get the
// landing page. Inside Telegram (or on localhost) the app boots normally.
//
// main.jsx runs this at module scope, so each case re-imports the module with
// vi.resetModules() and a location stubbed to the domain under test.

import { act } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { agentsResponse } from './test/fixtures/agents.js';
import { fetchMock, telegram } from './test/harness.js';

const realLocation = window.location;

function stubLocation(hostname) {
  const replace = vi.fn();
  Object.defineProperty(window, 'location', {
    configurable: true,
    writable: true,
    value: { ...realLocation, hostname, protocol: 'https:', host: hostname, replace },
  });
  return replace;
}

function mountPoint() {
  const root = document.createElement('div');
  root.id = 'root';
  document.body.appendChild(root);
  return root;
}

describe('LAND-2 landing-page guard', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '';
    fetchMock.route('/api/agents', agentsResponse);
  });

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, writable: true, value: realLocation });
  });

  it('sends a visitor with no initData to /welcome and never mounts the app', async () => {
    const replace = stubLocation('agenticpoker.app');
    telegram.signOut();
    const root = mountPoint();

    await import('./main.jsx');

    expect(replace).toHaveBeenCalledWith('/welcome');
    expect(root).toBeEmptyDOMElement();
    // The SDK is never initialised for a visitor being redirected away.
    expect(telegram.webApp.readyCalls).toBe(0);
  });

  it('renders the app for a Telegram user on the production domain', async () => {
    const replace = stubLocation('agenticpoker.app');
    telegram.signIn();
    const root = mountPoint();

    await act(async () => { await import('./main.jsx'); });

    expect(replace).not.toHaveBeenCalled();
    expect(telegram.webApp.readyCalls).toBe(1);
    // BUGS-A job 6: and the vertical swipe is handed back to the app on the
    // way in. Without this Telegram claims every downward drag as "minimise
    // the Mini App", so a sheet cannot be pushed down and a swipe on the felt
    // closes the whole thing. It is asserted HERE and not only in
    // telegram.test.jsx because what matters is that the boot path calls it.
    expect(telegram.webApp.disableVerticalSwipesCalls).toBe(1);
    await vi.waitFor(() => expect(root).not.toBeEmptyDOMElement());
  });

  it('renders the app on localhost even with no initData, so dev in a browser works', async () => {
    const replace = stubLocation('localhost');
    telegram.signOut();
    const root = mountPoint();

    await act(async () => { await import('./main.jsx'); });

    expect(replace).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(root).not.toBeEmptyDOMElement());
  });
});
