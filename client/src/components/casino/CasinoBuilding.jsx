// client/src/components/casino/CasinoBuilding.jsx — CASINO-1, UI-3 job A
//
// UI-3 JOB A — ONE ROOM. The casino used to be three doorways (the floor,
// upstairs, the back room) you walked between, each drawn as a room seen
// through its own doorway with a crowd texture on a perspective floor. It is
// now a single room and every table in it carries its own stakes, so there
// is nothing left to walk INTO — CasinoDoor, RoomDoors, the crowd field and
// the "UPSTAIRS →" stair furniture are gone with the doorways.
//
// `StakePicker` is what is left of the job the doors did: when an owner is
// placing a man, he still has to choose a stake, so it names each tier the
// ladder runs, its buy-in and who is already there — a row of chips, not a
// room to step into.
//
// What survives unchanged: DeployTray (his face, his pocket, the deal, never
// a picker). The sign over the door (CasinoHead/Marquee) went with the
// building — FloorView draws its own header now, and the desk shell's own
// top bar carries the room on the desk.

const M_TEAL = 'var(--accent)';
const M_GOLD = 'var(--gold-reward)';
import { identityOf } from '../../lib/identity.js';
import { MoodGhost } from '../system/MoodGhost.jsx';
import { accentFor } from '../floor/atoms.jsx';
import { moodOf, heatOf } from '../floor/agentView.js';
import { money, pocketOf } from '../../lib/wallet.js';

// ── Design tokens (verbatim from the refs) ─────────────────────────────────
export const M_BG     = 'var(--bg-primary)';
const M_BORDER = 'var(--edge)';
const M_TEXT   = 'var(--text-primary)';
const M_DIM    = 'var(--text-secondary)';
const M_MUTED  = 'var(--text-muted)';

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
    primary: { background: M_TEAL, border: 'none', color: 'var(--on-accent)', boxShadow: `0 0 14px color-mix(in srgb, ${M_TEAL} 26.67%, transparent)` },
    ghost: { background: 'transparent', border: `1px solid ${M_BORDER}`, color: M_DIM },
    outline: { background: 'transparent', border: `1px solid ${M_TEAL}`, color: M_TEAL },
  };
  return (
    <button type="button" onClick={onClick} disabled={disabled} style={{ ...base, ...kinds[kind] }} {...rest}>
      {children}
    </button>
  );
}

// ── Choosing a stake ────────────────────────────────────────────────────────

/** The blinds as the house says them: 10/20, not $10/$20. */
export function doorStakes(room) {
  const s = room?.stakes;
  if (!s) return '';
  return `${s.smallBlind}/${s.bigBlind}`;
}

/**
 * ONE CHIP PER STAKE — UI-3 job A.
 *
 * Placing a man used to mean choosing which of three rooms to carry him into.
 * There is one room now, so this asks the only question left: which stake.
 * Each chip says what it costs to sit, how many are already there, and
 * whether his pocket covers it — the same facts law 4 always demanded, said
 * in a row of chips instead of a doorway he could no longer walk into.
 */
export function StakePicker({ stakes = [], mineByStake = {}, hotStakes = new Set(), pocket = null, selectedId = null, onSelect = null }) {
  if (stakes.length === 0) return null;
  return (
    <div className="csn-stakes" role="group" aria-label="Choose a stake">
      {stakes.map((stake) => {
        const mine = mineByStake[stake.id] ?? [];
        const hot = hotStakes.has(stake.id);
        const shut = pocket ? (pocket.balance ?? 0) < stake.stakes.buyIn : false;
        const label = shut
          ? `${stake.stakes.label} — needs ${money(stake.stakes.buyIn)} to sit`
          : `${stake.stakes.label} — ${count(stake.seated)} in${hot ? ', hot' : ''}`;
        return (
          <button
            key={stake.id}
            type="button"
            className="csn-stake"
            data-stake={stake.id}
            data-hot={hot ? 'true' : undefined}
            data-shut={shut ? 'true' : undefined}
            aria-pressed={selectedId === stake.id}
            aria-label={label}
            onClick={onSelect ? () => onSelect(stake) : undefined}
          >
            <span className="csn-stake__label">
              {stake.stakes.label}
              {hot && <span className="csn-stake__hot">HOT</span>}
            </span>
            <span className="csn-stake__buyin">{money(stake.stakes.buyIn)} buy-in</span>
            <span className="csn-stake__in">
              {`${count(stake.seated)} in`}
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
 * is not money, and the eye stops on it. This is the one sentence where the
 * stakes are an ADDRESS rather than a price.
 *
 * Everything else about the tray is deliberately unchanged. It is the wave-55
 * restore: he is already standing here, so his face is in it rather than a
 * picker, and the pocket IS the wager, so the buy-in sits in the same breath.
 * A bare "Deploy someone" button threw away both facts.
 */
export function DeployTray({ agent, index = 0, room, affordable, busy = false, onDeal, onFund }) {
  const look = identityOf(agent);
  const pocket = pocketOf(agent);
  const balance = pocket?.balance ?? 0;
  const buyIn = room?.stakes?.buyIn ?? 0;
  const size = 38;

  return (
    <div
      className="csn-tray"
      style={{
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
        borderTop: `1px solid color-mix(in srgb, ${M_TEAL} 23.92%, transparent)`, background: 'color-mix(in srgb, var(--accent) 6%, transparent)',
      }}
    >
      <MoodGhost hood={look.hood} glow={look.glow.c}
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
            : `pocket ${money(balance)} · pick a stake`}
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
