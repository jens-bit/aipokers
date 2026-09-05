// FlaggedHandsSheet — ported from design-refs/mood-screens-f.jsx.
// Two-panel sheet: list of flagged hands → per-hand StreetRow review.
// Rendered as an absolute overlay inside .floor, same as FloorZoom.
//
// API shape from GET /api/agents/:id/flagged (FLAG-1 / buildFlaggedEntry):
//   { flaggedHands: [{ flagType, handNumber, pot, holeCards, won, streets, flaggedAt }] }
//   street: { street, board, action, equity (integer %), potOdds, reasoning }

import { useEffect, useState } from 'react';
import { PlayingCard, CardBack } from '../system/PlayingCard.jsx';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { getUserId } from '../../lib/telegram.js';

// ── Design tokens (verbatim from mood-screens-f) ──────────────────────────────
const M_TEAL   = '#00D4AA';
const M_RED    = '#FF4D4F';
const M_PURPLE = '#9B7BFF';
const M_GOLD   = '#CDB380';
const M_TEXT   = '#EDEDED';
const M_DIM    = '#A1A1A1';
const M_MUTED  = '#6B6B6B';
const M_BORDER = 'rgba(255,255,255,0.12)';
const M_PANEL  = '#232329';
const M_PANEL_2 = '#28282F';
const OSWALD   = "'Oswald', 'Inter', sans-serif";
const PAD      = 14;

// Maps flagType (camelCase from backend) to display label + accent color.
const TYPE_META = {
  bigBluff:   { label: 'BIG BLUFF',   color: M_PURPLE },
  badBeat:    { label: 'BAD BEAT',    color: M_RED },
  heroCall:   { label: 'HERO CALL',   color: M_TEAL },
  cooler:     { label: 'COOLER',      color: M_GOLD },
  biggestPot: { label: 'BIGGEST POT', color: M_GOLD },
};

// One-line summary per type, derived from the hand record.
function summaryFor(hand) {
  const eq = hand.streets?.length
    ? Math.max(...hand.streets.map((s) => s.equity ?? 0))
    : null;
  switch (hand.flagType) {
    case 'bigBluff':   return `Fired with ${eq ?? '?'}% equity — ${hand.won ? 'it worked' : 'called off'}`;
    case 'badBeat':    return `${eq ?? '?'}% equity favorite, still lost`;
    case 'heroCall':   return `Marginal call, took it down`;
    case 'cooler':     return `Coin-flip pot, ${hand.won ? 'ran it out' : 'took the bad side'}`;
    case 'biggestPot': return `Session's biggest pot — ${hand.pot} chips`;
    default:           return `Hand #${hand.handNumber}`;
  }
}

// ── Primitives ────────────────────────────────────────────────────────────────

function TypeBadge({ flagType }) {
  const m = TYPE_META[flagType] ?? TYPE_META.biggestPot;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      height: 18, padding: '0 6px', borderRadius: 3, flexShrink: 0,
      background: `${m.color}1A`, border: `1px solid ${m.color}55`,
      color: m.color,
      fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em',
    }}>
      {m.label}
    </span>
  );
}

function BackBtn({ onClick }) {
  return (
    <button
      type="button"
      aria-label="Back"
      onClick={onClick}
      style={{
        position: 'absolute', top: 10, left: 12, zIndex: 3,
        width: 34, height: 34, display: 'grid', placeItems: 'center',
        border: `1px solid ${M_BORDER}`, borderRadius: 10,
        background: 'rgba(8,10,11,0.86)', color: M_TEXT, cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
  );
}

function SheetHeader({ title, onBack }) {
  return (
    <div style={{
      flexShrink: 0, position: 'relative', display: 'flex', alignItems: 'center',
      justifyContent: 'center', height: 54, borderBottom: `1px solid ${M_BORDER}`,
      background: M_PANEL,
    }}>
      <BackBtn onClick={onBack} />
      <span style={{
        fontFamily: OSWALD, fontSize: 13, fontWeight: 600,
        letterSpacing: '0.12em', color: M_TEXT, textTransform: 'uppercase',
      }}>{title}</span>
    </div>
  );
}

// ── List view ─────────────────────────────────────────────────────────────────

function HandListRow({ hand, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: `11px ${PAD}px`, borderBottom: `1px solid ${M_BORDER}`,
        background: 'transparent', border: 'none',
        cursor: 'pointer', textAlign: 'left',
      }}
    >
      <TypeBadge flagType={hand.flagType} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: M_TEXT, fontWeight: 500, lineHeight: 1.3 }}>
          {summaryFor(hand)}
        </div>
        <div style={{ marginTop: 2, fontSize: 11, color: M_MUTED }}>
          {hand.handNumber != null ? `Hand #${hand.handNumber}` : 'Unknown hand'}
          {Number.isFinite(hand.pot) && hand.pot > 0 ? ` · Pot ${hand.pot}` : ''}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={M_MUTED}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  );
}

function ListView({ agentName, hands, onSelect, onBack }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 9,
      display: 'flex', flexDirection: 'column',
      background: M_PANEL,
    }}>
      <SheetHeader title="Flagged Hands" onBack={onBack} />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {hands.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: M_MUTED, fontSize: 13 }}>
            Nothing flagged this session.
          </div>
        ) : (
          hands.map((hand, i) => (
            <HandListRow
              key={`${hand.handNumber ?? i}-${hand.flagType}`}
              hand={hand}
              onClick={() => onSelect(hand)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Hand review ───────────────────────────────────────────────────────────────

// Board cards for one street. `board` is an array of card strings e.g. ['Ah','Kd','2c'].
function BoardCards({ board }) {
  if (!board || board.length === 0) return null;
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0, minWidth: 104 }}>
      {board.map((c, i) => {
        if (typeof c === 'string' && c.length >= 2) {
          return <PlayingCard key={i} rank={c[0]} suit={c[1].toLowerCase()} w={23} h={32} />;
        }
        return <CardBack key={i} w={23} h={32} />;
      })}
    </div>
  );
}

// equity (integer %) compared against pot odds (integer %) to determine matched.
// When potOdds is missing, equity ≥ 50 = WITH THE MATH for aggressive actions.
function isMatched(street) {
  const eq = street.equity;
  if (!Number.isFinite(eq)) return true;
  const actionType = (street.action ?? '').split(' ')[0].toLowerCase();
  if (actionType === 'fold') return eq < 50;
  if (actionType === 'call') {
    return Number.isFinite(street.potOdds) ? eq >= street.potOdds : eq >= 45;
  }
  // bet / raise
  return eq >= 50;
}

// ATTR-2d — the character system showing through: one extra label under the
// verdict, naming the attribute that shaped the decision. Gold when it cost
// money, teal when it earned it. Never a grade on the hand; the verdict above
// already did that, and the line reads as HIS misjudgment, not a scolding.
function AttrCostLine({ item, stack }) {
  const earned = item.cost === false;
  const cls = ['attr-cost', earned ? 'attr-cost--earned' : '', stack ? 'attr-cost--stack' : '']
    .filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <span className="attr-cost__note">{item.line}</span>
      <span className="attr-cost__key">{item.key}</span>
    </div>
  );
}

// hand.attrCosts: [{ key, line, street?, cost? }] — supplied by ATTR-3, absent
// today. Entries naming a street ride that street's verdict column; the rest
// sit in one row above the streets. No field, no row.
function splitAttrCosts(hand) {
  const byStreet = new Map();
  const loose = [];
  for (const c of (Array.isArray(hand?.attrCosts) ? hand.attrCosts : [])) {
    if (!c?.key || !c?.line) continue;
    const s = typeof c.street === 'string' ? c.street.toUpperCase() : null;
    if (s) {
      if (!byStreet.has(s)) byStreet.set(s, []);
      byStreet.get(s).push(c);
    } else {
      loose.push(c);
    }
  }
  return { byStreet, loose };
}

// StreetRow — verbatim port from design-refs/mood-screens-f.jsx.
// showStreetHeader: false for 2nd+ rows sharing the same street label (street grouping).
function StreetRow({ street, board, action, equity, matched, reason, attr, last, showStreetHeader = true }) {
  return (
    <div style={{ padding: `10px ${PAD}px`, borderBottom: last ? 'none' : `1px solid ${M_BORDER}` }}>
      {showStreetHeader && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginBottom: 7 }}>
          <span style={{
            fontFamily: OSWALD, fontSize: 9, fontWeight: 600,
            letterSpacing: '0.14em', color: M_MUTED, textTransform: 'uppercase', flexShrink: 0,
          }}>{street}</span>
          <div style={{ flex: 1, height: 1, background: M_BORDER, marginTop: 5 }} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
            {equity != null && (
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                  fontSize: 14, fontWeight: 700, color: matched ? M_TEAL : M_RED,
                }}>{equity}%</span>
                <span style={{
                  fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600,
                  letterSpacing: '0.1em', color: matched ? M_TEAL : M_RED,
                }}>
                  {matched ? 'WITH THE MATH' : 'AGAINST IT'}
                </span>
              </div>
            )}
            {(attr ?? []).map((item, i) => <AttrCostLine key={`${item.key}-${i}`} item={item} />)}
          </div>
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <BoardCards board={board} />
        {action && (
          <span style={{
            padding: '3px 8px', borderRadius: 4, flexShrink: 0,
            background: matched ? `${M_TEAL}1A` : 'rgba(255,77,79,0.14)',
            border: `1px solid ${matched ? `${M_TEAL}55` : `${M_RED}55`}`,
            color: matched ? M_TEAL : M_RED,
            fontFamily: OSWALD, fontSize: 9, fontWeight: 600,
            letterSpacing: '0.1em', whiteSpace: 'nowrap',
          }}>{action}</span>
        )}
      </div>
      {reason && (
        <div style={{
          fontSize: 12, color: M_DIM, lineHeight: 1.45, marginTop: 7, fontStyle: 'italic',
        }}>
          "{reason}"
        </div>
      )}
    </div>
  );
}

// Verdict band — same anatomy as MoodBand from design-refs/mood-screens-f.
function VerdictBand({ hand, agentName, mood = 'neutral' }) {
  const pnl = Number.isFinite(hand.pot) ? hand.pot : 0;
  const pnlLabel = hand.won ? `+${pnl}` : `−${pnl}`;
  const pnlColor = hand.won ? M_TEAL : M_RED;
  const m = TYPE_META[hand.flagType] ?? TYPE_META.biggestPot;

  return (
    <div style={{
      flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11,
      padding: `9px ${PAD}px 11px`, borderBottom: `1px solid ${M_BORDER}`,
      background: M_PANEL,
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 12, flexShrink: 0,
        background: '#0A0F17', border: `1px solid ${M_PURPLE}55`,
        boxShadow: `0 0 14px ${M_RED}33`,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden',
      }}>
        <MoodGhost mood={mood} accent={M_PURPLE} size={40} ring={false} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center',
            height: 18, padding: '0 6px', borderRadius: 3,
            background: `${pnlColor}1A`, border: `1px solid ${pnlColor}55`,
          }}>
            <span style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 11, fontWeight: 700, color: pnlColor,
            }}>{pnlLabel}</span>
          </span>
          <span style={{
            fontFamily: OSWALD, fontSize: 9, fontWeight: 600,
            letterSpacing: '0.12em', color: M_MUTED, textTransform: 'uppercase',
          }}>{m.label}</span>
        </div>
        <div style={{
          fontSize: 11.5, color: M_DIM, marginTop: 4,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {agentName}{hand.handNumber != null ? ` · Hand #${hand.handNumber}` : ''}
        </div>
      </div>
      <button type="button" style={{
        flexShrink: 0, height: 30, padding: '0 10px', borderRadius: 6,
        background: 'transparent', border: `1px solid ${M_BORDER}`,
        color: M_TEXT, cursor: 'pointer',
        fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em',
        textTransform: 'uppercase', whiteSpace: 'nowrap',
      }}>
        Open chat
      </button>
    </div>
  );
}

// Hole cards row — shown only when holeCards are present (owner-gated by API).
function HoleCardsRow({ holeCards }) {
  if (!Array.isArray(holeCards) || holeCards.length === 0) return null;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: `10px ${PAD}px`, borderBottom: `1px solid ${M_BORDER}`,
      background: 'rgba(255,255,255,0.015)',
    }}>
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        {holeCards.map((c, i) => {
          if (typeof c === 'string' && c.length >= 2) {
            return <PlayingCard key={i} rank={c[0]} suit={c[1].toLowerCase()} w={30} h={41} />;
          }
          return <CardBack key={i} w={30} h={41} />;
        })}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: M_TEXT, fontWeight: 500 }}>Hole cards</div>
      </div>
    </div>
  );
}

function HandReview({ hand, agentName, agentMood, onBack }) {
  const streets = hand.streets ?? [];
  const { byStreet: attrByStreet, loose: looseAttrs } = splitAttrCosts(hand);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      display: 'flex', flexDirection: 'column',
      background: M_PANEL,
    }}>
      <SheetHeader
        title={hand.handNumber != null ? `Hand #${hand.handNumber}` : 'Hand Review'}
        onBack={onBack}
      />
      <VerdictBand hand={hand} agentName={agentName} mood={agentMood} />

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
        <HoleCardsRow holeCards={hand.holeCards} />

        {/* Attribute cost lines the server did not pin to a street. */}
        {looseAttrs.length > 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 6,
            padding: `10px ${PAD}px`, borderBottom: `1px solid ${M_BORDER}`,
          }}>
            {looseAttrs.map((item, i) => <AttrCostLine key={`${item.key}-${i}`} item={item} stack />)}
          </div>
        )}

        {streets.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: M_MUTED, fontSize: 13 }}>
            No street data recorded for this hand.
          </div>
        ) : (() => {
          // Group consecutive rows sharing the same street under one header.
          const groups = [];
          streets.forEach(({ street, board, action, equity, potOdds, reasoning }, idx) => {
            const streetKey = (street ?? 'PREFLOP').toUpperCase();
            if (groups.length > 0 && groups[groups.length - 1].street === streetKey) {
              groups[groups.length - 1].rows.push({ board, action, equity, potOdds, reasoning, idx });
            } else {
              groups.push({ street: streetKey, rows: [{ board, action, equity, potOdds, reasoning, idx }] });
            }
          });
          const totalRows = streets.length;
          let rowCount = 0;
          return groups.map((group) =>
            group.rows.map(({ board, action, equity, potOdds, reasoning, idx }, ri) => {
              const matched = isMatched({ equity, potOdds, action });
              const globalIdx = rowCount++;
              return (
                <StreetRow
                  key={`${group.street}-${idx}`}
                  street={group.street}
                  board={board}
                  action={action}
                  equity={equity}
                  matched={matched}
                  reason={reasoning}
                  attr={ri === 0 ? attrByStreet.get(group.street) : undefined}
                  last={globalIdx === totalRows - 1}
                  showStreetHeader={ri === 0}
                />
              );
            })
          );
        })()}
      </div>

      {/* Composer strip — same anatomy as screen #5 */}
      <div style={{
        flexShrink: 0, borderTop: `1px solid ${M_BORDER}`,
        background: M_PANEL, padding: `9px ${PAD}px 22px`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {Array.isArray(hand.holeCards) && hand.holeCards.length > 0 && (
            <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
              {hand.holeCards.slice(0, 2).map((c, i) => {
                if (typeof c === 'string' && c.length >= 2) {
                  return <PlayingCard key={i} rank={c[0]} suit={c[1].toLowerCase()} w={16} h={22} />;
                }
                return <CardBack key={i} w={16} h={22} />;
              })}
            </div>
          )}
          {hand.handNumber != null && (
            <span style={{
              fontFamily: "'JetBrains Mono', ui-monospace, monospace",
              fontSize: 9.5, fontWeight: 500, color: M_MUTED,
            }}>
              HAND #{hand.handNumber} WILL BE QUOTED
            </span>
          )}
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9, height: 44,
          padding: '0 6px 0 14px', borderRadius: 22,
          background: M_PANEL_2, border: `1px solid ${M_BORDER}`,
        }}>
          <span style={{
            flex: 1, fontSize: 13.5, color: M_MUTED,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Message {agentName}…
          </span>
          <button style={{
            width: 32, height: 32, borderRadius: '50%',
            background: M_TEAL, border: 'none', cursor: 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: `0 0 10px ${M_TEAL}55`, opacity: 0.5,
          }} disabled aria-label="Open chat to send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#0A0A0A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingState({ onBack }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 9,
      display: 'flex', flexDirection: 'column', background: M_PANEL,
    }}>
      <SheetHeader title="Flagged Hands" onBack={onBack} />
      <div style={{ padding: 24, textAlign: 'center', color: M_MUTED, fontSize: 13 }}>
        Loading…
      </div>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function FlaggedHandsSheet({ agent, onBack }) {
  const [hands, setHands] = useState(null); // null = loading
  const [selectedHand, setSelectedHand] = useState(null);

  useEffect(() => {
    if (!agent?.id) return;
    const url = `/api/agents/${encodeURIComponent(agent.id)}/flagged?userId=${encodeURIComponent(getUserId())}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : Promise.reject(r.status))
      .then((data) => setHands(Array.isArray(data.flaggedHands) ? data.flaggedHands : []))
      .catch(() => setHands([]));
  }, [agent?.id]);

  const agentName = agent?.name ?? 'Agent';
  const agentMood = agent?.mood?.state ?? 'neutral';

  if (hands === null) return <LoadingState onBack={onBack} />;

  if (selectedHand) {
    return (
      <HandReview
        hand={selectedHand}
        agentName={agentName}
        agentMood={agentMood}
        onBack={() => setSelectedHand(null)}
      />
    );
  }

  return (
    <ListView
      agentName={agentName}
      hands={hands}
      onSelect={setSelectedHand}
      onBack={onBack}
    />
  );
}
