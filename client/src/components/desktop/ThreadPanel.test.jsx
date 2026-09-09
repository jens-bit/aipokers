// client/src/components/desktop/ThreadPanel.test.jsx — ATTR-2e-4
//
// The agent's name and "Player card" each appear twice on purpose — once in
// the panel head, once in the body or the tab strip — so the head assertions
// below pick the head element out rather than asserting a unique match.
//
// The thread panel is where the desktop keeps his voice, and where ATTR-2e-1
// put the player card. Three things worth pinning:
//   the draft is CONTROLLED from above, so switching agents cannot eat it;
//   the panel offers the player card only while a thread is open;
//   the card obeys the ceiling law — a band width, never a number on a bar.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThreadPanel } from './ThreadPanel.jsx';
import { playingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, telegram } from '../../test/harness.js';

// RAISE-2: the opening bubble is the agent's own line — served by the server,
// or his birth words, or this last-ditch sentence. It is only an anchor here:
// these cases are about layout and lifecycle, not about what he says.
const OPENER = /Sit down\. What do you want to know\?/;

function renderPanel(props = {}) {
  return render(
    <ThreadPanel
      agent={playingAgent}
      accentIndex={0}
      draft=""
      onDraftChange={() => {}}
      onClose={() => {}}
      {...props}
    />,
  );
}

describe('ThreadPanel', () => {
  it('C9 keeps the proposed changes reviewable before acceptance',async()=>{
    renderPanel({agent:{...playingAgent,profile:{aggression:60},proposal:{text:'I should press harder.',suggestedPatch:{profileDelta:{aggression:10}}}}});
    expect(await screen.findByText('Aggression: 60% → 70%')).toBeInTheDocument();
    expect(screen.getByRole('button',{name:'Accept change'})).toBeInTheDocument();
  });
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('opens on the thread, with the agent named in the head', async () => {
    renderPanel();
    const titles = await screen.findAllByText(playingAgent.name);
    expect(titles.some((el) => el.classList.contains('agent-view__name'))).toBe(true);
    expect(screen.getByTestId('agent-stage')).toBeInTheDocument();
  });

  it('seeds the thread from the hands endpoint, in his voice', async () => {
    renderPanel();
    expect((await screen.findAllByText(OPENER)).length).toBeGreaterThan(0);
  });

  it('renders the composer draft it is given rather than owning it', () => {
    renderPanel({ draft: 'half a thought' });
    expect(screen.getByRole('textbox')).toHaveValue('half a thought');
  });

  it('reports every keystroke up so the draft can outlive the panel', async () => {
    const onDraftChange = vi.fn();
    renderPanel({ onDraftChange });

    await userEvent.type(screen.getByRole('textbox'), 'x');
    expect(onDraftChange).toHaveBeenCalledWith('x');
  });

  it('closes on request', async () => {
    const onClose = vi.fn();
    renderPanel({ onClose });

    await userEvent.click(screen.getByRole('button', { name: /close panel/i }));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('ThreadPanel player card (ATTR-2e-1)', () => {
  it('BUG-83 keeps his saved identity when the desktop profile opens',async()=>{
    renderPanel({agent:{...playingAgent,identity:{hood:'sand',glow:'gold'}}});
    await userEvent.click(screen.getByRole('button',{name:'Profile',exact:true}));
    const ghost=document.querySelector('.dsk-pcard__ghost svg');
    expect(ghost.querySelector('stop[stop-color="#6E5836"]')).not.toBeNull();
    expect(ghost.outerHTML).toContain('#C9A227');
  });
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/hands', { recentHands: [] });
    fetchMock.route('/flagged', { flaggedHands: [] });
  });

  it('offers the player card beside the thread', async () => {
    renderPanel();
    expect(await screen.findByRole('button', { name: 'Profile', exact: true })).toBeInTheDocument();
  });

  it('swaps the panel head when the card is opened', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Profile', exact: true }));

    const titles = screen.getAllByText('Player card');
    expect(titles.some((el) => el.classList.contains('dsk-panel-head__title'))).toBe(true);
    expect(screen.getByText(playingAgent.name.toUpperCase())).toBeInTheDocument();
  });

  it('draws the six attributes in canon order', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Profile', exact: true }));

    for (const key of ['READS', 'FOCUS', 'DISCIPLINE', 'COMPOSURE', 'DECEPTION', 'STAMINA']) {
      expect(screen.getByText(key)).toBeInTheDocument();
    }
  });

  it('never prints the ceiling as a number on a bar', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Profile', exact: true }));

    // The band is a width. Its numbers only appear once a bar is tapped open.
    expect(screen.queryByText(/^\d+–\d+$/)).not.toBeInTheDocument();
  });

  it('prints the exact band only when a bar is tapped — the user asking for it', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Profile', exact: true }));
    await userEvent.click(screen.getByRole('button', { name: /^READS \d+$/ }));

    await waitFor(() => expect(screen.getByText(/^\d+–\d+$/)).toBeInTheDocument());
  });

  it('offers no way to buy or re-roll anything', async () => {
    renderPanel();
    await userEvent.click(await screen.findByRole('button', { name: 'Profile', exact: true }));

    expect(screen.queryByText(/buy|upgrade|purchase|re-roll|reroll|spend/i)).not.toBeInTheDocument();
  });
});
