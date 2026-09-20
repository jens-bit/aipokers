import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { AgentWardrobe } from './AgentWardrobe.jsx';
import { STARTER_ITEMS } from '../../../../src/shared/wardrobe.js';
import { telegram } from '../../test/harness.js';

const original = { head: null, face: null, neck: null };
const chosen = { head: 'rail-cap', face: 'round-glasses', neck: null };
const agent = { id: 'bird/a', name: 'Moss', identity: { hood: 'ash', glow: 'teal' }, equipment: original, ownerCommandRevision: 4 };
const result = { ...agent, equipment: chosen, ownerCommandRevision: 5 };
const response = (data = result, ok = true, status = ok ? 200 : 503) => ({ ok, status, json: async () => data });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
beforeEach(() => { telegram.signIn(); });

it('BUG-277: Wardrobe cannot offer a repaint of permanent hood or eye colours', () => {
  render(<AgentWardrobe agent={agent} />);
  expect(screen.queryByRole('button', { name: 'Moss hood' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Gold glow' })).not.toBeInTheDocument();
  expect(screen.getByText(/birth colours.*permanent/i)).toBeVisible();
});
async function selectAndTry(user = userEvent.setup()) {
  await user.click(screen.getByRole('button', { name: 'Rail cap' }));
  await user.click(screen.getByRole('button', { name: 'Round glasses' }));
  await user.click(screen.getByRole('button', { name: 'Try on' }));
  return user;
}

it('Wardrobe offers a free starter rack with each removable item initially off', () => {
  render(<AgentWardrobe agent={agent} />);
  for (const item of STARTER_ITEMS) expect(screen.getByRole('button', { name: item.name })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('group', { name: /Starter rack/ }).querySelectorAll('button')).toHaveLength(3);
  expect(screen.getByRole('button', { name: 'Save look' })).toBeDisabled();
  expect(fetch).not.toHaveBeenCalled();
  expect(screen.getByText('Removable items. No cost or change to poker skills.')).toBeVisible();
});

it('Wardrobe selects locally, previews only on Try on, and Cancel restores the saved look without a write', async () => {
  const onPreview = vi.fn();
  const user = userEvent.setup();
  render(<AgentWardrobe agent={agent} onPreview={onPreview} />);
  await user.click(screen.getByRole('button', { name: 'Rail cap' }));
  expect(onPreview).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Save look' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Round glasses' }));
  await user.click(screen.getByRole('button', { name: 'Try on' }));
  expect(onPreview).toHaveBeenLastCalledWith(chosen);
  expect(screen.getByRole('status')).toHaveTextContent('Preview only. Save to keep this look.');
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onPreview).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole('button', { name: 'Rail cap' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: 'Round glasses' })).toHaveAttribute('aria-pressed', 'false');
  expect(fetch).not.toHaveBeenCalled();
});

it('Wardrobe authenticates one save, keeps controls pending, and uses only the confirmed server projection', async () => {
  const pending = deferred(), onSaved = vi.fn(), onPreview = vi.fn();
  vi.stubGlobal('fetch', vi.fn(() => pending.promise));
  render(<AgentWardrobe agent={agent} userId="explicit-owner" onSaved={onSaved} onPreview={onPreview} />);
  const user = await selectAndTry();
  await user.click(screen.getByRole('button', { name: 'Save look' }));
  fireEvent.click(screen.getByRole('button', { name: 'Save look' }));
  expect(fetch).toHaveBeenCalledTimes(1);
  const [url, options] = fetch.mock.calls[0];
  expect(url).toBe('/api/agents/bird%2Fa');
  expect(options.method).toBe('PATCH');
  expect(options.credentials).toBe('same-origin');
  expect(options.headers['x-telegram-init-data']).toBe(telegram.webApp.initData);
  expect(JSON.parse(options.body)).toEqual({ userId: 'explicit-owner', equipment: chosen });
  expect(screen.getByRole('status')).toHaveTextContent('Saving…');
  for (const name of ['Cancel', 'Rail cap', 'Round glasses', 'Try on']) expect(screen.getByRole('button', { name })).toBeDisabled();
  expect(onSaved).not.toHaveBeenCalled();
  await act(async () => pending.resolve(response()));
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(onSaved).toHaveBeenCalledWith(result);
  expect(onPreview).toHaveBeenLastCalledWith(null);
  expect(screen.getByRole('status')).toHaveTextContent('Look saved.');
  expect(screen.getByRole('button', { name: 'Save look' })).toBeDisabled();
});

it.each(['server', 'network', 'unauthorized', 'malformed', 'wrong agent', 'wrong equipment'])('Wardrobe preserves the draft and preview after a %s failure, and can retry', async kind => {
  const onSaved = vi.fn(), onPreview = vi.fn();
  const fetcher = vi.fn();
  if (kind === 'network') fetcher.mockRejectedValueOnce(new Error('offline'));
  else if (kind === 'malformed') fetcher.mockResolvedValueOnce({ ok: true, json: async () => { throw new SyntaxError('JSON'); } });
  else if (kind === 'wrong agent') fetcher.mockResolvedValueOnce(response({ ...result, id: 'bird/b' }));
  else if (kind === 'wrong equipment') fetcher.mockResolvedValueOnce(response(agent));
  else fetcher.mockResolvedValueOnce(response({}, false, kind === 'unauthorized' ? 403 : 503));
  fetcher.mockResolvedValueOnce(response());
  vi.stubGlobal('fetch', fetcher);
  render(<AgentWardrobe agent={agent} onSaved={onSaved} onPreview={onPreview} />);
  const user = await selectAndTry();
  await user.click(screen.getByRole('button', { name: 'Save look' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/could not/i);
  expect(onSaved).not.toHaveBeenCalled();
  expect(onPreview).toHaveBeenLastCalledWith(chosen);
  expect(screen.getByRole('button', { name: 'Rail cap' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Round glasses' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Save look' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Save look' }));
  expect(onSaved).toHaveBeenCalledTimes(1);
  expect(onSaved).toHaveBeenCalledWith(result);
});

it('Wardrobe requires trying changed items again and retains a failed draft through same-agent hydration', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response({}, false)));
  const onPreview = vi.fn();
  const view = render(<AgentWardrobe agent={agent} onPreview={onPreview} />);
  const user = await selectAndTry();
  await user.click(screen.getByRole('button', { name: 'Save look' }));
  view.rerender(<AgentWardrobe agent={{ ...agent, mood: { heat: 45 } }} onPreview={onPreview} />);
  expect(screen.getByRole('button', { name: 'Rail cap' })).toHaveAttribute('aria-pressed', 'true');
  await user.click(screen.getByRole('button', { name: 'Knit scarf' }));
  expect(screen.getByRole('button', { name: 'Save look' })).toBeDisabled();
  expect(onPreview).toHaveBeenLastCalledWith(chosen);
  await user.click(screen.getByRole('button', { name: 'Try on' }));
  expect(onPreview).toHaveBeenLastCalledWith({ ...chosen, neck: 'knit-scarf' });
  expect(screen.getByRole('button', { name: 'Save look' })).toBeEnabled();
});

it.each(['success', 'failure'])('Wardrobe ignores late %s across agent A → B → A and starts a fresh fitting', async kind => {
  const pending = deferred(), onSaved = vi.fn(), onPreview = vi.fn();
  vi.stubGlobal('fetch', vi.fn(() => pending.promise));
  const view = render(<AgentWardrobe agent={agent} onSaved={onSaved} onPreview={onPreview} />);
  const user = await selectAndTry();
  await user.click(screen.getByRole('button', { name: 'Save look' }));
  view.rerender(<AgentWardrobe agent={{ ...agent, id: 'bird/b', name: 'B' }} onSaved={onSaved} onPreview={onPreview} />);
  view.rerender(<AgentWardrobe agent={agent} onSaved={onSaved} onPreview={onPreview} />);
  expect(screen.getByRole('button', { name: 'Rail cap' })).toHaveAttribute('aria-pressed', 'false');
  onPreview.mockClear();
  await act(async () => kind === 'success' ? pending.resolve(response()) : pending.reject(new Error('offline')));
  expect(onSaved).not.toHaveBeenCalled();
  expect(onPreview).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Your saved look.');
});

it('Wardrobe ignores a save outcome after unmount', async () => {
  const pending = deferred(), onSaved = vi.fn(), onPreview = vi.fn();
  vi.stubGlobal('fetch', vi.fn(() => pending.promise));
  const view = render(<AgentWardrobe agent={agent} onSaved={onSaved} onPreview={onPreview} />);
  const user = await selectAndTry();
  await user.click(screen.getByRole('button', { name: 'Save look' }));
  view.unmount(); onPreview.mockClear();
  await act(async () => pending.resolve(response()));
  expect(onSaved).not.toHaveBeenCalled();
  expect(onPreview).not.toHaveBeenCalled();
});

it.each(['owner', 'credential'])('Wardrobe ignores a save outcome after the %s changes on the same agent', async kind => {
  const pending = deferred(), onSaved = vi.fn(), onPreview = vi.fn();
  vi.stubGlobal('fetch', vi.fn(() => pending.promise));
  const view = render(<AgentWardrobe agent={agent} userId="owner-a" onSaved={onSaved} onPreview={onPreview} />);
  const user = await selectAndTry();
  await user.click(screen.getByRole('button', { name: 'Save look' }));
  if (kind === 'credential') telegram.signIn({ id: 9292 });
  view.rerender(<AgentWardrobe agent={agent} userId={kind === 'owner' ? 'owner-b' : 'owner-a'} onSaved={onSaved} onPreview={onPreview} />);
  onPreview.mockClear();
  await act(async () => pending.resolve(response()));
  expect(onSaved).not.toHaveBeenCalled();
  expect(onPreview).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Rail cap' })).toHaveAttribute('aria-pressed', 'false');
});

it('Wardrobe keeps a confirmed save successful even if a parent refresh rejects', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => response()));
  const onSaved = vi.fn(async () => { throw new Error('refresh failed'); });
  render(<AgentWardrobe agent={agent} onSaved={onSaved} />);
  const user = await selectAndTry();
  await user.click(screen.getByRole('button', { name: 'Save look' }));
  expect(screen.getByRole('status')).toHaveTextContent('Look saved.');
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save look' })).toBeDisabled();
});

it('Wardrobe follows a fresh persisted appearance only while its draft is untouched', () => {
  const view = render(<AgentWardrobe agent={agent} />);
  view.rerender(<AgentWardrobe agent={result} />);
  expect(screen.getByRole('button', { name: 'Rail cap' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Round glasses' })).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: 'Save look' })).toBeDisabled();
});
