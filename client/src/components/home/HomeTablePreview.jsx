import { equipmentOf } from '../../../../src/shared/wardrobe.js';
// The 92px live felt in mood-home2.jsx:TableSheet. Reads the room's existing
// spectator snapshot; opens no socket and never draws private hole cards.
import { PlayingCard } from '../system/PlayingCard.jsx';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { identitiesFor } from '../../lib/identity.js';
import { homeBoardFor } from './HomeGame.jsx';

export function HomeTablePreview({ game = null, liveTable = null, agents = [] }) {
  const running = game?.state === 'running';
  const seats = running && Array.isArray(game.seats) ? game.seats.filter(Boolean).slice(0, 4) : [];
  const board = homeBoardFor(liveTable, running ? game.tableId : null);
  const identities = identitiesFor(agents);
  return (
    <div className="table-sheet__felt" data-testid="home-table-preview">
      {board.length > 0 && <span className="table-sheet__board" aria-label={`Community cards: ${board.join(' ')}`}>
        {board.map((card, index) => <PlayingCard key={`${card}-${index}`} rank={card[0]} suit={card[1]} w={17} h={24} />)}
      </span>}
      {seats.map((seat, index) => {
        const agent = seat.agentId ? agents.find(a => a.id === seat.agentId) : null;
        const identity = agent ? identities.get(agent.id) : null;
        const name = agent?.name || seat.name || (seat.house ? 'House' : 'Player');
        // Reference pair:112/358 and246/358. More occupants share that row.
        // An actual human gets their name, never an invented ghost.
        const left = seats.length === 1 ? 50 : seats.length === 2 ? (index ? 68.7 : 31.3) : (index + 0.5) * 100 / seats.length;
        return <span key={seat.agentId || `seat-${seat.seat ?? index}`} className="table-sheet__portrait"
          style={{ left: `${left}%` }} role="img" aria-label={name}>
          {agent ? <span aria-hidden="true"><MoodGhost equipment={equipmentOf(agent)} size={22} mood={agent.mood?.state ?? 'neutral'} heat={agent.mood?.heat}
            hood={identity?.hood} glow={identity?.glow?.c} /></span>
            : <span className="table-sheet__seat-name">{name}</span>}
        </span>;
      })}
    </div>
  );
}
