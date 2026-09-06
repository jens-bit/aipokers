// WATCH v4 — the bubble.
// Port of design-refs/mood-watch4.jsx Bubble.
//
// "v4 put his voice in a panel under the felt. Right instinct, wrong place: a
// feed is a log you read, and what an owner wants is to watch someone talk."
//
// Two registers, one shape. HIS is teal-edged and carries his 13px voice; an
// opponent's is neutral and quieter, because table talk is background until it
// isn't. The tail points down at whoever said it — that is the entire mechanism
// by which you know who is speaking.
// WATCH-10 job 2 · `side`. An opponent's bubble is no longer pinned to a corner
// of the felt: it opens LEFT or RIGHT of the seat that said it, whichever side
// is clear (lib/feltBubbles.js). The tail then belongs to the NEAR EDGE rather
// than to an offset measured from a felt-wide clamp, so when a side is given
// the tail is left to the stylesheet — an inline `left` would win against it,
// which is what used to put the tail 10px from the left of every bubble
// whichever way it was facing.
export function Bubble({ text, mine, at, top, w = 142, felt = 390, flow, side = null }) {
  // An opponent's bubble is placed over its own ghost and clamped inside the
  // felt; the tail then points back at the seat even when the box was pushed in
  // from the edge. His is centred in the band the column reserves for him.
  const left = mine ? null : Math.max(8, Math.min(felt - w - 8, at - w / 2));
  const tail = mine ? null : Math.max(10, Math.min(w - 10, at - left));

  const style = flow
    ? { position: 'relative', maxWidth: 320 }
    : {
      position: 'absolute',
      top,
      ...(mine ? { left: at, transform: 'translateX(-50%)' } : { left }),
      width: mine ? 'auto' : w,
      maxWidth: mine ? 320 : w,
    };

  return (
    <div className={`bubble${mine ? ' bubble--mine' : ''}${side ? ` bubble--${side}` : ''}`} style={style}>
      <div className="bubble__box">{mine ? text : `“${text}”`}</div>
      <div
        className="bubble__tail"
        style={(mine || side) ? undefined : { left: tail }}
        aria-hidden
      />
    </div>
  );
}
