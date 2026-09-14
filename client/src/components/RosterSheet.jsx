// client/src/components/RosterSheet.jsx — BUGS-A job 9
//
// EVERYBODY WHO WORKS FOR YOU, BEHIND THE AVATAR.
//
// The top-right avatar has been an inert silhouette with a `TODO: open profile
// drawer/sheet` next to it since the header was ported. And CASINO-1 took CHATS
// off the tab bar on the promise that the thread is reached from Home and from
// a profile — which is true, and leaves nowhere to answer "who have I got, and
// where are they all right now" when somebody is not standing in the room.
//
// This is that answer, and it is the roster the old CHATS list used to be: one
// row per agent, and the row IS the way into his thread.
//
// FOUR FACTS PER ROW, and no fifth:
//
//   face    the same MoodGhost the room and the felt draw. One drawing of a
//           man, wherever he appears.
//   name    whole (BUGS-A job 1), because a list of first words is a list of
//           strangers.
//   where   in the room's own words — at a table, in a named room, or at home.
//           This is the question the sheet exists to answer.
//   pocket  his actual pocket, with a separate current/last session result.
//           C5 labels the pocket explicitly; Watch carries the live stack.
//
// ...and the unread dot, which is not a fact about him but a fact about YOU:
// he has said something you have not read.
//
// It is a sheet and not a screen. The thing behind it — the room, the casino,
// whatever you were reading — keeps its place, and this comes down over it and
// goes away with the same finger gesture as every other sheet (job 5).

import { useEffect, useState } from 'react';

import { MoodGhost } from './system/MoodGhost.jsx';
import { useSheetDrag } from '../hooks/useSheetDrag.js';
import { accentFor } from './floor/atoms.jsx';
import { heatOf, moodOf, presenceOf, hasUnseenRecap, homeGameOf } from './floor/agentView.js';
import { roomLabel } from './home/AwayWall.jsx';
import { identityOf } from '../lib/identity.js';
import { fetchWallet, money, signedMoney } from '../lib/wallet.js';
import { getTelegramInitData, getUserId } from '../lib/telegram.js';
export { canSendVisiting } from '../lib/visit.js';
import '../styles/roster.css';

/**
 * Where he is, in the room's own words.
 *
 * Never a status word ("active", "idle"): those are facts about a record. This
 * is a fact about a man, and the difference is the whole product.
 */
export function rosterWhereabouts(agent) {
  if (agent?.visiting) return {
    where: agent.visiting.hostName ? `visiting ${agent.visiting.hostName}'s` : 'visiting a friend',
    detail: agent.liveGame?.blinds || null,
  };
  if (homeGameOf(agent) && (agent?.location?.where ?? 'home') === 'home') {
    return { where: 'at your table', detail: 'kitchen' };
  }
  const where = agent?.location?.where ?? null;
  if (presenceOf(agent) === 'playing' || (where && where !== 'home')) {
    return { where: 'at the casino', detail: roomLabel(agent?.location?.room) || agent?.liveGame?.blinds || null };
  }
  // BUG-203: parallel with the other three sentences ("at your table", "at
  // the casino", "visiting Fidde's") — "home" on its own read as a status
  // word rather than a place, which is exactly what this line exists not to
  // be.
  return { where: 'at home', detail: agent?.routine?.label || null };
}

/**
 * design-refs/mood-nav.jsx's `WHERE` map, ported alongside the sentence
 * rather than instead of it (BUGS-A job 9's law against a bare status word is
 * about the SENTENCE, not about colour). "You don't understand that they are
 * out there" is a scanning problem — a muted 10px line reads the same for a
 * man at home and a man at the casino until you actually read it. A coloured
 * one-word badge answers "is he here" at a glance; the sentence beside it
 * still answers "where, exactly" the way a fact about a man should.
 */
const ROSTER_BADGE = {
  home: { c: '#7FA8C9', t: 'HOME' },
  table: { c: '#7FA8C9', t: 'HOME' },
  casino: { c: 'var(--accent)', t: 'CASINO' },
  visiting: { c: 'var(--gold-reward)', t: 'VISITING' },
};

/** Which of the ref's four categories this row's sentence maps to. */
export function rosterCategory(agent) {
  if (agent?.visiting) return 'visiting';
  if (homeGameOf(agent) && (agent?.location?.where ?? 'home') === 'home') return 'table';
  const where = agent?.location?.where ?? null;
  if (presenceOf(agent) === 'playing' || (where && where !== 'home')) return 'casino';
  return 'home';
}

export function whereLine(agent) {
  return rosterWhereabouts(agent).where;
}

/** Has he said something the owner has not read? */
export function hasUnread(agent) {
  return hasUnseenRecap(agent) || !!agent?.want;
}

// C5's result is a real session result, not lifetime earnings or a guessed night.
export function rosterResult(agent) {
  if (!homeGameOf(agent) && Number.isFinite(agent?.liveGame?.net)) return { value: agent.liveGame.net, label: 'Current session result' };
  const recent = agent?.sessionLog?.at(-1);
  return { value: Number.isFinite(recent?.net) ? recent.net : null, label: 'Last session result' };
}

export function rosterLive(agent) {
  return !!agent?.liveGame?.tableId && (!agent?.homeTableId || !!agent?.visiting);
}

export function RosterRow({ agent, index, onOpen }) {
  const pocket = Number.isFinite(agent?.pocket?.balance) ? agent.pocket.balance : null;
  const result = rosterResult(agent);
  const live = rosterLive(agent);
  const unread = hasUnread(agent);
  const whereabouts = rosterWhereabouts(agent);
  const category = rosterCategory(agent);
  const badge = ROSTER_BADGE[category];
  const away = category !== 'home' && category !== 'table';
  // HOME-2 job 3: the same creature the room draws. A row that tinted him
  // differently from his body would be a second man with his name on it.
  const id = identityOf(agent);

  return (
    <li className="roster__item">
      <button
        type="button"
        className="roster__row"
        data-agent={agent.id}
        data-where={category}
        onClick={() => onOpen?.(agent)}
        aria-label={`${agent.name} — ${whereabouts.where}${whereabouts.detail ? ` · ${whereabouts.detail}` : ''}. Open his thread.`}
      >
        <span className={`roster__face${away ? ' roster__face--away' : ''}`}>
          <MoodGhost
            mood={moodOf(agent)}
            heat={heatOf(agent)}
            accent={accentFor(agent, index)}
            size={38}
            ring={false}
            hood={id.hood}
            glow={id.glow.c}
          />
          {unread && !agent.want && !live ? <span className="roster__dot" data-testid={`roster-unread-${agent.id}`} /> : null}
          {live && <span className="roster__live" role="img" aria-label="Live at a table"/>}
          {agent.want && <span className="roster__want" role="img" aria-label="Wants your attention"/>}
        </span>
        <span className="roster__id">
          <span className="roster__name-line">
            <span className="roster__name">{agent.name}</span>
            {/* design-refs/mood-nav.jsx's WHERE badge: is he here, at a glance. */}
            <span className="roster__badge" style={{ color: badge.c }}>{badge.t}</span>
          </span>
          <span className="roster__place"><span className="roster__where">{whereabouts.where}</span>
          {whereabouts.detail && <span className="roster__routine">{whereabouts.detail}</span>}</span>
        </span>
        <span className="roster__numbers">
          <span className={`roster__result${result.value > 0 ? ' is-up' : result.value < 0 ? ' is-down' : ''}`} title={result.label}>{signedMoney(result.value)}</span>
          <span className="roster__pocket"><small>POCKET</small><span>{pocket === null ? '—' : money(pocket)}</span></span>
        </span>
        <svg className="roster__chevron" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M9 6l6 6-6 6"/></svg>
      </button>
    </li>
  );
}

/**
 * HOME-2 job 1 — YOU IS THIS SHEET, AND THE MONEY IS BEHIND IT.
 *
 * Wave 53 took HOME · CASINO · YOU off the bottom of the screen. YOU is the
 * avatar top-right, and the ref (design-refs/mood-nav.jsx, `RosterSheet`) is
 * explicit about the shape: "the money is a LINE, not a section: the wallet
 * screen lives behind it". So the roster ends in one line — what you have, and
 * the way to the ledger — and neither of them is a second wallet UI. Both are
 * doors onto the surfaces YOU-2 already built: the money sheet is where money
 * MOVES, the record is where it turns out to have moved.
 */
export function RosterSheet({ onOpenThread, onClose, onCreateAgent, onOpenMoney, onOpenLedger }) {
  const [agents, setAgents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  // WUI-1's law, unchanged: null until asked, and null forever on a deployment
  // with no wallet. The line then states the stable's own chips rather than
  // quoting a balance nobody keeps.
  const [wallet, setWallet] = useState(null);
  const drag = useSheetDrag(onClose);

  useEffect(() => {
    let alive = true;
    fetchWallet().then((w) => { if (alive) setWallet(w); }).catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    async function load() {
      try {
        const res = await fetch(`/api/agents?userId=${encodeURIComponent(getUserId())}`, { headers: { 'x-telegram-init-data': getTelegramInitData() } });
        if (!res.ok) throw new Error('refused');
        const body = await res.json();
        if (!Array.isArray(body?.agents)) throw new Error('missing roster');
        if (alive) { setAgents(body.agents); setError(''); }
      } catch { if (alive) setError('Could not read your agents. Please try again.'); }
      finally { if (alive) setLoading(false); }
    }
    load();
    const timer = setInterval(load, 10_000);
    return () => { alive = false; clearInterval(timer); };
  }, [attempt]);

  return (
    <div className="roster" role="dialog" aria-label="Your agents" data-testid="roster-sheet">
      <button type="button" className="roster__scrim" onClick={onClose} aria-label="Close" />
      <div
        className={`roster__panel${drag.dragging ? ' is-dragging' : ''}`}
        ref={drag.ref}
        style={drag.style}
        {...drag.handlers}
      >
        <span className="roster__grab" aria-hidden />
        <div className="roster__head">
          <span className="roster__title">THE ROSTER</span>
          <span className="roster__count">
            {/* Same law as job 2: no count until the roster has answered. */}
            {loading || error ? '' : `${agents.length} agent${agents.length === 1 ? '' : 's'} · ${agents.filter(rosterLive).length} live`}
          </span>
          <button type="button" className="roster__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {loading ? (
          <p className="roster__empty">Reading the room…</p>
        ) : error ? (
          <div className="roster__error" role="alert">{error}<button type="button" onClick={() => setAttempt(a => a + 1)}>Try again</button></div>
        ) : agents.length === 0 ? (
          <div className="roster__ftu">
            <p className="roster__empty">Nobody works for you yet.</p>
            {onCreateAgent && (
              <button type="button" className="roster__make" onClick={onCreateAgent}>
                Make an agent
              </button>
            )}
          </div>
        ) : (
          <ul className="roster__list no-scrollbar">
            {agents.map((agent, i) => (
              <RosterRow key={agent.id} agent={agent} index={i} onOpen={onOpenThread} />
            ))}
          </ul>
        )}

        {/* The money, as one line. See the note on the component. */}
        {onOpenMoney || onOpenLedger ? (
          <div className="roster__money">
            <button
              type="button"
              className="roster__wallet"
              onClick={onOpenMoney}
              disabled={!onOpenMoney}
              aria-label="Your wallet"
              data-testid="roster-wallet"
            >
              <span className="roster__wallet-label">YOUR WALLET</span>
              <span className="roster__wallet-amount">
                {wallet ? money(wallet.balance) : '—'}
              </span>
            </button>
            {onOpenLedger ? (
              <button
                type="button"
                className="roster__ledger"
                onClick={onOpenLedger}
                data-testid="roster-ledger"
              >
                LEDGER
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
