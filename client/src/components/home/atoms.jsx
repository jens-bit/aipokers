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
import { FATIGUE, fatigueOf } from '../../lib/attributes.js';

// ── The bubble ──────────────────────────────────────────────────────────────

export function HomeBubble({ text, x, gold = false, testId }) {
  if (!text) return null;
  const side = bubbleSide(x);
  return (
    <div className="home-bubble-slot">
      <div
        className={`home-bubble home-bubble--${side}${gold ? ' home-bubble--gold' : ''}`}
        data-side={side}
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
// STAMINA runs down (three blocks fresh, one worn) and HEAT runs up. They are
// deliberately different shapes — a bar and a rule — so they are never read as
// two of the same thing.

const HEAT_TONE = (heat) => (heat >= 70 ? 'hot' : heat >= 55 ? 'warm' : 'cool');

export function NamePill({ name, accent, fatigue = 'fresh', heat = 45, news = false }) {
  const stage = FATIGUE[fatigue] ?? FATIGUE.fresh;
  const h = Math.max(0, Math.min(100, Number(heat) || 0));
  return (
    <span className={`home-pill${news ? ' home-pill--news' : ''}`} data-fatigue={fatigue} data-heat={HEAT_TONE(h)}>
      <span className="home-pill__name" style={{ color: accent }}>{String(name || '').split(' ')[0]}</span>
      <span className="home-pill__lines" aria-hidden>
        <span className="home-pill__stamina" data-blocks={stage.blocks}>
          {[0, 1, 2].map((i) => <i key={i} className={i < stage.blocks ? 'is-on' : ''} />)}
        </span>
        <span className="home-pill__heat"><i style={{ width: `${h}%` }} /></span>
      </span>
      <span className="sr-only">{`${stage.word}, heat ${Math.round(h)}`}</span>
    </span>
  );
}

// ── One occupant ────────────────────────────────────────────────────────────

export function HomeOne({
  agent,
  at,
  accent = '#00D4AA',
  size = 46,
  says,
  news,
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
      {news ? <HomeBubble text={news} x={at.x} gold testId={`home-news-${agent?.id}`} /> : null}
      {says ? <HomeBubble text={says} x={at.x} testId={`home-says-${agent?.id}`} /> : null}

      <NamePill name={agent?.name} accent={accent} fatigue={fatigue} heat={heat} news={!!news} />

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
