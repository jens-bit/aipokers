// ThreadSheet — the record, as a glass layer over the lower felt.
// Port of design-refs/mood-watch5.jsx `V5ThreadSheet` / `V5Row`.
//
// "The TABLE tab and its transcript are gone: history is a GLASS SHEET over the
// lower felt with the game still playing behind it. The felt never resizes for
// a sheet — that was the tell that the sheet was a different screen rather than
// a layer."
//
// Four registers, one row: HIM in teal at 13px, YOU in gold, TABLE muted (gold
// when it is a cost), and an opponent quoted and italicised.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { ThreadSheet, ThreadRow } from './ThreadSheet.jsx';

const clientRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const css = readFileSync(resolve(clientRoot, 'src/styles/watch6.css'), 'utf8');
const rule = (selector) => {
  const found = new RegExp(`${selector.replace(/[.\-]/g, '\\$&')}\\s*\\{([^}]*)\\}`).exec(css);
  return found ? found[1] : '';
};

const ROWS = [
  { id: '1', who: 'TABLE', text: 'Granite raised to 240', at: '18:31' },
  { id: '2', who: 'HIM', text: 'He has shown that sizing twice. It is a bluff.', at: '18:31' },
  { id: '3', who: 'GRANITE', text: 'Again?', at: '18:31' },
  { id: '4', who: 'YOU', text: 'Careful with him.', at: '18:32' },
  { id: '5', who: 'TABLE', cost: true, text: 'He misjudged equity by 7% · FOCUS', at: '18:33' },
];

describe('the sheet', () => {
  it('takes the lower 70% of the felt and no more', () => {
    const sheet = rule('.thread-sheet');
    expect(sheet).toMatch(/position:\s*absolute/);
    expect(sheet).toMatch(/bottom:\s*0/);
    expect(sheet).toMatch(/height:\s*70%/);
  });

  it('is the same glass as everything else on the screen', () => {
    const sheet = rule('.thread-sheet');
    expect(sheet).toMatch(/background:\s*rgba\(13,\s*23,\s*21,\s*0\.72\)/);
    expect(sheet).toMatch(/backdrop-filter:\s*blur\(18px\) saturate\(1\.2\)/);
  });

  // A read opens in exactly the same place, in exactly the same material, so
  // the two never read as two different kinds of thing.
  it('the read sheet is the same layer, in the same glass', () => {
    const read = rule('.read-sheet');
    expect(read).toMatch(/height:\s*70%/);
    expect(read).toMatch(/rgba\(13,\s*23,\s*21,\s*0\.72\)/);
    expect(read).not.toMatch(/var\(--sys-panel/);
  });

  it('names itself and says the game is still going', () => {
    const { container } = render(<ThreadSheet rows={ROWS} live />);
    expect(container.querySelector('.glass-lbl').textContent).toBe('The table');
    expect(container.querySelector('.thread-sheet__state').textContent)
      .toBe('THE HAND IS STILL PLAYING');
  });

  it('says so between hands instead', () => {
    const { container } = render(<ThreadSheet rows={ROWS} live={false} />);
    expect(container.querySelector('.thread-sheet__state').textContent).toBe('BETWEEN HANDS');
  });

  it('closes on its grab bar', () => {
    const onClose = vi.fn();
    const { container } = render(<ThreadSheet rows={ROWS} onClose={onClose} />);
    container.querySelector('.thread-sheet__grab').click();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('says it is empty rather than showing an empty box', () => {
    const { container } = render(<ThreadSheet rows={[]} />);
    expect(container.querySelector('.thread-sheet__empty')).toBeTruthy();
  });

  it('shows him thinking while he is being asked something', () => {
    const { container } = render(<ThreadSheet rows={[]} pending />);
    expect(container.querySelector('.thread-sheet__empty')).toBeNull();
    expect(container.querySelector('.dr-typing')).toBeTruthy();
  });

  it('carries its own furniture in the head and the foot', () => {
    const { container } = render(
      <ThreadSheet rows={ROWS} head={<button type="button">Sound on</button>}
        foot={<div className="watch-sitout-strip" />} />,
    );
    expect(container.querySelector('.thread-sheet__head button')).toBeTruthy();
    expect(container.querySelector('.thread-sheet__foot .watch-sitout-strip')).toBeTruthy();
  });
});

describe('the rows', () => {
  it('attributes every line to whoever said it', () => {
    const { container } = render(<ThreadSheet rows={ROWS} />);
    expect([...container.querySelectorAll('.thread-row__who')].map((e) => e.textContent))
      .toEqual(['TABLE', 'HIM', 'GRANITE', 'YOU', 'TABLE']);
  });

  it('gives each register its own class', () => {
    const { container } = render(<ThreadSheet rows={ROWS} />);
    expect([...container.querySelectorAll('.thread-row')].map((e) => e.className.split(' ')[1]))
      .toEqual([
        'thread-row--table', 'thread-row--him', 'thread-row--them',
        'thread-row--you', 'thread-row--table',
      ]);
  });

  // "Table talk is background until it isn't": an opponent is quoted, the three
  // named registers are not.
  it('quotes an opponent and nobody else', () => {
    const { container } = render(<ThreadSheet rows={ROWS} />);
    const text = [...container.querySelectorAll('.thread-row__text')].map((e) => e.textContent);
    expect(text[2]).toBe('“Again?”');
    expect(text[1]).toBe('He has shown that sizing twice. It is a bluff.');
    expect(text[3]).toBe('Careful with him.');
  });

  it('marks a cost row so it can be found again', () => {
    const { container } = render(<ThreadSheet rows={ROWS} />);
    const rows = container.querySelectorAll('.thread-row');
    expect(rows[4].className).toContain('is-cost');
    expect(rows[0].className).not.toContain('is-cost');
  });

  // WATCH-9. The gold used to come from a flag the felt put on its own LIVE
  // row, so the same line read back off the store — a reconnect, or a look at
  // the sheet an hour later — came back in the room's ordinary grey. It is a
  // stored field now, and a stored row is exactly what the sheet is handed.
  it('WATCH-9: a stored cost line is still gold', () => {
    const row = {
      id: 's91', kind: 'table', who: 'TABLE', stored: true, t: 1_700_000_000_000,
      text: 'he misjudged equity by 7 points · FOCUS', cost: true,
    };
    const { container } = render(<ThreadRow row={row} />);
    const el = container.querySelector('.thread-row');
    expect(el.className).toContain('thread-row--table');
    expect(el.className).toContain('is-cost');
  });

  // A row that only has a timestamp still prints a clock, because the record is
  // ordered and an unlabelled line in an ordered list is a hole in it.
  it('reads the clock off a timestamp when it is not given one', () => {
    const t = new Date(2026, 8, 6, 18, 31).getTime();
    const { container } = render(<ThreadRow row={{ who: 'HIM', text: 'x', t }} />);
    expect(container.querySelector('.thread-row__at').textContent).toBe('18:31');
  });

  it('prints nothing rather than NaN when it has neither', () => {
    const { container } = render(<ThreadRow row={{ who: 'HIM', text: 'x' }} />);
    expect(container.querySelector('.thread-row__at').textContent).toBe('');
  });
});
