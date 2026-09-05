// client/src/test/bug02.test.jsx — TEST-3
//
// BUG-02 regression: no text field a Telegram user can focus may be smaller
// than 16px. iOS Safari auto-zooms the whole page when one is, and inside a
// Mini App that wrecks the layout with no way back out. The original fix
// (commit 012882f) bumped chat.css, agent-chat.css and analysis.css to 16px;
// nothing has stopped anyone dropping one back to 14 since.
//
// This file only works because of `css: true` in vite.config.js plus the
// stylesheet import below. Without them Vitest stubs the CSS imports, every
// field falls back to jsdom's own 16px default, and the check passes happily
// on components that are in fact broken.
//
// Two complementary passes:
//   1. render the mobile surfaces and read what the cascade actually computes
//   2. audit every font-size rule in the bundle that targets a text field,
//      which catches rules whose component is behind a gesture this suite
//      cannot drive (the WatchScreen sheet) or which nothing renders yet

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import '../styles/index.css';

import { AnalysisPanel } from '../components/AnalysisPanel.jsx';
import { ChatBar } from '../components/ChatBar.jsx';
import { BirthScreen } from '../screens/BirthScreen.jsx';
import { ChatsScreen } from '../screens/ChatsScreen.jsx';
import { agentsResponse } from './fixtures/agents.js';
import { fetchMock, telegram } from './harness.js';

const MIN_PX = 16;

// ── pass 1: what the browser would compute ──────────────────────────────────

function textFields(container) {
  return [...container.querySelectorAll('input, textarea')]
    .filter((el) => !['checkbox', 'radio', 'range', 'button', 'submit'].includes(el.type))
    .map((el) => ({
      tag: el.tagName.toLowerCase(),
      className: el.className || '(no class)',
      px: parseFloat(window.getComputedStyle(el).fontSize),
    }));
}

function expectNoZoomTriggers(container, surface) {
  const fields = textFields(container);
  expect(fields.length, `${surface} rendered no text field — the sweep is not covering it`).toBeGreaterThan(0);

  for (const { tag, className, px } of fields) {
    expect(Number.isFinite(px), `${surface}: ${tag}.${className} has no computed font-size`).toBe(true);
    expect(
      px,
      `${surface}: <${tag} class="${className}"> computes to ${px}px — below the ${MIN_PX}px iOS zoom threshold (BUG-02)`,
    ).toBeGreaterThanOrEqual(MIN_PX);
  }
}

describe('BUG-02 — rendered mobile surfaces', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('the stylesheet bundle is loaded, or every assertion here is vacuous', () => {
    const rules = [...document.styleSheets].flatMap((sheet) => {
      try { return [...sheet.cssRules]; } catch { return []; }
    });
    expect(rules.length).toBeGreaterThan(0);
  });

  it('BirthScreen — the creation chat', () => {
    const { container } = render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    expectNoZoomTriggers(container, 'BirthScreen');
  });

  it('ChatBar — table chat during a hand', () => {
    const { container } = render(<ChatBar messages={[]} onSend={() => {}} />);
    expectNoZoomTriggers(container, 'ChatBar');
  });

  it('AnalysisPanel — the spectator chat tab', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AnalysisPanel chatMessages={[]} onSendChat={() => {}} mySeat={0} displayNames={{ 0: 'The Grinder' }} />,
    );
    // The composer lives behind the CHAT tab; the panel opens on LIVE ANALYSIS.
    await user.click(screen.getByText('CHAT'));
    expectNoZoomTriggers(container, 'AnalysisPanel');
  });

  it('ChatsScreen — the agent thread composer', async () => {
    const { container } = render(
      <ChatsScreen
        selectedAgent={agentsResponse.agents[0]}
        onSelectAgent={() => {}}
        onBack={() => {}}
        onCreateAgent={() => {}}
        onDeploy={() => {}}
        onWatch={() => {}}
        onOpenProfile={() => {}}
      />,
    );
    await screen.findByText('The Grinder');
    expectNoZoomTriggers(container, 'ChatsScreen');
  });
});

// ── pass 2: the stylesheet itself ───────────────────────────────────────────
//
// WatchScreen's composer sits behind the sheet's drag gesture, which this
// suite cannot drive in jsdom, so its rule would otherwise go unchecked. An
// audit of the bundle covers it and everything else at once — including rules
// whose component does not exist yet.

// Rules under a desktop media query are exempt: the elements they style render
// only under useIsDesktop() (min-width 1100px), a viewport iOS Safari never
// reaches. `.dsk-composer__input` is 13.5px for exactly this reason.
const DESKTOP_ONLY = /min-width:\s*1100px/;

// Known dead rule, see BUG-20. `.dr-form-field` is applied by no JSX in the
// client — it is left over from a form that was removed — so nothing can
// currently focus a 14px field. It stays listed here rather than silently
// filtered, because the day someone reuses the class it becomes a live BUG-02.
const KNOWN_DEAD = new Set(['.dr-form-field input']);

function textFieldFontRules() {
  const found = [];
  for (const sheet of document.styleSheets) {
    let rules;
    try { rules = [...sheet.cssRules]; } catch { continue; }
    const walk = (list, condition) => {
      for (const rule of list) {
        if (rule.cssRules) { walk([...rule.cssRules], rule.conditionText || condition); continue; }
        const selector = rule.selectorText || '';
        // Deliberately not \binput\b: BEM class names like `.chat-bar__input`
        // put a word character right before the token, and those are exactly
        // the rules that matter here.
        if (!/input|textarea/i.test(selector)) continue;
        const declared = rule.style?.getPropertyValue('font-size');
        if (!declared) continue;
        found.push({ selector, px: parseFloat(declared), condition: condition || '' });
      }
    };
    walk(rules, '');
  }
  return found;
}

describe('BUG-02 — stylesheet audit', () => {
  it('finds the text-field rules it is meant to be auditing', () => {
    const rules = textFieldFontRules();
    expect(rules.length).toBeGreaterThan(5);
    expect(rules.map((r) => r.selector)).toContain('.chat-bar__input');
  });

  it('no mobile rule sets a text field below 16px', () => {
    const offenders = textFieldFontRules()
      .filter((r) => !DESKTOP_ONLY.test(r.condition))
      .filter((r) => !KNOWN_DEAD.has(r.selector))
      .filter((r) => Number.isFinite(r.px) && r.px < MIN_PX);

    expect(
      offenders.map((r) => `${r.selector} → ${r.px}px`),
      'these rules would make iOS Safari zoom the Mini App on focus (BUG-02)',
    ).toEqual([]);
  });

  // BUG-20 — dead rule, not a live defect: no JSX applies `.dr-form-field`.
  // Left red on purpose so it is not forgotten. Un-todo when the rule is
  // deleted or raised to 16px.
  it.todo('BUG-20: no dead rule leaves a 14px input waiting to be reused', () => {
    const dead = textFieldFontRules().filter((r) => KNOWN_DEAD.has(r.selector));
    expect(dead.filter((r) => r.px < MIN_PX)).toEqual([]);
  });
});
