import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const out=process.env.WEB_SHOTS;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.WEB_URL ?? 'http://127.0.0.1:5334');
 await page.waitForFunction(()=>document.querySelector('[data-testid="setup-game"]')?.dataset.worldState==='ready' && document.querySelector('.run-setup')?.disabled===false);
 await page.mouse.move(1200,120);await page.screenshot({path:out+'/whole.png'});
 await page.mouse.move(370,720);await page.mouse.down();await page.mouse.move(550,520,{steps:10});await page.mouse.up();
 for(const [name,zoom] of [['close',-480],['extra',-600]]){
  await page.mouse.move(550,500);await page.mouse.wheel(0,zoom);await page.mouse.move(1200,120);await page.waitForTimeout(350);await page.screenshot({path:out+'/'+name+'.png'});
 }
 await writeFile(out+'/report.json',JSON.stringify({errors},null,2));
 if(errors.length)throw Error(errors.join('\n'));
} finally {await browser.close();}
