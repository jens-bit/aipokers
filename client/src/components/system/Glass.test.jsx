// Glass — the material every panel on the watch screen is made of.
// Ported from design-refs/mood-watch4c.jsx (GLASS/Glass/GLbl), carried forward
// by design-refs/mood-watch5.jsx (V5GLASS/V5Glass/V5Lbl).
//
// "The area under the felt was a grey sheet butted against a dark green table:
// two different materials meeting at a hard line, which is why it looked cheap
// next to the felt."
//
// The tokens are exported so nothing on this screen can invent its own values;
// the CSS is asserted against the ref's numbers so nothing can drift from them.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { GLASS, Glass, GlassLabel } from './Glass.jsx';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(resolve(clientRoot, 'src/styles/watch6.css'), 'utf8');
// HOME-2 job 8 moved the NUMBERS to tokens.css so the room's sheets and the
// felt's panels cannot drift apart; watch6.css names them. Following the token
// to its definition is a stronger assertion than a literal here would be — it
// proves there is ONE definition rather than two that happen to agree today.
const tokens = readFileSync(resolve(clientRoot, 'src/styles/tokens.css'), 'utf8');
const rule = (selector) => {
  const found = new RegExp(`${selector.replace(/[.\-]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  return found ? found[1] : '';
};

describe('the glass tokens', () => {
  it('are v5\'s, exactly', () => {
    expect(GLASS).toEqual({
      panel: 'rgba(13,23,21,0.72)',
      raised: 'rgba(18,30,28,0.84)',
      edge: 'rgba(255,255,255,0.11)',
      edgeUp: 'rgba(255,255,255,0.17)',
      blur: 'blur(18px) saturate(1.2)',
    });
  });

  // Translucent over the felt's own colour, a thin light border, and a real
  // blur. A flat opaque panel here is the bug this material exists to fix.
  it('the stylesheet draws them, and it is translucent and blurred', () => {
    const base = rule('.glass');
    expect(base).toMatch(/background:\s*var\(--v5-panel\)/);
    expect(base).toMatch(/backdrop-filter:\s*var\(--v5-blur\)/);
    expect(base).toMatch(/-webkit-backdrop-filter:/);
    expect(base).toMatch(/border:\s*1px solid var\(--v5-edge\)/);
    // No opaque hex anywhere in it.
    expect(base).not.toMatch(/#[0-9A-Fa-f]{6}/);

    // ...and the tokens are still v5's own numbers.
    expect(tokens).toMatch(/--v5-panel:\s*rgba\(13,\s*23,\s*21,\s*0\.72\)/);
    expect(tokens).toMatch(/--v5-blur:\s*blur\(18px\) saturate\(1\.2\)/);
    expect(tokens).toMatch(/--v5-edge:\s*rgba\(255,\s*255,\s*255,\s*0\.11\)/);
  });

  it('the raised panel is the raised token, not a lighter guess', () => {
    const up = rule('.glass--up');
    expect(up).toMatch(/var\(--v5-raised\)/);
    expect(up).toMatch(/var\(--v5-edge-up\)/);
    expect(tokens).toMatch(/--v5-raised:\s*rgba\(18,\s*30,\s*28,\s*0\.84\)/);
    expect(tokens).toMatch(/--v5-edge-up:\s*rgba\(255,\s*255,\s*255,\s*0\.17\)/);
  });

  // "On glass the small-caps label reads as chrome, and this half of the screen
  // is not chrome." The section label takes the DISPLAY face.
  it('the section label takes the display face, not the Oswald label style', () => {
    const lbl = rule('.glass-lbl');
    expect(lbl).toMatch(/font-family:\s*var\(--sys-font-display/);
    expect(lbl).not.toMatch(/text-transform:\s*uppercase/);
    expect(lbl).not.toMatch(/Oswald/);
  });
});

describe('the components', () => {
  it('renders as glass, and takes the raised variant', () => {
    const { container } = render(<Glass>panel</Glass>);
    expect(container.firstChild.className).toBe('glass');

    const up = render(<Glass up>panel</Glass>);
    expect(up.container.firstChild.className).toBe('glass glass--up');
  });

  it('keeps a caller\'s own class and padding', () => {
    const { container } = render(<Glass className="watch-hero__strip" pad="8px 11px">x</Glass>);
    expect(container.firstChild.className).toBe('glass watch-hero__strip');
    expect(container.firstChild.style.padding).toBe('8px 11px');
  });

  it('the label is a label, not a panel', () => {
    const { container } = render(<GlassLabel>The table</GlassLabel>);
    expect(container.firstChild.className).toBe('glass-lbl');
    expect(container.firstChild.textContent).toBe('The table');
  });
});
