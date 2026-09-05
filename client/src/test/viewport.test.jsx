// client/src/test/viewport.test.jsx — FIX-1b
//
// Mobile playtest 2026-09-05: focusing a field in Telegram iOS zoomed the whole
// mini app, and a zoomed webview never scrolls back — the layout stays broken
// for the rest of the session.
//
// Two defences, both asserted here:
//   1. the viewport meta pins the scale, so nothing can zoom the page at all
//   2. no focusable text field is below 16px, which is what triggers the zoom
//
// index.html and the stylesheets are build inputs, not modules, so this reads
// them off disk rather than mounting anything.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(resolve(clientRoot, rel), 'utf8');

describe('FIX-1b iOS zoom', () => {
  it('FIX-1b: the viewport meta pins the scale', () => {
    const html = read('index.html');
    const meta = /<meta\s+name="viewport"\s+content="([^"]+)"/.exec(html);
    expect(meta, 'index.html has no viewport meta').not.toBeNull();

    const content = meta[1];
    const directives = Object.fromEntries(
      content.split(',').map((part) => part.trim().split('=').map((s) => s.trim())),
    );

    expect(directives['width']).toBe('device-width');
    expect(directives['initial-scale']).toBe('1.0');
    expect(directives['maximum-scale']).toBe('1');
    expect(directives['user-scalable']).toBe('no');
    // KEY-1 relies on this for the Telegram safe area; it must survive the edit.
    expect(content).toContain('viewport-fit=cover');
  });

  // The invariant is "on a touch device, every text field is at least 16px".
  // A rule may keep a smaller size for a mouse as long as it lifts it under
  // `@media (pointer: coarse)` — that is how the desktop composer keeps its
  // 13.5px design without zooming an iPad.
  it('FIX-1b: no text field is below 16px on a touch device', () => {
    const sheets = [
      'src/styles/base.css',
      'src/styles/layout.css',
      'src/styles/chat.css',
      'src/styles/agent-chat.css',
      'src/styles/analysis.css',
      'src/styles/action-bar.css',
      'src/styles/play.css',
      'src/styles/desktop.css',
    ];

    // Selectors that style an <input> or <textarea>. The amount stepper and the
    // desktop composer are the two that are keyed by class rather than element.
    const FIELD_SELECTOR = /(^|[\s,>])(input|textarea)\b|\b(amount-input|chat-bar__input|dr-chat-tab__input|dsk-composer__input|dr-chat-input\s+input)\b/;

    // Declarations inside `@media (pointer: coarse)` are what a touch device
    // actually gets, so collect those separately and let them win.
    function blocks(css) {
      return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .map(([, selector, body]) => ({ selector: selector.trim(), body }));
    }

    function coarseSizes(css) {
      const sizes = new Map();
      for (const [, inner] of css.matchAll(/@media[^{]*\(\s*pointer\s*:\s*coarse\s*\)[^{]*\{([\s\S]*?)\n\}/g)) {
        for (const { selector, body } of blocks(inner)) {
          const size = /font-size:\s*([\d.]+)px/.exec(body);
          if (size) sizes.set(selector, Number(size[1]));
        }
      }
      return sizes;
    }

    const offenders = [];
    for (const rel of sheets) {
      const css = read(rel);
      const coarse = coarseSizes(css);
      for (const { selector, body } of blocks(css)) {
        if (!FIELD_SELECTOR.test(selector)) continue;
        const size = /font-size:\s*([\d.]+)px/.exec(body);
        if (!size) continue;
        const effective = coarse.get(selector) ?? Number(size[1]);
        if (effective < 16) offenders.push(`${rel}: ${selector} → ${effective}px`);
      }
    }

    expect(offenders, `text fields below the 16px iOS zoom threshold:\n${offenders.join('\n')}`)
      .toEqual([]);
  });
});
