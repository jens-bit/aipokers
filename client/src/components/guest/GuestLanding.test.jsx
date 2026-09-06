// client/src/components/guest/GuestLanding.test.jsx — GUEST-1 job 6
//
// "The landing is the game."
//
// The claim this file exists to hold is the one the whole tree turns on: the
// room under the hero is the REAL room, mounted, with the real recruiter in
// it — not a screenshot, not a link, not a demo. Every landing page this
// product has had ended in a call to action that took you somewhere else, and
// the somewhere else is where people stopped. There is nowhere else now.
//
// So DRAFT HIM is asserted to be a scroll rather than a navigation, and the
// draft's own composer is asserted to be present and reachable on the same
// page. If either of those stops being true, this page has quietly become a
// marketing page again — which is a thing that would look completely fine in
// a screenshot.

import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GuestLanding } from './GuestLanding.jsx';
import { fetchMock, telegram } from '../../test/harness.js';
import { _resetForTests } from '../../lib/guest.js';

const openLanding = async () => {
  let out;
  await act(async () => { out = render(<GuestLanding />); });
  return out;
};

beforeEach(() => {
  _resetForTests();
  localStorage.clear();
  // The landing is only ever rendered for a browser that has just been minted
  // a guest, so the session it would be holding is set up here too.
  localStorage.setItem('agentic_guest_owner', 'g_land');
  telegram.install();
  telegram.signOut();
  fetchMock.route('/api/agents', { agents: [] });
  fetchMock.route('/api/slots', { used: 0, cap: 4, next: { index: 1, price: 0, earned: 0, unlocked: true } });
  Element.prototype.scrollIntoView = vi.fn();
});

// ── The hero ────────────────────────────────────────────────────────────────

describe('GUEST-1 · one hero viewport', () => {
  it('is the headline, the sentence and the one action', async () => {
    await openLanding();
    expect(screen.getByRole('heading', { name: 'Deal him in.' })).toBeInTheDocument();
    expect(screen.getByText(/A poker player you raise/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /DRAFT HIM/ })).toBeInTheDocument();
  });

  it('promises what this page actually removed', async () => {
    await openLanding();
    // Not the ref's "Free · plays in Telegram", which was true when Telegram
    // was the only way in and is the wrong promise on the page that took the
    // account away.
    expect(screen.getByText('Free · no account needed')).toBeInTheDocument();
  });

  it('carries the wordmark and nothing else as chrome', async () => {
    await openLanding();
    expect(screen.getByText('AGENTIC POKER')).toBeInTheDocument();
  });

  it('he is holding two cards, in front of him, at 55% of the hood', async () => {
    const { container } = await openLanding();
    const cards = container.querySelectorAll('.guest-hero__card');
    expect(cards).toHaveLength(2);
    // 180px hood → 99px cards. The number is the brief's, and it is the one
    // thing on this page that is not the ref's (which fans them at 62%).
    expect(cards[0].style.width).toBe('99px');
    // Fanned, not stacked.
    expect(cards[0].style.transform).not.toBe(cards[1].style.transform);
  });
});

// ── The room ────────────────────────────────────────────────────────────────

describe('GUEST-1 · and the room, directly under it', () => {
  it('is the real room with the real recruiter, mounted on the same page', async () => {
    await openLanding();
    // The recruiter's opening question — the draft's first row, live, not a
    // picture of one.
    expect(await screen.findByText(/Tell me how it should play/)).toBeInTheDocument();
  });

  it('has the draft composer on the page, ready to be typed into', async () => {
    await openLanding();
    await waitFor(() => expect(screen.getByTestId('draft-input')).toBeInTheDocument());
  });

  it('DRAFT HIM scrolls to it rather than navigating anywhere', async () => {
    await openLanding();
    await userEvent.click(screen.getByRole('button', { name: /DRAFT HIM/ }));
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    // Still one page. Nothing was replaced, nothing was linked away to.
    expect(screen.getByRole('heading', { name: 'Deal him in.' })).toBeInTheDocument();
    expect(screen.getByTestId('draft-input')).toBeInTheDocument();
  });

  it('and puts the cursor in the composer', async () => {
    vi.useFakeTimers();
    try {
      let container;
      await act(async () => { ({ container } = render(<GuestLanding />)); });
      const button = screen.getByRole('button', { name: /DRAFT HIM/ });
      await act(async () => { button.click(); });
      // The focus is deliberately deferred: focusing before the scroll has
      // been asked for makes some browsers jump and cancel the smooth scroll.
      await act(async () => { vi.advanceTimersByTime(400); });
      expect(document.activeElement).toBe(container.querySelector('[data-testid="draft-input"]'));
    } finally {
      vi.useRealTimers();
    }
  });
});
