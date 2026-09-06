// client/src/lib/identity.js — DRAFT-2
//
// THE SIX HOODS AND THE SIX GLOWS. Ported verbatim from `HOODS` / `GLOWS` in
// design-refs/mood-atoms.jsx (wave 56).
//
// Wave 56 relit both tables. The first set was drawn as six near-blacks
// (L* 8–14) and read as one grey: at 40px a hood is barely 900 painted pixels
// and hue does nothing at that luminance. These sit at L* 26–36 — still muted
// enough to be cloth in a dim room, far enough apart in hue and lightness that
// a four-agent room reads as four individuals.
//
// WHAT IS DELIBERATELY NOT HERE: `idFor` and `rollRoster`, the birth identity
// roll. The roll decides which of these an agent wears for life, it is the
// identity tree's to port, and it belongs next to whatever ends up owning birth
// on the server. This module is only the two palettes, because the draft's
// forming stages (DRAFT_STAGES in components/system/FormingGhost.jsx) name
// HOODS[1] and GLOWS[1] directly and a hex literal copied out of a ref is the
// thing that drifts the next time the ref is relit.

/** Six hoods. The index is the roll's, so the order is part of the contract. */
export const HOODS = [
  { id: 'ash',     name: 'ASH',     top: '#5A5F63', bot: '#383C40' },
  { id: 'oxblood', name: 'OXBLOOD', top: '#5E2027', bot: '#361216' },
  { id: 'moss',    name: 'MOSS',    top: '#2E4E37', bot: '#182C20' },
  { id: 'indigo',  name: 'INDIGO',  top: '#4A2E78', bot: '#281846' },
  { id: 'sand',    name: 'SAND',    top: '#6E5836', bot: '#413320' },
  { id: 'slate',   name: 'SLATE',   top: '#33526B', bot: '#1B2E3D' },
];

/** Six glows. Same rule about the index. */
export const GLOWS = [
  { id: 'teal',   name: 'TEAL',   c: '#3FB6A8' },
  { id: 'gold',   name: 'GOLD',   c: '#C9A227' },
  { id: 'ember',  name: 'EMBER',  c: '#D2632F' },
  { id: 'violet', name: 'VIOLET', c: '#8B6BC4' },
  { id: 'ice',    name: 'ICE',    c: '#7FA8C9' },
  { id: 'lime',   name: 'LIME',   c: '#8FB03F' },
];
