import { act, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { TheFloor } from './TheFloor.jsx';
import { felt } from '../../test/fixtures/rooms.js';

afterEach(() => vi.useRealTimers());
it('SHOW-2: public cards arrive individually; real chip pushes do not replay on unrelated updates', () => {
  const f = felt();
  const { container, rerender } = render(<TheFloor felts={[f]} />);
  const cards = container.querySelectorAll('[data-floor-card]');
  expect(cards).toHaveLength(3);
  expect(container.querySelectorAll('.csn-felt58__backs')).toHaveLength(3);
  const action = { seq:1, handNumber:12, seat:3, type:'bet', chips:80 };
  rerender(<TheFloor felts={[{ ...f, board:[...f.board, '2h'], lastAction:action }]} />);
  expect(container.querySelectorAll('[data-floor-card]')).toHaveLength(4);
  expect(container.querySelector('[data-floor-card]')).toBe(cards[0]);
  const push = container.querySelector('[data-floor-push]');
  expect(push).not.toBeNull();
  expect(push.dataset.floorPush).toBe('3');
  rerender(<TheFloor felts={[{ ...f, lastAction:action, pot:900 }]} />);
  expect(container.querySelector('[data-floor-push]')).toBe(push);
  rerender(<TheFloor felts={[{ ...f, handNumber:13, board:[] }]} />);
  expect(container.querySelectorAll('[data-floor-card]')).toHaveLength(0);
  expect(container.querySelector('[data-floor-push]')).toBeNull();
});

it('SHOW-2: a public bubble expires even if the floor receives no more snapshots', () => {
  vi.useFakeTimers();
  const now = Date.now();
  const f = felt({ recentChat:{ seq:1, seat:1, text:'Your move.', timestamp:now, expiresAt:now+4000 } });
  const { container } = render(<TheFloor felts={[f]} />);
  expect(container.querySelector('.csn-felt58__bubble')).toHaveTextContent('Your move.');
  act(() => vi.advanceTimersByTime(4001));
  expect(container.querySelector('.csn-felt58__bubble')).toBeNull();
});
