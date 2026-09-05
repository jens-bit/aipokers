// client/src/components/desktop/desktopWidth.test.jsx — FIX-2c
//
// design-refs/mood-ww-ref.jsx S5: "1440 does not fit three columns". The thread
// screen with a panel open overflows by 337px — 340 roster + 917 stage + 520
// panel. The chosen fix is the roster collapsing to a 68px avatar strip, not
// the stage going away.
//
// jsdom performs no layout, so nothing here can measure a rendered pixel. What
// it can do is check the arithmetic that overflowed: read the FIXED column
// widths out of the real stylesheet and assert they leave room for a stage at
// both target sizes. A fixed column is one that cannot shrink — those are what
// sum past the viewport; the stage is `flex: 1; min-width: 0` and absorbs
// whatever is left, so it can never be the thing that overflows.

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';

import { DesktopHome } from './DesktopHome.jsx';
import { agentsResponse, playingAgent, restingAgent } from '../../test/fixtures/agents.js';
import { fetchMock, telegram } from '../../test/harness.js';
// ?raw gives the stylesheet as text, so the assertions read the real file
// rather than a copy of the numbers that could drift from it.
import CSS from '../../styles/desktop.css?raw';

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

const RAIL = 68;   // ww-ref S5: the collapsed roster
const MIN_STAGE = 700; // below this the floor stops being a room

describe('FIX-2c: the desktop columns fit the viewport', () => {
  it('1440x900 — rail + panel leave the stage the refs 852px', () => {
    const panel = widthOf('.dsk-panel', wideBlock());
    const strip = widthOf('.dsk-strip', wideBlock());

    expect(strip).toBe(RAIL);
    expect(panel).toBe(520);
    expect(strip + panel).toBeLessThanOrEqual(1440);
    expect(1440 - strip - panel).toBe(852); // the refs chosen split, exactly
  });

  it('1280x800 — the panel narrows to the refs 460 and the stage keeps 752', () => {
    const panel = widthOf('.dsk-panel', narrowBlock());

    expect(panel).toBe(460);
    expect(RAIL + panel).toBeLessThanOrEqual(1280);
    expect(1280 - RAIL - panel).toBe(752); // the refs 1280 note, exactly
  });

  it('leaves a usable stage at both sizes', () => {
    expect(1440 - RAIL - widthOf('.dsk-panel', wideBlock())).toBeGreaterThanOrEqual(MIN_STAGE);
    expect(1280 - RAIL - widthOf('.dsk-panel', narrowBlock())).toBeGreaterThanOrEqual(MIN_STAGE);
  });

  it('the stage is the only column that flexes, so it cannot push the others out', () => {
    expect(CSS).toMatch(/\.dsk-stage\s*\{[^}]*flex:\s*1/);
    expect(CSS).toMatch(/\.dsk-stage\s*\{[^}]*min-width:\s*0/);
    expect(CSS).toMatch(/\.dsk-panel\s*\{[^}]*flex-shrink:\s*0/);
    expect(CSS).toMatch(/\.dsk-strip\s*\{[^}]*flex-shrink:\s*0/);
  });

  it('the shell clips rather than scrolling sideways', () => {
    expect(CSS).toMatch(/\.dsk-root\s*\{[^}]*overflow:\s*hidden/);
  });
});

describe('FIX-2c: the roster collapses instead of disappearing', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
    fetchMock.route('/hands', { recentHands: [] });
  });

  function rosterRow(name) {
    const row = screen
      .getAllByRole('button', { name: new RegExp(name) })
      .find((el) => el.classList.contains('dsk-roster-row'));
    if (!row) throw new Error(`no roster row for ${name}`);
    return row;
  }

  const strip = () => document.querySelector('.dsk-strip');

  it('shows no strip while the standup panel holds the full roster', async () => {
    render(<DesktopHome onWatchAgent={() => {}} onDeployAgent={() => {}} onCreateAgent={() => {}} />);
    await waitFor(() => rosterRow(playingAgent.name));

    expect(strip()).toBeNull();
  });

  it('collapses to the strip when a thread opens, keeping every agent', async () => {
    render(<DesktopHome onWatchAgent={() => {}} onDeployAgent={() => {}} onCreateAgent={() => {}} />);
    await waitFor(() => rosterRow(restingAgent.name));
    await userEvent.click(rosterRow(restingAgent.name));

    await waitFor(() => expect(strip()).not.toBeNull());
    expect(strip().querySelectorAll('.dsk-strip__row')).toHaveLength(agentsResponse.agents.length);
  });

  it('marks the open agent in the strip', async () => {
    render(<DesktopHome onWatchAgent={() => {}} onDeployAgent={() => {}} onCreateAgent={() => {}} />);
    await waitFor(() => rosterRow(restingAgent.name));
    await userEvent.click(rosterRow(restingAgent.name));

    await waitFor(() => {
      const active = strip().querySelector('.dsk-strip__row.is-active');
      expect(active?.getAttribute('aria-label')).toBe(restingAgent.name);
    });
  });

  it('switches threads from the strip, so the roster is still a way around', async () => {
    render(<DesktopHome onWatchAgent={() => {}} onDeployAgent={() => {}} onCreateAgent={() => {}} />);
    await waitFor(() => rosterRow(restingAgent.name));
    await userEvent.click(rosterRow(restingAgent.name));
    await waitFor(() => expect(strip()).not.toBeNull());

    await userEvent.click(screen.getByRole('button', { name: playingAgent.name }));

    await waitFor(() => {
      const active = strip().querySelector('.dsk-strip__row.is-active');
      expect(active?.getAttribute('aria-label')).toBe(playingAgent.name);
    });
  });
});
