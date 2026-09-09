import assert from "node:assert/strict";
import {chromium} from "playwright";
import {fileURLToPath} from "node:url";
import {mkdir,writeFile} from "node:fs/promises";
const root=fileURLToPath(new URL("../..",import.meta.url)).replace(/\/$/,"");
const base=process.env.BRAIN_URL??"http://127.0.0.1:5173";
const output=process.env.PHYSICAL_EYES_OUTPUT??"/tmp/physical-eyes";await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});const report={source:"production AttemptClient and physical capture worker",cases:[]};
try {
 for (const viewport of [{width:1440,height:1100},{width:800,height:1000}]) {
  const page=await browser.newPage({viewport});page.setDefaultTimeout(60000);const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`${base}/@fs${root}/tests/browser/physical-eyes-fixture.html`);
  await page.waitForFunction(()=>window.physicalEyes?.complete||window.physicalEyes?.errors.length);
  assert.deepEqual(await page.evaluate(()=>window.physicalEyes.errors),[]);
  await page.waitForFunction(()=>document.querySelector(".playback-lab")?.dataset.worldState==="ready");
  const pause=page.getByRole("button",{name:"Pause",exact:true});if(await pause.count())await pause.click();
  const seek=async tick=>{
   await page.getByTestId("playback-seek").evaluate((slider,tick)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(slider,String(tick));slider.dispatchEvent(new Event("input",{bubbles:true}));slider.dispatchEvent(new Event("change",{bubbles:true}));},tick);
   await page.waitForFunction(tick=>Math.floor(Number(document.querySelector(".playback-lab").dataset.cursorTick))===Math.floor(tick),tick);
  };
  const inspect=async(id,tick)=>{
   await page.getByRole("button",{name:`Select fly ${id+1}`,exact:true}).click();
   await page.waitForFunction(({id,tick})=>{const el=document.querySelector(".eye-panels");return el?.dataset.flyId===String(id)&&el.dataset.eyeTick===String(tick)&&el.dataset.eyeState==="present";},{id,tick});
   return await page.evaluate(async({root,id,tick})=>{
    const {RetinaProjection,retinaProfile}=await import(`/@fs${root}/packages/game-renderer/src/retina-projection.ts`);
    const projection=new RetinaProjection(retinaProfile),sample=window.physicalEyes.archive.retina(tick,id);
    const panel=document.querySelector(".eye-panels"),canvases=panel.querySelectorAll("canvas"),stride=projection.cells.length*3;
    if(canvases.length!==2)throw Error("Missing paired eyes");
    for(let eye=0;eye<2;eye++){
     const wanted=projection.image(sample.rgb.subarray(eye*stride,(eye+1)*stride));const actual=canvases[eye].getContext("2d").getImageData(0,0,128,128).data;
     if(!actual.every((value,index)=>value===wanted[index]))throw Error(`Canvas differs from physical record fly${id} tick${tick} eye${eye}`);
    }
    if(panel.getBoundingClientRect().bottom>document.querySelector(".science-details .brain-view").getBoundingClientRect().top)throw Error("Eyes overlap brain");
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",sample.rgb)),byte=>byte.toString(16).padStart(2,"0")).join("");
    return {id,tick,sha256:hash,nonzeroBytes:sample.rgb.filter(value=>value!==0).length,pose:sample.pose,profileHash:panel.dataset.profileHash,sceneId:panel.dataset.sceneId};
   },{root,id,tick});
  };
  await seek(4.7);const visits=[];for(let id=0;id<16;id++)visits.push(await inspect(id,4));
  assert.ok(visits.every(visit=>visit.nonzeroBytes>0));assert.ok(new Set(visits.map(visit=>visit.sha256)).size>1);
  await seek(11);await inspect(2,11);await seek(10);await inspect(8,10);await seek(12);await inspect(3,12);
  await seek(4);await inspect(5,4);
  const before=await page.locator(".eye-panels canvas").evaluateAll(canvases=>canvases.map(canvas=>canvas.toDataURL()));
  const world=await page.locator(".playback-world canvas").first().boundingBox();await page.mouse.move(world.x+world.width*.35,world.y+world.height*.4);await page.mouse.wheel(0,-140);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.deepEqual(await page.locator(".eye-panels canvas").evaluateAll(canvases=>canvases.map(canvas=>canvas.toDataURL())),before);
  await page.locator(".eye-panels").scrollIntoViewIfNeeded();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:`${output}/${viewport.width}-selected.png`});await page.locator(".science-details").screenshot({path:`${output}/${viewport.width}-details.png`});await page.locator(".eye-panels").screenshot({path:`${output}/${viewport.width}-eyes.png`});
  const finalTrace=page.locator(".science-trace").last();await finalTrace.evaluate(el=>el.scrollIntoView({block:"center",behavior:"instant"}));await page.waitForFunction(()=>{const el=[...document.querySelectorAll(".science-trace")].at(-1),r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;});await page.screenshot({path:`${output}/${viewport.width}-bottom.png`});
  const archive=await page.evaluate(()=>({chunks:window.physicalEyes.chunks,ticks:window.physicalEyes.archive.computedTick,config:window.physicalEyes.info.retinalConfig}));
  assert.equal(archive.ticks,12);assert.deepEqual(errors,[]);report.cases.push({viewport,archive,visits,exactPixels:true,backwardChunkBoundary:true,terminalTickPresent:true,cameraInvariant:true,verticalScroll:true,errors});await page.close();
 }
} finally {await writeFile(`${output}/report.json`,JSON.stringify(report,null,2)+"\n");await browser.close();}
console.log(JSON.stringify({viewports:report.cases.length,all16:true,exactPixels:true}));
