// CHIPS — port of design-refs/mood-watch5.jsx (`CHIP_D`, `Chip`, `ChipStack`,
// `BetSpot`, and 52j "A bet, as objects").
//
// "Chips were part of his body before this — drawn inside the push pose, so they
// moved when he did. Now they are things on a felt: his stack stands to his left
// at a height set by his stack band, one hand picks 1-4 chips off the top (the
// count IS the bet band), carries them in front of his cards, and the bet spot
// slides into the pot at street end."
//
// REAL DENOMINATIONS, not a generic disc: white 1 · red 5 · blue 10 · green 25 ·
// black 100. A band is a fixed set of them, so the SHAPE of a pile says how much
// money is there before any figure is read — a table that has been betting big
// looks different from one that has been limping.

export const CHIP_D = {
  w: '#D8D4CC',  // white   1
  r: '#B4353A',  // red     5
  b: '#2F5C93',  // blue   10
  g: '#2E7D53',  // green  25
  k: '#1A1A1E',  // black 100
};

export const CHIP_BANDS = {
  small: ['w', 'w', 'r'],
  mid:   ['w', 'r', 'r', 'b', 'b', 'g'],
  big:   ['r', 'b', 'b', 'g', 'g', 'g', 'k', 'k', 'k', 'k'],
};

export const BET_BANDS = {
  small: ['w'],
  mid:   ['r', 'r'],
  big:   ['g', 'g', 'b', 'r'],
};

// Three bands and nothing between — for a pile (what he is sitting behind) and
// for a bet (what he just pushed out). Both are ratios rather than absolutes, so
// they mean the same thing at $2/$4 as at $200/$400.
export function stackBand(stack, startingStack) {
  if (!Number.isFinite(stack) || stack <= 0) return 'small';
  const base = Number.isFinite(startingStack) && startingStack > 0 ? startingStack : 2000;
  const r = stack / base;
  return r < 0.5 ? 'small' : r > 1.5 ? 'big' : 'mid';
}

export function potBand(pot, bigBlind) {
  if (!Number.isFinite(pot) || pot <= 0) return 'small';
  const bb = Number.isFinite(bigBlind) && bigBlind > 0 ? bigBlind : 20;
  const inBb = pot / bb;
  return inBb < 8 ? 'small' : inBb > 30 ? 'big' : 'mid';
}

// One chip, seen almost edge-on: a 0.42 ratio ellipse with an inset highlight,
// stacked upward by `step` so the pile has a height rather than a count.
export function Chip({ d = 'r', w = 26, i = 0, step = 3.4 }) {
  return (
    <span className="chip" data-d={d} style={{
      bottom: i * step, width: w, height: w * 0.42,
      background: CHIP_D[d] || CHIP_D.r,
      boxShadow: `inset 0 ${w * 0.06}px 0 rgba(255,255,255,0.28), 0 1px 2px rgba(0,0,0,0.5)`,
    }} />
  );
}

// How many chips an OPPONENT's pile is allowed to be. WATCH-10 job 1: a banded
// pile is up to ten chips tall, and five of those across the top of a 390px
// felt is the densest thing on the table. Three keeps the shape of a stack;
// the denominations keep the size of it; the figure beside it says the rest.
export const SEAT_PILE_CHIPS = 3;

// A stack standing on the felt. `amt` is the figure beside (or under) the chips
// it describes rather than in a panel elsewhere — that is why STACK left the
// hero's strip, and since WATCH-10 it is why it left an opponent's name pill.
// `label` is still the hero's alone: his is the one pile big enough to caption.
//
// `cap` takes the TOP `cap` chips of the band rather than the first, so a big
// stack capped at three is three blacks and a small one is three whites — the
// pile keeps saying how much money it is without being tall enough to say it.
export function ChipStack({ band = 'mid', chips, w = 26, cap = null, label, amt, className }) {
  const full = chips || CHIP_BANDS[band] || CHIP_BANDS.mid;
  const set = Number.isFinite(cap) && cap > 0 ? full.slice(-cap) : full;
  return (
    <span className={`chip-stack${className ? ` ${className}` : ''}`} data-band={band}>
      <span className="chip-stack__pile" style={{ width: w, height: set.length * 3.4 + w * 0.42 }}>
        {set.map((d, i) => <Chip key={i} d={d} w={w} i={i} />)}
      </span>
      {label && <span className="chip-stack__label">{label}</span>}
      {amt && <span className="chip-stack__amt">{amt}</span>}
    </span>
  );
}

// Where a bet lands: in front of his cards, on the felt, not in a panel. The
// chip COUNT is the bet band, which is what makes the size of a bet legible on
// the table before the figure reaches his strip.
export function BetSpot({ band = 'mid', chips, w = 22, amt, className }) {
  const set = chips || BET_BANDS[band] || BET_BANDS.mid;
  return (
    <span className={`bet-spot${className ? ` ${className}` : ''}`} data-band={band}>
      <span className="bet-spot__pile" style={{ width: w, height: set.length * 3.2 + w * 0.44 }}>
        {set.map((d, i) => <Chip key={i} d={d} w={w} i={i} step={3.2} />)}
      </span>
      {amt && <span className="bet-spot__amt">{amt}</span>}
    </span>
  );
}

// The pot's own chip. "The pot pill grows one step per band" — so a table that
// has been betting big looks different from one that has been limping, before a
// single figure is read.
export function PotChip({ band = 'mid', w = 15 }) {
  const set = CHIP_BANDS[band] || CHIP_BANDS.mid;
  const n = band === 'big' ? 5 : band === 'small' ? 2 : 3;
  return (
    <span className="pot-chip" data-band={band}
      style={{ width: w, height: band === 'big' ? 17 : band === 'small' ? 8 : 12 }}>
      {set.slice(0, n).map((d, i) => <Chip key={i} d={d} w={w} i={i} step={2.6} />)}
    </span>
  );
}
