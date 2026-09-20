// One set of vector clothes serves both the rack and every companion size.
// It overlays the ghost; it never replaces the hood fill, eyes, or hands.
export function GhostClothes({ equipment = {}, cy = 42 }) {
  return <g className="ghost-clothes" stroke="#292B27" strokeWidth="1.5" strokeLinejoin="round">
    {equipment.head === 'rail-cap' && <g data-item="rail-cap" transform={`translate(0 ${cy - 42})`}>
      <path d="M22 22C23 11 29 7 40 7s17 4 18 15Z" fill="#B3966A"/>
      <path d="M21 21Q39 17 59 21L62 25Q42 29 21 25Z" fill="#786648"/>
      <path d="M40 8v11" fill="none" stroke="#DCC59A"/>
    </g>}
    {equipment.face === 'round-glasses' && <g data-item="round-glasses" fill="none" stroke="#DBC79B" transform={`translate(0 ${cy - 42})`}>
      <circle cx="32" cy="42" r="6.5"/><circle cx="48" cy="42" r="6.5"/>
      <path d="M38.5 41q1.5-2 3 0M25.5 41l-3-2M54.5 41l3-2"/>
    </g>}
    {equipment.neck === 'knit-scarf' && <g data-item="knit-scarf">
      <path d="M24 62Q40 70 56 62L55 69Q40 77 25 69Z" fill="#AF6354"/>
      <path d="M47 69l9-1 2 11-10 0Z" fill="#AF6354"/>
      <path d="M27 66q13 7 26 0M51 72l1 6M55 72l1 6" fill="none" stroke="#D99079" strokeWidth="1"/>
    </g>}
  </g>;
}
export function WardrobeItem({ item }) {
  const views = { head: '16 2 49 32', face: '18 31 44 24', neck: '20 58 42 24' };
  return <svg viewBox={views[item.slot]} width="60" height="40" aria-hidden="true"><GhostClothes equipment={{ [item.slot]: item.id }}/></svg>;
}
