import test from 'node:test';
import assert from 'node:assert/strict';
import {homeTablePreview} from './homePreview.js';
test('BUG-244: a null actor explicitly clears a previous turn in a Home preview',()=>{
  assert.deepEqual(homeTablePreview({tableId:'t',toAct:null}),{tableId:'t',toAct:null});
});
test('BUG-168: invalid tables and nonpublic nested fields do not enter the shared Home picture',()=>{
  assert.equal(homeTablePreview(null),null);assert.equal(homeTablePreview({tableId:4}),null);
  assert.deepEqual(homeTablePreview({tableId:'t',board:['Ah','secret'],heroHole:['As','Ad'],pot:NaN,seats:[{displayName:'Bird',holeCards:['As','Ad'],history:'nemesis'}]}),{tableId:'t',board:['Ah'],seats:[{displayName:'Bird'}]});
});

// UI-3 job B (BUG-229): `toAct` and each seat's `stack` are neither of them
// private — whose turn it is and what a man is playing with are both things
// anyone standing at the felt can see — but they were missing from this
// allowlist, so `mergeHomeAgent` (client/src/hooks/useHomeState.js) replaced
// a fuller REST seat list with this trimmed one wholesale the moment any
// HOME_STATE push landed, and the desk's other monitors (GameTile) read a
// stack of 0 and "nobody's turn" for a table that was genuinely live.
test('BUG-229: toAct and each seat\'s stack are public and now ride the preview, private fields still do not',()=>{
  const view=homeTablePreview({
    tableId:'t',toAct:1,pot:340,heroSeat:0,
    seats:[
      {displayName:'Milo',stack:1500,holeCards:['Qs','Kh'],reasoning:'private read'},
      {displayName:'Nightjar',stack:900},
    ],
  });
  assert.equal(view.toAct,1);
  assert.deepEqual(view.seats,[{displayName:'Milo',stack:1500},{displayName:'Nightjar',stack:900}]);
  const text=JSON.stringify(view);
  for(const privateValue of ['Qs','Kh','private read']) assert.equal(text.includes(privateValue),false,privateValue);
});

test('BUG-229: a non-finite toAct or stack is dropped rather than coerced',()=>{
  const view=homeTablePreview({tableId:'t',toAct:NaN,seats:[{displayName:'Bird',stack:'lots'}]});
  assert.equal('toAct' in view,false);
  assert.deepEqual(view.seats,[{displayName:'Bird'}]);
});

test('Home television retains removable seat clothes but never inventory, hidden cards or arbitrary equipment fields',()=>{
  const view=homeTablePreview({tableId:'dressed-table',seats:[
    {seat:0,equipment:{head:'rail-cap',face:'round-glasses',neck:null,privateNote:'PRIVATE CLOTHES'},wardrobe:{owned:['PRIVATE INVENTORY']},holeCards:['As','Ad']},
    {seat:1,equipment:{head:'knit-scarf',face:'unknown',neck:'knit-scarf',strategy:'PRIVATE STRATEGY'}},
  ]});
  assert.deepEqual(view.seats,[
    {seat:0,equipment:{head:'rail-cap',face:'round-glasses',neck:null}},
    {seat:1,equipment:{head:null,face:null,neck:'knit-scarf'}},
  ]);
  assert.equal(JSON.stringify(view).includes('PRIVATE'),false);
  assert.equal(JSON.stringify(view).includes('As'),false);
  // Both server projection and client merge can normalize this same frame.
  assert.deepEqual(homeTablePreview(view),view);
});
