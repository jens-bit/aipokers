import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { it, expect, vi } from 'vitest';
import { WatchAgentSheet } from './WatchAgentSheet.jsx';

function Panel({ onLeave }) {
  const [open, setOpen] = useState(true), [view, setView] = useState('chat');
  return <div className="watch-felt"><span>Pot $20</span>
    <button onClick={onLeave}>Leave table</button>
    {open && <WatchAgentSheet agent={{ id: 'milo' }} name="Milo" seat={{ stack: 77 }}
      chat={[{ role: 'assistant', content: 'I remember.' }]} view={view} onView={setView} onClose={() => setOpen(false)}/>}
  </div>;
}
it('BUG-143: stats and conversation switch in place, Escape closes only the sheet', async () => {
  const user = userEvent.setup(), leave = vi.fn();
  render(<Panel onLeave={leave}/>);
  await user.click(screen.getByRole('button', { name: 'Stats' }));
  expect(screen.getByText('$77')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Conversation' }));
  expect(screen.getByText('I remember.')).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(leave).not.toHaveBeenCalled();
});
it('BUG-143: exposed felt closes the owner panel without leaving the table', async () => {
  const user = userEvent.setup(), leave = vi.fn();
  render(<Panel onLeave={leave}/>);
  await user.click(screen.getByText('Pot $20'));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(leave).not.toHaveBeenCalled();
});
