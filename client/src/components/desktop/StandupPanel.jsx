// The right panel, when no ghost is selected. Composition ported from
// design-refs/mood-desktop2.jsx D2IdleScreenM and mood-desktop3.jsx
// D3HomeOneScreenM: PanelHead → standup card → tile stack → roster → composer.
import { accentFor } from '../floor/atoms.jsx';
import { moodOf, stateOf, lastMomentOf } from '../floor/agentView.js';
import { GameTile } from './GameTile.jsx';
import { PStandupCard } from './PStandupCard.jsx';
import { PanelHead, RailBody, PComposer, PRosterRow, DraftPanel } from './panelParts.jsx';
import { PFlaggedCard } from './PFlaggedCard.jsx';
import { DeskRoomCard } from './DeskRoomCard.jsx';
import { gainsWithin, grewWithin } from '../../lib/attributes.js';

const MAX_SEATS = 4;

function fmtNet(net) {
  if (!Number.isFinite(net) || net === 0) return '—';
  return net < 0 ? `−$${Math.abs(net).toLocaleString()}` : `+$${net.toLocaleString()}`;
}

function TileStack({ games, highlightId, watchedId, onOpenTable, game, lastDecision }) {
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
            onWatch={() => onOpenTable(agent)}
            onFocusTable={isWatched ? () => onOpenTable(agent) : null}
          />
        );
      })}
    </>
  );
}

export function StandupPanel({
  agents, loading, game, lastDecision, selectedId, watchedId,
  draft, onDraftChange, onSelect, onOpenTable, onDraftAgent, onOpenFlagged,
}) {
  const live = agents.filter((a) => a.activeTableId || a.liveGame?.tableId);
  const sub = loading
    ? '—'
    : `${agents.length} AGENT${agents.length === 1 ? '' : 'S'} · ${live.length} LIVE`;

  if (!loading && agents.length === 0) {
    return (
      <div className="dsk-panel">
        <PanelHead title="Welcome" sub="NO AGENTS YET" />
        <RailBody>
          <div className="dsk-welcome">
            <span className="dsk-label" style={{ fontSize: 9.5 }}>Standup</span>
            <div className="dsk-welcome__title">Nothing to report yet.</div>
            <div className="dsk-welcome__body">
              The room is open. None of the agents on the floor are yours.
            </div>
          </div>
          <DraftPanel first onDraft={onDraftAgent} />
        </RailBody>
        <PComposer
          value={draft}
          onChange={onDraftChange}
          onSend={() => {}}
          placeholder="Draft an agent to start a conversation…"
          onCommand={(cmd) => onDraftChange(`${cmd} `)}
        />
      </div>
    );
  }

  return (
    <div className="dsk-panel">
      <PanelHead title="Standup" sub={sub} />
      <RailBody>
        <PStandupCard agents={agents} loading={loading} />

        {/* DP-5 — wave 34's fourth rule at the desk: the room says what
            happened in it, and who it happened to. */}
        <DeskRoomCard agents={agents} onSelect={onSelect} />

        {live.length > 0 && (
          <TileStack
            games={live}
            highlightId={selectedId}
            watchedId={watchedId}
            game={game}
            lastDecision={lastDecision}
            onOpenTable={onOpenTable}
          />
        )}

        <PFlaggedCard agents={agents} onOpen={onOpenFlagged} />

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
                  grew={grewWithin(agent.attrLog)
                    ? gainsWithin(agent.attrLog).reduce((n, g) => n + g.gain, 0)
                    : 0}
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
