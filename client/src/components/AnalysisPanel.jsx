import { useEffect, useRef, useState } from 'react';

// Ported from design-refs/analysis.jsx.
// Receives the last AI decision ({ action, reasoning, seat }) and renders the
// analysis section: tabs, decision card, reasoning card, range matrix, action row.
// Colors use the project's CSS tokens (var(--accent) etc.) in place of the
// design-ref's raw hex values.

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

function TabBar({ active, onSelect, hasChatBadge }) {
  const tabs = ['LIVE ANALYSIS', 'RANGE', 'HISTORY', 'CHAT'];
  return (
    <div style={{
      display: 'flex', gap: 18, padding: '0 4px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      marginBottom: 14,
    }}>
      {tabs.map((t, i) => {
        const isActive = i === active;
        const showDot = t === 'CHAT' && hasChatBadge && !isActive;
        return (
          <div
            key={t}
            className={showDot ? 'dr-tab-button--chat' : undefined}
            style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              position: 'relative',
              paddingBottom: 12,
              marginBottom: -13,
              borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
              cursor: isActive ? 'default' : 'pointer',
              userSelect: 'none',
            }}
            onClick={() => !isActive && onSelect(i)}
          >{t}</div>
        );
      })}
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
      {/* Action queue */}
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

      {/* Take action */}
      <div style={{
        background: 'transparent',
        border: '1.5px solid var(--accent)',
        borderRadius: 12,
        padding: '10px 12px',
        flex: 1.4, minWidth: 0,
        boxShadow: '0 0 16px rgba(0, 212, 170, 0.18), inset 0 0 0 1px rgba(0,212,170,0.1)',
        textAlign: 'center',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accent)' }}>
          TAKE ACTION NOW
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginTop: 3 }}>
          Override agent decision
        </div>
      </div>

      {/* Autoplay */}
      <div style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 12, padding: 10, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={LABEL_STYLE}>AUTOPLAY</div>
          <div style={{ width: 30, height: 18, borderRadius: 999, background: 'var(--accent)', position: 'relative' }}>
            <div style={{
              position: 'absolute', top: 2, right: 2,
              width: 14, height: 14, borderRadius: '50%',
              background: '#fff', boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }} />
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text-secondary)', lineHeight: 1.3 }}>
          Agent will act
        </div>
      </div>
    </div>
  );
}

// ── Chat tab ──────────────────────────────────────────────────────────────────

function ChatTabContent({ messages, onSend, mySeat, displayNames }) {
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages.length]);

  function submit(e) {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <div className="dr-chat-tab">
      <div ref={listRef} className="dr-chat-tab__list">
        {messages.length === 0 ? (
          <div className="dr-chat-tab__empty">No messages yet…</div>
        ) : (
          messages.map((m, i) => {
            const isSelf = mySeat !== null && m.seat === mySeat;
            return (
              <div
                key={`${m.t ?? i}-${i}`}
                className={`dr-chat-tab__row${isSelf ? ' dr-chat-tab__row--self' : ''}`}
              >
                <span className="dr-chat-tab__name">
                  {displayNames[m.seat] || m.displayName || `Seat ${m.seat}`}
                  {m.isAI && <span className="dr-chat-tab__ai-pill">AI</span>}
                </span>
                <span className="dr-chat-tab__bubble">{m.text}</span>
              </div>
            );
          })
        )}
      </div>
      <form className="dr-chat-tab__form" onSubmit={submit}>
        <input
          className="dr-chat-tab__input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Say something…"
          maxLength={280}
          aria-label="Chat message"
        />
        <button className="dr-chat-tab__send" type="submit" disabled={!text.trim()}>
          SEND
        </button>
      </form>
    </div>
  );
}

// ── Public export ─────────────────────────────────────────────────────────────

export function AnalysisPanel({
  lastDecision,
  chatMessages = [],
  onSendChat = () => {},
  mySeat = null,
  displayNames = {},
}) {
  const [activeTab, setActiveTab] = useState(0);

  if (!lastDecision) return null;
  const { action, reasoning } = lastDecision;

  return (
    <div className="analysis-panel">
      <TabBar
        active={activeTab}
        onSelect={setActiveTab}
        hasChatBadge={chatMessages.length > 0}
      />
      {activeTab === 0 && (
        <>
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
            <DecisionCard action={action} />
            <ReasoningCard reasoning={reasoning} />
            <RangeMatrix />
          </div>
          <ActionRow />
        </>
      )}
      {activeTab === 3 && (
        <ChatTabContent
          messages={chatMessages}
          onSend={onSendChat}
          mySeat={mySeat}
          displayNames={displayNames}
        />
      )}
    </div>
  );
}
