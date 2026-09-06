// client/src/hooks/useSheetDrag.test.jsx — BUGS-A job 5
//
// A sheet is dismissed with a finger. The three rules under test are the three
// ways that gesture can be wrong: it must not fire on a short pull, it must not
// steal a caret, and it must not steal a scroll.

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import { DISMISS_PX, useSheetDrag, isFieldTarget, inScrolledRegion } from './useSheetDrag.js';

function Sheet({ onDismiss, enabled = true, withList = false }) {
  const drag = useSheetDrag(onDismiss, { enabled });
  return (
    <div
      data-testid="panel"
      ref={drag.ref}
      style={drag.style}
      className={drag.dragging ? 'is-dragging' : ''}
      {...drag.handlers}
    >
      <span data-testid="grab">grab</span>
      <input aria-label="say" />
      {withList && <div data-testid="list"><span data-testid="row">a row</span></div>}
    </div>
  );
}

/** One finger, down at y0 and up at y1, moving through the window. */
function drag(el, y0, y1) {
  fireEvent.touchStart(el, { touches: [{ clientY: y0 }] });
  fireEvent.touchMove(window, { touches: [{ clientY: (y0 + y1) / 2 }] });
  fireEvent.touchMove(window, { touches: [{ clientY: y1 }] });
  fireEvent.touchEnd(window);
}

describe('BUGS-A job 5 · dragging a sheet down', () => {
  it('a pull past the threshold puts it away', () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    drag(screen.getByTestId('grab'), 100, 100 + DISMISS_PX + 20);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a short pull springs back and dismisses nothing', () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    const panel = screen.getByTestId('panel');
    drag(screen.getByTestId('grab'), 100, 100 + DISMISS_PX - 20);
    expect(onDismiss).not.toHaveBeenCalled();
    // Back where it started, so the sheet is readable again.
    expect(panel.style.transform).toBe('');
  });

  it('the sheet tracks the finger while it is on it', () => {
    render(<Sheet onDismiss={() => {}} />);
    const panel = screen.getByTestId('panel');
    fireEvent.touchStart(screen.getByTestId('grab'), { touches: [{ clientY: 100 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 160 }] });
    expect(panel.style.transform).toBe('translateY(60px)');
    expect(panel).toHaveClass('is-dragging');
    fireEvent.touchEnd(window);
  });

  it('never travels upwards — a sheet with one size has nowhere to go', () => {
    render(<Sheet onDismiss={() => {}} />);
    const panel = screen.getByTestId('panel');
    fireEvent.touchStart(screen.getByTestId('grab'), { touches: [{ clientY: 300 }] });
    fireEvent.touchMove(window, { touches: [{ clientY: 200 }] });
    expect(panel.style.transform).toBe('');
    fireEvent.touchEnd(window);
  });

  it('rule 1: a drag that starts in a field is the caret, not a swipe', () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    drag(screen.getByLabelText('say'), 100, 400);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('rule 2: a drag that starts in a scrolled list is the list', () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} withList />);
    const list = screen.getByTestId('list');
    // jsdom has no layout, so scrollTop is set the way a scrolled list has it.
    Object.defineProperty(list, 'scrollTop', { value: 40, configurable: true });
    drag(screen.getByTestId('row'), 100, 400);
    expect(onDismiss).not.toHaveBeenCalled();

    // At the top of the same list there is nothing left to reveal, so the
    // gesture belongs to the sheet.
    Object.defineProperty(list, 'scrollTop', { value: 0, configurable: true });
    drag(screen.getByTestId('row'), 100, 400);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('works with a mouse, and keeps working after the pointer leaves the sheet', () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} />);
    fireEvent.mouseDown(screen.getByTestId('grab'), { clientY: 100 });
    fireEvent.mouseMove(window, { clientY: 400 });
    fireEvent.mouseUp(window);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('a disabled sheet does not move at all', () => {
    const onDismiss = vi.fn();
    render(<Sheet onDismiss={onDismiss} enabled={false} />);
    drag(screen.getByTestId('grab'), 100, 400);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByTestId('panel').style.transform).toBe('');
  });
});

describe('BUGS-A job 5 · the two refusal rules on their own', () => {
  it('names the fields a caret can land in', () => {
    expect(isFieldTarget(document.createElement('input'))).toBe(true);
    expect(isFieldTarget(document.createElement('textarea'))).toBe(true);
    expect(isFieldTarget(document.createElement('select'))).toBe(true);
    expect(isFieldTarget(document.createElement('span'))).toBe(false);
    expect(isFieldTarget(null)).toBe(false);
  });

  it('stops looking for a scroll at the sheet root', () => {
    const outside = document.createElement('div');
    const root = document.createElement('div');
    const inner = document.createElement('span');
    outside.appendChild(root);
    root.appendChild(inner);
    Object.defineProperty(outside, 'scrollTop', { value: 200, configurable: true });
    // The page behind the sheet being scrolled says nothing about the sheet.
    expect(inScrolledRegion(inner, root)).toBe(false);
  });
});
