// PHASE 2 — DESIGN SYSTEM. This file RECORDS decisions; it introduces none.
// Every sample below is the real component, not a redraw.

const SY_W = 1180;

const Sheet = ({ title, sub, w = SY_W, children }) => (
  <div style={{
    width: w, background: M_BG, border: `1px solid ${M_BORDER_2}`, borderRadius: 14,
    fontFamily: INTER, color: M_TEXT, overflow: 'hidden',
  }}>
    <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${M_BORDER}`, background: M_PANEL }} data-typescan="skip">
      <div style={{ fontFamily: PLAYFAIR, fontSize: 20, fontWeight: 600, letterSpacing: '-0.01em' }}>{title}</div>
      {sub && <div style={{ fontSize: 12, color: M_MUTED, marginTop: 4, lineHeight: 1.5 }}>{sub}</div>}
    </div>
    <div style={{ padding: 20 }}>{children}</div>
  </div>
);

const SyLbl = ({ children, color = M_MUTED }) => (
  <div data-typescan="skip" style={{ fontFamily: OSWALD, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color, marginBottom: 9 }}>{children}</div>
);

const Row = ({ children, gap = 8, wrap = true, mb = 18 }) => (
  <div style={{ display: 'flex', gap, flexWrap: wrap ? 'wrap' : 'nowrap', marginBottom: mb, alignItems: 'flex-start' }}>{children}</div>
);

// ═══════════ 1 · TOKENS ═══════════
const Swatch = ({ hex, name, use, w = 132 }) => (
  <div style={{ width: w }}>
    <div style={{ height: 42, borderRadius: 8, background: hex, border: `1px solid ${M_BORDER}` }}/>
    <div style={{ fontFamily: MONO, fontSize: 10, color: M_TEXT, marginTop: 6 }}>{hex}</div>
    <div style={{ fontSize: 11, color: M_DIM, marginTop: 2 }}>{name}</div>
    <div style={{ fontSize: 10.5, color: M_MUTED, marginTop: 1, lineHeight: 1.35 }}>{use}</div>
  </div>
);

const AlphaRamp = ({ base, name, steps }) => (
  <div>
    <div style={{ display: 'flex', gap: 3 }}>
      {steps.map(s => (
        <div key={s} style={{ width: 52 }}>
          <div style={{ height: 34, borderRadius: 5, background: `${base}${s}`, border: `1px solid ${M_BORDER}` }}/>
          <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 4, textAlign: 'center' }}>{s}</div>
        </div>
      ))}
    </div>
    <div style={{ fontSize: 11, color: M_DIM, marginTop: 6 }}>{name}</div>
  </div>
);

const TypeRow = ({ family, css, size, weight, use, sample }) => (
  <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, padding: '9px 0', borderTop: `1px solid ${M_BORDER}` }}>
    <div style={{ width: 176, flexShrink: 0 }}>
      <div style={{ fontSize: 12, color: M_TEXT }}>{family}</div>
      <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, marginTop: 2 }}>{size}px · {weight}</div>
    </div>
    <div style={{ width: 300, flexShrink: 0, fontFamily: css, fontSize: size, fontWeight: weight, color: M_TEXT, letterSpacing: family.includes('Oswald') ? '0.14em' : family.includes('Playfair') ? '-0.01em' : 'normal', textTransform: family.includes('Oswald') ? 'uppercase' : 'none' }}>{sample}</div>
    <div style={{ flex: 1, fontSize: 11.5, color: M_MUTED, lineHeight: 1.45 }}>{use}</div>
  </div>
);

// The type scale is DERIVED, not typed: it scans the rendered document for
// every family/size/weight actually painted, so it cannot drift from the code.
const TYPE_FAMILIES = [
  { key: 'Playfair Display', css: PLAYFAIR, role: 'names, amounts, titles' },
  { key: 'Rozha One', css: ROZHA, role: 'DISPLAY ONLY — pot amounts, zoom name, birth title. Never body, labels, or table numerals.' },
  { key: 'Oswald', css: OSWALD, role: 'labels, buttons, state tags' },
  { key: 'JetBrains Mono', css: MONO, role: 'numbers, stats, timestamps' },
  { key: 'Inter', css: INTER, role: 'body and voice' },
];

const CANON_SIZES = {
  'Playfair Display': { 15: 'CANON.name' },
  'Oswald': { 9.5: 'CANON.label' },
  'JetBrains Mono': { 9.5: 'CANON.meta' },
  'Inter': { 12: 'CANON.sub', 13.5: 'CANON.body' },
};

const DerivedTypeScale = () => {
  const [rows, setRows] = React.useState(null);
  React.useEffect(() => {
    let cancelled = false;
    // Scope: the product screens mounted in this document. The tokens sheet
    // itself (y1) and all canvas annotation chrome are excluded.
    const ROOTS = ['y2', 'y3', 'y4', 'y5', 'g1', 'g2', 'g3'];
    const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TITLE', 'LINK', 'META']);

    // Layout-independent: no getBoundingClientRect, so a canvas host that has
    // not yet sized its frames cannot zero the result.
    const scanOnce = () => {
      const map = {};
      ROOTS.forEach(id => {
        const root = document.getElementById(id);
        if (!root) return;
        root.querySelectorAll('*').forEach(el => {
          if (SKIP_TAGS.has(el.tagName)) return;
          if (el.closest('[data-typescan="skip"]')) return;
          if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) return;
          const cs = getComputedStyle(el);
          if (cs.display === 'none' || cs.visibility === 'hidden') return;
          const fam = TYPE_FAMILIES.find(f => cs.fontFamily.includes(f.key));
          if (!fam) return;
          const size = Math.round(parseFloat(cs.fontSize) * 10) / 10;
          const k = `${fam.key}|${size}|${cs.fontWeight}`;
          if (!map[k]) map[k] = { fam: fam.key, css: fam.css, size, weight: cs.fontWeight, n: 0 };
          map[k].n++;
        });
      });
      return map;
    };

    const group = (map) => {
      const out = {};
      TYPE_FAMILIES.forEach(f => {
        out[f.key] = Object.values(map).filter(r => r.fam === f.key)
          .sort((a, b) => a.size - b.size || Number(a.weight) - Number(b.weight));
      });
      return out;
    };

    // Monotonic, not latched: distinct combinations can only be DISCOVERED,
    // never removed. Successive scans merge into one accumulating map and the
    // sheet re-publishes whenever the set grows, across a bounded window — so
    // an early scan of a half-committed DOM can never freeze the result.
    const acc = {};
    let tries = 0;
    const MAX_TRIES = 34;          // ~8.5s at 250ms
    const tick = () => {
      if (cancelled) return;
      const fresh = scanOnce();
      let grew = false;
      Object.keys(fresh).forEach(k => {
        if (!acc[k]) { acc[k] = fresh[k]; grew = true; }
        else if (fresh[k].n > acc[k].n) { acc[k] = { ...acc[k], n: fresh[k].n }; }
      });
      if (grew && Object.keys(acc).length > 0) setRows(group(acc));
      tries += 1;
      if (tries < MAX_TRIES) setTimeout(tick, 250);
    };
    setTimeout(tick, 80);
    return () => { cancelled = true; };
  }, []);

  const total = rows ? Object.values(rows).reduce((a, r) => a + r.length, 0) : 0;

  return (
    <div data-typescan="skip">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4 }}>
        <SyLbl>Type scale · derived</SyLbl>
        <span style={{ fontFamily: MONO, fontSize: 9.5, color: M_TEAL, marginTop: -9 }}>
          {rows ? `${total} combinations in use` : 'scanning…'}
        </span>
      </div>
      <div style={{ fontSize: 11.5, color: M_MUTED, lineHeight: 1.5, marginBottom: 14, maxWidth: 780 }} data-typescan="skip">
        Scanned from the <b style={{ color: M_DIM }}>product screens</b> mounted in this document (S2–S5, G1–G3), and merged across repeated scans over an 8-second window — combinations can only be discovered, never dropped, so the count converges to the same total for every reader regardless of when fonts swap or the host lays the frames out. This sheet&rsquo;s own chrome, the canvas annotations and any element without a layout box are excluded. Teal cells are the <span style={{ fontFamily: MONO, fontSize: 11, color: M_TEAL }}>CANON</span> constants.
      </div>
      {TYPE_FAMILIES.map(f => (
        <div key={f.key} style={{ paddingTop: 10, borderTop: `1px solid ${M_BORDER}`, marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 9 }}>
            <span style={{ fontFamily: f.css, fontSize: 15, color: M_TEXT }}>{f.key}</span>
            <span style={{ fontSize: 11, color: M_MUTED }}>{f.role}</span>
            <div style={{ flex: 1 }}/>
            <Num size={9.5} color={M_MUTED} weight={500}>{rows ? `${rows[f.key].length} SIZES` : '—'}</Num>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {rows && rows[f.key].map((r, i) => {
              const canon = (CANON_SIZES[f.key] || {})[r.size];
              return (
                <div key={i} style={{
                  width: 104, padding: '7px 9px', borderRadius: 6,
                  background: canon ? `${M_TEAL}12` : M_PANEL_2,
                  border: `1px solid ${canon ? `${M_TEAL}55` : M_BORDER}`,
                }}>
                  <div style={{
                    fontFamily: f.css, fontSize: Math.min(r.size, 20), fontWeight: Number(r.weight),
                    color: M_TEXT, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden',
                    textTransform: f.key === 'Oswald' ? 'uppercase' : 'none',
                    letterSpacing: f.key === 'Oswald' ? '0.12em' : 'normal',
                  }}>{f.key === 'JetBrains Mono' ? '+$340' : f.key === 'Oswald' ? 'Label' : 'Agent'}</div>
                  <div style={{ fontFamily: MONO, fontSize: 9.5, color: canon ? M_TEAL : M_DIM, marginTop: 5 }}>
                    {r.size} · {r.weight}
                  </div>
                  <div style={{ fontFamily: MONO, fontSize: 8.5, color: M_MUTED, marginTop: 2 }}>
                    {canon || `×${r.n}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
};

const SystemTokensM = () => (
  <Sheet title="Tokens" sub="Palette, type, radius, spacing and glow. Swatches are bound to the live token constants; type, radius and glow samples are rendered at their real values. AMBIENCE PASS: ground lifted #0A0A0A → #1A1A1E, panels to #232329 / #28282F, borders to 0.12 / 0.18, felt and room fill-light roughly ×2 — tuned for phone OLEDs, which crush shadows. Mood glows unchanged, so they pop harder against the lighter room. Text colours untouched.">
    <SyLbl>Grounds, panels, borders</SyLbl>
    <Row>
      <Swatch hex={M_BG} name="M_BG" use="app ground, floor ground"/>
      <Swatch hex={M_PANEL} name="M_PANEL" use="top bars, panels, tab bar"/>
      <Swatch hex={M_PANEL_2} name="M_PANEL_2" use="cards, bubbles, tiles"/>
      <Swatch hex={M_SURF} name="M_SURF" use="rows nested inside cards"/>
      <Swatch hex={M_TEXT} name="M_TEXT" use="primary text"/>
      <Swatch hex={M_DIM} name="M_DIM" use="secondary text"/>
      <Swatch hex={M_MUTED} name="M_MUTED" use="meta, labels, sulking mood"/>
      <Swatch hex={M_FAINT} name="M_FAINT" use="dividers in text, empty slots"/>
    </Row>
    <Row mb={22}>
      <div style={{ width: 280 }}>
        <div style={{ height: 42, borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}/>
        <div style={{ fontFamily: MONO, fontSize: 10, color: M_TEXT, marginTop: 6 }}>rgba(255,255,255,0.06)</div>
        <div style={{ fontSize: 11, color: M_DIM, marginTop: 2 }}>M_BORDER · every card and divider</div>
      </div>
      <div style={{ width: 280 }}>
        <div style={{ height: 42, borderRadius: 8, background: M_PANEL_2, border: `1px solid ${M_BORDER_2}` }}/>
        <div style={{ fontFamily: MONO, fontSize: 10, color: M_TEXT, marginTop: 6 }}>rgba(255,255,255,0.10)</div>
        <div style={{ fontSize: 11, color: M_DIM, marginTop: 2 }}>M_BORDER_2 · inputs, ghost buttons</div>
      </div>
    </Row>

    <SyLbl>Brand + semantic</SyLbl>
    <Row>
      <Swatch hex={M_TEAL} name="M_TEAL" use="live, CTAs, gains, confident"/>
      <Swatch hex={M_GOLD} name="M_GOLD" use="recap tick, flagged, frustrated. Never a button."/>
      <Swatch hex={M_RED} name="M_RED" use="losses, tilted"/>
      <Swatch hex={M_PURPLE} name="M_PURPLE" use="agent accent"/>
      <Swatch hex={M_PINK} name="M_PINK" use="agent accent"/>
      <Swatch hex={MOODS.neutral.color} name="neutral mood" use="styles.css --neutral"/>
    </Row>
    <Row mb={22}>
      <AlphaRamp base={M_TEAL} name="Teal alphas in use — appended as hex suffix, e.g. ${M_TEAL}44" steps={['0A','12','14','1A','22','2E','33','3D','44','55','66']}/>
    </Row>

    <SyLbl>Felt gradients + ambient light</SyLbl>
    <Row mb={22}>
      <div style={{ width: 250 }}>
        <div style={{ height: 62, borderRadius: 8, background: 'radial-gradient(ellipse at 50% 42%, #1b3630 0%, #0f1d19 65%, #0a1512 100%)', border: `1px solid ${M_TEAL}2E` }}/>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_DIM, marginTop: 6 }}>#1b3630 → #0f1d19 65% → #0a1512</div>
        <div style={{ fontSize: 11, color: M_MUTED, marginTop: 2 }}>Floor felt, lit</div>
      </div>
      <div style={{ width: 250 }}>
        <div style={{ height: 62, borderRadius: 8, background: 'radial-gradient(ellipse at 50% 42%, #12211d 0%, #0a1210 100%)', border: `1px solid ${M_TEAL}14` }}/>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_DIM, marginTop: 6 }}>#12211d → #0a1210</div>
        <div style={{ fontSize: 11, color: M_MUTED, marginTop: 2 }}>Floor felt, unlit</div>
      </div>
      <div style={{ width: 250 }}>
        <div style={{ height: 62, borderRadius: 8, background: 'radial-gradient(ellipse at center, #1a2a2c 0%, #0f1818 70%, #0a1212 100%)', border: `1px solid ${M_TEAL}14` }}/>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_DIM, marginTop: 6 }}>#1a2a2c → #0f1818 70% → #0a1212</div>
        <div style={{ fontSize: 11, color: M_MUTED, marginTop: 2 }}>Full table surface — from table.jsx</div>
      </div>
      <div style={{ width: 250 }}>
        <div style={{ height: 62, borderRadius: 8, background: `radial-gradient(ellipse at center, ${M_TEAL}21, transparent 70%)`, border: `1px solid ${M_BORDER}` }}/>
        <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_DIM, marginTop: 6 }}>M_TEAL 0.13 → 0</div>
        <div style={{ fontSize: 11, color: M_MUTED, marginTop: 2 }}>Light pool, one per lit felt</div>
      </div>
    </Row>

    <DerivedTypeScale/>

    <SyLbl>Radius · spacing · glow</SyLbl>
    <Row gap={26}>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {[3, 4, 6, 8, 10, 12, 14, 22].map(r => (
            <div key={r} style={{ textAlign: 'center' }}>
              <div style={{ width: 46, height: 46, borderRadius: r, background: M_PANEL_2, border: `1px solid ${M_BORDER}` }}/>
              <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 5 }}>{r}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: M_DIM, marginTop: 8 }}>3–5 chips · 6–8 rows and small cards · <b style={{ color: M_TEXT }}>12 = CANON.radius</b> · 14 sheets · 22 pills</div>
      </div>
      <div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          {[3, 6, 8, 9, 11, 14, 18].map(s => (
            <div key={s} style={{ textAlign: 'center' }}>
              <div style={{ width: s, height: 46, background: `${M_TEAL}33`, borderRadius: 2 }}/>
              <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 5 }}>{s}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: M_DIM, marginTop: 8 }}><b style={{ color: M_TEXT }}>14 = CANON.pad</b>, the side inset on every surface</div>
      </div>
    </Row>
    <Row mb={0} gap={12}>
      {[
        { label: 'CTA glow', css: `0 0 12px ${M_TEAL}55`, bg: M_TEAL, fg: '#0A0A0A', t: 'Primary' },
        { label: 'Mood glow', css: `0 0 14px ${M_GOLD}33`, bg: M_PANEL_2, fg: M_TEXT, t: 'Avatar' },
        { label: 'Tile glow', css: `0 0 14px ${M_TEAL}11`, bg: M_PANEL_2, fg: M_TEXT, t: 'GameTile' },
        { label: 'Bar shadow', css: `inset 0 1px 0 ${M_TEAL}2E, 0 6px 14px rgba(0,0,0,0.35)`, bg: M_PANEL_2, fg: M_TEXT, t: 'LiveBar' },
      ].map((g, i) => (
        <div key={i} style={{ width: 268 }}>
          <div style={{ height: 46, borderRadius: 8, background: g.bg, color: g.fg, boxShadow: g.css, border: `1px solid ${M_BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: OSWALD, fontSize: 11, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{g.t}</div>
          <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 6, lineHeight: 1.4 }}>{g.css}</div>
        </div>
      ))}
    </Row>
  </Sheet>
);

// ═══════════ 2 · MOOD LOGIC ═══════════
const MoodMatrixM = () => (
  <Sheet title="Mood logic" sub="Identity is the accent colour on the rim. Mood is the eyes and the glow. Posture carries it on the floor; a derived tint carries it in text. Rendered, not described.">
    <div style={{ display: 'grid', gridTemplateColumns: '112px 84px 128px 150px 210px 128px 1fr', gap: 12, paddingBottom: 9, borderBottom: `1px solid ${M_BORDER}` }}>
      {['Mood', 'Eyes', 'Aura', 'Posture', 'Text tint', 'Avatar S/M/L', 'Where it appears'].map(h => (
        <div key={h} style={{ fontFamily: OSWALD, fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: M_MUTED }}>{h}</div>
      ))}
    </div>
    {MOOD_ORDER.map((mood, i) => {
      const m = MOODS[mood];
      const p = POSTURE[mood];
      const accent = [M_TEAL, M_PURPLE, M_GOLD, M_PURPLE, M_PINK][i];
      return (
        <div key={mood} style={{ display: 'grid', gridTemplateColumns: '112px 84px 128px 150px 210px 128px 1fr', gap: 12, alignItems: 'center', padding: '13px 0', borderBottom: `1px solid ${M_BORDER}` }}>
          <div><MoodChip mood={mood} small/></div>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: 60, height: 60, borderRadius: 10, background: '#0A0F17', border: `1px solid ${accent}44`, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', overflow: 'hidden' }}>
              <MoodGhost mood={mood} accent={accent} size={58} ring={false}/>
            </div>
          </div>
          <div>
            <div style={{ height: 26, borderRadius: 5, background: `radial-gradient(ellipse, ${m.color}${Math.round(p.aura * 255).toString(16).padStart(2, '0')}, transparent 72%)`, border: `1px solid ${M_BORDER}` }}/>
            <div style={{ fontFamily: MONO, fontSize: 9, color: M_MUTED, marginTop: 4 }}>{m.color} · {p.aura}</div>
          </div>
          <div style={{ fontFamily: MONO, fontSize: 9.5, color: M_DIM, lineHeight: 1.5 }}>
            y {p.lift > 0 ? '+' : ''}{p.lift} · {p.tilt > 0 ? '+' : ''}{p.tilt}° · {p.scale}×
            {p.shimmer && <div style={{ color: M_RED }}>+ red shimmer</div>}
          </div>
          <div style={{
            fontSize: 12, fontStyle: 'italic', lineHeight: 1.4,
            color: `color-mix(in oklab, ${m.color} 32%, ${M_DIM})`,
          }}>“{mood === 'confident' ? "He's capped. Betting for value." : mood === 'neutral' ? 'Even session, nothing notable.' : mood === 'frustrated' ? "That's twice he's rivered me." : mood === 'tilted' ? "I'm fine. I'm FINE." : "I'd rather sit out a while."}”</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7 }}>
            <MoodGhost mood={mood} accent={accent} size={22} ring={false}/>
            <MoodGhost mood={mood} accent={accent} size={34} ring={false}/>
            <MoodGhost mood={mood} accent={accent} size={48} ring={false}/>
          </div>
          <div style={{ fontSize: 11, color: M_MUTED, lineHeight: 1.5 }}>{p.note}</div>
        </div>
      );
    })}
    <div style={{ marginTop: 16, padding: '12px 14px', borderRadius: 10, background: 'rgba(0,212,170,0.05)', border: `1px solid ${M_TEAL}33` }}>
      <SyLbl color={M_TEAL}>Rules</SyLbl>
      <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>
        Moods come from poker only — bad beats, streaks, being shown a bluff, card-dead stretches. <b style={{ color: M_TEXT }}>Never from the owner's absence.</b> Tilt-resistance varies by personality. A pep talk moves state one step; a winning session moves it back on its own. Text tint is always <span style={{ fontFamily: MONO, fontSize: 11 }}>color-mix(in oklab, mood 32%, M_DIM)</span> — full M_TEAL and M_RED stay reserved for money.
      </div>
    </div>
  </Sheet>
);

// ═══════════ 3 · GHOST ANATOMY ═══════════
const Callout = ({ children }) => (
  <div data-typescan="skip" style={{ fontFamily: MONO, fontSize: 9.5, color: M_MUTED, lineHeight: 1.5 }}>{children}</div>
);

const GhostAnatomyM = () => (
  <Sheet title="Ghost anatomy" w={900} sub="One body, three sizes. The eyes are the mood; the rim is the identity; the tail is why it can never walk.">
    <Row gap={30} mb={24}>
      {[
        { s: 40, label: 'S · 40px', use: 'full-house floor seats, posture cells' },
        { s: 56, label: 'M · 56px', use: 'bar and lounge occupants, one/two-game seats' },
        { s: 76, label: 'L · 76px', use: 'desktop floor seats' },
      ].map(g => (
        <div key={g.s} style={{ textAlign: 'center' }}>
          <div style={{ height: 108, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <FloorGhost mood="confident" accent={M_TEAL} size={g.s} speed={5}/>
          </div>
          <div style={{ fontFamily: OSWALD, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', color: M_TEAL, marginTop: 10 }}>{g.label}</div>
          <Callout>{g.s} × {Math.round(g.s * 1.2)}</Callout>
          <div style={{ fontSize: 11, color: M_MUTED, marginTop: 5, maxWidth: 150, lineHeight: 1.4 }}>{g.use}</div>
        </div>
      ))}
      <div style={{ flex: 1, minWidth: 260 }}>
        <SyLbl>Construction</SyLbl>
        <Callout>viewBox 0 0 80 96</Callout>
        <Callout>face ellipse rx 13.5 ry 16.5 @ cy 42 (46 when sulking)</Callout>
        <Callout>aura ellipse rx 46 ry 44 @ cy 46</Callout>
        <Callout>body stroke {'{accent}'}55 @ 1.1</Callout>
        <Callout>bob 3.4–7s, desynced per agent</Callout>
        <div style={{ marginTop: 12, fontSize: 11.5, color: M_DIM, lineHeight: 1.55 }}>
          The body tapers into a scalloped wisp — <b style={{ color: M_TEXT }}>there are no legs to animate</b>. Eye coordinates are identical between <span style={{ fontFamily: MONO, fontSize: 11 }}>MoodGhost</span> (chat/list) and <span style={{ fontFamily: MONO, fontSize: 11 }}>FloorGhost</span> (room), so both surfaces read the same mood.
        </div>
      </div>
    </Row>

    <SyLbl>Seat chips · full and compact</SyLbl>
    <Row gap={16} mb={22}>
      <div data-typescan="skip" style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'flex-start' }}>
        <SeatChip name="Phil_AI" stack="2,104" pos="SB" acting dealer/>
        <SeatChipSm name="Phil_AI" stack="2,104" acting dealer/>
      </div>
      <Callout>
        Full chip through 4-handed. <b style={{ color: M_TEXT }}>SeatChipSm</b> is for the rails
        and 6-handed only: avatar 18, name 10px, stack kept, position dropped.
        Degrade order is law — <b style={{ color: M_TEXT }}>pos first, avatar second, the stack never</b>.
      </Callout>
    </Row>

    <SyLbl>Seated with cards · canonical playing posture</SyLbl>
    <Row gap={16} mb={22}>
      <div style={{ width: 300 }}>
        <div style={{ position: 'relative', height: 168, background: M_BG, border: `1px solid ${M_BORDER}`, borderRadius: 8, overflow: 'hidden' }}>
          <RoomLayer layout="one" W={298} H={166} viewBox="40 96 236 132"/>
          <div style={{ position: 'absolute', inset: 0 }}>
            <Occupant x={149} y={16} name="Balanced v2.1" accent={M_TEAL} mood="confident" state="live" size={48} speed={5}/>
            <div style={{ position: 'absolute', left: 149, top: 112, transform: 'translateX(-50%)', display: 'flex', gap: 3 }}>
              {[['K','c'],['9','c'],['4','c'],['2','c']].map((c, i) => (
                <div key={i} style={{ filter: `drop-shadow(0 0 6px ${M_TEAL}55)` }}>
                  <PlayingCard rank={c[0]} suit={c[1]} w={17} h={24}/>
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', left: 149, top: 74, transform: 'translateX(-50%)', display: 'flex', gap: 1, zIndex: 4 }}>
              {[['A','s'],['K','h']].map((c, i) => (
                <div key={i} style={{ transform: `rotate(${i ? 4 : -4}deg)`, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.6))' }}>
                  <PlayingCard rank={c[0]} suit={c[1]} w={22} h={31}/>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 7 }}><Callout>pot above the chip · ghost at the far rim · his cards in front of him · board at centre</Callout></div>
      </div>
      <div style={{ flex: 1, minWidth: 300 }}>
        <div style={{ fontSize: 12, color: M_DIM, lineHeight: 1.6 }}>
          A felt where one of your <b style={{ color: M_TEXT }}>own</b> agents is playing is a living <b style={{ color: M_TEXT }}>diorama</b>: the community board at the felt centre, his <b style={{ color: M_TEXT }}>two hole cards face up</b> and fanned at &plusmn;4&deg; in front of his seated ghost, and the pot stacked above his name chip — above the far rail, on the centre axis so it cannot foul a chip at any width. Another user&rsquo;s agent shows <b style={{ color: M_TEXT }}>backs</b> at the same size and position.
        </div>
        <div style={{ marginTop: 11, padding: '11px 13px', borderRadius: 10, background: 'rgba(205,179,128,0.06)', border: `1px solid ${M_GOLD}3D` }}>
          <SyLbl color={M_GOLD}>Legibility is the gate</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.55, marginTop: -3 }}>
            <span style={{ fontFamily: MONO, fontSize: 11 }}>PlayingCard</span> locks rank size to <span style={{ fontFamily: MONO, fontSize: 11 }}>w &times; 0.42</span>, so a legible rank needs w &ge; 20 — which needs <b style={{ color: M_TEXT }}>ry &ge; 47</b> once the board and rail margins are paid. Every lit felt is tested <b style={{ color: M_TEXT }}>independently</b>; one that fails shows glow + pot rather than shrunken cards. The room is laid out so that none fails: the dense states use a <b style={{ color: M_TEXT }}>2&times;2 grid</b> of 176&times;104 felts rather than a diamond, because four diamond points cannot each be readable.
          </div>
        </div>
        <div style={{ marginTop: 10, padding: '11px 13px', borderRadius: 10, background: 'rgba(0,212,170,0.05)', border: `1px solid ${M_TEAL}33` }}>
          <SyLbl color={M_TEAL}>The floor is watching, not driving</SyLbl>
          <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.55, marginTop: -3 }}>
            The diorama assumes hands <b style={{ color: M_TEXT }}>advance server-side</b> whether or not anyone is looking — the floor is watching the game, not driving it. Depth still increases on tap: <b style={{ color: M_TEXT }}>floor</b> (board, his cards, pot) → <b style={{ color: M_TEXT }}>zoom</b> (equity, pending action, timer, and the agent talking) → <b style={{ color: M_TEXT }}>watch</b> (the full table).
          </div>
        </div>
      </div>
    </Row>

    <SyLbl>Markers</SyLbl>
    <Row gap={14} mb={22}>
      {[
        { a: { name: 'Balanced v2.1', accent: M_TEAL, mood: 'confident', state: 'live', speed: 5 }, note: 'state="live" → pulse dot in chip' },
        { a: { name: 'Bluff Master', accent: M_GOLD, mood: 'confident', state: 'recap', speed: 5, drink: true }, note: 'state="recap" → gold tick · drink at the bar' },
        { a: { name: 'Value Bot', accent: M_PINK, mood: 'sulking', state: 'resting', speed: 6, dim: true }, note: 'state="resting" → flat dot · dim in the lounge' },
      ].map((m, i) => (
        <div key={i} style={{ width: 250 }}>
          {/* Occupant is position:absolute — it needs a positioned box with an
             explicit height, or it escapes to the nearest positioned ancestor. */}
          <div style={{ position: 'relative', height: 118, background: M_BG, border: `1px solid ${M_BORDER}`, borderRadius: 8 }}>
            <Occupant x={125} y={6} {...m.a} size={50}/>
          </div>
          <div style={{ marginTop: 6 }}><Callout>{m.note}</Callout></div>
        </div>
      ))}
    </Row>

    <Row gap={14} mb={0}>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'rgba(0,212,170,0.05)', border: `1px solid ${M_TEAL}33` }}>
        <SyLbl color={M_TEAL}>Do</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>Float and bob on desynced timers. Change eyes, aura and posture with mood. Keep the accent rim constant so the agent stays recognisable. Anchor a seated ghost to the felt's far rim — <span style={{ fontFamily: MONO, fontSize: 11 }}>cy − ry − height</span> — never to its centre.</div>
      </div>
      <div style={{ flex: 1, padding: '12px 14px', borderRadius: 10, background: 'rgba(255,77,79,0.05)', border: `1px solid ${M_RED}33` }}>
        <SyLbl color={M_RED}>Don't</SyLbl>
        <div style={{ fontSize: 11.5, color: M_DIM, lineHeight: 1.6, marginTop: -3 }}>No legs, no walk cycles, no pathfinding. Never let a ghost paint over board cards. Never swap the rim colour to signal mood. Never render a live marker on a resting agent.</div>
      </div>
    </Row>
  </Sheet>
);

Object.assign(window, { SystemTokensM, MoodMatrixM, GhostAnatomyM, Sheet, SyLbl, Row });
