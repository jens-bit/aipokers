// client/src/components/ftu/LoginGate.test.jsx — FTU-2
//
// The door: screen 1 of the first five minutes. It is the only screen a
// stranger sees, so it does the same job as every other one on the path —
// shows the room, says what the offer is, and gives exactly one way in.

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import LoginGate from '../LoginGate.jsx';
import { assertNoPlaceholders } from './ftu.test.jsx';
import { fetchMock, telegram } from '../../test/harness.js';

const child = <div data-testid="app">the app</div>;

describe('FTU-2 the door', () => {
  beforeEach(() => {
    telegram.uninstall();               // a browser, not the Mini App
    try { window.localStorage.clear(); } catch { /* private window */ }
  });

  const signedOut = () => {
    fetchMock.route('/api/auth/me', { status: 401, body: {} });
    fetchMock.route('/api/auth/config', { botUsername: 'agenticpokerbot' });
  };

  it('SHOW-1: shows a playing table before the login door settles', async () => {
    signedOut();
    const { container } = render(<LoginGate>{child}</LoginGate>);

    await screen.findByRole('region', { name: 'Demonstration poker table' });
    expect(container.querySelector('.ftu-login__room')).toBeTruthy();
    expect(container.querySelectorAll('[data-seat]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-board-card]')).toHaveLength(3);
  });

  it('FTU-2: makes the offer in the product\'s own words', async () => {
    signedOut();
    render(<LoginGate>{child}</LoginGate>);

    await screen.findByText(/There is a room/);
    expect(screen.getByText(/You will not be playing/)).toBeInTheDocument();
    expect(screen.getByText(/hire someone/)).toBeInTheDocument();
    expect(screen.getByText(/\$500 SEEDED ON SIGN-UP/)).toBeInTheDocument();
  });

  it('FTU-2: no placeholder copy anywhere on it', async () => {
    signedOut();
    const { container } = render(<LoginGate>{child}</LoginGate>);
    await screen.findByText(/There is a room/);
    assertNoPlaceholders(container);
  });

  it('FTU-2: exactly one way in — the widget, standing where a primary action goes', async () => {
    signedOut();
    const { container } = render(<LoginGate>{child}</LoginGate>);
    await screen.findByText(/There is a room/);

    await waitFor(() => {
      expect(container.querySelector('.ftu-login__action script[data-telegram-login]')).toBeTruthy();
    });
    expect(container.querySelectorAll('.ftu-login__action')).toHaveLength(1);
    // The illustration's pause is local; Telegram remains the only auth door.
    expect(screen.getByRole('button', { name: 'Pause demo' })).toBeInTheDocument();
    expect(container.querySelectorAll('button')).toHaveLength(1);
  });

  it('FTU-2: holds the slot open while Telegram is still answering', async () => {
    fetchMock.route('/api/auth/me', { status: 401, body: {} });
    fetchMock.route('/api/auth/config', new Promise(() => {}));   // never resolves
    const { container } = render(<LoginGate>{child}</LoginGate>);

    await screen.findByText(/There is a room/);
    // The room and the offer are already up; only the way in is pending.
    expect(container.querySelector('.ftu-login__room')).toBeTruthy();
    expect(screen.getByText('One moment…')).toBeInTheDocument();
  });

  it('FTU-2: says what to do instead when web login is not configured', async () => {
    fetchMock.route('/api/auth/me', { status: 401, body: {} });
    fetchMock.route('/api/auth/config', { botUsername: '' });
    render(<LoginGate>{child}</LoginGate>);

    expect(await screen.findByText(/Open the Mini App from/)).toBeInTheDocument();
  });

  it('FTU-2: and gets out of the way once he is in', async () => {
    fetchMock.route('/api/auth/me', { ok: true });
    render(<LoginGate>{child}</LoginGate>);

    expect(await screen.findByTestId('app')).toBeInTheDocument();
    expect(screen.queryByText(/There is a room/)).not.toBeInTheDocument();
  });
});
