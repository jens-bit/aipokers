import { useLayoutEffect, useRef, useState } from 'react';
import { WatchFelt, readFor, seatSummary } from '../WatchScreen.jsx';
import { ReadSheet } from '../system/ReadSheet.jsx';
import { heroSeatOf, phaseOf } from './DeskTableStage.jsx';
import { ActionNarrator } from '../system/ActionNarrator.jsx';
import { WatchGuide } from '../onboarding/WatchGuide.jsx';

// DkWatchScreenM: the shared live felt, in the reference's 900 × 648 space.
// The public camera chooses a seat, but can only draw cards the server served.
export function DeskCasinoTable({ game, agent, mySeat, lastDecision, notice, onBack, onSitOut, onTapHero,
  sessionEnd = null, seated = false, guideBlocked = false, guideChatRef = null }) {
  const viewport=useRef(null);
  const [scale,setScale]=useState(1),[selectedSeat,setSelectedSeat]=useState(null);
  useLayoutEffect(()=>{
    const el=viewport.current;
    const measure=()=>{const k=Math.min(1,el.clientWidth/900,el.clientHeight/648);if(k>0)setScale(k);};
    measure();if(typeof ResizeObserver==='undefined')return;
    const observer=new ResizeObserver(measure);observer.observe(el);return ()=>observer.disconnect();
  },[]);
  const heroSeat=heroSeatOf(game,agent?.name,mySeat),hero=game?.seats?.[heroSeat];
  const mood=hero?.mood ?? agent?.mood;
  const name=agent?.name || hero?.displayName;
  const heroDecision=lastDecision?.seat===heroSeat && phaseOf(game)==='live' ? lastDecision : null;
  const bubbles=heroDecision?.reasoning ? [{id:'decision',mine:true,seat:heroSeat,text:heroDecision.reasoning}] : [];
  return <div className="dsk-casino-table-viewport" ref={viewport}>
    <WatchGuide rootRef={viewport} game={game} heroSeat={heroSeat} ownedAgent={agent}
      privateChat={!!onTapHero && !!guideChatRef} chatRef={guideChatRef}
      blocked={seated || !!sessionEnd || !!notice || guideBlocked || selectedSeat != null}/>
    <section className="dsk-casino-table" data-testid="desk-casino-table" aria-label={name ? name+' at the table' : 'The casino table'} style={{width:900*scale,height:648*scale}}>
      <div className="dsk-casino-table__scene" style={{transform:'scale('+scale+')'}}>
        <WatchFelt heroActionLabel={onTapHero ? "View your agent at the table" : "Read this player"} onTapHero={onTapHero ?? (()=>setSelectedSeat(heroSeat))} bubbles={bubbles} game={game} mySeat={heroSeat} lastDecision={lastDecision}
          agentMood={typeof mood==='string'?mood:mood?.state} agentHeat={mood?.heat}
          agentAccent={hero?.accentColor ?? agent?.accentColor} agentFatigue={hero?.fatigue ?? agent?.fatigue}
          selectedSeat={selectedSeat} onSelectSeat={seat=>setSelectedSeat(selectedSeat===seat?null:seat)}
          overlay={selectedSeat==null?null:<ReadSheet entry={readFor(game,selectedSeat)} seat={seatSummary(game,selectedSeat)} onClose={()=>setSelectedSeat(null)}/>}/>
        <ActionNarrator game={game} mySeat={mySeat} />
        <button type="button" className="dsk-casino-table__back" aria-label="BACK TO THE FLOOR" onClick={onBack}>‹ BACK TO THE FLOOR</button>
        <span className="dsk-casino-table__name" data-watch-status style={{background:'var(--v5-panel)',padding:'2px 6px',borderRadius:4,pointerEvents:'auto'}}>Watching{name && !agent ? ` ${name}` : ''}</span>
        {notice && <div className="dsk-casino-table__notice" role="status">{notice}</div>}
        {onSitOut && phaseOf(game)==='between' && <button type="button" className="dsk-casino-table__sit-out" onClick={onSitOut}>Sit out</button>}
      </div>
    </section>
  </div>;
}
