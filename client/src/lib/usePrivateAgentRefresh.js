import { useEffect, useMemo, useRef, useState } from 'react';
import { getTelegramInitData, getUserId } from './telegram.js';

// An open private conversation may outlive the Home screen that supplied its
// agent. Read only this owner's selected profile, never another chat/model turn.
export function usePrivateAgentRefresh(agentId, acceptAgent) {
  const receiver = useRef(acceptAgent);
  receiver.current = acceptAgent;
  const userId = getUserId();
  const initData = getTelegramInitData();
  const scope = useMemo(() => ({}), [agentId, userId, initData]);
  const [read, setRead] = useState(null);
  useEffect(() => {
    if (!agentId || !userId) return undefined;
    let alive = true;
    let request = null;
    async function refresh() {
      if (!alive || request || document.visibilityState === 'hidden') return;
      const controller = new AbortController();
      // Keep the source boundary from request start. A same-revision parent
      // lifecycle update delivered meanwhile must supersede this older read.
      const receive = receiver.current;
      request = controller;
      try {
        const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}?userId=${encodeURIComponent(userId)}`, {
          headers: { 'x-telegram-init-data': initData }, signal: controller.signal,
        });
        if (!response.ok) return;
        const agent = await response.json();
        if (alive && !controller.signal.aborted && agent?.id === agentId) {
          receive({ agent, profileRefresh: true });
          setRead({ agent, scope });
        }
      } catch { /* keep the saved conversation; the next visible read retries */ }
      finally { if (request === controller) request = null; }
    }
    function visibility() {
      if (document.visibilityState === 'hidden') { request?.abort(); request = null; }
      else refresh();
    }
    refresh();
    const timer = setInterval(refresh, 10_000);
    document.addEventListener('visibilitychange', visibility);
    return () => { alive = false; request?.abort(); clearInterval(timer); document.removeEventListener('visibilitychange', visibility); };
  }, [agentId, userId, initData, scope]);
  // A → B → A is a new open conversation, even when B's read never finished.
  return read?.scope === scope ? read.agent : null;
}
