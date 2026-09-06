// client/src/components/desktop/panelParts.test.jsx — FIX-6 job 1
//
// THE DESK COMPOSER'S KEYS. PComposer is the one composer behind three panels
// (the standup, a man's thread, the watch rail), so the rule is asserted once
// here rather than three times through its callers.
//
// Playtest 6 Sep: the desk sent on ⌘↵ and put a newline in on Enter, which is
// backwards from every composer on the phone and from every chat app the owner
// has ever used. Enter sends; Shift+Enter is the only thing that is a newline.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PComposer } from './panelParts.jsx';

function box(props = {}) {
  const onSend = vi.fn();
  const onChange = vi.fn();
  render(
    <PComposer value="ready?" onChange={onChange} onSend={onSend} placeholder="Say it" {...props} />,
  );
  return { onSend, onChange, area: document.querySelector('.dsk-composer__input') };
}

describe('FIX-6 · the desk composer', () => {
  it('Enter sends what is in the box', async () => {
    const user = userEvent.setup();
    const { onSend, area } = box();

    area.focus();
    await user.keyboard('{Enter}');

    expect(onSend).toHaveBeenCalledWith('ready?');
  });

  it('Shift+Enter does not send — it is the newline', async () => {
    const user = userEvent.setup();
    const { onSend, onChange, area } = box();

    area.focus();
    await user.keyboard('{Shift>}{Enter}{/Shift}');

    expect(onSend).not.toHaveBeenCalled();
    // The key is left alone, so the textarea's own default puts the line in.
    expect(onChange).toHaveBeenCalled();
  });

  it('⌘↵ still sends, because taking a working habit away costs more than keeping it', async () => {
    const user = userEvent.setup();
    const { onSend, area } = box();

    area.focus();
    await user.keyboard('{Meta>}{Enter}{/Meta}');

    expect(onSend).toHaveBeenCalledWith('ready?');
  });

  it('an empty box sends nothing, whatever key is pressed', async () => {
    const user = userEvent.setup();
    const { onSend, area } = box({ value: '   ' });

    area.focus();
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('a busy composer sends nothing either — the button is disabled and so is the key', async () => {
    const user = userEvent.setup();
    const { onSend, area } = box({ busy: true });

    area.focus();
    await user.keyboard('{Enter}');

    expect(onSend).not.toHaveBeenCalled();
  });

  it('the foot says which key does which, because the box no longer looks like the label', () => {
    box();
    expect(screen.getByText(/↵ send/)).toBeInTheDocument();
    expect(screen.getByText(/⇧↵ newline/)).toBeInTheDocument();
  });
});
