import { useLayoutEffect, useRef, useState } from 'react';
import { STARTER_ITEMS, equipmentOf, sameEquipment as sameLook, validEquipment } from '../../../../src/shared/wardrobe.js';
import { WardrobeItem } from '../system/GhostClothes.jsx';
import { getTelegramInitData, getUserId } from '../../lib/telegram.js';
import '../../styles/agent-wardrobe.css';

// A change of agent OR authenticated owner starts a separate fitting. Old
// requests may finish on the server, but cannot paint or update the new room.
export function AgentWardrobe({ agent, userId = getUserId(), onPreview, onSaved }) {
  const credential = getTelegramInitData();
  return <WardrobeSession key={JSON.stringify([agent.id, userId, credential])}
    agent={agent} userId={userId} credential={credential} onPreview={onPreview} onSaved={onSaved} />;
}

function WardrobeSession({ agent, userId, credential, onPreview, onSaved }) {
  const source = equipmentOf(agent);
  const [saved, setSaved] = useState(source);
  const [draft, setDraft] = useState(source);
  const [tried, setTried] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const current = useRef(false);
  const busy = useRef(false);
  const savedRef = useRef(source);
  const callbacks = useRef({ onPreview, onSaved });
  useLayoutEffect(() => {
    current.current = true;
    return () => { current.current = false; };
  }, []);
  useLayoutEffect(() => { callbacks.current = { onPreview, onSaved }; });
  useLayoutEffect(() => {
    const next = { ...source };
    const previous = savedRef.current;
    savedRef.current = next;
    setSaved(next);
    // Background hydration must not erase an unsaved selection or a failed
    // save. Only an untouched fitting follows a newly confirmed server look.
    setDraft(value => sameLook(value, previous) ? next : value);
  }, [source.head, source.face, source.neck]);

  const dirty = !sameLook(draft, saved);
  const previewing = !!tried;
  const ready = dirty && sameLook(draft, tried);
  function choose(part, id) {
    if (busy.current) return;
    setDraft(value => ({ ...value, [part]: id }));
    setError(''); setMessage('');
  }
  function tryOn() {
    if (busy.current || !dirty) return;
    setTried(draft); setError(''); setMessage('');
    callbacks.current.onPreview?.(draft);
  }
  function cancel() {
    if (busy.current) return;
    setDraft(savedRef.current); setTried(null); setError(''); setMessage('');
    callbacks.current.onPreview?.(null);
  }
  async function save() {
    if (busy.current || !ready) return;
    const wanted = { ...draft };
    busy.current = true;
    setSaving(true); setError(''); setMessage('');
    let result;
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agent.id)}`, {
        method: 'PATCH', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'x-telegram-init-data': credential },
        body: JSON.stringify({ userId, equipment: wanted }),
      });
      result = await response.json();
      if (!current.current) return;
      if (!response.ok) throw new Error(response.status === 401 || response.status === 403
        ? 'Your session could not save this look. Sign in again and retry.'
        : 'Could not save this look. Your choices are still here; try again.');
      // A 200 from an older server that ignores equipment is not confirmation.
      if (result?.id !== agent.id || !validEquipment(result.equipment) || !sameLook(result.equipment, wanted)) {
        throw new Error('Could not confirm this look was saved. Your choices are still here; try again.');
      }
    } catch (err) {
      if (current.current) setError(err.message?.startsWith('Your session') || err.message?.startsWith('Could not')
        ? err.message : 'Could not save this look. Your choices are still here; try again.');
      return;
    } finally {
      if (current.current) { busy.current = false; setSaving(false); }
    }
    if (!current.current) return;
    savedRef.current = wanted;
    setSaved(wanted); setDraft(wanted); setTried(null); setMessage('Look saved.');
    // The server has committed. A parent refresh failure must never turn
    // that receipt into a failed save or encourage a duplicate request.
    try { Promise.resolve(callbacks.current.onSaved?.(result)).catch(() => {}); } catch { /* confirmed */ }
    try { callbacks.current.onPreview?.(null); } catch { /* confirmed */ }
  }

  return <section className="agent-wardrobe" aria-label={`${agent.name}'s wardrobe`} aria-busy={saving}>
    <p className="agent-wardrobe__intro">His birth colours are permanent. Dress him in something from the rack.</p>
    <fieldset disabled={saving} className="agent-wardrobe__rack">
      <legend>Starter rack <small>Yours to keep</small></legend>
      <div className="agent-wardrobe__options">{STARTER_ITEMS.map(item => <button key={item.id} type="button"
        aria-label={item.name} aria-pressed={draft[item.slot] === item.id}
        onClick={() => choose(item.slot, draft[item.slot] === item.id ? null : item.id)}>
        <span className="agent-wardrobe__hanger" aria-hidden="true">⌁</span>
        <WardrobeItem item={item}/><span>{item.name}</span>
        <small>{draft[item.slot] === item.id ? 'Take off' : 'Put on'}</small>
      </button>)}</div>
    </fieldset>
    <p className="agent-wardrobe__note">Removable items. No cost or change to poker skills.</p>
    <div className="agent-wardrobe__feedback" aria-live="polite">
      {error ? <p role="alert">{error}</p> : <p role="status">{saving ? 'Saving…' : message || (ready
        ? 'Preview only. Save to keep this look.'
        : dirty ? 'Try on your selection before saving.' : previewing ? 'Cancel to return to your saved look.' : 'Your saved look.')}</p>}
    </div>
    <div className="agent-wardrobe__actions">
      <button type="button" onClick={tryOn} disabled={saving || !dirty || ready}>Try on</button>
      <button type="button" className="agent-wardrobe__save" onClick={save} disabled={saving || !ready}>Save look</button>
      <button type="button" onClick={cancel} disabled={saving || (!dirty && !previewing && !error)}>Cancel</button>
    </div>
  </section>;
}
