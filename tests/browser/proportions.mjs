import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const out=process.env.PROPORTION_EVIDENCE ?? '/tmp/fly-proportions-before';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 page.on('console',m=>{if(m.type()==='error') console.log(m.text())});
 await page.goto((process.env.PROPORTION_URL ?? 'http://127.0.0.1:5286')+'/?fixture=proportions');
 await page.waitForFunction(()=>document.querySelector('#app')?.dataset.ready==='true'||document.querySelector('#app')?.dataset.error,{timeout:90000});
 assert.equal(await page.locator('#app').getAttribute('data-error'),null);
 const measurements=[];
 for(const mode of ['context','follow','close','overview']) {
  await page.locator(`[data-view="${mode}"]`).click();
  await page.waitForTimeout(100);
  measurements.push({mode,...JSON.parse(await page.locator('#app').getAttribute('data-measurements'))});
  await page.screenshot({path:`${out}/${mode}.png`});
  const bounds=await page.locator('canvas').boundingBox();
  await page.screenshot({path:`${out}/${mode}-crop.png`,clip:{x:bounds.x+bounds.width/2-160,y:bounds.y+bounds.height/2-160,width:320,height:320}});
 }
 await page.locator('#subject').selectOption('0');
 for (const mode of ['context','follow','close']) {
  await page.locator(`[data-view="${mode}"]`).click(); await page.waitForTimeout(100);
  measurements.push({mode:`fruit-adjacent-${mode}`,...JSON.parse(await page.locator('#app').getAttribute('data-measurements'))});
  await page.screenshot({path:`${out}/fruit-adjacent-${mode}.png`});
 }
 await page.locator('#subject').selectOption('5');
 await page.locator('#recorded-tick').fill('40');await page.locator('#recorded-tick').dispatchEvent('input');
 await page.locator('[data-view="context"]').click();await page.waitForTimeout(100);
 const replay=JSON.parse(await page.locator('#app').getAttribute('data-measurements'));
 assert.equal(replay.recordedFrame.flies.length,20);assert.ok(replay.recordedFrame.neuralSteps>0);
 await page.screenshot({path:`${out}/recorded.png`});
 const initial=measurements[0];
 assert.ok(Math.abs(initial.nativeBodyLength-0.003)<1e-8);
 assert.equal(initial.modelScale,1);
 assert.equal(initial.coreBodyRadius,0.002632);
 assert.equal(initial.renderedAntennae.length,2);
 const actual=initial.renderedAntennae.map(([x,y,z])=>({x,z})).sort((a,b)=>a.z-b.z);
 const sampled=[...initial.initialSensoryPoints[0]].sort((a,b)=>a.z-b.z);
 for(let i=0;i<2;i++) assert.ok(Math.hypot(actual[i].x-sampled[i].x,actual[i].z-sampled[i].z)<1e-8,
   "core sampling points agree with rendered antenna centres at tick zero");
 assert.deepEqual(errors,[]);
 await writeFile(`${out}/report.json`,JSON.stringify({measurements,replay,errors},null,2));
}finally{await browser.close()}
