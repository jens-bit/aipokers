import {render} from '@testing-library/react';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import {DeskTableStage} from './DeskTableStage.jsx';
import {GameTile} from './GameTile.jsx';
import {GhostChip} from '../floor/atoms.jsx';
import {midHandGame,betweenHandsGame} from '../../test/fixtures/game.js';

// Simulate the browser's Swedish default while retaining normal Intl behavior
// for callers that explicitly choose a locale. The browser suite also uses a
// real sv-SE context, without patching Number.prototype.
const nativeLocale=Number.prototype.toLocaleString;
beforeEach(()=>{
  vi.spyOn(Number.prototype,'toLocaleString').mockImplementation(function(locale,options){
    return nativeLocale.call(this,locale ?? 'sv-SE',options);
  });
});
afterEach(()=>vi.restoreAllMocks());
const game={...midHandGame,pot:12500,currentBet:12500,toAct:0,
  seats:midHandGame.seats.map(s=>({...s,stack:12500,committed:0}))};

it('BUG-37: desktop stage uses canonical separators for pot, both stacks and to-call on a Swedish device',()=>{
  expect((12500).toLocaleString()).toBe('12\u00a0500');
  const {container}=render(<DeskTableStage game={game} mySeat={0}/>);
  expect(container.querySelector('.dtb__pot-amt').textContent).toBe('$12,500');
  expect(container.querySelector('.dtb__hero-stack').textContent).toBe('$12,500');
  expect(container.querySelector('.dtb__hero-num').textContent).toBe('$12,500');
  expect(container.querySelector('.dtb__seat').textContent).toContain('$12,500');
});
it('BUG-37: standup game tile keeps its symbol-free stacks and pot canonical on a Swedish device',()=>{
  const {container}=render(<GameTile game={game} agentName="The Grinder"/>);
  expect(container.querySelector('.dsk-tile__pot b').textContent).toBe('12,500');
  expect(container.querySelector('.dsk-tile__stack').textContent).toBe('12,500');
  expect(container.querySelector('.dsk-tile__opp-name').textContent).toBe('Doyle_v3 · 12,500');
});
it('BUG-37: a single floor ghost keeps the full name and a canonical symbol-free stack',()=>{
  const {container}=render(<GhostChip name="Bluff Master General" state="live" stack={12500}/>);
  expect(container.querySelector('.floor-chip__name').textContent).toBe('Bluff Master General');
  expect(container.querySelector('.floor-chip__stack').textContent).toBe('12,500');
});
it('BUG-37: the stage retains unknown stack dashes and the existing null-pot fallback',()=>{
  const unknown={...game,pot:null,toAct:null,seats:game.seats.map(s=>({...s,stack:null}))};
  const {container,rerender}=render(<DeskTableStage game={unknown} mySeat={0}/>);
  expect(container.querySelector('.dtb__hero-stack').textContent).toBe('—');
  expect(container.querySelector('.dtb__seat').textContent).toContain('—');
  expect(container.querySelector('.dtb__pot-amt').textContent).toBe('$0');
  rerender(<DeskTableStage game={betweenHandsGame} mySeat={0}/>);
  expect(container.querySelector('.dtb__pot-amt')).toBeNull();
  expect(container.querySelector('.dtb__pot-dash').textContent).toBe('—');
});
it('BUG-37: game tile retains its existing empty snapshot fallback and waiting label',()=>{
  const {container}=render(<GameTile game={null}/>);
  expect(container.querySelector('.dsk-tile__pot b').textContent).toBe('0');
  expect(container.querySelector('.dsk-tile__stack').textContent).toBe('0');
  expect(container.querySelector('.dsk-tile__opp-name').textContent).toBe('Opponent · 0');
  expect(container.querySelector('.dsk-tile__meta')).toHaveTextContent('WAITING');
});
it('BUG-37: floor ghost still omits unknown/crowded stacks and shows a measured zero',()=>{
  const {container,rerender}=render(<GhostChip name="Bird" stack={null}/>);
  expect(container.querySelector('.floor-chip__stack')).toBeNull();
  rerender(<GhostChip name="Bird" stack={12500} chipMaxW={40}/>);
  expect(container.querySelector('.floor-chip__stack')).toBeNull();
  rerender(<GhostChip name="Bird" stack={0}/>);
  expect(container.querySelector('.floor-chip__stack').textContent).toBe('0');
});
