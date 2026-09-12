import { useState } from 'react';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { ReadSheet } from './ReadSheet.jsx';

function TableWithRead({ onClose = () => {} }) {
  const [selected, setSelected] = useState('Granite');
  return <div className="watch-felt" data-testid="felt">
    <span>Pot $20</span>
    <button onClick={() => setSelected(prev => prev === 'Wild Card' ? null : 'Wild Card')}>Read Wild Card</button>
    {selected && <ReadSheet seat={{ name: selected, stack: 2000 }} entry={null}
      onClose={() => { onClose(); setSelected(null); }}/>}
  </div>;
}

it('BUG-143: tapping exposed felt dismisses only the read and can reopen another seat', async () => {
  const user = userEvent.setup(), onClose = vi.fn();
  render(<TableWithRead onClose={onClose}/>);
  await user.click(screen.getByText('NO EVIDENCE YET'));
  expect(onClose).not.toHaveBeenCalled();
  await user.click(screen.getByText('Pot $20'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('felt')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Read Wild Card' }));
  expect(screen.getByRole('dialog', { name: 'Wild Card — read' })).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Read Wild Card' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).toBeNull();
});

it('BUG-143: a scrolled read still closes from the visible Close control', async () => {
  const user = userEvent.setup(), onClose = vi.fn();
  render(<TableWithRead onClose={onClose}/>);
  screen.getByRole('dialog').scrollTop = 100;
  await user.click(screen.getByRole('button', { name: 'Close read' }));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('BUG-143: opponent stats have a visible Close control with a phone-sized target', async () => {
  const user=userEvent.setup(), onClose=vi.fn();
  render(<TableWithRead onClose={onClose}/>);
  const close=screen.getByRole('button',{name:'Close read'});
  expect(close).toHaveTextContent('Close');
  const css=readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../styles/watch.css'), 'utf8');
  const grab=css.match(/\.read-sheet__grab\s*\{([^}]+)\}/)[1];
  expect(grab).toMatch(/min-height:\s*44px/);
  await user.click(close);
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('BUG-143: Escape closes the opponent stats without leaving the desktop table', async () => {
  const user=userEvent.setup(), leaveTable=vi.fn();
  window.addEventListener('keydown', leaveTable);
  try {
    render(<TableWithRead/>);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(leaveTable).not.toHaveBeenCalled();
  } finally {
    window.removeEventListener('keydown', leaveTable);
  }
});

it('BUG-143: another seat remains tappable and the read still drags down to dismiss', async () => {
  const user=userEvent.setup(), onClose=vi.fn();
  render(<TableWithRead onClose={onClose}/>);
  await user.click(screen.getByRole('button',{name:'Read Wild Card'}));
  const sheet=screen.getByRole('dialog',{name:'Wild Card — read'});
  fireEvent.mouseDown(sheet,{clientY:100});
  fireEvent.mouseMove(window,{clientY:210});
  fireEvent.mouseUp(window,{clientY:210});
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('dialog')).toBeNull();
});
