// System components — shared atoms for the mood-wave design.
// system.css must be imported by the app's main stylesheet.

export { PlayingCard, CardBack, parseCard } from './PlayingCard.jsx';
export { MoodGhost } from './MoodGhost.jsx';
export { MoodBand } from './MoodBand.jsx';
export { LiveBar } from './LiveBar.jsx';
export { SeatChip } from './SeatChip.jsx';

// Character system (ATTR-2). Styles live in styles/attributes.css.
export { AttrTrack, AttrBar } from './AttrBar.jsx';
export { AttrCluster, AttrSpark, AttrFocusPanel } from './AttrCluster.jsx';
export {
  FatigueLine, GrowthTick, GrowthLine, TrainingLine,
  GrewBadge, NatureChip, NatureFormingChip,
} from './CharacterAtoms.jsx';

// Floor atoms re-exported for convenience so consumers have a single import path.
export { MoodChip, StateTag, PotTicker } from '../floor/atoms.jsx';
