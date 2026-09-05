// DESKTOP PARITY — the audit, the missing states, and one consolidated matrix.
//
// Waves 33–38 were designed mobile-first and each shipped one or two desktop
// screens as proof. This file is the ledger of what that left undrawn, and then
// draws it. Nothing here touches a mobile file, and nothing redesigns the Command
// Center furniture — StandupCard, PGameTile, PComposer and PFlaggedCard are places
// to put things, not things to reopen.

// ── 1 · THE AUDIT ──────────────────────────────────────────────────────────
// EXISTS  = a desktop component already draws this state; named.
// MAPS    = no dedicated screen, but an existing desktop surface carries it
//           without a new component; named.
// MISSING = drawn in this wave.
const AUDIT = [
  { g: 'Watch v4b · W4MatrixM', rows: [
    ['DEAL', 'MISSING', 'D7W4DealScreenM'],
    ['CALM', 'EXISTS', 'D6W4WatchScreenM'],
    ['HEATING', 'MISSING', 'D7W4HeatingScreenM'],
    ['ALL-IN', 'MISSING', 'D7W4AllInScreenM'],
    ['SHOWDOWN', 'EXISTS', 'D6W4ShowdownScreenM'],
    ['SEAT TAPPED', 'EXISTS', 'D6W4ReadScreenM'],
    ['BETWEEN HANDS', 'MISSING', 'D7W4BetweenScreenM'],
  ] },
  { g: 'Pacing + money · WWMatrixM', rows: [
    ['CALM / HEATING / ALL-IN / SHOWDOWN', 'EXISTS', 'superseded by v4b above'],
    ['FUNDED', 'MAPS', 'D3WalletScreenM · PocketRow'],
    ['ALLOWANCE', 'MAPS', 'D3WalletScreenM · FundOption'],
    ['AUTO', 'MAPS', 'D3WalletScreenM · FundOption'],
    ['BROKE', 'MISSING', 'D7WalletBrokeScreenM'],
    ['CUT OFF', 'MISSING', 'D7WalletBrokeScreenM · rail'],
    ['COLLECT', 'MISSING', 'D7CollectScreenM'],
  ] },
  { g: 'Forward motion · Flow34MatrixM', rows: [
    ['BRIEF USABLE', 'EXISTS', 'D4FlowScreenM · NextAction'],
    ['ARRIVING', 'EXISTS', 'D4BirthCardScreenM'],
    ['SHEET FOLD', 'EXISTS', 'D4BirthCardScreenM · SheetFold'],
    ['ROOM LIVE', 'EXISTS', 'D4Floor2ScreenM'],
    ['ROOM RESTING', 'MISSING', 'D7FloorRestingScreenM'],
    ['HAS NEWS', 'MAPS', 'D4Floor2ScreenM · RestPip + rail list'],
  ] },
  { g: 'First five minutes · FtuMatrixM', rows: [
    ['NO AGENTS', 'EXISTS', 'D5FtuEmptyScreenM'],
    ['NO BRIEF', 'MISSING', 'D7FtuDraftScreenM'],
    ['NO HANDS YET', 'MAPS', 'D7FloorRestingScreenM · dashed felt rim'],
    ['NO READS YET', 'EXISTS', 'D5FtuFirstHandScreenM'],
    ['NO FLAGGED HANDS', 'MISSING', 'D7FtuRecapScreenM'],
    ['NOTHING STAKED', 'MISSING', 'D7WalletBrokeScreenM · pocket bar empty'],
    ['NO HISTORY', 'MISSING', 'D7FtuRecapScreenM · rail'],
  ] },
  { g: 'New in this wave', rows: [
    ['HEAT 0–100 (MOOD-2)', 'MISSING', 'DeskHeatGhost · D7HeatScreenM'],
    ['BIOGRAPHY PIP on a seat', 'EXISTS', 'DeskSeat · history'],
    ['BIOGRAPHY on the read rail', 'MISSING', 'D7HeatScreenM · rail'],
    ['BUBBLE LAW at 852px', 'MISSING', 'stated below · max three'],
  ] },
];

const auditTally = () => {
  const t = { EXISTS: 0, MAPS: 0, MISSING: 0 };
  AUDIT.forEach(g => g.rows.forEach(([, status]) => { t[status] += 1; }));
  t.TOTAL = t.EXISTS + t.MAPS + t.MISSING;
  return t;
};

// the doc panel is plain HTML, so it takes its figures from here rather than
// restating them — a hardcoded summary is a second source of truth
const publishTally = () => {
  const t = auditTally();
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('auditExists', t.EXISTS);
  set('auditMaps', t.MAPS);
  set('auditMissing', t.MISSING);
  set('auditTotal', t.TOTAL);
  set('auditProse', `${t.EXISTS} of ${t.TOTAL} rows already existed and ${t.MAPS} more mapped onto a surface without new work`);
};

const AuditSheetM = () => {
  React.useEffect(publishTally, []);
  return (
  <Sheet title="What desktop was missing" sub={`${auditTally().TOTAL} rows across five mobile matrices: ${auditTally().EXISTS} already drawn on desktop, ${auditTally().MAPS} carried by an existing surface with no new component, ${auditTally().MISSING} drawn in this wave across ten screens — several MISSING rows deliberately share one, because a state and its rail are the same frame.`}>
    <div style={{ display: 'grid', gridTemplateColumns: '300px 96px 1fr', gap: '0 16px' }}>
      {['Mobile state', 'Desktop', 'Component'].map(h => (
        <div key={h} style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>{h}</div>
      ))}
      {AUDIT.map(g => (
        <React.Fragment key={g.g}>
          <div style={{ gridColumn: '1 / -1', padding: '13px 0 7px' }}>
            <Lbl size={9.5} color={M_TEAL}>{g.g}</Lbl>
          </div>
          {g.rows.map(([state, status, comp]) => {
            const c = status === 'EXISTS' ? M_TEAL : status === 'MAPS' ? M_GOLD : M_RED;
            return (
              <React.Fragment key={state}>
                <div style={{ padding: '8px 0', borderBottom: `1px solid ${M_BORDER}`, fontSize: 12.5, color: M_TEXT }}>{state}</div>
                <div style={{ padding: '8px 0', borderBottom: `1px solid ${M_BORDER}` }}>
                  <span style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.13em', color: c, background: `${c}14`, border: `1px solid ${c}44`, borderRadius: 3, padding: '2px 5px' }}>{status}</span>
                </div>
                <div style={{ padding: '8px 0', borderBottom: `1px solid ${M_BORDER}`, fontFamily: MONO, fontSize: 11, color: status === 'MISSING' ? M_DIM : M_MUTED }}>{comp}</div>
              </React.Fragment>
            );
          })}
        </React.Fragment>
      ))}
    </div>
    <div style={{ marginTop: 18, display: 'flex', gap: 14 }}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_TEAL}0D`, border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>The shape of the gap</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          {auditTally().EXISTS} of {auditTally().TOTAL} rows already existed and {auditTally().MAPS} more mapped onto a surface without new work — because desktop is the same components in a wider frame. <b style={{ color: M_TEXT }}>What was missing clustered in two places</b>: the transient states nobody screenshots (DEAL, between hands, collect) and the negative ones (broke, cut off, no history).
        </div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33` }}>
        <SyLbl color={M_GOLD}>The bubble law at 852px</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
          Mobile allows <b style={{ color: M_TEXT }}>two</b> on a 390px felt. Desktop allows <b style={{ color: M_TEXT }}>three</b> — his plus two opponents — because the seats are 170px apart at 852px and three 150px bubbles cannot touch. The per-seat rule is unchanged: one each, 3–4s, oldest goes. <b style={{ color: M_TEXT }}>Not five</b>: a table where everyone is talking at once is a chatroom, not a game.
        </div>
      </div>
    </div>
  </Sheet>
  );
};

// ── 2 · HEAT (MOOD-2) ─────────────────────────────────────────────────────
// mood.heat 0–100 is INTENSITY, not a new mood and not a new colour: it scales the
// bob and the aura of whatever mood he is already in. A confident agent at heat 12
// is calm; the same agent at heat 88 is coiled. This is the channel that lets the
// room read temperature at a glance without a single number on the floor.
const HEAT_STEPS = [
  { h: 12, word: 'cold', note: 'idle bob, no aura' },
  { h: 44, word: 'warm', note: 'canon bob, faint aura' },
  { h: 72, word: 'hot', note: 'faster bob, aura up' },
  { h: 94, word: 'boiling', note: 'tight fast bob, aura at full' },
];

const DeskHeatGhost = ({ mood, accent, heat = 44, size = 62, name }) => {
  const t = heat / 100;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          position: 'absolute', left: '50%', top: '52%', width: size * (1.5 + t), height: size * (1.5 + t),
          transform: 'translate(-50%,-50%)',
          background: `radial-gradient(circle, ${MOODS[mood].color}${Math.round(10 + t * 60).toString(16).padStart(2, '0')}, transparent 68%)`,
        }}/>
        <FloorGhost mood={mood} accent={accent} size={size} speed={7.5 - t * 5}/>
      </div>
      {name && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 8px', borderRadius: 10, background: 'rgba(14,17,18,0.8)', border: `1px solid ${M_BORDER}` }}>
          <span style={{ fontSize: 11, color: M_DIM }}>{name}</span>
          <span style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED }}>{heat}</span>
        </div>
      )}
    </div>
  );
};

// the roster carries heat as a hairline under the row — no number, no colour change
const HeatRosterRow = ({ name, accent, mood, heat, line, pnl }) => (
  <div style={{ padding: '9px 16px 10px', borderBottom: `1px solid ${M_BORDER}`, cursor: 'pointer' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <PHood size={34} accent={accent} mood={mood}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: M_TEXT }}>{name}</span>
          <MoodChip mood={mood} small/>
        </div>
        <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line}</div>
      </div>
      <Num size={12} weight={700} color={pnl.startsWith('−') ? M_RED : M_TEAL}>{pnl}</Num>
    </div>
    <div style={{ marginTop: 8, height: 2, borderRadius: 1, background: M_SURF, overflow: 'hidden' }}>
      <div style={{ width: `${heat}%`, height: '100%', background: MOODS[mood].color, opacity: 0.5 + (heat / 200) }}/>
    </div>
  </div>
);

Object.assign(window, { AUDIT, auditTally, publishTally, AuditSheetM, HEAT_STEPS, DeskHeatGhost, HeatRosterRow });
