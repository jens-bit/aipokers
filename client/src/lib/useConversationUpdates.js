import { useEffect, useRef } from 'react';
import { appendSavedReports, hydrateSavedHistory, syncSavedProposal } from './conversationReports.js';

// Restore the saved conversation once, then append only private activity
// reports and reconcile the current actionable proposal. Drafts live outside
// this state, and local pending messages are never replaced by a profile read.
export function useConversationUpdates({ agent, privateRead, seededAgent, setChat, mkMsg }) {
  const state = useRef(null);
  const agentId = agent?.id;
  useEffect(() => {
    if (state.current?.agentId !== agentId) state.current = { agentId, hydrated: false, closed: new Set() };
    if (!agentId || seededAgent !== agentId) return;
    const scope = state.current;
    const hydrate = !scope.hydrated && privateRead?.id === agentId
      && Number(privateRead.ownerCommandRevision ?? 0) >= Number(agent.ownerCommandRevision ?? 0);
    if (hydrate) scope.hydrated = true;
    setChat(current => {
      let next = hydrate ? hydrateSavedHistory(current, agent.chatHistory, mkMsg) : current;
      next = appendSavedReports(next, agent.chatHistory, mkMsg);
      return syncSavedProposal(next, agent.proposal, scope.closed, mkMsg);
    });
    // mkMsg uses the caller's stable ID ref, not its render identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, agent?.chatHistory, agent?.proposal, agent?.ownerCommandRevision, privateRead, seededAgent, setChat]);
}
