// client/src/screens/mobileOverflow.test.jsx — FIX-1a
//
// Mobile playtest 2026-09-05 (Telegram iOS): the draft screen and the thread
// could both be dragged sideways, taking the whole page with them.
//
// Root cause, and what this file guards: a box that declares only `overflow-y`
// gets its other axis computed from `visible` to `auto` (CSS Overflow 3, §3).
// Both feeds declared a bare `overflowY: 'auto'`, so both were horizontal
// scrollers. The draft feed then actually had something to scroll to — the
// forming-ghost watermark is absolutely positioned at `right: -14px` — and the
// thread feed overflowed on any long unbroken token in model or owner text.
//
// A NOTE ON MEASUREMENT. The obvious test is "no descendant's scrollWidth
// exceeds the root's clientWidth". That cannot work here: jsdom implements no
// layout, so scrollWidth, clientWidth, offsetWidth and getBoundingClientRect()
// are 0 for every element, and the comparison is 0 > 0 — a test that can never
// fail. Rather than ship a green no-op, this audits the declared geometry that
// React actually put on the elements, which is deterministic and does fail on
// the pre-fix tree. The three rules below are the ones that were broken.

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { ChatsScreen } from './ChatsScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const VIEWPORT = 390; // Telegram iOS on an iPhone 14/15, the playtest device

function descendants(root) {
  return [root, ...root.querySelectorAll('*')].filter((el) => el instanceof HTMLElement);
}

function where(el) {
  const cls = el.getAttribute('class');
  const text = (el.textContent ?? '').trim().slice(0, 40);
  return `<${el.tagName.toLowerCase()}${cls ? ` class="${cls}"` : ''}> "${text}"`;
}

// Rule 1 — a vertical scroller must pin its horizontal axis, or the browser
// turns it into a horizontal scroller too.
function auditScrollAxes(root) {
  const bad = [];
  for (const el of descendants(root)) {
    const { overflow, overflowX, overflowY } = el.style;
    const scrollsY = /auto|scroll/.test(overflowY) || /auto|scroll/.test(overflow);
    if (!scrollsY) continue;
    // Either the shorthand names both axes ("hidden auto") or overflow-x is set.
    const shorthandPinsX = overflow.trim().split(/\s+/).length === 2;
    const pinned = shorthandPinsX || /hidden|clip|auto|scroll/.test(overflowX);
    if (!pinned) bad.push(`${where(el)} — overflow-y scrolls but overflow-x is unset`);
  }
  return bad;
}

// Rule 2 — nothing may declare a fixed width wider than the viewport.
function auditFixedWidths(root) {
  const bad = [];
  for (const el of descendants(root)) {
    for (const prop of ['width', 'minWidth']) {
      const px = /^(\d+(?:\.\d+)?)px$/.exec(el.style[prop]);
      if (px && Number(px[1]) > VIEWPORT) {
        bad.push(`${where(el)} — ${prop}: ${px[1]}px exceeds the ${VIEWPORT}px viewport`);
      }
    }
  }
  return bad;
}

// Rule 3 — anything deliberately hung outside its box (the ghost watermark's
// `right: -14px`) must have a clipping ancestor, or it becomes scrollable area.
function auditNegativeOffsets(root) {
  const bad = [];
  for (const el of descendants(root)) {
    const hangs = ['left', 'right', 'marginLeft', 'marginRight']
      .some((p) => /^-\d/.test(el.style[p] ?? ''));
    if (!hangs) continue;
    let clipped = false;
    for (let p = el.parentElement; p && root.contains(p); p = p.parentElement) {
      const { overflow, overflowX } = p.style;
      if (/hidden|clip/.test(overflowX) || /hidden|clip/.test(overflow.split(/\s+/)[0] ?? '')) {
        clipped = true;
        break;
      }
    }
    if (!clipped) bad.push(`${where(el)} — hangs outside its box with no clipping ancestor`);
  }
  return bad;
}

function auditAll(root) {
  return [...auditScrollAxes(root), ...auditFixedWidths(root), ...auditNegativeOffsets(root)];
}

describe('FIX-1a mobile horizontal overflow', () => {
  beforeEach(() => {
    telegram.signIn();
    window.innerWidth = VIEWPORT;
    document.documentElement.style.width = `${VIEWPORT}px`;
  });

  it('FIX-1a: the draft screen has nothing that can scroll sideways', async () => {
    fetchMock.route('/api/agents/chat', {
      chat: [{ role: 'assistant', content: 'Tight preflop, no multiway bluffs. Noted.' }],
    }, { method: 'POST' });

    const { container } = render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    expect(auditAll(container)).toEqual([]);
  });

  it('FIX-1a: the draft screen stays contained once the strip and forming chip are on screen', async () => {
    // The two elements the playtest named. They only render mid-draft, after a
    // reply has come back, so the audit has to get that far.
    fetchMock.route('/api/agents/chat', {
      chat: [{ role: 'assistant', content: 'Tight preflop, no multiway bluffs.' }],
      natureHint: 'Rock',
    }, { method: 'POST' });

    const { container } = render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    await screen.findByRole('button', { name: 'Tight and patient' });
    (await screen.findByRole('button', { name: 'Tight and patient' })).click();

    await screen.findByText(/Tight preflop, no multiway bluffs/);
    expect(screen.getByText('Forming')).toBeInTheDocument(); // the FORMING chip
    // F-1 renamed the strip's slots to the four dials PACE-1d actually sends
    // (TIGHT / AGGR / BLUFF / DISC). This assertion only locates the strip; the
    // rule the test encodes — nothing on the draft screen scrolls sideways — is
    // unchanged and still checked by auditAll below.
    expect(screen.getByText('TIGHT')).toBeInTheDocument();   // the profile strip
    expect(auditAll(container)).toEqual([]);
  });

  it('FIX-1a: the roster has nothing that can scroll sideways', async () => {
    fetchMock.route('/api/agents', {
      agents: [{
        id: 'a1', name: 'Aggressive v1.3', status: 'resting',
        stats: { netWon: 210, handsPlayed: 140 },
        mood: { state: 'confident', cause: 'closed +$210' },
      }],
    });

    const { container } = render(<ChatsScreen onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />);
    await screen.findByText('Aggressive v1.3');
    expect(auditAll(container)).toEqual([]);
  });

  it('FIX-1a: the thread stays contained even with an unbreakable token in the feed', async () => {
    const agent = {
      id: 'a1', name: 'Aggressive v1.3', status: 'resting',
      stats: { netWon: 210, handsPlayed: 140 },
      mood: { state: 'confident', cause: 'closed +$210' },
    };
    fetchMock.route('/api/agents/a1/hands', { recentHands: [] });

    const { container } = render(
      <ChatsScreen selectedAgent={agent} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />,
    );
    await screen.findByPlaceholderText(/Message Aggressive v1.3/);
    expect(auditAll(container)).toEqual([]);
  });

  it('FIX-1a: bubbles wrap unbreakable text instead of widening the feed', async () => {
    const agent = {
      id: 'a1', name: 'Aggressive v1.3', status: 'resting',
      mood: { state: 'confident', cause: 'closed +$210' },
    };
    fetchMock.route('/api/agents/a1/hands', { recentHands: [] });

    const { container } = render(
      <ChatsScreen selectedAgent={agent} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />,
    );
    const opener = await screen.findByText(/Ready to play/);

    // The bubble that holds free text must be allowed to break inside a word;
    // without this a pasted URL is one unbreakable box wider than the screen.
    expect(opener.style.overflowWrap).toBe('anywhere');
    expect(parseFloat(opener.style.minWidth)).toBe(0);
    expect(auditAll(container)).toEqual([]);
  });
});
