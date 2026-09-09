// Input-only proposal: real depth occlusion, with no Brain construction or neural measurements.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../../../",import.meta.url)).replace(/\/$/,"");
const output = fileURLToPath(new URL(".",import.meta.url));
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const board = {position:[5.4,.9,2.55],size:[.02,1.8,1.2],color:0xffffff};
const blocker = {position:[4.79,1.05,2.55],size:[.02,2.1,.9],color:0};
const pose = {position:[4.55,0,2.55],rotation:[0,Math.sin(Math.PI/4),0,Math.cos(Math.PI/4)]};
const mapping = JSON.parse(await readFile(`${root}/data/processed/brain/retinal-map.json`,"utf8"));
const design = {mapHash:hash(await readFile(`${root}/data/processed/brain/retinal-map.json`)),profileIdentities:mapping.identities,status:"input-only; no new neural run or seed freeze",pose,board,blocker,
  rule:"One fixed nearer view of the existing doorway; same white board and authored room lighting, with only a black doorway blocker added.",
  chosenBeforeCapture:true};
await writeFile(`${output}/design.json`,JSON.stringify(design,null,2)+"\n");
const browser = await chromium.launch({channel:"chrome",headless:true});
try {
  const page = await browser.newPage(); const errors=[];
  page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`${process.env.RETINA_URL ?? "http://127.0.0.1:5174"}/retina`);
  await page.waitForSelector('[data-retina-ready="true"]');
  const cases=await page.evaluate(async ({root,pose,board,blocker})=>{
    const {RetinaProjection,retinaProfile}=await import(`/@fs${root}/packages/game-renderer/src/retina-projection.ts`);
    const projection=new RetinaProjection(retinaProfile);
    const worker=new Worker("/src/retina-worker.ts",{type:"module"});
    const request=message=>new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error("Capture deadline")),30000);
      worker.onmessage=({data})=>{clearTimeout(timer);data.type==="error"?reject(Error(data.message)):resolve(data);};
      worker.onerror=event=>{clearTimeout(timer);reject(Error(event.message));};worker.postMessage(message);
    });
    const png=pixels=>{const canvas=document.createElement("canvas");canvas.width=canvas.height=128;canvas.getContext("2d").putImageData(new ImageData(pixels,128,128),0,0);return canvas.toDataURL().split(",")[1];};
    try {
      const result=[];
      for(const blocked of [false,true]) {
        const ready=await request({type:"start",landmarks:false,stimuli:blocked?[board,blocker]:[board]});
        const frame=await request({type:"capture",poses:[pose],cameraImages:true});
        const repeat=await request({type:"capture",poses:[pose]});
        if(frame.samples.some((v,i)=>v!==repeat.samples[i]))throw Error("Identical capture changed RGB");
        result.push({name:blocked?"floor-blocker":"floor-opening",sceneId:ready.sceneId,gpu:ready.gpu,profile:ready.profile,
          oracleMaxByteDifference:frame.oracleMaxByteDifference,samples:Array.from(frame.samples),
          images:[0,1].flatMap(eye=>[png(projection.image(frame.samples.subarray(eye*2163,(eye+1)*2163))),png(frame.cameraImages[eye])])});
      }
      return result;
    } finally {worker.terminate();}
  },{root,pose,board,blocker});
  for(const item of cases) {
    assert.ok(!/SwiftShader|llvmpipe|software/i.test(item.gpu));
    assert.ok(item.oracleMaxByteDifference<=1);
    const bytes=Buffer.from(item.samples);item.rgbSha256=hash(bytes);item.rgbPath=`${item.name}.rgb`;
    await writeFile(`${output}/${item.rgbPath}`,bytes);
    for(const [index,suffix]of ["L","L-camera","R","R-camera"].entries())await writeFile(`${output}/${item.name}-${suffix}.png`,Buffer.from(item.images[index],"base64"));
    delete item.images;
  }
  const changedSamples=cases[0].samples.reduce((n,_,index)=>index%3===0&&cases[0].samples.slice(index,index+3).some((v,c)=>v!==cases[1].samples[index+c])?n+1:n,0);
  assert.ok(changedSamples>0);assert.deepEqual(errors,[]);
  await writeFile(`${output}/capture.json`,JSON.stringify({browser:browser.version(),design,changedSamples,errors,cases},null,2)+"\n");
  console.log(JSON.stringify({changedSamples,cases:cases.map(c=>({name:c.name,hash:c.rgbSha256,oracle:c.oracleMaxByteDifference}))}));
} finally {await browser.close();}
