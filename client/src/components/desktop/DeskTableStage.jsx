// The table as the main stage, ported from design-refs/mood-desktop.jsx
// DeskTableStage (screens D3WatchScreenM / D3WatchBetweenScreenM), brought up
// to watch v3 from D3Watch3ScreenM in design-refs/mood-watch3.jsx.
//
// DP-1 adds the two things v3 gave the phone and the desk did not have: the
// rope directly under the board, and the pacing ladder. Both come from the
// mobile modules rather than a desktop copy — lib/pace.js owns the ladder and
// system/TugBar.jsx owns the rope, so the two surfaces cannot drift.
//
// SEAM for feature/watch-4: D6W4WatchScreenM replaces the two SeatChips with
// DeskSeat (a seated body with a speech bubble) and the centre with DeskFelt4.
// Those land when that branch merges; the pace attribute, the rope slot and
// the voice line below are where they plug in.
//
// Three phases, the same law WatchScreen applies on mobile (WCM-1): a hand is
// live, or settled-but-still-on-screen, or genuinely between. Between hands
// the stage goes calm — face-down board, em-dash pot, no timer, no equity.
//
// Fish-tank law: the hero is YOUR agent, so its hole cards are face up. The
// server only ships holeCards to the authenticated owner, so a face-up card
// here is always one the viewer is entitled to.
import { PlayingCard, CardBack, parseCard } from '../system/PlayingCard.jsx';
import { SeatChip, AgentAvatar } from '../system/SeatChip.jsx';
import { TugBar } from '../system/TugBar.jsx';
import { Streets } from '../../lib/protocol.js';
import { heroEquityOf, paceMeta, paceOf } from '../../lib/pace.js';

const LIVE_STREETS = [Streets.PREFLOP, Streets.FLOP, Streets.TURN, Streets.RIVER, Streets.SHOWDOWN];

export function handActive(game) {
  return !!game && LIVE_STREETS.includes(game.street);
}

// A finished hand the next deal has not cleared yet — still on screen.
export function handSettled(game) {
  return !!game && game.street === Streets.COMPLETE && !!game.result;
}

export function phaseOf(game) {
  if (handActive(game)) return 'live';
  if (handSettled(game)) return 'settled';
  return 'between';
}

// The wire carries equity as a 0..1 fraction (see WatchScreen.equityPct).
export function equityPct(equity) {
  const n = typeof equity === 'number' ? equity : parseFloat(equity);
  if (!Number.isFinite(n)) return null;
  return n <= 1 ? n * 100 : n;
}

function formatAction(action) {
  if (!action?.type) return null;
  const t = action.type;
  if (t === 'bet') return `BET $${action.amount}`;
  if (t === 'raise') return `RAISE $${action.amount}`;
  return String(t).toUpperCase();
}

function posLabel(seat, game) {
  if (!game) return '';
  if (game.bigBlindSeat === seat) return 'BB';
  if (game.smallBlindSeat === seat) return 'SB';
  if (game.dealerSeat === seat) return 'BTN';
  return '';
}

function Board({ cards, between }) {
  return (
    <div className="dtb__board">
      {cards.map((card, i) => {
        const parsed = between ? null : parseCard(card);
        return parsed
          ? <PlayingCard key={i} rank={parsed.rank} suit={parsed.suit} w={58} h={80} />
          : <CardBack key={i} w={58} h={80} branded />;
      })}
    </div>
  );
}

export function DeskTableStage({ game, agentName, lastDecision, onBack, onSitOut, sitOutPending }) {
  const phase = phaseOf(game);
  const between = phase === 'between';
  const live = phase === 'live';

  // The server owns the ladder; the client is told which state it is in and
  // never infers one. Anything unrecognised reads as calm.
  const pace = paceOf(game);
  const pMeta = paceMeta(game);

  const seats = game?.seats || [];
  const named = seats.findIndex((s) => s?.displayName === agentName);
  const heroSeat = named >= 0 ? named : 0;
  const hero = seats[heroSeat];
  const opponents = seats
    .map((s, i) => ({ seat: s, index: i }))
    .filter((s) => s.index !== heroSeat && s.seat);

  const board = [...(game?.community || [])];
  while (board.length < 5) board.push(null);

  const heroDecision = lastDecision?.seat === heroSeat ? lastDecision : null;
  const eq = live ? equityPct(heroDecision?.equity) : null;

  // The rope reads the snapshot first — that is the point of finding 2 — and
  // falls back to whatever the last decision taught us. Before the deal there
  // is nothing to know, so it sits dead centre rather than empty.
  const heroEquity = between ? null : heroEquityOf(game, heroDecision?.equity ?? null, heroSeat);
  const hasEquity = Number.isFinite(heroEquity);
  const villainName = opponents.find((o) => !o.seat.folded)?.seat?.displayName ?? null;

  // One sentence of thread voice. Long voice lives in the thread; the felt
  // gets one line, and it is the loudest thing on the stage at ALL-IN.
  const feltLine = !between && heroDecision?.reasoning ? heroDecision.reasoning : null;
  const action = live ? formatAction(heroDecision?.action) : null;
  const toCall = live && game?.toAct === heroSeat && game?.currentBet
    ? Math.max(0, game.currentBet - (hero?.committed ?? 0))
    : 0;

  return (
    <div className="dtb" data-pace={pace}>
      <div className="dtb__arc" aria-hidden />
      <div className="dtb__glow" aria-hidden />

      <button type="button" className="dtb__back" onClick={onBack}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M15 18l-6-6 6-6" />
        </svg>
        BACK TO THE FLOOR
      </button>

      {opponents.slice(0, 2).map((o, i) => (
        <div key={o.index} className={`dtb__seat dtb__seat--${i === 0 ? 'left' : 'right'}`}>
          <SeatChip
            name={o.seat.displayName || `Seat ${o.index + 1}`}
            stack={(o.seat.stack ?? 0).toLocaleString()}
            pos={posLabel(o.index, game)}
            acting={live && game?.toAct === o.index}
            folded={!!o.seat.folded}
            align={i === 0 ? 'left' : 'right'}
          />
        </div>
      ))}

      <div className="dtb__center">
        <div className="dtb__pot">
          <span className="dsk-label" style={{ fontSize: 9 }}>Pot</span>
          {between
            ? <span className="dtb__pot-dash">—</span>
            : <span className="dtb__pot-amt">${(game?.pot ?? 0).toLocaleString()}</span>}
        </div>

        <Board cards={board} between={between} />

        {/* The rope, directly under the board — the ref puts it at 26% inset
            and the stylesheet holds that width. */}
        <div className="dtb__tug">
          <TugBar equity={heroEquity} villain={villainName} big={pMeta.heat} dead={!hasEquity} />
        </div>

        {feltLine && <p className="dtb__line">{feltLine}</p>}

        {between ? (
          <span className="dtb__shuffling">SHUFFLING UP…</span>
        ) : toCall > 0 ? (
          <div className="dtb__tocall">
            <span className="dtb__chip" aria-hidden />
            <span className="dtb__tocall-amt">${toCall.toLocaleString()}</span>
            <span className="dtb__tocall-label">TO CALL</span>
          </div>
        ) : null}
      </div>

      <div className="dtb__hero">
        <div className="dtb__hero-cards">
          {[0, 1].map((i) => {
            // Fish-tank law: your own agent plays face up.
            const parsed = between ? null : parseCard(hero?.holeCards?.[i]);
            return parsed
              ? <PlayingCard key={i} rank={parsed.rank} suit={parsed.suit} w={62} h={85} />
              : <CardBack key={i} w={62} h={85} branded />;
          })}
        </div>

        <div className="dtb__hero-row">
          <AgentAvatar size={40} />
          <div>
            <div className="dtb__hero-name">{agentName || 'Agent'}</div>
            <div className="dtb__hero-meta">
              <span className="dtb__hero-stack">${(hero?.stack ?? 0).toLocaleString()}</span>
              <span className="dtb__hero-pos">{posLabel(heroSeat, game)}</span>
            </div>
          </div>
          <div className="dtb__rule" aria-hidden />
          {between ? (
            <span className="dtb__waiting">waiting for the deal</span>
          ) : (
            <div className="dtb__equity">
              <span className="dsk-label dsk-label--teal" style={{ fontSize: 9 }}>Equity</span>
              <span className="dtb__equity-val">{eq === null ? '—' : `${eq.toFixed(1)}%`}</span>
              {action && <span className="dtb__equity-action">{action}</span>}
            </div>
          )}
        </div>
      </div>

      {between && (
        <div className="dtb__exit">
          <div>
            <div className="dtb__exit-title">Between hands</div>
            <div className="dtb__exit-sub">NEXT DEAL SHORTLY</div>
          </div>
          <div className="dtb__exit-spacer" />
          <button type="button" className="dtb__exit-btn" onClick={onSitOut} disabled={sitOutPending}>
            {sitOutPending ? 'Sitting out after this hand' : 'Sit out after this hand'}
          </button>
        </div>
      )}
    </div>
  );
}
