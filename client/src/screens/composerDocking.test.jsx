// client/src/screens/composerDocking.test.jsx — FIX-2b
//
// Second mobile playtest, 17:43-17:47. Screenshot: a thread with ONE message
// had its composer floating in the middle of the screen with dead space below
// it, instead of sitting on the bottom of the screen.
//
// HOME-2 job 1 removed the tab bar this used to dock ONTO, which makes the
// contract stricter rather than weaker: the composer is now the last thing on
// the screen full stop, so there is nothing under it to hide a gap.
//
// Root cause: layout.css sized `.pre-game` as `flex: 1` but left it a BLOCK
// box. Both the thread and the birth screen declare `flex: 1` plus a column on
// their own root, and hang a `flex: 1` feed above a non-growing composer off
// it. In a block parent that root `flex: 1` is inert, so the root sized to its
// content and every pixel of slack landed *below* the composer.
//
// jsdom performs no layout — getBoundingClientRect is all zeros — so this
// cannot measure the gap in pixels. What it checks instead is the chain of
// declarations that produces the docking, which is exactly what broke:
//
//   1. nothing sits below the composer, at any level up to the shell;
//   2. somewhere above it a sibling actually absorbs the slack (the feed);
//   3. every parent holding such a sibling is a flex column, so that grow is
//      not inert.
//
// Break any one and the composer floats again. (2) and (3) are what the block
// `.pre-game` violated.

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { ChatsScreen } from './ChatsScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';
import '../styles/index.css';

// RAISE-2: the opening bubble is the agent's own line — served by the server,
// or his birth words, or this last-ditch sentence. It is only an anchor here:
// these cases are about layout and lifecycle, not about what he says.
const OPENER = /Sit down\. What do you want to know\?/;

const AGENT = {
  id: 'a1', name: 'Aggressive v1.3', status: 'resting',
  mood: { state: 'confident', cause: 'closed +$210' },
};

const css = (el) => window.getComputedStyle(el);
const isFlexColumn = (el) => css(el).display === 'flex' && css(el).flexDirection === 'column';

// `flex: 1` resolves to grow 1 / shrink 1 / basis 0%; jsdom reports longhands.
const grows = (el) => parseFloat(css(el).flexGrow || '0') > 0;

// The real shell: .app is the flex column that owns --tg-h (KEY-1) and
// .pre-game is the pane. Nothing below it — HOME-2 job 1.
function Shell({ children }) {
  return (
    <div className="app">
      <div className="pre-game" style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}

/**
 * Walk the composer up to the pane, checking the docking contract at each
 * level. Returns how many levels had a slack-absorbing sibling; zero means the
 * column is content-sized and the composer floats — the screenshot bug.
 */
function auditDocking(composer, stopClass = 'pre-game') {
  let el = composer;
  let absorbers = 0;

  while (el && !el.classList.contains(stopClass)) {
    const parent = el.parentElement;
    if (!parent) break;
    const siblings = [...parent.children];

    // (1) nothing below the composer at this level.
    expect(siblings[siblings.length - 1], `something sits below ${el.className || el.tagName}`).toBe(el);

    // (2)+(3) anything that asks to grow — a sibling absorbing slack, or this
    // element filling its parent — only works if the parent is a flex column.
    // The single-child case matters: `.pre-game` held one `flex: 1` child and
    // was a block, so that grow was inert and the slack fell below the composer.
    const absorber = siblings.find(grows);
    if (absorber) {
      if (absorber !== el) absorbers += 1;
      expect(isFlexColumn(parent), `${parent.className || parent.tagName} holds a growing pane but is not a flex column`).toBe(true);
    }

    el = parent;
  }
  return absorbers;
}

describe('FIX-2b: the thread composer docks to the bottom of the screen', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents/a1/hands', { recentHands: [] });
    fetchMock.route('/api/agents', { agents: [AGENT] });
  });

  async function renderThread() {
    render(
      <Shell>
        <ChatsScreen selectedAgent={AGENT} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />
      </Shell>,
    );
    // One message in the feed — the exact state from the screenshot.
    await screen.findByText(OPENER);
    return screen.getByRole('button', { name: 'Send' }).closest('form');
  }

  it('the tab pane is a flex column, so the thread root can fill it', async () => {
    await renderThread();
    expect(isFlexColumn(document.querySelector('.pre-game'))).toBe(true);
  });

  it('nothing sits below the composer, and the slack is absorbed above it', async () => {
    const composer = await renderThread();
    expect(auditDocking(composer)).toBeGreaterThan(0);
  });

  it('HOME-2 job 1: the pane ends at the bottom of the shell, with nothing under it', async () => {
    await renderThread();
    const pane = document.querySelector('.pre-game');
    expect(pane.nextElementSibling).toBeNull();
    expect(grows(pane)).toBe(true);
  });

  it('the feed takes the slack and the composer keeps its own height', async () => {
    const composer = await renderThread();
    const feed = composer.previousElementSibling;

    expect(grows(feed)).toBe(true);
    expect(parseFloat(css(feed).minHeight)).toBe(0);
    expect(grows(composer)).toBe(false);
    expect(parseFloat(css(composer).flexShrink)).toBe(0);
  });

  it('keeps the KEY-1 keyboard behaviour — the shell still rides --tg-h', async () => {
    await renderThread();
    expect(css(document.querySelector('.app')).height).toContain('--tg-h');
  });
});

describe('FIX-2b: the birth composer docks the same way', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', { agents: [] });
  });

  async function renderBirth() {
    render(<Shell><BirthScreen onBack={() => {}} onBirth={() => {}} /></Shell>);
    const send = await screen.findByRole('button', { name: /send/i });
    return send.closest('form');
  }

  it('nothing sits below the composer, and the slack is absorbed above it', async () => {
    const composer = await renderBirth();
    expect(auditDocking(composer)).toBeGreaterThan(0);
  });

  it('the draft feed is the pane that grows', async () => {
    const composer = await renderBirth();
    // The composer rides inside a non-growing wrapper; the feed is that
    // wrapper's previous sibling.
    const feed = composer.parentElement.previousElementSibling;

    expect(grows(feed)).toBe(true);
    expect(parseFloat(css(feed).minHeight)).toBe(0);
    expect(grows(composer.parentElement)).toBe(false);
  });
});
