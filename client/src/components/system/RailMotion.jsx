// Board 41 B15: the optical glyph moves; the rail stays furniture.
import { useEffect, useRef, useState } from 'react';
import { RailMark } from './RailMark.jsx';
import './rail-motion.css';
let appPeekShown = false;
export function activityKeys(agents) {
  return agents.flatMap(a => [a.want ? a.id+':want:'+JSON.stringify(a.want) : null, a.unseenRecap ? a.id+':recap:'+JSON.stringify(a.sessionRecap ?? null) : null].filter(Boolean));
}
export function RailMotion({ size=20, color='#00D4AA', news=null }) {
  const [motion,setMotion]=useState(null);
  const [badge,setBadge]=useState(!!news?.length);
  const previous=useRef(null), serial=useRef(0);
  const key=news===null?null:JSON.stringify([...news].sort());
  useEffect(()=>{if(!appPeekShown){appPeekShown=true;setMotion({kind:'peek',serial:++serial.current});}},[]);
  useEffect(()=>{
    if(key===null)return;
    const next=JSON.parse(key),before=previous.current;previous.current=new Set(next);
    if(!next.length){setBadge(false);return;}
    if(before===null){setBadge(true);return;}
    if(next.some(id=>!before.has(id))){setBadge(false);setMotion({kind:'look',serial:++serial.current});}
  },[key]);
  useEffect(()=>{
    if(!motion)return;
    const reduced=typeof matchMedia==='function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const timer=setTimeout(()=>{setMotion(null);if(motion.kind==='look')setBadge(!!previous.current?.size);},reduced?0:motion.kind==='peek'?520:440);
    return()=>clearTimeout(timer);
  },[motion]);
  return <span className="rail-motion" style={{width:size,height:size,color}} role="img" aria-label="Railbird">
    <span className="rail-motion__clip" aria-hidden="true"><span key={motion?.serial ?? 'still'} className="rail-motion__head" data-motion={motion?.kind}><RailMark pose="glyph" size={size} color={color}/></span></span>
    <svg className="rail-motion__rail" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true"><path d="M-2 39.2H66V44.6H-2Z" fill="currentColor"/><path d="M-2 42.2H66V42.9H-2Z" fill="#0B0F0E"/><path d="M-2 45.8H66V47.4H-2Z" fill="currentColor"/></svg>
    {badge && <i className="rail-motion__badge" aria-hidden="true"/>}
  </span>;
}
