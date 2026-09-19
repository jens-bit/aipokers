import { act, renderHook, waitFor } from '@testing-library/react';
import { useRef, useState } from 'react';
import { expect, it } from 'vitest';
import { useConversationUpdates } from './useConversationUpdates.js';

function useFeed(props) {
  const [chat, setChat] = useState(props.initialChat);
  const serial = useRef(20);
  useConversationUpdates({ ...props, setChat, mkMsg: (role, content) => ({ role, content, _id: ++serial.current }) });
  return [chat, setChat];
}

it('BUG-264: first hydration preserves repeated older text and the distinct pending local turn', async () => {
  const initialChat = [{ role: 'assistant', content: 'Hello.', _id: 1, _seeded: true },
    { role: 'user', content: 'hi', _id: 2 }];
  const compact = { id: 'a', ownerCommandRevision: 0 };
  const { result, rerender } = renderHook(useFeed, { initialProps: { agent: compact, privateRead: null, seededAgent: 'a', initialChat } });
  const full = { ...compact, chatHistory: [{ role: 'user', content: 'hi' },
    { role: 'assistant', content: 'We discussed yesterday’s game.' }] };
  rerender({ agent: full, privateRead: full, seededAgent: 'a', initialChat });
  await waitFor(() => expect(result.current[0].map(message => message.content)).toEqual(['hi', 'We discussed yesterday’s game.', 'hi']));
  expect(result.current[0].at(-1)).toBe(initialChat[1]);
  rerender({ agent: { ...full }, privateRead: { ...full }, seededAgent: 'a', initialChat });
  expect(result.current[0]).toHaveLength(3);
  act(() => result.current[1](chat => chat.filter(message => message._id !== 2)));
  expect(result.current[0].map(message => message.content)).toEqual(['hi', 'We discussed yesterday’s game.']);
});

it('BUG-264: a private profile arriving before the initial seed waits and never hydrates another agent', async () => {
  const full = { id: 'a', chatHistory: [{ role: 'assistant', content: 'A private history.' }] };
  const { result, rerender } = renderHook(useFeed, { initialProps: { agent: full, privateRead: full, seededAgent: null, initialChat: [] } });
  expect(result.current[0]).toEqual([]);
  act(() => result.current[1]([{ role: 'assistant', content: 'A opener.', _seeded: true }]));
  rerender({ agent: full, privateRead: full, seededAgent: 'a', initialChat: [] });
  await waitFor(() => expect(result.current[0][0].content).toBe('A private history.'));
  act(() => result.current[1]([{ role: 'assistant', content: 'B opener.', _seeded: true }]));
  rerender({ agent: { id: 'b' }, privateRead: full, seededAgent: 'b', initialChat: [] });
  expect(result.current[0].map(message => message.content)).toEqual(['B opener.']);
});
