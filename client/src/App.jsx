import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from './hooks/useTable.js';
import { Header } from './components/Header.jsx';
import { Play } from './components/Play.jsx';
import { AgentsTab } from './components/AgentsTab.jsx';
import { getTelegramDisplayName, getUserId } from './lib/telegram.js';
import { PlayerSeat } from './components/PlayerSeat.jsx';
import { Board } from './components/Board.jsx';
import { ActionBar } from './components/ActionBar.jsx';
import { ChatBar } from './components/ChatBar.jsx';
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
  } = table;
  const displayNames = useMemo(() => {
    const names = {};
    (game?.seats || []).forEach((seat, index) => {
      names[index] = seat?.displayName ?? `Seat ${index + 1}`;
    });
    return names;
  }, [game?.seats]);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('play');
  const [playInitialStep, setPlayInitialStep] = useState('pick');
  const [playKey, setPlayKey] = useState(0);
  const [activeAgentId, setActiveAgentId] = useState(null);
  const activeAgentIdRef = useRef(null); // stable ref avoids stale-closure in handleLeave
  const [editingAgent, setEditingAgent] = useState(null); // full agent object for CHAT editing
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
                  agentId: payload.agentId,
                  userId: getUserId(),
                  agentStrategy: payload.strategy,
                  displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
                  wantOpponentAI: false,
                  memoryContext: payload.memoryContext ?? '',
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
                  agentId: payload.agentId,
                  userId: getUserId(),
                  agentStrategy: payload.strategy,
                  displayName: payload.agentName || getTelegramDisplayName() || 'Agent',
                  wantOpponentAI: false,
                  memoryContext: payload.memoryContext ?? '',
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
      <main className="app__main">
        {error && (
          <div className="error-banner" onClick={dismissError}>
            {error} · tap to dismiss
          </div>
        )}
        <TableView game={game} mySeat={mySeat} buyIn={buyInRef.current} onRename={rename} timerLeft={timerLeft} timerTotal={TIMER_TOTAL} />
      </main>
      <ChatBar messages={chatMessages} onSend={sendChat} />
      {config?.isSpectator ? (
        <>
          <WatchBanner config={config} game={game} mySeat={mySeat} />
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

function WatchBanner({ config, game, mySeat }) {
  const myName = config?.displayName || 'Agent';
  const opponents = (game?.seats || []).filter((_, index) => index !== mySeat);
  const oppName = opponents.length > 1
    ? `${opponents.length} opponents`
    : opponents[0]?.displayName;
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

function TableView({ game, mySeat, buyIn, onRename, timerLeft, timerTotal }) {
  const seatCount = Math.max(game?.seats?.length || 2, 2);
  const viewSeat = Number.isInteger(mySeat) ? mySeat : 0;

  const seatProps = useMemo(() => {
    if (!game) return null;
    const blindSeats = resolveBlindSeats(game);
    return game.seats.map((data, i) => ({
      seat: i,
      position: seatPosition(i, viewSeat, game.seats.length),
      isDealer: game.dealerSeat === i,
      isSmallBlind: blindSeats.smallBlindSeat === i,
      isBigBlind: blindSeats.bigBlindSeat === i,
      isToAct: game.toAct === i,
      data,
    }));
  }, [game, viewSeat]);

  const inHand = !!game && [Streets.PREFLOP, Streets.FLOP, Streets.TURN, Streets.RIVER, Streets.SHOWDOWN].includes(game.street);

  const emptyData = (label) => ({
    displayName: label, stack: 0, contribTotal: 0, contribThisStreet: 0,
    folded: false, allIn: false, holeCards: [],
  });

  const seats = seatProps || Array.from({ length: seatCount }, (_, seat) => ({
    seat,
    position: seatPosition(seat, viewSeat, seatCount),
    isDealer: false,
    isSmallBlind: false,
    isBigBlind: false,
    isToAct: false,
    data: emptyData(seat === viewSeat ? 'You' : 'Waiting...'),
  }));
  const sortedSeats = [...seats].sort((a, b) => seatRenderOrder(a.position) - seatRenderOrder(b.position));

  return (
    <div className={`table-area ${seatCount > 2 ? 'table-area--multi' : 'table-area--heads-up'} table-area--seats-${seatCount}`}>
      {sortedSeats.map((seat) => seat.position !== 'bottom' && (
        <PlayerSeat
          key={seat.seat}
          seat={seat.seat}
          position={seat.position}
          data={seat.data}
          isMine={seat.seat === viewSeat}
          inHand={inHand}
          isDealer={seat.isDealer}
          isSmallBlind={seat.isSmallBlind}
          isBigBlind={seat.isBigBlind}
          isToAct={seat.isToAct}
          timeLeft={timerLeft}
          timerTotal={timerTotal}
        />
      ))}
      <Board
        pot={game?.pot ?? 0}
        community={game?.community ?? []}
        street={game?.street ?? 'waiting'}
      />
      {sortedSeats.map((seat) => seat.position === 'bottom' && (
        <PlayerSeat
          key={seat.seat}
          seat={seat.seat}
          position={seat.position}
          data={seat.data}
          buyIn={seat.seat === viewSeat ? buyIn : undefined}
          isMine={seat.seat === viewSeat}
          inHand={inHand}
          onRename={seat.seat === viewSeat ? onRename : undefined}
          isDealer={seat.isDealer}
          isSmallBlind={seat.isSmallBlind}
          isBigBlind={seat.isBigBlind}
          isToAct={seat.isToAct}
          timeLeft={timerLeft}
          timerTotal={timerTotal}
        />
      ))}
    </div>
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
