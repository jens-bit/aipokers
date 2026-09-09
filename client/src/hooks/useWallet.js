import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchWallet } from '../lib/wallet.js';
import { getUserId } from '../lib/telegram.js';

// A missing response is not an empty safe. Keep the last confirmed projection
// for this owner, and let every doorway distinguish a read from its outcome.
export function useWallet() {
  const owner = String(getUserId());
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const request = useRef(0);
  const mounted = useRef(false);
  const [snapshot, setSnapshot] = useState({ owner, wallet: null, status: 'loading' });

  const refresh = useCallback(async () => {
    // A completed action may retain this callback after a login change or
    // leaving the screen. It must not cancel the new owner's active read.
    if (!mounted.current || currentOwner.current !== owner) return null;
    const id = ++request.current;
    setSnapshot(previous => ({ owner, wallet: previous.owner === owner ? previous.wallet : null, status: 'loading' }));
    let wallet = null;
    try { wallet = await fetchWallet(); } catch { /* failed reads remain retryable */ }
    if (mounted.current && currentOwner.current === owner && request.current === id) {
      setSnapshot(previous => ({
        owner,
        wallet: wallet ?? (previous.owner === owner ? previous.wallet : null),
        status: wallet ? 'ready' : 'error',
      }));
    }
    return wallet;
  }, [owner]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => { mounted.current = false; request.current++; };
  }, [refresh]);

  return snapshot.owner === owner
    ? { wallet: snapshot.wallet, status: snapshot.status, refresh }
    : { wallet: null, status: 'loading', refresh };
}
