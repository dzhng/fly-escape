import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out=process.env.GRASS_OUT ?? '/tmp/fly-exterior-lab-evidence';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 await page.goto((process.env.GRASS_URL??'http://127.0.0.1:5298')+'/?fixture=proportions');
 await page.waitForFunction(()=>document.querySelector('#app').dataset.ready==='true'&&document.querySelector('#shape').closest('section').dataset.ready==='true',{timeout:90000});
 const frames=[];
 for(const state of ['overview','context','follow']) {
  await page.locator(`[data-view=${state}]`).click(); await page.waitForTimeout(250);
  await page.screenshot({path:`${out}/${state}.png`});
  await page.locator('canvas').screenshot({path:`${out}/${state}-canvas.png`});
  frames.push({state,measurements:JSON.parse(await page.locator('#app').getAttribute('data-measurements'))});
 }
 await page.locator('[data-view=follow]').click();
 const canvas=page.locator('canvas'), box=await canvas.boundingBox();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5); await page.mouse.wheel(0,100000); await page.waitForTimeout(100); await page.mouse.down();
 await page.mouse.move(box.x+box.width*.5-5000,box.y+box.height*.5-5000); await page.mouse.up();
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5); await page.mouse.wheel(0,100000); await page.mouse.move(1400,50);
 for(const state of ['edge-wide','edge-close']) {
  if(state==='edge-close'){await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.wheel(0,-1700);await page.mouse.move(1400,50);}
  await page.waitForTimeout(250); await page.screenshot({path:`${out}/${state}.png`});await canvas.screenshot({path:`${out}/${state}-canvas.png`});
  frames.push({state,measurements:JSON.parse(await page.locator('#app').getAttribute('data-measurements'))});
 }
 await writeFile(`${out}/report.json`,JSON.stringify({frames,errors},null,2));
 if(errors.length)throw Error(errors.join('\n'));
} finally {await browser.close()}
