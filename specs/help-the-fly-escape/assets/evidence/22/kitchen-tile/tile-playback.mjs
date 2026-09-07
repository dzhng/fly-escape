import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true});
const samples=[],errors=[];
try{const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));await p.addInitScript(()=>localStorage.setItem('fly-escape-progress',JSON.stringify({bestStars:{'open-window':1},setups:{}})));
for(const level of [1,2]){
 await p.goto((process.env.URL ?? 'http://127.0.0.1:31856/'));await p.getByRole('button',{name:level===1?/1\. Open/:/2\. Turn/}).click();
 for(let run=0;run<2;run++){
 await p.waitForFunction(()=>document.querySelector('.run-setup')?.disabled===false);await p.getByRole('button',{name:'Release the flies',exact:true}).click();
 await p.waitForFunction(()=>{const e=document.querySelector('[data-testid="playback-lab"]');return e?.dataset.worldState==='ready'&&e.dataset.playbackState==='playing'&&Number(e.dataset.cursorTick)>=10},undefined,{timeout:90000});
 await p.getByRole('button',{name:'Pause',exact:true}).click();
 const r=JSON.parse(await p.getByTestId('playback-report').textContent());samples.push({level,run,renderer:r.renderer,spec:r.spec});assert.equal(r.spec.flyCount,20);
 if(run===0)await p.screenshot({path:`/tmp/kitchen-tile-shots/playback-${level}.png`});
 await p.getByRole('button',{name:/Cancel attempt|Retry — edit setup/}).click();await p.waitForFunction(()=>document.querySelector('.run-setup')?.disabled===false);
 }
}
assert.deepEqual(errors,[]);
}finally{await writeFile('/tmp/kitchen-tile-shots/playback.json',JSON.stringify({samples,errors},null,2));await b.close();}
