import { useCallback, useEffect, useRef, useState } from 'react';
import { useTable } from './hooks/useTable.js';
import { Header } from './components/Header.jsx';
import { Setup } from './components/Setup.jsx';
import { ActionBar } from './components/ActionBar.jsx';
import { HistoryDrawer } from './components/HistoryDrawer.jsx';
import { HandHistory } from './components/HandHistory.jsx';
import { PlayHeader, PlayTable, OpponentRow, YouRow, FooterActions } from './components/PlayScreen.jsx';
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

  // ── Setup / lobby screen ──────────────────────────────────────────────────
  if (!config) {
    return (
      <div className="app">
        <Header status={status} hasConfig={false} />
        <Setup onConnect={connect} />
      </div>
    );
  }

  // ── Game screen ───────────────────────────────────────────────────────────
  const opponentSeat = mySeat === 0 ? 1 : 0;
  const inHand = !!game && [
    Streets.PREFLOP, Streets.FLOP, Streets.TURN, Streets.RIVER, Streets.SHOWDOWN,
  ].includes(game.street);

  const myData = game?.seats?.[mySeat] ?? { displayName: 'You', stack: 0, holeCards: [] };
  const oppData = game?.seats?.[opponentSeat] ?? { displayName: 'Opponent', stack: 0, holeCards: [] };

  const getPosition = (seat) => {
    if (!game) return '';
    return game.dealerSeat === seat ? 'SB' : 'BB';
  };

  const handIsActive = !!game && game.toAct !== null && game.street !== Streets.COMPLETE;
  const isOpponentTurn = handIsActive && game.toAct === opponentSeat;

  return (
    <div className="app play-app">
      {/* ── Main scroll area (header + opponent + table + player) ── */}
      <main className="app__main ps-main">
        <PlayHeader
          stack={myData.stack}
          onToggleHistory={() => setHistoryOpen(v => !v)}
          onLeave={handleLeave}
        />

        {error && (
          <div className="error-banner" onClick={dismissError} style={{ margin: '0 16px 8px' }}>
            {error} · tap to dismiss
          </div>
        )}

        <OpponentRow
          name={oppData.displayName || displayNames[opponentSeat]}
          stack={oppData.stack}
          position={getPosition(opponentSeat)}
          isToAct={isOpponentTurn}
          holeCards={oppData.holeCards}
          inHand={inHand}
        />

        <PlayTable
          pot={game?.pot ?? 0}
          community={game?.community ?? []}
          street={game?.street ?? Streets.WAITING}
        />

        <YouRow
          name={myData.displayName || 'You'}
          stack={myData.stack}
          position={getPosition(mySeat)}
          holeCards={myData.holeCards}
          isToAct={handIsActive && game?.toAct === mySeat}
          inHand={inHand}
        />

        <FooterActions
          historyCount={history.length}
          onToggleHistory={() => setHistoryOpen(v => !v)}
          onLeave={handleLeave}
        />
      </main>

      {/* ── Action bar (fixed on mobile, inline on desktop) ── */}
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

      {/* Desktop: sticky history panel */}
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

      {/* Mobile: slide-in drawer */}
      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        history={history}
        displayNames={displayNames}
      />
    </div>
  );
}
