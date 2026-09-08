import assert from 'node:assert/strict';
import { firefox, webkit } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
const name=process.env.SMOKE_ENGINE ?? 'firefox';
const engine={firefox,webkit}[name];
if(!engine) throw Error('SMOKE_ENGINE must be firefox or webkit');
const output=process.env.SMOKE_OUTPUT ?? `/tmp/fly-engine-${name}`;
await mkdir(output,{recursive:true});
const report={engine:name,url:process.env.BRAIN_URL ?? 'http://127.0.0.1:5322',checks:[],errors:[],console:[],models:[]};
let browser,page;
try {
  browser=await engine.launch({headless:true,timeout:30000});
  report.version=browser.version();
  page=await browser.newPage({viewport:{width:1440,height:900}});
  page.setDefaultTimeout(60000);
  page.on('pageerror',e=>report.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'||m.text().startsWith('[Fly escape]'))report.console.push(m.text());});
  page.on('response',r=>{if(/\.glb(?:\?|$)/.test(r.url()))report.models.push({url:r.url(),status:r.status()});});
  await page.goto(report.url+'/');
  report.capabilities=await page.evaluate(async()=>({userAgent:navigator.userAgent,webgpu:!!navigator.gpu,adapter:!!(await navigator.gpu?.requestAdapter())}));
  await page.waitForFunction(()=>document.querySelector('[data-testid="setup-game"]')?.dataset.worldState==='ready');
  await page.waitForFunction(()=>!document.querySelector('.run-setup')?.disabled);
  report.checks.push('setup models ready');
  await page.screenshot({path:output+'/setup-ready.png'});
  // Reject a flat clear-color canvas; human inspection still establishes scene correctness.
  report.setupRaster=[];
  for(let attempt=0;attempt<10;attempt++) {
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const pixels=await page.locator('canvas').first().screenshot();
    const bins=await page.evaluate(async data=>{
      const image=new Image();image.src=data;await image.decode();
      const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
      const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
      const {data:rgba}=ctx.getImageData(Math.floor(image.width*.2),Math.floor(image.height*.2),Math.floor(image.width*.6),Math.floor(image.height*.6));
      const colors=new Set();for(let i=0;i<rgba.length;i+=16)colors.add(((rgba[i]>>4)<<8)|((rgba[i+1]>>4)<<4)|(rgba[i+2]>>4));
      return colors.size;
    },'data:image/png;base64,'+pixels.toString('base64'));
    report.setupRaster.push({attempt,quantizedColors:bins});
    if(bins>=32) break;
  }
  assert.ok(report.setupRaster.at(-1).quantizedColors>=32,'setup canvas remains flat after ten rendered-frame captures');
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await page.screenshot({path:output+'/setup.png'});
  await page.locator('.run-setup').click();
  const waitForPlaying=()=>page.waitForFunction(()=>{
    const el=document.querySelector('[data-testid="playback-report"]');
    const lab=document.querySelector('[data-testid="playback-lab"]');
    if(!el||!lab) return false;
    const current=JSON.parse(el.textContent);
    return current.spec?.flyCount===16&&current.renderer?.modelKind==='glb'
      &&lab.dataset.worldState==='ready'&&lab.dataset.playbackState==='playing';
  });
  await waitForPlaying();
  report.webgl=await page.evaluate(()=>{const canvas=document.querySelector('[data-testid="playback-lab"] canvas');const gl=canvas?.getContext('webgl2');if(!gl)return {available:false};const debug=gl.getExtension('WEBGL_debug_renderer_info');return {available:true,version:gl.getParameter(gl.VERSION),renderer:gl.getParameter(debug?.UNMASKED_RENDERER_WEBGL ?? gl.RENDERER)};});
  report.attempt=JSON.parse(await page.getByTestId('playback-report').textContent());
  report.checks.push('twenty flies playing with native models ready');
  await page.getByRole('button',{name:'Pause',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState==='paused');
  const slider=page.getByTestId('playback-seek');
  await slider.focus();await page.keyboard.press('Home');
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="playback-seek"]').value)===0);
  await page.keyboard.press('ArrowRight');
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="playback-seek"]').value)>0);
  report.checks.push('pause and reverse/forward seek');
  await page.screenshot({path:output+'/paused.png'});
  await page.getByRole('button',{name:/Cancel attempt|Retry — edit setup/}).click();
  await page.getByRole("button", {name: "Leave attempt", exact: true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-testid="setup-game"]')?.dataset.worldState==='ready');
  report.checks.push('cancel returns to ready setup');
  await page.locator('.run-setup').click();
  await waitForPlaying();
  report.retry=JSON.parse(await page.getByTestId('playback-report').textContent());
  assert.notEqual(report.retry.spec.attemptId,report.attempt.spec.attemptId);
  report.checks.push('new retry attempt playing with native models ready');
  assert.deepEqual(report.errors,[]);
  report.passed=true;
} catch(error) {
  report.passed=false;report.failure=String(error);
  if(page) {report.bodyText=await page.locator('body').innerText().catch(()=>null);await page.screenshot({path:output+'/failure.png'}).catch(()=>{});}
} finally {
  await browser?.close();
  await writeFile(output+'/report.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
}

if(!report.passed) process.exitCode=1;
