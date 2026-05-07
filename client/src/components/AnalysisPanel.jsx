// Ported from design-refs/analysis.jsx.
// Receives the last AI decision ({ action, reasoning, seat }) plus chat props
// and renders tabs: LIVE ANALYSIS, RANGE, HISTORY, CHAT.

import { useEffect, useRef, useState } from 'react';

const CARD_STYLE = {
  background: 'var(--bg-secondary)',
  border: '1px solid rgba(255,255,255,0.05)',
  borderRadius: 12,
  padding: 12,
  flex: 1,
  minWidth: 0,
};

const LABEL_STYLE = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

function formatAction(action) {
  if (!action) return '—';
  const { type, amount } = action;
  if (type === 'fold')  return 'Fold';
  if (type === 'check') return 'Check';
  if (type === 'call')  return 'Call';
  if (type === 'bet')   return `Bet ${amount}`;
  if (type === 'raise') return `Raise ${amount}`;
  return type;
}

function actionConfidence(action) {
  if (!action) return 67;
  switch (action.type) {
    case 'raise': return 78;
    case 'bet':   return 75;
    case 'call':  return 62;
    case 'check': return 55;
    case 'fold':  return 82;
    default:      return 67;
  }
}

function reasoningBullets(reasoning) {
  if (!reasoning) return ['Analyzing position…'];
  return reasoning
    .split(/[;,]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function EmptyState({ message }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 10, padding: '28px 16px',
      color: 'var(--text-muted)', textAlign: 'center',
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 3" />
      </svg>
      <span style={{ fontSize: 12, letterSpacing: '0.04em', lineHeight: 1.4 }}>{message}</span>
    </div>
  );
}

function ConfidenceRing({ value = 67 }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - value / 100);
  return (
    <div style={{ position: 'relative', width: 64, height: 64 }}>
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4"/>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--accent)" strokeWidth="4"
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round" transform="rotate(-90 32 32)"/>
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value}%</div>
        <div style={{ fontSize: 8, fontWeight: 500, letterSpacing: '0.06em', color: 'var(--text-muted)', marginTop: 2 }}>Confidence</div>
      </div>
    </div>
  );
}

function DecisionCard({ action }) {
  const confidence = actionConfidence(action);
  return (
    <div style={CARD_STYLE}>
      <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>CURRENT DECISION</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent)', letterSpacing: '-0.02em' }}>
        {formatAction(action)}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 2, marginBottom: 8 }}>
        EV: <span style={{ color: 'var(--text-primary)' }}>—</span>
      </div>
      <ConfidenceRing value={confidence} />
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
      stroke="var(--accent)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden style={{ flexShrink: 0 }}>
      <path d="M5 12l5 5 9-11" />
    </svg>
  );
}

function ReasoningCard({ reasoning }) {
  const bullets = reasoningBullets(reasoning);
  return (
    <div style={{ ...CARD_STYLE, flex: 1.1 }}>
      <div style={{ ...LABEL_STYLE, marginBottom: 10 }}>REASONING</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {bullets.map((item, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, fontSize: 11.5, color: 'var(--text-primary)', lineHeight: 1.3 }}>
            <CheckIcon />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RangeMatrix() {
  const ranks = ['A','K','Q','J','10','9','8','7','6','5','4','3','2'];
  const intensity = (r, c) => {
    if (r === c) return Math.max(0, 1 - r * 0.07);
    if (r < c) {
      const d = c - r;
      return Math.max(0, 0.85 - d * 0.12 - r * 0.04);
    }
    const d = r - c;
    return Math.max(0, 0.55 - d * 0.10 - c * 0.04);
  };
  return (
    <div style={{ ...CARD_STYLE, flex: 1.4 }}>
      <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>OPPONENT RANGE</div>
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{ width: 11, display: 'flex', flexDirection: 'column', justifyContent: 'space-around', paddingTop: 11 }}>
          {ranks.map((rank) => (
            <div key={rank} style={{ fontSize: 7, color: 'var(--text-muted)', textAlign: 'right', height: 7, lineHeight: '7px' }}>{rank}</div>
          ))}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginBottom: 2, height: 9 }}>
            {ranks.map((rank) => (
              <div key={rank} style={{ fontSize: 7, color: 'var(--text-muted)', flex: 1, textAlign: 'center' }}>{rank}</div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(13, 1fr)', gap: 1 }}>
            {ranks.map((_, ri) =>
              ranks.map((_, ci) => {
                const v = intensity(ri, ci);
                return (
                  <div key={`${ri}-${ci}`} style={{
                    aspectRatio: '1',
                    background: v > 0.05
                      ? `rgba(0, 212, 170, ${Math.min(0.95, v)})`
                      : 'rgba(255,255,255,0.04)',
                    borderRadius: 1,
                  }} />
                );
              })
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: 7, color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, background: 'var(--accent)', borderRadius: 1, display: 'inline-block' }} /> Likely
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, background: 'rgba(0,212,170,0.4)', borderRadius: 1, display: 'inline-block' }} /> Possible
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 7, background: 'rgba(255,255,255,0.08)', borderRadius: 1, display: 'inline-block' }} /> Unlikely
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ActionRow() {
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, flex: 1.2, minWidth: 0 }}>
        <div style={{ ...LABEL_STYLE, marginBottom: 8 }}>ACTION QUEUE</div>
        <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>
          If called <span style={{ color: 'var(--text-muted)' }}>→</span> Bet 65% pot
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
          <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>On turn</span>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} style={{
              width: 18, height: 18, borderRadius: 4,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 10, color: 'var(--text-muted)',
            }}>?</span>
          ))}
        </div>
      </div>
      <div style={{
        background: 'transparent',
        border: '1.5px solid var(--accent)',
        borderRadius: 12, padding: '10px 12px',
        flex: 1.4, minWidth: 0,
        boxShadow: '0 0 16px rgba(0, 212, 170, 0.18), inset 0 0 0 1px rgba(0,212,170,0.1)',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)' }}>TAKE ACTION NOW</div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>Override agent decision</div>
      </div>
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={LABEL_STYLE}>AUTOPLAY</div>
          <div style={{ width: 30, height: 18, borderRadius: 999, background: 'var(--accent)', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 2, right: 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }} />
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3 }}>Agent will act</div>
      </div>
    </div>
  );
}

const TAB_LABELS = ['LIVE ANALYSIS', 'RANGE', 'HISTORY', 'CHAT'];

// ── Public export ─────────────────────────────────────────────────────────────

export function AnalysisPanel({ lastDecision, chatMessages = [], onSendChat, mySeat, displayNames = {} }) {
  const [activeTab, setActiveTab] = useState(0);
  const [chatDraft, setChatDraft] = useState('');
  const chatListRef = useRef(null);

  useEffect(() => {
    const el = chatListRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chatMessages.length]);

  const { action, reasoning } = lastDecision || {};

  function submitChat(e) {
    e?.preventDefault();
    const text = chatDraft.trim();
    if (!text) return;
    onSendChat?.(text);
    setChatDraft('');
  }

  return (
    <div className="analysis-panel dr-app">
      <div className="dr-tabs">
        {TAB_LABELS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={[
              i === activeTab ? 'is-active' : '',
              i === 3 ? 'dr-tab-button--chat' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => setActiveTab(i)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* LIVE ANALYSIS */}
      {activeTab === 0 && (
        lastDecision ? (
          <>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <DecisionCard action={action} />
              <ReasoningCard reasoning={reasoning} />
            </div>
            <ActionRow />
          </>
        ) : (
          <EmptyState message="Waiting for first action…" />
        )
      )}

      {/* RANGE */}
      {activeTab === 1 && (
        <div style={{ marginTop: 10 }}>
          <RangeMatrix />
        </div>
      )}

      {/* HISTORY */}
      {activeTab === 2 && <EmptyState message="No hands played yet." />}

      {/* CHAT */}
      {activeTab === 3 && (
        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 10 }}>
          <div
            ref={chatListRef}
            style={{
              maxHeight: 200, overflowY: 'auto',
              display: 'flex', flexDirection: 'column', gap: 8,
              paddingBottom: 8,
            }}
          >
            {chatMessages.length === 0 ? (
              <EmptyState message="No messages yet. Say something to your opponent." />
            ) : (
              chatMessages.map((m, i) => {
                const isMine = m.seat === mySeat;
                return (
                  <div key={`${m.t ?? i}-${i}`} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '80%', padding: '8px 12px', borderRadius: 12, fontSize: 12, lineHeight: 1.4,
                      background: isMine ? 'var(--accent)' : 'var(--bg-secondary)',
                      color: isMine ? 'var(--bg-primary)' : 'var(--text-primary)',
                      border: isMine ? 'none' : '1px solid rgba(255,255,255,0.06)',
                      borderBottomRightRadius: isMine ? 3 : 12,
                      borderBottomLeftRadius: isMine ? 12 : 3,
                    }}>
                      {!isMine && (
                        <div style={{ fontSize: 10, color: isMine ? 'var(--bg-primary)' : 'var(--text-muted)', marginBottom: 3, fontWeight: 600 }}>
                          {displayNames[m.seat] ?? m.displayName ?? `Seat ${m.seat}`}
                        </div>
                      )}
                      {m.text}
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <form
            onSubmit={submitChat}
            style={{
              display: 'flex', gap: 8, paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <input
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Message opponent…"
              style={{
                flex: 1, height: 36, padding: '0 10px', fontSize: 16,
                borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
                background: 'var(--bg-secondary)', color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={!chatDraft.trim()}
              style={{
                height: 36, padding: '0 12px', borderRadius: 8,
                border: '1px solid var(--accent)', background: 'transparent',
                color: 'var(--accent)', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
                cursor: 'pointer', opacity: chatDraft.trim() ? 1 : 0.45,
              }}
            >
              SEND
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
