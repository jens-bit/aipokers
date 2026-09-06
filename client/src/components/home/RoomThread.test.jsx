// client/src/components/home/RoomThread.test.jsx — FIX-6 job 1
//
// THE ROOM'S COMPOSER, in the desk's rail. Same rule as the desk's panel
// composer (panelParts.test.jsx): Enter says it, Shift+Enter is the newline.
//
// It was an <input> in a form, which got the first half right by accident —
// the form submitted — and could not get the second half at all. The box is a
// textarea now, so the rule is the component's and not the browser's.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RoomThread, attribution, nameFor } from './RoomThread.jsx';

const AGENTS = [{ id: 'a1', name: 'Balance' }, { id: 'a2', name: 'Granite' }];

function room(props = {}) {
  const onSay = vi.fn();
  render(<RoomThread lines={[]} agents={AGENTS} atHome={2} onSay={onSay} {...props} />);
  return { onSay, box: screen.getByTestId('room-thread-input') };
}

describe('FIX-6 · the room composer', () => {
  it('Enter says it to the room', async () => {
    const user = userEvent.setup();
    const { onSay, box } = room();

    await user.click(box);
    await user.keyboard('anyone up?{Enter}');

    expect(onSay).toHaveBeenCalledWith('anyone up?');
    expect(box).toHaveValue('');
  });

  it('Shift+Enter keeps the line open instead of sending it', async () => {
    const user = userEvent.setup();
    const { onSay, box } = room();

    await user.click(box);
    await user.keyboard('anyone up?{Shift>}{Enter}{/Shift}still there?');

    expect(onSay).not.toHaveBeenCalled();
    expect(box).toHaveValue('anyone up?\nstill there?');
  });

  it('Enter on an empty box says nothing', async () => {
    const user = userEvent.setup();
    const { onSay, box } = room();

    await user.click(box);
    await user.keyboard('   {Enter}');

    expect(onSay).not.toHaveBeenCalled();
  });

  it('a send still in flight is not sent twice', async () => {
    const user = userEvent.setup();
    const { onSay, box } = room({ sending: true });

    await user.click(box);
    await user.keyboard('again{Enter}');

    expect(onSay).not.toHaveBeenCalled();
  });

  it('the arrow button still says it, for anyone who reaches for the mouse', async () => {
    const user = userEvent.setup();
    const { onSay, box } = room();

    await user.click(box);
    await user.keyboard('over here');
    await user.click(screen.getByRole('button', { name: 'Say it' }));

    expect(onSay).toHaveBeenCalledWith('over here');
  });
});

describe('the room names who said what', () => {
  it('reads an id back as the name the room uses', () => {
    expect(nameFor('owner', AGENTS)).toBe('YOU');
    expect(nameFor('all', AGENTS)).toBe('THE ROOM');
    expect(nameFor('a2', AGENTS)).toBe('GRANITE');
    expect(nameFor('nobody', AGENTS)).toBeNull();
  });

  it('half an attribution is no attribution', () => {
    expect(attribution({ from: 'a1', to: 'a2' }, AGENTS)).toBe('BALANCE → GRANITE');
    expect(attribution({ from: 'a1' }, AGENTS)).toBeNull();
    expect(attribution({}, AGENTS)).toBeNull();
  });
});
