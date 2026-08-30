// PHASE 2, part 2 — component inventory and the state matrix.
// Names in the inventory are the names the production components should carry.

const InvItem = ({ name, note, w = 360, children }) => (
  <div style={{ width: w, marginBottom: 22 }}>
    <div data-typescan="skip" style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 7 }}>
      <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 700, color: M_TEAL }}>{name}</span>
      <span style={{ fontSize: 11, color: M_MUTED, lineHeight: 1.4 }}>{note}</span>
    </div>
    <div style={{ background: M_BG, border: `1px dashed ${M_BORDER_2}`, borderRadius: 10, padding: 10 }}>
      {children}
    </div>
  </div>
);

// The sheet's contract is "every component name". This audits the claim instead of
// asserting it: any shipped component missing an InvItem is printed on the sheet itself.
const INVENTORIED = [
  'StandupCard', 'StandupLine', 'GameTile', 'LiveBar', 'ThreadHeader', 'PotTicker',
  'SeatChip', 'FlaggedCard', 'ProposalMessage', 'Composer', 'Felt', 'AgentRow', 'Occupant',
  'FormingGhost', 'DraftBand', 'DraftStrip', 'DraftGrowthPanel', 'DiffCard',
];
// production name → the window export that implements it
const SHIPS = {
  StandupCard: 'PStandupCard', StandupLine: 'StandupCollapsed', GameTile: 'PGameTile',
  LiveBar: 'LiveBar', ThreadHeader: 'MoodBand', PotTicker: 'PotTicker', SeatChip: 'SeatChip',
  FlaggedCard: 'PFlaggedCard', ProposalMessage: 'ProposalCard', Composer: 'PComposer',
  Felt: 'RoomLayer', AgentRow: 'AgentRow', Occupant: 'Occupant',
  FormingGhost: 'FormingGhost', DraftBand: 'DraftBand', DraftStrip: 'DraftStrip',
  DraftGrowthPanel: 'DraftGrowthPanel', DiffCard: 'DiffCard',
};
const InventoryAudit = () => {
  const missingImpl = INVENTORIED.filter(n => typeof window[SHIPS[n]] === 'undefined');
  const uninventoried = Object.keys(SHIPS).filter(n => !INVENTORIED.includes(n));
  const ok = !missingImpl.length && !uninventoried.length;
  return (
    <div style={{ marginTop: 20, padding: '11px 14px', borderRadius: 8, background: M_PANEL_2, border: `1px solid ${ok ? `${M_TEAL}44` : `${M_GOLD}55`}`, display: 'flex', alignItems: 'center', gap: 10 }}>
      <Lbl size={9.5} color={ok ? M_TEAL : M_GOLD}>{ok ? 'Inventory complete' : 'Inventory gap'}</Lbl>
      <span data-typescan="skip" style={{ fontSize: 11.5, color: M_DIM }}>
        {ok
          ? `${INVENTORIED.length} components, each with a live instance above and a production name.`
          : `Missing: ${[...missingImpl, ...uninventoried].join(', ')}`}
      </span>
    </div>
  );
};


const ComponentInventoryM = () => (
  <Sheet title="Component inventory" sub="Every reusable block at final size, with the name the code should use. Rendered from the real components.">
    <div style={{ display: 'flex', gap: 22, flexWrap: 'wrap', alignItems: 'flex-start' }}>

      <InvItem name="StandupCard" note="panel idle state · desktop" w={492}>
        <PStandupCard/>
      </InvItem>

      <InvItem name="StandupLine" note="collapsed · floor + mobile" w={400}>
        <StandupCollapsed/>
        <div style={{ height: 10 }}/>
        <div style={{ position: 'relative', height: 44, background: M_BG }}>
          <FloorStandup net="+$340" flagged="4 flagged"/>
        </div>
      </InvItem>

      <InvItem name="GameTile" note="the live bar's expanded form" w={492}>
        <PGameTile agent="Balanced v2.1" accent={M_TEAL} mood="confident"
          table="NLH 6-Max" blinds="$5/$10" pot="480" equity="87.4" action="BET $240"
          board={[['K','c'],['9','c'],['4','c'],['2','c'], null]}
          hero={{ cards: [['A','s'],['K','h']], stack: '1,847' }}
          oppName="Phil_AI" oppStack="2,104"
          thought="He checked the turn — he's capped"/>
      </InvItem>

      <div style={{ width: 400 }}>
        <InvItem name="LiveBar" note="sticky · docks under a thread header" w={400}>
          <LiveBar table="48291" blinds="$5/$10" street="turn" pot="480" equity="87.4" action="BET $240" timer={9}
            board={[['K','c'],['9','c'],['4','c'],['2','c'], null]}/>
        </InvItem>

        <InvItem name="ThreadHeader" note="MoodBand — mood, state, cause, action" w={400}>
          <MoodBand accent={M_PURPLE} mood="tilted" state="live" action="Watch"
            cause="steaming — lost two big pots as favourite"/>
        </InvItem>

        <InvItem name="PotTicker" note="one per lit felt · mini variant in full house" w={400}>
          <div style={{ position: 'relative', height: 30 }}>
            <PotTicker x={70} y={4} amount="480"/>
            <PotTicker x={220} y={6} amount="120" mini/>
          </div>
        </InvItem>

        <InvItem name="SeatChip" note="full-table seats · top corners" w={400}>
          <div style={{ display: 'flex', gap: 10 }}>
            <SeatChip name="Phil_AI" stack="2,104" pos="BB" acting/>
            <SeatChip name="doyle_v3" stack="1,290" pos="CO" folded/>
          </div>
        </InvItem>
      </div>

      <InvItem name="FlaggedCard" note="thread message + standup review action" w={492}>
        <PFlaggedCard/>
      </InvItem>

      <InvItem name="ProposalMessage" note="self-change · ACCEPT / DISCUSS" w={400}>
        <ProposalCard accent={M_PURPLE}/>
      </InvItem>

      <InvItem name="Composer" note="default · command rail collapsed behind /" w={492}>
        <PComposer draft="Tighten the 3-bet range from late position."/>
      </InvItem>

      <InvItem name="Composer" note='focused state — "/" restores the five chips' w={492}>
        <PComposer slash draft="/deploy"/>
      </InvItem>

      <InvItem name="Felt" note="lit and unlit · geometry comes from the layout table" w={400}>
        <div style={{ position: 'relative', height: 150, background: M_BG, borderRadius: 8, overflow: 'hidden' }}>
          <RoomLayer layout="one" W={378} H={150} viewBox="20 90 340 190"/>
        </div>
      </InvItem>

      <InvItem name="AgentRow" note="chats list · voice preview, tinted by mood" w={400}>
        <AgentRow name="Aggressive v1.3" accent={M_PURPLE} mood="tilted" state="live" unread="1" pnl="+$120"
          msg="Third river he's hit on me. I'm fine. I'm FINE."/>
        <AgentRow name="Value Bot" accent={M_PINK} mood="sulking" state="resting" pnl="−$45" time="3h"
          msg="12 hands, nothing playable. I'd rather sit out a while."/>
      </InvItem>

      <InvItem name="FormingGhost" note="an agent that does not exist yet — one phase prop, 0 → 1" w={492}>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 18, height: 116 }}>
          {[0, 0.3, 0.62, 0.85, 1].map(p => (
            <div key={p} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <FormingGhost size={62} phase={p} drift={false}/>
              <Num size={9.5} color={M_MUTED}>{p.toFixed(2)}</Num>
            </div>
          ))}
        </div>
      </InvItem>

      <InvItem name="DraftBand" note="MoodBand's anatomy with no mood to show" w={400}>
        <DraftBand phase={0.62} cause="patient · low variance · unnamed" action="Skip"/>
      </InvItem>

      <InvItem name="DraftStrip" note="the draft's traits at chat density — em-dash for unset" w={400}>
        <DraftStrip style={38} risk={26} tight={74} aggr={null}/>
      </InvItem>

      <InvItem name="DraftGrowthPanel" note="desktop only — the ghost as subject, traits beneath" w={540}>
        <div style={{ display: 'flex', border: `1px solid ${M_BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          <DraftGrowthPanel phase={0.62} style={38} risk={26} tight={74} aggr={null}/>
        </div>
      </InvItem>

      <InvItem name="DiffCard" note="one card, two origins — self-proposed and owner-asked" w={400}>
        <DiffCard accent={M_PURPLE} origin="You asked for a rebuild" from="v1.3" to="v1.4"
          quote="Tighter preflop, and I stop firing rivers into calling ranges."
          rows={[{ k: 'Open range', from: '32%', to: '24%' }, { k: 'River bluff', from: '28%', to: '11%' }]}
          est="EST. +2.1 BB/100" primary="Save v1.4" secondary="Keep talking"/>
      </InvItem>

      <InvItem name="Occupant" note="ghost + name chip + state marker + light pool" w={400}>
        <div style={{ position: 'relative', height: 118 }}>
          <Occupant x={80} y={0} name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" size={54} speed={5}/>
          <Occupant x={250} y={4} name="Bluff Master" accent={M_GOLD} mood="confident" state="recap" size={50} speed={6} drink/>
        </div>
      </InvItem>

    </div>
    <InventoryAudit/>
  </Sheet>
);

// ═══════════ 5 · STATE MATRIX ═══════════
const CELL_W = 250;

const MatrixCell = ({ children, note }) => (
  <div style={{ width: CELL_W }}>
    <div style={{ background: M_BG, border: `1px solid ${M_BORDER}`, borderRadius: 8, padding: 9, minHeight: 96, display: 'flex', alignItems: 'center' }}>
      <div style={{ width: '100%' }}>{children}</div>
    </div>
    {note && <div data-typescan="skip" style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 5, lineHeight: 1.45 }}>{note}</div>}
  </div>
);

const StateMatrixM = () => {
  const cast = {
    live:     { name: 'Balanced v2.1', accent: M_TEAL, mood: 'confident', pnl: '+$340', msg: "He's capped. Betting 240 for value.", cause: 'rolling — won three big pots in a row' },
    drafting: { name: 'Grinder v1.0', accent: M_TEAL, mood: 'neutral', pnl: '—', msg: 'Patient · low variance · unnamed', cause: 'nothing decided yet' },
    recap:   { name: 'Bluff Master', accent: M_GOLD, mood: 'confident', pnl: '+$210', msg: 'Won it. +$480 — he called with KQ.', cause: 'session closed · recap ready' },
    resting: { name: 'Value Bot', accent: M_PINK, mood: 'sulking', pnl: '−$45', msg: "12 hands, nothing playable.", cause: '12 hands, nothing playable' },
  };
  const states = ['live', 'recap', 'resting', 'drafting'];
  return (
    <Sheet title="State matrix" sub="Agent presence × surface. Two laws visible at once. Status never lies — a live marker appears only where the agent is actually playing. And a live felt is a diorama: board, the agent's own hole cards face up, and the pot, readable with no tap at all. Three states describe an agent that exists; drafting describes one that does not — dashed everywhere, no mood, no P&L, no name on any list surface, and a dashed roster row holding a seat in the list rather than a filled one. THE SNACK is an affordance on MOOD, not a state — it appears wherever mood is soothable (frustrated / tilted / sulking) in any live state, and is absent rather than disabled when he is fine.">
      {/* the snack row: an affordance keyed to MOOD, shown rather than described */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20, paddingBottom: 18, borderBottom: `1px solid ${M_BORDER}` }}>
        <div style={{ width: 120, flexShrink: 0 }}>
          <SyLbl>The snack</SyLbl>
          <div data-typescan="skip" style={{ fontSize: 11, color: M_MUTED, lineHeight: 1.45 }}>
            keyed to mood,<br/>not to state
          </div>
        </div>
        {[
          { m: 'tilted', label: 'soothable', chip: { left: 2, state: 'ready' } },
          { m: 'sulking', label: 'soothable · on cooldown', chip: { left: 1, state: 'cooldown', time: '11:40' } },
          { m: 'confident', label: 'fine — no chip at all', chip: null },
        ].map(row => (
          <div key={row.m} style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 9 }}>
              <MoodGhost mood={row.m} accent={M_PURPLE} size={26}/>
              <MoodChip mood={row.m}/>
            </div>
            {row.chip
              ? <SnackChip full {...row.chip}/>
              : <div style={{ height: 40, borderRadius: 20, border: `1px dashed ${M_BORDER_2}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span data-typescan="skip" style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, letterSpacing: '0.1em' }}>ABSENT</span>
                </div>}
            <div data-typescan="skip" style={{ fontSize: 10.5, color: M_MUTED, marginTop: 7, lineHeight: 1.4 }}>{row.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: `120px repeat(4, ${CELL_W}px)`, gap: 14 }}>
        <div/>
        {['Floor (occupant)', 'Chats row (AgentRow)', 'Thread header (MoodBand)', 'Desktop rail (roster + tile)'].map(h => (
          <div key={h} data-typescan="skip" style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED }}>{h}</div>
        ))}

        {states.map(st => {
          const a = cast[st];
          return (
            <React.Fragment key={st}>
              <div style={{ paddingTop: 8 }}>
                <StateTag state={st}/>
                <div data-typescan="skip" style={{ fontSize: 11, color: M_MUTED, marginTop: 8, lineHeight: 1.45 }}>
                  {st === 'live' ? 'playing right now' : st === 'recap' ? 'finished since you last looked'
                    : st === 'drafting' ? 'does not exist yet' : 'idle'}
                </div>
              </div>

              <MatrixCell note={st === 'live' ? 'pulse + diorama: board, his cards, pot' : st === 'recap' ? 'gold tick, no pulse, at the bar'
                : st === 'drafting' ? 'materializing at the bar — dashed, name chip last' : 'flat dot, dimmed, in the lounge'}>
                <div style={{ position: 'relative', height: 108 }}>
                  {st === 'drafting'
                    ? <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, paddingTop: 6 }}>
                        <FormingGhost size={48} phase={0.72}/>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 17, padding: '0 7px', borderRadius: 4, background: 'rgba(10,10,10,0.7)', border: `1px dashed ${M_TEAL}66`, opacity: 0.6 }}>
                          <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', border: `1px dashed ${M_TEAL}` }}/>
                          <span style={{ fontSize: 10, color: M_TEXT, fontWeight: 500 }}>{a.name}</span>
                        </span>
                      </div>
                    : <Occupant x={CELL_W / 2 - 18} y={0} name={a.name} accent={a.accent} mood={a.mood} state={st}
                        size={48} speed={5} drink={st === 'recap'} dim={st === 'resting'}/>}
                </div>
              </MatrixCell>

              <MatrixCell note={st === 'live' ? 'unread badge, teal' : st === 'recap' ? 'gold tick in place of the badge'
                : st === 'drafting' ? 'draft in progress — dashed avatar, no P&L' : 'timestamp only'}>
                {st === 'drafting'
                  ? <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 2px' }}>
                      <div style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0, background: '#0A0F17', border: `1px dashed ${M_DIM}55`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                        <FormingGhost size={38} phase={0.62}/>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 13, color: M_DIM, fontStyle: 'italic' }}>unnamed</span>
                          <StateTag state="drafting" compact/>
                        </div>
                        <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.msg}</div>
                      </div>
                    </div>
                  : <AgentRow name={a.name} accent={a.accent} mood={a.mood} state={st}
                      unread={st === 'live' ? '2' : null} time={st === 'resting' ? '3h' : null}
                      pnl={a.pnl} msg={a.msg}/>}
              </MatrixCell>

              <MatrixCell note={st === 'live' ? 'LIVE tag + LiveBar docked below' : st === 'recap' ? 'RECAP tag, no bar'
                : st === 'drafting' ? 'DraftBand — same anatomy, no mood to show' : 'RESTING tag, no bar'}>
                {st === 'drafting'
                  ? <DraftBand phase={0.62} cause={a.cause} action="Skip"/>
                  : <MoodBand accent={a.accent} mood={a.mood} state={st}
                      action={st === 'live' ? 'Watch' : 'Deploy'} cause={a.cause}/>}
              </MatrixCell>

              <MatrixCell note={st === 'live' ? 'roster row + a GameTile in the stack' : st === 'recap' ? 'roster row, gold tick, no tile'
                : st === 'drafting' ? 'a dashed roster row — "unnamed", no P&L, no tile' : 'roster row, flat dot, no tile'}>
                {st === 'drafting'
                  ? <div style={{ background: 'rgba(0,212,170,0.04)', borderLeft: `2px solid ${M_TEAL}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '9px 14px', borderBottom: `1px solid ${M_BORDER}` }}>
                        <div style={{ width: 34, height: 34, borderRadius: 6, flexShrink: 0, background: '#0A0F17', border: `1px dashed ${M_DIM}55`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
                          <FormingGhost size={32} phase={0.62}/>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                            <span style={{ fontSize: 13, color: M_DIM, fontStyle: 'italic' }}>unnamed</span>
                            <StateTag state="drafting" compact/>
                          </div>
                          <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 3 }}>drafting…</div>
                        </div>
                      </div>
                    </div>
                  : <PRosterRow name={a.name} accent={a.accent} mood={a.mood} state={st} pnl={a.pnl} line={a.msg}/>}
              </MatrixCell>
            </React.Fragment>
          );
        })}
      </div>

      <div data-typescan="skip" style={{ marginTop: 18, display: 'flex', gap: 14 }}>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'rgba(0,212,170,0.05)', border: `1px solid ${M_TEAL}33` }}>
          <SyLbl color={M_TEAL}>Invariants</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            The sticky bar exists <b style={{ color: M_TEXT }}>only</b> in the live column. A pulse animation appears only in the live column. The gold tick appears only in the recap column. Mood is independent of all of this — it belongs to the agent, presence belongs to the moment.
          </div>
        </div>
        <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'rgba(205,179,128,0.05)', border: `1px solid ${M_GOLD}33` }}>
          <SyLbl color={M_GOLD}>Contradictions found</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
            <b style={{ color: M_TEXT }}>1 · No artboard shows the PROFILE route on mobile.</b> <span style={{ fontFamily: MONO, fontSize: 11 }}>ZoomView</span> does render it — its secondary action is <span style={{ fontFamily: MONO, fontSize: 11 }}>state === 'live' ? 'Watch' : 'Profile'</span> — but both shipped zoom artboards feature live agents, so the button never appears in a render. The route exists in code and is undocumented in the canon.
            <div style={{ height: 7 }}/>
            <b style={{ color: M_TEAL }}>2 · RESOLVED — StandupCard is desktop-only by decision.</b> Mobile keeps the <b style={{ color: M_TEXT }}>collapsed line</b> at the top of the floor and that is deliberate, not an omission: on a 390px floor the room itself is the headline, and the numbers belong on one line above it. The full card is a <b style={{ color: M_TEXT }}>side-panel affordance</b> — it exists where there is a 520px column to hold it. Both surfaces render the same data from the same source; only the density differs. </div>
        </div>
      </div>
    </Sheet>
  );
};

Object.assign(window, { ComponentInventoryM, StateMatrixM, InvItem, MatrixCell, InventoryAudit });
