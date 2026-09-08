import { zoomOut } from "./zoom-out.mjs";
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const pixelChecks=[];
const samePixels=(actual,expected,label)=>pixelChecks.push({label,equal:actual.equals(expected),actual:createHash('sha256').update(actual).digest('hex'),expected:createHash('sha256').update(expected).digest('hex')});
import { chromium } from 'playwright';
import { mkdir,writeFile } from 'node:fs/promises';
const out=process.env.GRASS_OUT??'/tmp/fly-exterior-production-evidence';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text()+' '+JSON.stringify(m.location()))});
 await page.addInitScript(()=>{const random=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=array=>array instanceof BigUint64Array&&array.length===1?(array[0]=42n,array):random(array)});
 await page.goto(process.env.GRASS_URL??'http://127.0.0.1:5312/');
 await page.waitForFunction(()=>document.querySelector('.run-setup')?.disabled===false,{timeout:90000});
 const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2');const ext=gl?.getExtension('WEBGL_debug_renderer_info');const renderer=ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null;return{renderer,timingsValid:!!renderer&&!/SwiftShader|Software/i.test(renderer)}});
 await page.mouse.move(1400,50);await page.waitForTimeout(200);
 await page.screenshot({path:`${out}/setup.png`});await page.locator('canvas').screenshot({path:`${out}/setup-canvas.png`});
 await page.getByRole('button',{name:'Release the flies'}).click();
 const read=async()=>JSON.parse(await page.getByTestId('playback-report').textContent());
 await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('[data-testid=playback-report]')?.textContent).computedTick>=40}catch{return false}},{timeout:90000});
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByTestId('playback-seek').fill('20');await page.getByTestId('playback-seek').dispatchEvent('input');
 await page.waitForTimeout(300);
 const frames=[];
 for(const state of ['follow','overview']){
  if(state==='overview')await zoomOut(page);
  await page.mouse.move(1400,50);await page.waitForTimeout(300);
  const canvas=page.locator('.playback-world canvas'); await page.screenshot({path:`${out}/${state}.png`});await canvas.screenshot({path:`${out}/${state}-canvas.png`});
  const pixels=await canvas.screenshot();await page.waitForTimeout(150);samePixels(await canvas.screenshot(),pixels,'paused world pixel identity');
  await page.getByTestId('playback-seek').fill('10');await page.getByTestId('playback-seek').dispatchEvent('input');await page.waitForTimeout(100);
  await page.getByTestId('playback-seek').fill('20');await page.getByTestId('playback-seek').dispatchEvent('input');await page.waitForTimeout(200);
  samePixels(await canvas.screenshot(),pixels,'reverse and restore pixel identity');
  const raf=await page.evaluate(async()=>{const values=[];let last=performance.now();for(let i=0;i<90;i++){await new Promise(requestAnimationFrame);let t=performance.now();if(i>10)values.push(t-last);last=t;}values.sort((a,b)=>a-b);return{median:values[Math.floor(values.length*.5)],p95:values[Math.floor(values.length*.95)]}});
  frames.push({state,report:await read(),raf});
 }
 const restoredPixels=await page.locator('.playback-world canvas').screenshot();
 const resizeResources=[];
 for(const [name,width,height] of [['wide',2560,900],['portrait',900,1000],['restored',1440,1000]]) {
  await page.setViewportSize({width,height});await zoomOut(page);await page.mouse.move(width-30,30);await page.waitForTimeout(300);
  await page.screenshot({path:`${out}/${name}.png`});await page.locator('.playback-world canvas').screenshot({path:`${out}/${name}-canvas.png`});
  resizeResources.push({name,report:await read()});
 }
 samePixels(await page.locator('.playback-world canvas').screenshot(),restoredPixels,'resize restores exact world pixels');
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.waitForFunction(()=>{try{return JSON.parse(document.querySelector('[data-testid=playback-report]')?.textContent).state==='ended'}catch{return false}},{timeout:90000});
 const final=await read();
 await writeFile(`${out}/report.json`,JSON.stringify({frames,resizeResources,errors,pixelChecks,gpu,final},null,2));
 assert.equal(final.complete,true);assert.equal(final.underruns,0);assert.ok(final.result);
 assert.deepEqual(errors,[]);assert.ok(pixelChecks.every(check=>check.equal),JSON.stringify(pixelChecks));assert.equal(frames[0].report.spec.flyCount,16);assert.equal(frames[0].report.spec.rootSeed,'42');
}finally{await browser.close()}
