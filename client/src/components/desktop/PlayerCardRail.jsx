// ATTR-2e-1 — the player card, in the desktop panel.
// Ported from design-refs/char-profile.jsx PlayerCardRail (screen
// D3ThreadCardScreenM) and char-birth.jsx BirthCardRail (DeskBirthCardScreenM).
//
// It mirrors the mobile card in screens/AgentProfileScreen.jsx: same
// normalizeAttrs contract, same shared atoms, same laws. The ceiling is never a
// number on a bar, nothing here is purchasable, and his voice stays in the
// thread — the card carries the nature line and nothing else he says.
import { useMemo, useState } from 'react';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { AttrCluster } from '../system/AttrCluster.jsx';
import { FatigueLine, NatureChip, NatureFormingChip } from '../system/CharacterAtoms.jsx';
import { accentFor } from '../floor/atoms.jsx';
import { moodOf, heatOf } from '../floor/agentView.js';
import { normalizeAttrs, seriesFor, ATTR_META } from '../../lib/attributes.js';
import { RailBody } from './panelParts.jsx';

function Identity({ agent, accent, mood, heat = 45, nature, size = 56, nameSize = 20, centred }) {
  const hands = agent?.careerStats?.hands ?? 0;
  const born = hands > 0 ? `${hands.toLocaleString()} HANDS` : 'BORN TODAY · 0 HANDS';
  return (
    <div className="dsk-pcard__id" style={{ alignItems: centred ? 'center' : 'flex-start' }}>
      <div className="dsk-pcard__ghost" style={{ width: size, height: size, borderColor: `${accent}44` }}>
        <MoodGhost mood={mood} heat={heat} accent={accent} size={size - 2} ring={false} />
      </div>
      <div className="dsk-pcard__id-text">
        <div className="dsk-pcard__name" style={{ fontSize: nameSize }}>{agent.name}</div>
        <div className="dsk-pcard__id-row">
          {nature ? <NatureChip nature={nature} /> : <NatureFormingChip />}
          {!centred && <span className="dsk-pcard__born">{born}</span>}
        </div>
      </div>
    </div>
  );
}

function AttrSection({ rows, note, expand, onExpand, seriesOf, children }) {
  return (
    <div>
      <div className="dsk-pcard__sec-head">
        <span className="dsk-label" style={{ fontSize: 9.5 }}>Attributes</span>
        <span className="dsk-pcard__note">{note}</span>
      </div>
      <div className="dsk-pcard__box">
        <AttrCluster rows={rows} expand={expand} onExpand={onExpand} seriesFor={seriesOf} />
        {children}
      </div>
    </div>
  );
}

const CAREER_CELLS = [
  { label: 'Hands', read: (c) => (c?.hands ?? 0).toLocaleString() },
  { label: 'Win rate', read: (c) => (Number.isFinite(c?.winRate) ? `${c.winRate.toFixed(1)}%` : '—') },
  {
    label: 'Net',
    read: (c) => {
      const n = c?.net;
      if (!Number.isFinite(n) || n === 0) return '—';
      return n < 0 ? `−$${Math.abs(n).toLocaleString()}` : `+$${n.toLocaleString()}`;
    },
  },
  {
    label: 'Biggest pot',
    read: (c) => (c?.biggestPot ? `$${c.biggestPot.toLocaleString()}` : '—'),
  },
];

/**
 * The veteran card — what the panel shows for an agent that already exists.
 * `expand` is owned here so the tapped bar survives a poll refresh.
 */
export function PlayerCardRail({ agent, accentIndex }) {
  const [expand, setExpand] = useState(null);

  const character = useMemo(() => normalizeAttrs(agent), [agent]);
  const attrLog = Array.isArray(agent?.attrLog) ? agent.attrLog : [];
  const seriesOf = useMemo(() => (key) => seriesFor(attrLog, key), [attrLog]);

  const accent = accentFor(agent, accentIndex);
  const mood = moodOf(agent);
  const career = agent?.careerStats;

  // Fatigue is a within-session state: the server only sends it while he plays.
  const showFatigue = character.fatigue !== 'fresh';

  return (
    <RailBody pad={14}>
      <Identity agent={agent} accent={accent} mood={mood} heat={heatOf(agent)} nature={character.nature} />

      {/* His nature in one sentence — the card's only line of voice, and it is
          about who he is rather than what he just did. Hidden while a bar is
          open, exactly as the mobile card does it: the panel is the argument. */}
      {!expand && character.nature?.line && (
        <div className="dsk-pcard__nature-line">{character.nature.line}</div>
      )}

      <AttrSection
        rows={character.rows}
        note={character.scouted ? 'GOLD = SCOUTED CEILING' : 'CEILING NOT YET SCOUTED'}
        expand={expand}
        onExpand={setExpand}
        seriesOf={seriesOf}
      >
        {showFatigue && (
          <div className="dsk-pcard__fatigue">
            <FatigueLine stage={character.fatigue} hands={agent?.liveGame?.heroSessionHands} />
          </div>
        )}
      </AttrSection>

      <div className="dsk-pcard__career">
        {CAREER_CELLS.map((cell, i) => {
          const value = cell.read(career);
          return (
            <div key={cell.label} className="dsk-pcard__career-cell" style={i ? undefined : { borderLeft: 'none', paddingLeft: 0 }}>
              <span className="dsk-label" style={{ fontSize: 8.5 }}>{cell.label}</span>
              <div className={`dsk-pcard__career-val${value.startsWith('+') ? ' is-up' : ''}`}>{value}</div>
            </div>
          );
        })}
      </div>
    </RailBody>
  );
}

/**
 * The card he was born with. Same anatomy, different frame: no career yet, the
 * ceiling is explicitly unscouted, and the footnote says out loud that none of
 * this is for sale.
 */
export function BirthCardRail({ agent, onDealIn }) {
  const character = useMemo(() => normalizeAttrs(agent), [agent]);
  const accent = accentFor(agent, 0);
  const nature = character.nature;

  return (
    <RailBody pad={14}>
      <Identity
        agent={agent}
        accent={accent}
        mood={moodOf(agent)}
        heat={heatOf(agent)}
        nature={nature}
        nameSize={21}
        centred
      />

      {/* 3. His opening line. The contract carries the nature's sentence and
             nothing else he has said yet — a newborn has no thread. */}
      {nature?.line && <div className="dsk-pcard__first">“{nature.line}”</div>}

      {/* The zero-sum pair in words. Both halves come from the nature's up/down
          keys, which the contract does carry — nothing is invented here. */}
      {nature?.up && nature?.down && (
        <div className="dsk-pcard__box">
          <div className="dsk-pcard__pair">
            <div className="dsk-pcard__pair-row">
              <span className="dsk-pcard__pair-label is-up">BUILT FOR</span>
              <span className="dsk-pcard__pair-text">{ATTR_META[nature.up]?.meanShort}</span>
            </div>
            <div className="dsk-pcard__pair-row">
              <span className="dsk-pcard__pair-label">WILL STRUGGLE</span>
              <span className="dsk-pcard__pair-text is-dim">{ATTR_META[nature.down]?.meanShort}</span>
            </div>
          </div>
        </div>
      )}

      <AttrSection rows={character.rows} note="CEILING NOT YET SCOUTED">
        <div className="dsk-pcard__footnote">
          Every number is exact and every ceiling is a guess. The bands close as he
          plays — nothing here is bought, and none of it is re-rolled.
        </div>
      </AttrSection>

      {onDealIn && (
        <button type="button" className="dsk-btn dsk-btn--primary dsk-pcard__deal" onClick={onDealIn}>
          Deal him in
        </button>
      )}
    </RailBody>
  );
}
