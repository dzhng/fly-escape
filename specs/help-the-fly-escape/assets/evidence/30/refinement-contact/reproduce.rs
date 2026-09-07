use sim::{Graph,attempt::{Attempt,StartAttempt}};
use std::sync::Arc;
fn main()->Result<(),Box<dyn std::error::Error>>{
 let dir="/Users/david/dev/fly-escape/data/processed/brain";
 let graph=Arc::new(Graph::from_bytes(&std::fs::read(format!("{dir}/graph.bin"))?,&std::fs::read_to_string(format!("{dir}/manifest.json"))?)?);
 let a:StartAttempt=serde_json::from_str(&std::fs::read_to_string("/tmp/refinement-request.json")?)?;
 let spec=Attempt::describe(&graph,&a.level,&a.tuning,&a.attempt_id,a.root_seed.parse()?,a.fly_count,&a.placements)?;
 let mut attempt=Attempt::new(graph,a.level,a.tuning,spec)?;
 for tick in 1..=1000{
  match attempt.step(){
   Ok(Some(frame))=>{if tick%20==0{eprintln!("tick {tick}");}if let Some(result)=frame.result{println!("{}",serde_json::to_string(&result)?);break;}},
   Ok(None)=>break,
   Err(error)=>{eprintln!("FAILED tick {tick}: {error}");return Err(error.into());}
  }
 }
 Ok(())
}
