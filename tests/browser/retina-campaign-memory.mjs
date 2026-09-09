import assert from "node:assert/strict";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { mkdir,writeFile } from "node:fs/promises";
const horizon=Number(process.env.RETINA_CAMPAIGN_TICKS ?? 6000);
const root=fileURLToPath(new URL("../..",import.meta.url));
const output=process.env.RETINA_CAMPAIGN_OUTPUT ?? "/tmp/retina-campaign-memory";
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:"chrome",headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];
page.on("pageerror",e=>{errors.push(e.message);console.error(e.message);});
try {
  await page.addInitScript(()=>{
    window.retinalMeasureCost={properties:0};
    const measure=performance.measure.bind(performance);
    performance.measure=(...args)=>{
      const props=args[1]?.detail?.devtools?.properties;
      if(props?.length>window.retinalMeasureCost.properties)
        window.retinalMeasureCost={name:args[0],properties:props.length,first:props.slice(0,8)};
      return measure(...args);
    };
  });
  if (!process.env.RETINA_PRODUCTION) await page.route("**/retinal-campaign-budget?*",route=>route.fulfill({contentType:"text/html",body:`<!doctype html><html><head><title>Retinal campaign budget</title></head><body><div id="root"></div><script type="module" src="/@fs${root}/tests/browser/retina-campaign-fixture.tsx"></script></body></html>`}));
  const level=Number(process.env.RETINA_CAMPAIGN_LEVEL ?? 0);
  const entry=process.env.RETINA_PRODUCTION ? "/tests/browser/retina-campaign.html" : "/retinal-campaign-budget";
  await page.goto(`${process.env.BRAIN_URL ?? "http://127.0.0.1:5173"}${entry}?level=${level}&ticks=${horizon}`);
  const report=async()=>JSON.parse(await page.getByTestId("playback-report").textContent());
  await page.waitForFunction(()=>document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState==="playing",undefined,{timeout:60000});
  await page.getByRole("button",{name:"Select fly 16",exact:true}).click();
  const gpu=await page.evaluate(()=>{
    const gl=document.querySelector(".playback-canvas canvas")?.getContext("webgl2") ?? [...document.querySelectorAll("canvas")].map(c=>c.getContext("webgl2")).find(Boolean);
    const extension=gl?.getExtension("WEBGL_debug_renderer_info");
    return extension ? gl.getParameter(extension.UNMASKED_RENDERER_WEBGL) : "unknown";
  });
  assert.ok(gpu!=="unknown" && !/SwiftShader|llvmpipe|software/i.test(gpu),`Hardware GPU required: ${gpu}`);
  const began=Date.now(); let result;
  for(let previous=-1;Date.now()-began<480000;) {
    await page.waitForTimeout(10000);
    result=await report();
    if(result.computedTick!==previous) {
      console.log(JSON.stringify({level,tick:result.computedTick,archiveMiB:result.memory.archiveOwnedChunkBytes/2**20,wasmMiB:result.memory.wasmBytes/2**20,frameP95:result.frameIntervals.p95Ms}));
      previous=result.computedTick;
    }
    if(result.state==="error") throw Error("Campaign failed; inspect browser state");
    if(result.complete) break;
  }
  assert.ok(result.complete,"Full computation deadline");
  assert.equal(result.computedTick,horizon);
  assert.ok(result.memory.archiveOwnedChunkBytes<=512*1024*1024);
  assert.equal(result.spec.flyCount,16);
  assert.equal(result.underruns,0);
  await page.getByRole("button",{name:"Pause",exact:true}).click();
  const seek=page.getByTestId("playback-seek");
  for(const tick of [horizon,Math.floor(horizon/2),1,Math.floor(horizon/2)]) {await seek.fill(String(tick));await seek.dispatchEvent("input");}
  await seek.fill("1"); await seek.dispatchEvent("input");
  await page.getByRole("button",{name:"Fast",exact:true}).click();
  await page.waitForFunction(() => document.querySelector('[data-testid="playback-lab"]')?.dataset.playbackState === "ended", undefined, {timeout:120000});
  const played = await report();
  assert.equal(played.underruns,0);
  assert.ok(played.frameIntervals.p95Ms<=33,"Playback frame p95 exceeds 33 ms");
  assert.ok(result.productionMs<=horizon*100,"Production must keep up with simulation time");
  await seek.fill(String(Math.floor(horizon/2))); await seek.dispatchEvent("input");
  await page.screenshot({path:`${output}/level-${level}-rewind.png`});
  assert.deepEqual(errors,[]);
  const profiler=await page.evaluate(()=>window.retinalMeasureCost);
  assert.ok(profiler.properties<10000,"Component profiling must not expand retinal byte arrays");
  await writeFile(`${output}/level-${level}.json`,JSON.stringify({browser:browser.version(),diagnosticHorizon:horizon,gpu,productionBuild:!!process.env.RETINA_PRODUCTION,errors,profiler,fullPlayback:played,...result},null,2)+"\n");
  console.log(JSON.stringify({level,complete:true,memory:result.memory,activeNeuralSteps:result.activeNeuralSteps,productionMs:result.productionMs}));
} catch(error) {console.error(await page.locator("body").innerText().catch(()=>"Browser target unavailable"));throw error;} finally {await browser.close();}
