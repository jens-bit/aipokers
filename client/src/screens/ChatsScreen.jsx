// NAV-1b will replace this with the full agent roster (HomeScreenM port).
// For NAV-1a this placeholder fetches agents and lets you tap into a thread.
import { useEffect, useState } from 'react';
import { getUserId } from '../lib/telegram.js';

export function ChatsScreen({ onSelectAgent, onCreateAgent }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/agents?userId=${getUserId()}`)
      .then((r) => r.json())
      .then((data) => { setAgents(data.agents || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="dr-app" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ fontSize: 12, color: '#6B6B6B', letterSpacing: '0.12em', fontFamily: '"Oswald",sans-serif' }}>LOADING…</span>
      </div>
    );
  }

  if (!agents.length) {
    return (
      <div className="dr-app" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
        <span style={{ fontFamily: '"Playfair Display",Georgia,serif', fontSize: 18, color: '#EDEDED' }}>No agents yet</span>
        <span style={{ fontSize: 13, color: '#6B6B6B', textAlign: 'center', lineHeight: 1.5 }}>Create your first agent to get started.</span>
        <button
          type="button"
          onClick={onCreateAgent}
          style={{
            height: 44, padding: '0 20px', borderRadius: 10, border: 'none',
            background: '#00D4AA', color: '#0A0A0A',
            fontFamily: '"Oswald",sans-serif', fontSize: 13, fontWeight: 700,
            letterSpacing: '0.1em', cursor: 'pointer', marginTop: 4,
          }}
        >
          CREATE YOUR FIRST AGENT
        </button>
      </div>
    );
  }

  return (
    <div className="dr-app dr-screen" style={{ flex: 1 }}>
      <div style={{ padding: '12px 14px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: '"Oswald",sans-serif', fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: '#6B6B6B', textTransform: 'uppercase' }}>
          Your agents
        </span>
        <button
          type="button"
          onClick={onCreateAgent}
          style={{
            height: 28, padding: '0 10px', borderRadius: 7,
            border: '1px solid rgba(0,212,170,0.4)', background: 'transparent',
            color: '#00D4AA', fontFamily: '"Oswald",sans-serif',
            fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', cursor: 'pointer',
          }}
        >
          + NEW
        </button>
      </div>
      {agents.map((agent) => (
        <button
          key={agent.id}
          type="button"
          onClick={() => onSelectAgent(agent)}
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 11,
            padding: '10px 14px',
            background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
            cursor: 'pointer', textAlign: 'left',
          }}
        >
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: '#0A0F17', border: '1px solid rgba(0,212,170,0.27)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00D4AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2C8 2 5 5 5 9v6l-2 3h18l-2-3V9c0-4-3-7-7-7z"/>
              <circle cx="9" cy="13" r="1" fill="#00D4AA" stroke="none"/>
              <circle cx="15" cy="13" r="1" fill="#00D4AA" stroke="none"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: '"Playfair Display",Georgia,serif', fontSize: 14, fontWeight: 600, color: '#EDEDED', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {agent.name}
            </div>
            <div style={{ fontSize: 11.5, color: '#6B6B6B', marginTop: 2 }}>
              {agent.activeTableId ? 'Playing now' : 'Ready'}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4A4A4A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 6l6 6-6 6"/>
          </svg>
        </button>
      ))}
    </div>
  );
}
