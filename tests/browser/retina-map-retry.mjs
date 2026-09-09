import assert from "node:assert/strict";
import {chromium} from "playwright";
import {fileURLToPath} from "node:url";
import {readFile,writeFile} from "node:fs/promises";
const root=fileURLToPath(new URL("../..",import.meta.url));
const mapText=await readFile(`${root}/data/processed/brain/retinal-map.json`,"utf8");
const browser=await chromium.launch({channel:"chrome",headless:true});
try {
  const results=[];
  for(const failure of ["json","profile","native-map"]) {
    const page=await browser.newPage(); let requests=0;
    const bad=JSON.parse(mapText);
    if(failure==="profile") bad.profile.capture.width=64;
    if(failure==="native-map") bad.version=-1;
    await page.route("**/brain/retinal-map.json",route=>{
      requests++;
      return route.fulfill({contentType:"application/json",body:requests===1 ? failure==="json" ? "not-json" : JSON.stringify(bad) : mapText});
    });
    await page.goto(process.env.BRAIN_URL ?? "http://127.0.0.1:5173");
    const result=await page.evaluate(async ({root,failure})=>{
      const {AttemptClient}=await import(`/@fs${root}/packages/sim-client/src/attempt-client.ts`);
      const {campaignLevels}=await import("/src/campaign-content.ts");
      const c=campaignLevels[0],input={attemptId:failure,rootSeed:"42",flyCount:2,level:{...c.level,durationTicks:1,spawn:{...c.level.spawn,flyingCount:1}},tuning:c.tuning,placements:[]};
      const authoring={roomFloors:c.roomFloors,roomDetails:c.roomDetails,lighting:c.lighting};
      return await new Promise((resolve,reject)=>{
        let firstError;
        const timeout=setTimeout(()=>finish(reject,Error("Map retry deadline")),15000);
        const finish=(fn,value)=>{clearTimeout(timeout);client.dispose();fn(value);};
        const client=new AttemptClient(reply=>{
          if(reply.type==="error") {
            if(firstError) return finish(reject,Error(reply.message));
            firstError=reply.message;
            client.start({...input,attemptId:`${failure}-retry`},authoring);
          }
          if(reply.type==="complete") finish(resolve,{failure,firstError,recovered:true});
        });
        client.start(input,authoring);
      });
    },{root,failure});
    assert.equal(requests,2);assert.equal(result.recovered,true);results.push({...result,requests});
    await page.close();
  }
  await writeFile("/tmp/retina-map-retry.json",JSON.stringify(results,null,2)+"\n");
  console.log(JSON.stringify(results));
} finally {await browser.close();}
