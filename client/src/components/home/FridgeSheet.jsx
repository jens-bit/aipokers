// Board 29 F13, mood-home2.jsx: household stock, bought from the safe.
// Agents fetch an item after a want answer or a carry-to-fridge placement.
//
// UI-3 JOB D — THE FRIDGE LOSES ITS ESSAY.
//
// The list used to carry a sentence per item ("cools heat" / "gentler
// cooling") always on, plus a whole paragraph at the foot spelling out the
// beer's discipline tradeoff — visible whether or not the owner cared, every
// time the sheet opened. Jens's decision: no descriptive text in the list.
// Each item shows what it does as ARROWS ONLY — stamina up in green, heat
// down in blue, discipline down in red, the same three colours `--success`/
// `--cool`/`--error` mean everywhere else in the product — and the one
// sentence that used to sit at the foot for everyone now belongs to
// whichever item the owner actually taps, and only that one.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSheetDrag } from '../../hooks/useSheetDrag.js';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { money } from '../../lib/wallet.js';

// One arrow per real effect (src/server/fridge.js's ITEMS, and the beer's
// second half at the casino seat — BUGS.md's LIFE-1-I). Never a made-up one:
// a beer does not touch stamina and a snack does not touch discipline, so
// neither carries an arrow for it.
export const STOCK = [
  {
    id: 'beer', label: 'BEER',
    effects: [{ attr: 'heat', dir: 'down' }, { attr: 'discipline', dir: 'down' }],
    sentence: 'Cools him off now, but the edge follows him to his next casino seat as a discipline hit and looser bluffs.',
  },
  {
    id: 'snack', label: 'SNACK',
    effects: [{ attr: 'stamina', dir: 'up' }, { attr: 'heat', dir: 'down' }],
    sentence: 'A gentler cooldown that also tops up his stamina, with nothing carried into his next session.',
  },
];

const ARROW_COLOR = { stamina: 'var(--success)', heat: 'var(--cool)', discipline: 'var(--error)' };

function EffectArrow({ attr, dir }) {
  const up = dir === 'up';
  return (
    <span
      className={`fridge-stock__arrow fridge-stock__arrow--${attr}`}
      style={{ color: ARROW_COLOR[attr] }}
      role="img"
      aria-label={`${attr} ${dir}`}
      title={`${attr} ${dir}`}
    >
      {up ? '↑' : '↓'}
    </span>
  );
}

const headers = () => ({ 'Content-Type': 'application/json', 'X-Telegram-Init-Data': getTelegramInitData() });

export function FridgeSheet({ onClose, onStocked, variant = 'sheet' }) {
  const inRail = variant === 'rail';
  const [items, setItems] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [said, setSaid] = useState('');
  // UI-3 job D: which item's one-sentence explanation is open, or none. Only
  // ever one at a time — a second tap answers "what does THIS one do", not
  // "and this one too".
  const [expanded, setExpanded] = useState(null);
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
          const open = expanded === s.id;
          return <li className="fridge-stock__row" key={s.id} data-testid={`fridge-shelf-${s.id}`}>
            <button
              type="button"
              className="fridge-stock__item"
              aria-expanded={open}
              aria-label={`${s.label}: ${s.effects.map(e => `${e.attr} ${e.dir}`).join(', ')}. Tap to read why.`}
              onClick={() => setExpanded(open ? null : s.id)}
            >
              <span className={`fridge-stock__icon fridge-stock__icon--${s.id}${empty ? ' is-empty' : ''}`} aria-hidden/>
              <div className="fridge-stock__detail">
                <div>
                  <b>{s.label}</b>
                  <span className="fridge-stock__arrows">{s.effects.map(e => <EffectArrow key={e.attr} attr={e.attr} dir={e.dir} />)}</span>
                  <span className={`fridge-stock__count${empty ? ' is-empty' : ''}`}>{shelf ? (empty ? 'out' : `× ${shelf.count}`) : '—'}</span>
                </div>
                <small>{shelf ? `${money(shelf.price)} each` : 'price unavailable'}</small>
              </div>
            </button>
            {open && <p className="fridge-stock__why">{s.sentence}</p>}
            <button type="button" className="fridge-stock__buy" aria-label={`Buy 6 ${s.id}`} data-testid={`home-buy-${s.id}`} onClick={() => buy(s.id)} disabled={!shelf || loading || !!busy}><span>{busy === s.id ? 'BUYING…' : 'BUY 6'}</span></button>
          </li>;
        })}
      </ul>
      {error && <div className="fridge-stock__error" role="alert">{error}{!items && <button type="button" onClick={load} disabled={loading}>Try again</button>}</div>}
      {said && <p className="home-sheet__said" role="status">{said}</p>}
    </div>
  </div>;
}
