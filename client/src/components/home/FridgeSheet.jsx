// Board 29 F13, mood-home2.jsx: household stock, bought from the safe.
// Agents fetch an item after a want answer or a carry-to-fridge placement.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSheetDrag } from '../../hooks/useSheetDrag.js';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { money } from '../../lib/wallet.js';

export const STOCK = [
  { id: 'beer', label: 'BEER', note: 'cools heat' },
  { id: 'snack', label: 'SNACK', note: 'soothes a bad mood' },
];
const headers = () => ({ 'Content-Type': 'application/json', 'X-Telegram-Init-Data': getTelegramInitData() });

export function FridgeSheet({ onClose, onStocked, variant = 'sheet' }) {
  const inRail = variant === 'rail';
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [said, setSaid] = useState('');
  const alive = useRef(false);
  const drag = useSheetDrag(onClose);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`/api/fridge?userId=${encodeURIComponent(getUserId())}`, { headers: headers() });
      if (!res.ok) throw new Error('read failed');
      const data = await res.json();
      if (!Array.isArray(data.items) || !STOCK.every(s => data.items.some(i => i.id === s.id && Number.isFinite(i.count) && Number.isFinite(i.price)))) throw new Error('incomplete stock');
      if (alive.current) setItems(data.items);
    } catch { if (alive.current) setError('Could not read the fridge. Please try again.'); }
    finally { if (alive.current) setLoading(false); }
  }, []);
  useEffect(() => { alive.current = true; load(); return () => { alive.current = false; }; }, [load]);

  async function buy(item) {
    if (busy || loading || !items) return;
    setBusy(item); setError(''); setSaid('');
    try {
      const res = await fetch('/api/fridge/stock', { method: 'POST', headers: headers(), body: JSON.stringify({ userId: getUserId(), item, qty: 6 }) });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || 'Could not stock the fridge. Please try again.');
      if (!alive.current) return;
      // /stock returns flat counts; prices remain the last confirmed GET.
      if (body.fridge && STOCK.every(s => Number.isFinite(body.fridge[s.id]))) {
        setItems(prev => prev.map(i => ({ ...i, count: body.fridge[i.id] })));
      } else await load();
      setSaid(`Bought ${body.qty ?? 6} ${item === 'beer' ? 'beers' : 'snacks'} from the safe.`);
      onStocked?.(item, body);
    } catch (err) { if (alive.current) setError(err.message || 'Could not stock the fridge. Please try again.'); }
    finally { if (alive.current) setBusy(null); }
  }

  return <div className={`home-sheet${inRail ? ' home-sheet--rail' : ''}`} role={inRail ? 'group' : 'dialog'} aria-label="The fridge" data-testid="home-fridge-sheet">
    {!inRail && <button type="button" className="home-sheet__scrim" onClick={onClose} aria-label="Close"/>}
    <div className={`home-sheet__panel fridge-stock${!inRail && drag.dragging ? ' is-dragging' : ''}`} ref={inRail ? undefined : drag.ref} style={inRail ? undefined : drag.style} {...(inRail ? {} : drag.handlers)}>
      {!inRail && <div className="fridge-stock__handle" aria-hidden/>}
      {!inRail && <div className="home-sheet__head"><span className="home-sheet__title">THE FRIDGE</span><span className="fridge-stock__from">bought from the safe</span><button type="button" className="home-sheet__close" onClick={onClose} aria-label="Close">✕</button></div>}
      {loading && <div className="fridge-stock__loading" role="status">Reading the shelves…</div>}
      <ul className="home-sheet__stock">
        {STOCK.map(s => {
          const shelf = items?.find(i => i.id === s.id);
          const empty = shelf?.count === 0;
          return <li className="fridge-stock__row" key={s.id} data-testid={`fridge-shelf-${s.id}`}>
            <span className={`fridge-stock__icon fridge-stock__icon--${s.id}${empty ? ' is-empty' : ''}`} aria-hidden/>
            <div className="fridge-stock__detail"><div><b>{s.label}</b><span className={`fridge-stock__count${empty ? ' is-empty' : ''}`}>{shelf ? (empty ? 'out' : `× ${shelf.count}`) : '—'}</span></div><small>{s.note} · <span>{shelf ? `${money(shelf.price)} each` : 'price unavailable'}</span></small></div>
            <button type="button" className="fridge-stock__buy" aria-label={`Buy 6 ${s.id}`} data-testid={`home-buy-${s.id}`} onClick={() => buy(s.id)} disabled={!shelf || loading || !!busy}><span>{busy === s.id ? 'BUYING…' : 'BUY 6'}</span></button>
          </li>;
        })}
      </ul>
      {error && <div className="fridge-stock__error" role="alert">{error}{!items && <button type="button" onClick={load} disabled={loading}>Try again</button>}</div>}
      {said && <p className="home-sheet__said" role="status">{said}</p>}
      <p className="fridge-stock__foot">A beer cools <b>heat</b>; a snack soothes a <b>bad mood</b>. Neither moves a skill, and an empty fridge is not a punishment — he will simply say so.</p>
    </div>
  </div>;
}
