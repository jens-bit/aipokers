import { useLayoutEffect, useRef, useState } from 'react';
import { WatchFelt, readFor, seatSummary, useActionTimer } from '../WatchScreen.jsx';
import { SitStrip } from '../system/SitStrip.jsx';
import { ReadSheet } from '../system/ReadSheet.jsx';
import { RoomThread } from '../home/RoomThread.jsx';
import { useHomeThread } from '../../hooks/useHomeThread.js';

// DkOwnerM: the same live felt and legal actions as phone, within the desktop
// stage. The room conversation remains a permanent column alongside it.
export function DeskHomeTable({ game, mySeat, seated, legalActions, onAct, lastDecision, agents, connection, onBack }) {
  const [selectedSeat, setSelectedSeat] = useState(null);
  const viewport = useRef(null), actions = useRef(null);
  const [scale, setScale] = useState(1), [clearance, setClearance] = useState(112);
  useLayoutEffect(() => {
    const el=viewport.current;
    const measure=()=>{const k=Math.min(1,el.clientWidth/900,el.clientHeight/648);if(k>0)setScale(k);};
    measure();if(typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(measure);observer.observe(el);return ()=>observer.disconnect();
  },[]);
  useLayoutEffect(() => {
    const el=actions.current;if(!el)return;
    const measure=()=>setClearance(Math.max(112,el.clientHeight+12));
    measure();if(typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(measure);observer.observe(el);return ()=>observer.disconnect();
  },[seated]);
  const room = useHomeThread({ connection });
  const clock = useActionTimer(game);
  const hero = game?.seats?.[Number.isInteger(mySeat) ? mySeat : 0];
  const mood = typeof hero?.mood === 'string' ? hero.mood : hero?.mood?.state;
  return <>
    <div className="dsk-stage dsk-stage--felt dsk-stage--home-game">
      <div className="dsk-home-table-viewport" ref={viewport}>
      <section className={'dsk-home-table' + (seated ? ' is-seated' : '')} data-testid="desk-home-table" aria-label="The kitchen table" style={{width:900*scale,height:648*scale}}>
        <div className="dsk-home-table__scene" style={{transform:`scale(${scale})`,'--owner-clearance':clearance+'px'}}>
        <WatchFelt game={game} mySeat={mySeat} lastDecision={lastDecision} seated={seated} ownerVariant="desktop"
          agentMood={mood} agentHeat={hero?.mood?.heat} agentAccent={hero?.accentColor} agentFatigue={hero?.fatigue}
          selectedSeat={selectedSeat} onSelectSeat={seat=>setSelectedSeat(selectedSeat===seat?null:seat)}
          overlay={selectedSeat == null ? null : <ReadSheet entry={readFor(game,selectedSeat)} seat={seatSummary(game,selectedSeat)} onClose={()=>setSelectedSeat(null)}/>}/>
        <button type="button" className="dsk-home-table__back" aria-label="Back to the room" onClick={onBack}>‹</button>
        {seated && <div className="dsk-home-table__actions" ref={actions}><SitStrip game={game} mySeat={mySeat} legalActions={legalActions} onAct={onAct} secs={clock?.seat===mySeat?clock.left:null}/></div>}
        </div>
      </section>
      </div>
    </div>
    <div className="dsk-panel dsk-panel--home">
      <RoomThread lines={room.lines} agents={agents} loading={room.loading} sending={room.sending}
        atHome={agents.filter(a=>a.location?.where==='home').length} onSay={room.say} toast={room.error || null}/>
    </div>
  </>;
}
