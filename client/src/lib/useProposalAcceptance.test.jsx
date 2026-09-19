import { act, renderHook } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { fetchMock, telegram } from '../test/harness.js';
import { useProposalAcceptance } from './useProposalAcceptance.js';

const options = () => ({ agentId: 'a', chat: [{ _id: 1, role: 'proposal', proposal: { id: 'p1' } }],
  setChat: vi.fn(), mkMsg: (role, content) => ({ role, content }), acceptAgent: vi.fn(), onRefresh: vi.fn() });

it('BUG-260: a receipt for another agent or proposal cannot confirm this change', async () => {
  telegram.signIn();
  const input = options();
  fetchMock.route('/proposal/accept', { id: 'other', proposalAcceptance: { proposalId: 'p1', reply: 'Saved.' } });
  const { result } = renderHook(() => useProposalAcceptance(input));
  await act(async () => { expect(await result.current.acceptProposal(1)).toBe(false); });
  expect(result.current.error).toMatch(/could not confirm/i);
  expect(input.setChat).not.toHaveBeenCalled();
  expect(input.acceptAgent).not.toHaveBeenCalled();
  fetchMock.route('/proposal/accept', { id: 'a', proposalAcceptance: { proposalId: 'other', reply: 'Saved.' } });
  await act(async () => { expect(await result.current.acceptProposal(1)).toBe(false); });
  expect(input.onRefresh).not.toHaveBeenCalled();
});

it('BUG-260: an unmounted conversation never appends its late acceptance receipt', async () => {
  telegram.signIn();
  const input = options();
  let release;
  fetchMock.route('/proposal/accept', () => new Promise(resolve => { release = resolve; }));
  const { result, unmount } = renderHook(() => useProposalAcceptance(input));
  let pending;
  act(() => { pending = result.current.acceptProposal(1); });
  unmount();
  await act(async () => { release({ id: 'a', proposalAcceptance: { proposalId: 'p1', reply: 'Saved.' } }); await pending; });
  expect(input.setChat).not.toHaveBeenCalled();
  expect(input.acceptAgent).not.toHaveBeenCalled();
});
