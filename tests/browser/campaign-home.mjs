import { chromium } from 'playwright';
import assert from 'node:assert/strict';
const browser = await chromium.launch({channel:'chrome',headless:true});
try {
 const page = await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const ready=()=>page.waitForFunction(()=>document.querySelector('[data-testid="setup-game"]')?.dataset.worldState==='ready',null,{timeout:60000});
 await page.goto((process.env.BRAIN_URL ?? 'http://127.0.0.1:5215') + '/');await ready();
 const second=page.getByRole('button',{name:/2. Turn the Corner/});assert.equal(await second.isDisabled(),true);
 for(let i=0;i<2;i++) {
  if(i===1) {
   await page.evaluate(()=>{const p=JSON.parse(localStorage.getItem('fly-escape-progress'));p.bestStars['open-window']=1;localStorage.setItem('fly-escape-progress',JSON.stringify(p));});
   await page.reload();await ready();await page.getByRole('button',{name:/2. Turn the Corner/}).click();await ready();
  }
  console.log('SETUP',i,await page.getByRole('heading',{level:1}).innerText());
  await page.getByRole('button',{name:'Release the flies'}).click();
  await page.waitForFunction(()=>{const e=document.querySelector('[data-testid="playback-lab"]');return e?.dataset.playbackState==='error'||Number(e?.dataset.computedTick)>=10},null,{timeout:90000});
  await page.waitForFunction(()=>Number(document.querySelector('[data-testid="playback-lab"]')?.dataset.cursorTick)>1,null,{timeout:60000});
  const state=await page.getByTestId('playback-lab').evaluate(e=>({...e.dataset}));console.log('ATTEMPT',i,state);
  assert.notEqual(state.playbackState,'error',await page.locator('body').innerText());
  await page.waitForFunction(()=>document.querySelector('[data-testid="playback-report"]')?.textContent.length>10);
  const report=JSON.parse(await page.getByTestId('playback-report').textContent());assert.equal(report.initialBodies.filter(b=>b.mode==='flying').length,10);assert.equal(report.initialBodies.filter(b=>b.mode==='walking').length,10);
  assert.equal(await page.getByRole('button',{name:'Overview',exact:true}).count(),0);
  await page.getByRole('button',{name:/Cancel attempt|Retry — edit setup/}).click();await ready();
 }
 assert.deepEqual(errors,[]);console.log('PASS: both actual levels resolve, release mixed20-fly swarm,produce replay,and return to setup; stored one-star fixture unlocks second.');
} finally {await browser.close();}
