//! Scratch read-only probe: fixed-input odor response in BOTH motor readouts.
//! No body integration, no production changes. Delete after the run.
use serde_json::{json, Value};
use sim::{
    environment::{FieldConfig, FieldSample, FieldSet, Point, SensorySample},
    sensory::{cue_currents, motor_readout_indices, CuePathway},
    Brain, Graph,
};
use std::{sync::Arc, time::Instant};

const TICKS: usize = 100;
const GAIN: f64 = 2.0;
const METRICS: [&str; 4] = ["turn", "thrust", "flightTurn", "flightThrust"];
const GROUPS: [&str; 8] = [
    "odorExcL", "odorExcR", "odorInhL", "odorInhR", "turnL", "turnR", "flightL", "flightR",
];

fn summary(v: &[f64]) -> Value {
    let n = v.len() as f64;
    let mean = v.iter().sum::<f64>() / n;
    let sd = (v.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.)).sqrt();
    let half = 2.045229642 * sd / n.sqrt(); // t(29), .95
    json!({"mean":mean,"sd":sd,"ci95":[mean-half,mean+half],
        "positiveSeeds":v.iter().filter(|x|**x>0.).count(),
        "negativeSeeds":v.iter().filter(|x|**x<0.).count(),
        "zeroSeeds":v.iter().filter(|x|**x==0.).count()})
}

/// Synthetic strong-contrast local sample; `strong_left` picks the intended side.
fn sample(pathway: CuePathway, strong_left: bool) -> SensorySample {
    let mut hi = FieldSample::default();
    let lo = FieldSample::default();
    match pathway {
        CuePathway::ExcitatoryOdor => hi.repellent_odor = 0.8,
        _ => hi.attractive_odor = 0.8,
    }
    let (left, right) = if strong_left { (hi, lo) } else { (lo, hi) };
    SensorySample { left, right, wind: Point::default() }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let (lo, hi): (u64, u64) = (args[1].parse()?, args[2].parse()?);
    let path = format!("{}/data/processed/brain", env!("CARGO_MANIFEST_DIR").trim_end_matches("/crates/sim"));
    let graph = Arc::new(Graph::from_bytes(
        &std::fs::read(format!("{path}/graph.bin"))?,
        &std::fs::read_to_string(format!("{path}/manifest.json"))?,
    )?);
    let start = Instant::now();

    // Convention record, measured not assumed.
    let fields = FieldSet::new(sim::chamber::chamber_geometry(), FieldConfig::default(), vec![], None)?;
    let at = |h: f64| fields.sample_points(Point { x: 0., z: 0. }, h);
    let turned = sim::body::desired_pose(
        sim::body::BodyPose { position: Point { x: 0., z: 0. }, heading: 0. },
        sim::body::Locomotion { thrust: 0., turn: 1., speed: 0.12, turn_gain: 8.0 },
        Point::default(),
        0.1,
    );
    let convention = json!({
        "antennaPointsHeading0":[[at(0.)[0].x,at(0.)[0].z],[at(0.)[1].x,at(0.)[1].z]],
        "antennaPointsHeading0p2":[[at(0.2)[0].x,at(0.2)[0].z],[at(0.2)[1].x,at(0.2)[1].z]],
        "headingAfterPositiveUnitTurn":turned.heading,
        "note":"sample[0]=SensorySample.left feeds *L groups; forward=(cos h,sin h)"
    });

    // Input counts after motor-group exclusion.
    let readouts = motor_readout_indices(&graph);
    let mut input_counts = serde_json::Map::new();
    for id in ["odorExcL", "odorExcR", "odorInhL", "odorInhR"] {
        let g = graph.manifest.groups.iter().find(|g| g.id == id).unwrap();
        input_counts.insert(id.into(), json!({
            "groupSize":g.indices.len(),
            "excludedAsMotorReadout":g.indices.iter().filter(|i|readouts.contains(i)).count(),
            "remaining":g.indices.iter().filter(|i|!readouts.contains(i)).count()}));
    }
    let group_ids = |id: &str| graph.manifest.groups.iter().find(|g| g.id == id).unwrap().indices.clone();
    let identity = json!({
        "graphHash":graph.manifest.graph_hash,
        "neuronCount":graph.neuron_count(),"edgeCount":graph.edge_count(),
        "motorReadoutIndexCount":readouts.len(),
        "turnLisOlfactoryDnLeft":group_ids("turnL")==graph.pathway("OLFACTORY_DN_LEFT"),
        "turnRisOlfactoryDnRight":group_ids("turnR")==graph.pathway("OLFACTORY_DN_RIGHT"),
        "flightLisFlightDnLeft":group_ids("flightL")==graph.pathway("FLIGHT_DN_LEFT"),
        "flightRisFlightDnRight":group_ids("flightR")==graph.pathway("FLIGHT_DN_RIGHT"),
    });

    let arms: Vec<(&str, CuePathway, bool)> = vec![
        ("control", CuePathway::None, true),
        ("excitatoryLeft", CuePathway::ExcitatoryOdor, true),
        ("excitatoryRight", CuePathway::ExcitatoryOdor, false),
        ("inhibitoryLeft", CuePathway::InhibitoryOdor, true),
        ("inhibitoryRight", CuePathway::InhibitoryOdor, false),
    ];
    let mut per_seed: Vec<Value> = vec![];
    for seed in lo..hi {
        let mut row = serde_json::Map::new();
        for (name, pathway, strong_left) in &arms {
            let currents = cue_currents(&graph, &sample(*pathway, *strong_left), *pathway, GAIN)?;
            let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, 0));
            brain.set_external_current(&currents)?;
            let (mut m, mut spikes) = ([0f64; 4], 0f64);
            let mut gv = vec![0f64; GROUPS.len()];
            let mut gs = vec![0f64; GROUPS.len()];
            for _ in 0..TICKS {
                let out = brain.step();
                let t = TICKS as f64;
                m[0] += out.motor.turn / t;
                m[1] += out.motor.thrust / t;
                m[2] += out.motor.flight_turn / t;
                m[3] += out.motor.flight_thrust / t;
                spikes += f64::from(out.spike_count) / t;
                for (k, id) in GROUPS.iter().enumerate() {
                    let g = out.groups.iter().find(|g| &g.id == id).unwrap();
                    gv[k] += g.mean_voltage / t;
                    gs[k] += g.spike_fraction / t;
                }
            }
            let mut obs = json!({"drivenNeurons":currents.len(),
                "currentSum":currents.iter().map(|c|c.1).sum::<f64>(),"meanSpikeCount":spikes});
            for (k, name) in METRICS.iter().enumerate() { obs[*name] = json!(m[k]); }
            for (k, id) in GROUPS.iter().enumerate() {
                obs[format!("{id}_v")] = json!(gv[k]);
                obs[format!("{id}_sf")] = json!(gs[k]);
            }
            row.insert((*name).into(), obs);
        }
        eprintln!("seed {seed} at {:.1}s", start.elapsed().as_secs_f64());
        per_seed.push(json!({"seed":seed,"arms":row}));
    }

    let mut contrasts = serde_json::Map::new();
    for (name, _, _) in arms.iter().skip(1) {
        let mut per_metric = serde_json::Map::new();
        for metric in METRICS.iter().copied().chain(
            GROUPS.iter().flat_map(|g| [format!("{g}_v"), format!("{g}_sf")]).collect::<Vec<_>>().iter().map(|s| Box::leak(s.clone().into_boxed_str()) as &str),
        ).chain(["meanSpikeCount"]) {
            let d: Vec<f64> = per_seed.iter().map(|r| {
                r["arms"][name][metric].as_f64().unwrap() - r["arms"]["control"][metric].as_f64().unwrap()
            }).collect();
            per_metric.insert(metric.into(), summary(&d));
        }
        contrasts.insert((*name).into(), Value::Object(per_metric));
    }
    let out = json!({
        "harness":"crates/sim/examples/odor_motor_modes.rs","seedRange":[lo,hi],
        "ticks":TICKS,"warmupTicks":0,"gain":GAIN,"bodyIntegration":false,
        "identity":identity,"convention":convention,"inputCounts":input_counts,
        "elapsedSeconds":start.elapsed().as_secs_f64(),
        "stimulusMinusControl":contrasts,"perSeed":per_seed});
    std::fs::write(format!("/tmp/odor-motor-modes/raw-{lo}-{hi}.json"), serde_json::to_string_pretty(&out)?)?;
    Ok(())
}
