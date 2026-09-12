import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

const noop = () => {};
const inactive = { stage: null, agentId: null, agentName: null, begin: noop, advance: noop, dismiss: noop };
const FirstRunGuide = createContext(inactive);
const stages = new Set(['agent', 'table', 'watch', 'door', 'live', 'live-chat', 'live-agent', 'live-opponent']);
const legacyPrefix = 'railbird.practice.v1:';
const keyFor = owner => `railbird.guide.v1:${owner}`;
const emptyRun = owner => ({ owner, stage: null, agentId: null, agentName: null });

function validId(value) {
  return (typeof value === 'string' && value.trim().length > 0)
    || (typeof value === 'number' && Number.isFinite(value));
}

function hasSeen(owner) {
  try {
    const value = JSON.parse(localStorage.getItem(keyFor(owner)));
    if (value?.version === 1 && value.seen === true) return true;
  } catch { /* A missing or unreadable record does not prevent this session. */ }

  // The old reader defaults to step zero even when no record exists. Inspect
  // actual records so a previous first step counts, but a new owner does not.
  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key?.startsWith(legacyPrefix)) continue;
      try {
        const pair = JSON.parse(key.slice(legacyPrefix.length));
        if (!Array.isArray(pair) || pair.length !== 2 || !pair.every(validId) || String(pair[0]) !== owner) continue;
        const value = JSON.parse(localStorage.getItem(key));
        if (value?.version === 1 && Number.isInteger(value.step) && value.step >= 0 && value.step <= 9) return true;
      } catch { /* Ignore this malformed record and keep checking the owner. */ }
    }
  } catch { /* Blocked storage falls back to the provider's owner set. */ }
  return false;
}

function remember(owner) {
  try { localStorage.setItem(keyFor(owner), JSON.stringify({ version: 1, seen: true })); }
  catch { /* Navigation still works, and this provider remembers the owner. */ }
}

export function FirstRunGuideProvider({ ownerId, enabled = true, children }) {
  const owner = validId(ownerId) ? String(ownerId) : null;
  const currentOwner = useRef(owner);
  currentOwner.current = owner;
  const currentEnabled = useRef(enabled);
  currentEnabled.current = enabled;
  const consumed = useRef(new Set());
  const [run, setRun] = useState(() => emptyRun(owner));

  // Reset before rendering children, not in an effect after the old owner's
  // identity has already reached a screen. Switching back cannot resume it.
  if (run.owner !== owner) setRun(emptyRun(owner));
  const visible = enabled && run.owner === owner ? run : emptyRun(owner);

  const begin = useCallback(agent => {
    if (!enabled || !currentEnabled.current || owner === null || currentOwner.current !== owner || !validId(agent?.id) || agent.guest || agent.visiting) return;
    if (consumed.current.has(owner)) return;
    const seen = hasSeen(owner);
    // Consume synchronously: simultaneous Home effects cannot bind a second
    // agent, even before React renders the first update or if storage fails.
    consumed.current.add(owner);
    remember(owner);
    if (seen) return;
    setRun({ owner, stage: 'agent', agentId: agent.id, agentName: typeof agent.name === 'string' ? agent.name : '' });
  }, [owner, enabled]);

  const advance = useCallback(stage => {
    if (!enabled || !currentEnabled.current || currentOwner.current !== owner || !stages.has(stage)) return;
    setRun(previous => previous.owner === owner && previous.stage ? { ...previous, stage } : previous);
  }, [owner, enabled]);

  const dismiss = useCallback(() => {
    if (currentOwner.current !== owner) return;
    setRun(previous => previous.owner === owner && previous.stage ? emptyRun(owner) : previous);
  }, [owner]);

  const value = useMemo(() => ({
    stage: visible.stage,
    agentId: visible.agentId,
    agentName: visible.agentName,
    begin,
    advance,
    dismiss,
  }), [visible.stage, visible.agentId, visible.agentName, begin, advance, dismiss]);
  return <FirstRunGuide.Provider value={value}>{children}</FirstRunGuide.Provider>;
}

export function useFirstRunGuide() {
  return useContext(FirstRunGuide);
}
