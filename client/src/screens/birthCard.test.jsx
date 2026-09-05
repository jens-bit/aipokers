// client/src/screens/birthCard.test.jsx — F-2
//
// Wave 34, finding 2: the birth card led with six attribute bars, and READS /
// FOCUS / DISCIPLINE mean nothing to someone who has owned an agent for four
// seconds. The card is now about HIM — name, nature, his first words, one line
// of what he is built for — and the sheet lives behind a fold that says so.
//
// Finding 3, the half this slice owns: the forming ghost floated over the chat
// and was then covered by the card. He now has a place, and there is exactly
// one ghost on screen at any moment.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const BORN = {
  id: 'a_new', name: 'Hothead v1.0', strategy: 'Wide opens, three barrels.',
  status: 'idle', presence: 'resting', activeTableId: null,
  firstWords: "Aggressive, you said. Good. I'll bluff too much and I'll enjoy it.",
  nature: {
    name: 'Hothead', up: 'DECEPTION', down: 'COMPOSURE',
    line: 'He plays angry and it works more often than it should.',
    builtFor: 'Making people fold. He is very hard to read and he knows it.',
    struggle: 'Keeping his head after a beat.',
  },
  attrs: { READS: 33, FOCUS: 38, DISCIPLINE: 31, COMPOSURE: 24, DECEPTION: 47, STAMINA: 36 },
  potential: {
    READS: { lo: 54, hi: 78 }, FOCUS: { lo: 62, hi: 88 }, DISCIPLINE: { lo: 52, hi: 74 },
    COMPOSURE: { lo: 41, hi: 62 }, DECEPTION: { lo: 76, hi: 96 }, STAMINA: { lo: 60, hi: 82 },
  },
  attrLog: [],
  careerStats: { hands: 0, sessions: 0, net: null, biggestPot: 0, winRate: null },
};

const BUILT_TURN = {
  chat: [
    { role: 'user', content: 'Aggressive bluffer' },
    { role: 'assistant', content: 'Done. Here he is.' },
  ],
  ready: true,
  profile: { tightness: 34, aggression: 82, bluffFreq: 78, discipline: 41 },
  natureHint: 'Hothead',
  agentId: BORN.id,
  agentName: BORN.name,
  strategy: BORN.strategy,
};

// Drive the draft all the way to the card: chip -> Deal him in -> reveal -> card.
async function reachCard(roster = [BORN]) {
  fetchMock.route('/api/agents', { agents: roster });
  fetchMock.route('/api/agents/chat', BUILT_TURN, { method: 'POST' });

  const onBirth = vi.fn();
  render(<BirthScreen onBack={() => {}} onBirth={onBirth} />);
  await userEvent.click(await screen.findByRole('button', { name: /aggressive bluffer/i }));

  // His name shows in the draft band's cause line as well as on the card, so
  // the wait is for any of them; the card assertions scope to the card.
  await waitFor(() => expect(screen.getAllByText(BORN.name).length).toBeGreaterThan(0));
  vi.advanceTimersByTime(2500);
  await waitFor(() => expect(screen.getByRole('button', { name: /deal him in/i })).toBeInTheDocument());
  return { onBirth };
}

describe('F-2: the birth card is about him', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    telegram.signIn();
  });

  it('leads with his name, his nature and his first words', async () => {
    await reachCard();

    expect(document.querySelector('.birth-card3__name')).toHaveTextContent(BORN.name);
    expect(screen.getByText('Hothead')).toBeInTheDocument();
    expect(screen.getByText(new RegExp("I'll bluff too much"))).toBeInTheDocument();
  });

  it('gives one line of what he is built for', async () => {
    await reachCard();

    expect(screen.getByText('BUILT FOR')).toBeInTheDocument();
    expect(screen.getByText(/Making people fold/)).toBeInTheDocument();
  });

  it('leaves the struggle half off this screen — it owes him a welcome', async () => {
    await reachCard();
    expect(screen.queryByText(/Keeping his head after a beat/)).toBeNull();
  });

  it('keeps the six bars behind a closed fold', async () => {
    await reachCard();

    expect(screen.getByRole('button', { name: /his sheet/i })).toHaveAttribute('aria-expanded', 'false');
    for (const k of ['READS', 'FOCUS', 'DISCIPLINE']) {
      expect(screen.queryByText(k)).toBeNull();
    }
  });

  it('opens the sheet only when the owner asks for the numbers', async () => {
    await reachCard();
    await userEvent.click(screen.getByRole('button', { name: /his sheet/i }));

    await waitFor(() => expect(screen.getByText('READS')).toBeInTheDocument());
    for (const k of ['FOCUS', 'DISCIPLINE', 'COMPOSURE', 'DECEPTION', 'STAMINA']) {
      expect(screen.getByText(k)).toBeInTheDocument();
    }
  });

  it('tells a first-time owner the numbers can wait', async () => {
    await reachCard();
    expect(screen.getByText(/YOU CAN READ THE NUMBERS LATER/)).toBeInTheDocument();
  });

  it('drops that line once the fold is open — it has been answered', async () => {
    await reachCard();
    await userEvent.click(screen.getByRole('button', { name: /his sheet/i }));

    await waitFor(() => expect(screen.queryByText(/YOU CAN READ THE NUMBERS LATER/)).toBeNull());
  });

  it('says nothing about first agents when he is not one', async () => {
    await reachCard([BORN, { ...BORN, id: 'older', name: 'Rock v1.0' }]);
    expect(screen.queryByText(/YOU CAN READ THE NUMBERS LATER/)).toBeNull();
  });

  it('offers no way to buy or re-roll any of it', async () => {
    await reachCard();
    await userEvent.click(screen.getByRole('button', { name: /his sheet/i }));

    await waitFor(() => expect(screen.getByText('READS')).toBeInTheDocument());
    expect(screen.queryByText(/buy|purchase|upgrade|re-?roll|spend/i)).toBeNull();
    expect(screen.getByText(/Nothing here is bought/)).toBeInTheDocument();
  });

  it('deals him in, naming the next screen', async () => {
    const { onBirth } = await reachCard();
    await userEvent.click(screen.getByRole('button', { name: /deal him in/i }));

    expect(onBirth).toHaveBeenCalledWith(expect.objectContaining({ id: BORN.id, name: BORN.name }));
  });
});

describe('F-2: exactly one ghost on screen', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    telegram.signIn();
  });

  it('the card carries his place, and the reveal ghost stands down', async () => {
    await reachCard();

    // MoodGhost and FormingGhost each render one <svg> per ghost; the card's
    // well is the only one left once the card is up.
    const wells = document.querySelectorAll('.birth-card3__well');
    expect(wells).toHaveLength(1);
  });
});
