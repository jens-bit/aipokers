// The right panel, when no ghost is selected. Composition ported from
// design-refs/mood-desktop2.jsx D2IdleScreenM and mood-desktop3.jsx
// D3HomeOneScreenM: PanelHead → standup card → tile stack → roster → composer.
import { accentFor } from '../floor/atoms.jsx';
import { moodOf, stateOf, lastMomentOf } from '../floor/agentView.js';
import { GameTile } from './GameTile.jsx';
import { PStandupCard } from './PStandupCard.jsx';
import { PanelHead, RailBody, PComposer, PRosterRow, DraftPanel } from './panelParts.jsx';

const MAX_SEATS = 4;

function fmtNet(net) {
  if (!Number.isFinite(net) || net === 0) return '—';
  return net < 0 ? `−$${Math.abs(net).toLocaleString()}` : `+$${net.toLocaleString()}`;
}

function TileStack({ games, highlightId, watchedId, onWatch, onFocusTable, game, lastDecision }) {
  return (
    <>
      <div className="dsk-stack-head">
        <span className="dsk-label">{games.length === 1 ? '1 game live' : `${games.length} games live`}</span>
        <span className="dsk-stack-head__note">NO SWIPING — ALL VISIBLE</span>
      </div>
      {games.map((agent) => {
        const isWatched = watchedId === agent.id;
        return (
          <GameTile
            key={agent.id}
            agentName={agent.name}
            game={isWatched ? game : null}
            lastDecision={isWatched ? lastDecision : null}
            highlighted={highlightId === agent.id || isWatched}
            dimmed={highlightId != null && highlightId !== agent.id && !isWatched}
            onWatch={() => onWatch(agent)}
            onFocusTable={isWatched ? onFocusTable : null}
          />
        );
      })}
    </>
  );
}

export function StandupPanel({
  agents, loading, game, lastDecision, selectedId, watchedId,
  draft, onDraftChange, onSelect, onWatch, onFocusTable, onDraftAgent,
}) {
  const live = agents.filter((a) => a.activeTableId || a.liveGame?.tableId);
  const sub = loading
    ? '—'
    : `${agents.length} AGENT${agents.length === 1 ? '' : 'S'} · ${live.length} LIVE`;

  return (
    <div className="dsk-panel">
      <PanelHead title="Standup" sub={sub} />
      <RailBody>
        <PStandupCard agents={agents} loading={loading} />

        {live.length > 0 && (
          <TileStack
            games={live}
            highlightId={selectedId}
            watchedId={watchedId}
            game={game}
            lastDecision={lastDecision}
            onWatch={onWatch}
            onFocusTable={onFocusTable}
          />
        )}

        {agents.length > 0 && (
          <>
            <div className="dsk-stack-head dsk-stack-head--roster">
              <span className="dsk-label">The stable · {agents.length}</span>
              <span className="dsk-stack-head__hint">click a ghost to zoom</span>
            </div>
            <div className="dsk-roster">
              {agents.map((agent, i) => (
                <PRosterRow
                  key={agent.id}
                  name={agent.name}
                  accent={accentFor(agent, i)}
                  mood={moodOf(agent)}
                  state={stateOf(agent)}
                  line={lastMomentOf(agent)}
                  pnl={fmtNet(agent.careerStats?.net)}
                  active={selectedId === agent.id || watchedId === agent.id}
                  onClick={() => onSelect(agent)}
                />
              ))}
            </div>
          </>
        )}

        {!loading && agents.length < MAX_SEATS && (
          <DraftPanel first={agents.length === 0} onDraft={onDraftAgent} />
        )}
      </RailBody>

      <PComposer
        value={draft}
        onChange={onDraftChange}
        onSend={() => {}}
        placeholder="Pick an agent to talk to…"
        onCommand={(cmd) => onDraftChange(`${cmd} `)}
      />
    </div>
  );
}
