import { act, renderHook } from '@testing-library/react';
import { expect, it } from 'vitest';
import { useCommandAgent } from './useCommandAgent.js';

it('BUG-251: empty and switched agent inputs cannot inherit another agent receipt', () => {
  const { result, rerender } = renderHook(({ agent }) => useCommandAgent(agent), { initialProps: { agent: undefined } });
  expect(result.current[0]).toBeUndefined();
  act(() => result.current[1]({ command: {}, agent: { id: 'other' } }));
  expect(result.current[0]).toBeUndefined();
  rerender({ agent: { id: 'a', ownerCommandRevision: 0 } });
  act(() => result.current[1]({ command: {}, agent: { id: 'b', ownerCommandRevision: 3 } }));
  expect(result.current[0].id).toBe('a');
  act(() => result.current[1]({ command: {}, agent: { id: 'a', ownerCommandRevision: 1, status: 'playing' } }));
  rerender({ agent: { id: 'b', ownerCommandRevision: 0 } });
  expect(result.current[0].id).toBe('b');
});

it('BUG-251: an older parent snapshot cannot undo a command, but the next server projection can', () => {
  const { result, rerender } = renderHook(({ agent }) => useCommandAgent(agent),
    { initialProps: { agent: { id: 'a', ownerCommandRevision: 0, status: 'idle' } } });
  act(() => result.current[1]({ command: {}, agent: { id: 'a', ownerCommandRevision: 1, status: 'playing' } }));
  rerender({ agent: { id: 'a', ownerCommandRevision: 0, status: 'idle' } });
  expect(result.current[0].status).toBe('playing');
  rerender({ agent: { id: 'a', ownerCommandRevision: 1, status: 'resting' } });
  expect(result.current[0].status).toBe('resting');
});

it('BUG-264: an equal-revision full profile hydrates a compact input without freezing newer same-revision lifecycle updates', () => {
  const compact = { id: 'a', name: 'Balance', ownerCommandRevision: 0, status: 'idle' };
  const full = { ...compact, profile: { tightness: 60 }, chatHistory: [{ role: 'user', content: 'Remember this.' }] };
  const { result, rerender } = renderHook(({ agent }) => useCommandAgent(agent), { initialProps: { agent: compact } });
  act(() => result.current[1]({ agent: full, profileRefresh: true }));
  expect(result.current[0].profile.tightness).toBe(60);
  rerender({ agent: { ...compact, status: 'resting' } });
  expect(result.current[0].status).toBe('resting');
  expect(result.current[0].chatHistory).toEqual(full.chatHistory);
});

it('BUG-264: an equal-revision compact receipt preserves known fields it omits', () => {
  const source = { id: 'a', name: 'Balance', ownerCommandRevision: 0, profile: { tightness: 60 } };
  const { result } = renderHook(() => useCommandAgent(source));
  act(() => result.current[1]({ agent: { id: 'a', ownerCommandRevision: 0, chatHistory: [] }, profileRefresh: true }));
  expect(result.current[0].name).toBe('Balance');
  expect(result.current[0].profile.tightness).toBe(60);
  expect(result.current[0].chatHistory).toEqual([]);
});
