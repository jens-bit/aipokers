import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useWallet } from './useWallet.js';
import { fetchWallet } from '../lib/wallet.js';

const owner = vi.hoisted(() => ({ value: 'first-owner' }));
vi.mock('../lib/wallet.js', () => ({ fetchWallet: vi.fn() }));
vi.mock('../lib/telegram.js', () => ({ getUserId: () => owner.value }));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

describe('BUG-146: confirmed wallet reads', () => {
  beforeEach(() => { owner.value = 'first-owner'; vi.mocked(fetchWallet).mockReset(); });

  it('waits for the initial projection and accepts an actual zero', async () => {
    const read = deferred();
    fetchWallet.mockReturnValueOnce(read.promise);
    const { result } = renderHook(() => useWallet());
    expect(result.current).toMatchObject({ wallet: null, status: 'loading' });
    await act(async () => read.resolve({ balance: 0, ledger: [] }));
    expect(result.current).toMatchObject({ wallet: { balance: 0 }, status: 'ready' });
  });

  it('retries a failed initial read without inventing a balance', async () => {
    fetchWallet.mockResolvedValueOnce(null).mockResolvedValueOnce({ balance: 8000 });
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.wallet).toBeNull();
    await act(async () => { await result.current.refresh(); });
    expect(result.current).toMatchObject({ wallet: { balance: 8000 }, status: 'ready' });
  });

  it('retains the last confirmed projection when refreshing fails', async () => {
    fetchWallet.mockResolvedValueOnce({ balance: 8000 }).mockResolvedValueOnce(null);
    const { result } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    await act(async () => { await result.current.refresh(); });
    expect(result.current).toMatchObject({ wallet: { balance: 8000 }, status: 'error' });
  });

  it('does not let a slow older read overwrite a newer confirmation', async () => {
    const older = deferred();
    fetchWallet.mockReturnValueOnce(older.promise).mockResolvedValueOnce({ balance: 7000 });
    const { result } = renderHook(() => useWallet());
    await act(async () => { await result.current.refresh(); });
    await act(async () => older.resolve({ balance: 10000 }));
    expect(result.current).toMatchObject({ wallet: { balance: 7000 }, status: 'ready' });
  });

  it('clears a former owner’s projection and ignores their late response', async () => {
    const oldRead = deferred(), newRead = deferred();
    fetchWallet.mockResolvedValueOnce({ balance: 8000 }).mockReturnValueOnce(oldRead.promise).mockReturnValueOnce(newRead.promise);
    const { result, rerender } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    act(() => { result.current.refresh(); });
    owner.value = 'second-owner';
    rerender();
    expect(result.current).toMatchObject({ wallet: null, status: 'loading' });
    await act(async () => oldRead.resolve({ balance: 9000 }));
    expect(result.current.wallet).toBeNull();
    await act(async () => newRead.resolve({ balance: 20 }));
    expect(result.current).toMatchObject({ wallet: { balance: 20 }, status: 'ready' });
  });

  it('an old action callback cannot invalidate the new owner’s pending read', async () => {
    const newRead = deferred();
    fetchWallet.mockResolvedValueOnce({ balance: 8000 }).mockReturnValueOnce(newRead.promise);
    const { result, rerender } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const oldActionRefresh = result.current.refresh;
    owner.value = 'second-owner';
    rerender();
    await act(async () => { await oldActionRefresh(); });
    expect(fetchWallet).toHaveBeenCalledTimes(2);
    await act(async () => newRead.resolve({ balance: 20 }));
    expect(result.current).toMatchObject({ wallet: { balance: 20 }, status: 'ready' });
  });

  it('an action completing after unmount cannot start a new read', async () => {
    fetchWallet.mockResolvedValue({ balance: 8000 });
    const { result, unmount } = renderHook(() => useWallet());
    await waitFor(() => expect(result.current.status).toBe('ready'));
    const lateRefresh = result.current.refresh;
    unmount();
    await lateRefresh();
    expect(fetchWallet).toHaveBeenCalledTimes(1);
  });
});
