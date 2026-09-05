// OWNER WALLET AND AGENT POCKETS — spec v11 §7.1, nothing built until now.
// Poker staking, not a shop: the OWNER WALLET is the player's money, and each agent
// carries a POCKET — the roll he plays with. Pocket size sets the stakes he sits at,
// so the pocket IS the bet and there is no betting menu anywhere. Backer and horse.
//
// LAWS CARRIED IN: items are bought from the WALLET, never a pocket (a pocket that
// can buy things is a purchase path into the character system). Cutting him off is a
// legitimate state, drawn without a shred of guilt. No live wager, no token, no real
// money in this wave.

const WALLET = { balance: '2,340.50', staked: '1,150', session: '+$486' };

const POCKETS = [
  { name: 'Balanced v2.1', accent: M_TEAL, mood: 'confident', state: 'live',
    pocket: '640', stakes: '$5/$10', mode: 'auto', pnl: '+$340', action: 'Collect',
    note: 'up $340 on a $300 pocket' },
  { name: 'Aggressive v1.3', accent: M_PURPLE, mood: 'frustrated', state: 'live',
    pocket: '210', stakes: '$10/$20', mode: 'allowance', pnl: '−$90', action: 'Fund',
    note: '$210 of a $500 allowance left' },
  { name: 'Bluff Master', accent: M_GOLD, mood: 'confident', state: 'recap',
    pocket: '300', stakes: '$5/$10', mode: 'topup', pnl: '+$236', action: 'Collect',
    note: 'topped up once, three days ago' },
  { name: 'Value Bot', accent: M_PINK, mood: 'sulking', state: 'resting',
    pocket: '0', stakes: '—', mode: 'cut', pnl: '—', action: 'Fund', broke: true,
    note: 'out of money · cut off Tuesday' },
];

const MODE = {
  topup:     { label: 'TOP-UP',    title: 'One-time top-up', color: M_DIM,   line: 'one-time. When it is gone, he stops.' },
  allowance: { label: 'ALLOWANCE', title: 'Allowance',        color: M_TEAL,  line: 'a fixed budget. He plays until it runs out.' },
  auto:      { label: 'AUTO',      title: 'Auto-refill',      color: M_GOLD,  line: 'he collects from the wallet when broke, up to a cap.' },
  cut:       { label: 'CUT OFF',   title: 'Cut him off',      color: M_MUTED, line: 'no refill. A legitimate answer, and not a punishment.' },
};

const ModeTag = ({ mode }) => (
  <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.13em', color: MODE[mode].color, background: `${MODE[mode].color}14`, border: `1px solid ${MODE[mode].color}44`, borderRadius: 3, padding: '2px 5px', whiteSpace: 'nowrap' }}>{MODE[mode].label}</span>
);

// ── the pocket bar: how much of the roll is left, at a glance ───────────────
// Teal is money he has; the gold hairline is the allowance ceiling where one exists.
const PocketBar = ({ have, cap, broke }) => (
  <div style={{ position: 'relative', height: 5, borderRadius: 2.5, background: M_SURF, overflow: 'hidden' }}>
    <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${broke ? 0 : Math.min(100, (have / cap) * 100)}%`, background: broke ? M_MUTED : M_TEAL, boxShadow: broke ? 'none' : `0 0 6px ${M_TEAL}55` }}/>
  </div>
);

const PocketRow = ({ p, last }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 0', borderBottom: last ? 'none' : `1px solid ${M_BORDER}` }}>
    <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, background: '#0A0F17', border: `1px solid ${p.accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden', opacity: p.broke ? 0.55 : 1 }}>
      <MoodGhost mood={p.mood} accent={p.accent} size={36} ring={false}/>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: p.broke ? M_DIM : M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
        <ModeTag mode={p.mode}/>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginTop: 4 }}>
        <Num size={13} weight={700} color={p.broke ? M_MUTED : M_TEXT}>${p.pocket}</Num>
        <Num size={9} color={M_MUTED} weight={500}>{p.stakes}</Num>
        <div style={{ flex: 1 }}/>
        <Num size={11.5} weight={700} color={p.pnl.startsWith('−') ? M_RED : p.pnl === '—' ? M_MUTED : M_TEAL}>{p.pnl}</Num>
      </div>
      <div style={{ marginTop: 5 }}><PocketBar have={+p.pocket} cap={500} broke={p.broke}/></div>
    </div>
    <Btn kind={p.action === 'Collect' ? 'outline' : 'primary'} h={30}>{p.action}</Btn>
  </div>
);

// ═══ 1 · THE YOU SCREEN ══════════════════════════════════════════════════════
const YouWalletScreenM = () => (
  <PhoneShell>
    <GlobalHeader title="You"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* the wallet — one number, and where the rest of it currently is */}
      <div style={{ margin: '2px 14px 12px', padding: '14px 15px 15px', borderRadius: 14, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D` }}>
        <Lbl size={9.5}>Your wallet</Lbl>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 5 }}>
          <Amt size={38}>${WALLET.balance}</Amt>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, paddingTop: 11, borderTop: `1px solid ${M_BORDER}` }}>
          <div style={{ flex: 1 }}>
            <Lbl size={8.5}>In pockets</Lbl>
            <div style={{ marginTop: 2 }}><Num size={13} weight={700} color={M_GOLD}>${WALLET.staked}</Num></div>
          </div>
          <div style={{ width: 1, height: 26, background: M_BORDER }}/>
          <div style={{ flex: 1 }}>
            <Lbl size={8.5}>Tonight</Lbl>
            <div style={{ marginTop: 2 }}><Num size={13} weight={700} color={M_TEAL}>{WALLET.session}</Num></div>
          </div>
          <div style={{ width: 1, height: 26, background: M_BORDER }}/>
          <div style={{ flex: 1 }}>
            <Lbl size={8.5}>Playing</Lbl>
            <div style={{ marginTop: 2 }}><Num size={13} weight={700}>2 of 4</Num></div>
          </div>
        </div>
      </div>

      <div style={{ padding: '0 14px 5px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Lbl size={9.5}>Pockets</Lbl>
        <span style={{ fontSize: 11, color: M_MUTED }}>pocket size sets his stakes</span>
      </div>
      <div style={{ margin: '0 14px 12px', padding: '2px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        {POCKETS.map((p, i) => <PocketRow key={p.name} p={p} last={i === POCKETS.length - 1}/>)}
      </div>

      <div style={{ margin: '0 14px', display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
        <div style={{ width: 30, height: 30, borderRadius: 9, background: `${M_GOLD}14`, border: `1px solid ${M_GOLD}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Biscuit size={15}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: M_TEXT }}>Snacks &middot; 2 left</div>
          <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 1 }}>Bought from the wallet, never from a pocket</div>
        </div>
        <Icon name="chevron-right" size={16} color={M_MUTED}/>
      </div>
    </div>
    <TabBar active="you"/>
  </PhoneShell>
);

// ═══ 2 · THE FUNDING SHEET ═══════════════════════════════════════════════════
const FundOption = ({ mode, amount, on, sub }) => (
  <div style={{
    padding: '11px 13px', borderRadius: 11, marginBottom: 8,
    background: on ? `${MODE[mode].color}0D` : M_PANEL_2,
    border: `1px solid ${on ? MODE[mode].color : M_BORDER}`, cursor: 'pointer',
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ width: 15, height: 15, borderRadius: 8, flexShrink: 0, border: `1px solid ${on ? MODE[mode].color : M_BORDER_2}`, background: on ? MODE[mode].color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {on && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#0A0A0A" strokeWidth="4" strokeLinecap="round"><path d="M5 12l5 5 9-11"/></svg>}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: on ? M_TEXT : M_DIM }}>{MODE[mode].title}</span>
      {amount && <Num size={13} weight={700} color={on ? MODE[mode].color : M_MUTED}>{amount}</Num>}
    </div>
    <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, marginTop: 6, paddingLeft: 24 }}>{sub || MODE[mode].line}</div>
  </div>
);

const FundSheetScreenM = () => (
  <PhoneShell>
    <GlobalHeader back title="Fund Aggressive v1.3"/>
    <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '2px 14px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_PURPLE}3D`, marginBottom: 14 }}>
        <div style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: '#0A0F17', border: `1px solid ${M_PURPLE}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
          <MoodGhost mood="frustrated" accent={M_PURPLE} size={42} ring={false}/>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Lbl size={8.5}>Pocket now</Lbl>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 7 }}>
            <Num size={19} weight={700}>$210</Num>
            <Num size={9} color={M_MUTED} weight={500}>PLAYS $10/$20</Num>
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <Lbl size={8.5}>Wallet</Lbl>
          <div><Num size={13} weight={700} color={M_TEAL}>${WALLET.balance}</Num></div>
        </div>
      </div>

      <Lbl size={9.5}>How he gets money</Lbl>
      <div style={{ height: 8 }}/>
      <FundOption mode="topup" amount="$300"/>
      <FundOption mode="allowance" amount="$500" on/>
      <FundOption mode="auto" amount="cap $1,000"/>
      <FundOption mode="cut" sub="He finishes the hand he is in and takes a seat at the bar. Nothing is lost — his attributes, his read book and his grudges all keep."/>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: `${M_GOLD}0D`, border: `1px solid ${M_GOLD}33`, marginTop: 4 }}>
        <Icon name="risk" size={14} color={M_GOLD}/>
        <span style={{ flex: 1, fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>
          A $500 allowance seats him at <b style={{ color: M_TEXT }}>$10/$20</b>. Bigger pocket, bigger stakes.
        </span>
      </div>
    </div>
    <div style={{ flexShrink: 0, padding: '10px 14px 22px', borderTop: `1px solid ${M_BORDER}`, background: M_PANEL, display: 'flex', gap: 9 }}>
      <div style={{ flex: 1 }}><Btn kind="ghost" h={46} full>Cancel</Btn></div>
      <div style={{ flex: 1.4 }}><Btn kind="primary" h={46} full>Set allowance</Btn></div>
    </div>
  </PhoneShell>
);

// ═══ 3 · THE COLLECT MOMENT ══════════════════════════════════════════════════
// He brings it home. The motion is pocket → wallet, so the receipt is drawn as a
// transfer rather than a reward: no burst, no coin, no sound of a slot machine.
const CollectCard = () => (
  <div style={{ margin: '0 14px 9px', padding: '12px 13px', borderRadius: 12, background: `${M_TEAL}0A`, border: `1px solid ${M_TEAL}44` }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 11 }}>
      <Lbl size={9} color={M_TEAL}>Brought home</Lbl>
      <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      <Num size={9} color={M_MUTED} weight={500}>02:14</Num>
    </div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
      <div style={{ flex: 1 }}>
        <Lbl size={8.5}>His pocket</Lbl>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
          <Num size={15} weight={700} color={M_MUTED}>$640</Num>
          <Num size={9} color={M_MUTED} weight={500}>&rarr; $300</Num>
        </div>
      </div>
      <svg width="26" height="14" viewBox="0 0 26 14" fill="none" stroke={M_TEAL} strokeWidth="1.8" strokeLinecap="round" style={{ flexShrink: 0 }}><path d="M1 7h20M16 2l5 5-5 5"/></svg>
      <div style={{ flex: 1, textAlign: 'right' }}>
        <Lbl size={8.5} color={M_TEAL}>Your wallet</Lbl>
        <div style={{ marginTop: 2 }}><Num size={17} weight={700} color={M_TEAL}>+$340</Num></div>
      </div>
    </div>
    <div style={{ marginTop: 11, paddingTop: 10, borderTop: `1px solid ${M_BORDER}`, display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>Pocket back to its $300 float</span>
      <Btn kind="outline" h={28}>Leave it in</Btn>
    </div>
  </div>
);

const ThreadCollectScreenM = () => (
  <ThreadScreen name="Balanced v2.1" accent={M_TEAL} mood="confident" state="recap" action="Deploy"
    cause="brought home $340">
    <SysLine>Session closed · 02:14</SysLine>
    <AgentBubble mood="confident" accent={M_TEAL} time="02:14" expressive>
      Six hundred and forty in my pocket. Three hundred of it is yours.
    </AgentBubble>
    <CollectCard/>
    <AgentBubble mood="confident" accent={M_TEAL} time="02:14">
      Leave the float and I'll go again tomorrow.
    </AgentBubble>
    <OwnerBubble time="08:03">Take it. Same stakes.</OwnerBubble>
  </ThreadScreen>
);

// ═══ 4 · BROKE ═══════════════════════════════════════════════════════════════
// Three surfaces, one fact, no guilt anywhere: he is out of money and it is the
// owner's call. He does not plead, the copy does not scold, and nothing is lost.
const ThreadBrokeScreenM = () => (
  <ThreadScreen name="Value Bot" accent={M_PINK} mood="sulking" state="resting" action="Fund"
    cause="pocket empty — at the bar"
    dock={
      <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: M_PANEL_2, borderBottom: `1px solid ${M_BORDER}` }}>
        <div style={{ minWidth: 0 }}>
          <Lbl size={8.5}>Pocket</Lbl>
          <div><Num size={13} weight={700} color={M_MUTED}>$0</Num></div>
        </div>
        <div style={{ width: 1, height: 22, background: M_BORDER }}/>
        <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>Cut off Tuesday · nothing pending</span>
        <Btn kind="primary" h={30}>Fund</Btn>
      </div>
    }>
    <SysLine>Pocket empty · 21:40</SysLine>
    <AgentBubble mood="sulking" accent={M_PINK} time="21:40">
      I'm out. Your call.
    </AgentBubble>
    <AgentBubble mood="sulking" accent={M_PINK} time="21:41">
      I'll be at the bar. My read book keeps either way.
    </AgentBubble>
    <OwnerBubble time="21:44">Sit tight for a bit.</OwnerBubble>
    <AgentBubble mood="sulking" accent={M_PINK} time="21:44">
      Fine.
    </AgentBubble>
  </ThreadScreen>
);

const FloorBrokeScreenM = () => {
  const L = LAYOUTS.two;
  const gh = (50 * 1.2) + 19 + 3;
  const f = L.felts[0];
  return (
    <PhoneShell>
      <GlobalHeader/>
      <div style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', background: M_BG }}>
        <RoomLayer layout="two"/>
        <FloorStandup net="+$486" flagged="4 flagged"/>
        <Diorama f={f} hole={[['A', 's'], ['K', 'h']]}/>
        <Occupant x={f.cx} y={f.cy - gh + 8} name="Balanced v2.1" accent={M_TEAL}
          mood="confident" state="live" size={50} speed={5}/>
        <PotTicker x={f.cx} y={f.cy - gh + 8 - 27} amount="480"/>

        {/* out of money, at the bar, with a drink he is not enjoying */}
        <Occupant x={88} y={L.bar.y - 96} name="Value Bot" accent={M_PINK}
          mood="sulking" state="resting" size={50} speed={6.4} drink/>
        <div style={{ position: 'absolute', left: 88, top: L.bar.y - 26, transform: 'translateX(-50%)', zIndex: 4 }}>
          <span style={{ fontFamily: MONO, fontSize: 8.5, letterSpacing: '0.1em', color: M_MUTED, background: 'rgba(19,19,22,0.9)', border: `1px solid ${M_BORDER_2}`, borderRadius: 3, padding: '2px 5px', whiteSpace: 'nowrap' }}>POCKET $0</span>
        </div>
      </div>
      <TabBar active="casino"/>
    </PhoneShell>
  );
};

// ── the one line the player card gains (drops in under the attribute cluster) ─
const PocketLineSpec = () => (
  <div style={{ width: 390, background: M_BG, fontFamily: INTER, padding: 14 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 9 }}>
      <Lbl size={9.5}>Profile v2 &middot; the pocket line</Lbl>
      <div style={{ flex: 1, height: 1, background: M_BORDER }}/>
      <Num size={9} color={M_MUTED} weight={500}>ONE ROW, UNDER THE CLUSTER</Num>
    </div>
    <div style={{ padding: '11px 13px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ minWidth: 0 }}>
          <Lbl size={8.5}>Pocket</Lbl>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <Num size={15} weight={700}>$640</Num>
            <ModeTag mode="auto"/>
          </div>
        </div>
        <div style={{ width: 1, height: 26, background: M_BORDER }}/>
        <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED, lineHeight: 1.4 }}>plays $5/$10 &middot; refills to $300</span>
        <Btn kind="outline" h={28}>Collect</Btn>
      </div>
      <div style={{ marginTop: 9 }}><PocketBar have={640} cap={1000}/></div>
    </div>
    <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginTop: 10 }}>
      One row, between the attribute cluster and the career line. It carries <b style={{ color: M_DIM }}>money and stakes only</b> &mdash; no attribute, no band, no mood &mdash; because the pocket decides which tables he sits at and nothing about how well he plays at them. The desktop rail mirrors it verbatim.
    </div>
  </div>
);

// ── desktop parity ──────────────────────────────────────────────────────────
const D3WalletScreenM = () => (
  <DesktopShell>
    <DeskTopBar net="+$486" flagged="4 flagged"/>
    <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: M_BG, padding: '20px 24px' }}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
          <div style={{ flex: 1, padding: '16px 18px 17px', borderRadius: 14, background: M_PANEL_2, border: `1px solid ${M_TEAL}3D` }}>
            <Lbl size={9.5}>Your wallet</Lbl>
            <div style={{ marginTop: 6 }}><Amt size={44}>${WALLET.balance}</Amt></div>
          </div>
          {[['In pockets', `$${WALLET.staked}`, M_GOLD], ['Tonight', WALLET.session, M_TEAL], ['Playing', '2 of 4', M_TEXT]].map(([l, v, c]) => (
            <div key={l} style={{ width: 168, padding: '16px 18px', borderRadius: 14, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
              <Lbl size={9.5}>{l}</Lbl>
              <div style={{ marginTop: 6 }}><Num size={24} weight={700} color={c}>{v}</Num></div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
          <Lbl size={9.5}>Pockets</Lbl>
          <span style={{ fontSize: 11.5, color: M_MUTED }}>pocket size sets his stakes &mdash; there is no betting menu</span>
        </div>
        <div style={{ padding: '2px 16px', borderRadius: 12, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}>
          {POCKETS.map((p, i) => <PocketRow key={p.name} p={p} last={i === POCKETS.length - 1}/>)}
        </div>
      </div>
      <Panel>
        <PanelHead title="Fund" sub="AGGRESSIVE V1.3"/>
        <RailBody>
          <div style={{ padding: '12px 14px', borderRadius: 11, background: M_PANEL_2, border: `1px solid ${M_PURPLE}3D`, display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{ minWidth: 0 }}>
              <Lbl size={8.5}>Pocket now</Lbl>
              <div><Num size={19} weight={700}>$210</Num></div>
            </div>
            <div style={{ width: 1, height: 26, background: M_BORDER }}/>
            <span style={{ flex: 1, fontSize: 11.5, color: M_MUTED }}>plays $10/$20</span>
          </div>
          <div>
            <FundOption mode="topup" amount="$300"/>
            <FundOption mode="allowance" amount="$500" on/>
            <FundOption mode="auto" amount="cap $1,000"/>
            <FundOption mode="cut" sub="He finishes the hand, takes a seat at the bar, and keeps everything he has learned."/>
          </div>
          <Btn kind="primary" h={42} full>Set allowance</Btn>
        </RailBody>
      </Panel>
    </div>
  </DesktopShell>
);

Object.assign(window, {
  WALLET, POCKETS, MODE, ModeTag, PocketBar, PocketRow, FundOption, CollectCard, PocketLineSpec,
  YouWalletScreenM, FundSheetScreenM, ThreadCollectScreenM, ThreadBrokeScreenM,
  FloorBrokeScreenM, D3WalletScreenM,
});
