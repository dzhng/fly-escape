import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const out='specs/help-the-fly-escape/assets/evidence/08/authored-motion';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.goto(process.env.ASSET_LAB_URL ?? 'http://127.0.0.1:5192');
await page.getByRole('status').filter({hasText:'Model loaded'}).waitFor();
await page.getByRole('button',{name:'Extra close'}).click();
for(const clip of ['Static','Walk','Fly','Land','Feed']) {
 await page.locator('#clip').selectOption(clip);
 for(const seconds of [0,.125,.25,.375,.5,.625,.75]) {
  await page.locator('#time').evaluate((e,t)=>{e.value=String(t);e.dispatchEvent(new Event('input',{bubbles:true}));},seconds);
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  await page.screenshot({path:`${out}/sequence-${clip}-${seconds}.png`});
 }
}
await browser.close();
