// client/src/screens/draftFlow.test.jsx — F-1
//
// Wave 34, finding 1: after tapping a suggestion chip the recruiter said
// "Let's go" and the screen offered nothing to press, the profile strip showed
// four dashes, and the temperament chip disagreed with both.
//
// PACE-1d put all three answers on one reply — `ready`, `profile` (all four
// dials or none) and `natureHint` (computed from those same dials). The screen
// had been reading none of them. These tests pin that it now does, and that the
// rule the wave adds holds: one primary action, naming the next screen, with
// talking demoted rather than removed.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

// Exactly what the server sends on a chip turn (draftGuard.draftProfile).
const READY_TURN = {
  chat: [
    { role: 'user', content: 'Aggressive bluffer' },
    { role: 'assistant', content: 'Understood. Wide opens, three barrels, and he will get caught sometimes.' },
  ],
  profile: { tightness: 34, aggression: 82, bluffFreq: 78, discipline: 41 },
  natureHint: 'Hothead',
  ready: true,
};

const VAGUE_TURN = {
  chat: [
    { role: 'user', content: 'someone fun' },
    { role: 'assistant', content: 'Fun how — reckless, or tricky?' },
  ],
  profile: null,
  natureHint: null,
  ready: false,
};

const dealHimIn = () => screen.queryByRole('button', { name: /deal him in/i });
const composer = () => screen.queryByPlaceholderText(/describe/i) ?? screen.queryByRole('textbox');

async function tapChip() {
  const chip = await screen.findByRole('button', { name: /aggressive bluffer/i });
  await userEvent.click(chip);
}

describe('F-1: the draft offers something to press', () => {
  beforeEach(() => {
    telegram.signIn();
    // Routes are matched newest-first, so the broad one is registered first or
    // it would shadow /api/agents/chat.
    fetchMock.route('/api/agents', { agents: [] });
    fetchMock.route('/api/agents/chat', READY_TURN, { method: 'POST' });
  });

  it('gives the composer place to one primary action once the brief is usable', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    expect(dealHimIn()).toBeNull();

    await tapChip();

    await waitFor(() => expect(dealHimIn()).toBeInTheDocument());
    expect(composer()).toBeNull();
  });

  it('names the next screen and says why it is offered', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await tapChip();

    await waitFor(() => expect(dealHimIn()).toBeInTheDocument());
    expect(screen.getByText(/STRATEGY SET · NATURE FORMED/)).toBeInTheDocument();
  });

  it('demotes talking to a link rather than removing it', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await tapChip();

    const link = await screen.findByRole('button', { name: /keep describing him/i });
    await userEvent.click(link);

    await waitFor(() => expect(composer()).toBeInTheDocument());
    expect(dealHimIn()).toBeNull();
  });

  it('sends the go signal the server actually accepts', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await tapChip();
    await userEvent.click(await screen.findByRole('button', { name: /deal him in/i }));

    await waitFor(() => {
      const posts = fetchMock.calls.filter((c) => c.url.includes('/api/agents/chat') && c.method === 'POST');
      // isGoSignal() accepts "let's go"; "deal him in" is the label, not the wire word.
      expect(posts.some((c) => /let'?s go/i.test(c.body?.content ?? ''))).toBe(true);
    });
  });

  it('stays a composer while the brief is still vague', async () => {
    fetchMock.route('/api/agents/chat', VAGUE_TURN, { method: 'POST' });
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await tapChip();

    await waitFor(() => expect(screen.getByText(/Fun how/)).toBeInTheDocument());
    expect(dealHimIn()).toBeNull();
    expect(composer()).toBeInTheDocument();
  });
});

// ── RETIRED AT DRAFT-2 ──────────────────────────────────────────────────
//
// Two suites stood here — "the strip fills the moment a chip is tapped" (six
// assertions on TIGHT / AGGR / BLUFF / DISC and the dashes they replace) and
// "the temperament stops being a guess" (the formed chip, its zero-sum pair,
// the dashed 'Rock?' and the neutral 'Temperament?').
//
// They are not deleted for being red. They were green. They encode a rule the
// product no longer wants: that the draft screen SHOWS you the four dials and
// the temperament they produce. Board 29's sheet does not, and the reason is
// the ref's density — the draft's whole claim is that you make him by TALKING
// to him, and a readout of four numbers over that conversation answers in the
// one register the screen does not use. What the dials said, the recruiter
// already says back to you in words; where the temperament lands is the pill
// under the ghost ("GRANITE · A ROCK"), which draftGlass.test.jsx pins.
//
// The WIRE those suites were really defending is untouched and still tested:
// `profile`, `natureHint` and `ready` all still arrive on one reply
// (src/server/draftGuard.test.js), the sub-line under the gold button still
// reads them ("names the next screen and says why it is offered", above), and
// the desktop rail panel still draws both (DraftPanel.test.jsx). Nothing was
// loosened to get to green; two screens' worth of assertions were removed
// because the screen they described is gone.
