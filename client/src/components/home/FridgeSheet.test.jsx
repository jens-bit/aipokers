import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { FridgeSheet } from './FridgeSheet.jsx';
import { fetchMock, telegram } from '../../test/harness.js';
const fridge = { items: [{ id: 'beer', label: 'Beer', count: 0, price: 12 }, { id: 'snack', label: 'Snack', count: 2, price: 8 }] };
beforeEach(() => { telegram.signIn(); fetchMock.route('/api/fridge', fridge); });
it('HOME-CARE-1: the fridge explains the beer tradeoff before stocking', async () => {
  render(<FridgeSheet variant="rail" onClose={() => {}}/>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buy 6 beer' })).toBeEnabled());
  const care = screen.getByText(/A beer cools/);
  expect(care).toHaveTextContent('temporarily lowers discipline and makes bluffs more likely in his next casino session');
  expect(screen.getByTestId('fridge-shelf-snack')).toHaveTextContent('gentler cooling');
  expect(fetchMock.requestsMatching('/api/fridge/stock')).toHaveLength(0);
});
it('BUG-64: an empty fridge can be restocked from the safe, six at a time', async () => {
  fetchMock.route('/api/fridge/stock', { stocked: 'beer', qty: 6, spent: 72, fridge: { beer: 6, snack: 2 } });
  const onStocked = vi.fn();
  render(<FridgeSheet onClose={() => {}} onStocked={onStocked}/>);
  const shelf = await screen.findByTestId('fridge-shelf-beer');
  await waitFor(() => expect(shelf).toHaveTextContent('out'));
  expect(shelf).toHaveTextContent('$12 each');
  await userEvent.click(within(shelf).getByRole('button', { name: 'Buy 6 beer' }));
  expect(await within(shelf).findByText('× 6')).toBeInTheDocument();
  expect(fetchMock.requestsMatching('/api/fridge/stock')[0]).toMatchObject({ body: { userId: '4242', item: 'beer', qty: 6 } });
  expect(fetchMock.requestsMatching('/api/fridge/stock')[0].headers['X-Telegram-Init-Data']).toBeTruthy();
  expect(onStocked).toHaveBeenCalledOnce();
});
it('BUG-64: insufficient wallet leaves the stock unchanged and allows a retry', async () => {
  fetchMock.route('/api/fridge/stock', { status: 400, body: { error: 'wallet does not cover that', cost: 72, available: 20 } });
  render(<FridgeSheet onClose={() => {}}/>);
  const buy = await screen.findByRole('button', { name: 'Buy 6 beer' });
  await waitFor(() => expect(buy).toBeEnabled());
  await userEvent.click(buy);
  expect(await screen.findByRole('alert')).toHaveTextContent('wallet does not cover that');
  expect(screen.getByTestId('fridge-shelf-beer')).toHaveTextContent('out');
  expect(buy).toBeEnabled();
});
it('BUG-64: missing stock data is not shown as an empty fridge', async () => {
  fetchMock.route('/api/fridge', { status: 503, body: {} });
  render(<FridgeSheet onClose={() => {}}/>);
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not read');
  expect(screen.queryByText('out')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Buy 6 beer' })).toBeDisabled();
  fetchMock.route('/api/fridge', fridge);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buy 6 beer' })).toBeEnabled());
});
