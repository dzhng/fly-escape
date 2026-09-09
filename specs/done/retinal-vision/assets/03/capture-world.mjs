import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {fileURLToPath} from 'node:url';
const output=fileURLToPath(new URL('.',import.meta.url));
const [reference,candidate]=process.argv.slice(2);
if(!reference||!candidate)throw new Error('Usage: node capture-world.mjs reference-url candidate-url');
await Promise.all(['reference','candidate'].map(name=>mkdir(`${output}/world-${name}`,{recursive:true})));
const browser=await chromium.launch({channel:'chrome',headless:true});
const reports=[];
try {
 for(const [variant,base] of [['reference',reference],['candidate',candidate]]) {
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  await context.addInitScript(()=>{
   Object.defineProperty(performance,'now',{value:()=>12345});
   localStorage.setItem('fly-escape-progress',JSON.stringify({bestStars:{'open-window':1},setups:{}}));
  });
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base);
  const ready=()=>page.waitForFunction(()=>document.querySelector('.run-setup')?.disabled===false,null,{timeout:60000});
  const paint=()=>page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await ready();
  await page.evaluate(()=>document.fonts.ready);
  for(const [slug,title] of [['open-window','Open Window'],['turn-the-corner','Turn the Corner']]) {
   await page.locator('.campaign-levels button').filter({hasText:title}).click();await ready();
   await page.mouse.move(30,30);await paint();
   await page.screenshot({path:`${output}/world-${variant}/${slug}.png`});
   await page.mouse.move(450,450);await page.mouse.down({button:'right'});
   await page.mouse.move(570,480,{steps:8});await page.mouse.up({button:'right'});
   await page.mouse.move(30,30);await paint();
   await page.screenshot({path:`${output}/world-${variant}/${slug}-orbit.png`});
  }
  const canvas=await page.locator('.setup-canvas canvas').first().boundingBox();
  reports.push({variant,viewport:{width:1440,height:1000},deviceScaleFactor:1,performanceNow:12345,canvas,errors});
  assert.deepEqual(errors,[]);
  await context.close();
 }
}finally{await browser.close();}
await writeFile(`${output}/world-browser-check.json`,JSON.stringify({browser:'Chrome headless',captures:reports},null,2)+'\n');
console.log(JSON.stringify(reports));
