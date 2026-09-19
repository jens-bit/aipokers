import { useEffect, useRef, useState } from 'react';
import { play, withSoundGroup } from '../../lib/audio.js';
import { pillName } from '../../lib/names.js';
import { potAwards } from './PotAward.jsx';
import { settledAwards } from '../../lib/settledAwards.js';
import '../../styles/celebration.css';

// C8, mood-agent2.jsx. Positions and colours come from AG_BURST; the board
// shows mid-flight samples, while the product runs the stated 1.2s motion.
export const FIREWORK_MS = 1200;
export const BIG_WIN_BB = 100; // board 42 C8b; distinct from the public-feed event threshold
const BURSTS = [{x:92,y:150,c:'#00D4AA',d:0},{x:300,y:118,c:'#CDB380',d:260},{x:196,y:196,c:'#00D4AA',d:520}];

export function handCelebration(game, heroSeat = 0) {
  if (!game?.result || game.street !== 'complete') return null;
  const winners = game.result.winners ?? [];
  const mine = winners.filter(w => w.seat === heroSeat);
  const award = settledAwards(game.result).awards.find(w => w.seat === heroSeat);
  const amount = award ? award.amount : 0;
  const bb = amount != null && game.bigBlind > 0 ? amount / game.bigBlind : null;
  const busted = (game.seats ?? []).flatMap((seat,index)=>
    index !== heroSeat && seat?.playerId && seat.stack === 0 && seat.contribTotal > 0
      && !winners.some(w=>w.seat===index && w.amount>0) ? [{seat:index,name:seat.displayName || `Seat ${index+1}`}] : []);
  return {won:mine.length>0,amount,bb,big:mine.length>0 && bb!=null && bb>=BIG_WIN_BB,busted};
}

// The camera keeps its own payout in a shared pot. Otherwise the result follows
// the largest actual recipient. Visuals and sound must use the same winner;
// selecting a winner also keeps every lost seat, including the camera, in busts.
export function resultCelebration(game, cameraSeat = 0) {
  if (!game?.result || game.street !== 'complete') return null;
  const awards = potAwards(game);
  // An incomplete result may name a winner without an amount. Keep that fact
  // visible, but never turn the whole pot into his award or animate fake chips.
  const winners = (game.result.winners ?? []).filter(w => Number.isInteger(w?.seat) && game.seats?.[w.seat]
    && (w.amount == null || Number.isFinite(w.amount) && w.amount > 0));
  const focus = winners.find(a => a.seat === cameraSeat)
    ?? awards.slice().sort((a,b) => b.amount-a.amount || a.seat-b.seat)[0] ?? winners[0];
  if (!focus) return null;
  const entries = (game.result.winners ?? []).filter(w => w?.seat === focus.seat);
  const knownAmount = entries.every(w => Number.isFinite(w.amount) && w.amount >= 0);
  const result = handCelebration(game, focus.seat);
  return { ...result, ...(knownAmount ? {} : {amount:null,bb:null,big:false}),
    seat:focus.seat, awards, shared:new Set(winners.map(w=>w.seat)).size>1,
    cameraWon:winners.some(w=>w.seat===cameraSeat) };
}

export function HandFireworks() {
  const [show,setShow] = useState(true);
  useEffect(()=>{const timer=setTimeout(()=>setShow(false),FIREWORK_MS);return ()=>clearTimeout(timer);},[]);
  if (!show) return null;
  return <svg className="hand-fireworks" viewBox="0 0 390 400" aria-hidden="true" data-testid="hand-fireworks">
    {BURSTS.map((burst,i)=><g key={i} transform={`translate(${burst.x} ${burst.y})`} fill={burst.c} style={{'--burst-delay':`${burst.d}ms`,'--burst-colour':burst.c}}>
      {Array.from({length:10},(_,j)=><circle key={j} className="hand-fireworks__spark" r="1.5" style={{'--spark-angle':`${j*36}deg`}}/>)}
      <circle className="hand-fireworks__core" r="2" fill="white"/>
    </g>)}
  </svg>;
}

export function BustedName({name}) {
  return <span className="hand-busted-name" aria-hidden="true">{pillName(name)}</span>;
}

// React to a hand finishing while watched. Joining a completed hand, replay
// frames, camera changes and repeated state snapshots must not replay effects.
export function useCelebrationAudio(
  game,heroSeat=0,enabled=true,
  visiblySettled=game?.street==='complete'&&!!game?.result,
) {
  const previous=useRef(null);
  const cancelEarned=useRef(null);
  const [watched, setWatched]=useState(null);
  const hand=game?.handNumber,table=game?.tableId,rawDone=game?.street==='complete'&&!!game?.result;
  const scope=JSON.stringify([table,hand,heroSeat]);
  useEffect(()=>()=>{
    cancelEarned.current?.();cancelEarned.current=null;
  },[scope,enabled,rawDone,visiblySettled]);
  useEffect(()=>{
    const before=previous.current;
    const sameScope=!!before&&before.hand===hand&&before.table===table&&before.heroSeat===heroSeat;
    // An all-in STATE can already contain the result while the felt is still
    // revealing the board. Remember the watched completion until that reveal
    // finishes; a cold completed entry or another camera never earns a beat.
    const pending=sameScope&&before.enabled&&rawDone&&(before.pending||!before.rawDone);
    const consume=pending&&visiblySettled;
    previous.current={hand,table,heroSeat,rawDone,enabled,pending:consume||!enabled?false:pending};
    if(!sameScope||!rawDone||!enabled||!visiblySettled)setWatched(null);
    // Consume even when playback is disabled, muted or locked. Unmuting or
    // receiving another copy of the result must not replay an old celebration.
    if(!enabled||!consume)return;
    const result=resultCelebration(game,heroSeat);if(!result)return;
    setWatched(scope);
    cancelEarned.current=withSoundGroup(()=>{
      if(result.cameraWon)play('winSwell');
      else play('lostPot');
      if(result.big||result.busted.length)play('bigWinBursts');
      if(result.busted.length)play('bustKnock',{delayMs:900});
    });
  },[hand,table,rawDone,heroSeat,enabled,visiblySettled,game,scope]);
  // The same earned completion gates transient visuals. A static result has
  // no key on cold entry, after a camera change, or when replay was disabled.
  return enabled&&visiblySettled&&watched===scope ? watched : null;
}
