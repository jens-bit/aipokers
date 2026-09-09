import { render } from '@testing-library/react';
import { expect,it } from 'vitest';
import { WatchFelt } from './WatchScreen.jsx';
import { midHandGame } from '../test/fixtures/game.js';

it('BUG-111: Watch keeps each saved hood through mood and seat changes',()=>{
  const game={...midHandGame,seats:[
    {...midHandGame.seats[0],identity:{hood:'oxblood',glow:'ice'}},
    {...midHandGame.seats[1],identity:{hood:'moss',glow:'violet'}},
  ]};
  const {container,rerender}=render(<WatchFelt game={game} mySeat={0}/>);
  expect(container.querySelector('.watch-hero [data-hood]')).toHaveAttribute('data-hood','oxblood');
  expect(container.querySelector('.seat-ghost [data-hood]')).toHaveAttribute('data-hood','moss');
  expect(container.querySelector('.watch-hero radialGradient stop')).toHaveAttribute('stop-color','#7FA8C9');
  expect(container.querySelector('.seat-ghost radialGradient stop')).toHaveAttribute('stop-color','#8B6BC4');
  rerender(<WatchFelt game={{...game,seats:game.seats.map(s=>({...s,mood:{state:'tilted',heat:90}}))}} mySeat={1}/>);
  expect(container.querySelector('.watch-hero [data-hood]')).toHaveAttribute('data-hood','moss');
  expect(container.querySelector('.seat-ghost [data-hood]')).toHaveAttribute('data-hood','oxblood');
  expect(container.querySelector('.watch-hero radialGradient stop')).toHaveAttribute('stop-color','#8B6BC4');
  expect(container.querySelector('.seat-ghost radialGradient stop')).toHaveAttribute('stop-color','#7FA8C9');
});
