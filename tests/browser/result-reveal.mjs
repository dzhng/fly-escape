import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
const browser = await chromium.launch({channel: 'chrome', headless: true});
const output = process.env.UNLOCK_EVIDENCE ?? '/tmp/fly-unlock';
await mkdir(output, {recursive:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});
 page.setDefaultTimeout(60000);
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker {
   postMessage(message,...rest){
    if(message.type==='start'&&message.input.level.id==='open-window'){
     // Real core, escapes and scoring; four flies start near the exit and twelve stay in another room.
     message.input.level.durationTicks=100;
     message.input.level.exitSuction={reach:2,speed:1,roomSpeed:0.8};
     message.input.level.spawn={kind:'fixed',states:Array.from({length:16},(_,i)=>({
      pose:{position:i<4?{x:1.2,z:2.05+i*0.1}:{x:2.7+(i%4)*0.04,z:6.9+Math.floor(i/4)*0.04},heading:0},
      mode:i%2?'flying':'walking',
     }))};
    }
    super.postMessage(message,...rest);
   }
  };
 });
 await page.goto(process.env.BRAIN_URL ?? 'http://127.0.0.1:5173');
 await page.getByRole('button',{name:'Release the flies'}).click();
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.waitForSelector('[data-playback-state=paused]');
 await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=playback-report]').textContent).complete);
 const progress=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('fly-escape-progress')).bestStars);
 assert.deepEqual(await progress(),{},'computed escapes cannot award unwatched stars');
 const next=page.getByRole('button',{name:/2\. Turn the Corner/});
 assert.equal(await next.isDisabled(),true);
 const seek=page.getByTestId('playback-seek');
 await seek.fill('50');await seek.dispatchEvent('input');
 assert.deepEqual(await progress(),{},'paused seeking cannot award a star');
 await page.getByRole('button',{name:'Play',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(localStorage.getItem('fly-escape-progress')).bestStars['open-window']===1);
 assert.equal(await next.isEnabled(),true,'the first watched star enables the next level during this replay');
 assert.notEqual(await page.getByTestId('playback-lab').getAttribute('data-playback-state'),'ended');
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.screenshot({path:output+'/earned-before-end.png'});
 await seek.fill('0');await seek.dispatchEvent('input');
 assert.equal((await progress())['open-window'],1,'rewinding preserves the earned star');
 await next.click();
 await page.waitForSelector('[data-testid=setup-game][data-world-state=ready]');
 assert.equal(await next.getAttribute('aria-current'),'step');
 await page.screenshot({path:output+'/second-level.png'});
 await page.reload();
 assert.equal((await progress())['open-window'],1);
 assert.equal(await page.getByRole('button',{name:/2\. Turn the Corner/}).isEnabled(),true,'unlock survives reload');
 console.log('Unwatched results stay private; watched stars unlock immediately, persist on rewind/reload, and permit level navigation.');
}finally{await browser.close();}
