// client/src/components/casino/CasinoBuilding.jsx — CASINO-1
//
// Board 27, direction B, ported from design-refs/mood-floor3.jsx (CasinoDoor,
// CasinoBoard, CrowdField, CrowdGhost, DeployTray, CasinoHead). SVG paths,
// gradients, geometry and animation timings are verbatim; only React plumbing
// and the joins to real data are adapted.
//
// The five laws the ref states, and where each one lives in this file:
//
//   1. CROWD IS A TEXTURE, NOT A COUNT — CrowdField caps at 34 ghosts on a
//      perspective floor and puts the real number beside it. A room with 1,180
//      in it looks different from one with 44 without either being drawn.
//   2. FELTS ARE ELLIPSES ON THAT FLOOR, receding. You cannot count seats at
//      one and you are not meant to.
//   3. YOURS STAND IN THE DOORWAY AT CHARACTER SCALE, with name and P&L, while
//      everything else in the room is 9-17px. Finding your own is never a
//      search.
//   4. A ROOM HE CANNOT AFFORD IS SHUT AND SAYS THE PRICE. A fact about his
//      pocket, never a paywall and never a lock icon.
//   5. HOT IS THE ONLY THING THAT ASKS FOR YOU NOW.
//
// The crowd ghost is deliberately NOT MoodGhost at a small size: at 12px a face
// system is an expensive smudge and forty of them is a frame budget. It is the
// same silhouette with two drawing operations and no face, which is all a crowd
// needs to be. The characters keep the full anatomy; the strangers get the
// shape.

import { MoodGhost } from '../system/MoodGhost.jsx';
import { CardBack } from '../system/PlayingCard.jsx';
import { accentFor, M_TEAL, M_GOLD, M_RED } from '../floor/atoms.jsx';
import { moodOf, heatOf } from '../floor/agentView.js';
import { Num } from '../wallet/atoms.jsx';
import { money, pocketOf } from '../../lib/wallet.js';
import { pillName } from '../../lib/names.js';

// ── Design tokens (verbatim from the refs) ─────────────────────────────────
export const M_BG     = '#0A0F0F';
const M_BORDER = 'rgba(255,255,255,0.12)';
const M_TEXT   = '#EDEDED';
const M_DIM    = '#A1A1A1';
const M_MUTED  = '#6B6B6B';

const PLAYFAIR = '"Playfair Display",Georgia,serif';
const OSWALD   = '"Oswald","Helvetica Neue",sans-serif';
const MONO     = '"JetBrains Mono",ui-monospace,monospace';

// A plain count, grouped the way money() in lib/wallet.js groups. NOT
// toLocaleString(): that follows the machine's locale, so on a Swedish phone
// the crowd read "1 604" two lines above a pot that read "$4,180". One screen,
// one separator.
export function count(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return '0';
  return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ── Small atoms, ported from mood-atoms.jsx ────────────────────────────────

export function Stake({ label }) {
  return (
    <span style={{ fontFamily: MONO, fontSize: 9, fontWeight: 700, color: M_GOLD }}>{label}</span>
  );
}

export function LiveDot({ color = M_TEAL, size = 6 }) {
  return (
    <span
      aria-hidden
      style={{
        width: size, height: size, borderRadius: '50%', background: color,
        boxShadow: `0 0 6px ${color}`, animation: 'pulse 2s infinite',
        flexShrink: 0, display: 'inline-block',
      }}
    />
  );
}

export function Btn({ children, kind = 'primary', h = 34, full, onClick, disabled, ...rest }) {
  const base = {
    height: h, padding: '0 14px', borderRadius: 8, fontFamily: OSWALD, fontSize: 11,
    fontWeight: 600, letterSpacing: '0.12em', cursor: disabled ? 'default' : 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
    width: full ? '100%' : 'auto', textTransform: 'uppercase',
    opacity: disabled ? 0.45 : 1,
  };
  const kinds = {
    primary: { background: M_TEAL, border: 'none', color: '#0A0A0A', boxShadow: `0 0 14px ${M_TEAL}44` },
    ghost: { background: 'transparent', border: `1px solid ${M_BORDER}`, color: M_DIM },
    outline: { background: 'transparent', border: `1px solid ${M_TEAL}`, color: M_TEAL },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...kinds[kind] }} {...rest}>
      {children}
    </button>
  );
}

// The room's volume, drawn as three bars. The ref carried a hand-authored 1-3;
// the server sends seats filled, so the tiers are derived from that. Zero bars
// is a real state — the back room being quiet tonight is worth saying.
export function noiseLevel(seated = 0) {
  if (seated <= 0) return 0;
  if (seated <= 6) return 1;
  if (seated <= 20) return 2;
  return 3;
}

export function Noise({ level }) {
  return (
    <div aria-hidden style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 11 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 3, height: 4 + i * 3.5, borderRadius: 1,
            background: i < level ? M_TEAL : 'rgba(255,255,255,0.14)',
          }}
        />
      ))}
    </div>
  );
}

// ── The crowd ──────────────────────────────────────────────────────────────

export function CrowdGhost({ size = 12, o = 0.5, delay = 0 }) {
  return (
    <svg
      width={size} height={size * 1.15} viewBox="0 0 20 23" aria-hidden
      style={{ opacity: o, animation: `casino-bob ${5 + (delay % 4)}s ease-in-out ${delay * 0.3}s infinite` }}
    >
      <path d="M10 1.5 C14.4 1.5 17.5 4.6 17.5 9 L17.5 17.5 C17.5 19.6 15.6 19.2 14.4 20.4 C13.4 21.4 11.6 21.4 10 20.4 C8.4 21.4 6.6 21.4 5.6 20.4 C4.4 19.2 2.5 19.6 2.5 17.5 L2.5 9 C2.5 4.6 5.6 1.5 10 1.5 Z" fill="#1C2A2C" />
      <path d="M10 1.5 C14.4 1.5 17.5 4.6 17.5 9 L17.5 12 L2.5 12 L2.5 9 C2.5 4.6 5.6 1.5 10 1.5 Z" fill="#223334" />
    </svg>
  );
}

// How many ghosts stand for a population of n. Exported because it is the
// whole of law 1 and the one thing worth asserting on: it must never be zero
// for a room with anybody in it, and never more than the frame budget.
export function crowdSize(n) {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(34, Math.max(3, Math.round(n / 34)));
}

// The ref places the crowd against a hard-coded 358px — the phone's doorway
// width, which is the only width it was ever drawn at. On the desk the doorway
// is 1,200px and the whole crowd bunched into its left third. The trapezoid is
// a proportion, not a pixel count, so it is expressed as one: identical output
// at 358 and correct at any other width.
export function CrowdField({ n, h }) {
  const cap = crowdSize(n);
  const rows = 4;
  return (
    <>
      {Array.from({ length: cap }).map((_, i) => {
        const row = i % rows;                       // 0 = far
        const depth = row / (rows - 1);             // 0..1 toward the viewer
        const per = Math.ceil(cap / rows);
        const col = Math.floor(i / rows);
        const inset = 0.30 - depth * 0.26;          // the trapezoid narrows at the back
        const left = inset + ((col + 0.5) / per) * (1 - inset * 2);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: `${left * 100}%`,
              bottom: 8 + (1 - depth) * (h * 0.46),
              transform: 'translateX(-50%)',
            }}
          >
            <CrowdGhost size={9 + depth * 8} o={0.34 + depth * 0.4} delay={i} />
          </div>
        );
      })}
    </>
  );
}

// ── The doorway ────────────────────────────────────────────────────────────

// Yours, standing in the doorway at character scale (law 3). This is F3Body
// from the ref: the full mood anatomy plus his pair, never the crowd ghost.
function Doorman({ agent, index, pnl }) {
  const accent = accentFor(agent, index);
  const size = 36;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <MoodGhost
          mood={moodOf(agent)}
          heat={heatOf(agent)}
          accent={accent}
          size={size}
          ring={false}
          hands="hold"
        />
        <div style={{
          position: 'absolute', left: '50%', top: '60%', transform: 'translateX(-50%)',
          display: 'flex', gap: 2, zIndex: 4,
        }}>
          {[0, 1].map((i) => <CardBack key={i} w={size * 0.36} h={size * 0.48} />)}
        </div>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 4, height: 16, padding: '0 6px',
        borderRadius: 8, background: 'rgba(10,14,14,0.9)', border: `1px solid ${M_TEAL}44`,
        maxWidth: 96,
      }}>
        <span style={{
          fontSize: 8.5, color: M_DIM, whiteSpace: 'nowrap',
          overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{pillName(agent.name)}</span>
        {pnl !== null && (
          <Num size={8.5} weight={700} color={pnl >= 0 ? M_TEAL : M_RED}>
            {money(pnl, { sign: true })}
          </Num>
        )}
      </div>
    </div>
  );
}

// The P&L on the doorway chip is the pocket's, which is the only net the floor
// payload actually carries per agent.
function pnlOf(agent) {
  const p = pocketOf(agent);
  return p && Number.isFinite(p.pnl) ? p.pnl : null;
}

/**
 * A room, seen through its doorway. The doorway is the frame; the room recedes.
 *
 * @param {object}   room     one entry of the ROOMS-1 payload
 * @param {object[]} mine     your agents sitting in it
 * @param {boolean}  hot      a big pot is live in here right now
 * @param {boolean}  shut     his pocket cannot cover the buy-in
 * @param {number}   h        the doorway's height; the ref varies it per room
 * @param {Function} onSelect tap handler; absent means the door is scenery
 */
export function CasinoDoor({
  room, mine = [], hot = false, shut = false, shutFor = null,
  h = 150, selected = false, onSelect = null,
}) {
  const whose = shutFor ? `${shutFor}'s pocket needs` : 'his pocket needs';
  const backRoom = room.rung >= 2;
  const interactive = !!onSelect;
  const level = noiseLevel(room.seated);

  const body = (
    <>
      {/* the room behind the door: a perspective floor and a far wall */}
      <div style={{
        position: 'absolute', inset: 0,
        background: backRoom
          ? 'linear-gradient(180deg, #140F11 0%, #1C1418 62%, #241A1E 100%)'
          : 'linear-gradient(180deg, #0D1413 0%, #16211F 58%, #1E2C29 100%)',
      }} />
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: 0, height: h * 0.52,
        background: 'linear-gradient(180deg, rgba(47,77,72,0.34) 0%, rgba(47,77,72,0.06) 100%)',
        clipPath: 'polygon(-8% 100%, 108% 100%, 70% 0, 30% 0)',
      }} />

      {/* felts as ellipses on that floor, receding — never a table you can
          count seats on (law 2) */}
      {[[0.5, 0.30, 46], [0.24, 0.13, 62], [0.78, 0.13, 62]].map(([lx, by, fw], i) => (
        <div
          key={i}
          data-felt={i === 0 && hot ? 'hot' : 'felt'}
          style={{
            position: 'absolute', left: `${lx * 100}%`, bottom: by * h, width: fw,
            height: fw * 0.34, marginLeft: -fw / 2, borderRadius: '50%',
            background: hot && i === 0
              ? `radial-gradient(ellipse, ${M_GOLD}3D, ${M_GOLD}12)`
              : 'radial-gradient(ellipse, rgba(47,77,72,0.72), rgba(29,46,44,0.42))',
            border: `1px solid ${hot && i === 0 ? `${M_GOLD}66` : 'rgba(255,255,255,0.06)'}`,
            animation: hot && i === 0 ? 'casino-shimmer 2s ease-in-out infinite' : 'none',
          }}
        />
      ))}

      {!shut && <CrowdField n={room.seated} h={h} />}

      {/* the stake sign over the door */}
      <div style={{ position: 'absolute', left: 11, top: 10, display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontFamily: PLAYFAIR, fontSize: 15, fontWeight: 600, color: shut ? M_MUTED : M_TEXT }}>
          {room.name}
        </span>
        <Stake label={room.stakes.label} />
        {hot && (
          <span style={{
            fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em',
            color: M_GOLD, border: `1px solid ${M_GOLD}77`, background: `${M_GOLD}1A`,
            borderRadius: 3, padding: '1px 5px',
          }}>HOT</span>
        )}
      </div>

      <div style={{ position: 'absolute', right: 11, top: 11, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED }}>
          {count(room.seated)} in
        </span>
        <Noise level={level} />
      </div>

      {/* yours, standing in the doorway so he is findable (law 3). The ref
          steps them at a fixed 62px, which was drawn against four names of the
          same length; real ones are not, and "Balanced v2.1" beside "Bluff
          Master" overlapped. A row that lays itself out cannot collide, and it
          keeps the ref's right-anchored placement. Three is the most a doorway
          holds — past that the count stands in for the rest, because a doorway
          crowded with your own agents stops being a doorway. */}
      {mine.length > 0 && (
        <div style={{
          position: 'absolute', right: 12, bottom: 9, left: 12,
          display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8,
        }}>
          {mine.slice(0, 3).map((agent, i) => (
            <Doorman key={agent.id} agent={agent} index={i} pnl={pnlOf(agent)} />
          ))}
          {mine.length > 3 && (
            <span style={{ fontFamily: MONO, fontSize: 9, color: M_DIM, paddingBottom: 4 }}>
              +{mine.length - 3}
            </span>
          )}
        </div>
      )}

      {/* law 4: shut, and it says the price. Never a lock icon. */}
      {shut && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(6,9,9,0.66)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: 11, color: M_DIM }}>
            {whose} <b style={{ color: M_TEXT }}>{money(room.stakes.buyIn)}</b> to sit here
          </span>
        </div>
      )}
    </>
  );

  const frame = {
    position: 'relative', flexShrink: 0, height: h, borderRadius: 12, overflow: 'hidden',
    width: '100%', padding: 0, textAlign: 'left', display: 'block',
    border: `1px solid ${hot ? `${M_GOLD}77` : selected ? M_TEAL : mine.length ? `${M_TEAL}44` : M_BORDER}`,
    boxShadow: hot ? `0 0 20px ${M_GOLD}2E` : selected ? `0 0 14px ${M_TEAL}33` : 'none',
    background: '#0B100F',
  };

  if (!interactive) {
    return <div className="csn-door" data-room={room.id} style={frame}>{body}</div>;
  }

  // A shut door is still a button — tapping it is how the owner gets to his
  // chips, which is the only thing that opens it.
  const label = shut
    ? `${room.name}, ${room.stakes.label} — ${whose} ${money(room.stakes.buyIn)} to sit here`
    : `${room.name}, ${room.stakes.label} — ${room.seated} seated${hot ? ', hot' : ''}`;

  return (
    <button
      type="button"
      className="csn-door"
      data-room={room.id}
      data-shut={shut ? 'true' : undefined}
      data-hot={hot ? 'true' : undefined}
      aria-pressed={selected}
      aria-label={label}
      onClick={() => onSelect(room)}
      style={{ ...frame, cursor: 'pointer' }}
    >
      {body}
    </button>
  );
}

// ── The board by the stairs ────────────────────────────────────────────────
//
// CASINO-2 job 2 moved it to FloorBoard.jsx and split it in two. The board that
// lived here held five ticker lines newest-first, which put a $0 bust from four
// seconds ago above a $14,200 pot from two minutes ago and had no way at all to
// mention the pot being built right now — a hand that has not ended has fired
// no event. LIVE NOW (off the felts) and TONIGHT (off the ticker, ranked by
// money) are the two questions that list was answering badly at once.
//
// The header, the gold plate and the stairs beside it are the same object;
// only what hangs on the wall changed.

// The one piece of furniture that says the building has floors.
export function Stairs() {
  return (
    <div
      aria-hidden
      style={{ flexShrink: 0, display: 'flex', alignItems: 'flex-end', gap: 3, height: 40, padding: '0 2px' }}
    >
      {[10, 16, 22, 28, 34, 40].map((hh, i) => (
        <div
          key={hh}
          style={{
            flex: 1, height: hh, borderRadius: '3px 3px 0 0',
            background: `linear-gradient(180deg, rgba(205,179,128,${0.05 + i * 0.02}) 0%, rgba(255,255,255,0.02) 100%)`,
            borderTop: '1px solid rgba(255,255,255,0.07)',
          }}
        />
      ))}
      <span style={{
        fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.16em',
        color: M_MUTED, marginLeft: 8, marginBottom: 3,
      }}>UPSTAIRS →</span>
    </div>
  );
}

// ── The head ───────────────────────────────────────────────────────────────

/**
 * THE SIGN OVER THE DOOR — CASINO-2 job 3.
 *
 * It was type in a header: the same Playfair line every other screen puts its
 * title in, which said "this is a tab called The casino" rather than "you have
 * walked into a building". A casino's name is the one piece of signage in the
 * world that is never quiet about being a sign, and the whole identity of this
 * screen is that it is somewhere you go.
 *
 * So it is a lit marquee: bulbs over the words, on a gold plate, running left
 * to right the way a real one does — the bulbs chase rather than blink
 * together, because a row that flashes in unison is a warning light and a row
 * that runs is an invitation.
 *
 * `lit` is not decoration. A floor that has not opened gets a dark sign, which
 * is what an unlit marquee has always meant, and is more honest than a bright
 * sign over a building with nothing in it.
 *
 * NOT A PILL. It never takes a pill's rounded capsule, because the two would
 * then be the same object at different sizes: this screen's pills are LIVE
 * STATE (a net, a HOT badge, a count) and they change all evening. The sign is
 * the one thing on the screen that does not.
 */
export function Marquee({ lit = true }) {
  return (
    <span className="csn-marquee" data-lit={lit ? 'true' : 'false'}>
      <span className="csn-marquee__bulbs" aria-hidden>
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <i key={i} style={{ animationDelay: `${i * 0.17}s` }} />
        ))}
      </span>
      {/* CASINO-2 job 2: "The casino" NEVER WRAPS. At 390 with a long sub-line
          under it — "1,604 playing · 3 of yours in" — the flex row gave the
          title a narrow column and the sign broke across two lines as "The"
          over "casino", which is a broken sign rather than a small one. It is
          two words; it keeps them. */}
      <span className="csn-marquee__word">The casino</span>
    </span>
  );
}

export function CasinoHead({ sub, right, lit = true, onBack = null }) {
  return (
    <div className="csn-head" style={{
      flexShrink: 0, minHeight: 52, display: 'flex', alignItems: 'center', gap: 9,
      padding: '6px 14px', borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111',
    }}>
      {/* HOME-2 job 1 · through the door, and still no bottom bar: ← HOME is
          where the back button goes (board 29 F07). */}
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          aria-label="Back home"
          style={{
            flexShrink: 0, background: 'none', border: 'none', padding: '4px 4px 4px 0', cursor: 'pointer',
            fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM,
          }}
        >← HOME</button>
      ) : null}
      <div style={{ flex: 1, minWidth: 0 }}>
        <Marquee lit={lit} />
        <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 2 }}>{sub}</div>
      </div>
      {right}
    </div>
  );
}

// ── The three doors ────────────────────────────────────────────────────────

/**
 * The room's name as it is written on its door.
 *
 * THE FLOOR · UPSTAIRS · BACK ROOM. A leading "the" is dropped when what is
 * left is still more than one word, which is the difference between a sign and
 * a sentence — three signs in a row read as a row of signs, and "THE BACK
 * ROOM" beside "THE FLOOR" reads as prose. "the floor" keeps its article,
 * because "FLOOR" alone is a storey rather than a room.
 *
 * A rule rather than a table, so a deployment that adds a rung gets a door
 * with a name on it instead of a blank one.
 */
export function doorLabel(room) {
  const name = String(room?.name ?? '').trim();
  if (!name) return '';
  const stripped = name.replace(/^the\s+/i, '');
  const label = stripped.includes(' ') ? stripped : name;
  return label.toUpperCase();
}

/** The blinds as a door says them: 10/20, not $10/$20. */
export function doorStakes(room) {
  const s = room?.stakes;
  if (!s) return '';
  return `${s.smallBlind}/${s.bigBlind}`;
}

/**
 * THREE DOORS UNDER THE SIGN — CASINO-2 job 3.
 *
 * The building has three rooms and they are the thing it is organised by, so
 * they are the first thing under the sign and they never scroll off: at rest
 * this screen is a board, three doors and your own table, and the doors are
 * the only navigation on it.
 *
 * This is NOT the tall doorway (CasinoDoor, above). That one is the DEPLOY
 * choice — a room seen through its doorway, its crowd drawn, your own men
 * standing in it, the price on it when his pocket cannot cover the buy-in —
 * and it earns a third of the screen because placing a man is the one decision
 * made here. A door you are only walking through does not, and three of those
 * at 152px each is the whole phone.
 *
 * Each door says the three things that decide which one you want: what it is
 * called, what it costs to sit, and how many are in there. Hot is a fourth,
 * and it is the only one that changes on its own.
 */
export function RoomDoors({ rooms = [], mineByRoom = {}, hotRooms = new Set(), onOpen = null }) {
  if (rooms.length === 0) return null;
  return (
    <div className="csn-doors" role="group" aria-label="The rooms">
      {rooms.map((room) => {
        const mine = mineByRoom[room.id] ?? [];
        const hot = hotRooms.has(room.id);
        const label = doorLabel(room);
        return (
          <button
            key={room.id}
            type="button"
            className="csn-room-door"
            data-room={room.id}
            data-hot={hot ? 'true' : undefined}
            data-mine={mine.length ? 'true' : undefined}
            aria-label={`${room.name}, ${room.stakes.label} — ${room.seated} in${hot ? ', hot' : ''}. Go in.`}
            onClick={onOpen ? () => onOpen(room) : undefined}
          >
            <span className="csn-room-door__name">
              {label}
              {hot && <span className="csn-room-door__ember" aria-hidden />}
            </span>
            <span className="csn-room-door__stakes">{doorStakes(room)}</span>
            <span className="csn-room-door__in">
              {`${count(room.seated)} in`}
              {mine.length > 0 && <b>{` · ${mine.length} yours`}</b>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── The deploy tray ────────────────────────────────────────────────────────

/**
 * He came with you from Home or from his profile, so he is in the tray and not
 * in a picker. The tray states his pocket and the buy-in in the same line,
 * which is the entire decision. No stake slider anywhere — the pocket already
 * is the wager.
 *
 * CASINO-2 job 6 · THE LINE, AS THE REF WRITES IT.
 * "pocket $1,240 · buy-in at 10/20 is $1,000" — mood-floor3's DeployTray and
 * mood-casino2's restored tray both write the blinds BARE here, and it is not
 * an oversight in either. The line already carries two amounts that are money
 * you are deciding about; a third "$10/$20" between them is a dollar sign that
 * is not money, and the eye stops on it. The room name and the ladder are
 * everywhere else on this screen with their dollars intact — this is the one
 * sentence where the stakes are an ADDRESS rather than a price.
 *
 * Everything else about the tray is deliberately unchanged. It is the wave-55
 * restore: he is already standing here, so his face is in it rather than a
 * picker, and the pocket IS the wager, so the buy-in sits in the same breath.
 * A bare "Deploy someone" button threw away both facts.
 */
export function DeployTray({ agent, index = 0, room, affordable, busy = false, onDeal, onFund }) {
  const pocket = pocketOf(agent);
  const balance = pocket?.balance ?? 0;
  const buyIn = room?.stakes?.buyIn ?? 0;
  const size = 38;

  return (
    <div
      className="csn-tray"
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderTop: `1px solid ${M_TEAL}3D`, background: 'rgba(0,212,170,0.06)',
      }}
    >
      <MoodGhost
        mood={moodOf(agent)}
        heat={heatOf(agent)}
        accent={accentFor(agent, index)}
        size={size}
        ring={false}
        hands="rest"
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11.5, color: M_TEXT, fontWeight: 500 }}>{agent.name}</div>
        <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 1 }}>
          {room
            ? `pocket ${money(balance)} · buy-in at ${doorStakes(room)} is ${money(buyIn)}`
            : `pocket ${money(balance)} · pick a room`}
        </div>
      </div>
      {affordable ? (
        <Btn h={32} onClick={onDeal} disabled={busy || !room}>Deal him in</Btn>
      ) : (
        <Btn h={32} kind="outline" onClick={onFund}>His chips</Btn>
      )}
    </div>
  );
}
