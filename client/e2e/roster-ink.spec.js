import {expect,test} from '@playwright/test';

const agents=[
  {id:'rock',name:'Granite',identity:{hood:'ash',glow:'ice'},nature:{name:'Rock'},location:{where:'home'},routine:{key:'reads',label:'reading'},pocket:{balance:2000},sessionLog:[]},
  {id:'hot',name:'Wild Card',identity:{hood:'wine',glow:'ember'},nature:{name:'Hothead'},location:{where:'table',room:'floor',tableId:'casino-1'},activeTableId:'casino-1',liveGame:{tableId:'casino-1',net:95,blinds:'10/20'},pocket:{balance:1000}},
];
async function openRoster(page){
  await page.addInitScript(()=>localStorage.setItem('agentic_uid','4242'));
  await page.route('**/api/**',route=>{
    const pathname=new URL(route.request().url()).pathname;
    const body=pathname==='/api/agents'?{agents}:pathname==='/api/wallet'?{wallet:{balance:54000}}:pathname==='/api/rooms'?{rooms:[]}:{};
    return route.fulfill({json:body});
  });
  await page.goto('/');
  await page.getByRole('button',{name:'Your agents',exact:true}).click();
  await expect(page.locator('.roster__row')).toHaveCount(2);
  await page.evaluate(()=>document.fonts.ready);
}
test.describe('BUG-171: C5 readable muted roster text',()=>{
  test.use({viewport:{width:390,height:844}});
  for(const [label,selector] of [['whereabouts','.roster__where'],['count','.roster__count'],['unknown result','.roster__result:not(.is-up):not(.is-down)']]){
    test(`${label} uses the current C5 M_MUTED text color`,async({page})=>{
      await openRoster(page);
      for(const node of await page.locator(selector).all()) await expect(node).toHaveCSS('color','rgb(158, 158, 162)');
    });
  }
  test('keeps factual money, status colors and navigation intact',async({page})=>{
    await openRoster(page);
    const sheet=page.getByRole('dialog',{name:'Your agents'});
    await expect(sheet).toContainText('2 agents · 1 live');
    await expect(sheet).toContainText('+$95');
    await expect(sheet).toContainText('$2,000');
    await expect(sheet.locator('.roster__result.is-up')).toHaveCSS('color','rgb(0, 212, 170)');
    for(const row of await sheet.locator('.roster__row').all()){
      const box=await row.boundingBox();expect(box.height).toBeGreaterThanOrEqual(44);expect(box.height).toBeLessThanOrEqual(64);
    }
    await sheet.getByRole('button',{name:'Close',exact:true}).last().click();
    await expect(sheet).toBeHidden();
    await page.getByRole('button',{name:'Your agents',exact:true}).click();
    await page.getByRole('button',{name:'Granite — home · reading. Open his thread.',exact:true}).click();
    await expect(page.getByRole('region',{name:"Granite's room",exact:true})).toBeVisible();
  });
});
