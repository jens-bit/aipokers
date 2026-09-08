import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, expect, it } from 'vitest';
import { useHomeThread } from './useHomeThread.js';
import { fetchMock, telegram } from '../test/harness.js';
beforeEach(() => { telegram.signIn(); fetchMock.route('/api/home/thread', { sessionId: 'home-day', lines: [] }); });
it('BUG-65: streamed household replies arrive without reopening the room', async () => {
  const { result, rerender } = renderHook(({ pushed }) => useHomeThread({ pushed }), { initialProps: { pushed: [] } });
  await waitFor(() => expect(result.current.loading).toBe(false));
  rerender({ pushed: [{ id: 1, sessionId: 'home-day', kind: 'him', text: 'I am here.', ts: 100 }] });
  await waitFor(() => expect(result.current.lines).toHaveLength(1));
  expect(result.current.lines[0].text).toBe('I am here.');
  fetchMock.route('/api/home/thread', { sessionId: 'home-day', lines: [{ id: 1, sessionId: 'home-day', kind: 'him', text: 'I am here.', ts: 100 }] });
  await act(async () => result.current.reload());
  expect(result.current.lines).toHaveLength(1);
});
it('BUG-65: table whispers never leak into the household conversation', async () => {
  const { result } = renderHook(() => useHomeThread({ pushed: [{ id: 2, sessionId: 'private-table', text: 'My cards', ts: 100 }] }));
  await waitFor(() => expect(result.current.loading).toBe(false));
  expect(result.current.lines).toHaveLength(0);
});
it('BUG-65: a failed room send returns failure and a retryable message', async () => {
  fetchMock.route('/api/home/say', { status: 503, body: { error: 'Unavailable' } });
  const { result } = renderHook(() => useHomeThread());
  let sent;
  await act(async () => { sent = await result.current.say('Anyone home?'); });
  expect(sent).toBeNull();
  expect(result.current.error).toMatch(/Could not send/);
  expect(result.current.sending).toBe(false);
});
