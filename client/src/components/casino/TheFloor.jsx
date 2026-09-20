// client/src/components/casino/TheFloor.jsx — CASINO-2 job 5, wave 58
//
// THE FLOOR, FROM ABOVE.
//
// Ported from design-refs/mood-floor58.jsx (TheFloor, MiniFelt, TinyGhost,
// FloorBar, FloorStairs), which landed while CASINO-2 was being built and is
// this job's brief drawn properly. The ref states what it is for:
//
//   "THE FLOOR is what the casino has been missing: a room you look into.
//    Board 27's casino was three doorways and a board — accurate, and
//    completely abstract. This is the floor itself from above, six to eight
//    live felts with tiny bodies in the seats, a bar with a few standing at
//    it, and the board by the stairs. The only text on it is the stakes per
//    felt, because a floor you have to read is a list."
//
// The first pass at this job was a grid of felt cards. It was accurate and it
// was a list — which is the exact thing the ref names as the failure. A room
// is not a list of its tables any more than a bar is a list of its stools.
//
// FOUR THINGS THE REF DECIDES, and this file keeps all four:
//
//   1. A FELT IS AN ELLIPSE WITH BODIES ON ITS RIM. Not a card, not a tile. It
//      is a table seen from above, and its only label is its stake, because
//      "a floor you have to read is a list".
//   2. A BODY IS 14px OF HOOD AND TWO EYES. Any more detail at this size is
//      noise, and the face system's own tiers already say so. Yours is the one
//      with a teal rim and teal eyes: finding him is never a search.
//   3. THE ROOM IS NEVER A MAP OF ALL 1,600. It is the room you are standing
//      in. Six felts is the plan; a busier room says how many more it holds
//      rather than drawing them smaller until none of them is legible.
//   4. THE FURNITURE IS THE POINT. The bar exists so that "not playing" has
//      somewhere to be, and the stairs exist so the building has floors.
//
// AND ONE THING THE REF CANNOT DECIDE, because it is hand-placed: where N
// felts go. `floorPlan` derives that, and reproduces the ref's own six exactly
// — the jitter tables below are its coordinates, read back out.

import { useEffect, useRef, useState } from 'react';
import { HOODS, GLOWS, storedIdentity } from '../../lib/identity.js';
import { M_TEAL as AGENT_TEAL } from '../floor/atoms.jsx';
const M_TEAL = 'var(--accent)';
const M_GOLD = 'var(--gold-reward)';
const M_RED = 'var(--error)';
import { pillName } from '../../lib/names.js';
import { GhostClothes } from '../system/GhostClothes.jsx';

const MONO = '"JetBrains Mono",ui-monospace,monospace';
const OSWALD = '"Oswald","Helvetica Neue",sans-serif';
const M_MUTED = 'var(--text-muted)';

// The coordinate space the ref drew in. Everything below is in these units and
// the whole plan is scaled to whatever width it is given, so the room holds
// its proportions on a phone and on a desk.
export const FLOOR_W = 390;
export const FLOOR_H = 470;

// Six felts is the room. The ref: "It is never a map of all 1,600: it is the
// room you are standing in." A seventh drawn smaller helps nobody.
export const FLOOR_CAP = 6;

// The ref's own six, read back out as offsets. Column x and row y are regular;
// these are what stop the plan reading as a spreadsheet — no two rims touch
// and the gaps between them read as walkways.
const COL_X = [64, 190, 314];
const ROW_Y = 108;
const ROW_GAP = 128;
const DX = [0, 0, 0, 6, 6, 6];
const DY = [0, -20, 4, 0, -16, 8];
const RADII = [44, 40, 44, 42, 46, 40];

/**
 * Where N felts stand on the floor.
 *
 * Deterministic: the same room always draws the same way, so a felt does not
 * hop across the room when the pot on another one changes. Reproduces the ref's
 * hand-placed six exactly for n <= 6, which is the test that it is a port.
 */
export function floorPlan(n) {
  const count = Math.max(0, Math.min(FLOOR_CAP, Math.floor(n) || 0));
  return Array.from({ length: count }).map((_, i) => {
    const col = i % 3;
    const row = Math.floor(i / 3);
    return {
      x: COL_X[col] + DX[i % 6],
      y: ROW_Y + row * ROW_GAP + DY[i % 6],
      r: RADII[i % 6],
    };
  });
}

/**
 * A body at floor scale: a hood and two eyes, and nothing else.
 *
 * Saved seat identities take precedence. Anonymous scenery keeps the reference
 * index palette; the teal ownership rim remains independent of eye colour.
 */
export function TinyGhost({ i = 0, mine = false, hot = false, size = 14, identity = null, equipment = {} }) {
  const look = storedIdentity({ identity });
  const hood = look?.hood ?? HOODS[((i * 5 + 1) % 6 + 6) % 6];
  const glow = look?.glow ?? GLOWS[((i * 3) % 6 + 6) % 6];
  return (
    <svg
      width={size} height={size} viewBox="0 0 80 80" aria-hidden
      className="csn-tiny" data-hood={look?.hood.id}
      data-mine={mine ? 'true' : undefined}
      style={{ display: 'block', animation: `casino-bob ${4 + (i % 3)}s ease-in-out ${(i % 5) * 0.4}s infinite` }}
    >
      <path
        d="M40 8 C58 8 70 20 70 38 L70 68 C70 76 62 75 58 79 C54 83 46 83 40 79 C34 83 26 83 22 79 C18 75 10 76 10 68 L10 38 C10 20 22 8 40 8Z"
        fill={hood.top}
        stroke={mine ? `color-mix(in srgb, ${M_TEAL} 60%, transparent)` : 'rgba(0,0,0,0.5)'}
        strokeWidth={mine ? 4 : 2}
      />
      {/* the eyes narrow when the table is hot — the one expression a 14px
          body has room for */}
      <ellipse cx="29" cy="40" rx="6" ry={hot ? 4 : 7} fill={look?.glow.c ?? (mine ? AGENT_TEAL : glow.c)} />
      <ellipse cx="51" cy="40" rx="6" ry={hot ? 4 : 7} fill={look?.glow.c ?? (mine ? AGENT_TEAL : glow.c)} />
      <GhostClothes equipment={equipment} cy={40}/>
    </svg>
  );
}

/** Where a seat sits on the rim, with the dealer's gap centred on the bottom. */
export function seatAngle(index, n) {
  const gap = 1.0;
  return (Math.PI / 2 + gap / 2) + (index + 0.5) * (Math.PI * 2 - gap) / Math.max(1, n);
}

/**
 * One felt, seen from above. An ellipse, bodies around its rim, a pot dot, and
 * its stake — which is the only text a felt is allowed.
 *
 * `mineSeat` is the index ON THE RIM of your own man, not his seat number at
 * the table: the rim draws whoever is there in order, and a table where seats
 * 0 and 4 are taken puts them side by side.
 */
function Felt({ felt, place, index, mineSeat = -1, mineName = null, onWatch }) {
  const bodies = Math.max(0, Math.min(9, felt.seated || felt.seats?.length || 0));
  const hot = !!felt.hot;
  const label = felt.blinds || '';
  const seats = [...(felt.seats ?? [])].sort((a, b) => a.seat - b.seat);
  const action = felt.lastAction?.handNumber === felt.handNumber ? felt.lastAction : null;
  const actor = seats.findIndex(s => s.seat === action?.seat);
  const angle = actor >= 0 ? seatAngle(actor, bodies) : 0;
  const [now, setNow] = useState(Date.now);
  const chat = felt.recentChat;
  useEffect(() => {
    if (!chat?.expiresAt) return undefined;
    const timer = setTimeout(() => setNow(Date.now()), Math.max(0, chat.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [chat?.seq, chat?.expiresAt]);
  const speaking = chat?.expiresAt > Math.max(now, Date.now()) && seats.some(s => s.seat === chat.seat);

  const inner = (
    <>
      {hot && (
        <span className="csn-felt58__heat" style={{
          background: `radial-gradient(ellipse, color-mix(in srgb, ${M_RED} 18.04%, transparent) 0%, transparent 68%)`,
        }} />
      )}
      {mineSeat >= 0 && <span className="csn-felt58__ring" style={{ border: `1px solid ${M_TEAL}`, boxShadow: `0 0 14px color-mix(in srgb, ${M_TEAL} 33.33%, transparent)` }} />}
      <span className="csn-felt58__cloth" style={{
        background: hot
          ? 'radial-gradient(ellipse at 50% 38%, color-mix(in srgb, var(--felt-center) 88%, var(--gold-highlight)) 0%, var(--felt-edge) 74%)'
          : 'radial-gradient(ellipse at 50% 38%, var(--felt-center) 0%, var(--felt-edge) 76%)',
        border: `1px solid ${hot ? `color-mix(in srgb, ${M_RED} 36.08%, transparent)` : 'var(--felt-line)'}`,
      }} />

      <span className="csn-felt58__board" aria-hidden="true">
        {(felt.board ?? []).slice(0, 5).map(card => <span key={`${felt.handNumber}-${card}`} data-floor-card={card}
          className="csn-felt58__card" style={{ '--suit': /[hd]$/i.test(card) ? '#C6494C' : '#161C1A' }} />)}
      </span>
      {actor >= 0 && action.chips > 0 && <span key={`${felt.handNumber}-${action.seq}`} data-floor-push={action.seat}
        className="csn-felt58__push" aria-hidden="true" style={{ '--from-x': `${Math.cos(angle) * place.r}px`, '--from-y': `${Math.sin(angle) * place.r * .75}px` }}>
        <i /><i />{action.chips >= felt.bigBlind * 8 && <i />}
      </span>}

      {/* the pot: one gold dot, the smallest thing that says money. Drawn only
          when there IS money — a felt between hands has nothing in the middle,
          and a dot that is always there stops meaning anything. */}
      {felt.pot > 0 && (
        <span className="csn-felt58__pot" style={{
          width: hot ? 7 : 5, height: hot ? 7 : 5,
          background: M_GOLD, boxShadow: `0 0 ${hot ? 9 : 5}px ${M_GOLD}`,
        }} />
      )}

      {Array.from({ length: bodies }).map((_, i) => {
        const th = seatAngle(i, bodies);
        return (
          <span
            key={i}
            className="csn-felt58__seat"
            style={{ left: `${50 + Math.cos(th) * 52}%`, top: `${50 + Math.sin(th) * 56}%` }}
          >
            <TinyGhost i={i + place.x} mine={i === mineSeat} hot={hot} identity={seats[i]?.identity} equipment={seats[i]?.equipment}/>
            {seats[i]?.inHand && <span key={felt.handNumber} className="csn-felt58__backs" aria-hidden="true"><i /><i /></span>}
          </span>
        );
      })}

      {speaking && <span key={chat.seq} className="csn-felt58__bubble" aria-hidden="true"><span>{chat.text.split(/\s+/).slice(0, 12).join(' ')}</span></span>}

      {label && (
        <span className="csn-felt58__stake" style={{
          fontFamily: MONO, fontSize: 8, color: hot ? M_RED : 'var(--text-primary)',
        }}>{label}</span>
      )}
    </>
  );

  const style = {
    left: place.x, top: place.y, width: place.r * 2, height: place.r * 1.5,
  };

  const label58 = mineName
    ? `Watch ${mineName} at this table`
    : `Watch table ${felt.tableId}`;

  // `data-mine` is a fact about the felt, not about whether it is tappable, so
  // it rides both branches.
  if (!onWatch) {
    return (
      <div
        className="csn-felt58"
        data-table={felt.tableId}
        data-hot={hot ? 'true' : undefined}
        data-mine={mineSeat >= 0 ? 'true' : undefined}
        style={style}
      >
        {inner}
      </div>
    );
  }
  return (
    <button
      type="button"
      className="csn-felt58"
      data-table={felt.tableId}
      data-hot={hot ? 'true' : undefined}
      data-mine={mineSeat >= 0 ? 'true' : undefined}
      style={style}
      aria-label={label58}
      onClick={() => onWatch(felt.tableId)}
    >
      {inner}
    </button>
  );
}

/**
 * The bar along the bottom wall.
 *
 * The ref stands four anonymous bodies at it. There is no "who is at the bar"
 * on the wire, and four invented ones would be the only thing on this floor
 * that is not true — so the counter is drawn as furniture (it is why "not
 * playing" has somewhere to be) and the only bodies at it are YOURS: an agent
 * this room contains who is not at one of its felts is a man looking for a
 * seat, which is exactly what standing at the bar means.
 */
function FloorBar({ standing = [], onOpen = null }) {
  const Tag = onOpen ? 'button' : 'div';
  return (
    <Tag className="csn-floor58__bar" {...(onOpen ? {type:'button', onClick:onOpen, 'aria-label':'Open casino bar'} : {})}>
      <span className="csn-floor58__counter" style={{ boxShadow: `0 -3px 14px color-mix(in srgb, ${M_GOLD} 7.84%, transparent)` }} />
      {standing.length > 0 && (
        <div className="csn-floor58__standing">
          {standing.map((agent, i) => (
            <span key={agent.id} title={pillName(agent.name)}>
              <TinyGhost i={i * 7 + 3} mine identity={agent.identity} equipment={agent.equipment}/>
            </span>
          ))}
        </div>
      )}
      <span className="csn-floor58__barlabel" style={{
        fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.16em', color: `color-mix(in srgb, ${M_GOLD} 70.2%, transparent)`,
      }}>THE BAR</span>
    </Tag>
  );
}

/**
 * THE STAIRCASE — UI-3 job A.
 *
 * The board that used to be bolted beside these stairs is gone (there is one
 * room now, and no wall left to hang it on), so the stairs go back to being
 * only what they always also were: the one piece of furniture in the room
 * that says how to leave it. Tapping them goes home — the plainest reading of
 * a staircase there is, and the fix for a building that used to have three
 * rooms and now has none to walk between.
 */
function FloorStairs({ onHome = null }) {
  const treads = (
    <div className="csn-floor58__treads" aria-hidden>
      {[9, 14, 19, 24, 29, 34].map((h, i) => (
        <span key={h} style={{
          height: h,
          background: `linear-gradient(180deg, color-mix(in srgb, var(--gold-reward) ${(0.06 + i * 0.02) * 100}%, transparent) 0%, color-mix(in srgb, var(--text-primary) 2%, transparent) 100%)`,
        }} />
      ))}
    </div>
  );
  const plaque = (
    <span className="csn-floor58__plaque" style={{ border: `1px solid color-mix(in srgb, ${M_GOLD} 23.92%, transparent)` }}>
      <span style={{ fontFamily: OSWALD, fontSize: 6, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD }}>
        HOME
      </span>
    </span>
  );

  if (!onHome) {
    return <div className="csn-floor58__stairs">{treads}{plaque}</div>;
  }
  return (
    <button type="button" className="csn-floor58__stairs" aria-label="The staircase — go home" onClick={onHome}>
      {treads}{plaque}
    </button>
  );
}

/**
 * THE FLOOR.
 *
 * @param felts    the room's ROOM_TABLES entries, in the order they should be
 *                 placed (yours first — see FloorView.feltsForRoom)
 * @param mineAt   { [tableId]: agent } — your own men, by the table they are at
 * @param standing your agents in this room who are at no felt
 * @param onWatch  (tableId) => watch it
 * @param onHome   (tableId) => go home; wired to the staircase (UI-3 job A)
 * @param width    the room's drawn width; the plan is scaled to it
 */
export function TheFloor({
  felts = [], mineAt = {}, standing = [], onWatch = null, onHome = null, onOpenBar = null, width = FLOOR_W, height = FLOOR_H, zoom = null, onZoom = null,
}) {
  const k = width / FLOOR_W;
  const shown = felts.slice(0, FLOOR_CAP);
  const plan = floorPlan(shown.length);

  const root = useRef(null), gesture = useRef(null), suppressClick = useRef(0);
  const focusedIndex = zoom ? shown.findIndex(f => f.tableId === zoom.tableId) : -1;
  const focused = shown[focusedIndex], place = plan[focusedIndex];
  useEffect(() => {
    const el = root.current;
    if (!el || !onZoom || !onWatch) return;
    const distance = ts => Math.hypot(ts[0].clientX-ts[1].clientX, ts[0].clientY-ts[1].clientY);
    const start = e => {
      // The room's pinch must never start its parent's dismiss-sheet drag.
      e.stopPropagation();
      if (e.touches.length !== 2) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect(), ts = e.touches;
      const x=((ts[0].clientX+ts[1].clientX)/2-rect.left)/k;
      const y=((ts[0].clientY+ts[1].clientY)/2-rect.top)/k;
      let index = focusedIndex;
      if (index < 0) index = plan.map((p,i)=>({i,d:Math.hypot(x-p.x,y-p.y),r:p.r})).sort((a,b)=>a.d-b.d).find(p=>p.d<p.r*1.8)?.i ?? -1;
      gesture.current={distance:distance(ts), index, zoomed:focusedIndex>=0, done:false};
    };
    const move = e => {
      const g=gesture.current;
      if (!g || e.touches.length!==2) return;
      e.preventDefault(); e.stopPropagation(); suppressClick.current=Date.now()+500;
      if(g.done || g.index<0 || g.distance<8) return;
      const ratio=distance(e.touches)/g.distance, target=shown[g.index];
      if(ratio>1.3 && target) {
        g.done=true;
        if(g.zoomed) onWatch(target.tableId);
        else onZoom({tableId:target.tableId,blinds:target.blinds});
      } else if(ratio<.75 && g.zoomed) { g.done=true; onZoom(null); }
    };
    const end=e=>{ e.stopPropagation(); if(e.touches.length===0) gesture.current=null; };
    el.addEventListener('touchstart',start,{passive:false});
    el.addEventListener('touchmove',move,{passive:false});
    el.addEventListener('touchend',end);el.addEventListener('touchcancel',end);
    return()=>{el.removeEventListener('touchstart',start);el.removeEventListener('touchmove',move);el.removeEventListener('touchend',end);el.removeEventListener('touchcancel',end);};
  }, [shown, k, focusedIndex, onWatch, onZoom]);
  const camera = focused ? 'translate('+(width/2-place.x*k*2.3)+'px,'+(height*.46-place.y*k*2.3)+'px) scale('+(k*2.3)+')' : 'scale('+k+')';
  return (
    <div ref={root} className="csn-floor58" style={{ width, height }} data-testid="the-floor" data-zoom={focused?.tableId}
      onClickCapture={e=>{if(Date.now()<suppressClick.current){e.preventDefault();e.stopPropagation();}}}>

      <div
        className="csn-floor58__room"
        style={{ width: FLOOR_W, height: height / k, transform: camera }}
      >
        {/* the carpet, running away from the door */}
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className="csn-floor58__carpet" style={{ top: 40 + i * 42 }} />
        ))}

        <FloorStairs onHome={onHome} />

        {shown.map((felt, i) => {
          const agent = mineAt[felt.tableId] ?? null;
          // Which body on the rim is his. The rim is drawn in seat order, so
          // his place on it is his index among the seats that are taken.
          const seats = [...(felt.seats ?? [])].sort((a, b) => a.seat - b.seat);
          const mineSeat = agent
            ? seats.findIndex((s) => s.agentId && String(s.agentId) === String(agent.id))
            : -1;
          return (
            <Felt
              key={felt.tableId}
              felt={felt}
              place={plan[i]}
              index={i}
              mineSeat={mineSeat}
              mineName={agent?.name ?? null}
              onWatch={onWatch}
            />
          );
        })}

        <FloorBar standing={standing} onOpen={onOpenBar} />
      </div>
      {focused && <>
        <div className="csn-floor58__vignette" aria-hidden="true" />
        <button className="csn-floor58__watch" onClick={()=>onWatch?.(focused.tableId)}>Watch this table</button>
      </>}
    </div>
  );
}
