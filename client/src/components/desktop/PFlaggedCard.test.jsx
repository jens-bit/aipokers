// client/src/components/desktop/PFlaggedCard.test.jsx — ATTR-2e-4
//
// The flagged card is an owner-only surface: holeCards on
// GET /api/agents/:id/flagged are stripped for anyone who cannot prove
// ownership, so the request must carry the Telegram header. It also has to stay
// silent when there is nothing flagged rather than render an empty frame.

import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { PFlaggedCard } from './PFlaggedCard.jsx';
import { playingAgent, restingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, telegram } from '../../test/harness.js';

const FLAGGED = {
  flaggedHands: [
    { handNumber: 841, reason: 'Bluff-jammed river', holeCards: ['7c', '6c'], net: -340, stake: '$10/$20' },
    { handNumber: 838, reason: 'Folded TT to a 3-bet', holeCards: ['Ts', 'Td'], evLoss: 80, stake: '$5/$10' },
  ],
  count: 2,
};

describe('PFlaggedCard', () => {
  beforeEach(() => { telegram.signIn(); });

  it('stays silent when nothing is flagged', () => {
    const { container } = render(<PFlaggedCard agents={[restingAgent]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('reports the roster count the server gave it', async () => {
    fetchMock.route('/flagged', FLAGGED);
    render(<PFlaggedCard agents={[playingAgent]} />);

    // playingAgent.flaggedCount is 2 in the fixture.
    expect(await screen.findByText(/2 need review/i)).toBeInTheDocument();
  });

  it('sends the Telegram initData header — without it holeCards come back empty', async () => {
    fetchMock.route('/flagged', FLAGGED);
    render(<PFlaggedCard agents={[playingAgent]} />);

    await waitFor(() => {
      const call = fetchMock.calls.find((c) => c.url.includes('/flagged'));
      expect(call).toBeTruthy();
      expect(call.headers['x-telegram-init-data']).toBeTruthy();
    });
  });

  it('asks only for agents the roster already says have flagged hands', async () => {
    fetchMock.route('/flagged', FLAGGED);
    render(<PFlaggedCard agents={[playingAgent, restingAgent]} />);

    await waitFor(() => {
      const flaggedCalls = fetchMock.calls.filter((c) => c.url.includes('/flagged'));
      expect(flaggedCalls).toHaveLength(1);
      expect(flaggedCalls[0].url).toContain(playingAgent.id);
    });
  });

  it('lists what he misjudged, and hands the agent back when a row is opened', async () => {
    fetchMock.route('/flagged', FLAGGED);
    const onOpen = vi.fn();
    render(<PFlaggedCard agents={[playingAgent]} onOpen={onOpen} />);

    const row = await screen.findByText('Bluff-jammed river');
    row.closest('button').click();
    expect(onOpen).toHaveBeenCalledWith(playingAgent);
  });
});
