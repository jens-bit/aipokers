// client/src/components/desktop/desktopWidth.test.jsx — FIX-2c, superseded by DESK-3
//
// design-refs/mood-ww-ref.jsx S5: "1440 does not fit three columns". FIX-2c's
// answer was the roster collapsing to a 68px avatar strip whenever a panel
// opened — the stage kept its width, the roster gave up its name and its line.
//
// DESK-3 (design-refs/mood-desk59.jsx) rejects that trade explicitly: "three
// columns, always open, nothing sliding over anything." The roster is a real
// 250px column now — .dsk3-roster, DeskRoster.jsx — and it never collapses,
// never disappears, and is not a mode the panel state decides. What the stage
// gives up instead is the width the strip used to leave it, which is the
// point: a roster you can only glance at through 68px of avatars was never
// "always open" in the sense DESK-3 means it.
//
// jsdom performs no layout, so nothing here can measure a rendered pixel. What
// it can do is check the arithmetic: read the FIXED column widths out of the
// real stylesheet and assert they leave room for a stage at both target
// sizes. A fixed column is one that cannot shrink — those are what sum past
// the viewport; the stage is `flex: 1; min-width: 0` and absorbs whatever is
// left, so it can never be the thing that overflows.

import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { DesktopHome } from './DesktopHome.jsx';
import { agentsResponse, playingAgent, restingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, telegram } from '../../test/harness.js';
// ?raw gives the stylesheet as text, so the assertions read the real file
// rather than a copy of the numbers that could drift from it.
import CSS from '../../styles/desktop.css?raw';
import WATCH_CSS from '../../styles/watch.css?raw';

// Pull `width: <n>px` off a selector's LAST declaration, so a media-query
// override wins over the base rule the way the cascade would apply it.
function widthOf(selector, css = CSS) {
  const re = new RegExp(`${selector.replace('.', '\\.')}\\s*\\{[^}]*?width:\\s*(\\d+)px`, 'g');
  let last = null;
  for (const m of css.matchAll(re)) last = Number(m[1]);
  if (last === null) throw new Error(`no width declared for ${selector}`);
  return last;
}

// The 1280 column set lives in the max-width: 1365px block.
function narrowBlock() {
  const i = CSS.indexOf('@media (max-width: 1365px)');
  if (i < 0) throw new Error('no 1365px breakpoint');
  return CSS.slice(i, CSS.indexOf('\n}', CSS.indexOf('{', i)));
}

// ...and the 1440 set is everything outside it, or the override would be read
// as the wide width.
function wideBlock() {
  return CSS.replace(narrowBlock(), '');
}

const ROSTER = 250; // DESK-3: the permanent column, wide open
const MIN_STAGE = 600; // below this the floor stops being a room

describe('DESK-3: the desktop columns fit the viewport', () => {
  it('C9 1440x900 — roster + 380px panel leave the stage 810px', () => {
    const panel = widthOf('.dsk-panel', wideBlock());
    const roster = widthOf('.dsk3-roster', wideBlock());

    expect(roster).toBe(ROSTER);
    expect(panel).toBe(380);
    expect(roster + panel).toBeLessThanOrEqual(1440);
    expect(1440 - roster - panel).toBe(810);
  });

  it('C9 1280x800 — the roster narrows and the stage keeps 680', () => {
    const panel = widthOf('.dsk-panel', narrowBlock());
    const roster = widthOf('.dsk3-roster', narrowBlock());

    expect(panel).toBe(380);
    expect(roster).toBe(220);
    expect(roster + panel).toBeLessThanOrEqual(1280);
    expect(1280 - roster - panel).toBe(680);
  });

  it('leaves a usable stage at both sizes', () => {
    expect(1440 - widthOf('.dsk3-roster', wideBlock()) - widthOf('.dsk-panel', wideBlock()))
      .toBeGreaterThanOrEqual(MIN_STAGE);
    expect(1280 - widthOf('.dsk3-roster', narrowBlock()) - widthOf('.dsk-panel', narrowBlock()))
      .toBeGreaterThanOrEqual(MIN_STAGE);
  });

  it('the stage is the only column that flexes, so it cannot push the others out', () => {
    expect(CSS).toMatch(/\.dsk-stage\s*\{[^}]*flex:\s*1/);
    expect(CSS).toMatch(/\.dsk-stage\s*\{[^}]*min-width:\s*0/);
    expect(CSS).toMatch(/\.dsk-panel\s*\{[^}]*flex-shrink:\s*0/);
    expect(CSS).toMatch(/\.dsk3-roster\s*\{[^}]*flex-shrink:\s*0/);
  });

  it('the shell clips rather than scrolling sideways', () => {
    expect(CSS).toMatch(/\.dsk-root\s*\{[^}]*overflow:\s*hidden/);
  });

  // The rule this file used to encode — a fixed rail collapsing to 68px so a
  // panel would fit — is exactly the trade DESK-3 rejects. Nothing in the
  // stylesheet should still know how to draw that strip.
  it('the collapsed roster strip is gone, not just unused', () => {
    expect(CSS).not.toMatch(/\.dsk-strip\b/);
  });
});

describe('DESK-3: the roster never collapses', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/hands', { recentHands: [] });
  });

  // Locate the row by its visible name, then verify that exact native button's
  // accessible name and visibility. Recomputing every decorative roster SVG's
  // accessible name on every waitFor poll makes this CPU-bound in the gate.
  function rosterRow(name) {
    const row = within(screen.getByTestId('desk-roster'))
      .getByText(name, { selector: '.dsk-roster-row__name' }).closest('button.dsk-roster-row');
    expect(row).not.toBeNull();
    expect(row).toHaveAccessibleName(new RegExp(name));
    expect(row).toBeVisible();
    return row;
  }

  const expectActive = row => {
    expect(row).toBeInTheDocument();
    expect(row.classList.contains('is-active')).toBe(true);
  };

  const roster = () => document.querySelector('.dsk3-roster');
  const strip = () => document.querySelector('.dsk-strip');

  function desk() {
    return render(
      <DesktopHome onWatchAgent={() => {}} onDeployAgent={() => {}} onCreateAgent={() => {}} />,
    );
  }

  it('shows every agent before any thread is open — no click required to see it', async () => {
    desk();
    await waitFor(() => expect(roster()).not.toBeNull());
    expect(rosterRow(playingAgent.name)).toBeInTheDocument();
    expect(rosterRow(restingAgent.name)).toBeInTheDocument();
    expect(strip()).toBeNull();
  });

  it('keeps every agent, at full width, once a thread is open', async () => {
    desk();
    await waitFor(() => rosterRow(playingAgent.name));
    await userEvent.click(rosterRow(restingAgent.name));

    await waitFor(() => {
      const tabs = screen.getByTestId('home-rail').querySelector('.agent-view__tabs');
      expect(tabs).not.toBeNull();
      expect(within(tabs).getByRole('tab', { name: 'Stats', exact: true })).toBeInTheDocument();
    });
    expect(rosterRow(playingAgent.name)).toBeInTheDocument();
    expect(rosterRow(restingAgent.name)).toBeInTheDocument();
    expect(strip()).toBeNull();
  });

  it('marks the open agent in the roster', async () => {
    desk();
    await waitFor(() => rosterRow(playingAgent.name));
    const restingRow = rosterRow(restingAgent.name);
    await userEvent.click(restingRow);

    await waitFor(() => expectActive(restingRow));
  });

  it('switches threads from the roster, with no strip ever appearing', async () => {
    desk();
    const playingRow = await waitFor(() => rosterRow(playingAgent.name));
    const restingRow = rosterRow(restingAgent.name);
    await userEvent.click(restingRow);
    await waitFor(() => expectActive(restingRow));

    await userEvent.click(playingRow);

    await waitFor(() => expectActive(playingRow));
    expect(strip()).toBeNull();
  });
});

// FIX-4 (playtest 2026-09-05): "on a wide viewport the opponent seat ghost sits
// tiny at the top-left and the felt stretches edge to edge."
//
// The watch screen is the mobile spectator view — App.jsx renders it whenever
// the viewport is under the 1100px desktop breakpoint — so a 1024px window, or
// a desktop browser dragged narrow, gets it at a width it was never drawn for.
// The seat ring is `position: absolute` inside .watch-felt at left/right 12px,
// so it is already anchored to the felt rather than to the viewport; what went
// wrong is that the felt was as wide as the window, which threw the ghosts into
// the far corners. Bounding the felt puts them back around the table.
describe('FIX-4: the watch felt is a stage, not a page', () => {
  // A brace-balanced slice, so the @media block is read whole rather than to
  // the first closing brace inside it.
  const blockAt = (css, from) => {
    const open = css.indexOf('{', from);
    let depth = 0;
    for (let i = open; i < css.length; i++) {
      if (css[i] === '{') depth += 1;
      else if (css[i] === '}') {
        depth -= 1;
        if (depth === 0) return css.slice(open + 1, i);
      }
    }
    throw new Error('unbalanced block');
  };

  const ruleFor = (selector, css = WATCH_CSS) => {
    let from = 0;
    for (;;) {
      const i = css.indexOf(selector, from);
      if (i < 0) throw new Error('no rule for ' + selector);
      const open = css.indexOf('{', i);
      if (open > 0 && css.slice(i + selector.length, open).trim() === '') return blockAt(css, i);
      from = i + selector.length;
    }
  };

  const value = (block, name) => {
    for (const decl of block.split(';')) {
      const colon = decl.indexOf(':');
      if (colon > 0 && decl.slice(0, colon).trim() === name) return decl.slice(colon + 1).trim();
    }
    return null;
  };

  // What .watch-felt is given above the wide breakpoint.
  const wideFelt = () => {
    const at = WATCH_CSS.indexOf('@media (min-width: 760px)');
    expect(at).toBeGreaterThan(-1);
    const media = blockAt(WATCH_CSS, at);
    expect(media).toContain('.watch-felt');
    return ruleFor('.watch-felt', media);
  };

  it('FIX-4: bounded to 720px on a wide viewport', () => {
    expect(value(wideFelt(), 'max-width')).toBe('720px');
  });

  it('FIX-4: centred, so the table is not pinned to one edge', () => {
    const felt = wideFelt();
    expect(value(felt, 'margin-left')).toBe('auto');
    expect(value(felt, 'margin-right')).toBe('auto');
    // Without an explicit width the auto margins have nothing to divide: a
    // stretched flex item has no width of its own to centre.
    expect(value(felt, 'width')).toBe('100%');
  });

  it('FIX-4: the seat ring is positioned against the felt, not the viewport', () => {
    expect(value(ruleFor('.watch-felt'), 'position')).toBe('relative');
    expect(value(ruleFor('.watch-felt__seat'), 'position')).toBe('absolute');
  });
});
