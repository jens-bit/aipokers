// client/src/hooks/useGuestSession.js — GUEST-1 job 4
//
// What the app has to hold about a guest, which is less than it looks: whether
// this browser is one, and whether the wall is up.
//
// The wall has two producers and they arrive by completely different routes —
// a SESSION_END pushed over the socket, and a 403 from any of twenty fetches —
// so this hook is where they meet. Everything below the hook is spared knowing
// there are two.
//
// THE SESSION-END WALL RISES ONCE. His first casino night is the moment the
// ask has earned itself: he has seen the thing being sold. Every night after
// that, raising it again would be a nag, and the refusals are already there to
// ask at the moments where the answer actually unblocks something.

import { useCallback, useEffect, useRef, useState } from 'react';
import { isGuest, onClaimWall, openClaimWall, clearGuest } from '../lib/guest.js';

export function useGuestSession({ guestBoot = null } = {}) {
  const guest = isGuest();

  // The wall's reason, or null when it is down. A string rather than a boolean
  // so the thing that raised it survives into the DOM for the tests.
  const [wall, setWall] = useState(null);
  const [subject, setSubject] = useState({ agent: null, arrival: null });

  // His first night, and only his first. A ref rather than state: it gates an
  // effect and must never itself cause a render.
  const firstNightShown = useRef(false);

  // Every server refusal that carries `claim: true`, from anywhere, through
  // the catcher installed at boot.
  useEffect(() => {
    if (!guest) return undefined;
    return onClaimWall((reason) => setWall((was) => was ?? reason));
  }, [guest]);

  /**
   * His stay ended. Raises the wall the first time and never again — later
   * nights land in the room the way they do for anybody else.
   */
  const noteSessionEnd = useCallback((arrival, agent = null) => {
    if (!guest || !arrival || firstNightShown.current) return;
    firstNightShown.current = true;
    setSubject({ agent, arrival });
    openClaimWall('sessionEnd');
  }, [guest]);

  const closeWall = useCallback(() => setWall(null), []);

  /**
   * He was claimed. The guest id is dropped so getUserId() falls through to
   * the Telegram id, and the page is reloaded — every screen in the app is
   * holding data fetched under the old owner, and re-fetching all of it by
   * hand is a longer list than anybody will keep correct.
   */
  const onClaimed = useCallback(() => {
    clearGuest();
    setWall(null);
    try { window.location.reload(); } catch { /* no window — nothing to reload */ }
  }, []);

  return {
    isGuest: guest,
    // G1: a guest who has just been minted has nobody yet, so the app opens
    // into the flat with the recruiter already talking. A RETURNING guest does
    // not get the sheet thrown over his room — he has somebody in it, or the
    // room's own empty state offers the draft.
    draftOnBoot: guest && guestBoot === 'new',
    wall,
    wallAgent: subject.agent,
    wallArrival: subject.arrival,
    noteSessionEnd,
    closeWall,
    onClaimed,
  };
}
