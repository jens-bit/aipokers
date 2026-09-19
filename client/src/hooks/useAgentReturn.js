import { useEffect, useRef, useState } from 'react';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';

// Returning the agent is a seat lifecycle action. Disconnecting a spectator
// and the human player's immediate sit-out command do different jobs.
export function useAgentReturn({ agent, game, mySeat, sessionEnd, seated = false }) {
  const ownerId = getUserId();
  const key = JSON.stringify([ownerId, agent?.id, game?.tableId, game?.sessionId]);
  const current = useRef(key), busy = useRef(null);
  current.current = key;
  const [receipt, setReceipt] = useState(null);
  useEffect(() => { current.current = key; return () => { current.current = null; }; }, [key]);
  const local = receipt?.key === key ? receipt : null;
  const atTable = !!agent?.activeTableId && agent.activeTableId === game?.tableId;
  const eligible = !seated && !game?.home && !agent?.liveGame?.home && atTable
    && Number.isInteger(mySeat) && mySeat >= 0 && !!game?.seats?.[mySeat];
  const done = !!sessionEnd || local?.status === 'done'
    || (!!local && local.status === 'pending' && !!agent && !atTable);
  const pending = !done && (agent?.returnPending === true || local?.status === 'pending');
  const sending = !done && local?.status === 'sending';
  const error = !done ? local?.error : null;

  async function request() {
    if (!eligible || done || pending || busy.current === key) return;
    busy.current = key;
    setReceipt({ key, status: 'sending' });
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agent.id)}/finish`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId: ownerId, expectedTableId: game.tableId,
          ...(game.sessionId ? { expectedSessionId: game.sessionId } : {}) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not bring him home. Try again.');
      if (result.id !== agent.id) throw new Error('Could not confirm his return. Try again.');
      if (result.activeTableId && result.activeTableId !== game.tableId) throw new Error('His table changed. Open his current game to bring him home.');
      if (current.current !== key) return;
      // A successful request is not a cash-out. The real seat remains until
      // settlement; a closed seat is the only immediate completion response.
      setReceipt({ key, status: result.activeTableId ? 'pending' : 'done' });
    } catch (failure) {
      if (current.current === key) setReceipt({ key, status: 'error', error: failure.message });
    } finally {
      if (busy.current === key) busy.current = null;
    }
  }

  return {
    visible: !seated && !!agent && (eligible || !!local || pending),
    disabled: !eligible || sending || pending || done,
    label: done ? 'Returned home' : pending ? 'Returning…' : sending ? 'Requesting…' : 'Bring home',
    detail: error || (done ? 'His session has ended.' : pending ? 'Finishing this hand. Chips settle when it ends.'
      : sending ? 'Asking him to finish the hand…' : 'Finishes this hand, then returns home.'),
    pending: sending || pending, error, request,
  };
}
