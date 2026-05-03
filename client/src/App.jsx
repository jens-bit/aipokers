import { useEffect, useMemo, useRef } from 'react';
import { useTable } from './hooks/useTable.js';
import { Header } from './components/Header.jsx';
import { Setup } from './components/Setup.jsx';
import { PlayerSeat } from './components/PlayerSeat.jsx';
import { Board } from './components/Board.jsx';
import { ActionBar } from './components/ActionBar.jsx';
import { HandHistory } from './components/HandHistory.jsx';

const WS_URL = `ws://${window.location.hostname}:8765`;

export default function App() {
  const table = useTable({ wsUrl: WS_URL });
  const { game, mySeat, legalActions, history, error, dismissError, status, config, connect, disconnect, act, deal, rename } = table;

  // Track buy-in for P/L. Set on connect; doesn't change during a session.
  const buyInRef = useRef(null);
  useEffect(() => {
    if (config && buyInRef.current == null) buyInRef.current = config.buyIn;
    if (!config) buyInRef.current = null;
  }, [config]);

  if (!config) {
    return (
      <div className="app app--solo">
        <Header status={status} hasConfig={false} />
        <Setup onConnect={connect} />
      </div>
    );
  }

  return (
    <div className="app">
      <Header status={status} tableId={config.tableId} mySeat={mySeat} onLeave={disconnect} hasConfig />
      <main className="app__main">
        {error && (
          <div className="error-banner" onClick={dismissError}>
            {error} · click to dismiss
          </div>
        )}
        <TableView game={game} mySeat={mySeat} buyIn={buyInRef.current} onRename={rename} />
        <ActionBar
          game={game}
          mySeat={mySeat}
          legalActions={legalActions}
          status={status}
          onAct={act}
          onDeal={deal}
        />
      </main>
      <aside className="app__sidebar">
        <HandHistory
          history={history}
          displayNames={{
            0: game?.seats?.[0]?.displayName ?? 'Seat A',
            1: game?.seats?.[1]?.displayName ?? 'Seat B',
          }}
        />
      </aside>
    </div>
  );
}

function TableView({ game, mySeat, buyIn, onRename }) {
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
        isDealer={!!seatProps?.[opponentSeat]?.isDealer}
        isSmallBlind={!!seatProps?.[opponentSeat]?.isSmallBlind}
        isBigBlind={!!seatProps?.[opponentSeat]?.isBigBlind}
        isToAct={!!seatProps?.[opponentSeat]?.isToAct}
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
        onRename={onRename}
        isDealer={!!seatProps?.[mySeat]?.isDealer}
        isSmallBlind={!!seatProps?.[mySeat]?.isSmallBlind}
        isBigBlind={!!seatProps?.[mySeat]?.isBigBlind}
        isToAct={!!seatProps?.[mySeat]?.isToAct}
      />
    </div>
  );
}
