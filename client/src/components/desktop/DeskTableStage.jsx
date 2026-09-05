// The table as the main stage, ported from design-refs/mood-desktop.jsx
// DeskTableStage (screens D3WatchScreenM / D3WatchBetweenScreenM), brought up
// to watch v3 from D3Watch3ScreenM in design-refs/mood-watch3.jsx.
//
// DP-1 adds the two things v3 gave the phone and the desk did not have: the
// rope directly under the board, and the pacing ladder. Both come from the
// mobile modules rather than a desktop copy — lib/pace.js owns the ladder and
// system/TugBar.jsx owns the rope, so the two surfaces cannot drift.
//
// WATCH-6 brings the desk stage to board 31's D9V5ScreenM: the same seating as
// the phone, at desk scale. He is at the bottom of the felt facing the room —
// bubble over his head, his cards face up IN FRONT of him, the rope and his
// strip directly under him — rather than a row of chrome with an avatar in it.
// The rope and the price move into that column with him, so the centre of the
// felt is the pot and the board and nothing else.
//
// Three phases, the same law WatchScreen applies on mobile (WCM-1): a hand is
// live, or settled-but-still-on-screen, or genuinely between. Between hands
// the stage goes calm — face-down board, em-dash pot, no timer, no equity.
//
// Fish-tank law: the hero is YOUR agent, so its hole cards are face up. The
// server only ships holeCards to the authenticated owner, so a face-up card
// here is always one the viewer is entitled to.
import { PlayingCard, CardBack, parseCard } from '../system/PlayingCard.jsx';
import { SeatChip } from '../system/SeatChip.jsx';
import { TugBar } from '../system/TugBar.jsx';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { heroPose, betBand } from '../system/WatchHero.jsx';
import { Streets } from '../../lib/protocol.js';
import { heroEquityOf, paceMeta, paceOf } from '../../lib/pace.js';

const LIVE_STREETS = [Streets.PREFLOP, Streets.FLOP, Streets.TURN, Streets.RIVER, Streets.SHOWDOWN];

// The same ring WatchScreen's SEAT_SLOTS lays out, so a table looks like the
// same table on both surfaces: top corners, then top centre, then the rails.
const DESK_SLOTS = {
  1: ['tl'],
  2: ['tl', 'tr'],
  3: ['tl', 'tc', 'tr'],
  4: ['ml', 'tl', 'tc', 'tr'],
  5: ['ml', 'tl', 'tc', 'tr', 'mr'],
};

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

  // His face is the server's mood for this seat, in the shape SEAT-1a settled.
  const heroMoodRaw = hero?.mood;
  const heroMood = typeof heroMoodRaw === 'string'
    ? (heroMoodRaw || 'neutral')
    : (heroMoodRaw?.state ?? 'neutral');
  const heroHeat = Number.isFinite(heroMoodRaw?.heat) ? heroMoodRaw.heat : 45;
  const heroAccent = hero?.accentColor ?? '#00D4AA';

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

      {/* The ring is the phone's, at desk scale: top corners first, then top
          centre, then the rails. The desk drew two seats and dropped the rest
          on the floor — a six-handed table showed four players nowhere. */}
      {opponents.slice(0, 5).map((o, i) => {
        const slot = DESK_SLOTS[Math.max(1, Math.min(5, opponents.length))][i];
        return (
          <div key={o.index} className={`dtb__seat dtb__seat--${slot}`}>
            <SeatChip
              name={o.seat.displayName || `Seat ${o.index + 1}`}
              stack={(o.seat.stack ?? 0).toLocaleString()}
              pos={posLabel(o.index, game)}
              acting={live && game?.toAct === o.index}
              folded={!!o.seat.folded}
              align={slot === 'tr' || slot === 'mr' ? 'right' : 'left'}
            />
          </div>
        );
      })}

      <div className="dtb__center">
        <div className="dtb__pot">
          <span className="dsk-label" style={{ fontSize: 9 }}>Pot</span>
          {between
            ? <span className="dtb__pot-dash">—</span>
            : <span className="dtb__pot-amt">${(game?.pot ?? 0).toLocaleString()}</span>}
        </div>

        <Board cards={board} between={between} />

        {between && <span className="dtb__shuffling">SHUFFLING UP…</span>}
      </div>

      {/* Him, at the bottom, twice a seat and facing the room. A flowed column:
          bubble, him, rope, strip — the same order as the phone. */}
      <div className="dtb__hero">
        {feltLine && (
          <div className="dtb__hero-bubble">
            <div className="dtb__hero-bubble-box">{feltLine}</div>
            <div className="dtb__hero-bubble-tail" aria-hidden />
          </div>
        )}

        <div className="dtb__hero-body">
          <span className="dtb__hero-aura" aria-hidden
            style={{ background: `radial-gradient(circle, ${heroAccent}1F, transparent 68%)` }} />
          <MoodGhost mood={heroMood} accent={heroAccent} size={132} heat={heroHeat}
            hands={heroPose({ between, action: heroDecision?.action ?? null, pace, heat: heroHeat })}
            bet={betBand(heroDecision?.action?.amount ?? null, game?.pot ?? 0)} ring={false} />
          {/* Fish-tank law: your own agent plays face up, in front of him. */}
          <span className="dtb__hero-cards">
            {[0, 1].map((i) => {
              const parsed = between ? null : parseCard(hero?.holeCards?.[i]);
              return (
                <span key={i} className="dtb__hero-card"
                  style={{ transform: `rotate(${i ? 6 : -6}deg)` }}>
                  {parsed
                    ? <PlayingCard rank={parsed.rank} suit={parsed.suit} w={52} h={72} />
                    : <CardBack w={52} h={72} branded />}
                </span>
              );
            })}
          </span>
        </div>

        <div className="dtb__tug">
          <TugBar equity={heroEquity} villain={villainName} big={pMeta.heat} dead={!hasEquity} />
        </div>

        <div className="dtb__strip">
          <div>
            <span className="dsk-label" style={{ fontSize: 8.5 }}>Stack</span>
            <div className="dtb__hero-stack">${(hero?.stack ?? 0).toLocaleString()}</div>
          </div>
          <div className="dtb__strip-rule" aria-hidden />
          <div>
            <span className="dsk-label" style={{ fontSize: 8.5 }}>{toCall > 0 ? 'To call' : 'Street'}</span>
            <div className={`dtb__hero-num${toCall > 0 ? ' is-gold' : ' is-dim'}`}>
              {toCall > 0 ? `$${toCall.toLocaleString()}` : ((game?.street ?? '').toUpperCase() || '—')}
            </div>
          </div>
          <div className="dtb__strip-rule" aria-hidden />
          <div>
            <span className="dsk-label dsk-label--teal" style={{ fontSize: 8.5 }}>Equity</span>
            <div className="dtb__equity-val">{eq === null ? '—' : `${eq.toFixed(1)}%`}</div>
          </div>
          <div style={{ flex: 1 }} />
          {between
            ? <span className="dtb__waiting">waiting for the deal</span>
            : (action && <span className="dtb__equity-action">{action}</span>)}
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
