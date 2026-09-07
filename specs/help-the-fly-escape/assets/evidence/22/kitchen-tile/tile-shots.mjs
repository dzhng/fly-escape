import {chromium} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
const b=await chromium.launch({channel:'chrome',headless:true});
const report={errors:[]};
try {
 const p=await b.newPage({viewport:{width:1440,height:1000}});
 p.on('pageerror',e=>report.errors.push(e.message));
 await p.addInitScript(()=>localStorage.setItem('fly-escape-progress',JSON.stringify({bestStars:{'open-window':1},setups:{}})));
 await mkdir('/tmp/kitchen-tile-shots',{recursive:true});
 for(const arm of ['before','after']) {
  if(arm==='before')await p.route('**/*tile-floor.glb*',async r=>r.request().resourceType()==='fetch'?r.fulfill({body:await readFile('assets/house/floor.glb'),contentType:'model/gltf-binary'}):r.continue());
  else await p.unroute('**/*tile-floor.glb*');
  for(const level of [1,2]) {
   await p.goto((process.env.URL ?? 'http://127.0.0.1:31856/'));
   await p.getByRole('button',{name:level===1?/1\. Open/:/2\. Turn/}).click();
   await p.getByRole('button',{name:'Release the flies',exact:true}).waitFor();
   await p.waitForTimeout(700);
   await p.mouse.move(1400,50);
   await p.screenshot({path:`/tmp/kitchen-tile-shots/${arm}-${level}-whole.png`});
   await p.mouse.move(800,600);await p.mouse.down();await p.mouse.move(550,550,{steps:8});await p.mouse.up();
   await p.mouse.move(550,500);await p.mouse.wheel(0,-650);await p.mouse.move(1400,50);await p.waitForTimeout(250);
   await p.screenshot({path:`/tmp/kitchen-tile-shots/${arm}-${level}-kitchen.png`});
   await p.mouse.move(200,550);await p.mouse.down();await p.mouse.move(550,500,{steps:8});await p.mouse.up();
   await p.mouse.move(550,500);await p.mouse.wheel(0,-400);await p.mouse.move(1400,50);await p.waitForTimeout(250);
   await p.screenshot({path:`/tmp/kitchen-tile-shots/${arm}-${level}-threshold.png`});
  }
 }
 if(report.errors.length)throw Error(report.errors.join('\n'));
}finally{await writeFile('/tmp/kitchen-tile-shots/report.json',JSON.stringify(report,null,2));await b.close();}
