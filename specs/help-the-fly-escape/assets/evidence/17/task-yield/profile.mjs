import { createRequire } from 'node:module';
import {mkdir,writeFile} from 'node:fs/promises';
const require=createRequire('/Users/david/dev/fly-escape/package.json');
const {chromium}=require('playwright');
const out='/tmp/fly-integrated-cpu'; await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
const page=await browser.newPage({viewport:{width:1440,height:900}});
await page.addInitScript(()=>{
localStorage.setItem('fly-escape-progress',JSON.stringify({bestStars:{'open-window':1}}));
const random=crypto.getRandomValues.bind(crypto);crypto.getRandomValues=a=>{if(a instanceof BigUint64Array&&a.length===1){a[0]=110n;return a;}return random(a);};
});
const cdp=await page.context().newCDPSession(page);
await cdp.send('Tracing.start',{categories:'disabled-by-default-v8.cpu_profiler,devtools.timeline',options:'sampling-frequency=1000',transferMode:'ReturnAsStream'});
await page.goto('http://127.0.0.1:5322/');
await page.getByRole('button',{name:/2\. Turn the Corner/}).click();
await page.getByRole('button',{name:'Release the flies',exact:true}).click();
await page.waitForFunction(()=>{const e=document.querySelector('[data-testid=playback-report]');return e&&JSON.parse(e.textContent).computedTick>=500;},undefined,{timeout:90000});
await writeFile(out+'/report.json',await page.getByTestId('playback-report').textContent());
const completed=new Promise(r=>cdp.once('Tracing.tracingComplete',r)); await cdp.send('Tracing.end');const {stream}=await completed;
let data='';while(true){const chunk=await cdp.send('IO.read',{handle:stream});data+=chunk.data;if(chunk.eof)break;}await cdp.send('IO.close',{handle:stream});await writeFile(out+'/trace.json',data);
console.log(JSON.stringify({out,bytes:data.length}));
}finally{await browser.close();}
