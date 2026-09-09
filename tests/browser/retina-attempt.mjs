import assert from "node:assert/strict";
import { chromium } from "playwright";
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const sourceRoot = fileURLToPath(new URL("../..", import.meta.url));
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
try {
  const page = await browser.newPage();
  page.on("pageerror", e => errors.push(e.message));
  await page.goto(process.env.BRAIN_URL ?? "http://127.0.0.1:5173");
  const report = await page.evaluate(async sourceRoot => {
    const { campaignLevels } = await import("/src/campaign-content.ts");
    const { FrameArchive } = await import(`/@fs${sourceRoot}/packages/sim-client/src/record.ts`);
    const worker = new Worker(`/@fs${sourceRoot}/packages/sim-client/src/attempt-worker.ts`, { type: "module" });
    const content = campaignLevels[0];
    const opticalWorld = { roomFloors: content.roomFloors, roomDetails: content.roomDetails, lighting: content.lighting };
    const input = { attemptId: "physical-worker", rootSeed: "42", flyCount: 2,
      level: { ...content.level, durationTicks: 12, spawn: { ...content.level.spawn, flyingCount: 1 } }, tuning: content.tuning, placements: [] };
    return await new Promise((resolve, reject) => {
      let archive, info, captures = 0, chunks = 0, metrics = [], recordedChunks = [];
      const timer = setTimeout(() => finish(reject, Error("Physical attempt deadline")), 60000);
      const finish = (fn, value) => { clearTimeout(timer); worker.terminate(); fn(value); };
      worker.onerror = event => finish(reject, Error(event.message));
      worker.onmessage = async ({ data }) => {
        try {
          if (data.type === "fatal") throw Error(data.message);
          if (data.type === "progress") { if(data.phase === "capture") captures++; return; }
          const reply = data.reply;
          if (reply.type === "error") throw Error(reply.message);
          if (reply.type === "ready") {
            info = reply.info;
            if (!info.retinalConfig) throw Error("Missing optical config");
            archive = new FrameArchive(info.spec, info.recordLayout, info.archiveBytes, info.initialBodies);
            worker.postMessage({ type: "grantCredits", attemptId: input.attemptId, generation: 1, count: 2 });
          }
          if (reply.type === "frames") { recordedChunks.push(structuredClone(reply.chunk)); archive.append(reply.chunk); chunks++; metrics.push(reply.metrics); }
          if (reply.type === "complete") {
            let bytes = 0, nonzero = 0; const hashes = [];
            for (let tick = 1; tick <= 12; tick++) for(let fly = 0; fly < 2; fly++) {
              const retina = archive.retina(tick, fly);
              if (!retina || retina.rgb.length !== 4326) throw Error(`Missing retinal record ${tick}/${fly}`);
              bytes += retina.rgb.length; nonzero += retina.rgb.filter(value => value !== 0).length;
              if (!retina.pose.rotation.every(Number.isFinite)) throw Error("Invalid pose");
              hashes.push({tick,fly,first:[...retina.rgb.slice(0,6)]});
            }
            worker.terminate();
            const frames=Array.from({length:12},(_,index)=>archive.frame(index+1));
            const verifier=new Worker(`/@fs${sourceRoot}/tests/browser/retina-attempt-replay-worker.mjs`,{type:"module"});
            try {
              const replay=await new Promise((done,fail)=>{
                verifier.onerror=event=>fail(Error(event.message));
                verifier.onmessage=({data})=>data.error ? fail(Error(data.error)) : done(data);
                verifier.postMessage({input,config:info.retinalConfig,frames,chunks:recordedChunks});
              });
              finish(resolve, {captures,chunks,bytes,nonzero,metrics,config:info.retinalConfig,hashes,replay});
            } finally {verifier.terminate();}
          }
        } catch(error) { finish(reject,error); }
      };
      worker.postMessage({type:"start",input,opticalWorld,generation:1});
    });
  }, sourceRoot);
  assert.equal(report.captures,12); assert.equal(report.chunks,2); assert.equal(report.bytes,103824);
  assert.ok(report.nonzero > 0); assert.deepEqual(errors,[]);
  await writeFile(process.env.RETINA_ATTEMPT_REPORT ?? "/tmp/retina-attempt.json",JSON.stringify({...report,errors},null,2)+"\n");
  console.log(JSON.stringify({captures:report.captures,chunks:report.chunks,bytes:report.bytes,metrics:report.metrics}));
} finally { await browser.close(); }
