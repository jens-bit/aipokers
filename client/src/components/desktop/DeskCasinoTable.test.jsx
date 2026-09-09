import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { DeskCasinoTable } from './DeskCasinoTable.jsx';
import { midHandGame } from '../../test/fixtures/game.js';

it('DkWatch: uses the assigned server seat and its actual cards',()=>{
  const game={...midHandGame,seats:[{displayName:'Same',stack:100,holeCards:[]},{displayName:'Same',stack:2200,holeCards:['Ah','Kd']}]};
  const {container}=render(<DeskCasinoTable game={game} mySeat={1} agent={{name:'Same'}} lastDecision={{seat:1,reasoning:'He is capped.'}}/>);
  expect(container.querySelector('.watch-hero__cards')).toHaveTextContent('AK');
  expect(container.querySelector('.watch-hero__says')).toHaveTextContent('He is capped.');
  expect(container.querySelector('.watch-felt__hero-stack').textContent).toContain((2200).toLocaleString('en-US'));
  expect(container.querySelector('.watch-hero__strip [data-bar="heat"]')).toBeNull();
});

it('DkWatch: the public camera cannot manufacture private cards or a sit-out control',async()=>{
  const onBack=vi.fn();
  const game={...midHandGame,seats:[{displayName:'Granite',stack:1800,holeCards:[]},{displayName:'Bluff',stack:2200,holeCards:[]}]};
  const {container}=render(<DeskCasinoTable game={game} mySeat={-1} onBack={onBack}/>);
  expect(screen.getByRole('region',{name:'Granite at the table'})).toBeVisible();
  expect(container.querySelector('.watch-hero__cards')).toHaveTextContent('');
  expect(screen.queryByRole('button',{name:'Sit out'})).toBeNull();
  expect(screen.getByRole('button',{name:'Read this player'})).toBeVisible();
  await userEvent.click(screen.getByRole('button',{name:/BACK TO THE FLOOR/}));
  expect(onBack).toHaveBeenCalledOnce();
});
