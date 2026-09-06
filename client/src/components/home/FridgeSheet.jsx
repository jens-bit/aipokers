// client/src/components/home/FridgeSheet.jsx — HOME-1
//
// What is in the fridge, and who gets it.
//
// The fridge is the stock sheet. Two things are in it, they are the two things
// WANTS-1 defines (src/agent/wants.js ITEMS), and they do exactly one thing
// each: soothe one mood step, on the pep talk's own cooldown.
//
// THIS IS NOT A SHOP, and the copy has to keep saying so. §7.1's law is that an
// item touches STATE and never SKILL, and the moment reads as feeding a pet
// rather than buying a powerup. So:
//
//   * No basket, no quantity, no total. One tap gives one thing to one agent.
//   * The price is drawn once, small, as what it costs YOU — it comes out of the
//     wallet and never out of a pocket, because a pocket that can buy things is
//     a purchase path into the character system.
//   * No item is ever recommended, and nothing is greyed out to make you want
//     it. A refusal from the server (empty wallet, cooldown, nothing to soothe)
//     is reported in his voice, not as an error.
//
// Prices are read from the server's answer rather than hard-coded here; the
// constants below are the labels only, so a retuned price cannot go stale on
// this screen.

import { useState } from 'react';
import { useSheetDrag } from '../../hooks/useSheetDrag.js';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { pillName } from '../../lib/names.js';

export const STOCK = [
  { id: 'beer',  label: 'A beer',   note: 'Takes the edge off. One step.' },
  { id: 'snack', label: 'A snack',  note: 'Long night food. One step.' },
];

export async function giveItem(agentId, item) {
  const userId = getUserId();
  const initData = getTelegramInitData();
  const res = await fetch(`/api/agents/${encodeURIComponent(agentId)}/give?userId=${encodeURIComponent(userId)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(initData ? { 'X-Telegram-Init-Data': initData } : {}),
    },
    body: JSON.stringify({ userId, item }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, body };
}

// DESK-2: `variant` is 'sheet' (the phone: glass over the room, with a scrim)
// or 'rail' (the desk: the same panel, inline in the rail, no glass because the
// room beside it is not covered). Nothing inside it differs — the fridge is the
// fridge, and only the thing it is mounted in changes.
export function FridgeSheet({ agents = [], onClose, onGiven, variant = 'sheet' }) {
  const inRail = variant === 'rail';
  const [target, setTarget] = useState(() => agents[0]?.id ?? null);
  const [busy, setBusy] = useState(null);
  const [said, setSaid] = useState(null);
  // BUGS-A job 5: pushed back down with a finger, anywhere on it.
  const drag = useSheetDrag(onClose);

  const give = async (item) => {
    if (!target || busy) return;
    setBusy(item);
    setSaid(null);
    const { ok, body } = await giveItem(target, item);
    setBusy(null);
    // His line either way — the server sends one for the refusal too.
    setSaid(body?.moment?.text ?? body?.line ?? body?.error ?? null);
    if (ok) onGiven?.(target, item, body);
  };

  return (
    <div
      className={`home-sheet${inRail ? ' home-sheet--rail' : ''}`}
      role={inRail ? 'group' : 'dialog'}
      aria-label="The fridge"
      data-testid="home-fridge-sheet"
    >
      {inRail ? null : (
        <button type="button" className="home-sheet__scrim" onClick={onClose} aria-label="Close" />
      )}
      {/* BUGS-A job 5's drag belongs to the SHEET. In the rail this is a panel
          in a column — there is nowhere to drag it to, and a panel that slid
          under the finger would just come back. */}
      <div
        className={`home-sheet__panel${!inRail && drag.dragging ? ' is-dragging' : ''}`}
        ref={inRail ? undefined : drag.ref}
        style={inRail ? undefined : drag.style}
        {...(inRail ? {} : drag.handlers)}
      >
        {/* In the rail the panel's own head already names it and already has the
            close; a second title and a second ✕ is the same door drawn twice. */}
        {inRail ? null : (
          <div className="home-sheet__head">
            <span className="home-sheet__title">The fridge</span>
            <button type="button" className="home-sheet__close" onClick={onClose} aria-label="Close">✕</button>
          </div>
        )}

        {agents.length > 1 ? (
          <div className="home-sheet__who" role="radiogroup" aria-label="Who gets it">
            {agents.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={target === a.id}
                className={`home-sheet__whochip${target === a.id ? ' is-on' : ''}`}
                onClick={() => setTarget(a.id)}
              >
                {pillName(a.name)}
              </button>
            ))}
          </div>
        ) : null}

        <ul className="home-sheet__stock">
          {STOCK.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="home-sheet__item"
                disabled={!target || !!busy}
                onClick={() => give(item.id)}
                data-testid={`home-give-${item.id}`}
              >
                <span className={`home-sheet__icon home-sheet__icon--${item.id}`} aria-hidden />
                <span className="home-sheet__item-text">
                  <span className="home-sheet__item-label">{item.label}</span>
                  <span className="home-sheet__item-note">{item.note}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {said ? <p className="home-sheet__said">{said}</p> : null}
        <p className="home-sheet__foot">Out of your wallet. Never out of his pocket.</p>
      </div>
    </div>
  );
}
