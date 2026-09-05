// F-1 — the composer's place, taken.
// Port of design-refs/mood-flow2.jsx NextAction.
//
// Finding 1 of wave 34: after a suggestion chip the recruiter said "Let's go"
// and the screen offered nothing to press. The rule this wave adds is that
// every screen in draft -> birth -> floor -> watch has exactly ONE primary
// action, and it names the next screen. Where a composer sits and there is a
// usable brief, the composer gives up its place to that action.
//
// Talking is never taken away: it is demoted to a text link under the button,
// and one tap restores the full composer with the brief intact.
//
// Same border, same background and the same padding rhythm as the composer it
// replaces, so the swap reads as one object changing its mind rather than a new
// bar appearing.
export function NextAction({ label, sub, link = 'or keep describing him', onAct, onLink, busy }) {
  return (
    <div className="next-action">
      {sub && <div className="next-action__sub">{sub}</div>}
      <button
        type="button"
        className="next-action__btn"
        onClick={onAct}
        disabled={busy}
      >
        {label}
      </button>
      <div className="next-action__link-row">
        <button type="button" className="next-action__link" onClick={onLink}>{link}</button>
      </div>
    </div>
  );
}
