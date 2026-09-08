import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const base = process.env.BRAIN_URL ?? 'http://127.0.0.1:5173';
const output = process.env.SETUP_EVIDENCE ?? '/tmp/fly-setup-hover';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({channel: process.env.BROWSER_CHANNEL ?? 'chrome', headless: true});
try {
  const page = await browser.newPage({viewport:{width:1440,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error' && /THREE|shader|WebGL/i.test(m.text()))errors.push(m.text());});
  await page.addInitScript(()=>{
    const NativeWorker=window.Worker;
    window.holdSetupReplies=false;window.heldSetupReplies=[];
    window.Worker=class extends NativeWorker {
      set onmessage(receive) {
        super.onmessage=event=>{
          const deliver=()=>receive.call(this,event);
          if(window.holdSetupReplies&&event.data.type==='setup')window.heldSetupReplies.push(deliver);
          else deliver();
        };
      }
    };
  });
  await page.goto(base);
  const run=page.getByRole('button',{name:'Release the flies',exact:true});
  await page.waitForFunction(()=>document.querySelector('.run-setup')?.disabled===false);
  assert.equal(await page.getByRole('button',{name:'Put objects away',exact:true}).count(),0);
  assert.equal(await page.getByText('Already in this house',{exact:true}).count(),0);
  await page.getByRole('heading',{name:'Help the flies escape'}).waitFor();
  await page.screenshot({path:output+'/setup.png'});
  await page.evaluate(()=>window.holdSetupReplies=true);
  await page.mouse.move(700,500);
  await page.waitForFunction(()=>window.heldSetupReplies.length>0);
  assert.equal(await run.isDisabled(),false,'Hover validation must not disable Release');
  for(let i=0;i<30;i++)await page.mouse.move(650+i*3,500+i%5);
  assert.equal(await run.isDisabled(),false,'Continuous movement must leave Release enabled');
  assert.equal(await page.getByTestId('placement-feedback').count(),0);
  await page.evaluate(()=>{window.holdSetupReplies=false;for(const f of window.heldSetupReplies.splice(0))f();});
  await page.waitForFunction(()=>['true','false'].includes(document.querySelector('.setup-canvas')?.dataset.placementValid));
  const canvas=page.locator('.setup-canvas > canvas');
  const box=await canvas.boundingBox();assert.deepEqual(box,{x:0,y:0,width:1440,height:900});
  assert.equal(await page.locator('.campaign-shell header').count(),0);
  assert.equal(await page.locator('.campaign-levels svg').count(),6);
  // Find a legal point through the real native validator, independent of camera framing.
  let point;
  for(const y of [450,550,650,350]){
    for(const x of [650,750,550,850,450]){
      await page.mouse.move(x,y);
      await page.waitForTimeout(100);
      if(await page.locator('.setup-canvas').getAttribute('data-placement-valid')==='true'){point={x,y};break;}
    }
    if(point)break;
  }
  assert.ok(point,'An open floor position must be placeable');
  await page.screenshot({path:output+'/valid.png'});
  await page.mouse.click(point.x,point.y);
  await page.getByRole('button',{name:'Remove Apple 1',exact:true}).waitFor();
  await page.getByRole('button',{name:'Fan 1 left',exact:true}).click();
  await page.mouse.move(50,450);
  await page.waitForFunction(()=>document.querySelector('.setup-canvas')?.dataset.placementValid==='false');
  await page.screenshot({path:output+'/invalid.png'});
  await page.mouse.click(50,450);
  await page.getByRole('button',{name:'Remove Apple 1',exact:true}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.run-setup')?.disabled===false);
  await page.evaluate(()=>window.holdSetupReplies=true);
  await page.mouse.move(point.x + 25,point.y + 25);
  await page.waitForFunction(()=>window.heldSetupReplies.length>0);
  await page.getByRole('button',{name:'Put objects away',exact:true}).click();
  await page.evaluate(()=>{window.holdSetupReplies=false;for(const f of window.heldSetupReplies.splice(0))f();});
  await page.getByRole('button',{name:'Remove Apple 1',exact:true}).waitFor({state:'detached'});
  assert.equal(await page.getByRole('alert').count(),0,'Clearing must wait for outstanding validation');
  assert.equal(await page.getByRole('button',{name:'Put objects away',exact:true}).count(),0);
  assert.equal(await page.getByText('Already in this house',{exact:true}).count(),0);
  await run.click();
  await page.getByTestId('playback-lab').waitFor();
  await page.waitForFunction(()=>document.querySelector('.playback-lab')?.dataset.worldState==='ready',null,{timeout:90000});
  await page.waitForFunction(()=>document.querySelector('.playback-lab')?.dataset.flyCount==='16');
  assert.match(await page.getByTestId('active-count').textContent(), /^16 active$/);
  assert.equal(await page.locator('.fly-roster button').count(),16);
  await page.screenshot({path:output+'/playback.png'});
  const playbackBox=await page.locator('.playback-world .canvas > canvas').boundingBox();
  assert.deepEqual(playbackBox,{x:0,y:0,width:1440,height:900});
  await page.getByRole('button',{name:'Cancel attempt',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('.setup-game')?.dataset.worldState==='ready',null,{timeout:90000});
  await page.setViewportSize({width:900,height:700});
  await page.screenshot({path:output+'/compact.png'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);
  console.log('Hover stays interactive; rejected edits preserve setup; fullscreen setup/playback and overlays passed.');
}finally{await browser.close();}
