use sim::{Brain,Graph,chamber::Chamber,environment::*,sensory::{CuePathway,cue_currents},field_lab::{fixture,FieldScenario}};
use std::{sync::Arc,time::Instant};
use serde_json::{json,Value};
fn fields(scenario:FieldScenario,side:f64)->Result<FieldSet,String>{
 let (historical,_) = fixture(scenario,side)?;
 let kind=if matches!(scenario,FieldScenario::ExcitatoryOdor){SourceKind::RepellentOdor}else{SourceKind::AttractiveOdor};
 let mut f=FieldSet::new(historical.geometry().clone(),FieldConfig{baseline_brightness:0.2,..FieldConfig::default()},vec![Source{position:Point{x:-2.,z:-side},radius:0.75,rate:1.,kind}],None)?;
 for _ in 0..100{f.advance(0.1)?;}
 Ok(f)
}
fn summary(v:&[f64])->Value{
 let n=v.len() as f64;let mean=v.iter().sum::<f64>()/n;
 let sd=(v.iter().map(|x|(x-mean).powi(2)).sum::<f64>()/(n-1.)).sqrt();
 let half=2.045229642*sd/n.sqrt();
 json!({"mean":mean,"ci95":[mean-half,mean+half],"positiveSeeds":v.iter().filter(|x|**x>0.).count(),"negativeSeeds":v.iter().filter(|x|**x<0.).count()})
}
fn main()->Result<(),Box<dyn std::error::Error>>{
 let path="/Users/david/dev/fly-escape/data/processed/brain";
 let graph=Arc::new(Graph::from_bytes(&std::fs::read(format!("{path}/graph.bin"))?,&std::fs::read_to_string(format!("{path}/manifest.json"))?)?);
 let start=Instant::now();let mut arms=vec![];
 for (scenario,cue) in [(FieldScenario::InhibitoryOdor,CuePathway::InhibitoryOdor),(FieldScenario::ExcitatoryOdor,CuePathway::ExcitatoryOdor)]{
  for side in [1.,-1.]{
   let mut observations=vec![];
   for seed in 0..30{
    let mut pair=vec![];
    for active in [false,true]{
     let f=fields(scenario,side)?;
     let mut chamber=Chamber::with_fields(graph.clone(),Brain::seed_for_fly(seed,0),f,Some((if active{cue}else{CuePathway::None},2.)));
     let mut turn=0.;let mut flight_turn=0.;let mut detected=0;let mut first_current=None;let mut final_pose=None;
     for tick in 0..100{
      let frame=chamber.step()?;
      if cue_currents(&graph,&frame.sensory,cue,2.)?.iter().any(|(_,v)|*v>0.){detected+=1;if first_current.is_none(){first_current=Some(tick);}}
      turn+=frame.neural.motor.turn/100.;flight_turn+=frame.neural.motor.flight_turn/100.;final_pose=Some(frame.pose);
     }
     let p=final_pose.unwrap();let dx=-2.-p.x;let dz=-side-p.z;let distance=dx.hypot(dz);
     pair.push(json!({"active":active,"meanTurn":turn,"meanFlightTurn":flight_turn,"sourceSignedMeanTurn":-side*turn,"finalHeading":p.heading,"distanceReduction":1.-distance,"finalAlignment":(dx*p.heading.cos()+dz*p.heading.sin())/distance,"finalX":p.x,"finalZ":p.z,"detectedTicks":detected,"firstDetectedTick":first_current}));
    }
    observations.push(json!({"seed":seed,"control":pair[0],"active":pair[1]}));
   }
   let mut contrasts=serde_json::Map::new();
   for metric in ["meanTurn","meanFlightTurn","sourceSignedMeanTurn","distanceReduction","finalAlignment"]{
    contrasts.insert(metric.into(),summary(&observations.iter().map(|o|o["active"][metric].as_f64().unwrap()-o["control"][metric].as_f64().unwrap()).collect::<Vec<_>>()));
   }
   let item=json!({"scenario":scenario,"sourceZ":-side,"activeMinusMatchedNoCurrent":contrasts,"observations":observations});
   eprintln!("{:?} side {} at {:.1}s: {}",scenario,side,start.elapsed().as_secs_f64(),item["activeMinusMatchedNoCurrent"]);
   arms.push(item);
  }
 }
 let output=json!({"graphHash":graph.manifest.graph_hash,"brainWarmupTicks":0,"fieldSettleTicks":100,"measurementTicks":100,"gain":2,"seeds":30,"config":FieldConfig::default(),"sourceRadius":0.75,"sourceRate":1,"initialPosition":[-2,0],"sourceDistance":1,"elapsedSeconds":start.elapsed().as_secs_f64(),"arms":arms,"limitations":"Cold Brain initialization; existing field fixture geometry and existing Chamber/body owner. Anatomical FieldConfig default antenna span replaces historical fixture .15 offset. Each active condition paired against same-source no-current control with identical seed. Gain 2 only; settled field. Descriptive t(29) intervals, no multiple-testing adjustment; not a campaign performance or biology validation. Source-signed mean motor turn avoids erroneous heading integration in old field_probe. Endpoint heading is actual Chamber pose."});
 std::fs::write("/tmp/fly-cold-odor-probe/evidence.json",serde_json::to_string_pretty(&output)?)?;Ok(())
}
