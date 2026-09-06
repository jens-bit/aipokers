// client/src/components/casino/YourTables.jsx — CASINO-2 job 4
//
// YOUR TABLE, ONCE PER MAN.
//
// The casino screen is mostly about strangers: three doors into rooms with
// 1,600 people in them, and a board of pots that are almost all somebody
// else's. This is the block that is about YOURS, and the ref is blunt about
// what it is for — it is "the one block on this screen the owner opens the
// screen to see".
//
// So there is one page per agent and you flick between them. Not a list: a
// list of felts is four small pictures none of which you can read, and the
// question here is never "how are all of them doing at a glance" — the board
// answers that. It is "what is happening at HIS table", asked about one man at
// a time, which is what a carousel is.
//
// TWO RULES, and the second is the one that took the work.
//
//   1. A PAGE IS A MAN, not a table. Four agents, four pages, in roster order,
//      and the order does not change when one of them sits down or stands up —
//      a carousel that reorders itself under your thumb is one you cannot
//      learn.
//   2. NEVER A PLACEHOLDER GHOST. If he is not at a felt, his page says where
//      he actually is and offers to send him. It does NOT draw a quiet table
//      with him at it. The ref: "a miniature of a game he is not in would be
//      the one outright lie on the screen." So the felt is drawn from the live
//      snapshot or it is not drawn.
//
// The dots are the only chrome. They say how many men you have and which one
// you are looking at, and they are tappable because a dot you can see and
// cannot press is a worse control than no dot.

import { useCallback, useEffect, useRef, useState } from 'react';

import { MoodGhost } from '../system/MoodGhost.jsx';
import { accentFor, M_TEAL } from '../floor/atoms.jsx';
import { moodOf, heatOf } from '../floor/agentView.js';
import { money, pocketOf } from '../../lib/wallet.js';
import { pillName } from '../../lib/names.js';
import { feltForAgent } from '../../hooks/useCasinoRooms.js';
import { TableFelt } from './TableFelt.jsx';

const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const M_DIM = '#A1A1A1';
const M_MUTED = '#6B6B6B';

/**
 * Where he is, in the words the room uses.
 *
 * This is the line that stands in for a felt he is not at, so it has to be
 * true and specific. "Resting" is neither: every agent who is not playing is
 * resting, which makes it the same sentence on every empty page.
 */
export function whereLine(agent) {
  const pocket = pocketOf(agent);
  if (pocket?.broke || (pocket && pocket.balance <= 0)) return 'his pocket is empty';
  const where = agent?.location?.where;
  if (where === 'casino') return 'in the casino, looking for a seat';
  const routine = agent?.routine?.label;
  if (routine) return `at home · ${routine}`;
  if (agent?.fatigue === 'worn') return 'at home · worn out';
  return 'at home, waiting to be sent';
}

/** The page for a man who is not at a felt. Never a felt with nobody in it. */
function AwayPage({ agent, index, onSend }) {
  const pocket = pocketOf(agent);
  return (
    <div className="csn-your__away">
      <MoodGhost
        mood={moodOf(agent)}
        heat={heatOf(agent)}
        accent={accentFor(agent, index)}
        size={46}
        ring={false}
      />
      <div style={{ fontSize: 11.5, color: M_DIM, textAlign: 'center' }}>
        {`${pillName(agent.name)} is ${whereLine(agent)}`}
      </div>
      {pocket && (
        <div style={{ fontFamily: '"JetBrains Mono",ui-monospace,monospace', fontSize: 9.5, color: M_MUTED }}>
          {`pocket ${money(pocket.balance ?? 0)}`}
        </div>
      )}
      {onSend && (
        <button
          type="button"
          className="csn-your__send"
          onClick={() => onSend(agent)}
          style={{
            fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.12em',
            color: M_TEAL, border: `1px solid ${M_TEAL}66`, borderRadius: 8,
            padding: '5px 12px', background: 'transparent', cursor: 'pointer',
          }}
        >SEND HIM TO PLAY</button>
      )}
    </div>
  );
}

/**
 * The carousel.
 *
 * @param agents  your roster, in its own order
 * @param felts   ROOM_TABLES, so a page can find the live table its man is at
 * @param onWatch (tableId) => watch it
 * @param onSend  (agent)   => take him to the casino to be placed
 */
export function YourTables({ agents = [], felts = [], onWatch = null, onSend = null }) {
  const [page, setPage] = useState(0);
  const trackRef = useRef(null);

  // The page you are on is whichever one the track is scrolled to. Read from
  // the scroll rather than owned by React: the flick is the browser's, and a
  // dot that lags a finger by a frame is a dot that looks broken.
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setPage(Math.round(el.scrollLeft / el.clientWidth));
  }, []);

  // A roster that shrinks under you (an agent retired) must not leave the dots
  // pointing at a page that is gone.
  useEffect(() => {
    setPage((p) => Math.min(p, Math.max(0, agents.length - 1)));
  }, [agents.length]);

  const goTo = useCallback((i) => {
    const el = trackRef.current;
    setPage(i);
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' });
  }, []);

  if (agents.length === 0) {
    return (
      <div className="csn-your csn-your--none">
        <div style={{ fontSize: 11.5, color: M_MUTED, textAlign: 'center', lineHeight: 1.5 }}>
          You have nobody in the building yet.
        </div>
      </div>
    );
  }

  return (
    <div className="csn-your" data-testid="your-tables">
      <div className="csn-your__track" ref={trackRef} onScroll={onScroll}>
        {agents.map((agent, i) => {
          const felt = feltForAgent(felts, agent);
          return (
            <div className="csn-your__page" key={agent.id} data-agent={agent.id}>
              {felt ? (
                <TableFelt
                  felt={felt}
                  agentId={agent.id}
                  heroHole={agent?.liveGame?.heroHole ?? null}
                  accent={accentFor(agent, i)}
                  label={`YOUR TABLE · ${felt.blinds}`}
                  onWatch={onWatch}
                  ariaLabel={`Watch ${agent.name} at ${felt.blinds}`}
                />
              ) : (
                <AwayPage agent={agent} index={i} onSend={onSend} />
              )}
            </div>
          );
        })}
      </div>

      {agents.length > 1 && (
        <div className="csn-your__dots" role="tablist" aria-label="Your agents">
          {agents.map((agent, i) => (
            <button
              key={agent.id}
              type="button"
              role="tab"
              aria-selected={i === page}
              aria-label={pillName(agent.name)}
              className="csn-your__dot"
              data-on={i === page ? 'true' : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
