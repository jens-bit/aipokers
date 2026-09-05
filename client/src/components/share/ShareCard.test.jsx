// SHARE-1 — the card on screen.
//
// The preview is what someone agrees to post, so the assertions are on what is
// legible in it: his name, his cards, the board, what it came to, his line, the
// mark — and nothing that asks the reader to sign up.

import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ShareCard } from './ShareCard.jsx';
import { buildShareModel } from './shareModel.js';
import { badBeatHand, bigBluffHand } from '../../test/fixtures/flagged.js';

const model = (hand = badBeatHand, who = { agentName: 'Aggressive v1.3', mood: 'tilted' }) =>
  buildShareModel(hand, who);

const renderCard = (m = model(), props = {}) => render(<ShareCard model={m} {...props} />);

// A card face renders its rank as text; nothing else on the card is a bare rank.
function faceUpRanks(scope) {
  return [...scope.querySelectorAll('div')]
    .map((el) => (el.children.length === 0 ? el.textContent.trim() : ''))
    .filter((t) => /^(10|[2-9]|[AKQJ])$/.test(t));
}

describe('ShareCard', () => {
  it('names him and says why this hand', () => {
    renderCard();
    expect(screen.getByText('Aggressive v1.3')).toBeInTheDocument();
    expect(screen.getByText('BAD BEAT')).toBeInTheDocument();
  });

  it('gives him a face in his mood', () => {
    const { container } = renderCard();
    // MoodGhost is the only svg on the card besides the suit marks.
    const ghost = container.querySelector('svg[viewBox="0 0 80 80"]');
    expect(ghost).toBeInTheDocument();
    // tilted — the eyes and the aura are red.
    expect(ghost.innerHTML).toContain('#FF4D4F');
  });

  it('shows his two cards and the board that beat them', () => {
    const { container } = renderCard();
    expect(faceUpRanks(container)).toEqual(['A', 'A', '2', '7', 'K', '4', '9']);
  });

  it('reads the result as one line, with the amount in the colour it went', () => {
    renderCard();
    const amount = screen.getByText('−$1,840');
    expect(amount).toHaveStyle({ color: '#FF4D4F' });
    expect(amount.parentElement.textContent).toBe('−$1,840 · pair of aces');

    renderCard(model(bigBluffHand));
    expect(screen.getByText('+$620')).toHaveStyle({ color: '#00D4AA' });
  });

  it('quotes one line of his table talk', () => {
    renderCard();
    expect(screen.getByText('“He got there. I called anyway and I should not have.”')).toBeInTheDocument();
  });

  it('says nothing where he said nothing', () => {
    const quiet = model({ ...badBeatHand, streets: [{ street: 'flop', board: ['2s', '7h', 'Kd'], action: 'bet 10' }] });
    const { container } = renderCard(quiet);
    expect(container.textContent).not.toContain('“');
  });

  it('carries the mark and the hand, and asks for nothing', () => {
    const { container } = renderCard();
    expect(screen.getByText('agenticpoker.app')).toBeInTheDocument();
    expect(screen.getByText('HAND #37')).toBeInTheDocument();
    // The ref is explicit: no invite code, no referral link, no "get your own
    // agent", no QR. A card that asks for a signup is an ad.
    const words = container.textContent.toLowerCase();
    for (const ad of ['invite', 'referral', 'sign up', 'get your own', 'download']) {
      expect(words).not.toContain(ad);
    }
  });

  it('scales as one composition, so the preview and the export are the same card', () => {
    const { container } = renderCard(model(), { size: 720 });
    const card = container.querySelector('.share-card');
    expect(card).toHaveStyle({ width: '720px', height: '720px' });
    // Everything inside is derived from the size: at 2× the ghost is 152.
    expect(container.querySelector('svg[viewBox="0 0 80 80"]')).toHaveAttribute('width', '152');
  });
});
