// WATCH v4 — SeatClock.
// Port of design-refs/mood-watch4.jsx SeatClock.
//
// "Acting is a shape, not a colour." Teal is an accent and one of the House
// regulars wears it, so a role signal cannot live there. The ring IS the clock:
// a faint white circle for "acting", a bright arc on the same radius for the
// time left, and the count in the seat's own chip at mono 9 — never a scaled
// numeral, which would make the seat jump as the seconds tick.
export function SeatClock({ d = 47, left = 9, of = 12 }) {
  const r = (d - 2) / 2;
  const c = 2 * Math.PI * r;
  const frac = of > 0 ? Math.max(0, Math.min(1, left / of)) : 0;

  return (
    <svg
      className="seat-clock"
      width={d}
      height={d}
      viewBox={`0 0 ${d} ${d}`}
      aria-hidden
    >
      <circle cx={d / 2} cy={d / 2} r={r} fill="none" stroke="rgba(237,237,237,0.3)" strokeWidth="1" />
      <circle
        cx={d / 2} cy={d / 2} r={r} fill="none"
        stroke="#EDEDED" strokeWidth="1.6" strokeLinecap="round"
        strokeDasharray={`${(c * frac).toFixed(1)} ${c.toFixed(1)}`}
      />
    </svg>
  );
}
