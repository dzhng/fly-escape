import assert from "node:assert/strict";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
const root=fileURLToPath(new URL("../..",import.meta.url));
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
  const page=await browser.newPage(),errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.goto(process.env.BRAIN_URL ?? "http://127.0.0.1:5173");
  const results=[];
  for(const mode of ["context","unresponsive","late-complete","suspended"]) results.push(await page.evaluate(async ({root,mode})=>{
    const {campaignLevels}=await import("/src/campaign-content.ts");
    const c=campaignLevels[0], input={attemptId:mode,rootSeed:"42",flyCount:2,level:{...c.level,durationTicks:2,spawn:{...c.level.spawn,flyingCount:1}},tuning:c.tuning,placements:[]};
    const opticalWorld={roomFloors:c.roomFloors,roomDetails:c.roomDetails,lighting:c.lighting};
    const worker=new Worker(`/@fs${root}/tests/browser/retina-attempt-fault-worker.mjs?mode=${mode}`,{type:"module"});
    return await new Promise((resolve,reject)=>{
      let failure, began, frames=0;
      const timeout=setTimeout(()=>finish(reject,Error("Fault/retry deadline")),15000);
      const finish=(fn,value)=>{clearTimeout(timeout);worker.terminate();fn(value);};
      worker.onerror=e=>finish(reject,Error(e.message));
      worker.onmessage=({data})=>{
        if(data.type==="boot") {worker.postMessage({type:"start",input,opticalWorld,generation:1});return;}
        if(data.type==="fatal") return finish(reject,Error(data.message));
        if(data.type==="progress") {if(data.phase==="capture" && data.generation===1) began=performance.now();return;}
        const reply=data.reply;
        if(reply.type==="ready") worker.postMessage({type:"grantCredits",attemptId:input.attemptId,generation:data.generation,count:2});
        if(reply.type==="frames") {
          if(data.generation===1 && ["context","unresponsive"].includes(mode)) return finish(reject,Error("Failed acquisition published a frame"));
          frames++;
        }
        if(reply.type==="error") {
          if(data.generation!==1 || ["late-complete","suspended"].includes(mode)) return finish(reject,Error(reply.message));
          failure={message:reply.message,settledMs:performance.now()-began};
          worker.postMessage({type:"start",input,opticalWorld,generation:2});
        }
        if(reply.type==="complete") finish(resolve,{mode,failure,retryFrames:frames});
      };
    });
  },{root,mode}));
  for(const result of results) {
    if (["context","unresponsive"].includes(result.mode)) assert.ok(result.failure.settledMs<5000);
    else assert.equal(result.failure,undefined);
    assert.equal(result.retryFrames,1);
  }
  assert.deepEqual(errors,[]);
  await writeFile("/tmp/retina-attempt-faults.json",JSON.stringify({results,errors},null,2)+"\n");
  console.log(JSON.stringify(results));
} finally {await browser.close();}
