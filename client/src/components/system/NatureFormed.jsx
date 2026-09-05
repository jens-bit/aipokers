// F-1 — the forming chip, reading the real nature.
// Port of design-refs/mood-flow2.jsx NatureFormed.
//
// It was hardcoded and dashed. It now reads the nature the brief actually
// implies — PACE-1d computes it from the very dials shown next to it, so the
// two can never disagree — and stops being a guess once the draft is ready:
// FORMING · ROCK? becomes ROCK, with its zero-sum pair.
//
// A nature is still never invented here. `name` only ever comes from the
// server's natureHint; with nothing hinted this renders the neutral forming
// chip, which is what NatureFormingChip has always done.
import { NATURES } from '../../lib/attributes.js';
import { NatureChip, NatureFormingChip } from './CharacterAtoms.jsx';

// The zero-sum pair belongs to the nature's name, so the server sending a name
// is enough — it does not have to send the pair as well.
export function pairFor(name) {
  if (!name) return null;
  const match = NATURES.find((n) => n.name.toLowerCase() === String(name).toLowerCase());
  return match ? { name: match.name, up: match.up, down: match.down } : null;
}

export function NatureFormed({ name, formed }) {
  if (!name) return <NatureFormingChip />;

  // Still a guess: the ladder has an opinion but the draft is not usable yet.
  if (!formed) {
    return (
      <span className="nature-formed nature-formed--guess">
        <span className="nature-formed__label">Forming</span>
        <span className="nature-formed__rule" />
        <span className="nature-formed__guess">{name}?</span>
      </span>
    );
  }

  const pair = pairFor(name);
  return pair ? <NatureChip nature={pair} size="l" /> : <NatureFormingChip guess={name} />;
}
