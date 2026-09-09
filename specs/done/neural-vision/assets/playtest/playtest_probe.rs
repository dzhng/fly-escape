//! Fixed campaign empty-placement comparison through unmodified Graph and Attempt.
use serde_json::{json,Value};
use sha2::{Digest,Sha256};
use sim::{attempt::*,Graph};
use std::{sync::Arc,time::Instant,fs};
fn hash(b:&[u8])->String{format!("{:x}",Sha256::digest(b))}
fn main()->Result<(),Box<dyn std::error::Error>>{
 let args:Vec<_>=std::env::args().collect();
 let content_bytes=fs::read(&args[2])?;
 let content:Value=serde_json::from_slice(&content_bytes)?;
 let level:LevelDef=serde_json::from_value(content["level"].clone())?;
 let tuning:AttemptTuning=serde_json::from_value(content["tuning"].clone())?;
 let manifest=fs::read_to_string(format!("{}/manifest.json",args[1]))?;
 let graph=Arc::new(Graph::from_bytes(&fs::read(format!("{}/graph.bin",args[1]))?,&manifest)?);
 let spec=Attempt::describe(&graph,&level,&tuning,"empty-seed42",42,16,&[])?;
 let start=Instant::now();
 let mut attempt=Attempt::new(graph.clone(),level.clone(),tuning.clone(),spec.clone())?;
 let initial=attempt.initial_bodies();
 let mut digest=Sha256::new();
 let mut checkpoints=vec![];
 loop {
  let frame=attempt.step()?.ok_or("no terminal frame")?;
  let bodies:Vec<_>=frame.flies.iter().map(|f|json!({"id":f.id,"inputPose":f.input_pose,"body":f.body,"events":f.events})).collect();
  let body_frame=json!({"tick":frame.tick,"flies":bodies});
  let bytes=serde_json::to_vec(&body_frame)?;
  digest.update((bytes.len() as u64).to_le_bytes());digest.update(bytes);
  if frame.tick%1000==0||frame.result.is_some(){eprintln!("{} tick {} elapsed {:.1}s",level.id,frame.tick,start.elapsed().as_secs_f64());checkpoints.push(body_frame);}
  if let Some(result)=frame.result{
   let report=json!({"revision":args[4],"contentHash":hash(&content_bytes),"content":content,"manifestHash":hash(manifest.as_bytes()),"graphHash":graph.manifest.graph_hash,"simulationBuildId":SIMULATION_BUILD_ID,"probeSourceHash":hash(include_bytes!("playtest_probe.rs")),"spec":spec,"initialBodies":initial,"bodyTrajectoryHash":format!("{:x}",digest.finalize()),"bodyTrajectoryHashScope":"Length-prefixed JSON of tick and each fly id, inputPose, complete BodyState and events on every frame. Excludes sensory/neural/display groups.","checkpoints":checkpoints,"result":result,"wallSeconds":start.elapsed().as_secs_f64(),"scope":"One fixed seed42, sixteen flies, empty placements, unmodified authored level/tuning, actual native Graph+Attempt to natural full completion; no claim about player feel or population balance."});
   let file=fs::OpenOptions::new().write(true).create_new(true).open(&args[3])?;serde_json::to_writer_pretty(file,&report)?;break;
  }
 }
 Ok(())
}
