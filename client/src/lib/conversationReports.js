function reportKey(message) {
  return message?.role === 'assistant' && ['session', 'study'].includes(message.reportKind) && message.reportId != null
    ? `${message.reportKind}:${message.reportId}` : null;
}

export function savedChatMessage(message, mkMsg) {
  return { ...mkMsg(message.role, message.content), ...(reportKey(message)
    ? { reportKind: message.reportKind, reportId: message.reportId, at: message.at } : {}) };
}

// Roster refreshes may carry a completed activity while a reply or draft is
// still local. Merge only new report IDs; ordinary history never replaces or
// duplicates the open conversation's in-flight messages.
export function appendSavedReports(current, saved, mkMsg) {
  const known = new Set(current.map(reportKey).filter(Boolean));
  const added = [];
  for (const message of Array.isArray(saved) ? saved : []) {
    const key = reportKey(message);
    if (!key || known.has(key) || typeof message.content !== 'string') continue;
    known.add(key); added.push(savedChatMessage(message, mkMsg));
  }
  return added.length ? [...current, ...added] : current;
}

// Only initial saved bubbles are replaceable. A message typed after opening
// keeps its local ID, so pending send success/failure can still reconcile it.
export function hydrateSavedHistory(current, saved, mkMsg) {
  const history = (Array.isArray(saved) ? saved : []).filter(message => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string');
  if (!history.length) return current;
  const local = current.filter(message => !message._seeded);
  // Ordinary turns have no server ID. Repeated words are not evidence that a
  // saved turn is this local pending turn, so never trim history by its text.
  const localReports = new Set(local.map(reportKey).filter(Boolean));
  const seeded = history.filter(message => !localReports.has(reportKey(message)))
    .map(message => ({ ...savedChatMessage(message, mkMsg), _seeded: true }));
  return [...seeded, ...local];
}

export function proposalKey(proposal) {
  const id = proposal?.id ?? proposal?.createdAt;
  return id == null ? null : String(id);
}

export function syncSavedProposal(current, proposal, closed, mkMsg) {
  // Compact projections omit this field; omission is not withdrawal.
  if (proposal === undefined) return current;
  const wanted = proposalKey(proposal);
  for (const message of current) {
    const key = proposalKey(message.proposal);
    if (key && (message.role === 'accepted' || (message.role === 'proposal' && key !== wanted))) closed.add(key);
  }
  const next = current.filter(message => message.role !== 'proposal' || (proposalKey(message.proposal) === wanted && !closed.has(wanted)));
  if (wanted && !closed.has(wanted) && !next.some(message => proposalKey(message.proposal) === wanted)) {
    next.push({ ...mkMsg('proposal'), proposal });
  }
  return next.length === current.length && next.every((message, index) => message === current[index]) ? current : next;
}
