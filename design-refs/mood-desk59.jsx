// ═════════════════════════════════════════════════════════════════
// DESKTOP, AS ITS OWN DESIGN · wave 58 addendum
//
// Everything before this was parity: the phone's composition at 1.34×, with the
// bottom sheet moved into a rail. That is a port, and it wastes the two things a
// desktop actually has — width, and a pointer.
//
// So the composition is different. Three columns, always open, nothing sliding over
// anything: ROSTER on the left (who you have, where each one is), the ROOM in the
// centre drawn larger and with more of the flat visible, and the THREAD on the right
// with the composer under it. A sheet is not a sheet here; it is the right column
// changing what it holds. And because there is a pointer, HOVER does the work that a
// tap does on the phone: hovering a body shows his pill and bars, hovering a fixture
// shows one line, clicking opens it in the right column.
//
// Same glass, same identity roll, same laws. Different composition.
// ═════════════════════════════════════════════════════════════════

const DW = { roster: 250, thread: 380 };
const DK_H = { pad: 54 };   // the one bar: title left, net right

// widths at 1440 and 1920 — the centre takes everything the columns do not
const stageW = w => w - DW.roster - DW.thread;

const DkShell = ({ w = 1440, h = 900, children }) => (
  <div style={{ width: w, height: h, display: 'flex', flexDirection: 'column', background: M_BG, fontFamily: INTER, overflow: 'hidden', border: `1px solid ${M_BORDER}`, borderRadius: 8 }}>
    {children}
  </div>
);

// ── the one bar ──────────────────────────────────────────────────────────
const DkBar = ({ title = 'The flat', sub = '3 home · 1 at the casino', net = '+$1,290', wide }) => (
  <div style={{ flexShrink: 0, height: DK_H.pad, display: 'flex', alignItems: 'center', gap: 14, padding: `0 ${wide ? 26 : 18}px`, borderBottom: `1px solid ${M_BORDER}`, background: '#0C1111' }}>
    <SpadeLogo/>
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: PLAYFAIR, fontSize: wide ? 18 : 16, fontWeight: 600, color: M_TEXT, lineHeight: 1.25, whiteSpace: 'nowrap' }}>{title}</div>
      <div style={{ fontSize: 10.5, color: M_MUTED }}>{sub}</div>
    </div>
    <div style={{ flex: 1 }}/>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px', borderRadius: 9, border: `1px solid ${M_TEAL}44`, background: `${M_TEAL}0F` }}>
      <Lbl size={8.5}>Tonight</Lbl><Num size={13} weight={700} color={M_TEAL}>{net}</Num>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 8px', borderRadius: 9, border: `1px solid ${M_BORDER}`, cursor: 'pointer' }}>
      <div style={{ width: 22, height: 22, borderRadius: 11, background: `${M_GOLD}26`, border: `1px solid ${M_GOLD}66`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: OSWALD, fontSize: 9, fontWeight: 600, color: M_GOLD }}>J</div>
      <span style={{ fontSize: 11.5, color: M_DIM }}>Jens</span>
    </div>
  </div>
);

// ── LEFT · the roster, permanently open ──────────────────────────────────
const DK_ROSTER = [
  { id: 'bal', name: 'Balanced v2.1', where: 'AT THE CASINO', c: M_TEAL,  line: '25/50 · +$340 · 41 min', st: 88, ht: 22, live: true },
  { id: 'agg', name: 'Aggressive v1.3', where: 'PACING',      c: M_RED,   line: 'wants back in at 25/50', st: 62, ht: 78, unread: true },
  { id: 'blf', name: 'Bluff Master',  where: 'AT THE FRIDGE',  c: M_MUTED, line: 'fetching a beer',        st: 70, ht: 24, sel: true },
  { id: 'val', name: 'Value Bot',     where: 'ASLEEP',         c: M_MUTED, line: 'worn — 340 hands today', st: 18, ht: 12 },
];

const DkRosterRow = ({ r, hover }) => {
  const id = idFor(r.id);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${M_BORDER}`, cursor: 'pointer',
      background: r.sel ? 'rgba(255,255,255,0.055)' : hover ? 'rgba(255,255,255,0.03)' : 'transparent',
      boxShadow: r.sel ? `inset 2px 0 0 ${M_TEAL}` : 'none' }}>
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <MoodGhost mood={r.ht > 70 ? 'tilted' : r.st < 25 ? 'sulking' : 'confident'} size={38} ring={false} hood={id.hood} glow={id.glow.c}/>
        {r.unread && <span style={{ position: 'absolute', top: -1, right: -3, width: 9, height: 9, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 6px ${M_GOLD}`, border: '1.5px solid #0E1413' }}></span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
          <span style={{ fontSize: 12, color: M_TEXT, fontWeight: 600 }}>{pillName(r.name)}</span>
          {r.live && <LiveDot size={5}/>}
          <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.13em', color: r.c }}>{r.where}</span>
        </div>
        <div style={{ fontSize: 10, color: M_MUTED, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.line}</div>
        <div style={{ marginTop: 5 }}><ResourceBars stamina={r.st} heat={r.ht} w={120} h={2.5} gap={2.5}/></div>
      </div>
    </div>
  );
};

const DkRoster = ({ hover }) => (
  <div style={{ width: DW.roster, flexShrink: 0, borderRight: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px 10px', borderBottom: `1px solid ${M_BORDER}` }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: M_TEAL }}>YOUR AGENTS</span>
      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 9, color: M_MUTED }}>4 of 4</span>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {DK_ROSTER.map((r, i) => <DkRosterRow key={r.id} r={r} hover={hover === i}/>)}
      {/* the fifth chair, as a row rather than a sheet: there is column for it */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px', borderBottom: `1px solid ${M_BORDER}`, cursor: 'pointer' }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, border: `1px dashed ${M_TEAL}66`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={M_TEAL} strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 11.5, color: M_TEAL }}>Draft another</div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, marginTop: 1.5 }}>5th seat · 250,000 won</div>
        </div>
      </div>
    </div>
  </div>
);

// ── RIGHT · the thread, or whatever the pointer opened instead ───────────
const DkRight = ({ title = 'Bluff', sub = 'AT THE FRIDGE', close, children, composer = true }) => (
  <div style={{ width: DW.thread, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: 'rgba(14,20,19,0.97)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 15px 10px', borderBottom: `1px solid ${M_BORDER}` }}>
      <span style={{ fontFamily: PLAYFAIR, fontSize: 14, fontWeight: 600, color: M_TEXT }}>{title}</span>
      <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED }}>{sub}</span>
      {close && <span style={{ marginLeft: 'auto', cursor: 'pointer' }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></span>}
    </div>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</div>
    {composer && (
      <div style={{ flexShrink: 0, padding: '11px 15px 14px', borderTop: `1px solid ${M_BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: 38, borderRadius: 19, border: `1px solid ${M_BORDER}`, background: 'rgba(255,255,255,0.035)', padding: '0 6px 0 14px' }}>
          <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>Say something to Bluff…</span>
          <span style={{ width: 28, height: 28, borderRadius: 14, background: `${M_TEAL}26`, border: `1px solid ${M_TEAL}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 20 20"><path d="M2 10L18 3L11 18L9.4 11.6L2 10Z" fill="none" stroke={M_TEAL} strokeWidth="1.5" strokeLinejoin="round"/></svg>
          </span>
        </div>
      </div>
    )}
  </div>
);

const DK_TALK = [
  { who: 'BLUFF', c: M_GOLD, t: 'Got a minute? That last hour was something.', at: '23:14' },
  { who: 'YOU',   c: M_TEAL, t: 'Go on.', at: '23:14' },
  { who: 'BLUFF', c: M_GOLD, t: 'Granite called my third barrel with king high. King high.', at: '23:15' },
  { who: 'BLUFF', c: M_GOLD, t: 'I have decided I do not like Granite.', at: '23:15' },
  { who: 'YOU',   c: M_TEAL, t: 'Take the night off.', at: '23:16' },
  { who: 'BLUFF', c: M_GOLD, t: 'No. Get me a beer and put me back in.', at: '23:16' },
];

const DkTalk = () => (
  <div style={{ padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 11 }}>
    {DK_TALK.map((l, i) => (
      <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: l.who === 'YOU' ? 'flex-end' : 'flex-start', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: MONO, fontSize: 8, fontWeight: 700, color: l.c }}>{l.who}</span>
          <span style={{ fontFamily: MONO, fontSize: 8, color: M_MUTED }}>{l.at}</span>
        </div>
        <div style={{ maxWidth: 290, padding: '8px 12px', borderRadius: 12, background: l.who === 'YOU' ? `${M_TEAL}1C` : V5GLASS.raised, border: `1px solid ${l.who === 'YOU' ? `${M_TEAL}4D` : V5GLASS.edge}`, fontSize: 12, color: l.who === 'YOU' ? M_TEXT : M_DIM, lineHeight: 1.45 }}>{l.t}</div>
      </div>
    ))}
  </div>
);

// ── CENTRE · the flat, drawn from further back ───────────────────────────
// The phone crops the flat to the walls it can afford. Desktop is standing further
// away in the same room: the same fixtures on the same walls, plus the floor either
// side of them that the phone has to cut. It is not the phone frame scaled up — the
// coordinate space is wider, so the furniture sits in a room rather than filling one.
const DkFlat = ({ children, w, h = 900, hover, lit = true }) => {
  // 560 × 700 is the flat's design size; above k = 1 the furniture would be further
  // apart than the walls, so extra window becomes margin rather than a bigger room.
  const k = Math.min(1.4, (w - 60) / 560, (h - DK_H.pad - 40) / 700);
  return (
    <div style={{ flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: '#0A0F0E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* the room, wider than the phone's: 560 of floor instead of 390 */}
      <div style={{ width: 560 * k, height: 700 * k, position: 'relative', overflow: 'hidden', borderRadius: 5, boxShadow: '0 30px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ width: 560, height: 700, transform: `scale(${k})`, transformOrigin: '0 0', position: 'relative', background: 'radial-gradient(ellipse at 50% 54%, #1E2725 0%, #151D1B 58%, #0E1413 100%)', filter: lit ? 'none' : 'brightness(0.72) saturate(0.85)' }}>
          {/* floorboards across the wider floor */}
          {Array.from({ length: 14 }).map((_, i) => (
            <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: 118 + i * 42, height: 1, background: 'rgba(255,255,255,0.025)' }}></div>
          ))}
          {/* the wall the frames hang on, and the side walls the phone cannot show */}
          <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 112, background: 'linear-gradient(180deg, #101616 0%, #131A19 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}></div>
          <div style={{ position: 'absolute', left: 0, top: 112, bottom: 0, width: 10, background: 'linear-gradient(90deg, #131A19 0%, rgba(0,0,0,0.2) 100%)' }}></div>
          <div style={{ position: 'absolute', right: 0, top: 112, bottom: 0, width: 10, background: 'linear-gradient(270deg, #131A19 0%, rgba(0,0,0,0.2) 100%)' }}></div>
          {children}
        </div>
      </div>
      {hover && (
        <div style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', padding: '7px 13px', borderRadius: 9, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, border: `1px solid ${V5GLASS.edgeUp}`, fontSize: 11.5, color: M_DIM, whiteSpace: 'nowrap' }}>
          {hover}
        </div>
      )}
    </div>
  );
};

// the fixtures, at desktop coordinates. Hovering one shows a line; clicking opens it
// in the right column, which is the whole substitution for a bottom sheet.
const DkFixture = ({ x, y, w, h, label, hint, on }) => (
  <div style={{ position: 'absolute', left: x, top: y, width: w, height: h, borderRadius: 4, cursor: 'pointer',
    background: 'linear-gradient(160deg, #23211C 0%, #16150F 100%)',
    border: `1px solid ${on ? M_GOLD : 'rgba(255,255,255,0.1)'}`,
    boxShadow: on ? `0 0 0 3px ${M_GOLD}22, 0 8px 20px rgba(0,0,0,0.55)` : '0 6px 16px rgba(0,0,0,0.5)' }}>
    <div style={{ position: 'absolute', inset: 5, borderRadius: 2, border: `1px solid ${M_GOLD}26` }}></div>
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 6, textAlign: 'center', fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.14em', color: on ? M_GOLD : M_MUTED }}>{label}</div>
    {on && hint && (
      <div style={{ position: 'absolute', left: '50%', top: -30, transform: 'translateX(-50%)', padding: '5px 10px', borderRadius: 8, background: 'rgba(8,12,12,0.95)', border: `1px solid ${M_GOLD}55`, fontSize: 10.5, color: M_TEXT, whiteSpace: 'nowrap' }}>{hint}</div>
    )}
  </div>
);

// a body at desktop scale, with the pill shown only on hover — the room is quiet
// until the pointer asks it something
const DkBody = ({ x, y, id, name, mood = 'confident', size = 62, st = 80, ht = 20, hover, says, prop }) => {
  const i = idFor(id);
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%,-100%)', zIndex: hover ? 30 : 10, cursor: 'pointer' }}>
      {hover && (
        <div style={{ position: 'absolute', left: '50%', bottom: '100%', marginBottom: 5, transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 10px 6px', borderRadius: 9, background: 'rgba(8,12,12,0.94)', border: `1px solid ${M_TEAL}66`, boxShadow: `0 0 18px ${M_TEAL}22`, whiteSpace: 'nowrap' }}>
          <span style={{ fontSize: 10.5, color: M_TEXT }}>{pillName(name)}</span>
          <ResourceBars stamina={st} heat={ht} w={62} h={2.5} gap={2.5}/>
        </div>
      )}
      {says && (
        <div style={{ position: 'absolute', left: '100%', bottom: '46%', marginLeft: 8, padding: '7px 11px', borderRadius: 11, background: V5GLASS.raised, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, border: `1px solid ${V5GLASS.edge}`, fontSize: 11, color: M_DIM, whiteSpace: 'nowrap', zIndex: 4 }}>{says}</div>
      )}
      <MoodGhost mood={mood} size={size} ring={false} hood={i.hood} glow={i.glow.c} hands={prop ? 'hold' : 'rest'}/>
    </div>
  );
};

// the kitchen table, centre of the wider floor
const DkTable = ({ cx = 280, cy = 400, rx = 128, ry = 84, children }) => (
  <>
    <div style={{ position: 'absolute', left: cx - rx, top: cy - ry, width: rx * 2, height: ry * 2, borderRadius: '50%', background: 'radial-gradient(ellipse at 50% 36%, #35443E 0%, #242F2C 68%, #1B2422 100%)', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 14px 34px rgba(0,0,0,0.5)' }}></div>
    <div style={{ position: 'absolute', left: cx, top: cy - 8, transform: 'translate(-50%,-50%)', display: 'flex', gap: 3 }}>
      {[['9', 'h'], ['J', 's'], ['4', 'c']].map((c, i) => <PlayingCard key={i} rank={c[0]} suit={c[1]} w={20} h={28}/>)}
    </div>
    {children}
  </>
);

// ── the flat, as the desktop home ────────────────────────────────────────
const dkRoom = ({ hover }) => (
  <>
    {/* the wall of frames, wider: four hooks fit where the phone shows three */}
    <div style={{ position: 'absolute', left: 24, top: 16, display: 'flex', gap: 10 }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i} style={{ width: 76, height: 62, borderRadius: 3, background: i === 0 ? 'radial-gradient(ellipse at 50% 42%, #2B3C37 0%, #16201E 76%)' : '#0C1110', border: `1px solid ${i === 0 ? `${M_TEAL}44` : 'rgba(255,255,255,0.07)'}`, position: 'relative', overflow: 'hidden' }}>
          {i === 0 ? (
            <>
              <div style={{ position: 'absolute', left: '50%', top: '46%', transform: 'translate(-50%,-50%)', width: 5, height: 5, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 6px ${M_GOLD}` }}></div>
              {[0, 1, 2, 3, 4].map(k => {
                const th = (k / 5) * Math.PI * 2 - Math.PI / 2;
                return <div key={k} style={{ position: 'absolute', left: `${50 + Math.cos(th) * 34}%`, top: `${50 + Math.sin(th) * 38}%`, transform: 'translate(-50%,-50%)' }}><TinyGhost i={k} mine={k === 0}/></div>;
              })}
              <div style={{ position: 'absolute', left: 4, bottom: 3, fontFamily: MONO, fontSize: 7, color: M_TEAL }}>Bal · 25/50 · +$340</div>
            </>
          ) : <div style={{ position: 'absolute', inset: 6, border: '1px solid rgba(255,255,255,0.05)', borderRadius: 2 }}></div>}
        </div>
      ))}
    </div>
    <DkFixture x={24} y={96} w={78} h={62} label="SAFE" hint="$54,000 in the safe" on={hover === 'safe'}/>
    <DkFixture x={452} y={130} w={72} h={112} label="FRIDGE" hint="4 beers · 2 snacks" on={hover === 'fridge'}/>
    <DkFixture x={210} y={604} w={140} h={78} label="THE TV" hint="the casino ticker" on={hover === 'tv'}/>
    {/* the door, in the right wall */}
    <div style={{ position: 'absolute', right: 0, top: 288, width: 34, height: 132, background: 'linear-gradient(90deg, #14120F 0%, #241F1A 100%)', borderTop: '2px solid rgba(255,255,255,0.13)', borderBottom: '2px solid rgba(255,255,255,0.13)', borderLeft: '2px solid rgba(255,255,255,0.13)' }}>
      <div style={{ position: 'absolute', inset: 0, background: `linear-gradient(90deg, transparent 30%, ${M_GOLD}26 100%)` }}></div>
    </div>
    {/* the sign, on the wall above it */}
    <div style={{ position: 'absolute', right: 6, top: 246, display: 'flex', background: 'linear-gradient(180deg, #241D12 0%, #17120B 100%)', border: `1px solid ${M_GOLD}6B`, boxShadow: `0 2px 12px rgba(0,0,0,0.6), inset 0 1px 0 ${M_GOLD}33` }}>
      {[0, 1].map(side => (
        <div key={side} style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-around', padding: '4px 3px', order: side ? 2 : 0 }}>
          {[0, 1, 2].map(i => <span key={i} style={{ width: 2.5, height: 2.5, borderRadius: '50%', background: M_GOLD, boxShadow: `0 0 4px ${M_GOLD}`, animation: `shimmer 2.2s ease-in-out ${(i + side) * 0.35}s infinite` }}></span>)}
        </div>
      ))}
      <div style={{ order: 1, padding: '5px 9px 6px' }}>
        <span style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.2em', color: M_GOLD, textShadow: `0 0 8px ${M_GOLD}88` }}>CASINO</span>
      </div>
    </div>
    {/* the couch, left */}
    <div style={{ position: 'absolute', left: 22, top: 470, width: 112, height: 148, borderRadius: 6, background: 'linear-gradient(160deg, #2A2430 0%, #1A1620 100%)', border: '1px solid rgba(255,255,255,0.07)' }}></div>
    <DkTable/>
    <DkBody x={196} y={370} id="agg" name="Aggressive v1.3" mood="tilted" st={62} ht={78} hover={hover === 'agg'} says={hover === 'agg' ? null : 'Deal it.'} prop/>
    <DkBody x={366} y={378} id="blf" name="Bluff Master" mood="frustrated" size={60} st={70} ht={24} prop/>
    <DkBody x={470} y={276} id="val" name="Value Bot" mood="neutral" size={56} st={34} ht={12}/>
    <DkBody x={78} y={606} id="bal" name="Balanced v2.1" mood="sulking" size={56} st={18} ht={12}/>
  </>
);

const DkHomeScreenM = ({ w = 1440, h = 900 }) => (
  <DkShell w={w} h={h}>
    <DkBar wide={w > 1500}/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DkRoster hover={2}/>
      <DkFlat w={stageW(w)} h={h}/>
      <DkRight><DkTalk/></DkRight>
    </div>
  </DkShell>
);

const DkHomeRoomScreenM = ({ w = 1440, h = 900 }) => (
  <DkShell w={w} h={h}>
    <DkBar wide={w > 1500}/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DkRoster hover={2}/>
      <DkFlat w={stageW(w)} h={h}>{dkRoom({})}</DkFlat>
      <DkRight><DkTalk/></DkRight>
    </div>
  </DkShell>
);

// hover: the body answers, the fixture answers, nothing has been clicked yet
const DkHoverScreenM = ({ w = 1440, h = 900 }) => (
  <DkShell w={w} h={h}>
    <DkBar wide={w > 1500} sub="hovering Aggro"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DkRoster hover={1}/>
      <DkFlat w={stageW(w)} h={h} hover="Aggro · pacing · heat 78 — click to open his thread">{dkRoom({ hover: 'agg' })}</DkFlat>
      <DkRight><DkTalk/></DkRight>
    </div>
  </DkShell>
);

const DkFixtureHoverScreenM = ({ w = 1440, h = 900 }) => (
  <DkShell w={w} h={h}>
    <DkBar wide={w > 1500} sub="hovering the safe"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DkRoster/>
      <DkFlat w={stageW(w)} h={h} hover="The safe · click to open the ledger">{dkRoom({ hover: 'safe' })}</DkFlat>
      <DkRight><DkTalk/></DkRight>
    </div>
  </DkShell>
);

// clicked: the right column holds the safe instead of the thread, until closed
const DkSafeScreenM = ({ w = 1440, h = 900 }) => (
  <DkShell w={w} h={h}>
    <DkBar wide={w > 1500} sub="the safe is open"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DkRoster/>
      <DkFlat w={stageW(w)} h={h} lit={false}>{dkRoom({ hover: 'safe' })}</DkFlat>
      <DkRight title="The safe" sub="$54,000" close composer={false}>
        <div style={{ padding: '14px 15px 0' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.2em', color: M_MUTED }}>IN THE SAFE</div>
            <div style={{ marginTop: 3 }}><Amt size={40} color={M_GOLD}>$54,000</Amt></div>
          </div>
          <div style={{ display: 'flex', gap: 7, paddingTop: 13 }}>
            {SAFE_VERBS.map(v => (
              <div key={v.k} style={{ flex: 1, textAlign: 'center', borderRadius: 10, border: `1px solid ${v.c}4D`, background: `${v.c}0F`, padding: '9px 0 8px', cursor: 'pointer' }}>
                <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: v.c }}>{v.k}</div>
                <div style={{ fontSize: 9.5, color: M_MUTED, marginTop: 2 }}>{v.note}</div>
              </div>
            ))}
          </div>
          {/* on desktop the ledger does not have to be pulled up: there is column
              for it, so tonight and the ledger sit in one scroll */}
          <div style={{ paddingTop: 16 }}>
            <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED, paddingBottom: 7 }}>TONIGHT</div>
            {SAFE_TONIGHT.map(r => (
              <div key={r.k} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '7px 0', borderTop: `1px solid ${M_BORDER}` }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11.5, color: M_TEXT }}>{r.k}</div>
                  <div style={{ fontSize: 10, color: M_MUTED, marginTop: 1.5 }}>{r.note}</div>
                </div>
                <Num size={13} weight={700} color={r.c}>{r.v}</Num>
              </div>
            ))}
          </div>
          <div style={{ paddingTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 6 }}>
              <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.16em', color: M_GOLD }}>THE LEDGER</span>
              <span style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED }}>newest first</span>
            </div>
            {SAFE_LEDGER.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 9, padding: '6px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <span style={{ flexShrink: 0, width: 34, fontFamily: MONO, fontSize: 9.5, color: M_MUTED }}>{r.t}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11, color: M_DIM, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.k}</span>
                <Num size={11} weight={700} color={r.c}>{r.v}</Num>
              </div>
            ))}
          </div>
        </div>
      </DkRight>
    </div>
  </DkShell>
);

Object.assign(window, {
  DW, DK_H, stageW, DkShell, DkBar, DK_ROSTER, DkRosterRow, DkRoster, DkRight, DK_TALK, DkTalk,
  DkFlat, DkFixture, DkBody, DkTable, dkRoom,
  DkHomeScreenM, DkHomeRoomScreenM, DkHoverScreenM, DkFixtureHoverScreenM, DkSafeScreenM,
});
