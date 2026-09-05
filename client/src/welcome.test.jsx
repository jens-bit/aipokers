// client/src/welcome.test.jsx — LAND-4
//
// client/public/welcome/index.html is a hand-written static page: no build
// step, no component tree, so there is nothing to render here. What it does
// have is a responsive contract — three media-query blocks that swap which
// screenshot the page shows by toggling `display` — and one way to silently
// break it: put `display` in an inline style attribute. Inline styles beat
// stylesheet rules whatever the media query says, so the element keeps its
// desktop layout at every width.
//
// That is exactly what LAND-4 was. `.floor-desktop` carried
// style="display:flex;justify-content:center", so the ≤768 rule
// `.floor-desktop{display:none}` never applied and the 893px-wide desktop
// floor shot stayed in layout on phones: document.scrollWidth was 831 at 768,
// 642 at 390, 634 at 375 against viewports of 768/390/375.
//
// jsdom has no layout engine, so it cannot measure the overflow. It can
// enforce the rule that caused it.

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.join(HERE, '..', 'public', 'welcome', 'index.html');

const html = fs.readFileSync(PAGE, 'utf8');
const styleBlock = html.slice(html.indexOf('<style>'), html.indexOf('</style>'));
const body = html.slice(html.indexOf('<body>'));

/** Class names the media-query blocks hide with `display:none`. */
function responsivelyHiddenClasses() {
  const names = new Set();
  for (const block of styleBlock.split('@media').slice(1)) {
    for (const rule of block.matchAll(/\.([A-Za-z0-9_-]+)[^{}]*\{([^}]*)\}/g)) {
      if (/display\s*:\s*none/.test(rule[2])) names.add(rule[1]);
    }
  }
  return names;
}

/** Elements in the markup whose class list contains `cls`. */
function elementsWithClass(cls) {
  const out = [];
  for (const tag of body.matchAll(/<[a-z]+\s[^>]*>/g)) {
    const classAttr = /class="([^"]*)"/.exec(tag[0]);
    if (classAttr && classAttr[1].split(/\s+/).includes(cls)) out.push(tag[0]);
  }
  return out;
}

describe('welcome landing page', () => {
  it('LAND-4: no element a media query hides declares display inline', () => {
    const offenders = [];
    for (const cls of responsivelyHiddenClasses()) {
      for (const tag of elementsWithClass(cls)) {
        const styleAttr = /style="([^"]*)"/.exec(tag);
        if (styleAttr && /(^|;)\s*display\s*:/.test(styleAttr[1])) {
          offenders.push(`.${cls} — ${tag}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('LAND-4: .floor-desktop gets its display from the stylesheet', () => {
    // The base rule has to exist, or removing the inline style would leave the
    // desktop shot as a plain block and lose the centering.
    expect(styleBlock).toMatch(/\.floor-desktop\s*\{[^}]*display\s*:\s*flex/);
    expect(responsivelyHiddenClasses().has('floor-desktop')).toBe(true);
  });
});
