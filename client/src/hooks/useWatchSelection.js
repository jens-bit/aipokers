import { useCallback, useEffect, useRef } from 'react';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';

// Optional memory loading cannot choose the table after a newer user action.
export function useWatchSelection(table) {
  const revision = useRef(0);
  const cancelWatch = useCallback(() => { revision.current += 1; }, []);
  useEffect(() => cancelWatch, [cancelWatch]);
  const watch = useCallback((cfg) => { cancelWatch(); table.watch(cfg); }, [cancelWatch, table.watch]);
  const connect = useCallback((cfg) => { cancelWatch(); table.connect(cfg); }, [cancelWatch, table.connect]);
  const disconnect = useCallback(() => { cancelWatch(); table.disconnect(); }, [cancelWatch, table.disconnect]);
  const watchAgent = useCallback(async (agent, commit) => {
    const requested = ++revision.current;
    let memoryContext = '';
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/memory?userId=${encodeURIComponent(getUserId())}`, {
        headers: { 'x-telegram-init-data': getTelegramInitData() },
      });
      if (res.ok) memoryContext = (await res.json()).memoryContext || '';
    } catch { /* Memory is optional; identity is not. */ }
    if (requested === revision.current) commit(memoryContext);
  }, []);
  return { watch, connect, disconnect, watchAgent, cancelWatch };
}
