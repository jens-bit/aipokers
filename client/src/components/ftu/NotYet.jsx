// FTU-1 — the empty-state grammar, as one component.
// Port of NotYet from design-refs/mood-ftu2.jsx.
//
// THE RULE THIS EXISTS TO ENFORCE: an empty state is a room that breathes, not
// a placeholder sentence. There is no "No agents yet", no "No hands to show",
// no illustrated void with a caption. Nothing is missing — something has simply
// not happened yet, and the screen says which thing, in the voice of whoever
// would know: the room, the recruiter, or him.
//
// Three parts, always in this order:
//   fact   what has not happened, in mono, small, as a fact
//   voice  who says so — his line, or the room's
//   fills  what would fill it
//
// Never an icon, never a centred illustration, never the word "empty".
//
// Styles in styles/ftu.css.

export function NotYet({ fact, voice, fills, tone = 'muted' }) {
  return (
    <div className={`not-yet not-yet--${tone}`}>
      <span className="not-yet__fact">{fact}</span>
      {voice && <div className="not-yet__voice">“{voice}”</div>}
      {fills && <div className="not-yet__fills">{fills}</div>}
    </div>
  );
}
