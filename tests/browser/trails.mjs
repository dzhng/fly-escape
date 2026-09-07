import { zoomOut } from "./zoom-out.mjs";
import { equalPixels } from "./equal-pixels.mjs";
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
const output=process.env.TRAILS_EVIDENCE ?? 'specs/help-the-fly-escape/assets/evidence/09/browser/candidate';
const ticks=(process.env.TRAILS_TICKS ?? '10.3,30.5,60.5,100.5').split(',').map(Number);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
  const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  // Fix only the setup's seed source; the actual worker owns all neural movement.
  await page.addInitScript(()=>{
    const random=crypto.getRandomValues.bind(crypto);
    crypto.getRandomValues=array=>array instanceof BigUint64Array && array.length===1 ? (array[0]=42n,array) : random(array);
  });
  await page.goto(`${process.env.BRAIN_URL ?? 'http://127.0.0.1:5208'}/`);
  await page.getByRole('button',{name:'Run · release flies',exact:true}).click();
  await page.waitForFunction(target=>Number(document.querySelector('[data-testid="playback-lab"]')?.dataset.computedTick)>=target,Math.ceil(Math.max(...ticks))+1,{timeout:120000});
  await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).renderer?.modelKind==='glb');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  const report=async()=>JSON.parse(await page.getByTestId('playback-report').textContent());
  assert.equal((await report()).spec.flyCount,20);
  assert.equal((await report()).spec.rootSeed,'42');
  const settle=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const seek=async tick=>{
    await page.getByLabel('Playback time',{exact:true}).evaluate((el,tick)=>{
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,String(tick));
      el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));
    },tick);
    await page.waitForFunction(tick=>JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).cursorTick===tick,tick);
    await settle();
  };
  const canvas=page.locator('.playback-world canvas');
  const box=await canvas.boundingBox();
  const captures=[];
  for(const tick of ticks) {
    await seek(tick);
    for(const view of ['close','overview']){
      if(view==='close'){
        await page.getByRole('button',{name:'Select fly 1',exact:true}).click();
        await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
        await page.mouse.wheel(0,-100000);
        await page.waitForFunction(()=>{const c=JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).camera;return c.distance===c.minDistance});
      }else{
        await zoomOut(page);
        await page.waitForFunction(()=>!JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).camera.following);
      }
      await page.mouse.move(1430,20);await settle();
      const name=`${view}-${tick}`;
      const expected=await canvas.screenshot();
      await page.waitForTimeout(150);
      equalPixels(await canvas.screenshot(),expected,`${name} pause`);
      await seek(tick+1);await seek(tick);
      equalPixels(await canvas.screenshot(),expected,`${name} reverse`);
      await page.screenshot({path:`${output}/${name}.png`});
      const current=await report();
      captures.push({name,cursor:current.cursorTick,camera:current.camera,renderer:current.renderer});
    }
  }
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({route:'/',seedPolicy:'setup seed source fixed42; unchanged actual neural worker',spec:(await report()).spec,viewport:[1440,900],devicePixelRatio:1,canvasBounds:box,pauseReverse:'exact canvas bytes for each state',captures,errors},null,2));
}finally{await browser.close()}
