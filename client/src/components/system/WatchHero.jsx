// WATCH v6 — the hero, seated at the bottom of the felt.
// Port of design-refs/mood-watch5.jsx `V5Hero`.
//
// v4b put him in a hero row: a strip of chrome at the foot of the felt with his
// cards in it, which made the one character you own the least present thing on
// his own table. v5 seats him. He faces the viewer at the bottom edge at twice
// an opponent's size, his cards face up in front of him, his bubble above his
// head, and the rope and strip directly under him — so the whole vertical axis
// of the screen is HIM.
//
// A FLOWED COLUMN, anchored to the felt's bottom edge: bubble, him, rope, strip,
// cost. Every gap belongs to the column, so a two-line bubble or a thicker rope
// moves its neighbours instead of landing on them — the lesson v4b paid eleven
// defects for. Nothing in here is absolutely positioned against the felt.
import { MoodGhost } from './MoodGhost.jsx';
import { PlayingCard, CardBack } from './PlayingCard.jsx';
import { TugBar } from './TugBar.jsx';
import { Glass } from './Glass.jsx';
import { Bubble } from './Bubble.jsx';

// TWICE AN OPPONENT SEAT, and the ref's own number for it. A seat on the ring
// is a 60px stack — a 34px ghost, a 2px gap and a 17px name chip — so 96 is the
// two-to-one the brief asks for, measured against the seat rather than against
// the bare ghost. Both live here so nothing has to re-derive the ratio.
export const OPP_GHOST = 34;
export const OPP_SEAT = 60;
export const HERO_GHOST = 96;

// EIGHT POSES AND NO MORE (mood-atoms `HAND_POSES`). Which one he is wearing is
// a fact about the hand, not a design choice, so it is derived in one place.
export function heroPose({ between, action, pace, heat, mucking }) {
  if (mucking) return 'toss';
  if (between) return 'rest';
  if (pace === 'allin' || (Number.isFinite(heat) && heat >= 70)) return 'clench';
  const t = action && action.type;
  if (t === 'bet' || t === 'raise') return 'push';
  if (t === 'check') return 'drum';
  if (t === 'fold') return 'toss';
  return 'hold';
}

// The stack height IS the bet band — three bands, nothing between.
export function betBand(amount, pot) {
  if (!Number.isFinite(amount) || amount <= 0) return 'mid';
  if (!Number.isFinite(pot) || pot <= 0) return 'mid';
  const r = amount / pot;
  return r < 0.4 ? 'small' : r > 0.9 ? 'big' : 'mid';
}

export function WatchHero({
  says, mood = 'neutral', accent = '#00D4AA', heat = 45, pose = 'hold', bet, event, won,
  hole, landed = 2, mucking = false, between = false,
  equity, villain, bigRope, deadRope,
  stack, pos, street, toCall = 0, action, tag, warm, note,
  cost, onTapFace,
  // WATCH-7: the hand-end receipt. It rides ON the strip — over his own money,
  // which is what it is about — and it is part of the column, so it can never
  // land on the board or on him.
  toast,
}) {
  const cards = hole && hole.length ? hole : [null, null];
  return (
    <div className="watch-hero">
      {/* His bubble, above his head. The band is part of the column, so it
          pushes him down rather than landing on him. */}
      {says && (
        <div className="watch-hero__says">
          <Bubble mine flow text={says} />
        </div>
      )}

      {/* Him. Twice an opponent, facing the viewer, cards face up in FRONT —
          over the lower third of his body, never behind it. */}
      <button type="button" className="watch-hero__body" onClick={onTapFace}
        aria-label="Open the thread">
        <span className="watch-hero__aura" aria-hidden
          style={{ background: `radial-gradient(circle, ${accent}${heat > 66 ? '2E' : '1A'}, transparent 68%)` }} />
        <MoodGhost mood={mood} accent={accent} size={HERO_GHOST} heat={heat}
          hands={pose} bet={bet} event={event} won={won} ring={false} />
        <span className="watch-hero__cards watch-felt__hero-cards" aria-hidden={false}>
          {cards.map((c, i) => {
            const down = i < landed;
            return (
              <span key={i}
                className={`watch-felt__hero-card${down ? ' is-down' : ''}${mucking ? ' is-mucking' : ''}`}
                data-landed={down ? 'yes' : 'no'}
                data-mucking={mucking ? 'yes' : 'no'}
                style={{
                  transform: `rotate(${i ? 6 : -6}deg) translateX(${down ? 0 : 34}px)`,
                  '--muck-base': `rotate(${i ? 6 : -6}deg)`,
                  '--muck-turn': `${i ? 22 : -18}deg`,
                }}
              >
                {(c && !between)
                  ? <PlayingCard rank={c[0]} suit={c[1]} w={40} h={55} />
                  : <CardBack w={40} h={55} branded />}
              </span>
            );
          })}
        </span>
      </button>

      {/* The rope, directly under him. */}
      <div className="watch-hero__tug">
        <TugBar equity={equity} villain={villain} big={bigRope} dead={deadRope} />
      </div>

      {/* The strip: stack, street or to-call, his action — and, for a second and
          a half after a hand, what the hand did to him. The toast hangs off the
          strip itself rather than off the felt, so it can never land on the
          board and the column stays the flow WATCH-6 settled. */}
      <Glass className={`watch-felt__hero watch-hero__strip${action ? ' is-active' : ''}${warm ? ' is-warm' : ''}`}>
        {toast}
        <div>
          <span className="watch-felt__hero-lbl">Stack</span>
          <div className="watch-hero__stack-row">
            <span className="watch-felt__hero-num">{stack}</span>
            {pos && <span className="watch-felt__hero-pos">{pos}</span>}
          </div>
        </div>
        <div className="watch-felt__hero-divider" />
        <div>
          <span className="watch-felt__hero-lbl">{toCall > 0 ? 'To call' : 'Street'}</span>
          <div>
            <span className={`watch-felt__hero-num ${toCall > 0 ? 'is-gold' : 'is-dim'}`}>
              {toCall > 0 ? `$${toCall.toLocaleString()}` : (street || '—')}
            </span>
          </div>
        </div>
        <div style={{ flex: 1 }} />
        {warm && !action && <span className="watch-felt__premium">PREMIUM</span>}
        {action
          ? <span className="watch-felt__action-chip">{action}</span>
          : (!warm && note && <span className="watch-felt__waiting">{note}</span>)}
        {tag && <span className="watch-felt__hero-tag">{tag}</span>}
      </Glass>

      {/* W5-4/WATCH-6 · "why the hand went wrong", PINNED under his strip until
          the next flop. One line, in the gold the attribute system already owns,
          because a card here would push him off his own felt. */}
      {cost && (
        <div className="watch-hero__cost" role="note">
          <span className="watch-hero__cost-line">{cost.line}</span>
          {cost.key && <span className="watch-hero__cost-key">{cost.key}</span>}
        </div>
      )}
    </div>
  );
}
