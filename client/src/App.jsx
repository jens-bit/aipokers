import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from './hooks/useTable.js';
import { Header } from './components/Header.jsx';
import { Play } from './components/Play.jsx';
import { AgentsTab } from './components/AgentsTab.jsx';
import { getTelegramDisplayName, getUserId } from './lib/telegram.js';
import { PlayerSeat } from './components/PlayerSeat.jsx';
import { Board } from './components/Board.jsx';
import { ActionBar } from './components/ActionBar.jsx';
import { HistoryDrawer } from './components/HistoryDrawer.jsx';
import { HandHistory } from './components/HandHistory.jsx';
import { Streets } from './lib/protocol.js';

function resolveWsUrl() {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.DEV) return `${proto}//${window.location.hostname}:8765`;
  return `${proto}//${window.location.host}`;
}
const WS_URL = resolveWsUrl();

export default function App() {
  const table = useTable({ wsUrl: WS_URL });
  const {
    game, mySeat, legalActions, history,
    error, dismissError, status,
    reconnectAttempt, maxReconnectAttempts,
    config, connect, watch, disconnect, act, deal, rename,
  } = table;
  const displayNames = {
    0: game?.seats?.[0]?.displayName ?? 'Seat A',
    1: game?.seats?.[1]?.displayName ?? 'Seat B',
  };

  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('play');
  const [playInitialStep, setPlayInitialStep] = useState('pick');
  const [playKey, setPlayKey] = useState(0);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const activeAgentIdRef = useRef(null); // stable ref avoids stale-closure in handleLeave
  const [editingAgent, setEditingAgent] = useState(null); // full agent object for CHAT editing

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

  useEffect(() => {
    if (activeAgentId && status === 'closed') callAgentFinish(activeAgentId);
  }, [status, activeAgentId, callAgentFinish]);

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

  if (!config) {
    return (
      <div className="app">
        <Header status={status} hasConfig={false} />
        <div className="pre-game">
          {activeTab === 'play' && (
            <Play
              key={playKey}
              onConnect={connect}
              onWatch={(payload) => {
                setActiveAgent(payload.agentId);
                watch({
                  tableId: payload.tableId,
                  agentStrategy: payload.strategy,
                  displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
                  wantOpponentAI: false,
                });
              }}
              onDone={() => {
                setPlayInitialStep('pick');
                setPlayKey((k) => k + 1);
                setActiveTab('agents');
              }}
              initialStep={playInitialStep}
              existingAgent={editingAgent}
            />
          )}
          {activeTab === 'agents' && (
            <AgentsTab
              onDeploy={(payload) => {
                setActiveAgent(payload.agentId);
                watch({
                  tableId: payload.tableId,
                  agentStrategy: payload.strategy,
                  displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
                  wantOpponentAI: false,
                });
              }}
              onVsYou={(payload) => {
                setActiveAgent(payload.agentId);
                connect({
                  tableId: payload.tableId,
                  displayName: getTelegramDisplayName() || 'Player',
                  buyIn: 1000,
                  smallBlind: 10,
                  bigBlind: 20,
                  wantAI: true,
                  agentStrategy: payload.strategy,
                  agentDisplayName: payload.agentName,
                });
              }}
              onCreateAgent={() => {
                setEditingAgent(null);
                setPlayInitialStep('create-agent');
                setPlayKey((k) => k + 1);
                setActiveTab('play');
              }}
              onChatAgent={(agent) => {
                setEditingAgent(agent);
                setPlayInitialStep('create-agent');
                setPlayKey((k) => k + 1);
                setActiveTab('play');
              }}
            />
          )}
        </div>
        <nav className="tab-bar">
          <button
            className={`tab-bar__tab${activeTab === 'play' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => {
              setPlayInitialStep('pick');
              setEditingAgent(null);
              setPlayKey((k) => k + 1); // force Play remount → clears internal step state
              setActiveTab('play');
            }}
          >
            PLAY
          </button>
          <button
            className={`tab-bar__tab${activeTab === 'agents' ? ' tab-bar__tab--active' : ''}`}
            onClick={() => setActiveTab('agents')}
          >
            AGENTS
          </button>
        </nav>
      </div>
    );
  }

  return (
    <div className="app">
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
      <main className="app__main">
        {error && (
          <div className="error-banner" onClick={dismissError}>
            {error} · tap to dismiss
          </div>
        )}
        <TableView game={game} mySeat={mySeat} buyIn={buyInRef.current} onRename={rename} timerLeft={timerLeft} timerTotal={TIMER_TOTAL} />
      </main>
      {config?.isSpectator ? (
        <WatchBanner config={config} game={game} mySeat={mySeat} />
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

function WatchBanner({ config, game, mySeat }) {
  const myName = config?.displayName || 'Agent';
  const opponentSeat = mySeat === 0 ? 1 : 0;
  const oppName = game?.seats?.[opponentSeat]?.displayName;
  const handNum = game?.handNumber;

  let text;
  if (oppName && handNum) {
    text = `${myName} vs ${oppName} — Hand #${handNum}`;
  } else if (oppName) {
    text = `${myName} vs ${oppName}`;
  } else {
    text = `Waiting for opponent…`;
  }
  return <div className="watch-banner">👁 {text}</div>;
}

function TableView({ game, mySeat, buyIn, onRename, timerLeft, timerTotal }) {
  const opponentSeat = mySeat === 0 ? 1 : 0;

  const seatProps = useMemo(() => {
    if (!game) return null;
    const sp = (i) => ({
      isDealer: game.dealerSeat === i,
      isSmallBlind: game.dealerSeat === i,
      isBigBlind: game.dealerSeat !== i,
      isToAct: game.toAct === i,
      data: game.seats[i],
    });
    return { 0: sp(0), 1: sp(1) };
  }, [game]);

  const inHand = !!game && [Streets.PREFLOP, Streets.FLOP, Streets.TURN, Streets.RIVER, Streets.SHOWDOWN].includes(game.street);

  const emptyData = (label) => ({
    displayName: label, stack: 0, contribTotal: 0, contribThisStreet: 0,
    folded: false, allIn: false, holeCards: [],
  });

  const oppData = seatProps?.[opponentSeat]?.data ?? emptyData('Waiting…');
  const meData = seatProps?.[mySeat]?.data ?? emptyData('You');

  return (
    <div className="table-area">
      <PlayerSeat
        seat={opponentSeat}
        position="top"
        data={oppData}
        isMine={false}
        inHand={inHand}
        isDealer={!!seatProps?.[opponentSeat]?.isDealer}
        isSmallBlind={!!seatProps?.[opponentSeat]?.isSmallBlind}
        isBigBlind={!!seatProps?.[opponentSeat]?.isBigBlind}
        isToAct={!!seatProps?.[opponentSeat]?.isToAct}
        timeLeft={timerLeft}
        timerTotal={timerTotal}
      />
      <Board
        pot={game?.pot ?? 0}
        community={game?.community ?? []}
        street={game?.street ?? 'waiting'}
      />
      <PlayerSeat
        seat={mySeat ?? 0}
        position="bottom"
        data={meData}
        buyIn={buyIn}
        isMine
        inHand={inHand}
        onRename={onRename}
        isDealer={!!seatProps?.[mySeat]?.isDealer}
        isSmallBlind={!!seatProps?.[mySeat]?.isSmallBlind}
        isBigBlind={!!seatProps?.[mySeat]?.isBigBlind}
        isToAct={!!seatProps?.[mySeat]?.isToAct}
        timeLeft={timerLeft}
        timerTotal={timerTotal}
      />
    </div>
  );
}
