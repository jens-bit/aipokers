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
    expect(container.querySelector('.watch-composer__hint').textContent)
      .toBe('SWIPE UP FOR THE THREAD');
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

  // jsdom's PointerEvent carries no coordinates, so the drag is played with a
  // MouseEvent of the same type — React dispatches on the type, and this is the
  // only shape that actually puts a clientY on the handler.
  const at = (el, type, clientY) => fireEvent(
    el, new window.MouseEvent(type, { bubbles: true, cancelable: true, clientY }),
  );

  it('opens the thread on a swipe up', () => {
    const onOpenThread = vi.fn();
    const { container } = render(<WhisperComposer onSend={() => {}} onOpenThread={onOpenThread} />);
    const bar = container.querySelector('.watch-composer');

    at(bar, 'pointerdown', 800);
    at(bar, 'pointermove', 760);
    at(bar, 'pointerup', 760);

    expect(onOpenThread).toHaveBeenCalledTimes(1);
  });

  it('does not open it on a nudge, or on a tap into the field', () => {
    const onOpenThread = vi.fn();
    const { container } = render(<WhisperComposer onSend={() => {}} onOpenThread={onOpenThread} />);
    const bar = container.querySelector('.watch-composer');

    at(bar, 'pointerdown', 800);
    at(bar, 'pointermove', 790);
    at(bar, 'pointerup', 790);
    expect(onOpenThread).not.toHaveBeenCalled();

    // A tap into the field is a tap into the field, however far the finger
    // then travels: the keyboard is opening and the sheet must not.
    const input = container.querySelector('.watch-composer__input');
    at(input, 'pointerdown', 800);
    at(input, 'pointermove', 700);
    expect(onOpenThread).not.toHaveBeenCalled();
  });

  // BUG-02 is a hard floor on every text field in the Mini App: iOS Safari
  // zooms the whole app when a field under 16px takes focus, and never zooms
  // back. The ref draws the placeholder at 13px; the bug wins.
  it('the field clears the iOS zoom floor', () => {
    expect(rule('.watch-composer__input')).toMatch(/font-size:\s*16px/);
  });
});
