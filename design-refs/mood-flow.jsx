// 10 FLOW MAP — every screen and the routes between them.
// Node geometry is declared once; edge paths are computed from the same numbers.
// Corridors are declared per-edge and dodge every node box.

const FLOW_W = 1180, FLOW_H = 824;
const NW = 176, NH = 84;

const NODES = {
  ftu:      { x: 40,  y: 60,  n: '08', t: 'Floor · first run', s: 'one dashed barstool', kind: 'tab' },
  chats:    { x: 40,  y: 250, n: '01–05', t: 'Casino floor', s: 'five density states', kind: 'tab' },
  idle:     { x: 320, y: 250, n: '06/07', t: 'Agent zoom', s: 'bubble · mood · actions', kind: 'full' },
  live:     { x: 600, y: 250, n: '14', t: 'Thread', s: 'ONE screen, five states', kind: 'thread' },
  table:    { x: 880, y: 250, n: '15', t: 'Full table', s: 'full · half · strip', kind: 'full' },
  returned: { x: 320, y: 430, n: '10', t: 'Chats', s: 'thread list', kind: 'tab' },
  review:   { x: 600, y: 430, n: '16', t: 'Hand review', s: 'street-by-street sheet', kind: 'sheet' },
  team:     { x: 40,  y: 610, n: '12', t: 'You', s: 'balance · replays', kind: 'tab' },
  sheet:    { x: 320, y: 610, n: '11', t: 'Agent profile', s: 'career · mood timeline', kind: 'sheet' },
  you:      { x: 600, y: 610, n: '09', t: 'Mood postures', s: 'body-language spec', kind: 'ref' },
  moods:    { x: 880, y: 610, n: '13', t: 'Mood sheet', s: 'reference artifact', kind: 'ref' },
};

const anchor = (b, side) => {
  if (side === 'r') return [b.x + NW, b.y + NH / 2];
  if (side === 'l') return [b.x, b.y + NH / 2];
  if (side === 't') return [b.x + NW / 2, b.y];
  return [b.x + NW / 2, b.y + NH];
};

const routePath = (from, fs, to, ts, pts) => {
  const [x1, y1] = anchor(NODES[from], fs);
  const [x2, y2] = anchor(NODES[to], ts);
  if (pts && pts.length) {
    return `M ${x1} ${y1} ` + pts.map(p => `L ${p[0]} ${p[1]}`).join(' ') + ` L ${x2} ${y2}`;
  }
  // same-side return: step clear of the box edge before the horizontal run
  if (fs === ts && (fs === 'b' || fs === 't')) {
    const off = fs === 'b' ? Math.max(y1, y2) + 28 : Math.min(y1, y2) - 28;
    return `M ${x1} ${y1} L ${x1} ${off} L ${x2} ${off} L ${x2} ${y2}`;
  }
  if ((fs === 'r' && ts === 'l') || (fs === 'l' && ts === 'r')) {
    if (Math.abs(y1 - y2) < 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
    const mx = (x1 + x2) / 2;
    return `M ${x1} ${y1} L ${mx} ${y1} L ${mx} ${y2} L ${x2} ${y2}`;
  }
  if (Math.abs(x1 - x2) < 2) return `M ${x1} ${y1} L ${x2} ${y2}`;
  const my = (y1 + y2) / 2;
  return `M ${x1} ${y1} L ${x1} ${my} L ${x2} ${my} L ${x2} ${y2}`;
};

// Clear corridors, from node occupancy:
//   vertical bands   x 216–320 · 496–600 · 776–880 · >1056
//   horizontal bands y 144–250 · 334–430 · 514–610 · >694
const EDGES = [
  { from: 'ftu', fs: 'b', to: 'chats', ts: 't', kind: 'fwd', label: 'first ghost drafted' },
  { from: 'chats', fs: 'r', to: 'idle', ts: 'l', kind: 'fwd', label: 'tap an agent' },
  { from: 'idle', fs: 'r', to: 'live', ts: 'l', kind: 'fwd', label: 'CHAT' },
  { from: 'live', fs: 'r', to: 'table', ts: 'l', kind: 'fwd', label: 'tap the live bar' },
  { from: 'table', fs: 'b', to: 'live', ts: 'b', kind: 'back', label: 'back' },
  { from: 'chats', fs: 'b', to: 'returned', ts: 't', kind: 'tabs', label: 'tab bar' },
  { from: 'live', fs: 'b', to: 'review', ts: 't', kind: 'fwd', label: 'flagged chip' },
  { from: 'returned', fs: 'r', to: 'review', ts: 'l', kind: 'fwd', label: 'flagged chip' },
  { from: 'review', fs: 'r', to: 'live', ts: 'r', kind: 'back', label: 'discuss',
    pts: [[828, 472], [828, 372], [828, 292]] },
  { from: 'chats', fs: 'b', to: 'team', ts: 't', kind: 'tabs', label: 'tab bar' },
  // masthead CTA — the third declared route into review
  { from: 'chats', fs: 'b', to: 'review', ts: 'l', kind: 'fwd', label: 'masthead CTA',
    pts: [[128, 380], [560, 380], [560, 472]], lx: 344, ly: 380 },
  { from: 'idle', fs: 'b', to: 'sheet', ts: 't', kind: 'fwd', label: 'PROFILE',
    pts: [[408, 380], [560, 380], [560, 566], [408, 566]], lx: 560, ly: 470 },
  { from: 'sheet', fs: 'r', to: 'review', ts: 'b', kind: 'fwd', label: 'flagged', lx: 560, ly: 566 },
  { from: 'chats', fs: 'b', to: 'team', ts: 't', kind: 'tabs', label: 'tab bar' },
  // WATCH on a live agent's zoom goes straight to the table, over the top band
  { from: 'idle', fs: 'r', to: 'table', ts: 't', kind: 'fwd', label: 'WATCH',
    pts: [[548, 292], [548, 200], [968, 200]], lx: 760, ly: 200 },
];

const KIND_STYLE = {
  tab:    { border: M_TEAL, bg: 'rgba(0,212,170,0.06)', tag: 'TAB' },
  thread: { border: 'rgba(255,255,255,0.14)', bg: '#131316', tag: 'THREAD' },
  full:   { border: M_PURPLE, bg: 'rgba(155,123,255,0.06)', tag: 'FULL' },
  sheet:  { border: M_GOLD, bg: 'rgba(205,179,128,0.05)', tag: 'SHEET' },
  ref:    { border: M_GOLD, bg: 'rgba(205,179,128,0.06)', tag: 'REF' },
};

const FlowNode = ({ id }) => {
  const b = NODES[id];
  const k = KIND_STYLE[b.kind];
  return (
    <div style={{
      position: 'absolute', left: b.x, top: b.y, width: NW, height: NH,
      background: k.bg, border: `1px solid ${k.border}`, borderRadius: 12,
      padding: '11px 13px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
        <Num size={10} weight={700} color={k.border}>{b.n}</Num>
        <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: k.border, padding: '2px 5px', border: `1px solid ${k.border}55`, borderRadius: 3 }}>{k.tag}</span>
      </div>
      <div style={{ fontFamily: PLAYFAIR, fontSize: 15.5, fontWeight: 600, color: M_TEXT, lineHeight: 1.15 }}>{b.t}</div>
      <div style={{ fontSize: 11, color: M_MUTED, marginTop: 3, lineHeight: 1.3 }}>{b.s}</div>
    </div>
  );
};

const FlowMap = () => (
  <div style={{
    position: 'relative', width: FLOW_W, height: FLOW_H,
    background: M_BG, border: `1px solid ${M_BORDER_2}`, borderRadius: 16,
    fontFamily: INTER, overflow: 'hidden',
  }}>
    {/* artboard holds nodes and edges only — no cards inside the routed field */}
    <svg width={FLOW_W - 2} height={FLOW_H - 2} style={{ position: 'absolute', inset: 0 }}>
      <defs>
        <marker id="flowArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill={M_TEAL}/>
        </marker>
        <marker id="flowArrowBack" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill={M_MUTED}/>
        </marker>
        <marker id="flowArrowTab" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
          <path d="M 0 1 L 9 5 L 0 9 z" fill={M_FAINT}/>
        </marker>
      </defs>
      {EDGES.map((e, i) => {
        const d = routePath(e.from, e.fs, e.to, e.ts, e.pts);
        const stroke = e.kind === 'fwd' ? M_TEAL : e.kind === 'back' ? M_MUTED : M_FAINT;
        const marker = e.kind === 'fwd' ? 'flowArrow' : e.kind === 'back' ? 'flowArrowBack' : 'flowArrowTab';
        return (
          <path key={i} d={d} fill="none" stroke={stroke} strokeWidth="1.4"
            strokeDasharray={e.kind === 'fwd' ? 'none' : '4,4'}
            markerEnd={`url(#${marker})`} opacity={e.kind === 'fwd' ? 0.9 : 0.6}/>
        );
      })}
    </svg>

    {Object.keys(NODES).map(id => <FlowNode key={id} id={id}/>)}

    {EDGES.filter(e => e.kind === 'fwd').map((e, i) => {
      const [x1, y1] = anchor(NODES[e.from], e.fs);
      const [x2, y2] = anchor(NODES[e.to], e.ts);
      const lx = e.lx !== undefined ? e.lx : (x1 + x2) / 2;
      const ly = e.ly !== undefined ? e.ly : (y1 + y2) / 2;
      return (
        <div key={i} style={{
          position: 'absolute', left: lx, top: ly,
          transform: 'translate(-50%, -50%)',
          background: M_BG, padding: '2px 6px', borderRadius: 4,
          fontFamily: MONO, fontSize: 9, color: M_TEAL, letterSpacing: '0.06em', whiteSpace: 'nowrap',
        }}>{e.label}</div>
      );
    })}

    {/* legend — below every node row and every routed corridor */}
    <div style={{ position: 'absolute', left: 40, top: 752, display: 'flex', gap: 16, alignItems: 'center' }}>
      {[
        { c: M_TEAL, l: 'forward', dash: false },
        { c: M_MUTED, l: 'back', dash: true },
        { c: M_FAINT, l: 'tab switch', dash: true },
      ].map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <svg width="26" height="6"><line x1="0" y1="3" x2="26" y2="3" stroke={s.c} strokeWidth="1.4" strokeDasharray={s.dash ? '4,4' : 'none'}/></svg>
          <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, letterSpacing: '0.06em' }}>{s.l}</span>
        </div>
      ))}
    </div>
  </div>
);

Object.assign(window, { FlowMap });
