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
export function Bubble({ text, mine, at, top, w = 142, felt = 390, flow }) {
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
    <div className={`bubble${mine ? ' bubble--mine' : ''}`} style={style}>
      <div className="bubble__box">{mine ? text : `“${text}”`}</div>
      <div
        className="bubble__tail"
        style={mine ? undefined : { left: tail }}
        aria-hidden
      />
    </div>
  );
}
