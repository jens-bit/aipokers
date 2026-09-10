import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HomeBubble, HomeOne } from './atoms.jsx';

const css = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/home1.css'), 'utf8');
const rule = selector => css.slice(css.indexOf(`\n${selector} {`)).split('}')[0];
const agent = { id:'a', name:'Professor', location:{where:'home'}, mood:{state:'neutral',heat:20}, fatigue:'fresh', routine:{key:'reads'} };

describe('BUG-185: ordinary room speech has the authored side anatomy', () => {
  it.each(['left', 'right'])('the %s tail is outside an inner two-line clamp', side => {
    const { container } = render(<HomeBubble text="A real line, still bounded and readable." side={side} />);
    const bubble = container.querySelector('.home-bubble');
    expect(bubble.querySelector('.home-bubble__text')).toHaveTextContent('A real line, still bounded and readable.');
    expect(bubble.querySelector('.home-bubble__tail')).toHaveAttribute('aria-hidden', 'true');
    expect(rule('.home-bubble')).toContain('overflow: visible');
    expect(rule('.home-bubble__text')).toContain('-webkit-line-clamp: 2');
    expect(rule('.home-bubble__text')).toContain('overflow: hidden');
  });

  it.each([46,50,56,62])('a %spx ordinary body anchors its line to half its actual height', size => {
    render(<HomeOne agent={agent} size={size} at={{x:200,y:400}} bubble={{text:'Hello.',side:'right'}} />);
    const body = screen.getByRole('button', { name:'Professor — reading' });
    expect(body.style.getPropertyValue('--home-room-speech-top')).toBe(`${size / 2}px`);
    expect(body.style.getPropertyValue('--home-room-bubble-offset')).toBe(`${Math.max(32,size / 2 - 2)}px`);
  });

  it('keeps the separately authored carry and refusal voice anchors', () => {
    const { rerender } = render(<HomeOne agent={agent} at={{x:200,y:400}} carried={{x:350,y:300}} />);
    let body = screen.getByRole('button', { name:'Professor — reading' });
    expect(body.style.getPropertyValue('--home-speech-top')).toBe(`${62 * .65}px`);
    expect(body).toHaveClass('is-carried');
    expect(screen.getByText('Where are we going?')).toBeInTheDocument();
    rerender(<HomeOne agent={agent} at={{x:200,y:400}} refusing bubble={{text:'In a hand.',side:'right'}} />);
    body = screen.getByRole('button', { name:'Professor — reading' });
    expect(body.style.getPropertyValue('--home-speech-top')).toBe(`${46 * .65}px`);
    expect(body).toHaveClass('is-refusing');
    expect(screen.getByText('In a hand.')).toBeInTheDocument();
  });
});
