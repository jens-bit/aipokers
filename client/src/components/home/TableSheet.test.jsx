import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { TableSheet } from './TableSheet.jsx';

it('BUG-154: a full agent roster does not consume the human chair at a three-player game', async () => {
  const sit = vi.fn(), watch = vi.fn();
  render(<TableSheet slots={{ cap: 4, used: 4, next: null }} seated={3} maxSeats={4} onSit={sit} onWatch={watch} />);
  expect(screen.getByTestId('home-table-seated')).toHaveTextContent('3 at the table · 1 chair free');
  expect(screen.getByTestId('home-table-full')).toHaveTextContent('Your roster has 4 of 4 agents. Retire an agent to create another.');
  expect(screen.queryByText(/Every chair is taken/)).toBeNull();
  await userEvent.click(screen.getByRole('button', { name: 'SIT DOWN' }));
  await userEvent.click(screen.getByRole('button', { name: 'WATCH' }));
  expect(sit).toHaveBeenCalledOnce();
  expect(watch).toHaveBeenCalledOnce();
});

it('BUG-154: unknown agent slots do not claim that the roster is full', () => {
  render(<TableSheet seated={2} maxSeats={4} onSit={() => {}} />);
  expect(screen.getByTestId('home-table-seated')).toHaveTextContent('2 at the table · 2 chairs free');
  expect(screen.queryByTestId('home-table-full')).toBeNull();
  expect(screen.queryByTestId('home-table-draft')).toBeNull();
  expect(screen.getByText('Reading agent slots…')).toBeInTheDocument();
});

it('BUG-154: the actual full kitchen keeps Watch but cannot offer another human seat', async () => {
  const sit = vi.fn(), watch = vi.fn();
  render(<TableSheet slots={{ cap: 4, used: 2, next: null }} seated={4} maxSeats={4} onSit={sit} onWatch={watch} />);
  expect(screen.getByTestId('home-table-seated')).toHaveTextContent('4 at the table · 0 chairs free');
  expect(screen.getByRole('button', { name: 'SIT DOWN' })).toBeDisabled();
  expect(screen.getByText('This game is full. Watch until a chair opens.')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'SIT DOWN' }));
  await userEvent.click(screen.getByRole('button', { name: 'WATCH' }));
  expect(sit).not.toHaveBeenCalled();
  expect(watch).toHaveBeenCalledOnce();
});

it('BUG-154: a legacy snapshot does not guess game capacity from agent slots', () => {
  render(<TableSheet slots={{ cap: 4, used: 4, next: null }} seated={2} onSit={() => {}} />);
  expect(screen.getByTestId('home-table-seated')).toHaveTextContent(/^2 at the table$/);
  expect(screen.getByRole('button', { name: 'SIT DOWN' })).toBeEnabled();
});
