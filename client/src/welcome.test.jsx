// LAND-4's responsive contract now belongs to picture sources and real browser
// width checks. The old hand-drawn .hero-scene-d has been superseded by L2.
import { render } from '@testing-library/react';
import { it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LandingDetails } from './components/guest/LandingDetails.jsx';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');

it('every marketing picture resolves to a real capture at its declared dimensions', () => {
  const { container } = render(<LandingDetails/>);
  for (const element of container.querySelectorAll('img, source')) {
    const url = element.getAttribute('src') ?? element.getAttribute('srcset');
    const png = fs.readFileSync(path.join(root, url));
    expect(png.subarray(1,4).toString()).toBe('PNG');
    expect(png.readUInt32BE(16)).toBe(Number(element.getAttribute('width')));
    expect(png.readUInt32BE(20)).toBe(Number(element.getAttribute('height')));
  }
});
it('LAND-4: responsive captures have no inline display override', () => {
  const { container } = render(<LandingDetails/>);
  expect(container.querySelectorAll('source[media="(min-width: 701px)"]')).toHaveLength(5);
  for (const element of container.querySelectorAll('picture, source, img')) expect(element.style.display).toBe('');
});