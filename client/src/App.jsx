import { useEffect, useMemo, useState } from 'react';
import { useTable } from './hooks/useTable.js';
import { Header } from './components/Header.jsx';
import { Setup } from './components/Setup.jsx';
import { PlayerSeat } from './components/PlayerSeat.jsx';
import { Board } from './components/Board.jsx';
import { ActionBar } from './components/ActionBar.jsx';
import { HandHistory } from './components/HandHistory.jsx';

const WS_URL = 'ws://localhost:8765';

export default function App() {
  const table = useTable({ wsUrl: WS_URL });
  const { game, holeCards, legalActions, history, error, dismissError, connectionStatus, config, connect, disconnect, act, deal } = table;

  // Display names live in App so the user can rename mid-session without
  // disturbing the playerId the server uses for reconnect identity.
  const [displayNames, setDisplayNames] = useState({ 0: '', 1: '' });

  useEffect(() => {
    if (!config) {
      setDisplayNames({ 0: '', 1: '' });
      return;
    }
    setDisplayNames({
      0: config.players[0].displayName,
      1: config.players[1].displayName,
    });
  }, [config]);

  const handleConnect = (cfg) => connect(cfg);
  const handleLeave = () => disconnect();
  const renameSeat = (seat, name) =>
    setDisplayNames((d) => ({ ...d, [seat]: name }));

  if (!config) {
    return (
      <div className="app" style={{ gridTemplateColumns: '1fr', gridTemplateRows: '56px 1fr' }}>
        <Header connectionStatus={connectionStatus} hasConfig={false} />
        <Setup onConnect={handleConnect} />
      </div>
    );
  }

  const buyIns = { 0: config.players[0].buyIn, 1: config.players[1].buyIn };
  const players = {
    0: { displayName: displayNames[0] || 'Player A', buyIn: buyIns[0] },
    1: { displayName: displayNames[1] || 'Player B', buyIn: buyIns[1] },
  };

  return (
    <div className="app">
      <Header connectionStatus={connectionStatus} tableId={config.tableId} onLeave={handleLeave} hasConfig />
      <main className="app__main">
        {error && (
          <div className="error-banner" onClick={dismissError} style={{ cursor: 'pointer' }}>
            {error}  · click to dismiss
          </div>
        )}
        <TableView
          game={game}
          holeCards={holeCards}
          players={players}
          onRename={renameSeat}
        />
        <ActionBar
          game={game}
          seat={game?.toAct ?? 0}
          legalActions={legalActions}
          onAct={act}
          onDeal={deal}
        />
      </main>
      <aside className="app__sidebar">
        <HandHistory history={history} displayNames={{ 0: players[0].displayName, 1: players[1].displayName }} />
      </aside>
    </div>
  );
}

function TableView({ game, holeCards, players, onRename }) {
  const seatProps = useMemo(() => {
    if (!game) {
      return {
        0: { isDealer: false, isSmallBlind: false, isBigBlind: false, isToAct: false, data: emptySeat() },
        1: { isDealer: false, isSmallBlind: false, isBigBlind: false, isToAct: false, data: emptySeat() },
      };
    }
    return {
      0: {
        isDealer: game.dealerSeat === 0,
        isSmallBlind: game.dealerSeat === 0,
        isBigBlind: game.dealerSeat !== 0,
        isToAct: game.toAct === 0,
        data: game.seats[0],
      },
      1: {
        isDealer: game.dealerSeat === 1,
        isSmallBlind: game.dealerSeat === 1,
        isBigBlind: game.dealerSeat !== 1,
        isToAct: game.toAct === 1,
        data: game.seats[1],
      },
    };
  }, [game]);

  return (
    <div className="table-area">
      <PlayerSeat
        seat={1}
        position="top"
        player={players[1]}
        data={seatProps[1].data}
        holeCards={holeCards[1] || []}
        isDealer={seatProps[1].isDealer}
        isSmallBlind={seatProps[1].isSmallBlind}
        isBigBlind={seatProps[1].isBigBlind}
        isToAct={seatProps[1].isToAct}
        showCards
        onRename={onRename}
      />
      <Board
        pot={game?.pot ?? 0}
        community={game?.community ?? []}
        street={game?.street ?? 'waiting'}
      />
      <PlayerSeat
        seat={0}
        position="bottom"
        player={players[0]}
        data={seatProps[0].data}
        holeCards={holeCards[0] || []}
        isDealer={seatProps[0].isDealer}
        isSmallBlind={seatProps[0].isSmallBlind}
        isBigBlind={seatProps[0].isBigBlind}
        isToAct={seatProps[0].isToAct}
        showCards
        onRename={onRename}
      />
    </div>
  );
}

function emptySeat() {
  return { stack: 0, contribTotal: 0, contribThisStreet: 0, folded: false, allIn: false, holeCards: [] };
}
