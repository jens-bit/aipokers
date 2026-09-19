import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { seatSummary } from '../WatchScreen.jsx';
import { ReadSheet } from './ReadSheet.jsx';

const seats = [
  { displayName: 'Moss reader', stack: 1900, identity: { hood: 'moss', glow: 'gold' },
    mood: { state: 'neutral', heat: 20 }, holeCards: ['Ah', 'Ad'], reasoning: 'Private thought' },
  { displayName: 'Indigo reader', stack: 2100, identity: { hood: 'indigo', glow: 'ice' },
    mood: { state: 'tilted', heat: 80 }, holeCards: ['Ks', 'Kh'], reasoning: 'Another private thought' },
];

function portrait() {
  const ghost = screen.getByRole('dialog').querySelector('.mood-ghost');
  return {
    hood: ghost.getAttribute('data-hood'),
    cloth: [...ghost.querySelectorAll('linearGradient stop')].map(stop => stop.getAttribute('stop-color')),
    glow: ghost.querySelector('radialGradient stop').getAttribute('stop-color'),
  };
}

it('BUG-271: opponent inspection retains each public identity across seat and mood changes', () => {
  const game = { seats };
  const { rerender } = render(<ReadSheet seat={seatSummary(game, 0)} entry={null} onClose={() => {}} />);
  expect(portrait()).toEqual({ hood: 'moss', cloth: ['#2E4E37', '#182C20'], glow: '#C9A227' });
  rerender(<ReadSheet seat={seatSummary(game, 1)} entry={null} onClose={() => {}} />);
  expect(portrait()).toEqual({ hood: 'indigo', cloth: ['#4A2E78', '#281846'], glow: '#7FA8C9' });
  rerender(<ReadSheet seat={seatSummary({ seats: [{ ...seats[1], mood: { state: 'confident', heat: 10 } }] }, 0)} entry={null} onClose={() => {}} />);
  expect(portrait()).toEqual({ hood: 'indigo', cloth: ['#4A2E78', '#281846'], glow: '#7FA8C9' });
});

it('BUG-271: the inspection summary carries public appearance without private cards or reasoning', () => {
  expect(seatSummary({ seats }, 0)).toEqual({
    name: 'Moss reader', stack: '1,900', accent: '#00D4AA', mood: 'neutral', heat: 20,
    identity: { hood: 'moss', glow: 'gold' },
  });
});

it('BUG-271: a legacy anonymous opponent keeps the existing fallback portrait', () => {
  render(<ReadSheet seat={seatSummary({ seats: [{ displayName: 'Unknown', stack: 90 }] }, 0)} entry={null} onClose={() => {}} />);
  expect(portrait()).toEqual({ hood: null, cloth: ['#141A22', '#0A0F17'], glow: '#888888' });
  expect(screen.getByText('NO EVIDENCE YET')).toBeVisible();
});
