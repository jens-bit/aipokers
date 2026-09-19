import { act, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { fetchMock, telegram } from '../test/harness.js';
import { usePrivateAgentRefresh } from './usePrivateAgentRefresh.js';
import { useCommandAgent } from './useCommandAgent.js';

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });
it('BUG-264: private profile polling pauses while hidden, resumes visibly, and cancels on unmount', async () => {
  telegram.signIn(); vi.useFakeTimers();
  let visibility = 'visible'; vi.spyOn(document, 'visibilityState', 'get').mockImplementation(() => visibility);
  fetchMock.route('/api/agents/a?', { id: 'a', ownerCommandRevision: 1 });
  const receive = vi.fn();
  const { unmount } = renderHook(() => usePrivateAgentRefresh('a', receive));
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(receive).toHaveBeenCalledTimes(1);
  visibility = 'hidden'; act(() => document.dispatchEvent(new Event('visibilitychange')));
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(receive).toHaveBeenCalledTimes(1);
  visibility = 'visible';
  await act(async () => { document.dispatchEvent(new Event('visibilitychange')); await vi.advanceTimersByTimeAsync(0); });
  expect(receive).toHaveBeenCalledTimes(2);
  unmount(); await vi.advanceTimersByTimeAsync(30_000);
  expect(fetchMock.requestsMatching('/api/agents/a?')).toHaveLength(2);
});

it('BUG-264: a late profile cannot enter another selected agent conversation', async () => {
  telegram.signIn();
  let release;
  fetchMock.route('/api/agents/a?', () => new Promise(resolve => { release = resolve; }));
  fetchMock.route('/api/agents/b?', { id: 'b', ownerCommandRevision: 1 });
  const receive = vi.fn();
  const { rerender } = renderHook(({ id }) => usePrivateAgentRefresh(id, receive), { initialProps: { id: 'a' } });
  await act(async () => { rerender({ id: 'b' }); });
  await act(async () => { release({ id: 'a', ownerCommandRevision: 99 }); });
  expect(receive.mock.calls.map(([data]) => data.agent.id)).toEqual(['b']);
});

it('BUG-264: a late equal-revision read hydrates private fields without undoing a newer parent lifecycle projection', async () => {
  telegram.signIn();
  let release;
  fetchMock.route('/api/agents/a?', () => new Promise(resolve => { release = resolve; }));
  const { result, rerender } = renderHook(({ source }) => {
    const [agent, accept] = useCommandAgent(source);
    usePrivateAgentRefresh(source.id, accept);
    return agent;
  }, { initialProps: { source: { id: 'a', ownerCommandRevision: 0, status: 'playing' } } });
  rerender({ source: { id: 'a', ownerCommandRevision: 0, status: 'resting' } });
  await act(async () => { release({ status: 200, body: { id: 'a', ownerCommandRevision: 0, status: 'playing', profile: { tightness: 60 } } }); });
  expect(result.current.status).toBe('resting');
  expect(result.current.profile.tightness).toBe(60);
});

it('BUG-264: switching away and back requires a fresh read marker for the reopened conversation', async () => {
  telegram.signIn();
  let calls = 0;
  let release;
  fetchMock.route('/api/agents/a?', () => ++calls === 1
    ? { id: 'a', chatHistory: [{ role: 'assistant', content: 'Earlier history.' }] }
    : new Promise(resolve => { release = resolve; }));
  fetchMock.route('/api/agents/b?', () => new Promise(() => {}));
  const receive = vi.fn();
  const { result, rerender } = renderHook(({ id }) => usePrivateAgentRefresh(id, receive), { initialProps: { id: 'a' } });
  await act(async () => {});
  expect(result.current?.id).toBe('a');
  rerender({ id: 'b' });
  rerender({ id: 'a' });
  expect(result.current).toBeNull();
  await act(async () => { release({ id: 'a', chatHistory: [{ role: 'assistant', content: 'New saved history.' }] }); });
  expect(result.current.chatHistory[0].content).toBe('New saved history.');
});
