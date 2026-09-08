import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const output=process.env.EXIT_EVIDENCE ?? '/tmp/fly-exit-capture';
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
 const page=await browser.newPage({viewport:{width:1440,height:900}});page.setDefaultTimeout(60000);
 await page.addInitScript(()=>{
  const NativeWorker=window.Worker;
  window.Worker=class extends NativeWorker {
   postMessage(message,...rest){
    if(message.type==='start'){
     // A near-exit fixture; all physics, neural activity and authored suction remain real.
     message.input.level.durationTicks=100;
     message.input.level.spawn={kind:'fixed',states:Array.from({length:16},(_,i)=>({
      pose:{position:{x:2+(i%4)*0.03,z:2.05+Math.floor(i/4)*0.08},heading:0},mode:i%2?'walking':'flying',
     }))};
    }
    super.postMessage(message,...rest);
   }
  };
 });
 await page.goto(process.env.BRAIN_URL ?? 'http://127.0.0.1:5173');
 await page.getByRole('button',{name:'Release the flies'}).click();
 await page.getByRole('button',{name:'Pause',exact:true}).click();
 await page.waitForFunction(()=>JSON.parse(document.querySelector('[data-testid=playback-report]').textContent).complete);
 const read=async()=>JSON.parse(await page.getByTestId('playback-report').textContent());
 const completed=await read();
 assert.equal(completed.result.outcomes.escaped,16);
 assert.ok(completed.result.completedTick<=50,'nearby flies must escape within five simulated seconds');
 const seek=page.getByTestId('playback-seek');
 for(const [name,tick] of [['near-exit',0],['drawn-through',Math.floor(completed.computedTick/2)],['escaped',completed.computedTick]]){
  await seek.fill(String(tick));await seek.dispatchEvent('input');
  await page.waitForFunction(t=>Math.abs(Number(document.querySelector('[data-cursor-tick]').dataset.cursorTick)-t)<0.1,tick);
  await page.screenshot({path:output+'/'+name+'.png'});
 }
 await writeFile(output+'/exit-capture.json',JSON.stringify({spec:completed.spec,result:completed.result},null,2));
 console.log(`All sixteen nearby flies physically escaped by tick ${completed.result.completedTick}.`);
} finally {await browser.close();}
