// client/src/components/replay/ReplayCard.test.jsx — R-3
//
// "A poster, not a link: the flag, the board, the pot, and one line."
// And the way into the theatre from the flagged sheet.

import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ReplayCard } from './ReplayCard.jsx';
import { FlaggedHandsSheet } from '../floor/FlaggedHandsSheet.jsx';
import { badBeatHand, bigBluffHand, flaggedResponse } from '../../test/fixtures/flagged.js';
import { fetchMock, telegram } from '../../test/harness.js';

describe('R-3 the replay card', () => {
  it('R-3: is a poster — flag, board, pot and one line', () => {
    const { container } = render(<ReplayCard hand={bigBluffHand} onOpen={() => {}} />);

    expect(screen.getByText('BIG BLUFF')).toBeInTheDocument();
    // Five board slots, and the rope at where the hand ended.
    expect(container.querySelectorAll('.replay-card__board > *')).toHaveLength(5);
    expect(container.querySelector('.tug')).toBeTruthy();
    expect(container.querySelector('.replay-card__pot').textContent.replace(/[\s,  ]/g, ''))
      .toBe('+$620');
    // His own last line, never composed.
    expect(screen.getByText(/the board says I have it/)).toBeInTheDocument();
  });

  it('R-3: a hand he lost reads as one', () => {
    const { container } = render(<ReplayCard hand={badBeatHand} onOpen={() => {}} />);
    expect(screen.getByText('BAD BEAT')).toBeInTheDocument();
    const pot = container.querySelector('.replay-card__pot');
    expect(pot.className).toContain('is-lost');
    expect(pot.textContent.startsWith('−')).toBe(true);
  });

  it('R-3: is one control, and it opens the theatre', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    render(<ReplayCard hand={bigBluffHand} onOpen={onOpen} />);

    await user.click(screen.getByRole('button', { name: /replay big bluff/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it('R-3: a hand with no lines still posters', () => {
    const bare = { ...bigBluffHand, streets: bigBluffHand.streets.map((s) => ({ ...s, reasoning: null })) };
    const { container } = render(<ReplayCard hand={bare} onOpen={() => {}} />);
    expect(container.querySelector('.replay-card__line')).toBeNull();
    expect(screen.getByText('BIG BLUFF')).toBeInTheDocument();
  });
});

describe('R-3 entry from the flagged sheet', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents/a1/flagged', flaggedResponse);
  });

  const renderSheet = () =>
    render(<FlaggedHandsSheet agent={{ id: 'a1', name: 'Bluff Master' }} onBack={() => {}} />);

  it('R-3: the list leads with a poster for the newest flagged hand', async () => {
    const { container } = renderSheet();
    await screen.findByText(/Hand #37/);
    const card = container.querySelector('.replay-card');
    expect(card).toBeTruthy();
    expect(within(card).getByText('BAD BEAT')).toBeInTheDocument();
  });

  it('R-3: tapping the poster opens the theatre', async () => {
    const user = userEvent.setup();
    const { container } = renderSheet();
    await screen.findByText(/Hand #37/);

    await user.click(container.querySelector('.replay-card'));
    expect(container.querySelector('.replay-theatre')).toBeTruthy();
    // And it is Watch v3's felt in there, not a second one.
    expect(container.querySelector('.watch-felt')).toBeTruthy();
    expect(container.querySelector('.replay-scrub')).toBeTruthy();
  });

  it('R-3: the review offers a way to watch it', async () => {
    const user = userEvent.setup();
    const { container } = renderSheet();
    await user.click(await screen.findByText(/88% equity favorite/));

    await user.click(screen.getByRole('button', { name: 'Watch it' }));
    expect(container.querySelector('.replay-theatre')).toBeTruthy();
  });

  it('R-3: and Open hand takes you from the theatre back to the transcript', async () => {
    const user = userEvent.setup();
    const { container } = renderSheet();
    await screen.findByText(/Hand #37/);

    await user.click(container.querySelector('.replay-card'));
    await user.click(screen.getByRole('button', { name: 'Open hand' }));

    expect(container.querySelector('.replay-theatre')).toBeNull();
    // The hand review, with its street rows.
    expect(container.querySelector('.watch-felt')).toBeNull();
    expect(screen.getByText(/Aces\. Building the pot/)).toBeInTheDocument();
  });

  it('R-3: leaving the theatre goes back to the list, not out of the sheet', async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    const { container } = render(
      <FlaggedHandsSheet agent={{ id: 'a1', name: 'Bluff Master' }} onBack={onBack} />,
    );
    await screen.findByText(/Hand #37/);

    await user.click(container.querySelector('.replay-card'));
    await user.click(screen.getByRole('button', { name: 'Back' }));

    expect(container.querySelector('.replay-theatre')).toBeNull();
    expect(container.querySelector('.replay-card')).toBeTruthy();
    expect(onBack).not.toHaveBeenCalled();
  });
});
