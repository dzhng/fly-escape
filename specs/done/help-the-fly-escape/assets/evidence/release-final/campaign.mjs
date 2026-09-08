import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire('/Users/david/dev/fly-escape/package.json')('playwright');
const out='/tmp/fly-final-campaign'; await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true});
const p=await b.newPage({viewport:{width:1440,height:1000}});
const errors=[], external=[],failed=[]; p.on('pageerror',e=>errors.push(e.message));
p.on('request',r=>{if(/^https?:/.test(r.url())&&!r.url().startsWith('http://127.0.0.1:5322/'))external.push(r.url());});
p.on('response',r=>{if(r.status()>=400)failed.push([r.status(),r.url()]);});
await p.addInitScript(()=>{const original=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>{if(a instanceof BigUint64Array&&a.length===1){a[0]=15789670027162723101n;return a;}return original(a);};});
const report=async()=>JSON.parse(await p.getByTestId('playback-report').textContent());
const ready=()=>p.waitForFunction(()=>document.querySelector('[data-testid="setup-game"]')?.dataset.worldState==='ready',null,{timeout:90000});
try {
 await p.goto('http://127.0.0.1:5322/');await ready();
 assert(await p.getByRole('button',{name:/2. Turn the Corner/}).isDisabled());
 for(let i=0;i<2;i++){
  if(i){await p.getByRole('button',{name:/2. Turn the Corner/}).click();await ready();}
  await p.screenshot({path:`${out}/level-${i+1}-setup.png`});
  await p.getByRole('button',{name:'Release the flies',exact:true}).click();
  await p.waitForFunction(()=>{const e=document.querySelector('[data-testid="playback-report"]');return e&&['playing','error','ended'].includes(JSON.parse(e.textContent).state);},null,{timeout:360000});
  assert.notEqual((await report()).state,'error');
  await p.getByRole('button',{name:'Pause',exact:true}).click();
  await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).state==='paused');
  const cursor=(await report()).cursorTick;await p.waitForTimeout(200);assert.equal((await report()).cursorTick,cursor);
  await p.getByRole('button',{name:'Select fly 2',exact:true}).click();
  await p.waitForFunction(()=>document.querySelector('[data-testid="selected-fly"]')?.dataset.flyId==='1');
  await p.getByRole('button',{name:'Real time',exact:true}).click();await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Real time'&&b.getAttribute('aria-pressed')==='true'));
  await p.getByRole('button',{name:'Fast',exact:true}).click();
  const box=await p.locator('.playback-world canvas').first().boundingBox();
  await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down({button:'right'});await p.mouse.move(box.x+box.width/2+80,box.y+box.height/2+20,{steps:6});await p.mouse.up({button:'right'});
  await p.getByTestId('reset-rotation').click();await p.mouse.wheel(0,-180);await p.mouse.move(1400,40);
  await p.screenshot({path:`${out}/level-${i+1}-selected.png`});
  await p.getByRole('button',{name:'Play',exact:true}).click();
  await p.waitForFunction(()=>{const e=document.querySelector('[data-testid="playback-report"]');return e&&['ended','error'].includes(JSON.parse(e.textContent).state);},null,{timeout:180000});
  const r=await report();assert.equal(r.state,'ended');assert.equal(r.spec.flyCount,20);assert(r.result);
  if(!i)assert(r.result.stars>=1,'first level must earn actual unlock');
  await writeFile(`${out}/level-${i+1}.json`,JSON.stringify(r,null,2));await p.screenshot({path:`${out}/level-${i+1}-result.png`});
  console.log('LEVEL',i+1,r.result.outcomes,'underruns',r.underruns);
  await p.getByRole('button',{name:'Replay',exact:true}).click();await p.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid="playback-report"]').textContent).cursorTick<1000);
  await p.getByRole('button',{name:'Retry — edit setup',exact:true}).click();await ready();
  if(!i)assert.equal(await p.getByRole('button',{name:/2. Turn the Corner/}).isDisabled(),false);
 }
 const saved=await p.evaluate(()=>JSON.parse(localStorage.getItem('fly-escape-progress')));await p.reload();await ready();assert.equal(await p.getByRole('button',{name:/2. Turn the Corner/}).isDisabled(),false);
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.deepEqual(failed,[]);
 await writeFile(out+'/checks.json',JSON.stringify({complete:true,errors,external,failed,saved,checks:['fresh progress','actual earned unlock','two completed levels','pause','selection','two speeds','rotate/reset/zoom','replay','retry','reload persistence','static-only requests']},null,2));
 console.log('PASS static production campaign');
} catch(e){await writeFile(out+'/failure.txt',String(e)+'\n'+await p.locator('body').innerText());throw e;}finally{await b.close();}
