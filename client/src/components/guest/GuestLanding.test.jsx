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
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StrictMode } from 'react';

import { GuestLanding } from './GuestLanding.jsx';
import { fetchMock, telegram } from '../../test/harness.js';
import { _resetForTests } from '../../lib/guest.js';
import { pendingVisitorName, rememberPendingVisitor, clearPendingVisitor } from '../../lib/visit.js';
import { restingAgent } from '../../test/fixtures/agents.js';

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
    expect(screen.getByText('RAILBIRD')).toBeInTheDocument();
  });

  it('SHOW-1: the static poster becomes a hand already playing', async () => {
    const { container } = await openLanding();
    expect(screen.getByRole('region', { name: 'Demonstration poker table' })).toHaveAttribute('data-street', 'flop');
    expect(container.querySelectorAll('[data-seat]')).toHaveLength(2);
    expect(container.querySelectorAll('[data-board-card]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-opponent-card="back"]')).toHaveLength(2);
  });
});

// ── The room ────────────────────────────────────────────────────────────────

describe('GUEST-1 · and the room, directly under it', () => {
  it('BUG-52: is the real room with the real recruiter, mounted on the same page', async () => {
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

  it('FIRST-RUN-1: Go home aligns the mounted room once after birth, then leaves ordinary reading alone', async () => {
    const user = userEvent.setup();
    const newborn = { ...restingAgent, id: 'guest-newborn', name: 'Pebble', nature: { name: 'Rock', line: 'He waits.' }, firstWords: 'Ready when you are.' };
    const ready = { draftId: 'guest-ready', draftStep: 'ready', draftName: newborn.name, ready: true, chat: [] };
    let born = false;
    fetchMock.route('/api/agents?', () => ({ agents: born ? [newborn] : [] }));
    fetchMock.route('/api/agents/draft', ready, { method: 'POST' });
    fetchMock.route('/api/agents/chat', () => {
      born = true;
      return { ...ready, draftStep: 'created', agentId: newborn.id, agentName: newborn.name, createdAgent: newborn, firstAgent: true };
    }, { method: 'POST' });
    const view = render(<StrictMode><GuestLanding showDetails /></StrictMode>);
    const room = view.container.querySelector('.guest-landing__room');
    const arrivals = [];
    room.scrollIntoView = vi.fn(function (options) {
      // This is a navigation request after Home commits, not a scroll of the
      // disappearing birth card or a guide target. Browser tests own geometry.
      arrivals.push({ options, home: this.querySelector('[data-testid="home-screen"]'), draft: this.querySelector('[data-testid="draft-screen"]') });
    });
    const deal = await screen.findByRole('button', { name: 'Deal him in', exact: true });
    await waitFor(() => expect(deal).toBeEnabled(), { timeout: 2500 });
    // Advance only the known nature-reveal delay; the request, card and
    // acknowledgment still use the actual production components.
    vi.useFakeTimers();
    try {
      fireEvent.click(deal);
      await act(async () => {});
      await act(async () => { await vi.advanceTimersByTimeAsync(2200); });
    } finally { vi.useRealTimers(); }
    const goHome = screen.getByRole('button', { name: 'Go home', exact: true });
    expect(room.scrollIntoView).not.toHaveBeenCalled();
    await user.click(goHome);
    const home = await screen.findByTestId('home-screen');
    expect(room.scrollIntoView).toHaveBeenCalledOnce();
    expect(arrivals).toEqual([{ options: { behavior: 'instant', block: 'start' }, home, draft: null }]);
    expect(view.container.querySelector('.guest-landing__room')).toBe(room);
    expect(screen.getByRole('heading', { name: 'Thirty seconds of conversation, and he exists.' })).toBeInTheDocument();

    // Scrolling marketing copy, updating the landing and opening/closing a
    // normal Home sheet must not take the reader back to the anchor again.
    fireEvent.scroll(window);
    view.rerender(<StrictMode><GuestLanding showDetails ctaNote="Free · play money only" /></StrictMode>);
    await user.click(within(home).getByRole('button', { name: 'Your agents', exact: true }));
    const roster = await screen.findByTestId('roster-sheet');
    await user.click(within(roster.querySelector('.roster__head')).getByRole('button', { name: 'Close', exact: true }));
    expect(room.scrollIntoView).toHaveBeenCalledOnce();
    expect(fetchMock.requestsMatching('/api/agents/chat')).toHaveLength(1);
  });

  it('BUG-101: waits for a long page scroll to end before focusing the recruiter', async () => {
    const { container } = await openLanding();
    const room = container.querySelector('.guest-landing__room');
    const roomBounds = vi.spyOn(room, 'getBoundingClientRect').mockReturnValue({ top: 800 });
    await userEvent.click(screen.getByRole('button', { name: /DRAFT HIM/ }));
    expect(screen.getByTestId('draft-input')).not.toHaveFocus();
    roomBounds.mockReturnValue({ top: 0 });
    await act(async () => { window.dispatchEvent(new Event('scrollend')); });
    expect(screen.getByTestId('draft-input')).toHaveFocus();
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

// ── VISIT-1 job 6 · a knock changes the promise ─────────────────────────────

describe('VISIT-1 job 6 · someone at the door', () => {
  beforeEach(() => { clearPendingVisitor(); });

  it('the hero names him and the door draws a body outside it', async () => {
    await act(async () => { render(<GuestLanding visitorName="Away Day" />); });
    expect(screen.getByRole('heading', { name: 'Away Day is at your door.' })).toBeInTheDocument();
    expect(screen.getByText(/Away Day wants to sit down/)).toBeInTheDocument();
    expect(screen.getByTestId('guest-hero-visitor')).toHaveTextContent('Away Day');
  });

  it('with no visitor at all, the ordinary hero is untouched', async () => {
    await act(async () => { render(<GuestLanding />); });
    expect(screen.getByRole('heading', { name: 'Deal him in.' })).toBeInTheDocument();
    expect(screen.queryByTestId('guest-hero-visitor')).toBeNull();
  });

  it("the recruiter's own first line is about letting him in", async () => {
    // main.jsx's own handoff, ahead of the mount — see lib/visit.js.
    rememberPendingVisitor('Away Day');
    await act(async () => { render(<GuestLanding visitorName="Away Day" />); });
    expect(await screen.findByText(/Away Day is waiting at the door/)).toBeInTheDocument();
    // Read once — a second draft elsewhere in the app must not inherit it.
    expect(pendingVisitorName()).toBeNull();
  });
});
