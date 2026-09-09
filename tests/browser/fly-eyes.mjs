import assert from "node:assert/strict";
import {chromium} from "playwright";
import {fileURLToPath} from "node:url";
import {mkdir,writeFile} from "node:fs/promises";
const root=fileURLToPath(new URL("../..",import.meta.url)).replace(/\/$/,"");
const base=process.env.BRAIN_URL??"http://127.0.0.1:5173";
const output=process.env.FLY_EYES_OUTPUT??"/tmp/fly-eyes";await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});const report={cases:[]};
try{
 for(const viewport of [{width:1440,height:1100},{width:800,height:1000}]){
  const page=await browser.newPage({viewport});page.setDefaultTimeout(60000);const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`${base}/@fs${root}/tests/browser/fly-eyes-fixture.html`);
  await page.getByRole("button",{name:"Start fixture",exact:true}).click();
  await page.waitForFunction(()=>document.querySelector(".playback-lab")?.dataset.worldState==="ready").catch(async error=>{await page.screenshot({path:`${output}/failure.png`});throw Error(`${error.message}\n${await page.locator("body").innerText()}\n${errors.join("\n")}`);});
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  await page.getByText("Select a fly to view its recorded eyes and neural activity.",{exact:true}).waitFor();
  const seek=async(value)=>{
   await page.getByTestId("playback-seek").evaluate((slider,value)=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(slider,String(value));slider.dispatchEvent(new Event("input",{bubbles:true}));slider.dispatchEvent(new Event("change",{bubbles:true}));},value);
   await page.waitForFunction(value=>Math.floor(Number(document.querySelector(".playback-lab").dataset.cursorTick))===Math.floor(value),value);
  };
  const inspect=async(id,tick)=>{
   await page.getByRole("button",{name:`Select fly ${id+1}`,exact:true}).click();
   await page.waitForFunction(({id,tick})=>{const panel=document.querySelector(".eye-panels");return panel?.dataset.flyId===String(id)&&panel.dataset.eyeTick===String(tick)&&panel.dataset.eyeState==="present";},{id,tick});
   await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   const result=await page.evaluate(async({root,id,tick})=>{
    const {RetinaProjection,retinaProfile}=await import(`/@fs${root}/packages/game-renderer/src/retina-projection.ts`);
    const projection=new RetinaProjection(retinaProfile),expected=window.eyeFixture.expected[tick-1];const index=expected.request.poses.findIndex(pose=>pose.flyId===id),width=projection.cells.length*3;
    const panel=document.querySelector(".eye-panels"),canvases=panel.querySelectorAll("canvas");if(canvases.length!==2)throw Error("missing paired eyes");
    let bytes=0;
    for(let eye=0;eye<2;eye++){
     const wanted=projection.image(expected.rgb.subarray(index*width*2+eye*width,index*width*2+(eye+1)*width));const canvas=canvases[eye],actual=canvas.getContext("2d").getImageData(0,0,canvas.width,canvas.height).data;
     if(actual.length!==wanted.length||!actual.every((value,i)=>value===wanted[i]))throw Error(`eye pixels differ fly${id}tick${tick}eye${eye}`);bytes+=wanted.length;
    }
    const eyes=panel.getBoundingClientRect(),brain=document.querySelector(".science-details .brain-view").getBoundingClientRect();
    if(eyes.bottom>brain.top)throw Error("eye previews are not above the brain");
    return {id,tick,displayBytes:bytes,sceneId:panel.dataset.sceneId,profileHash:panel.dataset.profileHash};
   },{root,id,tick});
   assert.ok(result.sceneId);return result;
  };
  await seek(4.7);const visits=[];
  for(let id=0;id<16;id++)visits.push(await inspect(id,4));
  await seek(0);
  await page.getByRole("button",{name:"Select fly 1",exact:true}).click();
  await page.getByText("Eye input begins with the first recorded tick.",{exact:true}).waitFor();
  assert.equal(await page.locator(".eye-panels canvas").count(),0);
  await seek(1);const black=await inspect(0,1);
  await seek(11);await inspect(15,11);
  await seek(10);await inspect(7,10);
  await seek(12);await inspect(3,12);
  assert.ok((await page.locator('[data-testid="fly-card-3"]').innerText()).toLowerCase().includes("dead"));
  await seek(4);await inspect(5,4);
  const before=await page.locator(".eye-panels canvas").evaluateAll(canvases=>canvases.map(canvas=>canvas.toDataURL()));
  const world=page.locator(".playback-world canvas").first();const box=await world.boundingBox();await page.mouse.move(box.x+box.width*.35,box.y+box.height*.4);await page.mouse.wheel(0,-140);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  assert.deepEqual(await page.locator(".eye-panels canvas").evaluateAll(canvases=>canvases.map(canvas=>canvas.toDataURL())),before,"camera movement changed historical eyes");
  await page.locator(".eye-panels").scrollIntoViewIfNeeded();
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"horizontal page overflow");
  await page.screenshot({path:`${output}/${viewport.width}-selected.png`});await page.locator(".science-details").screenshot({path:`${output}/${viewport.width}-details.png`});
  const finalTrace=page.locator(".science-trace").last();await finalTrace.scrollIntoViewIfNeeded();
  const traceBounds=await finalTrace.boundingBox();assert.ok(traceBounds.y>=0&&traceBounds.y+traceBounds.height<=viewport.height);
  const caption=page.locator(".brain-view small").last();await caption.scrollIntoViewIfNeeded();
  const captionBounds=await caption.boundingBox();assert.ok(captionBounds.y>=0&&captionBounds.y+captionBounds.height<=viewport.height);
  await page.getByRole("button",{name:"Retry — edit setup",exact:true}).click();await page.getByRole("button",{name:"Leave attempt",exact:true}).click();
  await page.getByRole("button",{name:"Start fixture",exact:true}).click();await page.waitForFunction(()=>document.querySelector(".playback-lab")?.dataset.worldState==="ready").catch(async error=>{await page.screenshot({path:`${output}/failure.png`});throw Error(`${error.message}\n${await page.locator("body").innerText()}\n${errors.join("\n")}`);});await page.getByRole("button",{name:"Pause",exact:true}).click();await seek(4);await inspect(5,4);
  assert.notDeepEqual(await page.locator(".eye-panels canvas").evaluateAll(canvases=>canvases.map(canvas=>canvas.toDataURL())),before,"retry retained the previous fixture input");
  assert.deepEqual(errors,[]);report.cases.push({viewport,visitedEveryFly:visits,black,initialInputAbsent:true,terminalTransitionPresent:true,chunkBoundarySeek:true,fractionalCursorUsesFloor:true,cameraPreservedHistoricalEyes:true,retryReplacedInput:true,errors});await page.close();
 }
}finally{await writeFile(`${output}/report.json`,JSON.stringify(report,null,2));await browser.close();}
console.log(JSON.stringify(report));
