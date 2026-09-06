// client/src/components/home/atoms.jsx — HOME-1
//
// The bodies in the room. Ported from design-refs/mood-home.jsx (HomeBubble,
// RoutineProp, HomeOne), with the ghost, the hands and the face taken from the
// system atoms rather than redrawn — one body per agent, one drawing of it.
//
// THREE CORRECTIONS FROM JENS OVERRIDE THE REF, and they are all on the pill:
//
//   1. THE PILL IS ABOVE THE HEAD, not under the feet. Under the feet it reads
//      as a caption on a photograph; above the head it reads as the thing
//      hovering over a character in a game, which is what it is.
//   2. THE PILL CARRIES THE TWO LINES — stamina and heat — and nothing else.
//      They are the two numbers that decide what he can do next, so they belong
//      where you are already looking.
//   3. NO STATUS LABEL UNDER ANYONE. The ref printed "PACING" under every body.
//      The whole point of a routine is that you can SEE it; labelling the
//      animation is admitting the animation did not work.
//
// The bubble is the ref's own, unchanged in behaviour: it picks its side from
// where the body stands, so it flips near an edge rather than clipping.

import { MoodGhost } from '../system/MoodGhost.jsx';
import { GhostHandLayer, SEAT_GRIP } from '../system/GhostHands.jsx';
import { CardBack } from '../system/PlayingCard.jsx';
import { bubbleSide } from './flat.js';
import { presentRoutine } from './routines.js';
import { fatigueOf } from '../../lib/attributes.js';
import { heatColor, heatStep, staminaOf, staminaPct } from '../system/FeltBodyBars.jsx';
import { shortName } from '../../lib/names.js';

// ── The bubble ──────────────────────────────────────────────────────────────

export function HomeBubble({ text, x, gold = false, side = null, testId }) {
  if (!text) return null;
  // FIX-6 job 3: the room places the bubble now (roomBubbles.js), because the
  // side that clears the WALL is not always the side that clears the man
  // standing next to him. Left to itself it still picks its own side off the
  // edge rule, which is what every caller outside the room does.
  const open = side ?? bubbleSide(x);
  return (
    <div className="home-bubble-slot">
      <div
        className={`home-bubble home-bubble--${open}${gold ? ' home-bubble--gold' : ''}`}
        data-side={open}
        data-testid={testId}
      >
        {text}
      </div>
    </div>
  );
}

// ── The props a routine carries ─────────────────────────────────────────────

export function RoutineProp({ kind, size }) {
  if (kind === 'paper') {
    return (
      <span className="home-prop home-prop--paper" style={{ top: size * 0.52, width: size * 0.56, height: size * 0.4 }} aria-hidden>
        {[0, 1, 2].map((i) => <span key={i} style={{ top: 4 + i * 4 }} />)}
      </span>
    );
  }
  if (kind === 'cards') {
    return (
      <span className="home-prop home-prop--cards" style={{ left: size * 0.16, top: size * 0.56 }} aria-hidden>
        {[-14, -4, 6].map((r) => (
          <span key={r} style={{ width: size * 0.17, height: size * 0.24, marginLeft: -size * 0.06, transform: `rotate(${r}deg)` }} />
        ))}
      </span>
    );
  }
  if (kind === 'chips') {
    return (
      <span className="home-prop home-prop--chips" style={{ left: size * 0.62, top: size * 0.56 }} aria-hidden>
        {[0, 1, 2, 3].map((i) => <span key={i} className={i % 2 ? 'is-red' : 'is-pale'} style={{ bottom: i * 2.6 }} />)}
      </span>
    );
  }
  if (kind === 'zzz') {
    return (
      <span className="home-prop home-prop--zzz" aria-hidden>
        {[9, 7, 5].map((s, i) => <span key={s} style={{ fontSize: s, opacity: 0.75 - i * 0.18, animationDelay: `${i * 0.5}s` }}>z</span>)}
      </span>
    );
  }
  return null;
}

// ── The pill ────────────────────────────────────────────────────────────────
//
// His name, and the two lines that say what he has left in him. Both are drawn
// as a rule rather than as a number: this is a room, and a room does not print
// "heat 68" over somebody's head.
//
// ── HOME-2 job 2 · BOTH BARS ARE ANCHORED AT THE LEFT WALL ─────────────────
//
// What this replaces: stamina was THREE BLOCKS and heat was a rule, and the
// justification was that two different shapes could never be read as two of the
// same thing. Wave 56 gets the same separation out of two bars that run in
// OPPOSITE DIRECTIONS, which is a stronger reading and costs a shape:
//
//   STAMINA  full is the whole bar; as it drains the RIGHT END RECEDES toward
//            the left, green → amber → red.
//   HEAT     empty is nothing; the fill GROWS rightward, ember → red.
//
// So a worn, tilted agent is a short red stub over a long red bar — and the
// blocks could not have said that, because three blocks and one block are the
// same picture at two lengths and carry no colour of their own.
//
// Both ramps come from system/FeltBodyBars.jsx, which is the one definition of
// these colours in the product: the pill here, the strip over the felt, the
// seat pill and the profile card cannot disagree about a man.

export function NamePill({ name, nickname = null, accent, fatigue = 'fresh', heat = 45, news = false }) {
  const h = Math.max(0, Math.min(100, Number(heat) || 0));
  // Fatigue is three stages on the wire and one length-and-colour on screen.
  const stam = Math.round((staminaOf(fatigue) ?? 1) * 100);
  return (
    <span className={`home-pill${news ? ' home-pill--news' : ''}`} data-fatigue={fatigue} data-heat={heatStep(h)}>
      <span className="home-pill__name" style={{ color: accent }}>{shortName(name, nickname)}</span>
      <span className="home-pill__bars" aria-hidden>
        <span className="home-pill__bar" data-bar="stamina">
          <i style={{ width: `${stam}%`, background: staminaPct(stam) }} />
        </span>
        <span className="home-pill__bar" data-bar="heat">
          <i style={{ width: `${h}%`, background: heatColor(h) }} />
        </span>
      </span>
      <span className="sr-only">{`stamina ${stam}, heat ${Math.round(h)}`}</span>
    </span>
  );
}

// ── One occupant ────────────────────────────────────────────────────────────

export function HomeOne({
  agent,
  at,
  accent = '#00D4AA',
  size = 46,
  // FIX-6 job 3 — ONE BUBBLE, or none. It used to be two props (`says` and
  // `news`) and both could be set at once, which is how a man ended up wearing
  // two boxes. The room decides which of the things he has to say is the one
  // worth a box, whether the room has a place for it, and which side it opens;
  // this draws what it is handed. { text, gold, side } or null.
  bubble = null,
  // Whether he has news AT ALL, which is not the same question: a want still
  // waiting its turn in the queue must still read as a want on the pill, or
  // queueing his line would be the same as swallowing it.
  news = false,
  dealt = false,
  walking = false,
  onClick,
}) {
  const r = presentRoutine(agent);
  const mood = agent?.mood?.state ?? 'neutral';
  const heat = agent?.mood?.heat ?? 45;
  const fatigue = fatigueOf(agent);
  const pose = dealt ? 'hold' : r.pose;

  return (
    <button
      type="button"
      className={`home-one${walking ? ' is-walking' : ''}${r.anim ? ` home-one--${r.key}` : ''}`}
      data-agent={agent?.id}
      data-routine={r.key}
      data-spot={at?.spot}
      data-walking={walking ? 'true' : 'false'}
      style={{ left: at.x, top: at.y, zIndex: Math.round(at.y) }}
      onClick={onClick}
      aria-label={`${agent?.name ?? 'Agent'} — ${r.label}`}
    >
      {bubble ? (
        <HomeBubble
          text={bubble.text}
          x={at.x}
          side={bubble.side}
          gold={bubble.gold}
          testId={`home-${bubble.gold ? 'news' : 'says'}-${agent?.id}`}
        />
      ) : null}

      <NamePill
        name={agent?.name}
        // Not on the wire yet; read the moment it is (lib/names.js).
        nickname={agent?.nickname}
        accent={accent}
        fatigue={fatigue}
        heat={heat}
        news={!!news}
      />

      <span className="home-one__body" style={{ width: size, height: size }}>
        {r.back ? (
          // Facing the wall: the silhouette with no face, which is the whole
          // point of the routine.
          <svg width={size} height={size} viewBox="0 0 80 80" className="home-one__back" aria-hidden>
            <path
              d="M40 6 C57.6 6 70 18.4 70 36 L70 70 C70 78.4 62.4 76.8 57.6 81.6 C53.6 85.6 46.4 85.6 40 81.6 C33.6 85.6 26.4 85.6 22.4 81.6 C17.6 76.8 10 78.4 10 70 L10 36 C10 18.4 22.4 6 40 6 Z"
              fill="#161F1E" stroke={`${accent}33`} strokeWidth="1.5"
            />
          </svg>
        ) : (
          <MoodGhost mood={mood} heat={heat} accent={accent} size={size} event={r.face} ring={false} />
        )}

        {dealt && !r.back ? (
          <span className="home-one__cards" aria-hidden>
            {[0, 1].map((i) => <CardBack key={i} w={size * 0.34} h={size * 0.46} />)}
          </span>
        ) : null}

        {!r.back ? <GhostHandLayer className="home-one__hands" pose={pose} size={size} grip={SEAT_GRIP} /> : null}
        {r.prop ? <RoutineProp kind={r.prop} size={size} /> : null}
      </span>
    </button>
  );
}
