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
 let graph=Arc::new(Graph::from_bytes(&std::fs::read(format!("{path}/graph.bin"))?,&std::fs::read_to_string("/tmp/fly-dm1-probe/manifest.json")?)?);
 let start=Instant::now();let mut arms=vec![];
 let mut ids=graph.pathway("OLFACTORY_DN_LEFT").to_vec();
 ids.extend(graph.pathway("OLFACTORY_DN_RIGHT"));
 let turn_count=ids.len();
 ids.extend(graph.pathway("FLIGHT_DN_LEFT"));ids.extend(graph.pathway("FLIGHT_DN_RIGHT"));
 let mut traces=vec![]; let mut maximum_decoder_error:f64=0.;
 for gain in [2.]{
  let scenario=FieldScenario::InhibitoryOdor; let cue=CuePathway::InhibitoryOdor;
  for side in [1.,-1.]{
   let mut observations=vec![];
   for seed in 0..30{
    let mut pair=vec![];
    for active in [false,true]{
     let f=fields(scenario,side)?;
     let mut chamber=Chamber::with_fields(graph.clone(),Brain::seed_for_fly(seed,0),f,Some((if active{cue}else{CuePathway::None},gain)));
     let mut activity=std::collections::BTreeMap::<String,f64>::new(); let mut path_length=0.; let mut previous=(-2.,0.); let mut mean_thrust=0.; let mut turn=0.;let mut flight_turn=0.;let mut detected=0;let mut first_current=None;let mut final_pose=None;
     for tick in 0..100{
      let frame=chamber.step()?;
      let voltage:Vec<f64>=ids.iter().map(|&i|chamber.brain.voltage()[i as usize]).collect();
      let spikes:Vec<bool>=ids.iter().map(|&i|chamber.brain.spikes()[i as usize]).collect();
      let mean=|a:usize,b:usize|voltage[a..b].iter().sum::<f64>()/(b-a) as f64;
      let reconstructed_turn=mean(25,50)-mean(0,25);
      let reconstructed_flight_turn=(mean(59,68)-mean(50,59))*0.5+reconstructed_turn;
      let error=(frame.neural.motor.turn-reconstructed_turn).abs().max((frame.neural.motor.flight_turn-reconstructed_flight_turn).abs());
      maximum_decoder_error=maximum_decoder_error.max(error);
      if error!=0. {return Err(format!("decoder mismatch seed {seed} side {side} tick {tick}: {error}").into());}
      traces.push(json!({"seed":seed,"sourceZ":-side,"active":active,"tick":tick,"voltage":voltage,"spikes":spikes,"turn":frame.neural.motor.turn,"flightTurn":frame.neural.motor.flight_turn}));
      for g in &frame.neural.groups { if ["odorInhL","odorInhR","dm1PNL","dm1PNR","turnL","turnR","flightL","flightR"].contains(&g.id.as_str()) { *activity.entry(format!("{}MeanVoltage",g.id)).or_default() += g.mean_voltage/100.; *activity.entry(format!("{}SpikeFraction",g.id)).or_default() += g.spike_fraction/100.; } }
      path_length+=(frame.pose.x-previous.0).hypot(frame.pose.z-previous.1); previous=(frame.pose.x,frame.pose.z); mean_thrust+=frame.neural.motor.thrust/100.;
      if cue_currents(&graph,&frame.sensory,cue,gain)?.iter().any(|(_,v)|*v>0.){detected+=1;if first_current.is_none(){first_current=Some(tick);}}
      turn+=frame.neural.motor.turn/100.;flight_turn+=frame.neural.motor.flight_turn/100.;final_pose=Some(frame.pose);
     }
     let p=final_pose.unwrap();let dx=-2.-p.x;let dz=-side-p.z;let distance=dx.hypot(dz);
     pair.push(json!({"active":active,"activity":activity,"pathLength":path_length,"netDisplacement":(p.x+2.).hypot(p.z),"meanThrust":mean_thrust,"meanTurn":turn,"meanFlightTurn":flight_turn,"sourceSignedMeanTurn":-side*turn,"finalHeading":p.heading,"distanceReduction":1.-distance,"finalAlignment":(dx*p.heading.cos()+dz*p.heading.sin())/distance,"finalX":p.x,"finalZ":p.z,"detectedTicks":detected,"firstDetectedTick":first_current}));
    }
    observations.push(json!({"seed":seed,"control":pair[0],"active":pair[1]}));
   }
   let mut contrasts=serde_json::Map::new();
   for metric in ["meanTurn","meanFlightTurn","sourceSignedMeanTurn","distanceReduction","finalAlignment","pathLength","netDisplacement","meanThrust"]{
    contrasts.insert(metric.into(),summary(&observations.iter().map(|o|o["active"][metric].as_f64().unwrap()-o["control"][metric].as_f64().unwrap()).collect::<Vec<_>>()));
   }
   let mut absolute=serde_json::Map::new();
   for metric in ["sourceSignedMeanTurn","distanceReduction","finalAlignment","pathLength","netDisplacement","meanThrust"]{
    absolute.insert(metric.into(),summary(&observations.iter().map(|o|o["active"][metric].as_f64().unwrap()).collect::<Vec<_>>()));
   }
   let mut activity_contrasts=serde_json::Map::new();
   for metric in observations[0]["active"]["activity"].as_object().unwrap().keys(){activity_contrasts.insert(metric.clone(),summary(&observations.iter().map(|o|o["active"]["activity"][metric].as_f64().unwrap()-o["control"]["activity"][metric].as_f64().unwrap()).collect::<Vec<_>>()));}
   let item=json!({"gain":gain,"activityActiveMinusControl":activity_contrasts,"absoluteActive":absolute,"scenario":scenario,"sourceZ":-side,"activeMinusMatchedNoCurrent":contrasts,"observations":observations});
   eprintln!("gain {} side {} at {:.1}s: {}",gain,side,start.elapsed().as_secs_f64(),item["activeMinusMatchedNoCurrent"]);
   arms.push(item);
  }
 }
 let output=json!({"graphHash":graph.manifest.graph_hash,"brainWarmupTicks":0,"fieldSettleTicks":100,"measurementTicks":100,"gain":2,"seeds":30,"config":FieldConfig{baseline_brightness:0.2,..FieldConfig::default()},"sourceRadius":0.75,"sourceRate":1,"initialPosition":[-2,0],"sourceDistance":1,"elapsedSeconds":start.elapsed().as_secs_f64(),"arms":arms,"limitations":"Cold Brain initialization; existing field fixture geometry and existing Chamber/body owner. Anatomical FieldConfig default antenna span replaces historical fixture .15 offset. Each active condition paired against same-source no-current control with identical seed. DM1 ORN group substitution only at gain 2; settled field. Path length sums actual planar frame displacements; net displacement is endpoint distance from initial pose. Absolute active statistics accompany paired contrasts. Descriptive t(29) intervals, no multiple-testing adjustment; not a campaign performance or biology validation. Source-signed mean motor turn avoids erroneous heading integration in old field_probe. Endpoint heading is actual Chamber pose."});
 std::fs::write("/tmp/fly-dm1-time/trace.json",serde_json::to_string(&json!({"indices":ids,"turnCount":turn_count,"maximumDecoderError":maximum_decoder_error,"traces":traces}))?)?;
 std::fs::write("/tmp/fly-dm1-time/evidence.json",serde_json::to_string_pretty(&output)?)?;Ok(())
}
