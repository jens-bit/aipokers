// Private conversation entries for completed activities. The event key is
// independent of the short chat window: reading or trimming a conversation
// must not make a completed activity new again. No model or notification call.
export function appendOwnerReport(agent, { kind, id, content, at = Date.now() } = {}) {
  if (!agent || !['session', 'study'].includes(kind) || id == null || !String(id) || typeof content !== 'string' || !content.trim()) return null;
  const reportId = String(id).slice(0, 160);
  const key = `${kind}:${reportId}`;
  const reported = Array.isArray(agent.ownerReportIds) ? agent.ownerReportIds : [];
  if (reported.includes(key)) return null;
  const report = { role: 'assistant', content: content.trim().slice(0, 800), reportKind: kind, reportId, at };
  agent.ownerReportIds = [...reported, key].slice(-32);
  agent.chatHistory = [...(Array.isArray(agent.chatHistory) ? agent.chatHistory : []), report].slice(-12);
  agent.ownerCommandRevision = Math.max(0, Number(agent.ownerCommandRevision) || 0) + 1;
  return report;
}

export function sessionReportText({ hands, net, opener = '' } = {}) {
  const count = Number.isFinite(hands) ? Math.max(0, Math.floor(hands)) : null;
  const played = count == null ? 'My session is finished' : `I finished ${count} hand${count === 1 ? '' : 's'}`;
  const amount = Number.isFinite(net) ? `${net > 0 ? '+' : net < 0 ? '−' : ''}$${Math.abs(Math.round(net)).toLocaleString('en-US')}` : null;
  return `${played}${amount == null ? '' : ` at ${amount} net`}.${typeof opener === 'string' && opener.trim() ? ` ${opener.trim()}` : ''}`;
}
