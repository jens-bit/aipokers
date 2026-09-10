import test from 'node:test';
import assert from 'node:assert/strict';
import {homeTablePreview} from './homePreview.js';
test('BUG-168: invalid tables and nonpublic nested fields do not enter the shared Home picture',()=>{
  assert.equal(homeTablePreview(null),null);assert.equal(homeTablePreview({tableId:4}),null);
  assert.deepEqual(homeTablePreview({tableId:'t',board:['Ah','secret'],heroHole:['As','Ad'],pot:NaN,seats:[{displayName:'Bird',holeCards:['As','Ad'],history:'nemesis'}]}),{tableId:'t',board:['Ah'],seats:[{displayName:'Bird'}]});
});
