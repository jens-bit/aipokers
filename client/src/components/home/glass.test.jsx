// client/src/components/home/glass.test.jsx — HOME-2 job 8
//
// ONE MATERIAL OVER THE ROOM AND OVER THE FELT.
//
// "Two different materials meeting at a hard line is why it looked cheap next
// to the felt." Board 29 wave 56 counted SEVENTEEN hand-tuned glasses in this
// product — opacities from 0.92 to 0.97, blurs from 14 to 18px — and replaced
// them with one set of numbers. This is what stops the eighteenth from being
// added: it reads the stylesheets rather than a rendered node, because the bug
// is not "this sheet looks wrong today", it is "somebody wrote their own glass
// again", and that is a fact about the CSS.
//
// jsdom applies the stylesheets it is given but resolves no custom properties
// across files, so the assertions are on the DECLARATIONS. That is the right
// level anyway: what matters is that every surface names the token, not that a
// browser resolved it to the same rgba four times.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const styles = (name) => readFileSync(resolve(here, '../../styles', name), 'utf8');

/** The declaration block for one selector, as written. */
function ruleFor(css, selector) {
  const at = css.indexOf(`\n${selector} {`);
  expect(at, `${selector} is in the stylesheet`).toBeGreaterThan(-1);
  return css.slice(at, css.indexOf('}', at));
}

describe('HOME-2 job 8 · every sheet and toast over the room is one glass', () => {
  const tokens = styles('tokens.css');
  const home = styles('home1.css');
  const roster = styles('roster.css');
  const watch = styles('watch6.css');

  it('the glass tokens derive from the shared appearance and retain their blur', () => {
    // Theme-aware glass keeps one ground and edge source across every surface.
    expect(tokens).toContain('--v5-panel: color-mix(in srgb, var(--bg-secondary) 94%, transparent)');
    expect(tokens).toContain('--v5-raised: color-mix(in srgb, var(--bg-secondary) 98%, transparent)');
    expect(tokens).toContain('--v5-edge: var(--edge)');
    expect(tokens).toContain('--v5-edge-up: var(--edge-strong)');
    expect(tokens).toContain('--v5-blur: blur(18px) saturate(1.2)');
  });

  it('BUG-181: the collapsed Home conversation band uses the authored panel glass, blur and raised edge', () => {
    const css = ruleFor(home, '.home-thread__band');
    expect.soft(css).toContain('background: var(--v5-panel)');
    expect.soft(css).toContain('backdrop-filter: var(--v5-blur)');
    expect.soft(css).toContain('-webkit-backdrop-filter: var(--v5-blur)');
    expect(css).toContain('border-top: 1px solid var(--v5-edge-up)');
  });

  // A SHEET takes `raised` — the thing on top is the lighter one — and it
  // blurs, because a panel that does not blur is a card and not a glass.
  it.each([
    ['the fridge and the table', () => ruleFor(home, '.home-sheet__panel')],
    ['the room thread', () => ruleFor(home, '.home-thread__sheet')],
    ['the roster', () => ruleFor(roster, '.roster__panel')],
  ])('%s rises in the raised glass', (_name, rule) => {
    const css = rule();
    expect(css).toContain('var(--v5-raised)');
    expect(css).toContain('backdrop-filter: var(--v5-blur)');
    expect(css).toContain('-webkit-backdrop-filter: var(--v5-blur)');
    expect(css).toContain('var(--v5-edge-up)');
  });

  // A TOAST takes `panel`. It is a strip over something, not a surface you
  // are working on.
  it.each([
    ['the want toast', () => ruleFor(home, '.home-want')],
    ['the result toast', () => ruleFor(watch, '.watch-result-toast')],
  ])('%s is the panel glass', (_name, rule) => {
    const css = rule();
    expect(css).toContain('var(--v5-panel)');
    expect(css).toContain('backdrop-filter: var(--v5-blur)');
  });

  // THE ONE THIS EXISTS TO CATCH. `.home-sheet__panel` was `rgba(14,20,19,0.97)`
  // with no blur at all: a grey card butted against the flat rather than
  // something raised over it, and the only surface in the room still doing it.
  it('no surface over the room paints its own opaque ground', () => {
    for (const [name, css] of [['home1.css', home], ['roster.css', roster]]) {
      const selectors = ['.home-sheet__panel', '.home-thread__sheet', '.roster__panel', '.home-want'];
      for (const sel of selectors) {
        if (!css.includes(`\n${sel} {`)) continue;
        const rule = ruleFor(css, sel);
        // No hand-written rgba ground. A tint over the token is allowed and is
        // what the want's gold is; a flat colour under nothing is not.
        const grounds = [...rule.matchAll(/background:\s*([^;]+);/g)].map((m) => m[1]);
        for (const ground of grounds) {
          expect(ground, `${name} ${sel} paints its own glass`).toContain('var(--v5-');
        }
      }
    }
  });

  // The SAFE is a whole money surface risen over the room, and YOU-2's sheet
  // paints its own solid ground for the screen it was written for. Over the
  // room the glass IS the ground — a solid header inside a glass sheet is a
  // flat grey panel with a blur around it.
  // BUG-39: SafeSheet replaced MoneySheet. Preserve the material requirement
  // on the current surface: one glass panel, unpainted header and tinted
  // wallet sections, including the Give subpage.
  it('BUG-39: the safe drops its own ground when it rises over the room', () => {
    const safe = styles('safe.css');
    const panel = ruleFor(safe, '.safe__panel');
    expect(panel).toContain('background: var(--v5-raised)');
    expect(panel).toContain('backdrop-filter: var(--v5-blur)');
    expect(panel).toContain('-webkit-backdrop-filter: var(--v5-blur)');
    expect(panel).toContain('--wal-panel-2: color-mix(in srgb, var(--text-primary) 4%, transparent)');
    // The current SafeSheet header is unpainted: it shares the panel's glass.
    expect(ruleFor(safe, '.safe__head')).not.toMatch(/background\s*:/);
  });

  // And the shared atom is the same material, so a panel built with <Glass>
  // and a sheet built by hand cannot disagree.
  it('the Glass atom reads the same tokens', () => {
    const rule = ruleFor(watch, '.glass');
    expect(rule).toContain('var(--v5-panel)');
    expect(rule).toContain('var(--v5-edge)');
    expect(ruleFor(watch, '.glass--up')).toContain('var(--v5-raised)');
  });
});
