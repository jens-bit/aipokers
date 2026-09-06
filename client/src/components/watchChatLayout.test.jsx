// client/src/components/watchChatLayout.test.jsx — FIX-1e / FIX-4,
// re-expressed for WATCH-6.
//
// Mobile playtest 2026-09-05: on the watch screen's CHAT tab, the
// "Between hands / SIT OUT AFTER THIS HAND" bar covered the chat list and the
// composer, so neither could be tapped. Root cause: the sheet was a fixed-height
// flex column — felt, grab handle, sit-out strip, tabs, panel — and the chat
// inside it insisted on 240px, so its list and composer were pushed past the
// sheet's bottom edge.
//
// WATCH-6 removes the whole apparatus that made that possible. There is no
// draggable sheet, no tab bar and no panel: the felt fills header→composer, the
// record is a glass LAYER over its lower 70%, and the composer lives outside
// both and never moves. The two rules the playtest bought still have to hold,
// and they are what is asserted below:
//
//   FIX-1e — the sit-out control and the record are both reachable at once.
//            Neither is drawn over the other, and the composer is reachable
//            whatever else is on screen.
//   FIX-4  — the header's Chat control always reaches the record. It cannot go
//            dead, because there is no longer a state the record can hide in.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render, screen } from '@testing-library/react';
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

describe('FIX-1e the record vs the between-hands bar', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('FIX-1e: the record and the sit-out bar are both present, neither over the other', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch();

    await user.click(await screen.findByRole('button', { name: 'Chat' }));

    // The bar is up...
    const strip = container.querySelector('.watch-sitout-strip');
    expect(strip).toBeTruthy();
    expect(strip.className).not.toContain('is-hidden');
    expect(screen.getByText('Between hands')).toBeInTheDocument();

    // ...and the thread is still there, scrolling in its own region.
    const body = container.querySelector('.thread-sheet__body');
    expect(body).toBeTruthy();

    // Siblings in the sheet's column, not stacked on top of each other.
    expect(strip.contains(body)).toBe(false);
    expect(body.contains(strip)).toBe(false);
  });

  it('FIX-1e: the composer is outside the record entirely, so nothing can cover it', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch();

    const input = container.querySelector('.watch-composer__input');
    expect(input).toBeTruthy();

    await user.click(await screen.findByRole('button', { name: 'Chat' }));
    const sheet = container.querySelector('.thread-sheet');
    expect(sheet.contains(container.querySelector('.watch-composer__input'))).toBe(false);
    expect(container.querySelector('.watch-composer__input')).toBeTruthy();
  });

  // jsdom does no layout, so the geometry itself is asserted on the rules. This
  // is the arithmetic that made the original bug impossible: the sheet is a
  // column, the thread yields, and the furniture below it keeps its place.
  it('FIX-1e: the sheet is a column, the thread yields and the footer does not', () => {
    const watch6 = css('src/styles/watch6.css');

    const sheet = rule(watch6, '.thread-sheet');
    expect(sheet).toMatch(/display:\s*flex/);
    expect(sheet).toMatch(/flex-direction:\s*column/);

    const body = rule(watch6, '.thread-sheet__body');
    expect(body).toMatch(/flex:\s*1/);
    expect(body).toMatch(/min-height:\s*0/);
    expect(body).toMatch(/overflow-y:\s*auto/);

    const foot = rule(watch6, '.thread-sheet__foot');
    expect(foot).toMatch(/flex-shrink:\s*0/);

    // And the composer, which is not in the sheet at all, never shrinks either.
    expect(rule(watch6, '.watch-composer')).toMatch(/flex-shrink:\s*0/);
  });

  // The analysis panel keeps its own fixed slot — none of this was ever about
  // the panel, and WATCH-6 does not touch it.
  it('FIX-1e: the analysis panel chat is untouched', () => {
    const analysis = css('src/styles/analysis.css');
    expect(rule(analysis, '.dr-chat-tab')).toMatch(/height:\s*240px/);
  });
});

// FIX-4 (playtest 2026-09-05): "with the bottom sheet pulled down, tapping CHAT
// in the header does nothing." The button selected a tab inside a sheet dragged
// to HIDDEN — a tab nobody could see.
//
// WATCH-6 removes the state that made that possible: there is no detent ladder
// and nothing for the record to be hidden behind. The rule the fix bought — the
// header control always reaches the record, and a wired thread still wins — is
// what survives.
describe('FIX-4 the header Chat control always reaches the record', () => {
  beforeEach(() => {
    telegram.signIn();
    fetchMock.route('/api/agents', agentsResponse);
  });

  it('FIX-4: opens the record over the felt when there is no thread to open', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch();

    expect(container.querySelector('.thread-sheet')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Chat' }));
    expect(container.querySelector('.thread-sheet')).not.toBeNull();

    // There is no detent to be in the wrong one of: the felt is unchanged.
    expect(container.querySelector('.watch-felt--fill')).toBeTruthy();
  });

  it('FIX-4: a thread still wins, and nothing opens over the felt', async () => {
    const user = userEvent.setup();
    const onOpenThread = vi.fn();
    const { container } = renderWatch({ onOpenThread });

    await user.click(screen.getByRole('button', { name: 'Chat' }));

    expect(onOpenThread).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.thread-sheet')).toBeNull();
  });

  // WATCH-6: three ways in, one destination. The composer's arrow and a tap on
  // his face are the same control as the header's.
  //
  // BUGS-A job 6 made it three labelled ways rather than two: the hint under
  // the composer used to be a chevron over the words SWIPE UP FOR THE THREAD,
  // which is a caption and was not in the accessibility tree as a destination.
  // The words are gone and the chevron is the control, so it is counted here
  // with the other two — same destination, one more door.
  it('WATCH-6: his face and the composer arrow open the same record', async () => {
    const user = userEvent.setup();
    const { container } = renderWatch();

    // All labelled for the same destination, because they are one control.
    const ways = screen.getAllByRole('button', { name: 'Open the thread' });
    expect(ways.length).toBe(3);
    expect(container.querySelector('.watch-hero__body')).toBe(ways[0]);
    expect(container.querySelector('.watch-composer__thread')).toBe(ways[1]);
    expect(container.querySelector('.watch-composer__hint')).toBe(ways[2]);

    await user.click(ways[0]);
    expect(container.querySelector('.thread-sheet')).not.toBeNull();

    await user.click(container.querySelector('.thread-sheet__grab'));
    expect(container.querySelector('.thread-sheet')).toBeNull();

    await user.click(screen.getAllByRole('button', { name: 'Open the thread' })[1]);
    expect(container.querySelector('.thread-sheet')).not.toBeNull();

    await user.click(container.querySelector('.thread-sheet__grab'));
    await user.click(screen.getAllByRole('button', { name: 'Open the thread' })[2]);
    expect(container.querySelector('.thread-sheet')).not.toBeNull();
  });
});
