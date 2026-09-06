// ResultToast — WATCH-7.
//
// What replaced the WON/LOST block at the end of a hand. The rules it has to
// keep are the ones the playtest asked for: it says one thing, it says it in
// the right colour, it is over in a second and a half, and it never stands
// between the owner and the felt.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResultToast } from './ResultToast.jsx';
import { RESULT_TOAST_MS } from '../../lib/pace.js';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(resolve(clientRoot, 'src/styles/watch6.css'), 'utf8');
const rule = (selector) => {
  const found = new RegExp(`${selector.replace(/[.\-]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  return found ? found[1] : '';
};

describe('the receipt', () => {
  it('says what the hand did to him, and nothing else', () => {
    const { container } = render(<ResultToast delta="+$30" won />);
    const toast = container.querySelector('.watch-result-toast');
    expect(toast.textContent).toBe('+$30');
    expect(toast.className).toContain('is-won');
  });

  it('is red when it cost him', () => {
    const { container } = render(<ResultToast delta="−$30" won={false} />);
    expect(container.querySelector('.watch-result-toast').className).toContain('is-lost');
  });

  // Nothing at all is better than "+$0" for a hand the screen could not read.
  it('draws nothing when there is no number', () => {
    const { container } = render(<ResultToast delta={null} won />);
    expect(container.querySelector('.watch-result-toast')).toBeNull();
  });

  it('is announced to a screen reader, because it is the only thing said', () => {
    const { container } = render(<ResultToast delta="+$30" won />);
    const toast = container.querySelector('.watch-result-toast');
    expect(toast.getAttribute('role')).toBe('status');
    expect(toast.getAttribute('aria-live')).toBe('polite');
  });
});

describe('and it never blocks the felt', () => {
  it('takes no taps', () => {
    expect(rule('.watch-result-toast')).toMatch(/pointer-events:\s*none/);
  });

  it('is gone in the time the screen says it is', () => {
    expect(RESULT_TOAST_MS).toBe(1500);
    // The keyframes run for exactly that, so the node unmounts as it finishes
    // fading rather than sitting there invisible over his strip.
    expect(rule('.watch-result-toast')).toMatch(
      new RegExp(`animation:\\s*watch-toast ${RESULT_TOAST_MS}ms`),
    );
  });

  it('has a plain fade when the phone asks for one', () => {
    expect(css).toMatch(/@media \(prefers-reduced-motion: reduce\)[\s\S]{0,200}watch-toast-fade/);
  });

  // It hangs off his strip, upwards. Anchored to the felt it could land on the
  // board; anchored downwards it would cover the number that is ticking.
  it('sits above the strip it belongs to', () => {
    const r = rule('.watch-result-toast');
    expect(r).toMatch(/position:\s*absolute/);
    expect(r).toMatch(/bottom:\s*calc\(100% \+ \d+px\)/);
  });
});
