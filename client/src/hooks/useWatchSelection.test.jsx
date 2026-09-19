import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { useWatchSelection } from './useWatchSelection.js';

function setup() {
  const pending = [];
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => pending.push(resolve))));
  const table = { watch: vi.fn(), connect: vi.fn(), disconnect: vi.fn() };
  const hook = renderHook(() => useWatchSelection(table));
  const resolve = (i, memoryContext) => pending[i]({ ok: true, json: async () => ({ memoryContext }) });
  return { ...hook, table, resolve };
}

it('WATCH-MULTI-1: delayed A memory cannot supersede a later B selection', async () => {
  const { result, resolve, table } = setup();
  const selected = [];
  let a, b;
  act(() => {
    a = result.current.watchAgent({ id: 'a' }, memoryContext => { selected.push('a'); result.current.watch({ tableId: 'a', memoryContext }); });
    b = result.current.watchAgent({ id: 'b' }, memoryContext => { selected.push('b'); result.current.watch({ tableId: 'b', memoryContext }); });
  });
  await act(async () => { resolve(1, 'B memory'); await b; });
  await act(async () => { resolve(0, 'A memory'); await a; });
  expect(selected).toEqual(['b']);
  expect(table.watch).toHaveBeenCalledOnce();
  expect(table.watch).toHaveBeenCalledWith({ tableId: 'b', memoryContext: 'B memory' });
});

it.each(['watch', 'connect', 'disconnect', 'cancelWatch', 'unmount'])('WATCH-MULTI-1: %s invalidates an outstanding memory request', async action => {
  const { result, resolve, unmount } = setup();
  const commit = vi.fn();
  const request = result.current.watchAgent({ id: 'a' }, commit);
  act(() => { if (action === 'unmount') unmount(); else result.current[action]({ tableId: 'public' }); });
  await act(async () => { resolve(0, 'stale'); await request; });
  expect(commit).not.toHaveBeenCalled();
});
