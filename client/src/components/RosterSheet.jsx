// client/src/components/RosterSheet.jsx — BUGS-A job 9
//
// EVERYBODY WHO WORKS FOR YOU, BEHIND THE AVATAR.
//
// The top-right avatar has been an inert silhouette with a `TODO: open profile
// drawer/sheet` next to it since the header was ported. And CASINO-1 took CHATS
// off the tab bar on the promise that the thread is reached from Home and from
// a profile — which is true, and leaves nowhere to answer "who have I got, and
// where are they all right now" when somebody is not standing in the room.
//
// This is that answer, and it is the roster the old CHATS list used to be: one
// row per agent, and the row IS the way into his thread.
//
// FOUR FACTS PER ROW, and no fifth:
//
//   face    the same MoodGhost the room and the felt draw. One drawing of a
//           man, wherever he appears.
//   name    whole (BUGS-A job 1), because a list of first words is a list of
//           strangers.
//   where   in the room's own words — at a table, in a named room, or at home.
//           This is the question the sheet exists to answer.
//   stack   what he is sitting behind, or the pocket he would sit down with
//           (agentView's stackOf — one definition of that number in the app).
//
// ...and the unread dot, which is not a fact about him but a fact about YOU:
// he has said something you have not read.
//
// It is a sheet and not a screen. The thing behind it — the room, the casino,
// whatever you were reading — keeps its place, and this comes down over it and
// goes away with the same finger gesture as every other sheet (job 5).

import { useEffect, useState } from 'react';

import { MoodGhost } from './system/MoodGhost.jsx';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { accentFor } from './floor/atoms.jsx';
import { heatOf, moodOf, presenceOf, stackOf, hasUnseenRecap } from './floor/agentView.js';
import { roomLabel } from './home/AwayWall.jsx';
import { pillName } from '../lib/names.js';
import { money } from '../lib/wallet.js';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';
import '../styles/roster.css';

/**
 * Where he is, in the room's own words.
 *
 * Never a status word ("active", "idle"): those are facts about a record. This
 * is a fact about a man, and the difference is the whole product.
 */
export function whereLine(agent) {
  const where = agent?.location?.where ?? null;
  const room = roomLabel(agent?.location?.room);
  if (presenceOf(agent) === 'playing' || where === 'table') {
    return room ? `at a table · ${room}` : 'at a table';
  }
  if (where && where !== 'home') return room ? `at the casino · ${room}` : 'at the casino';
  return 'at home';
}

/** Has he said something the owner has not read? */
export function hasUnread(agent) {
  return hasUnseenRecap(agent) || !!agent?.want;
}

export function RosterRow({ agent, index, onOpen }) {
  const stack = stackOf(agent);
  const unread = hasUnread(agent);
  return (
    <li>
      <button
        type="button"
        className="roster__row"
        data-agent={agent.id}
        onClick={() => onOpen?.(agent)}
        aria-label={`${agent.name} — ${whereLine(agent)}. Open his thread.`}
      >
        <span className="roster__face">
          <MoodGhost
            mood={moodOf(agent)}
            heat={heatOf(agent)}
            accent={accentFor(agent, index)}
            size={34}
            ring={false}
          />
          {unread ? <span className="roster__dot" data-testid={`roster-unread-${agent.id}`} /> : null}
        </span>
        <span className="roster__id">
          <span className="roster__name">{pillName(agent.name)}</span>
          <span className="roster__where">{whereLine(agent)}</span>
        </span>
        {stack !== null && <span className="roster__stack">{money(stack)}</span>}
      </button>
    </li>
  );
}

export function RosterSheet({ onOpenThread, onClose, onCreateAgent }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const drag = useSheetDrag(onClose);

  useEffect(() => {
    let alive = true;
    fetch(`/api/agents?userId=${encodeURIComponent(getUserId())}`, {
      headers: { 'x-telegram-init-data': getTelegramInitData() },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!alive) return;
        if (Array.isArray(body?.agents)) setAgents(body.agents);
        setLoading(false);
      })
      .catch(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="roster" role="dialog" aria-label="Your agents" data-testid="roster-sheet">
      <button type="button" className="roster__scrim" onClick={onClose} aria-label="Close" />
      <div
        className={`roster__panel${drag.dragging ? ' is-dragging' : ''}`}
        ref={drag.ref}
        style={drag.style}
        {...drag.handlers}
      >
        <span className="roster__grab" aria-hidden />
        <div className="roster__head">
          <span className="roster__title">Your agents</span>
          <span className="roster__count">
            {/* Same law as job 2: no count until the roster has answered. */}
            {loading ? '' : `${agents.length}`}
          </span>
          <button type="button" className="roster__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading ? (
          <p className="roster__empty">Reading the room…</p>
        ) : agents.length === 0 ? (
          <div className="roster__ftu">
            <p className="roster__empty">Nobody works for you yet.</p>
            {onCreateAgent && (
              <button type="button" className="roster__make" onClick={onCreateAgent}>
                Make an agent
              </button>
            )}
          </div>
        ) : (
          <ul className="roster__list no-scrollbar">
            {agents.map((agent, i) => (
              <RosterRow key={agent.id} agent={agent} index={i} onOpen={onOpenThread} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
