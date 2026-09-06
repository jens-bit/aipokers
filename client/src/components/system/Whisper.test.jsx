// Whisper — chat as a whisper, not a chat.
// Port of design-refs/mood-watch5.jsx `V5Composer` / `V5Whisper`.
//
// "AND THE FELT IS THE SCREEN. Nothing below it but the composer." What you say
// to him is not a row in a log: it rises from the bottom edge as a pale bubble
// and is gone in four seconds. His reply is his own bubble, over his head.
//
// The composer is also the way into the thread: swipe up from it, or use its
// arrow, and the record comes over the lower felt.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { fireEvent, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Whisper, WhisperComposer, WHISPER_MS } from './Whisper.jsx';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(resolve(clientRoot, 'src/styles/watch6.css'), 'utf8');
const rule = (selector) => {
  const found = new RegExp(`${selector.replace(/[.\-]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  return found ? found[1] : '';
};

describe('the whisper itself', () => {
  it('rises from the bottom edge and is gone in four seconds', () => {
    expect(WHISPER_MS).toBe(4000);
    const r = rule('.watch-whisper');
    expect(r).toMatch(/bottom:\s*8px/);
    expect(r).toMatch(/animation:\s*whisper 4s/);
    // It is a note passed, not a control: it never takes a tap off the felt.
    expect(r).toMatch(/pointer-events:\s*none/);
  });

  it('is pale — it is not his register and must not look like it', () => {
    const box = rule('.watch-whisper__box');
    expect(box).toMatch(/rgba\(237,\s*237,\s*237,\s*0\.10\)/);
    expect(box).not.toMatch(/00D4AA/);
  });

  it('says what was whispered', () => {
    const { container } = render(<Whisper text="Careful with him." />);
    expect(container.querySelector('.watch-whisper__box').textContent)
      .toBe('Careful with him.');
  });
});

describe('the composer', () => {
  it('asks for a whisper', () => {
    const { container } = render(<WhisperComposer onSend={() => {}} />);
    expect(container.querySelector('.watch-composer__input').placeholder)
      .toBe('Whisper to him…');
    // BUGS-A job 6: the hint carries no words. It was instructions for a
    // gesture — printed inside Telegram, where a vertical swipe is the
    // platform's own — and a caption telling a phone user to swipe is a
    // caption admitting the control is not obvious. The chevron IS the
    // control now, and it says what it does to a screen reader.
    const hint = container.querySelector('.watch-composer__hint');
    expect(hint.textContent).toBe('');
    expect(hint.getAttribute('aria-label')).toBe('Open the thread');
    expect(hint.querySelector('.watch-composer__chevron')).not.toBeNull();
    // ...and the send button is still there, beside it and not instead of it.
    expect(container.querySelector('.watch-composer__send')).not.toBeNull();
  });

  it('sends what was typed and clears itself', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<WhisperComposer onSend={onSend} />);

    const input = container.querySelector('.watch-composer__input');
    await user.type(input, 'Careful with him.');
    await user.click(container.querySelector('.watch-composer__send'));

    expect(onSend).toHaveBeenCalledWith('Careful with him.');
    expect(input.value).toBe('');
  });

  it('will not send nothing', async () => {
    const onSend = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<WhisperComposer onSend={onSend} />);

    expect(container.querySelector('.watch-composer__send').disabled).toBe(true);
    await user.type(container.querySelector('.watch-composer__input'), '   ');
    await user.click(container.querySelector('.watch-composer__send'));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('opens the thread on its arrow', async () => {
    const onOpenThread = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<WhisperComposer onSend={() => {}} onOpenThread={onOpenThread} />);
    await user.click(container.querySelector('.watch-composer__thread'));
    expect(onOpenThread).toHaveBeenCalledTimes(1);
  });

  // WATCH-7. The v6 gesture was written against pointer events on the composer
  // alone, and it did not fire on a phone or on a desk:
  //
  //   · on touch, the composer had no `touch-action`, so the browser claimed a
  //     vertical drag as a page pan and sent pointercancel long before the
  //     finger had travelled 28px — the platform took the gesture
  //   · on a desk, a 28px drag leaves a 44px composer, and without implicit
  //     capture the moves stopped being delivered to it
  //
  // So the drag is tracked on the WINDOW, and touch and mouse are handled as
  // themselves. Both are played here, because "it works with a mouse" is exactly
  // what was believed about the version that shipped.
  const mouse = (el, type, clientY) => fireEvent(
    el, new window.MouseEvent(type, { bubbles: true, cancelable: true, clientY }),
  );
  const touch = (el, type, clientY) => {
    const init = { touches: [{ clientY }], changedTouches: [{ clientY }] };
    if (type === 'touchstart') return fireEvent.touchStart(el, init);
    if (type === 'touchmove') return fireEvent.touchMove(el, init);
    return fireEvent.touchEnd(el, { touches: [], changedTouches: [{ clientY }] });
  };

  it('opens the thread on a swipe up, with a finger', () => {
    const onOpenThread = vi.fn();
    const { container } = render(<WhisperComposer onSend={() => {}} onOpenThread={onOpenThread} />);
    const bar = container.querySelector('.watch-composer');

    touch(bar, 'touchstart', 800);
    // The move lands on the window, which is where a real drag ends up once the
    // finger has left the 44px composer.
    touch(window, 'touchmove', 760);
    touch(window, 'touchend', 760);

    expect(onOpenThread).toHaveBeenCalledTimes(1);
  });

  it('opens the thread on a swipe up, with a mouse, even off the composer', () => {
    const onOpenThread = vi.fn();
    const { container } = render(<WhisperComposer onSend={() => {}} onOpenThread={onOpenThread} />);
    const bar = container.querySelector('.watch-composer');

    mouse(bar, 'mousedown', 800);
    mouse(window, 'mousemove', 760);
    mouse(window, 'mouseup', 760);

    expect(onOpenThread).toHaveBeenCalledTimes(1);
  });

  // The platform must not be able to take the gesture before it is long enough
  // to count. This is the half of the fix that is not JavaScript.
  it('does not let the browser pan the page out from under the swipe', () => {
    expect(rule('.watch-composer')).toMatch(/touch-action:\s*none/);
  });

  it('does not open it on a nudge, or on a tap into the field', () => {
    const onOpenThread = vi.fn();
    const { container } = render(<WhisperComposer onSend={() => {}} onOpenThread={onOpenThread} />);
    const bar = container.querySelector('.watch-composer');

    mouse(bar, 'mousedown', 800);
    mouse(window, 'mousemove', 790);
    mouse(window, 'mouseup', 790);
    expect(onOpenThread).not.toHaveBeenCalled();

    // A tap into the field is a tap into the field, however far the finger
    // then travels: the keyboard is opening and the sheet must not.
    const input = container.querySelector('.watch-composer__input');
    mouse(input, 'mousedown', 800);
    mouse(window, 'mousemove', 700);
    expect(onOpenThread).not.toHaveBeenCalled();
  });

  // WATCH-7: a hint for a gesture nobody found has to be the thing it hints at.
  it('the hint is a control, with a chevron, and opens the thread on a tap', async () => {
    const onOpenThread = vi.fn();
    const user = userEvent.setup();
    const { container } = render(<WhisperComposer onSend={() => {}} onOpenThread={onOpenThread} />);

    const hint = container.querySelector('.watch-composer__hint');
    expect(hint.tagName).toBe('BUTTON');
    // The chevron points the way the finger is meant to go.
    expect(hint.querySelector('.watch-composer__chevron')).toBeTruthy();

    await user.click(hint);
    expect(onOpenThread).toHaveBeenCalledTimes(1);
  });

  // BUG-02 is a hard floor on every text field in the Mini App: iOS Safari
  // zooms the whole app when a field under 16px takes focus, and never zooms
  // back. The ref draws the placeholder at 13px; the bug wins.
  it('the field clears the iOS zoom floor', () => {
    expect(rule('.watch-composer__input')).toMatch(/font-size:\s*16px/);
  });
});
