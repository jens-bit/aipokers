// client/src/components/guest/ClaimWall.test.jsx — GUEST-1 job 4 (G4)
//
// The one screen a guest is ever asked anything by.
//
// Most of what is pinned here is COPY, and deliberately so: this wall is the
// product's only ask, every word on it was chosen, and a wall that quietly
// loses "and he is forgotten after 30 days" is a wall that has stopped being
// honest about what happens if you do nothing.
//
// The assertion that matters most is the last one. THE WAY OUT IS ALWAYS
// THERE, on every route into the wall — a session ending, a refusal, any of
// them. A wall with no way past it is a paywall, and the whole premise of this
// tree is that the landing is the game.

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ClaimWall, resultLine, signedMoney } from './ClaimWall.jsx';
import { fetchMock, telegram } from '../../test/harness.js';
import { _resetForTests } from '../../lib/guest.js';

// The wall asks the server for its deep link the moment it opens, so every
// render settles that first. Without it React warns about a state update
// outside act() on every case that only reads the copy.
const openWall = async (props) => {
  let out;
  await act(async () => { out = render(<ClaimWall onClose={() => {}} {...props} />); });
  return out;
};

const AGENT = { id: 'a1', name: 'Granite', mood: { state: 'confident', heat: 55 } };
const ARRIVAL = { agentId: 'a1', net: 1240, hands: 38, reason: 'worn' };

beforeEach(() => {
  _resetForTests();
  telegram.install();
  telegram.signOut();
  fetchMock.route('/api/guest/link', { url: 'https://t.me/TestBot?start=guest_abc' });
});

// ── The result line ─────────────────────────────────────────────────────────

describe('GUEST-1 · what he just did', () => {
  it('is the money and the hands it took', () => {
    expect(resultLine(ARRIVAL)).toBe('+$1,240 over 38 hands');
    expect(resultLine({ net: -310, hands: 1 })).toBe('-$310 over 1 hand');
  });

  it('a night with no hands in it is the money alone', () => {
    expect(resultLine({ net: 0, hands: 0 })).toBe('+$0');
  });

  it('no session behind the wall is no line — not an invented one', () => {
    // The wall can be raised by a refusal, with nothing to report. Printing
    // "0 hands" there would be a fact the screen made up.
    expect(resultLine(null)).toBe(null);
  });

  it('signs the money the way the room does', () => {
    expect(signedMoney(1240)).toBe('+$1,240');
    expect(signedMoney(-90)).toBe('-$90');
    expect(signedMoney(undefined)).toBe('+$0');
  });
});

// ── What is on it ───────────────────────────────────────────────────────────

describe('GUEST-1 · the wall', () => {
  it('leads with him: the ask, his name and what he just won', async () => {
    await openWall({ agent: AGENT, arrival: ARRIVAL });
    expect(screen.getByText('Keep him')).toBeInTheDocument();
    expect(screen.getByText('Granite')).toBeInTheDocument();
    expect(screen.getByText('+$1,240 over 38 hands')).toBeInTheDocument();
  });

  it('states the three limits plainly, as three lines', async () => {
    await openWall({ agent: AGENT, arrival: ARRIVAL });
    expect(screen.getByText('One agent.')).toBeInTheDocument();
    expect(screen.getByText('One night at the casino a day.')).toBeInTheDocument();
    expect(screen.getByText('And you cannot talk to him.')).toBeInTheDocument();
  });

  it('says what happens if you do nothing', async () => {
    await openWall({ agent: AGENT, arrival: ARRIVAL });
    expect(screen.getByText('And he is forgotten after 30 days.')).toBeInTheDocument();
  });

  it('offers Google, disabled, and says soon rather than pretending', async () => {
    await openWall({ agent: AGENT, arrival: ARRIVAL });
    const google = screen.getByRole('button', { name: /CONTINUE WITH GOOGLE/ });
    expect(google).toBeDisabled();
    expect(google).toHaveTextContent('soon');
  });

  it('raised by a refusal, it is the same wall with no result line', async () => {
    await openWall({ agent: AGENT, arrival: null, reason: 'claimToTalk' });
    expect(screen.getByText('Keep him')).toBeInTheDocument();
    expect(screen.getByText('One agent.')).toBeInTheDocument();
    expect(screen.queryByText(/over \d+ hands?/)).not.toBeInTheDocument();
  });
});

// ── The way out ─────────────────────────────────────────────────────────────

describe('GUEST-1 · the way out is always there', () => {
  it('closes the wall and stays a guest', async () => {
    const onClose = vi.fn();
    await openWall({ agent: AGENT, arrival: ARRIVAL, onClose });
    await userEvent.click(screen.getByRole('button', { name: 'keep playing as a guest' }));
    expect(onClose).toHaveBeenCalled();
  });

  it('is there on the refusal route too', async () => {
    const onClose = vi.fn();
    await openWall({ agent: AGENT, arrival: null, reason: 'guestSessionCap', onClose });
    await userEvent.click(screen.getByRole('button', { name: 'keep playing as a guest' }));
    expect(onClose).toHaveBeenCalled();
  });
});

// ── Keeping him ─────────────────────────────────────────────────────────────

describe('GUEST-1 · CONTINUE IN TELEGRAM', () => {
  it('in a browser, it is the deep link the server built', async () => {
    await openWall({ agent: AGENT, arrival: ARRIVAL });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /CONTINUE IN TELEGRAM/ })).toBeEnabled();
    });
    expect(fetchMock.requestsMatching('/api/guest/link')).toHaveLength(1);
  });

  it('with no link to give, the button is not offered as if it worked', async () => {
    fetchMock.route('/api/guest/link', { url: null });
    await openWall({ agent: AGENT, arrival: ARRIVAL });
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /CONTINUE IN TELEGRAM/ })).toBeDisabled();
    });
    expect(screen.getByText(/not set up on this server/)).toBeInTheDocument();
  });

  it('inside Telegram the button IS the claim — no link, no round trip out', async () => {
    telegram.signIn({ id: 4242 });
    fetchMock.route('/api/guest/claim', { claimed: true, ownerId: '4242', agents: 1 }, { method: 'POST' });
    const onClaimed = vi.fn();

    await openWall({ agent: AGENT, arrival: ARRIVAL, onClaimed });
    await userEvent.click(screen.getByRole('button', { name: /CONTINUE IN TELEGRAM/ }));

    await waitFor(() => expect(onClaimed).toHaveBeenCalled());
    // The credential rides the ordinary header, the same one every other route
    // in the product takes.
    const [claim] = fetchMock.requestsMatching('/api/guest/claim');
    expect(claim.headers['x-telegram-init-data']).toContain('4242');
  });

  it('a claim that fails says so and leaves the wall up', async () => {
    telegram.signIn({ id: 4242 });
    fetchMock.route('/api/guest/claim', { status: 500, body: { error: 'claimFailed' } }, { method: 'POST' });
    const onClaimed = vi.fn();

    await openWall({ agent: AGENT, arrival: ARRIVAL, onClaimed });
    await userEvent.click(screen.getByRole('button', { name: /CONTINUE IN TELEGRAM/ }));

    expect(await screen.findByText(/did not go through/)).toBeInTheDocument();
    expect(onClaimed).not.toHaveBeenCalled();
    expect(screen.getByText('Keep him')).toBeInTheDocument();
  });
});
