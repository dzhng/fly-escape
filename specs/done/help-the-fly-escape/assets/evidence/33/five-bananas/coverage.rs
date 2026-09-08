use sim::{attempt::LevelDef, placement::{Placement,resolve_placements}, environment::{FieldSet,Point}, sensory::{cue_currents,CuePathway},Graph};
use serde::Deserialize;
use serde_json::json;
#[derive(Deserialize)] struct Content {level:LevelDef,reference:Vec<Placement>}
fn main()->Result<(),Box<dyn std::error::Error>> {
 let args:Vec<String>=std::env::args().collect();
 let c:Content=serde_json::from_str(&std::fs::read_to_string(&args[1])?)?;
 let graph=Graph::from_bytes(&std::fs::read(format!("{}/graph.bin",args[2]))?,&std::fs::read_to_string(format!("{}/manifest.json",args[2]))?)?;
 let placements=[vec![],vec![c.reference[0].clone()],c.reference.clone()];
 let mut fields=placements.iter().map(|p|{let r=resolve_placements(&c.level,p)?;FieldSet::new(c.level.geometry.clone(),r.field_config,r.sources,c.level.exit_cue.clone())}).collect::<Result<Vec<_>,String>>()?;
 let mut rows=vec![];
 for tick in 1..=6000 {
  for f in &mut fields {f.advance(0.1)?;}
  if ![300,3000,6000].contains(&tick) {continue;}
  for room in &c.level.geometry.rooms {
   let mut n=0u32;let mut detected=[0u32;3];let mut newly_detected=[0u32;3];let mut changed=[0u32;3];let mut stronger=[0u32;3];
   let mut x=room.min.x+0.2;
   while x<room.max.x {let mut z=room.min.z+0.2;while z<room.max.z {
    let p=Point{x,z};if c.level.geometry.contains_body(p,c.level.body_config.body_radius) {
     for h in 0..16 {let heading=h as f64*std::f64::consts::TAU/16.;let currents=fields.iter().map(|f|cue_currents(&graph,&f.sample(p,heading,tick),CuePathway::ExcitatoryOdor,2.)).collect::<Result<Vec<_>,String>>()?;
      let active:Vec<_>=currents.iter().map(|v|v.iter().filter(|(_,value)|*value>0.).cloned().collect::<Vec<_>>()).collect();n+=1;
      let base_total:f64=active[0].iter().map(|(_,v)|v).sum();
      for i in 0..3 {detected[i]+=u32::from(!active[i].is_empty());newly_detected[i]+=u32::from(active[0].is_empty()&&!active[i].is_empty());changed[i]+=u32::from(active[i]!=active[0]);stronger[i]+=u32::from(!active[0].is_empty()&&active[i].iter().map(|(_,v)|v).sum::<f64>()>base_total);}
     }
    }z+=0.4;}x+=0.4;}
   rows.push(json!({"tick":tick,"room":room.id,"sampleCount":n,"detectedNoneOneFive":detected,"newlyDetectedVsNone":newly_detected,"changedInputVsNone":changed,"strongerAlreadyDetectedVsNone":stronger}));
  }
 }
 std::fs::write(&args[3],serde_json::to_string_pretty(&rows)?)?;Ok(())
}
