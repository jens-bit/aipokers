import {render,screen} from '@testing-library/react';
import {expect,it} from 'vitest';
import {BrandLoading} from './BrandLoading.jsx';
it('B12 announces loading with the chosen line and the 150px product mark',()=>{
  render(<BrandLoading/>);
  expect(screen.getByRole('status',{name:'Loading Railbird'})).toHaveAttribute('aria-busy','true');
  expect(screen.getByText('You don’t play. You raise a player.')).toBeInTheDocument();
  expect(screen.getByRole('img',{name:'Railbird'})).toHaveAttribute('width','150');
});
