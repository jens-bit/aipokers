import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { WantToast } from './WantToast.jsx';
import { VisitorToast, VisitNotice } from './VisitorToast.jsx';
import { identitiesFor } from '../../lib/identity.js';
import { fetchMock, telegram } from '../../test/harness.js';

const actor = { id: 'actual', name: 'Professor', mood: { state: 'frustrated', heat: 60 },
  identity: { hood: 'indigo', glow: 'violet' }, want: { text: 'Let me back in. I can do better this time.' } };
const identity = identitiesFor([actor]).get(actor.id);
beforeEach(() => telegram.signIn());

it('BUG-189: the full request belongs to its saved speaker, with a compact prefix and full accessible name', () => {
  render(<WantToast agent={actor} identity={identity} />);
  const want = screen.getByRole('group', { name: 'Professor is asking for something' });
  expect(want.querySelector('.home-mood-avatar')).toHaveAttribute('data-agent-id', 'actual');
  expect(want.querySelector('.home-mood-avatar svg')).toHaveAttribute('data-hood', 'indigo');
  expect(want.querySelector('.home-mood-avatar svg')).toContainHTML('fill="#8B6BC4"');
  expect(want.querySelector('.home-want__who')).toHaveTextContent(/^Profes$/);
  expect(want.querySelector('.home-want__who')).toHaveStyle({ color: '#8B6BC4' });
  expect(screen.getAllByText(actor.want.text, { exact: true })).toHaveLength(1);
  expect(screen.getByRole('button', { name: 'Yes', exact: true })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Later', exact: true })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'No', exact: true })).toBeEnabled();
  expect(fetchMock.requests).toHaveLength(0);
});

it('BUG-189: another actor with the same display name cannot replace the supplied saved identity', () => {
  const twin = { ...actor, id: 'twin', identity: { hood: 'sand', glow: 'gold' } };
  const pair = identitiesFor([twin, actor]);
  render(<WantToast agent={actor} identity={pair.get(actor.id)} />);
  expect(screen.getByTestId('home-want').querySelector('.home-mood-avatar')).toHaveAttribute('data-agent-id', 'actual');
  expect(screen.getByTestId('home-want').querySelector('svg')).toHaveAttribute('data-hood', 'indigo');
});

it('BUG-189: a missing saved identity keeps the real compact name and full words without fabricating an avatar', () => {
  render(<WantToast agent={{ ...actor, name: 'The Clock', nickname: 'Clock' }} />);
  expect(screen.getByRole('group', { name: 'The Clock is asking for something' })).toBeVisible();
  expect(screen.getByTestId('home-want').querySelector('.home-mood-avatar')).toBeNull();
  expect(screen.getByTestId('home-want').querySelector('.home-want__who')).toHaveTextContent(/^Clock$/);
  expect(screen.getAllByText(actor.want.text, { exact: true })).toHaveLength(1);
});

it.each(['Yes', 'Later', 'No'])('BUG-189: real %s still sends the existing answer once and preserves callbacks', async label => {
  fetchMock.route('/api/agents/actual/want', { answered: label.toLowerCase(), want: null });
  const answered = vi.fn();
  render(<WantToast agent={actor} identity={identity} onAnswered={answered} />);
  await userEvent.click(screen.getByRole('button', { name: label, exact: true }));
  expect(answered).toHaveBeenCalledTimes(1);
  expect(answered).toHaveBeenCalledWith('actual', label.toLowerCase(), expect.objectContaining({ want: null }));
  expect(fetchMock.posts).toHaveLength(1);
  expect(fetchMock.posts[0]).toMatchObject({ url: '/api/agents/actual/want?userId=4242', body: { userId: '4242', answer: label.toLowerCase() } });
});

it('BUG-189: a refused answer keeps its speaker and full request while restoring the existing retry controls', async () => {
  let answer;
  fetchMock.route('/api/agents/actual/want', () => new Promise(resolve => { answer = resolve; }));
  const answered = vi.fn();
  render(<WantToast agent={actor} identity={identity} onAnswered={answered} />);
  await userEvent.click(screen.getByRole('button', { name: 'Later', exact: true }));
  expect(screen.getByRole('button', { name: 'Yes', exact: true })).toBeDisabled();
  await act(async () => answer({ status: 503, body: {} }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Later', exact: true })).toBeEnabled());
  expect(screen.getByRole('alert')).toHaveTextContent('Could not save your answer');
  expect(screen.getByTestId('home-want').querySelector('.home-mood-avatar')).toHaveAttribute('data-agent-id', 'actual');
  expect(screen.getAllByText(actor.want.text, { exact: true })).toHaveLength(1);
  expect(answered).not.toHaveBeenCalled();
});

it('BUG-189: the unboarded visitor and visit notice consumers keep their own text and controls', () => {
  render(<><VisitorToast visitor={{ id: 'visit', agentName: 'Professor' }} />
    <VisitNotice notice={{ error: true, text: 'This invitation expired.' }} onDismiss={() => {}} /></>);
  expect(screen.getByTestId('home-visitor').querySelector('.home-mood-avatar')).toBeNull();
  expect(screen.getByTestId('home-visitor').querySelector('.home-want__who')).toHaveTextContent(/^Professor$/);
  expect(screen.getByRole('button', { name: 'Let him in' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Not tonight' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Got it' })).toBeVisible();
  expect(screen.getByRole('alert')).toHaveTextContent('This invitation expired.');
  expect(screen.queryByRole('button', { name: 'Later' })).toBeNull();
  expect(fetchMock.requests).toHaveLength(0);
});
