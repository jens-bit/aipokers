// Home television: live tables, recorded household hands, or the casino board.

import { useEffect, useState } from 'react';

import { identityOf } from '../../lib/identity.js';
import { PlayingCard } from '../system/PlayingCard.jsx';
import { FLAGS } from '../replay/timeline.js';
import { pillName, shortName } from '../../lib/names.js';
import { money } from '../../lib/wallet.js';

export const ROOMS_URL = '/api/rooms';

/**
 * Which of yours the set is showing.
 *
 * The one actually IN a hand, and the biggest pot of them if more than one is —
 * a set showing the quietest table in the building is a set nobody looks at.
 */
export function onScreen(away = []) {
  const live = away.filter((a) => a?.liveGame?.tableId);
  if (live.length === 0) return null;
  return live.reduce((best, a) => (
    (Number(a.liveGame.pot) || 0) > (Number(best.liveGame.pot) || 0) ? a : best
  ), live[0]);
}

/** C7: live takes priority; otherwise a household's own recorded hand is tape. */
export function tvProgramme(home = [], away = []) {
  const live = onScreen(away);
  if (live) return { kind:'live', agent:live };
  if (away.length || !home.length) return { kind:'casino' };
  const studying = home.find(a => !a.guest && (a.study || a.routine?.key === 'tape'));
  if (studying) {
    const records = studying.sessionFlagged ?? [];
    const hand = studying.study?.handNumber != null
      ? records.find(h => String(h.handNumber) === String(studying.study.handNumber))
      : [...records].sort((a,b)=>(b.flaggedAt??0)-(a.flaggedAt??0))[0];
    return { kind:'tape', agent:studying, hand:hand ?? null };
  }
  const recorded = home.filter(a=>!a.guest).flatMap(agent => (agent.sessionFlagged ?? [])
    .filter(hand=>hand?.handNumber != null && Array.isArray(hand.streets))
    .map(hand=>({agent,hand}))).sort((a,b)=>(b.hand.flaggedAt??0)-(a.hand.flaggedAt??0));
  return { kind:'tape', ...(recorded[0] ?? {agent:null,hand:null}) };
}

/** The three rooms as the set writes them: stakes, and how many are running. */
export function useRooms(enabled) {
  const [rooms, setRooms] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    fetch(ROOMS_URL)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => { if (alive && Array.isArray(body?.rooms)) setRooms(body.rooms); })
      .catch(() => { /* no signal; the set says the room names and no more */ });
    return () => { alive = false; };
  }, [enabled]);
  return rooms;
}

export function CasinoOnTv({ away = [] }) {
  const showing = onScreen(away);
  const rooms = useRooms(!showing);

  if (showing) {
    const game = showing.liveGame;
    // C7a's five demo bodies become the actual occupied seats. A mid-hand
    // arrival is not in this list yet, so never append an imagined own seat.
    const seats = (Array.isArray(game.seats) ? game.seats : [])
      .map((seat, index) => seat && typeof seat === 'object'
        ? { ...seat, seat: Number.isInteger(seat.seat) ? seat.seat : index } : null)
      .filter(Boolean);
    const own = Number.isInteger(game.heroSeat) ? seats.findIndex(s => s.seat === game.heroSeat) : -1;
    const ring = own > 0 ? [...seats.slice(own), ...seats.slice(0, own)] : seats;
    const name = shortName(showing.name, showing.nickname);
    const blinds = typeof game.blinds === 'string' ? game.blinds.trim() : '';
    const board = Array.isArray(game.board) ? game.board.filter(c => /^[2-9TJQKA][cdhs]$/i.test(c)).slice(0, 5) : [];
    const actor = Number.isInteger(game.toAct) ? seats.find(seat => seat.seat === game.toAct) : null;
    const action = game.street === 'complete' ? 'Hand complete'
      : actor ? `${actor.seat === game.heroSeat ? name : actor.displayName ?? actor.name ?? 'Player'} to act`
        : game.street === 'waiting' ? 'Waiting for a hand' : 'Hand in progress';
    return (
      <span className="home-tv__live" data-testid="home-tv-felt" data-street={game.street ?? 'none'}>
        <span className="home-tv__live-backdrop" />
        <span className="home-tv__caption">{[name, blinds].filter(Boolean).join(' · ')}</span>
        <span className="home-tv__street">{game.street === 'complete' ? 'RESULT' : game.street ?? 'LIVE'}</span>
        <span className="home-tv__pot">POT {game.home ? Math.round(Number(game.pot) || 0) : money(Math.round(Number(game.pot) || 0))}</span>
        <span className="home-tv__cards" role="img" aria-label={`Board: ${board.length ? board.join(' ') : 'no community cards'}`}>
          {board.map(c => <PlayingCard key={c} rank={c[0].toUpperCase()} suit={c[1].toLowerCase()} w={24} h={32}/>)}
          {!board.length && <span className="home-tv__empty-board">No community cards</span>}
        </span>
        <span className="home-tv__footer">
        <span className="home-tv__seats" aria-hidden>{ring.map(seat => {
          const isOwn = seat.seat === game.heroSeat;
          const look = identityOf({ ...seat, name: seat.displayName ?? seat.name,
            identity: seat.identity ?? (isOwn ? showing.identity : null) });
          return (
            <span key={seat.seat} className={`home-tv__ghost${isOwn ? ' is-own' : ''}`}
              data-seat={seat.seat}>
              <svg width="10" height="10" viewBox="0 0 80 80">
              <path d="M40 8 C58 8 70 20 70 38 L70 68 C70 76 62 75 58 79 C54 83 46 83 40 79 C34 83 26 83 22 79 C18 75 10 76 10 68 L10 38 C10 20 22 8 40 8Z"
                fill={look.hood.top} stroke={isOwn ? '#00D4AAAA' : 'rgba(0,0,0,0.5)'} strokeWidth={isOwn ? 5 : 2} />
              <ellipse cx="29" cy="40" rx="7" ry="7" fill={look.glow.c} />
              <ellipse cx="51" cy="40" rx="7" ry="7" fill={look.glow.c} />
              </svg>
            </span>
          );
        })}</span>
        <span className="home-tv__action">{action}</span>
        </span>
        <span className="home-tv__live-signal" aria-hidden />
      </span>
    );
  }

  return (
    <span className="home-tv__board" data-testid="home-tv-board">
      <span className="home-tv__title">THE CASINO</span>
      <span className="home-tv__rooms">
        {(rooms ?? []).slice(0, 3).map((room) => (
          <span key={room.id} className="home-tv__room">
            <span className="home-tv__stakes">{shortStakes(room)}</span>
            <span className="home-tv__tables">
              {room.tables === 1 ? '1 table' : `${room.tables ?? 0} tables`}
            </span>
          </span>
        ))}
      </span>
      <span className="home-tv__live-dot" aria-hidden />
    </span>
  );
}

/** A recorded hand, with progress only while a real study is running. */
export function TapeOnTv({ agent, hand }) {
  const [now,setNow]=useState(Date.now);
  const study=agent?.study;
  useEffect(()=>{
    if (!study?.endsAt) return undefined;
    const timer=setInterval(()=>setNow(Date.now()),1000);
    return ()=>clearInterval(timer);
  },[study?.endsAt]);
  const duration=study?.endsAt-study?.startedAt;
  const progress=duration>0 ? Math.max(0,Math.min(1,(now-study.startedAt)/duration)) : null;
  const board=hand?.streets?.at(-1)?.board ?? [];
  return (
    <span className="home-tv__recording" data-testid="home-tape">
      <span className="home-tv__recording-title">{hand ? (FLAGS[hand.flagType]?.label ?? 'REPLAY') : 'TAPE ROOM'}</span>
      {hand ? <><span className="home-tv__recording-felt"/><span className="home-tv__recording-cards">{board.slice(0,5).map((c,i)=><PlayingCard key={i} rank={c[0]} suit={c[1]} w={6} h={9}/>)}</span><span className="home-tv__recording-caption">{pillName(agent?.name,8)} · #{hand.handNumber}</span></> : <span className="home-tv__recording-empty">Nothing on tape yet</span>}
      {progress != null && <span className="home-tv__recording-progress"><i style={{width:`${progress*100}%`}}/></span>}
    </span>
  );
}

/** "$10/$20" as the set has room to write it: "10/20". */
export function shortStakes(room) {
  const label = String(room?.stakes?.label ?? '');
  const stripped = label.replace(/\$/g, '');
  if (stripped) return stripped;
  const sb = room?.stakes?.smallBlind;
  const bb = room?.stakes?.bigBlind;
  return Number.isFinite(sb) && Number.isFinite(bb) ? `${sb}/${bb}` : '';
}
