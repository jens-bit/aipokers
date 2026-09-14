// client/src/components/ftu/guestCap.test.jsx — GUEST-3
//
// The wall a fifth visitor from one address met on prod tonight, and what it
// said, which was nothing.
//
// POST /api/guest answers 429 { error:'guestCap', perDay } once an address has
// spent its guests for the day. `startGuest` returned null for that, exactly as
// it returned null for a dead network, so boot fell through to the Telegram
// door — an empty seat ring and a login widget, on a page that had just said
// "free, no account needed". The seat was drawn as open. It was not open.
//
// Two claims here, and they are separable on purpose:
//   1. startGuest can tell a refusal from a blip, and carries the server's own
//      words when there are any.
//   2. The door renders those words under the ring, and the ring stops
//      advertising a seat.

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import LoginGate from '../LoginGate.jsx';
import { startGuest } from '../../lib/guest.js';
import { fetchMock, telegram } from '../../test/harness.js';

const CAP = {
  error: 'guestCap',
  message: 'That is enough new players from here today. Log in with Telegram, or come back tomorrow.',
  perDay: 20,
};

const signedOut = () => {
  fetchMock.route('/api/auth/me', { status: 401, body: {} });
  fetchMock.route('/api/auth/config', { botUsername: 'agenticpokerbot' });
};

beforeEach(() => {
  telegram.uninstall();
  try { window.localStorage.clear(); } catch { /* private window */ }
});

describe('GUEST-3 — a refusal is not a blip', () => {
  it('carries the server\'s own refusal back to the caller', async () => {
    fetchMock.route('/api/guest', { status: 429, body: CAP }, { method: 'POST' });

    const { ownerId, refusal } = await startGuest();
    expect(ownerId).toBeNull();
    expect(refusal).toMatchObject({ error: 'guestCap', perDay: 20, status: 429 });
    expect(refusal.message).toBe(CAP.message);
  });

  it('reports no refusal when nothing answered at all', async () => {
    // The distinction the old `return null` threw away. A network blip has
    // nothing to tell anybody, and must not put a wall on the screen.
    fetchMock.route('/api/guest', () => { throw new Error('offline'); }, { method: 'POST' });

    const { ownerId, refusal } = await startGuest();
    expect(ownerId).toBeNull();
    expect(refusal).toBeNull();
  });

  it('still returns the owner when the mint succeeds', async () => {
    fetchMock.route('/api/guest', { ownerId: 'g_abc' }, { method: 'POST' });

    const { ownerId, refusal } = await startGuest();
    expect(ownerId).toBe('g_abc');
    expect(refusal).toBeNull();
  });
});

describe('GUEST-3 — the door says why', () => {
  it('renders the server message under the ring, verbatim', async () => {
    signedOut();
    render(<LoginGate seatClosed notice={CAP.message}><div /></LoginGate>);

    const notice = await screen.findByTestId('guest-notice');
    // Verbatim: the client never paraphrases the rule that refused it.
    expect(notice).toHaveTextContent(CAP.message);
    expect(notice).toHaveAttribute('role', 'status');
  });

  // MERGE-7 RE-AIMS THE NEXT TWO CASES, AND KEEPS THE RULE.
  //
  // They were written against a static ring labelled ONE OPEN SEAT / NO SEAT
  // TONIGHT. SHOW-1 (e5ec57d) replaced that ring with a hand that plays, so
  // those strings are gone from the product and asserting on them would be
  // asserting on markup that no longer exists. The RULE is untouched: the
  // screen must not promise a seat it cannot give, and must say why. What
  // changed is only where the product makes that promise — the headline, now
  // that the label is gone — so that is what these assert. The claim is not
  // weaker: it now covers the sentence a visitor actually reads.

  it('stops promising a seat', async () => {
    signedOut();
    const { container } = render(<LoginGate seatClosed notice={CAP.message}><div /></LoginGate>);

    await screen.findByTestId('guest-notice');
    // The offer is withdrawn …
    expect(screen.queryByText(/and an open seat/)).toBeNull();
    // … and replaced by the truth, rather than by nothing.
    expect(screen.getByText(/Tonight it is/)).toBeInTheDocument();
    expect(container.querySelector('.ftu-login__room--closed')).toBeTruthy();
    // The room is still there and the demo still plays: a capped visitor is
    // exactly who still needs to see what the game is.
    expect(container.querySelector('.ftu-login__room')).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Demonstration poker table' })).toBeInTheDocument();
  });

  it('leaves the ordinary door exactly as it was', async () => {
    signedOut();
    const { container } = render(<LoginGate><div /></LoginGate>);

    await screen.findByText(/and an open seat/);
    expect(screen.queryByText(/Tonight it is/)).toBeNull();
    expect(screen.queryByTestId('guest-notice')).toBeNull();
    expect(container.querySelector('.ftu-login__room--closed')).toBeNull();
  });

  it('keeps the way in — a refused guest can still sign in', async () => {
    signedOut();
    const { container } = render(<LoginGate seatClosed notice={CAP.message}><div /></LoginGate>);

    await screen.findByTestId('guest-notice');
    // The refusal closes the guest door, not the product. The widget's slot is
    // still there, which is the whole reason the message names Telegram.
    await waitFor(() => expect(container.querySelector('.ftu-login__action')).toBeTruthy());
  });
});
