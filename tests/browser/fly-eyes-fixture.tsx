import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AttemptPlayback } from "../../apps/web/src/playback";
import { AttemptClient, type AttemptInfo, type AttemptReply, type RetinaBatch, type StartAttempt } from "../../packages/sim-client/src";
import type { TransferChunk } from "../../packages/sim-client/src/record";
import "../../apps/web/src/style.css";
import "../../apps/web/src/setup.css";

type Bundle = {info:AttemptInfo;request:StartAttempt;chunks:TransferChunk[];expected:(RetinaBatch & {tick:number})[];metrics:{wasmHighWater:number}};
declare global {interface Window {eyeFixture:Bundle;}}
let sequence=0;
async function recordedFixture():Promise<Bundle>{
 const worker=new Worker(new URL("./retina-record-worker.mjs",import.meta.url),{type:"module"});
 const bundle:Partial<Bundle>={chunks:[]};const palette=sequence++;
 return await new Promise((resolve,reject)=>{
  const deadline=setTimeout(()=>{worker.terminate();reject(Error("Fixture worker timed out"));},60000);
  worker.onerror=event=>{clearTimeout(deadline);worker.terminate();reject(Error(event.message));};
  worker.onmessage=({data})=>{
   if(data.type==="error"){clearTimeout(deadline);worker.terminate();reject(Error(data.message));}
   if(data.type==="info"){bundle.info=data.info;bundle.request=data.request;}
   if(data.type==="chunk")bundle.chunks!.push(data.chunk);
   if(data.type==="complete"){clearTimeout(deadline);worker.terminate();resolve({...bundle,expected:data.expected,metrics:data.metrics} as Bundle);}
  };
  worker.postMessage({flyCount:16,attemptId:`eye-fixture-${palette}`,palette});
 });
}
/** Replays the actual worker's finite fixture at the production transport boundary. */
class FixtureClient extends AttemptClient {
 private listener:(reply:AttemptReply)=>void=()=>{};
 private live=true;
 constructor(private bundle:Bundle){super(()=>{});}
 override setReceiver(listener:(reply:AttemptReply)=>void){this.listener=listener;}
 override start(input:StartAttempt){
  if(input.attemptId!==this.bundle.request.attemptId)throw Error("Fixture attempt mismatch");
  this.live=true;queueMicrotask(()=>{
   if(!this.live)return;
   const {info,chunks,metrics}=this.bundle;
   this.listener({type:"ready",attemptId:input.attemptId,info,loadMs:0,wasmBytes:metrics.wasmHighWater});
   for(const chunk of chunks){if(!this.live)return;const activeNeuralSteps=chunk.tickNeuralSteps.reduce((sum,n)=>sum+n,0);this.listener({type:"frames",attemptId:input.attemptId,chunk,metrics:{activeNeuralSteps,productionMs:1,wasmBytes:metrics.wasmHighWater}});}
   this.listener({type:"complete",attemptId:input.attemptId,result:chunks.at(-1)!.result!});
  });
 }
 override setHidden(){}
 override cancel(){this.live=false;}
}
function Fixture(){
 const [run,setRun]=useState<{bundle:Bundle;client:FixtureClient}>();
 const [loading,setLoading]=useState(false);const [error,setError]=useState("");
 const start=async()=>{setLoading(true);try{const bundle=await recordedFixture();window.eyeFixture=bundle;setRun({bundle,client:new FixtureClient(bundle)});}catch(error){setError(String(error));}finally{setLoading(false);}};
 if(run)return <AttemptPlayback key={run.bundle.request.attemptId} input={run.bundle.request} client={run.client} onReturn={()=>setRun(undefined)}/>;
 return <main><h1>Controlled recorded-eye fixture</h1><p>Actual native records with distinct controlled RGB inputs for all sixteen flies.</p><button disabled={loading} onClick={start}>{loading?"Loading fixture…":"Start fixture"}</button>{error&&<p role="alert">{error}</p>}</main>;
}
createRoot(document.getElementById("root")!).render(<Fixture/>);
