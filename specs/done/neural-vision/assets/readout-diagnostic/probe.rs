//! Exploratory DNp03 observation only; no input, neural or motor changes.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    environment::{FieldConfig, FieldSet, Geometry, Point, RectRoom, Source, SourceKind},
    sensory::{cue_currents, CuePathway},
    Brain, Graph, LifParams,
};
use std::{fs, path::Path, sync::Arc, time::Instant};
fn hash(b: &[u8]) -> String {
    format!("{:x}", Sha256::digest(b))
}
fn stats(xs: &[f64]) -> Value {
    assert_eq!(xs.len(), 6);
    let mean = xs.iter().sum::<f64>() / 6.;
    let se = (xs.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / 5. / 6.).sqrt();
    let ci = [mean - 2.57058183661474 * se, mean + 2.57058183661474 * se];
    json!({"n":6,"mean":mean,"standardError":se,"ci95":ci,"absoluteT":if se>0. {Some(mean.abs()/se)}else{None},"excludesZero":ci[0]>0.||ci[1]<0.,"seedDifferences":xs})
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 2 {
        return Err("pass output directory containing anatomy-and-paths.json".into());
    }
    let out = Path::new(&args[1]);
    let anatomy: Value = serde_json::from_slice(&fs::read(out.join("anatomy-and-paths.json"))?)?;
    let bytes = fs::read("data/processed/brain/graph.bin")?;
    let manifest: Value = serde_json::from_slice(&fs::read("data/processed/brain/manifest.json")?)?;
    assert_eq!(hash(&bytes), anatomy["graphHash"]);
    let started = Instant::now();
    let mut candidates = vec![];
    for family in ["Tm2", "Tm20"] {
        let map_bytes = fs::read(format!(
            "specs/neural-vision/assets/input-map/{family}.json"
        ))?;
        let mapping: Value = serde_json::from_slice(&map_bytes)?;
        assert_eq!(hash(&map_bytes), anatomy["families"][family]["mappingHash"]);
        let mut m = manifest.clone();
        m["visionInput"] = mapping;
        let graph = Arc::new(Graph::from_bytes(&bytes, &serde_json::to_string(&m)?)?);
        let dn: [usize; 2] = ["10752", "10989"].map(|body| {
            graph
                .manifest
                .body_ids
                .iter()
                .position(|b| b == body)
                .unwrap()
        });
        assert_eq!(dn, [636, 837]);
        let mut conditions = vec![];
        for (name, z) in [("lamp-left", -1.), ("lamp-right", 1.)] {
            let g = Geometry {
                rooms: vec![RectRoom {
                    id: 0,
                    min: Point { x: -4., z: -4. },
                    max: Point { x: 4., z: 4. },
                }],
                walls: vec![],
                solids: vec![],
            };
            let fields = FieldSet::new(
                g,
                FieldConfig {
                    baseline_brightness: 0.,
                    ..Default::default()
                },
                vec![Source {
                    position: Point { x: 0., z },
                    radius: 3.,
                    rate: 1.,
                    kind: SourceKind::Lamp,
                }],
                None,
            )?;
            let sample = fields.sample(Point::default(), 0., 0);
            let currents = cue_currents(&graph, &sample, CuePathway::Vision, 2.)?;
            assert!(!currents.iter().any(|(i, _)| dn.contains(&(*i as usize))));
            let mut observations = vec![];
            for seed in 1..=6 {
                let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, 0));
                for _ in 0..60 {
                    brain.step();
                }
                brain.set_external_current(&currents)?;
                let mut voltage = [0.; 2];
                let mut spikes = [0.; 2];
                let mut flight_turn = 0.;
                let mut turn = 0.;
                for _ in 0..100 {
                    let result = brain.step();
                    flight_turn += result.motor.flight_turn;
                    turn += result.motor.turn;
                    for j in 0..2 {
                        voltage[j] += brain.voltage()[dn[j]];
                        spikes[j] += f64::from(brain.spikes()[dn[j]]);
                    }
                }
                for x in voltage.iter_mut().chain(&mut spikes) {
                    *x /= 100.;
                }
                observations.push(json!({"seed":seed,"leftMeanVoltage":voltage[0],"rightMeanVoltage":voltage[1],"leftSpikeFraction":spikes[0],"rightSpikeFraction":spikes[1],"rightMinusLeftVoltage":voltage[1]-voltage[0],"leftMinusRightVoltage":voltage[0]-voltage[1],"flightTurn":flight_turn/100.,"turn":turn/100.}));
            }
            conditions.push(json!({"name":name,"sample":sample,"currentsHash":hash(&serde_json::to_vec(&currents)?),"totalCurrent":currents.iter().map(|(_,v)|v).sum::<f64>(),"observations":observations}));
        }
        let metrics = [
            "rightMinusLeftVoltage",
            "leftMinusRightVoltage",
            "leftMeanVoltage",
            "rightMeanVoltage",
            "leftSpikeFraction",
            "rightSpikeFraction",
            "flightTurn",
            "turn",
        ];
        let mut comparisons = serde_json::Map::new();
        for metric in metrics {
            let a = conditions[0]["observations"].as_array().unwrap();
            let b = conditions[1]["observations"].as_array().unwrap();
            let differences: Vec<_> = a
                .iter()
                .zip(b)
                .map(|(a, b)| {
                    assert_eq!(a["seed"], b["seed"]);
                    a[metric].as_f64().unwrap() - b[metric].as_f64().unwrap()
                })
                .collect();
            comparisons.insert(metric.into(), stats(&differences));
        }
        let primary = comparisons["rightMinusLeftVoltage"].clone();
        let report = json!({"family":family,"gain":2,"mode":"exploratory-readout-diagnostic","conditions":conditions,"pairedLampLeftMinusLampRight":comparisons,"pair":anatomy["pair"],"pathEvidence":anatomy["families"][family],"annotationHash":anatomy["annotationHash"],"graphHash":hash(&bytes),"mappingHash":hash(&map_bytes),"probeSourceHash":hash(include_bytes!("neural_vision_readout_diagnostic.rs")),"lifSourceHash":hash(include_bytes!("../src/lif.rs")),"sensorySourceHash":hash(include_bytes!("../src/sensory.rs")),"lifParams":LifParams::default(),"warmupTicks":60,"measureTicks":100,"pose":{"position":{"x":0,"z":0},"heading":0},"scope":"Same exploratory seeds as the failed pilot. Primary cell-pair metric is DNp03 right-minus-left mean voltage; paired contrast is lamp-left minus lamp-right. Opposite voltage sign is also retained explicitly. This observes the unchanged existing decoder; no held-out or biological effectiveness claim."});
        fs::write(
            out.join(format!("{family}.json")),
            serde_json::to_vec_pretty(&report)?,
        )?;
        candidates.push(json!({"family":family,"gain":2,"population":anatomy["families"][family]["inputCount"],"mappingHash":hash(&map_bytes),"metric":"DNp03-rightMinusLeftVoltage","pairedLampLeftMinusLampRight":primary}));
        eprintln!(
            "{family} complete in {:.1}s",
            started.elapsed().as_secs_f64()
        );
    }
    candidates.sort_by(|a, b| {
        b["pairedLampLeftMinusLampRight"]["absoluteT"]
            .as_f64()
            .unwrap_or(0.)
            .total_cmp(
                &a["pairedLampLeftMinusLampRight"]["absoluteT"]
                    .as_f64()
                    .unwrap_or(0.),
            )
            .then(a["population"].as_u64().cmp(&b["population"].as_u64()))
    });
    let selected = candidates
        .iter()
        .find(|x| x["pairedLampLeftMinusLampRight"]["excludesZero"] == true)
        .cloned();
    let summary = json!({"candidates":candidates,"eligibleReadoutCandidate":selected,"rule":"Exactly Tm2/Tm20 gain2 seeds1..6. DNp03 paired-voltage CI must exclude zero; rank eligible candidates by absolute t, ties smaller population. No runtime modification or held-out confirmation performed.","elapsedSeconds":started.elapsed().as_secs_f64()});
    fs::write(
        out.join("summary.json"),
        serde_json::to_vec_pretty(&summary)?,
    )?;
    println!("{}", serde_json::to_string(&summary)?);
    Ok(())
}
