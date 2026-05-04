import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTable } from './hooks/useTable.js';
import { Header } from './components/Header.jsx';
import { Play } from './components/Play.jsx';
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
    config, connect, disconnect, act, deal, rename,
  } = table;
  const displayNames = {
    0: game?.seats?.[0]?.displayName ?? 'Seat A',
    1: game?.seats?.[1]?.displayName ?? 'Seat B',
  };

  const [historyOpen, setHistoryOpen] = useState(false);

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
    const gameInProgress = game &&
      game.street !== Streets.WAITING &&
      game.street !== Streets.COMPLETE;
    const tg = window.Telegram?.WebApp;
    if (gameInProgress && tg?.showConfirm) {
      tg.showConfirm('Your game is still running. Leave anyway?', (confirmed) => {
        if (confirmed) { disconnect(); tg.close?.(); }
      });
    } else {
      disconnect();
      tg?.close?.();
    }
  }, [game, disconnect]);

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
        <Play onConnect={connect} />
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
