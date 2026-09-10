import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeOne } from './atoms.jsx';
import { identityOf } from '../../lib/identity.js';

// The real visit regression pins this host-only public routine projection.
// Drawing a guest never grants his owner-only cards or changes his birth look.
const visitor = {
  id: 'visitor', name: 'Away Day', guest: true,
  location: { where: 'home' }, nature: 'Rock',
  routine: { key: 'plays', label: 'in the home game' },
  identity: { hood: 'indigo', glow: 'violet' },
  mood: { state: 'neutral', heat: 58 }, fatigue: 'fresh',
};

it.each(['Rock', 'Professor', 'Grinder'])('BUG-175: a seated %s visitor shows only the real playing pose', nature => {
  const agent = { ...visitor, nature };
  const { container } = render(<HomeOne agent={agent} identity={identityOf(agent)}
    at={{ x: 280, y: 290, seat: 1, spot: 'table:1' }} dealt />);
  const body = screen.getByRole('button', { name: 'Away Day — in a hand' });
  expect(body).toHaveAttribute('data-routine', 'plays');
  expect(body).toHaveAttribute('data-spot', 'table:1');
  expect(body.querySelectorAll('.home-one__cards > div')).toHaveLength(2);
  expect(body.querySelector('.home-prop')).toBeNull();
  expect(body.querySelector('.home-one__hands [data-pose]')).toHaveAttribute('data-pose', 'hold');
  expect(body.querySelector('.mood-ghost')).toHaveAttribute('data-hood', 'indigo');
  expect(body.querySelector('stop[stop-color="#8B6BC4"]')).not.toBeNull();
  expect(body.querySelector('[data-bar="stamina"] i').style.width).toBe('100%');
  expect(body.querySelector('[data-bar="heat"] i').style.width).toBe('58%');
  expect(screen.getByTestId('home-pill-guest')).toHaveTextContent('GUEST');
  expect(container.querySelector('.home-one__cards').textContent).toBe('');
});

it('BUG-175: a guest who is actually reading keeps the paper and has no dealt cards', () => {
  const agent = { ...visitor, routine: { key: 'reads', label: 'reading' } };
  const { container } = render(<HomeOne agent={agent} identity={identityOf(agent)} at={{ x: 170, y: 410 }} />);
  expect(screen.getByRole('button', { name: 'Away Day — reading' })).toHaveAttribute('data-routine', 'reads');
  expect(container.querySelector('.home-prop--paper')).not.toBeNull();
  expect(container.querySelector('.home-one__cards')).toBeNull();
});

