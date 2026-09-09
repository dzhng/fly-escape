import { expect, test } from "bun:test";
import { appendPoses, packedHashes, poseTape, type Packed } from "./retinal-baseline-record";
const body = (id:number) => ({pose:{position:{x:id,z:-id},heading:.3},height:.2,rotation:[0,0,0,1] as [number,number,number,number],mode:"walking" as const,reserve:10,support:null,outcome:null});
const layout = {valueFields:["rotationW","z","x","rotationY","height","rotationX","rotationZ"],stateFields:["outcome"],groupIds:[],groupFields:[],outcomes:[null,"escaped" as const],maxChunkTicks:10};
function packed(): Packed {
  const values = new Float64Array(16*7);
  for(let id=0;id<16;id++) values.set([.8,3+id,1+id,.6,2,0,0],id*7);
  const states=new Uint32Array(16); states[2]=1;
  return {startTick:1,tickCount:1,flyCount:16,sequence:0,values,states,events:new Uint32Array([0,1]),
    motionOffsets:new Uint32Array([0,1]),motionValues:new Float64Array([.5]),motionStates:new Uint32Array([1]),tickNeuralSteps:new Uint32Array([16])};
}
test("pose tape preserves full initial transform and uses prior output with terminal exclusion",()=>{
  const tape=poseTape({spec:{flyCount:16,durationTicks:3},initialBodies:Array.from({length:16},(_,id)=>body(id))});
  expect(Array.from(tape.poses.subarray(7,14))).toEqual([1,.2,-1,0,0,0,1]);
  expect(tape.active[0]).toBe(65535);
  appendPoses(tape,layout,packed());
  expect(Array.from(tape.poses.subarray(16*7,16*7+7))).toEqual([1,2,3,0,.6,0,.8]);
  expect(tape.active[1]).toBe(65535^(1<<2));
  expect(tape.poses.byteLength+tape.active.byteLength).toBe(3*(16*7*8+2));
  const last=packed();last.startTick=3;
  appendPoses(tape,layout,last);
  expect(tape.active[2]).toBe(0);
  expect(()=>appendPoses(tape,layout,{...last,startTick:4})).toThrow("dimensions");
});
test("each original packed buffer and the header participates in exact equality",async()=>{
  const original=await packedHashes(packed());
  const names = ["values", "states", "events", "motionOffsets", "motionValues", "motionStates", "tickNeuralSteps"];
  expect(Object.keys(original).sort()).toEqual(["header", ...names].sort());
  for(const name of names) {
    const changed=packed(),buffer=changed[name] as Uint32Array;
    buffer[0]+=1;
    const hashes=await packedHashes(changed);
    expect(hashes[name]).not.toBe(original[name]);
    for(const other of Object.keys(original).filter(key=>key!==name)) expect(hashes[other]).toBe(original[other]);
  }
  expect((await packedHashes({...packed(),sequence:1})).header).not.toBe(original.header);
});
