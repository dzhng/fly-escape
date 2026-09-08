import {chromium} from 'playwright';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.OUT;await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>array instanceof BigUint64Array?(array.fill(42n),array):original(array);});
 await page.goto(process.env.URL);
 await page.getByRole('button',{name:'Run · release flies'}).click();
 await page.getByTestId('playback-report').waitFor({state:'attached'});
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.waitForFunction(()=>{const r=JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent);return r.computedTick>46&&r.renderer?.modelKind==='glb';},null,{timeout:120000});
 const report=async()=>JSON.parse(await page.getByTestId('playback-report').textContent());
 const initial=await report();const id=initial.initialBodies.findIndex(b=>b.mode==='walking');assert.ok(id>=0);assert.equal(initial.spec.flyCount,20);
 const rows=[];
 for(const tick of [0.5,3.5,8.5,44.5]) {
  await page.getByTestId('playback-seek').fill(String(tick));
  await page.getByTestId('playback-seek').dispatchEvent('input');
  await page.waitForFunction(t=>JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).cursorTick===t,tick);
  for(const view of ['close','overview']) {
   await page.getByRole('button',{name:`Select fly ${id+1}`,exact:true}).click();
   if(view==='overview')await page.getByRole('button',{name:'Overview',exact:true}).click();
   await page.waitForTimeout(150);
   rows.push({tick,view,...await report()});await page.screenshot({path:`${out}/${view}-${tick}.png`});
   const expected=await page.locator('canvas').screenshot();
   for(const target of [tick+1,tick]) {
    await page.getByTestId('playback-seek').fill(String(target));
    await page.waitForFunction(t=>JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).cursorTick===t,target);
   }
   assert.deepEqual(await page.locator('canvas').screenshot(),expected,'recorded height and trails restore exact canvas bytes after reverse seek');

  }
 }
 assert.deepEqual(errors,[]);await writeFile(`${out}/report.json`,JSON.stringify({rows,errors},null,2));
} finally {await browser.close();}
