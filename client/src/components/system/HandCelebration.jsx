import { useEffect, useState } from 'react';
import { pillName } from '../../lib/names.js';
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
  const amount = mine.reduce((sum,w)=>sum+(Number(w.amount)||0),0);
  const bb = game.bigBlind > 0 ? amount / game.bigBlind : null;
  const busted = (game.seats ?? []).flatMap((seat,index)=>
    index !== heroSeat && seat?.playerId && seat.stack === 0 && seat.contribTotal > 0
      && !winners.some(w=>w.seat===index && w.amount>0) ? [{seat:index,name:seat.displayName || `Seat ${index+1}`}] : []);
  return {won:mine.length>0,amount,bb,big:mine.length>0 && bb!=null && bb>=BIG_WIN_BB,busted};
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
