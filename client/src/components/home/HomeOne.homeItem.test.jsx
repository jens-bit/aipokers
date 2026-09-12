import { render, screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { HomeOne } from './atoms.jsx';

it('HOME-2: a beer appears only on the return trip and yields to the owner carry pose', () => {
  const agent = { id: 'bottle', name: 'Granite', routine: { key: 'counts' } };
  const props = { agent, at: { x: 284, y: 200 }, homeItem: { item: 'beer', phase: 'hold' } };
  const { container, rerender } = render(<HomeOne {...props} />);
  expect(screen.queryByTestId('home-item-beer')).toBeNull();
  expect(container.querySelector('.home-prop--chips')).toBeNull();
  rerender(<HomeOne {...props} homeItem={{ item: 'beer', phase: 'back' }} walking />);
  expect(screen.getByTestId('home-item-beer')).toBeInTheDocument();
  expect(screen.queryByTestId('home-item-snack')).toBeNull();
  rerender(<HomeOne {...props} homeItem={{ item: 'beer', phase: 'back' }} carried={{ x: 284, y: 200 }} />);
  expect(screen.queryByTestId('home-item-beer')).toBeNull();
});
