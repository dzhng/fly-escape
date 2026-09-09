import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { visibleResponse } from "./visible-response.mjs";
const root = fileURLToPath(new URL("../..",import.meta.url)).replace(/\/$/,"");
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5188";
const runs = Number(process.env.RETINA_RETRY_RUNS ?? 10);
assert.ok(Number.isInteger(runs) && runs >= 1 && runs <= 10);
const output = process.env.RETINA_RETRY_OUTPUT ?? "/tmp/retina-retries";
await mkdir(output,{recursive:true});
const browser = await chromium.launch({channel:"chrome",headless:true});
const page = await browser.newPage({viewport:{width:1440,height:1000}});
const cdp = await page.context().newCDPSession(page);
const errors = [], trials = [];
let warmup;
const percentile = (values, q) => [...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.ceil(values.length*q)-1)];
page.on("pageerror",error=>errors.push(error.message));
try {
  const entry = process.env.RETINA_PRODUCTION ? "/tests/browser/retina-retries-fixture.html" : `/@fs${root}/tests/browser/retina-retries-fixture.html`;
  await page.goto(base+entry);
  const release = page.getByRole("button",{name:"Release the flies",exact:true});
  await release.waitFor(); await page.waitForFunction(()=>!document.querySelector(".run-setup").disabled);
  const saved = await page.evaluate(()=>localStorage.getItem("fly-escape-progress"));
  for(let run=-1;run<runs;run++) {
    await release.click();
    await page.waitForFunction(()=>{
      const report=document.querySelector('[data-testid="playback-report"]');
      return report && JSON.parse(report.textContent).computedTick>=120;
    },undefined,{timeout:60000});
    await page.getByRole("button",{name:"Select fly 16",exact:true}).click();
    const report=JSON.parse(await page.getByTestId("playback-report").textContent());
    assert.equal(report.spec.flyCount,16);

    await page.getByRole("button",{name:"Cancel attempt",exact:true}).click();
    const returnMs=await visibleResponse(page,"click",'[data-testid="setup-game"]',()=>page.getByRole("button",{name:"Leave attempt",exact:true}).click());
    await page.waitForFunction(id=>window.retinaRetries.cancellations.some(item=>item.attemptId===id),report.spec.attemptId,{timeout:10000});
    await cdp.send("HeapProfiler.collectGarbage");
    const heap=(await cdp.send("Runtime.getHeapUsage")).usedSize;
    const observed=await page.evaluate(id=>({capture:window.retinaRetries.captures[id],cancellation:window.retinaRetries.cancellations.find(item=>item.attemptId===id),saved:localStorage.getItem("fly-escape-progress")}),report.spec.attemptId);
    assert.equal(observed.saved,saved,"Cancellation must preserve arrangements and watched stars");
    assert.ok(!observed.cancellation.error,observed.cancellation.error);
    assert.equal(observed.capture.maxActive,1);
    assert.equal(observed.capture.resources.diagnosticStagingBytes,0);
    const trial={run:run+1,underruns:report.underruns,frameIntervals:report.frameIntervals,startup:report.startup,attemptId:report.spec.attemptId,returnMs,acknowledgementMs:observed.cancellation.acknowledgementMs,
      afterGcMainHeapBytes:heap,memory:report.memory,renderer:report.renderer,capture:observed.capture};
    if (run < 0) warmup = trial; else trials.push(trial);
    console.log(JSON.stringify({run:run+1,returnMs,acknowledgementMs:trial.acknowledgementMs,afterGcMainHeapMiB:heap/2**20}));
  }
  const allTimes=trials.flatMap(trial=>trial.capture.times);
  const wasmTimes=trials.flatMap(trial=>trial.capture.wasmTimes);
  assert.ok(wasmTimes.length>0,"Full sixteen-fly acquisition must be observed through the actual WASM copy");
  const summary={runs,warmup,fullRetryGate:runs===10,browser:browser.version(),productionBuild:!!process.env.RETINA_PRODUCTION,
    cancellationP95Ms:percentile(trials.map(t=>t.acknowledgementMs),.95),returnP95Ms:percentile(trials.map(t=>t.returnMs),.95),
    acquisitionThroughWasm:{medianMs:percentile(wasmTimes,.5),p95Ms:percentile(wasmTimes,.95),worstMs:Math.max(...wasmTimes),samples:wasmTimes.length},
    capture:{medianMs:percentile(allTimes,.5),p95Ms:percentile(allTimes,.95),worstMs:Math.max(...allTimes),samples:allTimes.length},
    afterGcMainHeapGrowthBytes:runs===10 ? percentile(trials.slice(-3).map(t=>t.afterGcMainHeapBytes),.5)-percentile(trials.slice(1,4).map(t=>t.afterGcMainHeapBytes),.5) : null,
    errors,trials};
  await writeFile(`${output}/report.json`,JSON.stringify(summary,null,2)+"\n");
  assert.deepEqual(errors,[]);
  if(runs===10) {
    for(const trial of trials) assert.equal(trial.underruns,0,`Warm retry ${trial.run} underruns`);
    assert.ok(summary.productionBuild,"Acceptance requires a production build");
    assert.ok(summary.cancellationP95Ms<=100,"Cancellation acknowledgement p95 exceeds100ms");
    assert.ok(summary.returnP95Ms<=200,"Return to setup p95 exceeds200ms");
    assert.ok(summary.acquisitionThroughWasm.p95Ms<=20,"Full acquisition through WASM transfer p95 exceeds20ms");
    assert.ok(summary.afterGcMainHeapGrowthBytes<=32*2**20,"Warm retained main heap grows by more than32MiB");
    const first=trials[0].capture.resources;
    for(const trial of trials) for(const key of ["geometries","textures","stagingBytes","gpuReadbackBytes","sampleBytes"])
      assert.equal(trial.capture.resources[key],first[key],`Capture resources changed across retries: ${key}`);
  }
} finally {await browser.close();}
