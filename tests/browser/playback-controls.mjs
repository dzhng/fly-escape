import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const output=process.env.CONTROLS_EVIDENCE ?? '/tmp/fly-controls';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.setDefaultTimeout(90000);
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;window.heldFinal=[];
  window.Worker=class extends NativeWorker {
   postMessage(message,...rest){if(message.type==='start')message.input.level.durationTicks=100;super.postMessage(message,...rest);}
   set onmessage(receive){super.onmessage=event=>{
    const reply=event.data.reply;
    if(reply?.type==='frames'&&reply.chunk.result)window.heldFinal.push(()=>receive(event));
    else receive(event);
   };}
  };
 });
 await page.goto(process.env.BRAIN_URL ?? 'http://127.0.0.1:5173');
 await page.getByRole('button',{name:'Release the flies'}).click();
 const fast=page.getByRole('button',{name:'Fast',exact:true});
 await fast.waitFor();assert.equal(await fast.isDisabled(),true);
 await page.waitForSelector('[data-playback-state=playing]');
 const report=async()=>JSON.parse(await page.getByTestId('playback-report').textContent());
 assert.equal((await report()).mode,'realTime');
 assert.equal((await report()).speed,1);
 assert.equal(await page.locator('.playback-icon svg').count(),5);
 assert.equal(await page.locator('.playback-icon-tooltip[title]').count(),5);
 await page.screenshot({path:output+'/real-time.png'});
 await page.waitForFunction(()=>window.heldFinal.length>0);
 assert.equal(await fast.isDisabled(),true);
 await fast.evaluate(button=>button.click());
 assert.equal((await report()).mode,'realTime');
 await page.evaluate(()=>{for(const deliver of window.heldFinal.splice(0))deliver();});
 await fast.click();
 await page.waitForFunction(()=>{
  const r=JSON.parse(document.querySelector('[data-testid=playback-report]').textContent);return r.mode==='fast'&&r.state==='playing';
 });
 assert.equal((await report()).speed,(await report()).fastMultiplier);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.waitForSelector('[data-playback-state=paused]');
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.waitForFunction(()=>{const r=JSON.parse(document.querySelector('[data-testid=playback-report]').textContent);return r.mode==='realTime'&&r.state==='playing';});
 await page.getByRole('button',{name:'Replay',exact:true}).click();
 const dialog=page.getByRole('dialog');await dialog.waitFor();
 assert.match(await dialog.innerText(),/same flies and events/);
 await page.waitForSelector('[data-playback-state=paused]');
 await page.screenshot({path:output+'/replay-dialog.png'});
 await page.getByRole('button',{name:'Keep watching',exact:true}).click();
 await page.waitForSelector('[data-playback-state=playing]');
 await page.getByRole('button',{name:'Replay',exact:true}).click();
 await page.getByRole('button',{name:'Replay from start',exact:true}).click();
 await page.waitForFunction(()=>Number(document.querySelector('[data-cursor-tick]').dataset.cursorTick)<2);
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.getByRole('button',{name:'Retry — edit setup',exact:true}).click();
 await dialog.waitFor();assert.match(await dialog.innerText(),/unfinished results are not awarded/);
 await page.screenshot({path:output+'/leave-dialog.png'});
 await page.keyboard.press('Escape');
 await dialog.waitFor({state:'detached'});
 assert.equal((await report()).state,'paused');
 await page.getByRole('button',{name:'Retry — edit setup',exact:true}).click();
 await page.getByRole('button',{name:'Leave attempt',exact:true}).click();
 await page.getByRole('button',{name:'Release the flies'}).waitFor();
 console.log('Automatic real time; fast unavailable until complete; icon tooltips; confirmation, dismissal and playback restoration passed.');
}finally{await browser.close();}
