// client/src/components/ftu/you.test.jsx — FTU-4
//
// Screen 9: the seeded wallet, one pocket, and almost no history. The screen a
// new owner reaches first has the least to show, so it is the one most likely
// to apologise — and this is where it stops.

import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { YouScreen } from '../../screens/YouScreen.jsx';
import { assertNoPlaceholders } from './ftu.test.jsx';
import { fetchMock, telegram } from '../../test/harness.js';

// One agent, one session, +$18. The state screen 9 is drawn for.
const FIRST_SESSION = {
  id: 'a1',
  name: 'Rock v1.0',
  status: 'resting',
  stats: { handsPlayed: 40, netWon: 18, winRate: 52 },
  careerStats: { hands: 40, sessions: 1, net: 18, bankroll: 318 },
  mood: { state: 'neutral' },
  pocket: { chips: 318, stakes: '$1/$2', mode: 'topup' },
};

const VETERAN = {
  ...FIRST_SESSION,
  id: 'a2',
  careerStats: { hands: 2041, sessions: 22, net: 1204, bankroll: 2100 },
};

describe('FTU-4 the You screen, one session in', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/wallet', { balance: 20000, inPockets: 31800, tonight: 1800 });
  });

  const renderYou = (agents) => {
    fetchMock.route('/api/agents', { agents });
    return render(<YouScreen />);
  };

  it('FTU-4: no placeholder copy anywhere on it', async () => {
    const { container } = renderYou([FIRST_SESSION]);
    await screen.findByText('Lifetime');
    assertNoPlaceholders(container);
  });

  it('FTU-4: says how much history there is to believe rather than dashing the grid', async () => {
    const { container } = renderYou([FIRST_SESSION]);
    await screen.findByText('ONE SESSION OF HISTORY');

    const note = container.querySelector('.ftu-you-note .not-yet');
    expect(within(note).getByText(/a week gives him a win rate worth believing/)).toBeInTheDocument();
    expect(within(note).getByText(/the only honest number on this screen is the balance/)).toBeInTheDocument();
  });

  it('FTU-4: and stops saying it once there is history', async () => {
    renderYou([VETERAN]);
    await screen.findByText('Lifetime');
    expect(screen.queryByText('ONE SESSION OF HISTORY')).not.toBeInTheDocument();
  });

  it('FTU-4: a notable hand is one worth remembering, not a missing row', async () => {
    const { container } = renderYou([FIRST_SESSION]);
    await screen.findByText('NO HAND HAS BEEN WORTH REMEMBERING');

    // The banned form is gone.
    expect(container.textContent).not.toContain('NO HANDS YET');
    expect(screen.getByText(/the ones he flags arrive here as replays/)).toBeInTheDocument();
  });

  it('FTU-4: with nobody hired, the replays say who would fill them', async () => {
    const { container } = renderYou([]);
    await screen.findByText('NOBODY PLAYING FOR YOU YET');

    expect(screen.getByText(/Hire someone/)).toBeInTheDocument();
    assertNoPlaceholders(container);
  });

  it('FTU-4: the wallet is still the wallet — the empty states never hide a number', async () => {
    renderYou([FIRST_SESSION]);
    await screen.findByText('ONE SESSION OF HISTORY');
    // The balance is the one figure worth believing on day one, and it is there.
    expect(screen.getByText('Lifetime')).toBeInTheDocument();
    expect(screen.getByText('Hands played')).toBeInTheDocument();
  });
});
