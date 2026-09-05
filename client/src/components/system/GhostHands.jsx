// THE HANDS — port of design-refs/mood-atoms.jsx `ghostHands` (wave-42).
//
// Two small detached hands, no arms, hovering where a wrist would be. They are
// BODY LANGUAGE AT TABLE SCALE — what he is doing with the hand — while the face
// stays the emotional readout. The split matters: a face can only be read at 34px
// and above, but a hand pushing a stack forward reads at 20.
//
// EIGHT POSES AND NO MORE. Each is a fixed arrangement; nothing is procedural, so
// nothing can drift into a ninth pose by accident.
const HAND_INK = '#1E2732';
const HAND_W = 9.6;

// Detail drops with size exactly as the face's does: below seat scale the
// fingers are sub-pixel, so the hand becomes a plain mitten rather than a smudge.
export function handDetail(size) { return size >= 72 ? 2 : size >= 34 ? 1 : 0; }

export var HAND_POSES = ['rest', 'hold', 'peek', 'push', 'toss', 'drum', 'clench', 'cover'];

function Mitten({ x, y, r = 0, s = 1, d = 1, clenched, ink = HAND_INK }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      {clenched
        ? <circle cx="0" cy="0" r={HAND_W * 0.46} fill={ink} />
        : (
          <>
            {d > 0 && [-2.9, 0, 2.9].map((fx) => (
              <circle key={fx} cx={fx} cy={-2.4} r={d > 1 ? 2.0 : 2.3} fill={ink} />
            ))}
            <rect x={-HAND_W / 2} y={-2.6} width={HAND_W} height="6.4" rx="2.8" fill={ink} />
          </>
        )}
    </g>
  );
}

// The stack height IS the bet band — small / mid / big, and nothing between.
function Chips({ x, y, n = 4, ink = HAND_INK }) {
  return (
    <g>
      {Array.from({ length: n }).map((_, i) => (
        <ellipse key={i} cx={x} cy={y - i * 1.5} rx="4.2" ry="1.6"
          fill={i === n - 1 ? '#2A3542' : ink}
          stroke="rgba(255,255,255,0.07)" strokeWidth="0.4" />
      ))}
    </g>
  );
}

function MiniBack({ x, y, r = 0, s = 1 }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <rect x="-3.4" y="-4.8" width="6.8" height="9.6" rx="1.2" fill="#16202B"
        stroke="rgba(0,212,170,0.28)" strokeWidth="0.5" />
    </g>
  );
}

export function ghostHands({ pose = 'rest', size = 40, bet = 'mid', won }) {
  const d = handDetail(size);
  const n = bet === 'small' ? 2 : bet === 'big' ? 7 : 4;

  if (pose === 'hold') return (
    <g data-pose="hold">
      <MiniBack x="35" y="63" r={-7} /><MiniBack x="45" y="63" r={7} />
      <Mitten x="27.5" y="65" r={-12} d={d} />
      <Mitten x="52.5" y="65" r={12} d={d} />
    </g>
  );
  if (pose === 'peek') return (
    <g data-pose="peek">
      <MiniBack x="34" y="63" r={-6} />
      <MiniBack x="45" y="55" r={26} s={0.95} />
      <Mitten x="26.5" y="65" r={-12} d={d} />
      <Mitten x="50" y="50" r={38} d={d} />
    </g>
  );
  if (pose === 'push') return (
    <g data-pose="push">
      <Chips x="40" y="55" n={n} />
      <Mitten x="31" y="60" r={-20} d={d} />
      <Mitten x="49" y="60" r={20} d={d} />
    </g>
  );
  if (pose === 'toss') return (
    <g data-pose="toss">
      <MiniBack x="60" y="46" r={-38} s={0.9} />
      <MiniBack x="66" y="42" r={-52} s={0.86} />
      <Mitten x="27" y="64" r={-10} d={d} />
      <Mitten x="54" y="52" r={-42} d={d} />
    </g>
  );
  if (pose === 'drum') return (
    <g data-pose="drum">
      <Mitten x="24" y="66" r={-6} d={d} />
      <Mitten x="56" y="63" r={8} d={d} />
      {d > 0 && [50, 58].map((tx, i) => (
        <ellipse key={tx} cx={tx} cy="70" rx="2.2" ry="0.7" fill="rgba(255,255,255,0.10)" opacity={i ? 0.5 : 1} />
      ))}
    </g>
  );
  if (pose === 'clench') return (
    <g data-pose="clench">
      <Mitten x="24" y="62" clenched />
      <Mitten x="56" y="62" clenched />
    </g>
  );
  // "both hands over the face — on a win, one rakes instead"
  if (pose === 'cover') return won ? (
    <g data-pose="cover">
      <Chips x="46" y="58" n={5} />
      <Mitten x="52" y="62" r={26} d={d} />
      <Mitten x="24" y="65" r={-8} d={d} />
    </g>
  ) : (
    <g data-pose="cover">
      <Mitten x="32" y="43" r={-16} s={1.05} d={d} />
      <Mitten x="48" y="43" r={16} s={1.05} d={d} />
    </g>
  );
  return (
    <g data-pose="rest" className="ghost-hands--rest">
      <Mitten x="20" y="60" r={-8} d={d} />
      <Mitten x="60" y="60" r={8} d={d} />
    </g>
  );
}
