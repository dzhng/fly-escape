import {createRequire} from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire('/Users/david/dev/fly-escape/package.json');
const {chromium}=require('playwright');
const out='/tmp/fly-paused-profile';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const errors=[];
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5322/');
 await page.getByRole('button',{name:/1\. Open/}).click();
 await page.waitForFunction(()=>document.querySelector('.run-setup')?.disabled===false);
 await page.getByRole('button',{name:'Release the flies',exact:true}).click();
 await page.waitForFunction(()=>{const e=document.querySelector('[data-testid="playback-lab"]');return e?.dataset.worldState==='ready'&&e.dataset.playbackState==='playing'&&Number(e.dataset.cursorTick)>=10},undefined,{timeout:90000});
 await page.getByRole('button',{name:'Pause',exact:true}).click();await page.waitForTimeout(2000);
 const before=JSON.parse(await page.getByTestId('playback-report').textContent());
 const cdp=await page.context().newCDPSession(page);await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');
 await page.waitForTimeout(10000);
 const {profile}=await cdp.send('Profiler.stop');
 const after=JSON.parse(await page.getByTestId('playback-report').textContent());
 await writeFile(`${out}/profile.cpuprofile`,JSON.stringify(profile));
 await writeFile(`${out}/report.json`,JSON.stringify({version:browser.version(),before,after,errors},null,2));
 await page.screenshot({path:`${out}/paused.png`});
 if(errors.length||before.cursorTick!==after.cursorTick||after.spec.flyCount!==20)throw Error('profile fixture failed');
}finally{await browser.close();}
