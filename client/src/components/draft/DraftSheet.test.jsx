// client/src/components/draft/DraftSheet.test.jsx — DRAFT-2
//
// The sheet's own rules, independent of the screen that mounts it: two
// registers and only two, the composer gives its place to the action, and the
// glass is the thread's glass.

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import '../../styles/draft2.css';
import { DraftSheet } from './DraftSheet.jsx';

const ROWS = [
  { id: 1, who: 'sys', text: 'How do you want him to play?' },
  { id: 2, who: 'you', text: 'Patient. I hate donking off chips.' },
  { id: 3, who: 'sys', text: 'Then he folds a lot and it will cost him pots.' },
];

describe('DRAFT-2: the sheet is a conversation with two sides', () => {
  it('draws the recruiter on one wall and the owner on the other', () => {
    const { container } = render(<DraftSheet rows={ROWS} />);
    expect(container.querySelectorAll('.draft-row--sys')).toHaveLength(2);
    expect(container.querySelectorAll('.draft-row--you')).toHaveLength(1);
  });

  it('never speaks in his voice — there is no third register to speak in', () => {
    const { container } = render(<DraftSheet rows={ROWS} />);
    // Every row is one of the two. A HIM row before he is born would be the
    // voice law broken, and there is no branch here that can produce one.
    const rows = [...container.querySelectorAll('.draft-row')];
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.className).toMatch(/draft-row--(sys|you)/);
    }
  });

  it('counts him out of four, so the owner knows how much is left', () => {
    render(<DraftSheet rows={ROWS} stage={2} />);
    expect(screen.getByTestId('draft-count')).toHaveTextContent('THE DRAFT · 2 OF 4');
  });

  it('never counts past four however long the conversation runs', () => {
    render(<DraftSheet rows={ROWS} stage={9} />);
    expect(screen.getByTestId('draft-count')).toHaveTextContent('THE DRAFT · 4 OF 4');
  });
});

describe('DRAFT-2: the composer, and what replaces it', () => {
  it('sends what was typed and nothing else', async () => {
    const onSend = vi.fn();
    render(<DraftSheet rows={ROWS} draft="  Wait to be paid.  " onSend={onSend} onDraft={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).toHaveBeenCalledWith('Wait to be paid.');
  });

  it('will not send an empty answer', async () => {
    const onSend = vi.fn();
    render(<DraftSheet rows={ROWS} draft="   " onSend={onSend} onDraft={() => {}} />);
    expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('will not send twice while one is in flight', async () => {
    const onSend = vi.fn();
    render(<DraftSheet rows={ROWS} draft="Good." onSend={onSend} onDraft={() => {}} busy />);
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('GIVES THE COMPOSER ITS PLACE to the action — F-1, and the ref\'s F03', () => {
    const { rerender } = render(<DraftSheet rows={ROWS} onDraft={() => {}} />);
    expect(screen.getByTestId('draft-input')).toBeInTheDocument();

    rerender(<DraftSheet rows={ROWS} onDraft={() => {}} action={<button type="button">Deal him in</button>} />);
    // Both at once would be two primary actions on one screen.
    expect(screen.queryByTestId('draft-input')).toBeNull();
    expect(screen.getByRole('button', { name: 'Deal him in' })).toBeInTheDocument();
  });

  it('shows the recruiter thinking rather than an empty pause', () => {
    render(<DraftSheet rows={ROWS} pending />);
    expect(screen.getByTestId('draft-pending')).toBeInTheDocument();
  });
});

describe('DRAFT-2: one glass, and it is the thread\'s', () => {
  // jsdom does not substitute var(), so the computed background of a rule that
  // uses a custom property is transparent. Reading the DECLARATION is both what
  // works and what this test actually wants to say: the sheet must go through
  // the shared token rather than restating a colour, because a restated colour
  // is how two glass surfaces drift apart.
  const declared = (selector, prop) => {
    for (const sheet of document.styleSheets) {
      for (const rule of sheet.cssRules ?? []) {
        if (rule.selectorText === selector && rule.style?.getPropertyValue(prop)) {
          return rule.style.getPropertyValue(prop).trim();
        }
      }
    }
    return null;
  };

  it('is the raised glass wave 56 gives every sheet over the room', () => {
    render(<DraftSheet rows={ROWS} />);
    // The sheet names the token, not a colour...
    expect(declared('.draft-sheet', 'background')).toBe('var(--glass-raised)');
    expect(declared('.draft-sheet', 'border-top')).toContain('var(--glass-edge-up)');
    // ...and the token is V5GLASS.raised / .edgeUp from board 26's ThreadSheet.
    expect(declared(':root', '--glass-raised')).toBe('rgba(18, 30, 28, 0.84)');
    expect(declared(':root', '--glass-edge-up')).toBe('rgba(255, 255, 255, 0.17)');
    expect(declared('.draft-sheet', 'backdrop-filter')).toContain('var(--glass-blur)');
  });

  it('leaves the room\'s upper band alone — that is where he forms', () => {
    const { container } = render(<DraftSheet rows={ROWS} />);
    const css = getComputedStyle(container.querySelector('.draft-sheet'));
    // The sheet is a layer anchored to the bottom, not a screen: it starts part
    // way down and the room keeps everything above it.
    expect(css.position).toBe('absolute');
    expect(css.bottom).toBe('0px');
    expect(parseFloat(css.top)).toBeGreaterThan(0);
  });
});
