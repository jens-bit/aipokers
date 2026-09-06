// ATTR-2a — the small character-system atoms.
// Ports of design-refs/char-system.jsx (FatigueMeter, GrowthTick, NatureBadge),
// char-profile.jsx (FatigueLine), char-birth.jsx (NatureFormingChip) and
// char-play.jsx (GrowthLine, TrainingLine, GrewBadge).
// Styles in styles/attributes.css.

import { useState } from 'react';

import { FATIGUE, ATTR_SHORT, fatigueLineFor } from '../../lib/attributes.js';

// ── Fatigue, in words ───────────────────────────────────────────────────────
// Fatigue is STATE, not skill: no button, nothing to spend, and it names its own
// cost. The blocks are the redundant channel; the sentence is the message.
export function FatigueLine({ stage = 'fresh', hands, line, compact }) {
  const f = FATIGUE[stage] ?? FATIGUE.fresh;
  const text = line || fatigueLineFor(f.key, hands);
  const cls = [
    'fatigue-line',
    compact ? 'fatigue-line--compact' : '',
    f.gold ? 'fatigue-line--worn' : '',
  ].filter(Boolean).join(' ');
  return (
    <div className={cls}>
      <div className="fatigue-line__blocks">
        {[0, 1, 2].map((i) => (
          <div key={i} className={`fatigue-line__block${i < f.blocks ? ' fatigue-line__block--on' : ''}`} />
        ))}
      </div>
      <span className="fatigue-line__text">{text}</span>
    </div>
  );
}

// ── Growth tick ─────────────────────────────────────────────────────────────
// An event with a cause, never a silent number change. A tick with no cause is a
// number going up in a game; a tick with one is the agent telling you what he
// learned at your table this afternoon.
export function GrowthTick({ attr, from, to, cause }) {
  return (
    <div className="growth-tick">
      <span className="growth-tick__delta">
        {attr} {from} <span className="growth-tick__arrow">→</span> {to}
      </span>
      <span className="growth-tick__cause">{cause}</span>
    </div>
  );
}

// ── Growth line · the thread form ───────────────────────────────────────────
// Same tick, in his voice, sitting in the feed with the other events. Quiet on
// purpose: a point of Reads is not a trophy.
//
// CHAT-2: quieter still. A card per tick — teal box, star well, the cause
// quoted underneath — turned a six-attribute session into six posters, and the
// thread they were stacked in is meant to be a conversation. What is left is
// one line, "FOCUS 51 → 52 · 19:00", and the quote is behind a tap for the one
// tick in six an owner actually wants the reason for.
export function GrowthLine({ attr, from, to, line, time }) {
  const [open, setOpen] = useState(false);
  const voice = typeof line === 'string' && line.trim() ? line.trim() : null;

  return (
    <div className="growth-line">
      <button
        type="button"
        className="growth-line__row"
        onClick={voice ? () => setOpen((v) => !v) : undefined}
        aria-expanded={voice ? open : undefined}
        disabled={!voice}
      >
        <span className="growth-line__delta">
          {attr} {from} <span className="growth-tick__arrow">→</span> {to}
        </span>
        {time && <span className="growth-line__time">· {time}</span>}
      </button>
      {open && voice && <div className="growth-line__voice">“{voice}”</div>}
    </div>
  );
}

// ── Training line · one row inside the recap bubble ─────────────────────────
export function TrainingLine({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="training-line">
      <span className="training-line__label">TONIGHT TRAINED</span>
      {items.map((i) => (
        <span key={i.key} className="training-line__item">{i.key} +{i.gain}</span>
      ))}
    </div>
  );
}

// ── Grew badge · the roster row ─────────────────────────────────────────────
// The least room in the system: one mono chip, no icon, no colour beyond the
// teal it shares with every other gain.
export function GrewBadge({ gain = 1 }) {
  return (
    <span className="grew-badge">
      <span className="grew-badge__n">+{gain}</span>
      <span className="grew-badge__word">GREW</span>
    </span>
  );
}

// ── Nature chip ─────────────────────────────────────────────────────────────
// Typographic and nothing else. No crest, no emblem: an agent's picture is his
// ghost, and a second graphic identity would compete with it. Two sizes only.
export function NatureChip({ nature, size = 'm' }) {
  if (!nature?.name) return null;
  return (
    <span className={`nature-chip${size === 'l' ? ' nature-chip--l' : ''}`}>
      <span className="nature-chip__name">{nature.name}</span>
      {nature.up && nature.down && (
        <>
          <span className="nature-chip__rule" />
          <span className="nature-chip__up">+{ATTR_SHORT[nature.up] ?? nature.up}</span>
          <span className="nature-chip__down">−{ATTR_SHORT[nature.down] ?? nature.down}</span>
        </>
      )}
    </span>
  );
}

// The hint is a guess and dresses like one: dashed, a question mark, no pair.
// `guess` only ever comes from the server — a nature is never invented here.
export function NatureFormingChip({ guess }) {
  return (
    <span className="nature-forming">
      <span className="nature-forming__label">Forming</span>
      <span className="nature-chip__rule" />
      <span className="nature-forming__guess">{guess ? `${guess}?` : 'Temperament?'}</span>
    </span>
  );
}
