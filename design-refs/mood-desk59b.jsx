// ═════════════════════════════════════════════════════════════════
// DESKTOP · the casino, and the felt — wave 58 addendum, part 2
//
// The casino on desktop is the FLOOR at full width: six to eight live felts you can
// see at once, and the board bolted beside the stairs as a permanent right column
// rather than a panel you open. Clicking a felt watches it in the centre and the
// floor shrinks to a strip on the left — you never lose the room you came from.
//
// Watch is the felt centred at ~900px with the thread open beside it. Sit-down is
// the same layout with YOU at the bottom and the BET panel inside the felt's own
// bottom edge, not bolted under it: on desktop there is room inside the felt.
// ═════════════════════════════════════════════════════════════════

// the floor, at whatever width the centre column has. It keeps its own coordinate
// space (390 × 470) and scales — the same trick the seats use, for the same reason.
const DkFloorStage = ({ w, h, on, strip }) => {
  const k = strip ? (w - 24) / FLOOR_W : Math.min((w - 60) / FLOOR_W, (h - 40) / FLOOR_H);
  return (
    <div style={{ width: strip ? w : undefined, flex: strip ? undefined : 1, minWidth: 0, position: 'relative', overflow: 'hidden', background: '#090D0C', display: 'flex', alignItems: strip ? 'flex-start' : 'center', justifyContent: 'center', borderRight: strip ? `1px solid ${M_BORDER}` : 'none', padding: strip ? '12px 0 0' : 0 }}>
      <div style={{ width: FLOOR_W * k, height: FLOOR_H * k, position: 'relative', overflow: 'hidden', borderRadius: 5, boxShadow: '0 26px 70px rgba(0,0,0,0.6)' }}>
        <div style={{ width: FLOOR_W, height: FLOOR_H, transform: `scale(${k})`, transformOrigin: '0 0' }}>
          <TheFloor on={on} h={FLOOR_H}/>
        </div>
      </div>
      {strip && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center', fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED }}>← THE FLOOR</div>
      )}
    </div>
  );
};

// the board by the stairs, as a column. It is not a panel you open on desktop —
// it is bolted to the wall, so it is always there.
const DkBoardColumn = () => (
  <div style={{ width: 300, flexShrink: 0, borderLeft: `1px solid ${M_BORDER}`, background: 'rgba(14,20,19,0.97)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '11px 14px 10px', borderBottom: `1px solid ${M_BORDER}` }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: M_GOLD }}>BY THE STAIRS</span>
      <span style={{ marginLeft: 'auto', fontFamily: MONO, fontSize: 9, color: M_MUTED }}>1,604 in</span>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <LiveNow/>
      <Tonight/>
    </div>
  </div>
);

const DkCasinoFloorScreenM = ({ w = 1440, h = 900 }) => (
  <DkShell w={w} h={h}>
    <DkBar wide={w > 1500} title="The floor" sub="6 tables · Bal at 25/50" net="+$1,290"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <DkRoster hover={0}/>
      <DkFloorStage w={w - DW.roster - 300} h={h - DK_H.pad} on="f5"/>
      <DkBoardColumn/>
    </div>
  </DkShell>
);

// clicked a felt: it plays in the centre, the floor becomes a strip on the left, and
// the thread comes back — the room you came from is never off screen.
// the ring, spread into a wider felt. x is mapped away from the centre line; y is
// left alone, because the felt did not get taller — it got wider.
const SPREAD = 900 / F_W;
const spreadSeats = seats => seats.map(s => ({ ...s, x: 450 + (s.x - F_W / 2) * SPREAD }));

const DkWatchScreenM = ({ w = 1440, h = 900, owner, bet }) => {
  const FELT_W = 900;
  const feltBox = Math.min(FELT_W, w - 190 - DW.thread - 24);
  return (
    <DkShell w={w} h={h}>
      <DkBar wide={w > 1500} title={owner ? 'The kitchen table' : 'Table 5 · 25/50'} sub={owner ? 'you are in the game · no money' : 'Bal · 41 minutes · +$340'} net={owner ? '—' : '+$1,290'}/>
      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <DkFloorStage w={190} h={h - DK_H.pad} on="f5" strip/>
        {/* the felt, centred, at its own coordinate space scaled to ~900 */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0A0F0E', overflow: 'hidden' }}>
          {(() => {
            // the felt is capped at 900 WIDE on purpose — past that the rope and the
            // hero row drift apart — but its height must follow the real shell, or a
            // 1080 window renders the same felt as an 800 one.
            const k = Math.min(1, feltBox / FELT_W, (h - DK_H.pad - 36) / V5_FELT_H);
            return (
              <div style={{ width: FELT_W * k, height: V5_FELT_H * k, position: 'relative', overflow: 'hidden', borderRadius: 6, border: `1px solid ${M_BORDER}`, boxShadow: '0 28px 70px rgba(0,0,0,0.6)' }}>
                <div style={{ width: FELT_W, height: V5_FELT_H, transform: `scale(${k})`, transformOrigin: '0 0', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                  {owner ? (
                    <V5Felt seats={spreadSeats(SIT_RING)} pot={bet ? '480' : '120'} board={bet ? undefined : []} flip={bet ? 4 : 0}
                      stackBand="mid" stackAmt="1,840" oppSays={bet ? null : SIT_READ}
                      hero={<SitHero win={bet ? 38 : 62} turn={bet} secs={bet ? 16 : undefined}/>}>
                      <SitCorners/>
                      {/* the verbs live INSIDE the felt's bottom edge on desktop —
                          there is room, and a bar bolted under the felt would be a
                          fourth band on a screen whose point is the felt */}
                      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 9, background: V5GLASS.panel, backdropFilter: V5GLASS.blur, WebkitBackdropFilter: V5GLASS.blur, borderTop: `1px solid ${bet ? `${M_GOLD}66` : V5GLASS.edgeUp}` }}>
                        {bet ? (
                          <div style={{ padding: '9px 12px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, paddingBottom: 8 }}>
                              <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', color: M_GOLD }}>BET</span>
                              <span style={{ flex: 1, fontSize: 10.5, color: M_MUTED }}>pot is 480 · you have 1,840</span>
                              <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: M_DIM }}>CANCEL</span>
                            </div>
                            <div style={{ display: 'flex', gap: 6 }}>
                              {[['A THIRD', '160'], ['HALF', '240'], ['POT', '480'], ['ALL IN', '1,840']].map(([kk, v], i) => (
                                <div key={kk} style={{ flex: 1, textAlign: 'center', borderRadius: 9, border: `1px solid ${i === 3 ? M_GOLD : `${M_GOLD}44`}`, background: i === 3 ? `${M_GOLD}1E` : `${M_GOLD}0D`, padding: '7px 0 6px' }}>
                                  <div style={{ fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: i === 3 ? M_GOLD : M_DIM }}>{kk}</div>
                                  <div style={{ marginTop: 2 }}><Num size={12} weight={700} color={M_GOLD}>{v}</Num></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 7, padding: '10px 12px 13px' }}>
                            {[['FOLD', M_MUTED], ['CHECK', M_DIM], ['CALL', M_TEAL], ['BET', M_GOLD]].map(([v, c]) => (
                              <div key={v} style={{ flex: 1, height: 42, borderRadius: 11, background: V5GLASS.raised, border: `1px solid ${v === 'BET' ? `${M_GOLD}66` : v === 'CALL' ? `${M_TEAL}55` : V5GLASS.edge}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.11em', color: c }}>{v}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </V5Felt>
                  ) : (
                    <V5Felt seats={spreadSeats(W4_SEATS)} acting="granite" oppSays={{ id: 'granite', text: 'Again?' }} stackBand="mid" betOut="mid" oppBet={['granite', 'phil']}
                      hero={<V5Hero says="Ace-ten. Fine. Let us see who is home." toCall="240" street="TURN" equity={87} hands="hold" timer={7}/>}/>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
        <DkRight title={owner ? 'The room' : 'Bal'} sub={owner ? 'EVERYONE AT HOME HEARS THIS' : 'AT 25/50'}>
          <DkTalk/>
        </DkRight>
      </div>
    </DkShell>
  );
};

const DkWatchM = ({ w, h }) => <DkWatchScreenM w={w} h={h}/>;
const DkOwnerM = ({ w, h }) => <DkWatchScreenM w={w} h={h} owner/>;
const DkOwnerBetM = ({ w, h }) => <DkWatchScreenM w={w} h={h} owner bet/>;

// the 1920 variants: the same composition, more room in the centre. Nothing about the
// columns changes — a wider window buys a bigger felt and a wider floor, not a fourth
// column, because a fourth column would be something to look at rather than something
// to do.
const DkHome1920M = () => <DkHomeRoomScreenM w={1920} h={1080}/>;
const DkCasino1920M = () => <DkCasinoFloorScreenM w={1920} h={1080}/>;
const DkWatch1920M = () => <DkWatchScreenM w={1920} h={1080}/>;
const DkOwner1920M = () => <DkWatchScreenM w={1920} h={1080} owner/>;

Object.assign(window, {
  SPREAD, spreadSeats, DkFloorStage, DkBoardColumn, DkCasinoFloorScreenM, DkWatchScreenM,
  DkWatchM, DkOwnerM, DkOwnerBetM,
  DkHome1920M, DkCasino1920M, DkWatch1920M, DkOwner1920M,
});
