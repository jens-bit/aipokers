// client/src/components/watchChatLayout.test.jsx — FIX-1e
//
// Mobile playtest 2026-09-05: on the watch screen's CHAT tab, the
// "Between hands / SIT OUT AFTER THIS HAND" bar covered the chat list and the
// composer, so neither could be tapped.
//
// Root cause: the sheet is a fixed-height flex column — felt, grab handle,
// sit-out strip, tabs, panel — and .dr-chat-tab declared `height: 240px`. When
// the strip appears it takes ~61px from the panel, but the chat kept insisting
// on 240px, so its list and composer were pushed past the sheet's bottom edge.
//
// design-refs/mood-watch.jsx settles the question: SitOutStrip sits above
// WatchTabs and the panel below is `flex: 1, minHeight: 0` — the bar keeps its
// place and the panel yields. That is the shape asserted here.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { WatchScreen } from './WatchScreen.jsx';
import { betweenHandsGame, spectatorConfig } from '../test/fixtures/game.js';
import { agentsResponse } from '../test/fixtures/agents.js';
import { fetchMock, telegram } from '../test/harness.js';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const css = (rel) => readFileSync(resolve(clientRoot, rel), 'utf8');

const rule = (sheet, selector) => {
  const found = new RegExp(`${selector.replace(/[.\-]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(sheet);
  return found ? found[1] : '';
};

function renderWatch(props = {}) {
  return render(
    <WatchScreen
      game={betweenHandsGame}
      mySeat={0}
      config={spectatorConfig}
      displayNames={{ 0: 'The Grinder', 1: 'Doyle_v3', 2: 'Granite' }}
      chatMessages={[]}
      sendChat={() => {}}
      onLeave={() => {}}
      onSitOut={() => {}}
      {...props}
    />,
  );
}

describe('FIX-1e watch chat vs the between-hands bar', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('FIX-1e: the chat list and composer are both present while the bar is up', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch();

    // The MoodBand's Chat action is the keyboard-free way onto the tab.
    await user.click(await screen.findByRole('button', { name: 'Chat' }));

    // The bar is up...
    const strip = container.querySelector('.watch-sitout-strip');
    expect(strip).toBeTruthy();
    expect(strip.className).not.toContain('is-hidden');
    expect(screen.getByText('Between hands')).toBeInTheDocument();

    // ...and the chat is still there underneath it, composer included.
    const chat = container.querySelector('.dr-chat-tab');
    expect(chat).toBeTruthy();
    expect(chat.querySelector('.dr-chat-tab__list')).toBeTruthy();
    expect(chat.querySelector('.dr-chat-tab__input')).toBeTruthy();

    // The sit-out button and the composer are siblings in the column, not
    // stacked on top of each other.
    expect(strip.contains(chat)).toBe(false);
    expect(chat.contains(strip)).toBe(false);
  });

  it('FIX-1e: the watch sheet gets the yielding chat, not the fixed-height one', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch();
    await user.click(await screen.findByRole('button', { name: 'Chat' }));

    const chat = container.querySelector('.dr-chat-tab');
    expect(chat.className).toContain('dr-chat-tab--fill');
  });

  // jsdom does no layout, so the geometry itself is asserted on the rules.
  it('FIX-1e: the panel is a column and the filling chat has no fixed height', () => {
    const analysis = css('src/styles/analysis.css');
    const watch = css('src/styles/watch.css');

    const fill = rule(analysis, '.dr-chat-tab--fill');
    expect(fill).toMatch(/flex:\s*1/);
    expect(fill).toMatch(/min-height:\s*0/);
    expect(fill).toMatch(/height:\s*auto/);

    const panel = rule(watch, '.watch-panel');
    expect(panel).toMatch(/display:\s*flex/);
    expect(panel).toMatch(/flex-direction:\s*column/);
    expect(panel).toMatch(/min-height:\s*0/);

    // The analysis panel keeps its fixed slot — this fix is scoped to the sheet.
    expect(rule(analysis, '.dr-chat-tab')).toMatch(/height:\s*240px/);
  });
});

// FIX-4 (playtest 2026-09-05): "with the bottom sheet pulled down, tapping CHAT
// in the header does nothing."
//
// W4-5 made the header button and the sheet's own TABLE tab one decision:
// hand it a thread and it opens the thread, otherwise it selects the tab. But
// selecting a tab inside a sheet dragged to HIDDEN selects something nobody can
// see, so on the deployment where onOpenThread is not wired the control read as
// dead. Where there is no thread to open, the button now does the whole
// gesture: pick the tab AND bring the sheet back up.
describe('FIX-4 the header CHAT button with the sheet pulled down', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  const sheet = () => document.querySelector('.watch-sheet');

  // A tap on the grab handle cycles expanded -> peek -> hidden. The gesture is
  // pointer-driven, so it is played rather than clicked: same pointerId, no
  // movement, well inside the 400ms tap window.
  function tapHandle() {
    const grab = document.querySelector('.watch-sheet__grab');
    act(() => {
      fireEvent.pointerDown(grab, { pointerId: 1, button: 0, clientY: 500 });
      fireEvent.pointerUp(grab, { pointerId: 1, clientY: 500 });
    });
  }

  it('FIX-4: opens the sheet on the TABLE tab when there is no thread to open', async () => {
    const user = userEvent.setup();
    renderWatch();

    expect(sheet().dataset.detent).toBe('expanded');
    tapHandle();
    expect(sheet().dataset.detent).toBe('peek');
    tapHandle();
    expect(sheet().dataset.detent).toBe('hidden');

    await user.click(screen.getByRole('button', { name: 'Chat' }));

    expect(sheet().dataset.detent).toBe('expanded');
    // ...and it is the TABLE tab that is showing, not whatever was last picked.
    expect(document.querySelector('.dr-chat-tab')).not.toBeNull();
  });

  it('FIX-4: a thread still wins, and the sheet is left where the owner put it', async () => {
    const user = userEvent.setup();
    const onOpenThread = vi.fn();
    renderWatch({ onOpenThread });

    tapHandle();
    tapHandle();
    expect(sheet().dataset.detent).toBe('hidden');

    await user.click(screen.getByRole('button', { name: 'Chat' }));

    expect(onOpenThread).toHaveBeenCalledTimes(1);
    expect(sheet().dataset.detent).toBe('hidden');
  });
});
