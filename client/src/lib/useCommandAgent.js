import { useMemo, useState } from 'react';

// A command carries the authenticated server projection that earned its reply.
// Use it immediately; only a parent projection at this command revision or
// later can supersede it. Object identity cannot date an in-flight snapshot.
export function useCommandAgent(source) {
  const [receipt, setReceipt] = useState(null);
  const sameAgent = !!source?.id && receipt?.agent?.id === source.id;
  const agent = useMemo(() => {
    if (!sameAgent) return source;
    const receivedRevision = Number(receipt.agent.ownerCommandRevision ?? 1);
    const sourceRevision = Number(source.ownerCommandRevision ?? 0);
    if (receivedRevision > sourceRevision) return receipt.agent;
    if (receivedRevision < sourceRevision) return source;
    // A fresh private read can fill a compact projection at revision zero.
    // A later parent projection at the same revision still owns lifecycle
    // updates, while omitted private fields retain their authenticated value.
    return receipt.source === source ? { ...source, ...receipt.agent } : { ...receipt.agent, ...source };
  }, [receipt, sameAgent, source]);
  const accept = data => {
    if (source?.id && (data?.command || data?.proposalAcceptance || data?.profileRefresh) && data.agent?.id === source.id) {
      setReceipt(previous => previous?.agent?.id === data.agent.id
        && Number(previous.agent.ownerCommandRevision ?? 0) > Number(data.agent.ownerCommandRevision ?? 0)
        ? previous : { agent: data.agent, source });
    }
  };
  return [agent, accept];
}
