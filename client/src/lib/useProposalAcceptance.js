import { useEffect, useRef, useState } from 'react';
import { getTelegramInitData, getUserId } from './telegram.js';

// Both conversation surfaces use the saved server receipt. Accepting a change
// is an action, not a prompt for the model to invent an acknowledgement.
export function useProposalAcceptance({ agentId, chat, setChat, mkMsg, acceptAgent, onRefresh }) {
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const generation = useRef(0);
  const busy = useRef(false);
  const accepted = useRef(new Set());
  useEffect(() => {
    const token = ++generation.current;
    busy.current = false; accepted.current.clear();
    setAccepting(false); setError('');
    return () => { if (generation.current === token) generation.current++; };
  }, [agentId]);

  async function acceptProposal(msgId) {
    const card = chat.find(m => m._id === msgId && m.role === 'proposal');
    if (!agentId || !card || busy.current || accepted.current.has(msgId)) return false;
    busy.current = true;
    const token = generation.current;
    const proposalId = String(card.proposal?.id ?? card.proposal?.createdAt ?? '');
    setAccepting(true); setError('');
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/proposal/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId: getUserId(), proposalId }),
      });
      const data = await response.json();
      if (generation.current !== token) return true;
      if (!response.ok) throw new Error(response.status === 409
        ? 'This proposal has changed. Reopen the conversation to review the current change.'
        : 'Could not save this change. Try Accept change again.');
      const receipt = data.proposalAcceptance;
      if (data.id !== agentId || receipt?.proposalId !== proposalId || typeof receipt.reply !== 'string' || !receipt.reply.trim()) {
        throw new Error('Could not confirm this change. Try Accept change again.');
      }
      accepted.current.add(msgId);
      acceptAgent({ agent: data, proposalAcceptance: receipt });
      setChat(prev => [...prev.map(m => m._id === msgId ? { ...m, role: 'accepted' } : m), mkMsg('assistant', receipt.reply)]);
      // The action is already saved. A background refresh failure cannot turn
      // that receipt into a failed action or cause another acceptance request.
      try { Promise.resolve(onRefresh?.(data)).catch(() => {}); } catch { /* receipt remains valid */ }
      return true;
    } catch (err) {
      if (generation.current !== token) return true;
      setError(err.message?.startsWith('This proposal') || err.message?.startsWith('Could not')
        ? err.message : 'Could not save this change. Try Accept change again.');
      return false;
    } finally {
      if (generation.current === token) { busy.current = false; setAccepting(false); }
    }
  }
  return { accepting, acceptProposal, error };
}
