import { useState } from 'react';

// A command carries the authenticated server projection that earned its reply.
// Use it immediately; only a parent projection at this command revision or
// later can supersede it. Object identity cannot date an in-flight snapshot.
export function useCommandAgent(source) {
  const [receipt, setReceipt] = useState(null);
  const sameAgent = !!source?.id && receipt?.agent?.id === source.id;
  const newer = Number(receipt?.agent?.ownerCommandRevision ?? 1) > Number(source?.ownerCommandRevision ?? 0);
  const agent = sameAgent && newer ? receipt.agent : source;
  const accept = data => {
    if (source?.id && data?.command && data.agent?.id === source.id) setReceipt({ agent: data.agent });
  };
  return [agent, accept];
}
