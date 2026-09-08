import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RailMark } from './RailMark.jsx';

describe('BUG-57: the Railbird mark', () => {
  it('keeps separate SVG masks when the header and guest hero share a page', () => {
    render(<><RailMark /><RailMark size={30} color="#F4EBDD" /></>);
    const marks = screen.getAllByRole('img', { name: 'Railbird' });
    const ids = marks.map(mark => mark.querySelector('mask').id);
    expect(new Set(ids).size).toBe(2);
    marks.forEach((mark, i) => {
      expect(mark.lastElementChild.getAttribute('mask')).toBe(`url(#${ids[i]})`);
      expect(mark.getAttribute('viewBox')).toBe('0 0 64 64');
    });
  });
});
