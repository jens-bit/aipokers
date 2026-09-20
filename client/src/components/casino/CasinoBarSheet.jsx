import { useEffect, useRef, useState } from 'react';
import { casinoTableIdOf } from './FloorView.jsx';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { identityOf } from '../../lib/identity.js';
import { getTelegramInitData, getUserId } from '../../lib/telegram.js';
import { money } from '../../lib/wallet.js';
import '../../styles/casino-bar.css';

const ITEMS = [
  {id:'beer', title:'Beer', effect:'Cools heat. Lowers discipline and increases bluffing next session.'},
  {id:'snack', title:'Snack', effect:'Restores stamina and gently cools heat.'},
];
const headers = () => ({'Content-Type':'application/json','x-telegram-init-data':getTelegramInitData()});
const newOrderId = () => globalThis.crypto?.randomUUID?.() ?? `bar-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function CasinoBarSheet({ agents = [], onClose, onChanged }) {
  const owner = getUserId(), credential = getTelegramInitData();
  return <BarSession key={`${owner}\0${credential}`} agents={agents} owner={owner} onClose={onClose} onChanged={onChanged}/>;
}

function BarSession({ agents, owner, onClose, onChanged }) {
  const eligible = agents.filter(agent => !agent.guest && !agent.visiting && !agent.archived
    && (casinoTableIdOf(agent) || agent.location?.where === 'casino'));
  const [selected, setSelected] = useState(null), [stock, setStock] = useState(null);
  const [error, setError] = useState(''), [receipt, setReceipt] = useState(''), [pending, setPending] = useState(null);
  const alive = useRef(false), busy = useRef(false), orders = useRef(new Map()), close = useRef(null);
  const agent = eligible.find(agent => agent.id === selected) ?? eligible[0] ?? null;
  async function readStock() {
    try {
      const response = await fetch(`/api/fridge?userId=${encodeURIComponent(owner)}`, {headers:headers()});
      const data = await response.json();
      if (!response.ok || !ITEMS.every(item => data.items?.some(row=>row.id===item.id && Number.isFinite(row.price) && Number.isFinite(row.count)))) throw new Error();
      if (alive.current) {setStock(data);setError('');}
    } catch {if(alive.current)setError('Could not read the bar stock. Please try again.');}
  }
  useEffect(()=>{
    alive.current=true;const previous=document.activeElement;close.current?.focus();readStock();
    return()=>{alive.current=false;if(previous?.isConnected)previous.focus();};
  },[]);
  async function serve(item, shelf) {
    if (busy.current || !agent || !shelf) return;
    const recipient = agent, buyIfEmpty = shelf.count === 0;
    const key = `${recipient.id}\0${item}\0${buyIfEmpty}`;
    const orderId = orders.current.get(key) ?? newOrderId();orders.current.set(key,orderId);
    busy.current=true;setPending(item);setError('');setReceipt('');
    try {
      const response=await fetch(`/api/agents/${encodeURIComponent(recipient.id)}/bar-order`, {
        method:'POST',headers:headers(),body:JSON.stringify({userId:owner,item,buyIfEmpty,orderId}),
      });
      const data=await response.json();
      if (!alive.current) return;
      if(!response.ok)throw new Error(typeof data.error==='string'?data.error:'Could not serve that order. Please try again.');
      if(data.orderId!==orderId || data.given!==item || data.agent?.id!==recipient.id || !Number.isFinite(data.spent))throw new Error('Could not confirm the order. Retry to check it safely.');
      orders.current.delete(key);
      if(Array.isArray(data.fridge?.items))setStock(data.fridge);else await readStock();
      if(!alive.current)return;
      setReceipt(`${recipient.name} had a ${item}. ${data.spent ? `${money(data.spent)} from your safe.` : 'From household stock.'}`);
      try{Promise.resolve(onChanged?.(data.agent)).catch(()=>{});}catch{/* The order already committed. */}
    } catch(cause) {if(alive.current)setError(cause.message || 'Could not serve that order. Please try again.');}
    finally {busy.current=false;if(alive.current)setPending(null);}
  }
  function keyboard(event) {
    if(event.key==='Escape'){event.stopPropagation();onClose();}
    if(event.key==='Tab'){
      const controls=[...event.currentTarget.querySelectorAll('button:not(:disabled),select:not(:disabled)')];
      const first=controls[0],last=controls.at(-1);
      if(event.shiftKey && document.activeElement===first){event.preventDefault();last?.focus();}
      else if(!event.shiftKey && document.activeElement===last){event.preventDefault();first?.focus();}
    }
  }
  const look=agent?identityOf(agent):null;
  return <div className="casino-bar">
    <button className="casino-bar__scrim" aria-label="Close casino bar" onClick={onClose} tabIndex={-1}/>
    <section className="casino-bar__panel" role="dialog" aria-modal="true" aria-label="The casino bar" onKeyDown={keyboard}>
      <header><div><h2>The bar</h2><p>One for your player.</p></div><button ref={close} type="button" onClick={onClose} aria-label="Close bar">×</button></header>
      {!agent ? <p>Your agents are at Home. Send one to the casino to order here.</p> : <>
        <div className="casino-bar__recipient"><MoodGhost size={66} mood={agent.mood?.state??'neutral'} heat={agent.mood?.heat??30} ring={false} hood={look.hood} glow={look.glow.c} equipment={agent.equipment}/>
          <label>Who is it for?<select aria-label="Who is it for?" value={agent.id} disabled={!!pending} onChange={e=>{setSelected(e.target.value);setError('');setReceipt('');}}>{eligible.map(agent=><option value={agent.id} key={agent.id}>{agent.name}</option>)}</select><span>{casinoTableIdOf(agent)?'At his table. His hand keeps playing.':'Waiting in the casino.'}</span></label>
        </div>
        <p className="casino-bar__source">Household stock first. Anything bought comes from your safe.</p>
        <div className="casino-bar__items">{ITEMS.map(item=>{
          const shelf=stock?.items?.find(row=>row.id===item.id);
          return <article key={item.id}><div className="casino-bar__item-info"><span className={`fridge-stock__icon fridge-stock__icon--${item.id}`} aria-hidden="true"/><div><h3>{item.title}</h3><p>{item.effect}</p><small>{shelf?`${shelf.count} in stock · ${money(shelf.price)} each`:'Reading stock…'}</small></div></div>
            <button disabled={!shelf||!!pending} onClick={()=>serve(item.id,shelf)} aria-label={shelf?.count>0?`Serve one ${item.id} from stock`:shelf?`Buy and serve one ${item.id} for ${money(shelf.price)}`:`Order ${item.id}`}>
              {pending===item.id?'Serving…':shelf?.count>0?'Serve from stock':shelf?`Buy & serve · ${money(shelf.price)}`:'Reading…'}
            </button></article>;
        })}</div>
      </>}
      {error&&<p className="casino-bar__error" role="alert">{error}{!stock&&<button onClick={readStock}>Try again</button>}</p>}
      {receipt&&<p className="casino-bar__receipt" role="status">{receipt}</p>}
    </section>
  </div>;
}
