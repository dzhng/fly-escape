import { chromium } from 'playwright';
import { mkdir, writeFile, realpath, readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const moduleRoot = `/@fs${await realpath('.')}`;
const landingOnly=process.env.MOTION_SCOPE==='landing';
const output = process.env.MOTION_EVIDENCE_DIR ?? '/tmp/fly-motion-context';
await mkdir(output, {recursive:true});
const browser = await chromium.launch({channel:'chrome',headless:true});
const page = await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('response',r=>{if(r.status()>=400)console.error(r.status(),r.url());});
page.on('pageerror',error=>errors.push(String(error)));
try {
  await page.route('**/motion-context', route=>route.fulfill({contentType:'text/html',body:'<style>body{margin:0;background:#f6f5eb;color:#24443a;font:18px system-ui}header{padding:20px;height:60px}#world{height:800px;width:1440px}</style><header>Recorded lifecycle motion context <span id="phase"></span></header><div id="world"></div>'}));
  await page.goto(`${process.env.BRAIN_URL ?? 'http://127.0.0.1:5207'}/motion-context`);
  const recorded = await page.evaluate(async({moduleRoot})=>{
    const {BrainClient}=await import(`${moduleRoot}/packages/sim-client/src/index.ts`);
    const records = await new Promise((resolve,reject)=>{
      let info;const frames=[];
      const brain=new BrainClient(reply=>{
        if(reply.type==='error'){brain.dispose();reject(Error(reply.message));}
        if(reply.type==='lifecycleReady'){info=reply.info;brain.step();}
        if(reply.type==='lifecycleFrame'){
          frames.push(reply.frame);
          if(reply.frame.result || frames.length===300){brain.dispose();resolve({info,frames});}
          else brain.step();
        }
      });
      brain.startLifecycle(6,'mealThenStarvation');
    });
    const {WorldView,loadFlyModel,flyAnimation}=await import(`${moduleRoot}/packages/game-renderer/src/index.ts`);
    const model=await loadFlyModel(await (await fetch(`${moduleRoot}/assets/fly/fly.glb`)).arrayBuffer());
    const view = new WorldView(document.getElementById('world'),records.info.level.geometry);
    view.setFlyModel(model);
    // Native model inspection uses the game presentation, without the lifecycle lab's oversized C marker.
    view.setContactGeometry(records.info.food,records.info.level.zappers,records.info.level.exit,false);

    // Captures sample actual resulting modes and poses; no injected motor inputs.
    const motionAt = tick=>{
      let mode='walking',startedTick=0,terminal;
      for(const frame of records.frames){
        if(frame.tick>tick)break;
        const body=frame.flies[0].body;
        if(body.mode!==mode){mode=body.mode;startedTick=frame.tick;}
        if(body.outcome && terminal===undefined) terminal=frame.tick;
      }
      return {mode,startedTick,cursorTick:Math.min(tick,terminal??tick)};
    };
    window.context={records,view,motionAt};
    window.draw=(tick)=>{
      const lower=records.frames.find(f=>f.tick===Math.floor(tick));
      const upper=records.frames.find(f=>f.tick===Math.floor(tick)+1)??lower;
      const a=lower.flies[0].body.pose,b=upper.flies[0].body.pose,alpha=tick-Math.floor(tick);
      const motion=motionAt(tick);
      const y=lower.flies[0].body.height+(upper.flies[0].body.height-lower.flies[0].body.height)*alpha;
      view.setPose({x:a.position.x+(b.position.x-a.position.x)*alpha,z:a.position.z+(b.position.z-a.position.z)*alpha,heading:a.heading+Math.atan2(Math.sin(b.heading-a.heading),Math.cos(b.heading-a.heading))*alpha,y,animation:flyAnimation(motion,0.1)});
      view.render();
      document.getElementById('phase').textContent=` · tick ${tick.toFixed(2)} · ${motion.mode} · height ${y.toFixed(3)}`;
      return {...motion,y,animation:flyAnimation(motion,0.1)};
    };
    const food=records.frames.find(f=>f.flies[0].body.mode==='feeding');
    window.draw((food ?? records.frames[0]).tick);view.selectFly(0);view.zoomClose();view.render();
    return records;
  },{moduleRoot});
  await writeFile(`${output}/recorded-lifecycle.json`,JSON.stringify(recorded,null,2));
  const feeding=recorded.frames.filter(f=>f.flies[0].body.mode==='feeding');
  if(!landingOnly) assert.ok(feeding.length>0,'actual lifecycle produces feeding');
  const transitions=recorded.frames.filter((f,i)=>i>0&&f.flies[0].body.mode==='landing'&&recorded.frames[i-1].flies[0].body.mode==='flying');
  const completeLanding=transitions.find(f=>recorded.frames.some(next=>next.tick>f.tick&&next.tick<=f.tick+9&&next.flies[0].body.mode==='walking'));
  assert.ok(completeLanding,'actual lifecycle contains uninterrupted landing');
  const captures=[];
  for(const [name,start] of (landingOnly?[['land',completeLanding.tick]]:[['feed',feeding[0].tick],['land',completeLanding.tick]])){
    for(const delta of [-0.1,0,1,2,4,6,8]){
      const tick=start+delta;
      if(tick>recorded.frames.at(-1).tick)continue;
      {
        const state=await page.evaluate(tick=>window.draw(tick),tick);
        const stem=`${name}-${delta}-recorded`;
        await page.screenshot({path:`${output}/${stem}.png`});
        await page.screenshot({path:`${output}/${stem}-crop.png`,clip:{x:520,y:320,width:420,height:460}});
        captures.push({stem,tick,state});
      }
    }
    const tick=start+0.5;
    await page.evaluate(t=>window.draw(t),tick);
    const expected=await page.locator('canvas').screenshot();
    await page.waitForTimeout(100);
    assert.deepEqual(await page.locator('canvas').screenshot(),expected,'pause');
    await page.evaluate(t=>window.draw(t),start+2);
    await page.evaluate(t=>window.draw(t),tick);
    assert.deepEqual(await page.locator('canvas').screenshot(),expected,'reverse');
  }
  const strip=await browser.newPage({viewport:{width:2940,height:490}});
  for(const name of (landingOnly?['land']:['feed','land']))for(const version of ['recorded']){
    const cells=await Promise.all(captures.filter(c=>c.stem.startsWith(`${name}-`) && c.stem.endsWith(`-${version}`)).map(async c=>`<div><label>tick ${c.tick} · ${c.state.animation.clip} · y=${c.state.y.toFixed(3)}</label><img src="data:image/png;base64,${(await readFile(`${output}/${c.stem}-crop.png`)).toString('base64')}"></div>`));
    await strip.setContent(`<style>body{margin:0;display:flex;background:#f6f5eb;font:18px system-ui}div{width:420px;flex-shrink:0}label{display:block;height:30px}img{display:block}</style>${cells.join('')}`);
    await strip.screenshot({path:`${output}/sequence-${name}-${version}.jpg`});
  }
  await strip.close();
  assert.deepEqual(errors,[]);
  await writeFile(`${output}/report.json`,JSON.stringify({provenance:'BrainClient LifecycleSession seed 6 mealThenStarvation, real graph, core-recorded vertical movement',pauseAndReverseCanvasIdentical:true,captures,landingTransitions:transitions.map(f=>f.tick),errors},null,2));
}finally{await browser.close();}
