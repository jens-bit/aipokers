import {act,render,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
import {RailMotion} from './RailMotion.jsx';
afterEach(()=>vi.useRealTimers());
it('BUG-126: new activity moves only the head and reveals its badge after 440ms',()=>{
 vi.useFakeTimers();const {rerender,container}=render(<RailMotion news={[]}/>);
 expect(container.querySelector('[data-motion="peek"]')).not.toBeNull();
 act(()=>vi.advanceTimersByTime(519));expect(container.querySelector('[data-motion="peek"]')).not.toBeNull();
 act(()=>vi.advanceTimersByTime(1));expect(container.querySelector('[data-motion="peek"]')).toBeNull();
 rerender(<RailMotion news={['a:recap:1']}/>);
 expect(container.querySelector('[data-motion="look"]')).not.toBeNull();
 expect(container.querySelector('.rail-motion__rail')?.closest('[data-motion]')).toBeNull();
 expect(container.querySelector('.rail-motion__badge')).toBeNull();
 act(()=>vi.advanceTimersByTime(439));expect(container.querySelector('.rail-motion__badge')).toBeNull();
 act(()=>vi.advanceTimersByTime(1));expect(container.querySelector('.rail-motion__badge')).not.toBeNull();
 rerender(<RailMotion news={['a:recap:1']}/>);expect(container.querySelector('[data-motion="look"]')).toBeNull();
 rerender(<RailMotion news={[]}/>);expect(container.querySelector('.rail-motion__badge')).toBeNull();
});
it('BUG-126: existing initial activity is a badge, not a fresh notification',()=>{
 const {container}=render(<RailMotion news={['old']}/>);
 expect(container.querySelector('[data-motion="look"]')).toBeNull();
 expect(container.querySelector('.rail-motion__badge')).not.toBeNull();
 expect(screen.getByRole('img',{name:'Railbird'})).toBeInTheDocument();
});
