import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const full = process.argv.includes("--full");
assert.ok(process.argv.slice(2).every(arg=>["--full","--smoke"].includes(arg)),"Use --smoke (default) or --full after the CPU window is cleared");
assert.ok(!(full && process.argv.includes("--smoke")),"Choose one run mode");
const site = resolve(process.env.RETINAL_BASELINE_SITE ?? "/tmp/fly-retinal-baseline-site");
const output = resolve(process.env.RETINAL_BASELINE_OUTPUT ?? `/tmp/retinal-baseline-${full ? "performance" : "smoke"}`);
const identity = JSON.parse(await readFile(`${site}/build-identity.json`,"utf8"));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const {buildHash,...identityBody}=identity;
assert.equal(hash(JSON.stringify(identityBody)),buildHash,"Build identity changed");
for (const [name,expected] of Object.entries(identity.outputFiles))
  assert.equal(hash(await readFile(resolve(site,name))),expected,`Built artifact changed: ${name}`);

const mime={".js":"text/javascript",".html":"text/html",".json":"application/json",".wasm":"application/wasm",".png":"image/png",".jpg":"image/jpeg",".webp":"image/webp",".svg":"image/svg+xml"};
const server = createServer(async(request,response)=>{
  try {
    let path=resolve(site,"."+decodeURIComponent(new URL(request.url,"http://localhost").pathname));
    if (path !== site && !path.startsWith(site+sep)) throw Error("Outside the built site");
    if ((await stat(path)).isDirectory()) path += "/index.html";
    response.writeHead(200,{"Content-Type":mime[extname(path)]??"application/octet-stream","Cache-Control":"no-store"});
    response.end(await readFile(path));
  } catch { response.writeHead(404); response.end("Not found"); }
});
await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({channel:"chrome",headless:true});
await mkdir(output,{recursive:true});
try {
  for (const level of [0,1]) {
    const page=await browser.newPage(),errors=[];
    page.on("pageerror",error=>errors.push(error.message));
    page.on("console",message=>{if(message.text().startsWith("retinal-baseline-progress")) console.log(message.text());});
    const ticks=full?6000:3;
    await page.goto(`${base}/?level=${level}&ticks=${ticks}`);
    await page.waitForFunction(()=>window.retinalBaseline?.done,undefined,{timeout:full?2700000:180000});
    const result=await page.evaluate(()=>window.retinalBaseline);
    assert.equal(result.error,undefined,result.error);
    assert.deepEqual(errors,[]);
    assert.equal(result.report.exactCaptureControl,true);
    const report={mode:full?"measurement":"correctness-smoke",performanceAcceptance:false,
      concurrentLoadUncontrolled:true,browser:browser.version(),buildHash:identity.buildHash,
      ...result.report};
    // The report's run objects carry exact chunk hashes; full build files remain in build-identity.json.
    report.sourceIdentities=Object.fromEntries(["baseline","current"].map(name=>{const {files,...summary}=identity[name];return [name,summary];}));
    await writeFile(`${output}/level-${level}.json`,JSON.stringify(report,null,2)+"\n");
    console.log(JSON.stringify({level,ticks,mode:report.mode,exactCaptureControl:true,
      baselineProducerMs:result.report.baseline.producerMs,captureOnlyProducerMs:result.report.captureOnly.producerMs,
      finalProducerMs:result.report.final.producerMs,note:full?"Interpret with active neural work and timing boundaries":"Concurrent-load smoke; not performance evidence"}));
    await page.close();
  }
  await writeFile(`${output}/build-identity.json`,JSON.stringify(identity,null,2)+"\n");
} finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); }
