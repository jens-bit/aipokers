// Thread data for the desktop panel.
//
// Same endpoint contract as the mobile CHATS screen's AgentThread
// (ChatsScreen.jsx): GET /api/agents/:id/hands seeds the opener, POST
// /api/agents/chat sends, POST /api/agents/:id/proposal/accept commits a
// self-change. No new endpoints, no duplicated protocol.
//
// The draft is NOT held here — DesktopHome owns a per-agent draft map so a
// half-typed message survives switching agents. This hook remounts per agent;
// the draft must not.
import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';

// WIRE-1: the opener is HIS, and the server writes it — MOOD-2c puts it on the
// agent as `opener`, chosen by how hot he is and by the one hand he cannot let
// go of. The client stopped composing a greeting out of a win/loss tally: a
// scoreboard is not a hello, and three surfaces each building their own meant
// three different agents saying three different things about one session.
//
// RAISE-2 finished the job. The tally survived here as a fallback, and it was
// not a rare one: the server only wrote `opener` on one of its two session-end
// paths, and only when that path had a recap string, so an agent still at a
// table, an agent who had never finished a session, and any owner-initiated
// finish all fell through to it. Playtest read it every time.
//
// The server now always serves one (agentProfiles.openerForAgent — templates,
// no model call, so there is nothing to fail into). What is left here is a
// last-ditch for an unreachable or older server, and it is still a sentence he
// would say: `firstWords` is his own nature's line, already on the record.
const LAST_DITCH = 'Sit down. What do you want to know?';

export function openerFor(agent) {
  const served = agent?.opener;
  if (typeof served === 'string' && served.trim()) return served.trim();
  const born = agent?.firstWords;
  if (typeof born === 'string' && born.trim()) return born.trim();
  return LAST_DITCH;
}

export function useAgentThread(agent) {
  const userId = getUserId();
  const [chat, setChat] = useState([]);
  const [hasHands, setHasHands] = useState(false);
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [mood, setMood] = useState(null);
  const [cause, setCause] = useState(null);
  const [error, setError] = useState('');
  const sendBusy = useRef(false);
  const conversation = useRef(0);
  const msgIdRef = useRef(0);
  const mkMsg = (role, content) => ({ role, content, _id: ++msgIdRef.current });

  const agentId = agent?.id ?? null;

  useEffect(() => {
    const token = ++conversation.current;
    sendBusy.current = false;
    setSending(false);
    if (!agentId) return undefined;
    let cancelled = false;
    setChat([]); setHasHands(false);
    setMood(null);
    setCause(null);
    setError('');
    const startedAtId = msgIdRef.current;

    const seed = () => {
      if (cancelled) return;
      const history = Array.isArray(agent.chatHistory) ? agent.chatHistory.filter(m => ['user','assistant'].includes(m.role) && typeof m.content === 'string') : [];
      const msgs = history.length ? history.map(m => mkMsg(m.role,m.content)) : [mkMsg('assistant', openerFor(agent))];
      if (agent.proposal) msgs.push({ role: 'proposal', proposal: agent.proposal, _id: ++msgIdRef.current });
      setChat(prev => [...msgs, ...prev.filter(m => m._id > startedAtId)]);
    };

    fetch(
      `/api/agents/${encodeURIComponent(agentId)}/hands?userId=${encodeURIComponent(userId)}`,
      { headers: { 'x-telegram-init-data': getTelegramInitData() } },
    )
      .then((r) => r.ok ? r.json() : null)
      .then(data => { if(!cancelled) setHasHands(Array.isArray(data?.recentHands) && data.recentHands.length>0); seed(); })
      .catch(() => seed());

    return () => { cancelled = true; if (conversation.current === token) conversation.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const send = useCallback(async (text, { onResult } = {}) => {
    const content = text.trim();
    if (!content || !agentId || sendBusy.current) return false;
    sendBusy.current = true;
    const token = conversation.current;
    setError('');
    setSending(true);
    const pendingMessage = mkMsg('user', content);
    setChat((prev) => [...prev, pendingMessage]);
    try {
      const res = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId, content, existingAgentId: agentId }),
      });
      if (!res.ok) throw new Error('Chat refused');
      const data = await res.json();
      // The old panel must not restore its draft over another conversation.
      // The server still owns the saved turn; ignore only this stale UI update.
      if (conversation.current !== token) return true;
      const reply = (Array.isArray(data?.chat) ? data.chat : []).filter((m) => m?.role === 'assistant').pop();
      if (typeof reply?.content !== 'string' || !reply.content.trim()) throw new Error('Chat reply missing');
      setChat((prev) => [...prev, mkMsg('assistant', reply.content)]);
      if (data.pepTalk?.soothed && data.pepTalk.newState) {
        setMood(data.pepTalk.newState);
        setCause('feeling better');
      }
      onResult?.(data);
      return true;
    } catch {
      if (conversation.current !== token) return true;
      // The composer restores the draft for retry; an unsent line is not history.
      setChat(prev => prev.filter(message => message._id !== pendingMessage._id));
      setError('Could not send your message. Please try again.');
      return false;
    } finally {
      if (conversation.current === token) {
        sendBusy.current = false;
        setSending(false);
      }
    }
  }, [agentId, userId]);

  const acceptProposal = useCallback(async (msgId) => {
    if (!agentId) return;
    setAccepting(true);
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/proposal/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) throw new Error('accept failed');
      setChat((prev) => prev.map((m) => (m._id === msgId ? { ...m, role: 'accepted' } : m)));
      const chatRes = await fetch('/api/agents/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': getTelegramInitData() },
        body: JSON.stringify({ userId, content: 'My proposed change was just accepted.', existingAgentId: agentId }),
      });
      const reply = ((await chatRes.json()).chat || []).filter((m) => m.role === 'assistant').pop();
      if (reply) setChat((prev) => [...prev, mkMsg('assistant', reply.content)]);
    } catch {
      // silent — the card stays visible so the owner can retry
    } finally {
      setAccepting(false);
    }
  }, [agentId, userId]);

  return { chat, hasHands, sending, accepting, send, acceptProposal, error, moodOverride: mood, causeOverride: cause };
}
