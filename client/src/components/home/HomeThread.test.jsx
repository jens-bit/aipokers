import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { HomeThread } from './HomeThread.jsx';
import { fetchMock } from '../../test/harness.js';

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
