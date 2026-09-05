// F-2 — the fold. The whole point is that it is closed.
// Port of design-refs/mood-birth3.jsx SheetFold.
//
// Finding 2 of wave 34: the birth card led with six attribute bars, and READS /
// FOCUS / DISCIPLINE mean nothing to someone who has owned an agent for four
// seconds. The card is now about HIM; the numbers are a drawer, and on a first
// agent the drawer is never open.
export function SheetFold({ open, onToggle }) {
  return (
    <button
      type="button"
      className={`sheet-fold${open ? ' is-open' : ''}`}
      onClick={onToggle}
      aria-expanded={!!open}
    >
      <span className="sheet-fold__label">His sheet</span>
      <span className="sheet-fold__note">
        {open ? 'SIX ATTRIBUTES · THEY GROW' : 'IF YOU WANT THE NUMBERS'}
      </span>
      <svg
        className="sheet-fold__chev"
        width="15" height="15" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        aria-hidden
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </button>
  );
}
