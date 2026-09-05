// Flagged hands in the rail, ported from design-refs/mood-desktop2.jsx
// PFlaggedCard. The count and the rows both come from
// GET /api/agents/:id/flagged — the same endpoint the mobile hand-review sheet
// reads, with the owner header, without which the server strips holeCards.
import { useEffect, useState } from 'react';
import { getUserId, getTelegramInitData } from '../../lib/telegram.js';
import { accentFor } from '../floor/atoms.jsx';
import { moodOf } from '../floor/agentView.js';
import { MiniCard } from './primitives.jsx';
import { PHood } from './panelParts.jsx';

// FLAG-1 entries carry a reason and an EV cost; both are optional.
function lossOf(hand) {
  if (Number.isFinite(hand?.evLoss)) return `−$${Math.abs(hand.evLoss).toLocaleString()} EV`;
  if (Number.isFinite(hand?.net)) {
    return hand.net < 0 ? `−$${Math.abs(hand.net).toLocaleString()}` : `+$${hand.net.toLocaleString()}`;
  }
  return '—';
}

function actionOf(hand) {
  return hand?.reason || hand?.summary || hand?.action || 'Flagged hand';
}

export function PFlaggedCard({ agents = [], onOpen }) {
  const [byAgent, setByAgent] = useState({});

  // Only agents the roster already says have something flagged are asked.
  const flaggable = agents.filter((a) => (a.flaggedCount ?? 0) > 0);
  const key = flaggable.map((a) => `${a.id}:${a.flaggedCount}`).join(',');

  useEffect(() => {
    if (!flaggable.length) { setByAgent({}); return undefined; }
    let cancelled = false;
    Promise.all(flaggable.map((agent) =>
      fetch(
        `/api/agents/${encodeURIComponent(agent.id)}/flagged?userId=${encodeURIComponent(getUserId())}`,
        { headers: { 'x-telegram-init-data': getTelegramInitData() } },
      )
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((data) => ({ id: agent.id, hands: Array.isArray(data.flaggedHands) ? data.flaggedHands : [] }))
        .catch(() => ({ id: agent.id, hands: [] })),
    )).then((results) => {
      if (cancelled) return;
      const next = {};
      results.forEach((r) => { next[r.id] = r.hands; });
      setByAgent(next);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // The header count is the server's, summed across the roster.
  const total = flaggable.reduce((sum, a) => sum + (a.flaggedCount ?? 0), 0);
  if (total === 0) return null;

  const rows = [];
  agents.forEach((agent, i) => {
    (byAgent[agent.id] || []).forEach((hand, j) => {
      rows.push({ agent, accentIndex: i, hand, key: `${agent.id}:${j}` });
    });
  });

  return (
    <div className="dsk-flagged">
      <div className="dsk-flagged__head">
        <span className="dsk-label dsk-flagged__title">
          Flagged hands · {total} need review
        </span>
        {onOpen && (
          <button type="button" className="dsk-apanel__action" onClick={() => onOpen(flaggable[0])}>
            VIEW ALL ↗
          </button>
        )}
      </div>
      <div className="dsk-flagged__rows">
        {rows.slice(0, 3).map(({ agent, accentIndex, hand, key: k }) => (
          <button
            type="button"
            key={k}
            className="dsk-flagged__row"
            onClick={() => onOpen?.(agent)}
          >
            <PHood size={20} accent={accentFor(agent, accentIndex)} mood={moodOf(agent)} />
            <div className="dsk-flagged__cards">
              <MiniCard card={hand.holeCards?.[0]} size="mini" />
              <MiniCard card={hand.holeCards?.[1]} size="mini" />
            </div>
            <div className="dsk-flagged__text">
              <div className="dsk-flagged__action">{actionOf(hand)}</div>
              <div className="dsk-flagged__meta">
                {agent.name}{hand.stake ? ` · ${hand.stake}` : ''}
              </div>
            </div>
            <span className="dsk-flagged__loss">{lossOf(hand)}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
              className="dsk-flagged__chev" aria-hidden>
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        ))}
        {rows.length === 0 && (
          <div className="dsk-apanel__empty" style={{ padding: '4px 10px' }}>
            Loading flagged hands…
          </div>
        )}
      </div>
    </div>
  );
}
