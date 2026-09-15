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
import { PHONE_ROOM, bubbleSide } from './flat.js';
import { roomBubbleOffset } from './roomBubbles.js';
import { presentRoutine } from './routines.js';
import { fatigueOf } from '../../lib/attributes.js';
import { BodyDots } from '../system/FeltBodyBars.jsx';
import { staminaLevel, heatLevel } from '../../../../src/shared/levels.js';
import { shortName } from '../../lib/names.js';

// Stable birth identity, independent of the current name, mood or roster order.
// A negative delay starts an idle already in progress instead of synchronizing
// every character when the room mounts. Walking/carrying use their own clocks.
function idlePhase(id) {
  if (id === null || id === undefined) return 0;
  let hash = 2166136261;
  for (const char of String(id)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return -(1 + hash % 4000);
}

// ── The bubble ──────────────────────────────────────────────────────────────

export function HomeBubble({ text, x, gold = false, side = null, maxWidth, testId }) {
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
        style={maxWidth ? { width: maxWidth } : undefined}
        data-side={open}
        data-testid={testId}
      >
        <div className="home-bubble__text">{text}</div>
        <i className="home-bubble__tail" aria-hidden="true" />
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
// His name, and the two readings that say what he has left in him. Both are
// drawn as three dots rather than as a number: this is a room, and a room
// does not print "heat 68" over somebody's head — and a continuous bar was
// claiming precision that a three-state word never had in the first place.
//
// LIFE-1-B replaces the two opposite-direction bars wave 56 drew (stamina
// draining from the right, heat filling from the left) with the shared dot
// reading from `src/shared/levels.js` — one function turns fatigue's word and
// heat's number into `{ level, dots, label, value }`, and `system/
// FeltBodyBars.jsx`'s `BodyDots` is the one drawing of it. The pill here, the
// strip over the felt, the seat pill and the profile card all read the same
// reading now, in the same shape, and cannot disagree about a man.

export function NamePill({
  name, nickname = null, fatigue = 'fresh', heat = 45, news = false, guest = false,
  // HomeOne's own call wears this pill on a body that is ALREADY one big tap
  // target (his thread). A dot nested inside it that also answered taps would
  // be two different taps fighting over the same finger, so that call passes
  // `interactive={false}` and gets the compact, always-decorative dots — the
  // same ones the felt's seat pill uses. AgentView's call sits in a plain div,
  // not a button, and keeps the tap-for-word default.
  interactive = true,
}) {
  const stamina = staminaLevel({ stage: fatigue });
  const hot = heatLevel(heat);
  return (
    <span className={`home-pill${news ? ' home-pill--news' : ''}${guest ? ' home-pill--guest' : ''}`} data-fatigue={fatigue} data-heat={hot.level}>
      {/* VISIT-1: he is not one of yours — the one fact this pill has to add,
          and the only place it is said. A body already reads as a stranger's
          the moment he is not one you can tap; this is what says WHY. */}
      {guest ? <span className="home-pill__guest" data-testid="home-pill-guest">GUEST</span> : null}
      {/* Board 29 HomeOne, reused by 42 C5: the name is primary text, not glow. */}
      <span className="home-pill__name" style={{ color: 'var(--text-primary)' }}>{shortName(name, nickname)}</span>
      <span className="home-pill__bars">
        <span className="home-pill__bar" data-bar="stamina">
          <BodyDots kind="stamina" reading={stamina} compact={!interactive} />
        </span>
        <span className="home-pill__bar" data-bar="heat">
          <BodyDots kind="heat" reading={hot} compact={!interactive} />
        </span>
      </span>
    </span>
  );
}

// ── One occupant ────────────────────────────────────────────────────────────

export function HomeOne({
  agent,
  at,
  // HOME-2 job 3 — who he is, rolled at birth (lib/identity.js) and claimed
  // against the roster so four agents always wear four hoods. `accent` is the
  // fallback for a caller that has no roster to roll against.
  identity = null,
  accent = '#00D4AA',
  size: baseSize = 46,
  roomWidth = 390,
  refusing = false,
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
  homeItem = null,
  walking = false,
  crossing = null,
  away = false,
  // BUG-134: the owner reached for him during a hand and the grab is waiting
  // on it. He is not refused and he is not lifted — he is about to be, and
  // this is what says so on the body itself rather than only in the bubble
  // (which fades on every other line the room shows).
  awaitingLift = false,
  returnLine = null,
  // HOME-2 job 5 · he is off the floor, in the owner's hand. `carried` is
  // { x, y, over } in room coordinates; the body follows the finger instead of
  // his own spot, and `over` is what dropping him there would mean.
  carried = null,
  carryHandlers = null,
  onClick,
}) {
  const fetching = homeItem && !carried && !away;
  // Transient accepted action from HOME_STATE, not another server routine.
  const r = fetching ? { key: 'fridge', label: 'at the fridge', pose: 'rest' } : presentRoutine(agent);
  const mood = agent?.mood?.state ?? 'neutral';
  const heat = agent?.mood?.heat ?? 45;
  const fatigue = fatigueOf(agent);
  const heldState = carried ? (heat >= 70 ? 'hot' : fatigue === 'worn' ? 'worn' : 'rested') : null;
  const heldVoice = CARRY_VOICE[heldState];
  const size = carried ? Math.max(62, Math.round(baseSize * 1.1)) : baseSize;
  const pose = heldVoice?.pose ?? (walking ? 'rest' : dealt ? 'hold' : r.pose);
  const besideHead = !!(carried || refusing);
  const speechX = carried?.x ?? at.x;
  const heldSide = speechX > roomWidth / 2 ? 'left' : 'right';
  const heldRoom = besideHead ? (heldSide === 'left' ? speechX : roomWidth - speechX) - size / 2 - 16 : null;
  const shownBubble = heldVoice ? { text: heldVoice.says, side: heldSide } : refusing && bubble ? { ...bubble, side: heldSide } : bubble;
  // His hood and glow stay his birth identity; the pill text stays neutral.
  const glow = identity?.glow?.c ?? accent;

  return (
    <button
      type="button"
      className={`home-one${awaitingLift ? ' is-awaiting-lift' : ''}${refusing ? ' is-refusing' : ''}${walking ? ' is-walking' : ''}${away ? ' is-away' : ''}${crossing === 'home' ? ' is-coming-home' : ''}${carried ? ' is-carried' : ''}${r.anim ? ` home-one--${r.key}` : ''}`}
      data-agent={agent?.id}
      data-routine={r.key}
      data-home-item-phase={fetching ? homeItem.phase : undefined}
      data-spot={at?.spot}
      data-walking={walking ? 'true' : 'false'}
      data-awaiting-lift={awaitingLift ? 'true' : undefined}
      data-crossing={crossing}
      aria-hidden={away ? 'true' : undefined}
      disabled={away}
      tabIndex={away ? -1 : undefined}
      data-carry-state={heldState}
      data-carried={carried ? 'true' : 'false'}
      data-over={carried?.over ?? null}
      // Carried, he is where the FINGER is, and above everything: a man in your
      // hand is nearer the viewer than any wall he is passing over. Walking is
      // an animation and carrying is not — the transition is dropped while he
      // is held, or he would lag a frame behind the thumb.
      style={{ ...(carried ? { left: carried.x, top: carried.y, zIndex: 950 }
        : { left: at.x, top: at.y, zIndex: Math.round(at.y) }),
        '--home-idle-phase': `${walking || carried || away || fetching ? 0 : idlePhase(agent?.id)}ms`,
        '--home-speech-top': (size * .65) + 'px', '--home-bubble-offset': (size / 2 + 8) + 'px',
        '--home-room-speech-top': (size / 2) + 'px', '--home-room-bubble-offset': roomBubbleOffset(size) + 'px' }}
      onClick={away ? undefined : onClick}
      aria-label={`${agent?.name ?? 'Agent'} — ${r.label}`}
      {...(!away ? carryHandlers ?? {} : {})}
    >
      {returnLine && !carried ? <span className={`home-return-result${returnLine.startsWith('−') ? ' is-loss' : ''}`} data-testid={`home-says-${agent?.id}`}>{returnLine}</span> : null}
      {shownBubble ? (
        <HomeBubble
          text={shownBubble.text}
          x={carried?.x ?? at.x}
          side={shownBubble.side}
          maxWidth={besideHead ? Math.min(150, Math.max(84, heldRoom)) : undefined}
          gold={shownBubble.gold}
          testId={`home-${shownBubble.gold ? 'news' : 'says'}-${agent?.id}`}
        />
      ) : null}

      {carried ? <span className="home-carry-shadow" style={{ width: size * .9, height: size * .24 }} aria-hidden /> : null}
      <span className="home-one__figure" style={heldVoice ? { '--carry-tilt': heldVoice.tilt, '--carry-bob': heldVoice.bob, '--carry-size': size + 'px' } : undefined}>
      <NamePill
        name={agent?.name}
        // Not on the wire yet; read the moment it is (lib/names.js).
        nickname={agent?.nickname}
        fatigue={fatigue}
        heat={heat}
        news={!!news}
        guest={!!agent?.guest}
        // This whole body is already one tap target (his thread); a second,
        // nested one for the dots would be two taps contesting one finger.
        interactive={false}
      />

      <span className="home-one__body" style={{ width: size, height: size }}>
        {r.back && !carried ? (
          // Facing the wall: the silhouette with no face, which is the whole
          // point of the routine.
          <svg width={size} height={size} viewBox="0 0 80 80" className="home-one__back" aria-hidden>
            {/* Facing away is still HIM: the hood is what you are looking at,
                so it keeps its colour when the face is gone. */}
            <path
              d="M40 6 C57.6 6 70 18.4 70 36 L70 70 C70 78.4 62.4 76.8 57.6 81.6 C53.6 85.6 46.4 85.6 40 81.6 C33.6 85.6 26.4 85.6 22.4 81.6 C17.6 76.8 10 78.4 10 70 L10 36 C10 18.4 22.4 6 40 6 Z"
              fill={identity?.hood?.top ?? '#161F1E'} stroke={`${glow}33`} strokeWidth="1.5"
            />
          </svg>
        ) : (
          <MoodGhost
            mood={mood}
            heat={heat}
            accent={glow}
            size={size}
            event={carried ? undefined : r.face}
            ring={false}
            hood={identity?.hood ?? null}
            glow={identity?.glow?.c ?? null}
          />
        )}

        {dealt && !carried && !r.back ? (
          <span className="home-one__cards" aria-hidden>
            {[0, 1].map((i) => <CardBack key={i} marked w={size * 0.29} h={size * 0.39} />)}
          </span>
        ) : null}

        {(!r.back || carried) ? <GhostHandLayer className="home-one__hands" pose={pose} size={size} grip={SEAT_GRIP} /> : null}
        {!walking && !carried && r.prop ? <RoutineProp kind={r.prop} size={size} /> : null}
        {fetching && homeItem.phase === 'back' && homeItem.item === 'snack' ? <span data-testid="home-item-snack" aria-hidden style={{
          position: 'absolute', right: -5, top: size * 0.5, width: 12, height: 8,
          borderRadius: 2, background: '#C9A227', border: '1px solid #7A6217',
        }} /> : null}
        {fetching && homeItem.phase === 'back' && homeItem.item === 'beer' ? <span data-testid="home-item-beer" aria-hidden style={{
          position: 'absolute', left: size / 2 + 24, top: size - 12, width: 6, height: 15,
          borderRadius: '2px 2px 3px 3px', background: 'rgba(122,168,138,0.8)', borderTop: '2px solid #7AA88A', zIndex: 40,
        }} /> : null}
      </span>
      </span>
    </button>
  );
}

// Board 29 C1–C5: the same ghost, with the authored held pose and voice.
const CARRY_VOICE = {
  rested: { says: 'Where are we going?', tilt: '-4deg', bob: '2.6s', pose: 'rest' },
  worn: { says: 'Fine. Carry me.', tilt: '-14deg', bob: '4.2s', pose: 'rest' },
  hot: { says: 'Put me down.', tilt: '6deg', bob: '0.9s', pose: 'clench' },
};

export function CarryTargets({ over, geometry = PHONE_ROOM }) {
  const t = geometry.flat.table;
  const targets = [
    ['couch', 'REST', geometry.flat.couch],
    ['table', 'DEAL HIM IN', { x: t.cx - t.rx, y: t.cy - t.ry, w: t.rx * 2, h: t.ry * 2 }],
    // Master spec v14 supersedes the older board's beer with a snack.
    ['fridge', 'A SNACK', geometry.flat.fridge],
    ['tv', 'WATCH TAPE', geometry.tvScreen],
    ['door', 'SEND HIM OUT', geometry.flat.door],
  ];
  return targets.map(([id, label, box]) => {
    const left = Math.max(0, box.x - 6), top = Math.max(0, box.y - 6);
    const width = Math.min(geometry.width, box.x + box.w + 6) - left;
    return <div key={id} className={'home-carry-target' + (over === id ? ' is-active' : '')}
      data-fixture={id} aria-hidden
      style={{ left, top, width, height: box.h + 12 }}>
      {over === id ? <span className={'home-carry-target__label' + (id === 'door' ? ' is-edge' : '')}>{label}</span> : null}
    </div>;
  });
}
