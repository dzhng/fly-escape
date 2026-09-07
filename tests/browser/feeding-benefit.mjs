import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const output = process.env.FEEDING_OUTPUT ?? '/tmp/feeding-benefit-evidence';
const surface = process.env.FEEDING_SURFACE ?? 'flat';
assert.ok(['flat', 'banana'].includes(surface), 'FEEDING_SURFACE must be flat or banana');
await mkdir(output, {recursive:true});
const browser = await chromium.launch({headless:true,channel:'chrome'});
const page = await browser.newPage();
try {
  await page.goto((process.env.BRAIN_URL ?? 'http://127.0.0.1:5173') + '/@fs'+fileURLToPath(new URL('./feeding-benefit.html',import.meta.url)));
  const report = await page.evaluate(async ({root,count,surface}) => {
    const {BrainClient} = await import(`${root}/index.ts`);
    const {AttemptClient} = await import(`${root}/attempt-client.ts`);
    const {FrameArchive} = await import(`${root}/record.ts`);
    const info = await new Promise((resolve,reject)=> {
      const client = new BrainClient(reply=> {
        if(reply.type==='lifecycleReady') {clearTimeout(timeout);client.dispose();resolve(reply.info);}
        if(reply.type==='error') {clearTimeout(timeout);client.dispose();reject(Error(reply.message));}
      });
      const timeout=setTimeout(()=>{client.dispose();reject(Error('Lifecycle fixture timed out after 30 seconds'));},30_000);
      client.startLifecycle(6,'mealThenStarvation');
    });
    const arms=[];
    for(const feedingRate of [3,0]) {
      const level=structuredClone(info.level);
      level.bodyConfig.feedingRate=feedingRate;
      if(surface==='banana') {
        level.food=[];
        level.fixedObjects=[{id:1,kind:'banana',position:{x:0.33,z:0.18},heading:0}];
      }
      level.spawn.states=Array.from({length:count},()=>structuredClone(info.level.spawn.states[0]));
      const input={attemptId:`feeding-${feedingRate}`,rootSeed:'6',flyCount:count,level,tuning:{cues:[],tasteGain:1,silencedNeurons:[]},placements:[]};
      const arm = await new Promise((resolve,reject)=> {
        let archive,ready;
        const client = new AttemptClient(reply=> {
          if(reply.type==='ready') {ready=reply.info;archive=new FrameArchive(ready.spec,ready.recordLayout,ready.archiveBytes,ready.initialBodies);}
          if(reply.type==='frames') archive.append(reply.chunk);
          if(reply.type==='error' || reply.type==='complete') {
            clearTimeout(timeout);
            const frames=[];
            if(archive) for(let tick=1;tick<=archive.computedTick;tick++) frames.push(archive.frame(tick));
            client.dispose();resolve({input,ready,frames,error:reply.type==='error'?reply.message:null});
          }
        });
        const timeout=setTimeout(()=>{
          client.dispose();
          reject(Error(`${input.attemptId} timed out after 120 seconds at recorded tick ${archive?.computedTick ?? 0}`));
        },120_000);
        client.start(input);
      });
      arms.push(arm);
    }
    return {fixture:info,arms};
  }, {root:'/@fs'+fileURLToPath(new URL('../../packages/sim-client/src',import.meta.url)),count:Number(process.env.FLY_COUNT ?? 1),surface});
  await writeFile(output+'/browser.json',JSON.stringify({browser:browser.version(),...report}));
  const [enabled,disabled]=report.arms;
  assert.equal(enabled.error,null); assert.equal(disabled.error,null);
  const normalized=arm=>{const input=structuredClone(arm.input);delete input.attemptId;input.level.bodyConfig.feedingRate=0;return input;};
  assert.deepEqual(normalized(enabled),normalized(disabled));
  assert.deepEqual(enabled.ready.resolvedSetup,disabled.ready.resolvedSetup);
  assert.deepEqual(enabled.ready.initialBodies,disabled.ready.initialBodies);
  const rows=[];
  for(let id=0;id<enabled.input.flyCount;id++) {
    const metrics=arm=> {
      let previous=arm.input.level.initialReserve,gain=0;const starts=[];let terminal;
      for(const frame of arm.frames) {
        const fly=frame.flies[id]; gain+=Math.max(0,fly.body.reserve-previous);previous=fly.body.reserve;
        for(const event of fly.events) {
          if(event.kind.type==='feedingStarted') {
            const spikeFraction=fly.neural.groups.find(g=>g.id==='proboscis').spikeFraction;
            assert.ok(spikeFraction>arm.input.level.bodyConfig.proboscisThreshold);
            // Coplanar food can be touched while the floor remains support (null).
            assert.equal(fly.body.mode,'feeding');
            assert.ok(arm.ready.resolvedSetup.state.food.length>0);
            if(surface==='banana') {
              assert.ok(arm.ready.resolvedSetup.state.food.some(food=>food.id===fly.body.support));
              assert.ok(fly.body.height>0, 'the meal occurs on the raised native fruit');
            }
            starts.push({tick:frame.tick,support:fly.body.support,height:fly.body.height,spikeFraction});
          }
          if(event.kind.type==='terminal') terminal={tick:frame.tick,outcome:event.kind.outcome};
        }
      }
      assert.equal(terminal?.outcome,'starved');
      return {gain,starts,terminal};
    };
    const a=metrics(enabled),b=metrics(disabled);
    assert.equal(b.gain,0);assert.deepEqual(a.starts,b.starts);
    for(let i=0;i<Math.min(enabled.frames.length,disabled.frames.length);i++) {
      const x=enabled.frames[i].flies[id],y=disabled.frames[i].flies[id];
      if(!x.neural||!y.neural) break;
      for(const key of ['neural','sensory','inputPose']) assert.deepEqual(x[key],y[key]);
    }
    rows.push({flyId:id,enabled:a,disabled:b,lifetimeDeltaTicks:a.terminal.tick-b.terminal.tick});
    if(a.starts.length) {assert.ok(a.gain>0);assert.ok(a.terminal.tick>b.terminal.tick);}
    else {assert.equal(a.gain,0);assert.equal(a.terminal.tick,b.terminal.tick);}
  }
  assert.ok(rows[0].enabled.gain>0.5,'selected seed6 demonstrates an actual neural meal');
  const deltas=rows.map(r=>r.lifetimeDeltaTicks).sort((a,b)=>a-b);
  const summary={browser:browser.version(),spec:enabled.ready.spec,foodSurface:surface,
    matchedInputsExceptFeedingRate:true,identicalFoodAndFields:true,activeNeuralSensoryAndInputPosesEqual:true,
    fedCount:rows.filter(r=>r.enabled.starts.length).length,
    medianLifetimeDeltaTicks:(deltas[Math.floor((deltas.length-1)/2)]+deltas[Math.floor(deltas.length/2)])/2,flies:rows};
  await writeFile(output+'/summary.json',JSON.stringify(summary,null,2)+'\n');
  console.log(JSON.stringify({fed:summary.fedCount,count:rows.length,medianLifetimeDeltaTicks:summary.medianLifetimeDeltaTicks}));

} finally {await browser.close();}
