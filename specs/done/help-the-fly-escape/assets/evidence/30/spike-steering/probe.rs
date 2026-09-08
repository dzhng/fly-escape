//! Scratch probe (delete after run): moving-chamber odor steering with the olfactory
//! turn term decoded from OLFACTORY_DN mean voltage (baseline) vs spike fraction x4
//! (candidate). Same fixture/geometry/seeds as evidence/30/cold-odor/probe.rs.
use serde_json::{json, Value};
use sim::{
    chamber::Chamber,
    environment::*,
    field_lab::{fixture, FieldScenario},
    sensory::{cue_currents, CuePathway},
    Brain, Graph, SPIKE_OLF, SPIKE_OLF_SCALE,
};
use std::sync::atomic::Ordering;
use std::{sync::Arc, time::Instant};

const TICKS: usize = 100;
const GAIN: f64 = 2.0;
const SEEDS: u64 = 30;

fn fields(scenario: FieldScenario, side: f64) -> Result<FieldSet, String> {
    let (historical, _) = fixture(scenario, side)?;
    let kind = if matches!(scenario, FieldScenario::ExcitatoryOdor) {
        SourceKind::RepellentOdor
    } else {
        SourceKind::AttractiveOdor
    };
    let mut f = FieldSet::new(
        historical.geometry().clone(),
        FieldConfig { baseline_brightness: 0.2, ..FieldConfig::default() },
        vec![Source { position: Point { x: -2., z: -side }, radius: 0.75, rate: 1., kind }],
        None,
    )?;
    for _ in 0..100 {
        f.advance(0.1)?;
    }
    Ok(f)
}

fn summary(v: &[f64]) -> Value {
    let n = v.len() as f64;
    let mean = v.iter().sum::<f64>() / n;
    let sd = (v.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.)).sqrt();
    let half = 2.045229642 * sd / n.sqrt(); // t(29), .95
    let mut s = v.to_vec();
    s.sort_by(|a, b| a.partial_cmp(b).unwrap());
    json!({"mean":mean,"sd":sd,"ci95":[mean-half,mean+half],
        "min":s[0],"p25":s[v.len()/4],"median":s[v.len()/2],"p75":s[3*v.len()/4],"max":s[v.len()-1],
        "positiveSeeds":v.iter().filter(|x|**x>0.).count(),
        "negativeSeeds":v.iter().filter(|x|**x<0.).count()})
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = format!(
        "{}/data/processed/brain",
        env!("CARGO_MANIFEST_DIR").trim_end_matches("/crates/sim")
    );
    let graph = Arc::new(Graph::from_bytes(
        &std::fs::read(format!("{path}/graph.bin"))?,
        &std::fs::read_to_string(format!("{path}/manifest.json"))?,
    )?);
    let start = Instant::now();
    let mut arms = vec![];
    for (decode, spike) in [("baselineVoltage", false), ("candidateSpikeFraction", true)] {
        SPIKE_OLF.store(spike, Ordering::Relaxed);
        for (scenario, cue) in [
            (FieldScenario::InhibitoryOdor, CuePathway::InhibitoryOdor),
            (FieldScenario::ExcitatoryOdor, CuePathway::ExcitatoryOdor),
        ] {
            for side in [1., -1.] {
                let mut observations = vec![];
                for seed in 0..SEEDS {
                    let mut pair = vec![];
                    for active in [false, true] {
                        let f = fields(scenario, side)?;
                        let mut chamber = Chamber::with_fields(
                            graph.clone(),
                            Brain::seed_for_fly(seed, 0),
                            f,
                            Some((if active { cue } else { CuePathway::None }, GAIN)),
                        );
                        let (mut turn, mut flight_turn, mut abs_turn, mut thrust) = (0., 0., 0., 0.);
                        let mut detected = 0;
                        let mut first_current = None;
                        let mut final_pose = None;
                        for tick in 0..TICKS {
                            let frame = chamber.step()?;
                            if cue_currents(&graph, &frame.sensory, cue, GAIN)?
                                .iter()
                                .any(|(_, v)| *v > 0.)
                            {
                                detected += 1;
                                if first_current.is_none() {
                                    first_current = Some(tick);
                                }
                            }
                            let t = TICKS as f64;
                            turn += frame.neural.motor.turn / t;
                            abs_turn += frame.neural.motor.turn.abs() / t;
                            thrust += frame.neural.motor.thrust / t;
                            flight_turn += frame.neural.motor.flight_turn / t;
                            final_pose = Some(frame.pose);
                        }
                        let p = final_pose.unwrap();
                        let (dx, dz) = (-2. - p.x, -side - p.z);
                        let distance = dx.hypot(dz);
                        pair.push(json!({"active":active,"meanTurn":turn,"meanAbsTurn":abs_turn,
                            "meanThrust":thrust,"meanFlightTurn":flight_turn,
                            "sourceSignedMeanTurn":-side*turn,"finalHeading":p.heading,
                            "distanceReduction":1.-distance,
                            "finalAlignment":(dx*p.heading.cos()+dz*p.heading.sin())/distance,
                            "finalX":p.x,"finalZ":p.z,
                            "detectedTicks":detected,"firstDetectedTick":first_current}));
                    }
                    observations.push(json!({"seed":seed,"control":pair[0],"active":pair[1]}));
                }
                let mut contrasts = serde_json::Map::new();
                for metric in [
                    "meanTurn", "meanAbsTurn", "meanThrust", "meanFlightTurn",
                    "sourceSignedMeanTurn", "distanceReduction", "finalAlignment",
                ] {
                    contrasts.insert(
                        metric.into(),
                        summary(
                            &observations
                                .iter()
                                .map(|o| {
                                    o["active"][metric].as_f64().unwrap()
                                        - o["control"][metric].as_f64().unwrap()
                                })
                                .collect::<Vec<_>>(),
                        ),
                    );
                }
                let mut controls = serde_json::Map::new();
                for metric in ["meanAbsTurn", "distanceReduction"] {
                    controls.insert(
                        metric.into(),
                        summary(
                            &observations
                                .iter()
                                .map(|o| o["control"][metric].as_f64().unwrap())
                                .collect::<Vec<_>>(),
                        ),
                    );
                }
                let item = json!({"decode":decode,"scenario":scenario,"sourceZ":-side,
                    "activeMinusMatchedNoCurrent":contrasts,"controlAbsolute":controls,
                    "observations":observations});
                eprintln!(
                    "{decode} {:?} side {side} at {:.1}s: dist {} turn {}",
                    scenario,
                    start.elapsed().as_secs_f64(),
                    item["activeMinusMatchedNoCurrent"]["distanceReduction"]["mean"],
                    item["activeMinusMatchedNoCurrent"]["sourceSignedMeanTurn"]["mean"]
                );
                arms.push(item);
            }
        }
    }
    let out = json!({
        "harness":"crates/sim/examples/spike_readout_probe.rs",
        "graphHash":graph.manifest.graph_hash,
        "brainWarmupTicks":0,"fieldSettleTicks":100,"measurementTicks":TICKS,
        "gain":GAIN,"seeds":SEEDS,"spikeOlfScale":SPIKE_OLF_SCALE,
        "config":FieldConfig::default(),"sourceRadius":0.75,"sourceRate":1,
        "initialPosition":[-2,0],"sourceDistance":1,
        "elapsedSeconds":start.elapsed().as_secs_f64(),"arms":arms,
        "decodes":{"baselineVoltage":"turn = mean_v(OLF_DN_R) - mean_v(OLF_DN_L); flight_turn = 0.5*flight steer + same term",
                   "candidateSpikeFraction":"same two places use 4.0*(spike_fraction(OLF_DN_R) - spike_fraction(OLF_DN_L)); thrust and the 0.5*flight-steer voltage term unchanged"},
        "limitations":"Scratch only. Cold Brain, settled fields, existing fixture geometry and Chamber/body owners. Paired same-seed no-current control per arm. One scale (4.0), gain 2, no smoothing, 100 ticks, 30 seeds. Descriptive t(29) intervals, no multiple-testing adjustment. Not a campaign or biology validation."});
    std::fs::write("/tmp/spike-readout/raw.json", serde_json::to_string_pretty(&out)?)?;
    Ok(())
}
