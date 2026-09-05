// client/src/screens/headerDensity.test.jsx — FIX-1d
//
// Mobile playtest 2026-09-05: the "New agent" title row, the draft status strip
// and the thread header ate the top of a 390x844 screen before any content.
//
// Root cause: base.css floors every <button> at `min-height: var(--tap)` (44px)
// for tap-target reasons. The mood-wave screens are ports that size their own
// controls — GlobalHeader's are 29px, the band's action button is 30px — so the
// floor silently inflated every row that holds a button. The header also
// carried 8px/10px padding and a bottom rule the reference does not have.
//
// The reference heights, from design-refs/mood-atoms.jsx GlobalHeader and
// design-refs/mood-birth.jsx DraftBand (MoodBand shares the band's box):
//
//              row              before   after   reference
//   header     2 + 29 + 10        63       41       41
//   band       9 + 42 + 11 + 1    65       63       63
//   total                        128      104      104
//
// jsdom does no layout, so this recomputes the box model from the declared
// styles React applied — padding + the tallest child + border — which is the
// same arithmetic as the table above and fails on the pre-fix tree.

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { ChatsScreen } from './ChatsScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';

const REF_HEADER_H = 41; // mood-atoms GlobalHeader: 2px top + 29px controls + 10px bottom
const REF_BAND_H = 63;   // mood-birth DraftBand / MoodBand: 9 + 42 + 11 + 1px rule

const px = (v) => (v ? parseFloat(v) || 0 : 0);

// base.css floors buttons at --tap; an inline minHeight is the only thing that
// releases them, so it counts toward a child's effective height.
function childHeight(el) {
  const declared = px(el.style.height);
  const floor = el.tagName === 'BUTTON' && el.style.minHeight === '' ? 44 : px(el.style.minHeight);
  return Math.max(declared, floor);
}

// padding-box + tallest declared child + horizontal rules.
function rowHeight(row) {
  const tallest = Math.max(0, ...[...row.children].map((c) => childHeight(c)));
  const borders = px(row.style.borderBottom) + px(row.style.borderTop)
    + (row.style.borderBottom && !px(row.style.borderBottom) ? 1 : 0)
    + (row.style.borderTop && !px(row.style.borderTop) ? 1 : 0);
  return px(row.style.paddingTop) + tallest + px(row.style.paddingBottom) + borders;
}

const rowOf = (el) => el.closest('div[style]');

describe('FIX-1d header density', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents/a1/hands', { recentHands: [] });
  });

  it('FIX-1d: the draft header matches the reference row height', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    const header = rowOf(await screen.findByRole('button', { name: 'Back' }));

    expect(rowHeight(header)).toBe(REF_HEADER_H);
    // The reference GlobalHeader has no bottom rule; the band below draws it.
    expect(header.style.borderBottom).toBe('');
  });

  it('FIX-1d: the draft status strip matches the reference band height', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    const band = rowOf(await screen.findByRole('button', { name: 'Skip' }));

    expect(band.style.padding).toBe('9px 14px 11px');
    expect(rowHeight(band)).toBe(REF_BAND_H);
  });

  it('FIX-1d: the thread header matches the reference row height', async () => {
    const agent = {
      id: 'a1', name: 'Aggressive v1.3', status: 'resting',
      mood: { state: 'confident', cause: 'closed +$210' },
    };
    render(<ChatsScreen selectedAgent={agent} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />);
    const header = rowOf(await screen.findByRole('button', { name: 'Back' }));

    expect(rowHeight(header)).toBe(REF_HEADER_H);
    expect(header.style.borderBottom).toBe('');
  });

  it('FIX-1d: the thread mood band matches the reference band height', async () => {
    const agent = {
      id: 'a1', name: 'Aggressive v1.3', status: 'resting',
      mood: { state: 'confident', cause: 'closed +$210' },
    };
    render(<ChatsScreen selectedAgent={agent} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />);
    const band = rowOf(await screen.findByRole('button', { name: 'Deploy' }));

    expect(rowHeight(band)).toBe(REF_BAND_H);
  });

  it('FIX-1d: the chrome above the draft feed is 104px, not 128px', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    const header = rowOf(await screen.findByRole('button', { name: 'Back' }));
    const band = rowOf(await screen.findByRole('button', { name: 'Skip' }));

    expect(rowHeight(header) + rowHeight(band)).toBe(REF_HEADER_H + REF_BAND_H);
  });
});
