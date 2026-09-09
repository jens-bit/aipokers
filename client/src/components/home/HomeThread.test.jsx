import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { HomeThread, collapsedLine } from './HomeThread.jsx';
import { fetchMock } from '../../test/harness.js';

it('BUG-158: the want stays in its toast while the room uses the served seated greeting', async () => {
  fetchMock.route('/thread', { lines: [] });
  const agent = { id: 'wild', name: 'Wild Card', homeTableId: 'home-test',
    routine: { key: 'plays', label: 'in a hand' },
    lastMoment: { kind: 'want', text: 'A beer would help.' },
    opener: 'This hand first. Then we make something happen.' };
  render(<HomeThread agent={agent} />);
  expect(await screen.findByText(agent.opener)).toBeVisible();
  expect(screen.queryByText(agent.lastMoment.text)).not.toBeInTheDocument();
  expect(screen.queryByText(/Deal me in/)).not.toBeInTheDocument();
  expect(collapsedLine(agent, [{ text: 'That river hurt.' }])).toBe('That river hurt.');
  expect(collapsedLine({ ...agent, unseenRecap: true,
    sessionRecap: { text: 'Last night stayed with me.' } }, [{ text: 'That river hurt.' }]))
    .toBe('Last night stayed with me.');
});

it('BUG-75: a refused private message restores the draft and reports the failure',async()=>{
  fetchMock.route('/thread',{lines:[]});
  const send=vi.fn().mockResolvedValue(null);
  render(<HomeThread agent={{id:'bal',name:'Bal'}} onSend={send}/>);
  await userEvent.type(screen.getByTestId('home-thread-input'),'Watch the river');
  await userEvent.click(screen.getByRole('button',{name:'Send',exact:true}));
  await waitFor(()=>expect(screen.getByTestId('home-thread-input')).toHaveValue('Watch the river'));
  expect(screen.getByRole('alert')).toHaveTextContent('Could not send');
  expect(send).toHaveBeenCalledTimes(1);
});
