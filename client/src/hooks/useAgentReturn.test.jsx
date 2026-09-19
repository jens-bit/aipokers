import { act, renderHook } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { useAgentReturn } from './useAgentReturn.js';
import { playingAgent } from '../test/fixtures/agents.js';
import { midHandGame } from '../test/fixtures/game.js';
import { fetchMock, telegram } from '../test/harness.js';

beforeEach(() => telegram.signIn());
const props = { agent: playingAgent, game: { ...midHandGame, sessionId: 'seat-session-a' }, mySeat: 0 };
const finish = `/api/agents/${playingAgent.id}/finish`;
it('BUG-259: the request identifies the observed table and own seat session', async () => {
  fetchMock.route(finish, { status: 200, body: { ...playingAgent, returnPending: true } });
  const { result } = renderHook(() => useAgentReturn(props));
  await act(async () => result.current.request());
  expect(fetchMock.posts[0].body).toEqual({ userId: '4242', expectedTableId: midHandGame.tableId, expectedSessionId: 'seat-session-a' });
  expect(result.current.label).toBe('Returning…');
  expect(result.current.disabled).toBe(true);
});
it('BUG-259: a late return reply cannot replace another table session state', async () => {
  const responses = [];
  fetchMock.route(finish, () => new Promise(resolve => responses.push(resolve)));
  const { result, rerender } = renderHook(value => useAgentReturn(value), { initialProps: props });
  let oldRequest, nextRequest;
  act(() => { oldRequest = result.current.request(); });
  const next = { ...props, agent: { ...playingAgent, activeTableId: 'table-b' }, game: { ...midHandGame, tableId: 'table-b', sessionId: 'seat-session-b' } };
  rerender(next);
  expect(result.current.label).toBe('Bring home');
  act(() => { nextRequest = result.current.request(); });
  await act(async () => { responses[0]({ status: 200, body: { ...playingAgent, activeTableId: null } }); await oldRequest; });
  expect(result.current.label).toBe('Requesting…');
  await act(async () => { responses[1]({ status: 200, body: next.agent }); await nextRequest; });
  expect(result.current.label).toBe('Returning…');
  expect(fetchMock.posts).toHaveLength(2);
});
it('BUG-259: authoritative seat release completes a pending request without waiting for another hand', async () => {
  fetchMock.route(finish, { status: 200, body: { ...playingAgent, returnPending: true } });
  const { result, rerender } = renderHook(value => useAgentReturn(value), { initialProps: props });
  await act(async () => result.current.request());
  rerender({ ...props, agent: { ...playingAgent, activeTableId: null, returnPending: false } });
  expect(result.current.label).toBe('Returned home');
  expect(result.current.disabled).toBe(true);
  expect(fetchMock.posts).toHaveLength(1);
});
