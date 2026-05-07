import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from './hooks/useTable.js';
import { Header } from './components/Header.jsx';
import { Play } from './components/Play.jsx';
import { HomeTab } from './components/HomeTab.jsx';
import { AgentsTab } from './components/AgentsTab.jsx';
import { AgentChat } from './components/AgentChat.jsx';
import { getTelegramDisplayName, getUserId } from './lib/telegram.js';
import { PlayerSeat } from './components/PlayerSeat.jsx';
import { TableSeat } from './components/TableSeat.jsx';
import { Card } from './components/Card.jsx';
import { ActionBar } from './components/ActionBar.jsx';
import { ChatBar } from './components/ChatBar.jsx';
import { HistoryDrawer } from './components/HistoryDrawer.jsx';
import { HandHistory } from './components/HandHistory.jsx';
import { AnalysisPanel } from './components/AnalysisPanel.jsx';
import { Streets } from './lib/protocol.js';

function resolveWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.DEV) return `${proto}//${window.location.hostname}:8765`;
  return `${proto}//${window.location.host}`;
}
const WS_URL = resolveWsUrl();

function agentHandsApiUrl(agentId) {
  return `/api/agents/${encodeURIComponent(agentId)}/hands?userId=${encodeURIComponent(getUserId())}`;
}

export default function App() {
  const table = useTable({ wsUrl: WS_URL });
  const {
    game, mySeat, legalActions, history,
    error, dismissError, status,
    reconnectAttempt, maxReconnectAttempts,
    config, connect, watch, disconnect, act, deal, rename,
    chatMessages, sendChat,
    lastDecision,
  } = table;
  const displayNames = useMemo(() => {
    const names = {};
    (game?.seats || []).forEach((seat, index) => {
      names[index] = seat?.displayName ?? `Seat ${index + 1}`;
    });
    return names;
  }, [game?.seats]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('home');
  const [playInitialStep, setPlayInitialStep] = useState('pick');
  const [playKey, setPlayKey] = useState(0);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const activeAgentIdRef = useRef(null); // stable ref avoids stale-closure in handleLeave
  const [editingAgent, setEditingAgent] = useState(null); // full agent object for CHAT editing
  const [agentChatTarget, setAgentChatTarget] = useState(null);
  const [lastAgentHand, setLastAgentHand] = useState(null);
  const [lastAgentHandOpen, setLastAgentHandOpen] = useState(false);
  const lastResultKeyRef = useRef(null);

  function setActiveAgent(id) {
    activeAgentIdRef.current = id;
    setActiveAgentId(id);
  }

  const callAgentFinish = useCallback((agentId) => {
    if (!agentId) return;
    fetch(`/api/agents/${agentId}/finish`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: getUserId() }),
    }).catch(() => {});
    activeAgentIdRef.current = null;
    setActiveAgentId(null);
  }, []);

  const loadLatestAgentHand = useCallback(async (agentId) => {
    if (!agentId) return;
    try {
      const res = await fetch(agentHandsApiUrl(agentId));
      if (!res.ok) throw new Error('hands request failed');
      const data = await res.json();
      const hand = data.recentHands?.[0] || null;
      if (hand?.decisions?.length) {
        setLastAgentHand(hand);
        setLastAgentHandOpen(true);
      } else {
        setLastAgentHand(null);
      }
    } catch {
      setLastAgentHand(null);
    }
  }, []);

  useEffect(() => {
    if (activeAgentId && status === 'closed') callAgentFinish(activeAgentId);
  }, [status, activeAgentId, callAgentFinish]);

  useEffect(() => {
    setLastAgentHand(null);
    setLastAgentHandOpen(false);
    lastResultKeyRef.current = null;
  }, [activeAgentId]);

  // ── Seat-level countdown timer (replaces ActionBar's horizontal bar) ────────
  const TIMER_TOTAL = 15;
  const [timerLeft, setTimerLeft] = useState(TIMER_TOTAL);
  const timerFiredRef = useRef(false);
  const actRef = useRef(act);
  useEffect(() => { actRef.current = act; });

  const handIsActive = !!game && game.toAct !== null &&
    game.street !== Streets.COMPLETE && game.street !== Streets.WAITING;
  const isMyTurn = handIsActive && game.toAct === mySeat;
  const timerKey = `${game?.handNumber ?? 0}-${game?.toAct ?? -1}`;

  // Reset to full duration whenever the acting seat changes
  useEffect(() => {
    setTimerLeft(TIMER_TOTAL);
    timerFiredRef.current = false;
  }, [timerKey]);

  // Tick down while a hand is active (shows countdown for whichever seat is acting)
  useEffect(() => {
    if (!handIsActive) return;
    const id = setInterval(() => setTimerLeft((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(id);
  }, [handIsActive, timerKey]);

  // Auto-fold when timer hits 0 on the human player's turn
  useEffect(() => {
    if (isMyTurn && timerLeft === 0 && !timerFiredRef.current) {
      timerFiredRef.current = true;
      actRef.current?.({ type: 'fold' });
    }
  }, [timerLeft, isMyTurn]);

  const handleLeave = useCallback(() => {
    callAgentFinish(activeAgentIdRef.current); // use ref — never stale
    disconnect();
  }, [disconnect, callAgentFinish]);

  const buyInRef = useRef(null);
  useEffect(() => {
    if (config && buyInRef.current == null) buyInRef.current = config.buyIn;
    if (!config) buyInRef.current = null;
  }, [config]);

  useEffect(() => { if (!config) setHistoryOpen(false); }, [config]);

  useEffect(() => {
    if (!config?.isSpectator || !activeAgentId) return;
    const latestResult = findLatestResult(history);
    if (!latestResult) return;

    const key = `${latestResult.handNumber}:${JSON.stringify(latestResult.result)}`;
    if (lastResultKeyRef.current === key) return;
    lastResultKeyRef.current = key;
    loadLatestAgentHand(activeAgentId);
  }, [history, config?.isSpectator, activeAgentId, loadLatestAgentHand]);

  if (!config && agentChatTarget) {
    return (
      <AgentChat
        agent={agentChatTarget}
        onBack={() => setAgentChatTarget(null)}
        onDeploy={async (agent) => {
          setAgentChatTarget(null);
          const res = await fetch(`/api/agents/${agent.id}/queue`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: getUserId() }),
          });
          if (!res.ok) return;
          const payload = await res.json();
          setActiveAgent(payload.agentId);
          watch({
            tableId: payload.tableId,
            agentId: payload.agentId,
            userId: getUserId(),
            agentStrategy: payload.strategy,
            displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
            wantOpponentAI: false,
            memoryContext: payload.memoryContext ?? '',
          });
        }}
      />
    );
  }

  if (!config) {
    const playWatchPayload = (payload) => {
      setActiveAgent(payload.agentId);
      watch({
        tableId: payload.tableId,
        agentId: payload.agentId,
        userId: getUserId(),
        agentStrategy: payload.strategy,
        displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
        wantOpponentAI: false,
        memoryContext: payload.memoryContext ?? '',
      });
    };

    return (
      <div className="app">
        <Header status={status} hasConfig={false} />
        <div className="pre-game">
          {activeTab === 'play' && (
            <Play
              key={playKey}
              onConnect={connect}
              onWatch={playWatchPayload}
              onDone={() => {
                setPlayInitialStep('play-mode');
                setPlayKey((k) => k + 1);
                setActiveTab('agents');
              }}
              initialStep={playInitialStep}
              existingAgent={editingAgent}
            />
          )}
          {activeTab === 'home' && (
            <HomeTab
              onDeploy={(payload) => {
                setActiveAgent(payload.agentId);
                watch({
                  tableId: payload.tableId,
                  agentId: payload.agentId,
                  userId: getUserId(),
                  agentStrategy: payload.strategy,
                  displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
                  wantOpponentAI: false,
                  memoryContext: payload.memoryContext ?? '',
                });
              }}
              onWatch={(payload) => {
                setActiveAgent(payload.agentId);
                watch({
                  tableId: payload.tableId,
                  agentId: payload.agentId,
                  userId: getUserId(),
                  agentStrategy: payload.strategy,
                  displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
                  wantOpponentAI: false,
                  memoryContext: payload.memoryContext ?? '',
                });
              }}
              onCreateAgent={() => {
                setEditingAgent(null);
                setPlayInitialStep('create-agent');
                setPlayKey((k) => k + 1);
                setActiveTab('play');
              }}
              onOpenChat={(agent) => {
                setEditingAgent(agent);
                setPlayInitialStep('create-agent');
                setPlayKey((k) => k + 1);
                setActiveTab('play');
              }}
              onGoPlay={() => setActiveTab('play')}
            />
          )}
          {activeTab === 'agents' && (
            <AgentsTab
              onDeploy={playWatchPayload}
              onVsYou={(payload) => {
                setActiveAgent(payload.agentId);
                connect({
                  tableId: 'vsyou-' + Date.now().toString(36),
                  displayName: getTelegramDisplayName() || 'Player',
                  buyIn: 1000,
                  smallBlind: 10,
                  bigBlind: 20,
                  wantAI: true,
                  agentId: payload.agentId,
                  userId: getUserId(),
                  agentStrategy: payload.strategy,
                  agentDisplayName: payload.agentName,
                  memoryContext: payload.memoryContext ?? '',
                });
              }}
              onCreateAgent={() => {
                setEditingAgent(null);
                setPlayInitialStep('create-agent');
                setPlayKey((k) => k + 1);
                setActiveTab('play');
              }}
              onOpenChat={(agent) => {
                setAgentChatTarget(agent);
              }}
            />
          )}
          {activeTab === 'history' && <HistoryPlaceholder />}
          {activeTab === 'profile' && <ProfilePlaceholder />}
        </div>
        <nav className="tab-bar">
          <button
            className={`tab-bar__tab${activeTab === 'home' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => setActiveTab('home')}
          >
            <HomeIcon />
            <span>HOME</span>
          </button>
          <button
            className={`tab-bar__tab${activeTab === 'play' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => {
              setPlayInitialStep('play-mode');
              setEditingAgent(null);
              setPlayKey((k) => k + 1);
              setActiveTab('play');
            }}
          >
            <PlayIcon />
            <span>PLAY</span>
          </button>
          <button
            className={`tab-bar__tab${activeTab === 'agents' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            <AgentsIcon />
            <span>AGENTS</span>
          </button>
          <button
            className={`tab-bar__tab${activeTab === 'history' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <HistoryIcon />
            <span>HISTORY</span>
          </button>
          <button
            className={`tab-bar__tab${activeTab === 'profile' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            <ProfileIcon />
            <span>PROFILE</span>
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className={`app${config?.isSpectator ? ' app--spectator' : ''}`}>
      <Header
        status={status}
        game={game}
        mySeat={mySeat}
        hasConfig
        historyCount={history.length}
        reconnectAttempt={reconnectAttempt}
        maxReconnectAttempts={maxReconnectAttempts}
        onToggleHistory={() => setHistoryOpen((v) => !v)}
        onLeave={handleLeave}
      />
      <main className={`app__main${config?.isSpectator && lastDecision ? ' app__main--analysis' : ''}`}>
        {error && (
          <div className="error-banner" onClick={dismissError}>
            {error} · tap to dismiss
          </div>
        )}
        <TableView game={game} mySeat={mySeat} buyIn={buyInRef.current} onRename={rename} timerLeft={timerLeft} timerTotal={TIMER_TOTAL} isSpectator={!!config?.isSpectator} />
        {config?.isSpectator && lastDecision && (
          <AnalysisPanel lastDecision={lastDecision} />
        )}
      </main>
      <ChatBar messages={chatMessages} onSend={sendChat} />
      {config?.isSpectator ? (
        <>
          <WatchBanner config={config} game={game} />
          <LastAgentHandPanel
            hand={lastAgentHand}
            open={lastAgentHandOpen}
            onToggle={() => setLastAgentHandOpen((value) => !value)}
          />
        </>
      ) : (
        <ActionBar
          game={game}
          mySeat={mySeat}
          legalActions={legalActions}
          status={status}
          reconnectAttempt={reconnectAttempt}
          maxReconnectAttempts={maxReconnectAttempts}
          onAct={act}
          onDeal={deal}
        />
      )}
      {/* Desktop: sticky history panel. Mobile: hidden by CSS. */}
      <aside className="app__sidebar">
        <div className="panel-header">
          <span className="panel-title">Hand History</span>
          <span className="panel-meta">#{history.length}</span>
        </div>
        <div className="history-content">
          <HandHistory history={history} displayNames={displayNames} variant="panel" />
        </div>
        <div className="panel-footer">
          <span>Session</span>
          <span>{history.length} hand{history.length !== 1 ? 's' : ''}</span>
        </div>
      </aside>
      {/* Mobile: slide-in drawer on demand. Hidden at ≥600px. */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        displayNames={displayNames}
      />
    </div>
  );
}

function WatchBanner({ config, game }) {
  const agentName = config?.displayName || 'Agent';
  const handNum = game?.handNumber;
  const street = (game?.street || Streets.WAITING).toUpperCase();
  const isLive = game && game.street !== Streets.WAITING && game.street !== Streets.COMPLETE;

  return (
    <div className="watch-banner">
      <span className={`watch-banner__dot${isLive ? ' watch-banner__dot--live' : ''}`} aria-hidden />
      <WatchAvatar />
      <div className="watch-banner__meta">
        <b className="watch-banner__name">{agentName}</b>
        <small className="watch-banner__sub">
          {handNum ? `Hand #${handNum}` : 'Waiting'} · {street}
        </small>
      </div>
      <span className="watch-banner__tag">SPECTATING</span>
    </div>
  );
}

function WatchAvatar() {
  return (
    <span className="watch-banner__avatar" aria-hidden>
      <svg viewBox="0 0 40 40">
        <path d="M20 4c-8 0-13 6-13 14v14c0 4 3 6 7 6h12c4 0 7-2 7-6V18c0-8-5-14-13-14z" fill="currentColor" opacity="0.38" />
        <ellipse cx="20" cy="22" rx="7" ry="9" fill="#080b0d" />
        <circle cx="17" cy="20" r="1" fill="#00d4aa" />
        <circle cx="23" cy="20" r="1" fill="#00d4aa" />
      </svg>
    </span>
  );
}

function LastAgentHandPanel({ hand, open, onToggle }) {
  const decisions = hand?.decisions || [];
  if (!decisions.length) return null;

  return (
    <section className="last-hand-panel">
      <button className="last-hand-panel__toggle" type="button" onClick={onToggle}>
        <span>Last hand</span>
        <span>
          Hand #{hand.handNumber ?? '--'} -{' '}
          <b className={hand.won ? 'last-hand-panel__won' : 'last-hand-panel__lost'}>
            {hand.won ? 'WON' : 'LOST'}
          </b>
          {' '} - Pot: {formatAgentAmount(hand.potSize)}
        </span>
      </button>
      {open && (
        <div className="last-hand-panel__body">
          {decisions.map((decision, index) => (
            <div className="history__entry last-hand-panel__decision" key={`${decision.street || 'street'}-${index}`}>
              <span>[{String(decision.street || 'street').toUpperCase()}]</span>
              <span>{formatAgentDecisionAction(decision.action)}</span>
              {decision.reasoning && <span>- "{decision.reasoning}"</span>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function findLatestResult(history) {
  for (const hand of history) {
    const entries = hand.entries || [];
    for (let index = entries.length - 1; index >= 0; index -= 1) {
      const entry = entries[index];
      if (entry.kind === 'result') {
        return { handNumber: hand.handNumber, result: entry.result };
      }
    }
  }
  return null;
}

function formatAgentDecisionAction(action = {}) {
  if (!action?.type) return 'unknown';
  if (action.amount == null) return action.type;
  return `${action.type} ${action.amount}`;
}

function formatAgentAmount(amount) {
  return amount == null ? '--' : amount;
}

function TableView({ game, mySeat, buyIn, onRename, timerLeft, timerTotal, isSpectator }) {
  const viewSeat = Number.isInteger(mySeat) ? mySeat : 0;
  const seatCount = Math.max(game?.seats?.length || 2, 2);
  const opponentSeatIndex = (viewSeat + 1) % seatCount;

  const inHand = !!game && [Streets.PREFLOP, Streets.FLOP, Streets.TURN, Streets.RIVER, Streets.SHOWDOWN].includes(game.street);
  const blindSeats = game ? resolveBlindSeats(game) : { smallBlindSeat: -1, bigBlindSeat: -1 };
  const dealerSeat = game?.dealerSeat ?? -1;
  const handNum = game?.handNumber;
  const pot = game?.pot ?? 0;
  const community = game?.community ?? [];

  const emptyData = (label) => ({
    displayName: label, stack: 0, holeCards: [], folded: false,
    allIn: false, contribThisStreet: 0, contribTotal: 0,
  });

  const heroData = game?.seats?.[viewSeat] ?? emptyData('You');
  const oppData = game?.seats?.[opponentSeatIndex] ?? emptyData('Waiting...');

  function posLabel(seat) {
    if (blindSeats.bigBlindSeat === seat) return 'BB';
    if (blindSeats.smallBlindSeat === seat) return 'SB';
    if (dealerSeat === seat) return 'BTN';
    return '';
  }

  const commSlots = [...community];
  while (commSlots.length < 5) commSlots.push('placeholder');

  return (
    <div className="dr-table-card dr-app">
      <div className="dr-table-card__head">
        <b>HEADS-UP NLH</b>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <small style={{ fontVariantNumeric: 'tabular-nums' }}>
            {handNum ? `Hand #${handNum}` : 'Waiting'}
          </small>
          <span className="dr-live-dot" aria-hidden />
        </span>
      </div>

      <div className="dr-felt">
        <TableSeat
          name={oppData.displayName}
          stack={oppData.stack}
          position={posLabel(opponentSeatIndex)}
          holeCards={oppData.holeCards}
          isToAct={game?.toAct === opponentSeatIndex}
          isSelf={false}
          isCompact={false}
          inHand={inHand}
          folded={oppData.folded}
        />

        <div className="dr-pot" style={{ marginTop: 14 }}>
          <small>POT</small>
          <b>{pot.toLocaleString()}</b>
        </div>

        <div className="dr-board-cards">
          {commSlots.map((c, i) => <Card key={i} card={c} size="felt" />)}
        </div>

        {pot > 0 && (
          <div className="dr-pot-chip">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="12" r="10" stroke="#00D4AA" strokeWidth="2.5" />
              <circle cx="12" cy="12" r="5" fill="#00D4AA" opacity="0.4" />
            </svg>
            <span>{pot.toLocaleString()}</span>
          </div>
        )}

        <TableSeat
          name={heroData.displayName}
          stack={heroData.stack}
          position={posLabel(viewSeat)}
          holeCards={heroData.holeCards}
          isToAct={game?.toAct === viewSeat}
          isSelf={true}
          isCompact={true}
          inHand={inHand}
          folded={heroData.folded}
          isSpectator={isSpectator}
        />
      </div>
    </div>
  );
}

function HistoryPlaceholder() {
  return (
    <div className="placeholder-screen dr-app">
      <div className="placeholder-screen__inner">
        <svg viewBox="0 0 40 40" width="48" height="48" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="20" cy="20" r="15" />
          <path d="M20 10v10l6 6" />
        </svg>
        <p className="placeholder-screen__title">Hand History</p>
        <p className="placeholder-screen__sub">Coming soon</p>
      </div>
    </div>
  );
}

function ProfilePlaceholder() {
  const name = getTelegramDisplayName() || 'Player';
  return (
    <div className="placeholder-screen dr-app">
      <div className="placeholder-screen__inner">
        <svg viewBox="0 0 40 40" width="48" height="48" fill="currentColor">
          <circle cx="20" cy="13" r="7" />
          <path d="M4 36c0-8.8 7.2-16 16-16s16 7.2 16 16H4z" />
        </svg>
        <p className="placeholder-screen__title">{name}</p>
        <p className="placeholder-screen__sub">Profile · Coming soon</p>
      </div>
    </div>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <path d="M10 2L2 8.5V18h5v-6h6v6h5V8.5L10 2z" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <rect x="2" y="5" width="11" height="13" rx="1.5" opacity="0.45" />
      <rect x="7" y="2" width="11" height="13" rx="1.5" />
    </svg>
  );
}

function AgentsIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="4" y="7" width="12" height="9" rx="2" />
      <path d="M8 3h4v4H8z" />
      <circle cx="8" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
      <path d="M8.5 14.5h3" />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
      <circle cx="10" cy="10" r="7.5" />
      <path d="M10 6v4l2.5 2.5" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" aria-hidden>
      <circle cx="10" cy="6" r="3.5" />
      <path d="M3 17.5c0-3.9 3.1-7 7-7s7 3.1 7 7H3z" />
    </svg>
  );
}

function resolveBlindSeats(game) {
  const count = game?.seats?.length || 0;
  const dealer = Number.isInteger(game?.dealerSeat) ? game.dealerSeat : 0;
  const modulo = Math.max(count, 1);
  return {
    smallBlindSeat: Number.isInteger(game?.smallBlindSeat)
      ? game.smallBlindSeat
      : count === 2 ? dealer : (dealer + 1) % modulo,
    bigBlindSeat: Number.isInteger(game?.bigBlindSeat)
      ? game.bigBlindSeat
      : count === 2 ? (dealer + 1) % 2 : (dealer + 2) % modulo,
  };
}

function seatPosition(seat, mySeat, count) {
  const relative = (seat - mySeat + count) % count;
  if (relative === 0) return 'bottom';
  if (count <= 2) return 'top';
  if (count === 3) return relative === 1 ? 'right' : 'left';
  if (relative === 1) return 'right';
  if (relative === 2) return 'top';
  return 'left';
}

function seatRenderOrder(position) {
  return { top: 0, left: 1, right: 2, bottom: 3 }[position] ?? 4;
}
