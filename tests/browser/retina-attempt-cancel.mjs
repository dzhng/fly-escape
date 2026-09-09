import assert from "node:assert/strict";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";
const target = process.env.RETINA_CANCEL_TARGET ?? "scene";
const root = fileURLToPath(new URL("../..", import.meta.url));
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.BRAIN_URL ?? "http://127.0.0.1:5173");
  await page.waitForLoadState("networkidle");
  let held, reached;
  const loading = new Promise(resolve => { reached = resolve; });
  await page.route(target === "map" ? "**/brain/retinal-map.json" : "**/*.glb*", route => {
    if (!held && !new URL(route.request().url()).searchParams.has("import")) { held = route; console.log("Held asset", route.request().url()); reached(); } else void route.continue();
  });
  await page.evaluate(async root => {
    const { AttemptClient } = await import(`/@fs${root}/packages/sim-client/src/attempt-client.ts`);
    const { campaignLevels } = await import("/src/campaign-content.ts");
    const c = campaignLevels[0];
    const input = { attemptId: "cancel-initialization", rootSeed: "42", flyCount: 2,
      level: { ...c.level, durationTicks: 3, spawn: { ...c.level.spawn, flyingCount: 1 } }, tuning: c.tuning, placements: [] };
    const authoring = { roomFloors:c.roomFloors, roomDetails:c.roomDetails, lighting:c.lighting };
    const replies = [];
    let complete, fail;
    const done = new Promise((resolve,reject) => {complete=resolve;fail=reject;});
    const client = new AttemptClient(reply => {
      replies.push(reply.type);
      if(reply.type === "error") fail(Error(reply.message));
      if(reply.type === "complete") complete({replies});
    });
    window.retinaInitCase = { client,input,authoring,done };
    client.start(input,authoring);
  },root);
  await Promise.race([loading, new Promise((_,reject)=>setTimeout(()=>reject(Error("No asset request")),10000))]);
  const began = Date.now();
  await page.evaluate(() => {
    const c=window.retinaInitCase;
    c.client.cancel();
    c.client.start({...c.input,attemptId:"after-cancel"},c.authoring);
  });
  const result = await page.evaluate(async () => {
    const c=window.retinaInitCase;
    try { return await c.done; } finally { c.client.dispose(); }
  });
  await held.abort().catch(()=>{});
  assert.deepEqual(result.replies, ["ready","frames","complete"]);
  assert.deepEqual(errors,[]);
  const initializationRecoveryMs = Date.now()-began;
  const gpuCancel = await page.evaluate(async root => {
    const { campaignLevels } = await import("/src/campaign-content.ts");
    const c = campaignLevels[0];
    const input = {attemptId:"same-id",rootSeed:"42",flyCount:2,level:{...c.level,durationTicks:3,spawn:{...c.level.spawn,flyingCount:1}},tuning:c.tuning,placements:[]};
    const opticalWorld = {roomFloors:c.roomFloors,roomDetails:c.roomDetails,lighting:c.lighting};
    const worker = new Worker(`/@fs${root}/packages/sim-client/src/attempt-worker.ts`,{type:"module"});
    return await new Promise((resolve,reject) => {
      let cancelled=false, oldFrames=0, newFrames=0;
      const timeout=setTimeout(()=>finish(reject,Error("Capture cancellation deadline")),30000);
      const finish=(fn,value)=>{clearTimeout(timeout);worker.terminate();fn(value);};
      worker.onerror=e=>finish(reject,Error(e.message));
      worker.onmessage=({data})=>{
        if(data.type==="fatal") return finish(reject,Error(data.message));
        if(data.type==="progress") {
          if(data.generation===1 && data.phase==="capture" && !cancelled) {
            cancelled=true;
            worker.postMessage({type:"cancel",attemptId:input.attemptId,generation:1});
            worker.postMessage({type:"start",input,opticalWorld,generation:2});
          }
          return;
        }
        const reply=data.reply;
        if(reply.type==="error") return finish(reject,Error(reply.message));
        if(reply.type==="ready") worker.postMessage({type:"grantCredits",attemptId:input.attemptId,generation:data.generation,count:2});
        if(reply.type==="frames") data.generation===1 ? oldFrames++ : newFrames++;
        if(reply.type==="complete" && data.generation===2) finish(resolve,{cancelled,oldFrames,newFrames});
      };
      worker.postMessage({type:"start",input,opticalWorld,generation:1});
    });
  },root);
  assert.deepEqual(gpuCancel,{cancelled:true,oldFrames:0,newFrames:1});
  const report = {cancelledHangingDownload:target,restartedOnSameClient:true,replies:result.replies,initializationRecoveryMs,gpuCancel,errors};
  await writeFile(`/tmp/retina-attempt-cancel-${target}.json`,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify(report));
} finally { await browser.close(); }
