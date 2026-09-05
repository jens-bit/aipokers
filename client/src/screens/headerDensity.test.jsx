// client/src/screens/headerDensity.test.jsx — FIX-1d, retuned by FIX-2a
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
// FIX-1d hit mood-atoms' own numbers (41 + 63 = 104). The second playtest
// budgeted the whole column again in design-refs/mood-ww-ref.jsx S4, which is
// stricter: the header and band together may cost 96px, not 104.
//
//              row              orig   FIX-1d   FIX-2a   ww-ref
//   header     2 + 29 + 9         63      41       40       40
//   band       9 + 38 + 8 + 1     65      63       56       56
//   total                        128     104       96       96
//
// The 8px this frees is felt, which is the entire point of the budget.
//
// One discrepancy is deliberate. The ref's note for GlobalHeader reads
// "vertical padding 2/8", which totals 39 around a 29px control row, but its
// own table says 40. The table is what the sheet tells the port to hit ("it is
// a number per row that the port has to hit"), so the odd pixel goes on the
// bottom pad: 2/9.
//
// jsdom does no layout, so this recomputes the box model from the declared
// styles React applied — padding + the tallest child + border — which is the
// same arithmetic as the table above and fails on the pre-fix tree.

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';

import { BirthScreen } from './BirthScreen.jsx';
import { ChatsScreen } from './ChatsScreen.jsx';
import { fetchMock, telegram } from '../test/harness.js';
// The watch header is styled from a stylesheet rather than inline, so its row
// is read out of the real file the way desktopWidth.test.jsx reads its columns.
import WATCH_CSS from '../styles/watch.css?raw';

const REF_HEADER_H = 40; // ww-ref S4 GlobalHeader: 2px top + 29px controls + 9px bottom
const REF_BAND_H = 56;   // ww-ref S4 MoodBand / DraftBand: 9 + 38 ghost + 8 + 1px rule

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

describe('FIX-2a header density', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents/a1/hands', { recentHands: [] });
  });

  it('FIX-2a: the draft header matches the ww-ref row height', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    const header = rowOf(await screen.findByRole('button', { name: 'Back' }));

    expect(rowHeight(header)).toBe(REF_HEADER_H);
    // The reference GlobalHeader has no bottom rule; the band below draws it.
    expect(header.style.borderBottom).toBe('');
  });

  it('FIX-2a: the draft status strip matches the ww-ref band height', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    const band = rowOf(await screen.findByRole('button', { name: 'Skip' }));

    expect(band.style.padding).toBe('9px 14px 8px');
    expect(rowHeight(band)).toBe(REF_BAND_H);
  });

  it('FIX-2a: the thread header matches the ww-ref row height', async () => {
    const agent = {
      id: 'a1', name: 'Aggressive v1.3', status: 'resting',
      mood: { state: 'confident', cause: 'closed +$210' },
    };
    render(<ChatsScreen selectedAgent={agent} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />);
    const header = rowOf(await screen.findByRole('button', { name: 'Back' }));

    expect(rowHeight(header)).toBe(REF_HEADER_H);
    expect(header.style.borderBottom).toBe('');
  });

  it('FIX-2a: the thread mood band matches the ww-ref band height', async () => {
    const agent = {
      id: 'a1', name: 'Aggressive v1.3', status: 'resting',
      mood: { state: 'confident', cause: 'closed +$210' },
    };
    render(<ChatsScreen selectedAgent={agent} onSelectAgent={() => {}} onBack={() => {}} onCreateAgent={() => {}} />);
    const band = rowOf(await screen.findByRole('button', { name: 'Deploy' }));

    expect(rowHeight(band)).toBe(REF_BAND_H);
  });

  it('FIX-2a: the chrome above the draft feed is 96px, not 104px', async () => {
    render(<BirthScreen onBack={() => {}} onBirth={() => {}} />);
    const header = rowOf(await screen.findByRole('button', { name: 'Back' }));
    const band = rowOf(await screen.findByRole('button', { name: 'Skip' }));

    expect(rowHeight(header) + rowHeight(band)).toBe(REF_HEADER_H + REF_BAND_H);
  });
});

// FIX-4 (playtest 2026-09-05): "the watch header is still too fat — it should
// be 40px, one line, with no second row of padding above the felt."
//
// FIX-3c collapsed the mood band into a 40px header and .watch-screen__header
// duly declares `height: 40px`. The row still rendered 45px, because a flex
// item's automatic minimum size is content-based and base.css floors every
// <button> at --tap (44px): the floor beat the declared height and the extra
// 4px (plus the rule) landed on the felt. .watch-screen__chat was released from
// that floor when it was written; .watch-screen__back never was.
describe('FIX-4 the watch header is one 40px row', () => {
  // The declaration block for a selector. Matched by scanning rather than by a
  // regex, so `.watch-screen` is never answered by `.watch-screen__header`:
  // only the occurrence whose very next non-space character opens a block is
  // the rule for that selector on its own.
  // Comments are stripped first: a rule's own note can mention another
  // property, and a selector named in prose is not a rule.
  const stripComments = (text) => {
    let out = '';
    let i = 0;
    for (;;) {
      const start = text.indexOf('/*', i);
      if (start < 0) return out + text.slice(i);
      out += text.slice(i, start);
      const end = text.indexOf('*/', start);
      if (end < 0) return out;
      i = end + 2;
    }
  };
  const CSS = stripComments(WATCH_CSS);

  const declarations = (selector, css = CSS) => {
    let from = 0;
    for (;;) {
      const i = css.indexOf(selector, from);
      if (i < 0) throw new Error('no rule for ' + selector);
      const open = css.indexOf('{', i);
      if (open > 0 && css.slice(i + selector.length, open).trim() === '') {
        return css.slice(open + 1, css.indexOf('}', open));
      }
      from = i + selector.length;
    }
  };
  const prop = (selector, name) => {
    for (const decl of declarations(selector).split(';')) {
      const colon = decl.indexOf(':');
      if (colon > 0 && decl.slice(0, colon).trim() === name) return decl.slice(colon + 1).trim();
    }
    return null;
  };

  it('FIX-4: the row is the ww-ref 40px', () => {
    expect(prop('.watch-screen__header', 'height')).toBe('40px');
    // One line: no wrap, so a long agent name ellipsises instead of pushing the
    // mood pill and CHAT onto a second row.
    expect(prop('.watch-screen__header', 'flex-wrap')).toBeNull();
    expect(prop('.watch-screen__header', 'display')).toBe('flex');
  });

  it('FIX-4: no control in it is floored at --tap, which is what inflated it', () => {
    for (const control of ['.watch-screen__back', '.watch-screen__chat']) {
      expect(prop(control, 'min-height')).toBe('0');
      // ...and each declares a height that fits inside the row.
      expect(parseFloat(prop(control, 'height'))).toBeLessThanOrEqual(REF_HEADER_H);
    }
  });

  it('FIX-4: the felt starts straight under the row, with no second band', () => {
    // .watch-stage is the next child and takes the rest; a padded strip between
    // the two would have to declare its own height here.
    expect(prop('.watch-stage', 'flex')).toBe('1');
    expect(prop('.watch-stage', 'min-height')).toBe('0');
    expect(prop('.watch-screen__header', 'padding')).toBe('0 14px');
  });
});
