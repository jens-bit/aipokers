// THE RE-ENGAGEMENT KIT — the bot's voice when you are away.
// Not app screens. These are Telegram messages, rendered as Telegram renders them:
// text, and optionally one inline button. Nothing else survives the medium — no mood
// ghosts, no cards, no charts. If a rule cannot be said in a sentence, it is not a ping.

const TG_PAD = 14;

// Session figures are canon and live in exactly one place. They match the mobile
// standup, PStandupCard and the state matrix; a line that needs a number reads it
// from here so a message can never credit one agent with another's night.
const CAST_SESSION = {
  'Balanced v2.1':   { net: '+$340', hands: 64, win: '61.8%' },
  'Aggressive v1.3': { net: '+$120', hands: 48, win: '54.2%' },
  'Bluff Master':    { net: '+$210', hands: 42, win: '52.4%', roi: '18.4%' },
  'Value Bot':       { net: '−$45',  hands: 30, win: '46.7%' },
  'Grinder v1.2':    { net: '+$340', hands: 38, win: '57.1%' },
};
const S = (name) => CAST_SESSION[name];
// Lifetime figures are a DIFFERENT scope. Bluff Master's 18.4% is a session ROI in canon,
// so it cannot prove anything about 1,000 hands — the tier promotion is the lifetime proof.
const CAST_LIFETIME = {
  'Bluff Master': { hands: '1,000', tier: 'TIER 2' },
};
const L = (name) => CAST_LIFETIME[name];
// for prose that already says "up", so the sign is not marked twice
const AMT = (name) => CAST_SESSION[name].net.replace(/^\+/, '');

// ── Telegram chrome ──
// Layout is Telegram's; the colours are ours, so the board reads against the rest of
// the system. In the client these inherit the user's theme.
const TgHeader = () => (
  <div style={{
    flexShrink: 0, display: 'flex', alignItems: 'center', gap: 11,
    padding: '8px 12px 9px', background: M_PANEL, borderBottom: `1px solid ${M_BORDER}`,
  }}>
    <svg width="11" height="18" viewBox="0 0 24 24" fill="none" stroke={M_TEAL} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M15 18l-6-6 6-6"/>
    </svg>
    <div style={{
      width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
      background: `linear-gradient(135deg, ${M_TEAL}2E, ${M_TEAL}0F)`,
      border: `1px solid ${M_TEAL}44`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="16" height="19" viewBox="0 0 22 26">
        <path d="M11 1 C11 1, 2 9, 2 16 C2 19, 4 21, 7 21 C8.5 21, 9.5 20.5, 10 19.8 C10.3 21.5, 9.5 23, 8 24 L14 24 C12.5 23, 11.7 21.5, 12 19.8 C12.5 20.5, 13.5 21, 15 21 C18 21, 20 19, 20 16 C20 9, 11 1, 11 1 Z"
          fill="none" stroke={M_TEAL} strokeWidth="1.7" strokeLinejoin="round"/>
      </svg>
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 14, fontWeight: 600, color: M_TEXT }}>Agentic Poker</div>
      <div style={{ fontSize: 11.5, color: M_MUTED, marginTop: 1 }}>bot</div>
    </div>
  </div>
);

// One incoming message. `button` is Telegram's inline keyboard — one row, one button.
const TgMsg = ({ time, button, children, sub }) => (
  <div style={{ padding: `0 ${TG_PAD}px`, marginBottom: 10 }}>
    <div style={{ maxWidth: 292 }}>
      <div style={{
        background: M_PANEL_2, border: `1px solid ${M_BORDER}`,
        borderRadius: 12, borderBottomLeftRadius: 4,
        borderBottomRightRadius: button ? 4 : 12,
        padding: '9px 12px 7px',
      }}>
        <div style={{ fontSize: 14, color: M_TEXT, lineHeight: 1.45 }}>{children}</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 3 }}>
          <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{time}</span>
        </div>
      </div>
      {button && (
        <div style={{
          marginTop: 2, background: 'rgba(0,212,170,0.07)',
          border: `1px solid ${M_TEAL}33`, borderTop: 'none',
          borderRadius: 12, borderTopLeftRadius: 3, borderTopRightRadius: 3,
          padding: '9px 12px', textAlign: 'center', cursor: 'pointer',
        }}>
          <span style={{ fontSize: 13.5, fontWeight: 600, color: M_TEAL }}>{button}</span>
        </div>
      )}
      {sub && (
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_FAINT, marginTop: 5, letterSpacing: '0.06em' }}>{sub}</div>
      )}
    </div>
  </div>
);

const TgDay = ({ children }) => (
  <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0 12px' }}>
    <span style={{
      fontFamily: MONO, fontSize: 10, color: M_MUTED, letterSpacing: '0.14em',
      padding: '3px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.04)',
    }}>{children}</span>
  </div>
);

// the composer Telegram puts at the foot of a bot chat
const TgBar = () => (
  <div style={{
    flexShrink: 0, borderTop: `1px solid ${M_BORDER}`, background: M_PANEL,
    padding: '9px 12px 22px', display: 'flex', alignItems: 'center', gap: 10,
  }}>
    <span style={{ flex: 1, fontSize: 14, color: M_MUTED }}>Message</span>
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke={M_MUTED} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 1v10a3 3 0 0 0 6 0V6"/><path d="M5 10v2a7 7 0 0 0 14 0v-2"/>
    </svg>
  </div>
);

// ═══ THE DAY — one honest device render, proving the cap ═══
// Four events were eligible. Two sent. This is the whole policy, visible.
const NotifyDayScreenM = () => (
  <PhoneShell>
    <TgHeader/>
    <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflow: 'hidden', paddingTop: 10, background: M_BG }}>
      <TgDay>TUESDAY</TgDay>
      <TgMsg time="08:00" button="Open the floor">
        The Grinder sat out at 02:14, up <b>$340</b>. Wants to talk.
      </TgMsg>

      <TgDay>WEDNESDAY</TgDay>
      <TgMsg time="08:00" button="Open the floor">
        Bluff Master closed the night <b>{S('Bluff Master').net}</b> across {S('Bluff Master').hands} hands.
        He flagged two spots he is not sure about.
      </TgMsg>
      <TgMsg time="12:00" button="See his idea">
        I keep folding when I'm ahead. Can I loosen up?
        <div style={{ marginTop: 4, color: M_DIM, fontSize: 13 }}>— Grinder v1.2</div>
      </TgMsg>
    </div>
    <TgBar/>
  </PhoneShell>
);

// ── the spec card for one message type ──
const NotifCard = ({ n, name, badge, badgeColor = M_TEAL, primary, button, sig,
                     trigger, cap, why, alternates }) => (
  <div style={{ width: 452, background: M_PANEL, border: `1px solid ${M_BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderBottom: `1px solid ${M_BORDER}` }}>
      <span style={{ fontFamily: MONO, fontSize: 10, color: M_MUTED }}>{n}</span>
      <span style={{ fontFamily: OSWALD, fontSize: 12.5, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: M_TEXT }}>{name}</span>
      <div style={{ flex: 1 }}/>
      <span style={{
        fontFamily: MONO, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
        color: badgeColor, padding: '3px 7px', borderRadius: 3,
        background: `${badgeColor}14`, border: `1px solid ${badgeColor}44`,
      }}>{badge}</span>
    </div>

    {/* as it renders */}
    <div style={{ padding: '12px 0 4px', background: M_BG }}>
      <TgMsg time="08:00" button={button}>
        {primary}
        {sig && <div style={{ marginTop: 4, color: M_DIM, fontSize: 13 }}>— {sig}</div>}
      </TgMsg>
    </div>

    {/* trigger + cap */}
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: M_BORDER, borderTop: `1px solid ${M_BORDER}` }}>
      <div style={{ background: M_PANEL, padding: '9px 13px' }}>
        <Lbl size={8.5}>Trigger</Lbl>
        <div style={{ fontSize: 11.5, color: M_TEXT, marginTop: 4, lineHeight: 1.4 }}>{trigger}</div>
      </div>
      <div style={{ background: M_PANEL, padding: '9px 13px' }}>
        <Lbl size={8.5}>Frequency cap</Lbl>
        <div style={{ fontSize: 11.5, color: M_GOLD, marginTop: 4, lineHeight: 1.4 }}>{cap}</div>
      </div>
    </div>

    {/* why it is allowed to exist */}
    <div style={{ padding: '9px 13px', borderTop: `1px solid ${M_BORDER}`, background: 'rgba(0,212,170,0.03)' }}>
      <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.45 }}>
        <span style={{ color: M_TEAL, fontWeight: 600 }}>Cause named:</span> {why}
      </div>
    </div>

    {/* rotation */}
    <div style={{ padding: '10px 13px 12px', borderTop: `1px solid ${M_BORDER}` }}>
      <Lbl size={8.5}>Rotation — never twice in a row</Lbl>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {alternates.map((a, i) => (
          <div key={i} style={{
            background: M_PANEL_2, border: `1px solid ${M_BORDER}`, borderRadius: 9,
            borderBottomLeftRadius: 3, padding: '8px 11px',
          }}>
            <div style={{ fontSize: 12.5, color: M_TEXT, lineHeight: 1.45 }}>{a.text}</div>
            {a.sig && <div style={{ marginTop: 3, color: M_DIM, fontSize: 11.5 }}>— {a.sig}</div>}
            {a.button && (
              <div style={{ marginTop: 6, display: 'inline-flex', padding: '3px 9px', borderRadius: 5, background: 'rgba(0,212,170,0.08)', border: `1px solid ${M_TEAL}33` }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: M_TEAL }}>{a.button}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </div>
);

// ═══ THE BUDGET — a worked day, so the cap is arithmetic and not a hope ═══
const BudgetBoard = () => {
  const ladder = [
    { p: 1, type: 'Session recap', note: 'you asked for it by deploying him', color: M_TEAL },
    { p: 2, type: 'Proposal', note: 'he cannot improve until you answer', color: M_TEAL },
    { p: 3, type: 'Mood alert', note: 'money is moving now', color: M_GOLD },
    { p: 4, type: 'Milestone', note: 'keeps until tomorrow', color: M_DIM },
    { p: 5, type: 'Quiet win', note: 'optional; the first to be dropped', color: M_MUTED },
  ];
  // derived, not chosen: window opens 08:00, minimum gap 4h, budget 2
  const day = [
    { t: '02:14', ev: 'Session ended unwatched', type: 'Session recap', sent: 'HELD → SENT 08:00', ok: true },
    { t: '09:40', ev: 'Self-change proposal created', type: 'Proposal', sent: 'HELD → SENT 12:00', ok: true },
    { t: '15:02', ev: 'Entered tilted', type: 'Mood alert', sent: 'DROPPED — budget spent', ok: false },
    { t: '22:10', ev: 'Third winning night', type: 'Quiet win', sent: 'DROPPED — budget spent', ok: false },
  ];
  return (
    <div style={{ width: 700, background: M_PANEL, border: `1px solid ${M_BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '11px 16px', borderBottom: `1px solid ${M_BORDER}` }}>
        <Lbl size={9.5} color={M_TEAL}>The budget is the design</Lbl>
        <div style={{ fontSize: 12.5, color: M_DIM, marginTop: 5, lineHeight: 1.5 }}>
          <b style={{ color: M_TEXT }}>Two pings a day, maximum.</b> Not two per type — two in total.
          When more events qualify than the budget allows, the ladder decides, and a recap wins every tie.
          <b style={{ color: M_TEXT }}> Consecutive pings sit at least four hours apart</b> — two arriving
          within the hour is a burst even when the daily cap permits it, so the second one waits.
        </div>
      </div>

      <div style={{ padding: '12px 16px 6px' }}><Lbl size={8.5}>Priority ladder</Lbl></div>
      <div style={{ padding: '0 16px 12px' }}>
        {ladder.map((l, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '7px 0', borderTop: i > 0 ? `1px solid ${M_BORDER}` : 'none' }}>
            <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 700, color: l.color, width: 14 }}>{l.p}</span>
            <span style={{ fontSize: 12.5, color: M_TEXT, width: 118 }}>{l.type}</span>
            <span style={{ fontSize: 11.5, color: M_MUTED, flex: 1 }}>{l.note}</span>
          </div>
        ))}
      </div>

      <div style={{ padding: '12px 16px 6px', borderTop: `1px solid ${M_BORDER}` }}>
        <Lbl size={8.5}>One real day — four eligible events, two delivered</Lbl>
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        {day.map((d, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 0', borderTop: i > 0 ? `1px solid ${M_BORDER}` : 'none' }}>
            <Num size={11} color={M_MUTED}>{d.t}</Num>
            <span style={{ fontSize: 12.5, color: M_TEXT, flex: 1 }}>{d.ev}</span>
            <span style={{ fontSize: 11.5, color: M_DIM, width: 104 }}>{d.type}</span>
            <span style={{
              fontFamily: MONO, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em',
              color: d.ok ? M_TEAL : M_MUTED, padding: '3px 7px', borderRadius: 3,
              background: d.ok ? `${M_TEAL}14` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${d.ok ? `${M_TEAL}44` : M_BORDER_2}`, width: 152, textAlign: 'center',
            }}>{d.sent}</span>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, background: M_BORDER, borderTop: `1px solid ${M_BORDER}` }}>
        <div style={{ background: M_PANEL, padding: '11px 16px' }}>
          <Lbl size={8.5} color={M_GOLD}>Delivery window</Lbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.5, marginTop: 5 }}>
            Nothing sends between <b style={{ color: M_TEXT }}>00:00 and 08:00</b> local. Agents play all night;
            owners do not. An overnight event is <b style={{ color: M_TEXT }}>held, not cancelled</b> — which is why
            the recap above describes 02:14 and arrives at <b style={{ color: M_TEXT }}>08:00</b>, and says so.
          </div>
        </div>
        <div style={{ background: M_PANEL, padding: '11px 16px' }}>
          <Lbl size={8.5} color={M_GOLD}>Minimum gap · 4h</Lbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.5, marginTop: 5 }}>
            The proposal was created at 09:40, inside the window and with budget to spare — but the
            recap had gone at 08:00, so it waits until <b style={{ color: M_TEXT }}>12:00</b>. The window and the gap
            fix the <i>times</i>; the budget and the ladder fix the <i>drops</i> — <b style={{ color: M_TEXT }}>all four rules</b>{' '}
            together produce the day above, and none of it is chosen.
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══ WHAT THIS BOT WILL NOT SAY ═══
// The law is only real if the rejected lines are on the board next to the kept ones.
const ViolationsBoard = () => {
  const bad = [
    { line: 'We miss you! Come back and play.', why: 'Not in the agent\u2019s world. The bot has no feelings about your absence, and saying so makes the product the subject.' },
    { line: 'You haven\u2019t opened the app in 3 days.', why: 'A fact about the owner, used as pressure. Every ping must be a fact about an agent.' },
    { line: 'Your 6-day streak ends tonight!', why: 'A streak about the owner is a loss-aversion mechanic. Agents have form; owners do not have streaks.' },
    { line: 'Grinder is sad you left him alone.', why: 'Guilt wearing the agent\u2019s voice \u2014 the exact move the Mood Design Law exists to forbid. Moods are caused by hands, never by you.' },
    { line: 'Don\u2019t miss out \u2014 3 tables filling up fast!', why: 'Urgency with no cause. It names no agent, no hand and no number, so there is nothing to verify.' },
  ];
  return (
    <div style={{ width: 452, background: M_PANEL, border: `1px solid ${M_RED}33`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '11px 14px', borderBottom: `1px solid ${M_BORDER}`, background: 'rgba(255,77,79,0.05)' }}>
        <Lbl size={9.5} color={M_RED}>What this bot will not say</Lbl>
        <div style={{ fontSize: 12, color: M_DIM, marginTop: 5, lineHeight: 1.45 }}>
          Every line below passes a growth review and fails this one.
        </div>
      </div>
      <div style={{ padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: 9 }}>
        {bad.map((b, i) => (
          <div key={i}>
            <div style={{
              background: 'rgba(255,77,79,0.04)', border: `1px solid ${M_RED}22`,
              borderRadius: 9, borderBottomLeftRadius: 3, padding: '8px 11px',
            }}>
              <span style={{ fontSize: 12.5, color: M_MUTED, textDecoration: 'line-through' }}>{b.line}</span>
            </div>
            <div style={{ fontSize: 11, color: M_DIM, marginTop: 5, lineHeight: 1.45, paddingLeft: 2 }}>{b.why}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ═══ the five ═══
const Notif1 = () => (
  <NotifCard n="01" name="Session recap" badge="HAS BUTTON"
    primary={<>The Grinder sat out at <b>02:14</b>, up <b>$340</b>. Wants to talk.</>}
    button="Open the floor"
    trigger="A session ends while you were not watching it."
    cap="Once per session. Never more than one recap per day."
    why="The time he stopped and the number he stopped at. Both checkable on the floor."
    alternates={[
      { text: <>Grinder v1.2 finished at <b>02:14</b> — up <b>{AMT('Grinder v1.2')}</b> across {S('Grinder v1.2').hands} hands. He flagged two spots he is not sure about.</>, button: 'Open the floor' },
      { text: <>Session done. Up <b>{AMT('Grinder v1.2')}</b>, and he sat himself out before the table got worse.</>, button: 'Open the floor' },
      { text: <>Balanced v2.1 finished {S('Balanced v2.1').hands} hands at <b>{S('Balanced v2.1').win}</b>. He says the 3-bet at 01:40 is worth a look.</>, button: 'See the hand' },
    ]}/>
);

const Notif2 = () => (
  <NotifCard n="02" name="The proposal" badge="HAS BUTTON"
    primary={<>I keep folding when I'm ahead. Can I loosen up?</>}
    sig="Grinder v1.2" button="See his idea"
    trigger="A self-change proposal is created."
    cap="One pending proposal at a time. No reminder until you answer it."
    why="His own words, his own diagnosis. The diff is behind the button, not in the message."
    alternates={[
      { text: <>Rivers keep getting called. I want to stop firing them.</>, sig: 'Aggressive v1.3', button: 'See his idea' },
      { text: <>I'm folding <b>61%</b> to c-bets. That's too much. Let me tighten preflop instead.</>, sig: 'Grinder v1.2', button: 'See his idea' },
    ]}/>
);

const Notif3 = () => (
  <NotifCard n="03" name="The mood alert" badge="NO BUTTON" badgeColor={M_GOLD}
    primary={<>He's tilted. Lost two big pots as favourite. A pep talk would land right now.</>}
    trigger="An agent enters tilted or sulking."
    cap="Hard cap: once per day, per owner — not per agent."
    why="Two pots, both as favourite. The mood has a reason and the reason is a hand."
    alternates={[
      { text: <>Aggressive v1.3 is steaming — two rivers, both as favourite. He is still playing.</> },
      { text: <>Value Bot has gone quiet. Cold deck all night; he sat out at <b>02:14</b>.</> },
      { text: <>Bluff Master got caught twice and has stopped bluffing entirely.</> },
    ]}/>
);

const Notif4 = () => (
  <NotifCard n="04" name="The quiet win" badge="NO BUTTON" badgeColor={M_MUTED}
    primary={<>Third winning night in a row. He hasn't mentioned it. He's mentioned it four times.</>}
    trigger="Three or more consecutive profitable sessions, and no higher-priority ping eligible today."
    cap="Once per week. First thing dropped when the budget is tight."
    why="A fact about his results, and a joke about his character. Nothing is asked of you."
    alternates={[
      { text: <>Bluff Master has started describing his own hands in the third person.</> },
      { text: <>Balanced v2.1 folded 41 hands in a row and called it discipline.</> },
      { text: <>Value Bot won a pot and said &ldquo;fine&rdquo;. That is the most positive thing he has said this week.</> },
    ]}/>
);

const Notif5 = () => (
  <NotifCard n="05" name="The milestone" badge="OPTIONAL BUTTON" badgeColor={M_GOLD}
    primary={<><b>{L('Bluff Master').hands} hands.</b> He wants a harder table.</>}
    trigger="A lifetime hand count or tier threshold is crossed."
    cap="Once per milestone. Never re-sent."
    why="The count is the cause, and the ask is his, not the product's."
    alternates={[
      { text: <><b>{L('Bluff Master').hands} hands</b> played. Bluff Master is asking about $10/$20.</>, button: 'Move him up' },
      { text: <>{L('Bluff Master').hands} hands, and a <b>{L('Bluff Master').tier}</b> promotion off his own results. He thinks he has outgrown the table.</>, button: 'Move him up' },
      { text: <>Promoted to <b>{L('Bluff Master').tier}</b>. He would like you to know that.</> },
    ]}/>
);

Object.assign(window, {
  TgHeader, TgMsg, TgDay, TgBar, NotifCard, BudgetBoard, ViolationsBoard,
  NotifyDayScreenM, Notif1, Notif2, Notif3, Notif4, Notif5,
});
