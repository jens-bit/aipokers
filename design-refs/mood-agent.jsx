// ═════════════════════════════════════════════════════════════════
// WAVE 63 · PART C — THE AGENT VIEW  (C1–C4)
//
// The 7 Sep playtest verdict on the old agent page: "it's too much, I have no
// idea what is going on." It was a chat page with a tiny avatar, COMPOSURE and
// READS upgrade cards wedged between the lines, and a profile that printed his
// name twice.
//
// The fix is not a cleaner chat. When you tap him you get HIM: the character
// fills the upper half at the size he deserves, animated the way he is in the
// room, and the conversation is what is left over — his line first, in his
// voice. Everything that was a card is either furniture (the action row) or
// gone to the profile (RECENT).
// ═════════════════════════════════════════════════════════════════

// measured for 844: 44 status (the shell's) + 40 header + 270 stage + 66 actions
// + 344 conversation + 76 composer. The stage NEVER scrolls — only the lower half
// does, which is the whole point of C3.
//
// WAVE 63 fix: the stage was 336 and the thread 272, which held 462px of C3's
// authored content in a fixed-height flex column pinned to its bottom — so the
// three exchanges the frame exists to show overflowed out of the TOP with no
// scroll to reach them. Three root causes, all three fixed: the stage gave back
// 52px, the thread became a real scroll container (nothing is unreachable), and
// the inline hand card is now its own compact variant instead of the 196px-tall
// poster ReplayCard, which was the actual space hog. C3's six messages measure
// 338px against 344px of room — all three exchanges fit with a little slack.
const AG = { header: 40, stage: 264, actions: 66, composer: 76 };

const AG_CAST = {
  bal: { id: 'bal', name: 'Balanced v2.1', nick: 'Bal',  mood: 'confident',  nature: 'Rock',    heat: 22, stam: 78 },
  agg: { id: 'agg', name: 'Aggressive v1.3', nick: 'Agg', mood: 'tilted',    nature: 'Hothead', heat: 84, stam: 41 },
  blf: { id: 'blf', name: 'Bluff Master',  nick: 'Bluff', mood: 'frustrated', nature: 'Showman', heat: 58, stam: 62 },
  val: { id: 'val', name: 'Value Bot',     nick: 'Value', mood: 'sulking',   nature: 'Grinder', heat: 12, stam: 24 },
};

// ── the header. His name once, and that is the sheet's title. ─────────────
// The old profile printed the name in the title AND on the card under it. There
// is one name on this screen and this is it.
const AgentHeader = ({ a, live = 'LIVE' }) => {
  const m = MOODS[a.mood];
  return (
    <div style={{ flexShrink: 0, height: AG.header, display: 'flex', alignItems: 'center', gap: 9, padding: '0 12px', background: '#0C1211', borderBottom: `1px solid ${V5GLASS.edge}` }}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke={M_DIM} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, cursor: 'pointer' }}><path d="M15 18l-6-6 6-6"/></svg>
      <span style={{ fontSize: 14, fontWeight: 600, color: M_TEXT, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, padding: '2.5px 7px', borderRadius: 4, background: `${m.color}1A`, border: `1px solid ${m.color}4D` }}>
        <span style={{ width: 4, height: 4, borderRadius: '50%', background: m.color }}></span>
        <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: m.color }}>{m.label}</span>
      </span>
      <span style={{ flex: 1 }}></span>
      {live && (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, padding: '2.5px 7px', borderRadius: 4, border: `1px solid ${live === 'LIVE' ? M_TEAL : M_MUTED}4D`, cursor: 'pointer' }}>
          {live === 'LIVE' && <span style={{ width: 4, height: 4, borderRadius: '50%', background: M_TEAL, animation: 'pulse 2s ease-in-out infinite' }}></span>}
          <span style={{ fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.12em', color: live === 'LIVE' ? M_TEAL : M_MUTED }}>{live}</span>
        </span>
      )}
    </div>
  );
};

// ── the name pill. Exactly the room's pill: ≤6 characters, bars anchored left. ──
const AgentPill = ({ a, stamina, heat, unread }) => (
  <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '3px 8px 5px', borderRadius: 8, background: 'rgba(8,12,12,0.9)', border: `1px solid ${unread ? `${M_GOLD}66` : M_BORDER}`, whiteSpace: 'nowrap' }}>
    <span style={{ fontSize: 9.5, color: M_TEXT, lineHeight: 1.1 }}>{pillName(a.name, a.nick)}</span>
    <ResourceBars stamina={stamina} heat={heat} w={52} h={2.2} gap={2.2}/>
  </div>
);

// ── his bubble. The room's bubble at the room's width, tail from the side. ──
const AgentBubble = ({ text, gold, side = 'right', w = 150 }) => {
  const fill = gold ? '#2A2415' : 'rgba(20,28,27,0.94)';
  const edge = gold ? `${M_GOLD}66` : 'rgba(255,255,255,0.14)';
  return (
    <div style={{ position: 'relative', width: 'max-content', maxWidth: w, padding: '6px 10px', borderRadius: 11, background: fill, border: `1px solid ${edge}` }}>
      <div style={{ fontSize: 11, color: gold ? M_GOLD : M_DIM, lineHeight: 1.38, textWrap: 'pretty' }}>{text}</div>
      <span style={{ position: 'absolute', top: 13, [side === 'right' ? 'left' : 'right']: -4, width: 7, height: 7, background: fill, borderLeft: `1px solid ${edge}`, borderBottom: `1px solid ${edge}`, transform: 'rotate(45deg)' }}></span>
    </div>
  );
};

// ── THE STAGE · him, large, in the upper half ─────────────────────────────
// His whole silhouette at 154px: hood × glow fixed for life, the eyes doing the
// mood, the hands floating, a bottle if he has one. NOTHING is written on him —
// the pill floats above his head and that is the only text he carries.
const AgentStage = ({ a, size = 178, says, want, answers, bottle, dim, h = AG.stage }) => {
  const id = idFor(a.id);
  const cx = 142;                    // he stands left of centre so the bubble has room
  const feet = h - 24;
  return (
    <div style={{ position: 'relative', flexShrink: 0, height: h, overflow: 'hidden', background: 'radial-gradient(ellipse at 42% 62%, #1E2826 0%, #151D1C 58%, #101615 100%)', opacity: dim ? 0.4 : 1 }}>
      {/* the floor he stands on: the flat's own boards, so the room is still the room */}
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{ position: 'absolute', left: 0, right: 0, top: h - 172 + i * 42, height: 1, background: 'rgba(255,255,255,0.028)' }}></div>
      ))}
      <div style={{ position: 'absolute', left: cx - 116, top: feet - 250, width: 232, height: 250, background: `radial-gradient(ellipse at 50% 74%, ${id.glow.c}14, transparent 68%)`, pointerEvents: 'none' }}></div>
      {/* his shadow — without it he floats, and he is standing */}
      <div style={{ position: 'absolute', left: cx - size * 0.36, top: feet - 7, width: size * 0.72, height: 13, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 72%)' }}></div>

      <div style={{ position: 'absolute', left: cx, top: feet, transform: 'translate(-50%,-100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 }}>
        <AgentPill a={a} stamina={a.stam} heat={a.heat}/>
        <div style={{ position: 'relative', width: size, height: size, animation: 'agentBreathe 4.2s ease-in-out infinite' }}>
          <MoodGhost mood={a.mood} accent={id.glow.c} size={size} ring={false} hood={id.hood} glow={id.glow.c}/>
          <svg width={size} height={size} viewBox="0 0 80 80" style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' }}>
            {ghostHands({ pose: 'rest', size, grip: SEAT_GRIP })}
          </svg>
          {bottle && (
            <div style={{ position: 'absolute', right: -6, top: size * 0.52, width: 11, height: 30 }}>
              <div style={{ position: 'absolute', left: 3, top: 0, width: 5, height: 9, borderRadius: 1, background: '#3E5B32' }}></div>
              <div style={{ position: 'absolute', left: 0, top: 8, width: 11, height: 22, borderRadius: '2px 2px 3px 3px', background: 'linear-gradient(100deg,#4A6B3A,#2C4222)', border: '1px solid rgba(0,0,0,0.4)' }}></div>
              <div style={{ position: 'absolute', left: 1.5, top: 15, width: 8, height: 7, borderRadius: 1, background: `${M_GOLD}44` }}></div>
            </div>
          )}
        </div>
      </div>

      {/* what he is saying, beside his head, tail pointing back at him */}
      {(says || want) && (
        <div style={{ position: 'absolute', left: cx + size * 0.44, top: feet - size * 0.97, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, zIndex: 6 }}>
          {want ? <AgentBubble text={want} gold/> : <AgentBubble text={says}/>}
          {/* the WantToast's own three buttons, under the want bubble and NOWHERE else */}
          {answers && (
            <div style={{ display: 'flex', gap: 5 }}>
              {[['Yes', M_TEAL], ['Later', M_MUTED], ['No', M_MUTED]].map(([t, c]) => (
                <span key={t} style={{ padding: '4px 10px', borderRadius: 13, background: t === 'Yes' ? `${M_TEAL}1F` : 'rgba(255,255,255,0.05)', border: `1px solid ${t === 'Yes' ? `${M_TEAL}66` : M_BORDER}`, fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', color: t === 'Yes' ? M_TEAL : M_DIM, cursor: 'pointer' }}>{t.toUpperCase()}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── THE ACTION ROW · glass, one row of four, the felt's whisper-row height ──
// Deploy reads his pocket and the table he would sit at, on the button, because a
// button that says only "Deploy" is a question you have to leave to answer.
const AG_ICON = {
  chips: c => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><ellipse cx="12" cy="8" rx="7" ry="3.2"/><path d="M5 8v5c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V8"/><path d="M5 13v3.5c0 1.8 3.1 3.2 7 3.2s7-1.4 7-3.2V13"/></svg>,
  carry: c => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M8 21V10a4 4 0 0 1 8 0v11"/><path d="M5 21h14"/><path d="M12 6V3"/></svg>,
  profile: c => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c0-3.6 3.1-5.6 7-5.6s7 2 7 5.6"/></svg>,
};

const AgentActions = ({ stakes = '25/50', pocket = '1,200', deployable = true }) => (
  <div style={{ flexShrink: 0, height: AG.actions, display: 'flex', alignItems: 'center', gap: 6, padding: '0 12px', background: 'linear-gradient(180deg, rgba(16,26,24,0) 0%, #101A18 42%)' }}>
    <V5Glass up pad="0 12px" style={{ flex: 1.85, height: 46, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer', borderColor: deployable ? `${M_TEAL}59` : V5GLASS.edge, background: deployable ? `${M_TEAL}1C` : undefined }}>
      <span style={{ fontFamily: OSWALD, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.14em', color: deployable ? M_TEAL : M_MUTED, whiteSpace: 'nowrap' }}>DEPLOY</span>
      <span style={{ fontFamily: MONO, fontSize: 10, color: deployable ? M_DIM : M_MUTED, whiteSpace: 'nowrap' }}>{stakes} · ${pocket}</span>
    </V5Glass>
    {[['GIVE CHIPS', 'chips'], ['CARRY', 'carry'], ['PROFILE', 'profile']].map(([lbl, ic]) => (
      <V5Glass key={lbl} pad="0" style={{ flex: 1, height: 46, borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}>
        {AG_ICON[ic](M_DIM)}
        <span style={{ fontFamily: OSWALD, fontSize: 7.5, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED, whiteSpace: 'nowrap' }}>{lbl}</span>
      </V5Glass>
    ))}
  </div>
);

// ── the conversation. His head beside his line; nothing is a card but a hand. ──
const AgentHead = ({ a, size = 26 }) => {
  const id = idFor(a.id);
  return <div style={{ width: size, height: size, flexShrink: 0 }}><MoodGhost mood={a.mood} accent={id.glow.c} size={size} ring={false} hood={id.hood} glow={id.glow.c}/></div>;
};

const AgentLine = ({ a, mine, text, at, hand }) => (
  <div style={{ flexShrink: 0, display: 'flex', gap: 7, alignItems: 'flex-end', justifyContent: mine ? 'flex-end' : 'flex-start' }}>
    {!mine && <AgentHead a={a}/>}
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: mine ? 'flex-end' : 'flex-start', maxWidth: 252 }}>
      <div style={{ padding: '6px 10px', borderRadius: mine ? '12px 12px 3px 12px' : '12px 12px 12px 3px', background: mine ? `${M_GOLD}1A` : 'rgba(20,28,27,0.94)', border: `1px solid ${mine ? `${M_GOLD}44` : 'rgba(255,255,255,0.13)'}` }}>
        <span style={{ fontSize: 11.5, color: mine ? M_GOLD : M_DIM, lineHeight: 1.38, textWrap: 'pretty' }}>{text}</span>
      </div>
      {hand}
      {at && <span style={{ fontFamily: MONO, fontSize: 8.5, color: M_FAINT }}>{at}</span>}
    </div>
  </div>
);

// A hand he mentions is the ONE card a conversation may hold, because it is a hand
// and not an explanation. But the replay card is a POSTER — 196px tall, built to
// end a thread, not to sit inside a sentence. This is its inline variant: the
// board, the pot, one line, 62px, same tap target and same replay.
const AgentHandCard = ({ board = [['K', 's'], ['9', 'h'], ['4', 'c'], ['Q', 'd'], ['2', 's']], pot = '3,694', line = 'Ace-high. He folded.', flag = 'BLUFF' }) => (
  <div style={{ width: 222, borderRadius: 8, background: 'linear-gradient(180deg, rgba(24,40,37,0.94), rgba(16,26,24,0.94))', border: `1px solid ${M_TEAL}3D`, padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
    <div style={{ display: 'flex', gap: 1.5, flexShrink: 0 }}>
      {board.map((c, i) => (
        <span key={i} style={{ width: 13, height: 18, borderRadius: 1.5, background: '#E8E6E0', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', lineHeight: 1, fontFamily: MONO, fontSize: 7, fontWeight: 700, color: c[1] === 'h' || c[1] === 'd' ? '#B4353A' : '#12100F' }}>
          {c[0]}<span style={{ fontSize: 6 }}>{c[1] === 'h' ? '\u2665' : c[1] === 'd' ? '\u2666' : c[1] === 'c' ? '\u2663' : '\u2660'}</span>
        </span>
      ))}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
        <Num size={11} weight={700} color={M_TEAL}>${pot}</Num>
        <span style={{ fontFamily: OSWALD, fontSize: 6.5, fontWeight: 600, letterSpacing: '0.1em', color: M_TEAL, border: `1px solid ${M_TEAL}59`, borderRadius: 2.5, padding: '1px 3.5px' }}>{flag}</span>
      </div>
      <div style={{ fontSize: 9.5, color: M_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 1.5 }}>{line}</div>
    </div>
    <span style={{ fontFamily: OSWALD, fontSize: 6.5, fontWeight: 600, letterSpacing: '0.1em', color: M_GOLD, flexShrink: 0 }}>REPLAY</span>
  </div>
);

// The lower half, and the ONLY thing on this screen that scrolls. justify-content
// is flex-start with the first child pushed down by margin-top:auto, so a short
// conversation still sits on the composer and a long one scrolls instead of
// escaping out of the top.
//
// no-scrollbar is not decoration: this is a 390px phone, and a classic 15px
// desktop scrollbar inside it both lies about the platform and steals 15px of
// bubble width the moment the thread grows past six messages. Every scroll region
// in the system already carries it.
const AgentThread = ({ a, rows = [], children }) => (
  <div className="no-scrollbar" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '8px 12px 4px', display: 'flex', flexDirection: 'column', gap: 8, background: '#0D1413' }}>
    <span style={{ marginTop: 'auto' }}></span>
    {rows.map((r, i) => <AgentLine key={i} a={a} {...r}/>)}
    {children}
  </div>
);

// ── the composer: the bottom strip, one field, the arrow inside it ────────
const AgentComposer = ({ draft }) => (
  <div style={{ flexShrink: 0, height: AG.composer, padding: '10px 12px 24px', background: '#101A18', borderTop: `1px solid ${V5GLASS.edge}` }}>
    <V5Glass pad="0 6px 0 14px" style={{ display: 'flex', alignItems: 'center', height: 42, borderRadius: 21 }}>
      <span style={{ flex: 1, fontSize: 12.5, color: draft ? M_TEXT : M_MUTED, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{draft || 'Whisper to him'}</span>
      <button style={{ width: 30, height: 30, borderRadius: '50%', background: draft ? M_TEAL : 'rgba(255,255,255,0.07)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={draft ? '#0A0A0A' : M_MUTED} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>
      </button>
    </V5Glass>
  </div>
);

// ═══ C1 · THE AGENT ══════════════════════════════════════════════════════
const AgentSheetM = () => {
  const a = AG_CAST.bal;
  return (
    <PhoneShell>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D1413' }}>
        <AgentHeader a={a}/>
        <AgentStage a={a} bottle/>
        <AgentActions/>
        <AgentThread a={a} rows={[
          { text: 'Put me in.', at: '21:04' },
        ]}/>
        <AgentComposer/>
      </div>
    </PhoneShell>
  );
};

// ═══ C2 · HIS LINE FIRST ═════════════════════════════════════════════════
// The first thing in the conversation is his, not yours. If he has a want, the
// three buttons live under HIS bubble on the stage — never in the thread, never
// as a card, never twice.
const AgentWantM = () => {
  const a = AG_CAST.agg;
  return (
    <PhoneShell>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D1413' }}>
        <AgentHeader a={a} live="WATCH"/>
        <AgentStage a={a} want="Let me back in there. Right now." answers/>
        <AgentActions stakes="10/20" pocket="640"/>
        <AgentThread a={a} rows={[
          { text: 'Still thinking about that cooler against The Grinder.', at: '20:58' },
        ]}/>
        <AgentComposer/>
      </div>
    </PhoneShell>
  );
};

// ═══ C3 · THE WHISPER ════════════════════════════════════════════════════
// You type; he answers beside his head. He does not scroll away — the stage is
// fixed and the conversation scrolls under it. Three exchanges, and the one hand
// he mentions is a hand card.
const AgentWhisperM = () => {
  const a = AG_CAST.bal;
  return (
    <PhoneShell>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D1413' }}>
        <AgentHeader a={a}/>
        <AgentStage a={a} says="It was the sizing. He never bets that big with a hand."/>
        <AgentActions/>
        <AgentThread a={a} rows={[
          { mine: true, text: 'Why did you call there?' },
          { text: 'It was the sizing. He never bets that big with a hand.' },
          { mine: true, text: 'Which hand?' },
          { text: 'This one.', hand: <AgentHandCard/> },
          { mine: true, text: 'Stay off him for a bit.' },
          { text: 'Fine. I will wait for the button.' },
        ]}/>
        <AgentComposer draft="Stay off him for a bit."/>
      </div>
    </PhoneShell>
  );
};

// ═══ C4 · WHAT LEFT THE CHAT ═════════════════════════════════════════════
// The COMPOSURE / READS upgrade cards are gone from the conversation. They are
// one line each under RECENT, newest first, and the label is still the tap
// target for the old explainer — the explainer was never the problem, its
// position in the middle of a sentence was.
const AG_RECENT = [
  { k: '+READS',    where: 'hand #2', what: 'he had The Grinder read', when: '4m' },
  { k: '+COMPOSURE', where: 'hand #7', what: 'held after the cooler', when: '18m' },
  { k: '−COMPOSURE', where: 'hand #11', what: 'steaming when he played this one', when: '26m', bad: true },
  { k: '+READS',    where: 'hand #14', what: 'called the river sizing', when: '41m' },
];

const AgentRecentRow = ({ r }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: `1px solid ${M_BORDER}` }}>
    <span style={{ flexShrink: 0, padding: '2px 6px', borderRadius: 3, background: r.bad ? `${M_RED}1A` : `${M_TEAL}1A`, border: `1px solid ${r.bad ? M_RED : M_TEAL}4D`, fontFamily: OSWALD, fontSize: 8, fontWeight: 600, letterSpacing: '0.1em', color: r.bad ? M_RED : M_TEAL, cursor: 'pointer' }}>{r.k}</span>
    <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, flexShrink: 0 }}>{r.where}</span>
    <span style={{ fontSize: 11.5, color: M_DIM, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.what}</span>
    <span style={{ fontFamily: MONO, fontSize: 9, color: M_FAINT, flexShrink: 0 }}>{r.when}</span>
  </div>
);

const AG_COND = { fresh: 3, worn: 2, hungry: 2, tilted: 1 };
const AG_COND_LINE = {
  fresh: 'Rested. He will play his whole range.',
  worn: 'Eleven hours in. He is folding hands he would raise this morning.',
  hungry: 'He asked for a beer an hour ago and nobody went.',
  tilted: 'Chasing. Every sizing is bigger than the hand deserves.',
};

const AgentCondRow = ({ cond = 'worn' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '10px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
      <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED, width: 72 }}>CONDITION</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: M_TEXT, textTransform: 'capitalize' }}>{cond}</span>
      <span style={{ display: 'flex', gap: 3 }}>
        {[0, 1, 2].map(i => <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i < AG_COND[cond] ? (AG_COND[cond] === 1 ? M_RED : AG_COND[cond] === 2 ? M_GOLD : M_TEAL) : 'transparent', border: `1px solid ${i < AG_COND[cond] ? 'transparent' : M_FAINT}` }}></span>)}
      </span>
    </div>
    <span style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.45, paddingLeft: 81 }}>{AG_COND_LINE[cond]}</span>
  </div>
);

const AgentProfileM = () => {
  const a = AG_CAST.bal;
  const id = idFor(a.id);
  return (
    <PhoneShell>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0D1413' }}>
        <AgentHeader a={a}/>
        <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', padding: '14px 14px 0' }}>
          {/* his face and his identity, and NO second copy of his name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, paddingBottom: 13 }}>
            <div style={{ width: 62, height: 62, flexShrink: 0 }}>
              <MoodGhost mood={a.mood} accent={id.glow.c} size={62} ring={false} hood={id.hood} glow={id.glow.c}/>
            </div>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', color: M_MUTED }}>{a.nature.toUpperCase()}</span>
                <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_FAINT }}>born 4 Aug</span>
              </div>
              <ResourceBars stamina={a.stam} heat={a.heat} w={112} h={3} gap={4} labels/>
            </div>
          </div>
          <V5Glass pad="0 12px" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 44, borderRadius: 10, marginBottom: 4 }}>
            <span style={{ flex: 1.6, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, height: 30, borderRadius: 7, background: `${M_TEAL}1C`, border: `1px solid ${M_TEAL}59`, cursor: 'pointer' }}>
              <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.13em', color: M_TEAL }}>DEPLOY</span>
              <span style={{ fontFamily: MONO, fontSize: 9, color: M_DIM }}>25/50 · $1,200</span>
            </span>
            <span style={{ flex: 1, textAlign: 'center', fontFamily: OSWALD, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.1em', color: M_MUTED, cursor: 'pointer' }}>GIVE HIM CHIPS</span>
            <span style={{ fontSize: 15, color: M_MUTED, cursor: 'pointer', paddingLeft: 2 }}>&hellip;</span>
          </V5Glass>
          <AgentCondRow cond="worn"/>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 6, paddingBottom: 2 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.18em', color: M_TEAL }}>RECENT</span>
            <span style={{ fontSize: 11, color: M_MUTED }}>what tonight changed in him</span>
          </div>
          {AG_RECENT.map((r, i) => <AgentRecentRow key={i} r={r}/>)}
          <div style={{ borderTop: `1px solid ${M_BORDER}`, padding: '10px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', color: M_MUTED, width: 72 }}>TONIGHT</span>
            <Num size={13} weight={700} color={M_TEAL}>+$3,694</Num>
            <span style={{ fontSize: 11.5, color: M_MUTED }}>· 42 hands · 1 flagged</span>
          </div>
        </div>
        <AgentComposer/>
      </div>
    </PhoneShell>
  );
};

Object.assign(window, {
  AG, AG_CAST, AgentHeader, AgentPill, AgentBubble, AgentStage, AgentActions, AG_ICON,
  AgentHead, AgentLine, AgentHandCard, AgentThread, AgentComposer,
  AgentSheetM, AgentWantM, AgentWhisperM,
  AG_RECENT, AgentRecentRow, AG_COND, AG_COND_LINE, AgentCondRow, AgentProfileM,
});
