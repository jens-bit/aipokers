import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { WantToast } from './WantToast.jsx';
import { fetchMock, telegram } from '../../test/harness.js';
beforeEach(() => telegram.signIn());
it('BUG-61: Home does not clear a want when its answer was refused', async () => {
  fetchMock.route('/api/agents/a1/want', { status: 503, body: { error: 'Unavailable' } });
  const onAnswered = vi.fn();
  render(<WantToast agent={{ id: 'a1', name: 'Bal', want: { text: 'Put me in.' } }} onAnswered={onAnswered}/>);
  await userEvent.click(screen.getByRole('button', { name: 'Later' }));
  expect(onAnswered).not.toHaveBeenCalled();
  expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
  expect(screen.getByRole('button', { name: 'Later' })).toBeEnabled();
});
it('BUG-61: an empty shelf opens stock while leaving the want pending', async () => {
  const want = { text: 'A beer?' };
  fetchMock.route('/api/agents/a1/want', { answered: null, needs: 'stock', want });
  const onAnswered = vi.fn(), onNeeds = vi.fn();
  render(<WantToast agent={{ id: 'a1', name: 'Bal', want }} onAnswered={onAnswered} onNeeds={onNeeds}/>);
  await userEvent.click(screen.getByRole('button', { name: 'Yes' }));
  expect(onAnswered).not.toHaveBeenCalled();
  expect(onNeeds).toHaveBeenCalledWith('stock', expect.objectContaining({ agent: expect.objectContaining({ id: 'a1' }) }));
});
