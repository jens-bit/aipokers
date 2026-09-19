import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { FridgeSheet, STOCK } from './FridgeSheet.jsx';
import { fetchMock, telegram } from '../../test/harness.js';
const fridge = { items: [{ id: 'beer', label: 'Beer', count: 0, price: 12 }, { id: 'snack', label: 'Snack', count: 2, price: 8 }] };
const sentenceFor = (id) => STOCK.find(s => s.id === id).sentence;
beforeEach(() => { telegram.signIn(); fetchMock.route('/api/fridge', fridge); });

it('BUG-242: names each effect visibly and buys a single item at the quoted price', async () => {
  fetchMock.route('/api/fridge/stock', { stocked: 'beer', qty: 1, spent: 12, fridge: { beer: 1, snack: 2 } });
  render(<FridgeSheet onClose={() => {}}/>);
  const beer = screen.getByTestId('fridge-shelf-beer');
  const snack = screen.getByTestId('fridge-shelf-snack');
  expect(within(beer).getByText('Heat')).toBeVisible();
  expect(within(beer).getByText('Discipline')).toBeVisible();
  expect(within(snack).getByText('Stamina')).toBeVisible();
  const buy = within(beer).getByRole('button', { name: 'Buy 1 beer' });
  await waitFor(() => expect(buy).toBeEnabled());
  await userEvent.click(buy);
  expect(fetchMock.requestsMatching('/api/fridge/stock')[0].body).toEqual({ userId: '4242', item: 'beer', qty: 1 });
  expect(await screen.findByText('Bought 1 beer from the safe.')).toBeInTheDocument();
  expect(beer).toHaveTextContent('× 1');
});
// UI-3 job D replaces HOME-CARE-1's always-visible essay with arrows-only
// rows and a one-sentence explanation that only exists once the owner taps
// the item — this test is rewritten (not weakened: it asserts the essay is
// ABSENT by default, and present only on demand) to match that decision.
it('UI-3 job D: the fridge shows arrows, not an essay, until the item is tapped', async () => {
  render(<FridgeSheet variant="rail" onClose={() => {}}/>);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buy 1 beer' })).toBeEnabled());
  const beerShelf = screen.getByTestId('fridge-shelf-beer');
  const snackShelf = screen.getByTestId('fridge-shelf-snack');
  // No essay anywhere, until something is tapped.
  expect(screen.queryByText(sentenceFor('beer'))).not.toBeInTheDocument();
  expect(screen.queryByText(sentenceFor('snack'))).not.toBeInTheDocument();
  // One labelled arrow per real effect, in the scheme's colors.
  expect(within(beerShelf).getByLabelText('heat down')).toBeInTheDocument();
  expect(within(beerShelf).getByLabelText('discipline down')).toBeInTheDocument();
  expect(within(beerShelf).queryByLabelText('stamina up')).not.toBeInTheDocument();
  expect(within(snackShelf).getByLabelText('stamina up')).toBeInTheDocument();
  expect(within(snackShelf).getByLabelText('heat down')).toBeInTheDocument();
  expect(within(snackShelf).queryByLabelText(/discipline/)).not.toBeInTheDocument();
  // Tapping the beer item reveals its one sentence, and only its own.
  await userEvent.click(within(beerShelf).getByRole('button', { name: /^BEER:/ }));
  expect(within(beerShelf).getByText(sentenceFor('beer'))).toBeInTheDocument();
  expect(screen.queryByText(sentenceFor('snack'))).not.toBeInTheDocument();
  // Tapping it again closes it back up.
  await userEvent.click(within(beerShelf).getByRole('button', { name: /^BEER:/ }));
  expect(screen.queryByText(sentenceFor('beer'))).not.toBeInTheDocument();
  expect(fetchMock.requestsMatching('/api/fridge/stock')).toHaveLength(0);
});
it('BUG-64: an empty fridge can be restocked from the safe, one at a time', async () => {
  fetchMock.route('/api/fridge/stock', { stocked: 'beer', qty: 1, spent: 12, fridge: { beer: 1, snack: 2 } });
  const onStocked = vi.fn();
  render(<FridgeSheet onClose={() => {}} onStocked={onStocked}/>);
  const shelf = await screen.findByTestId('fridge-shelf-beer');
  await waitFor(() => expect(shelf).toHaveTextContent('out'));
  expect(shelf).toHaveTextContent('$12 each');
  await userEvent.click(within(shelf).getByRole('button', { name: 'Buy 1 beer' }));
  expect(await within(shelf).findByText('× 1')).toBeInTheDocument();
  expect(fetchMock.requestsMatching('/api/fridge/stock')[0]).toMatchObject({ body: { userId: '4242', item: 'beer', qty: 1 } });
  expect(fetchMock.requestsMatching('/api/fridge/stock')[0].headers['X-Telegram-Init-Data']).toBeTruthy();
  expect(onStocked).toHaveBeenCalledOnce();
});
it('BUG-64: insufficient wallet leaves the stock unchanged and allows a retry', async () => {
  fetchMock.route('/api/fridge/stock', { status: 400, body: { error: 'wallet does not cover that', cost: 72, available: 20 } });
  render(<FridgeSheet onClose={() => {}}/>);
  const buy = await screen.findByRole('button', { name: 'Buy 1 beer' });
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
  expect(screen.getByRole('button', { name: 'Buy 1 beer' })).toBeDisabled();
  fetchMock.route('/api/fridge', fridge);
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Buy 1 beer' })).toBeEnabled());
});
