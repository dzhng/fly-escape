//! Finite moving-chamber interventions using the same field, adapter, and body owners as the lab.
use serde::Serialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    chamber::Chamber,
    environment::*,
    field_lab::{fixture, FieldScenario},
    sensory::CuePathway,
    Brain, Graph,
};
use std::{sync::Arc, time::Instant};

const SEEDS: std::ops::Range<u64> = 0..30;
const WARMUP: usize = 60;
const MEASURE: usize = 100;
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Observation {
    turn: f64,
    flight_turn: f64,
    heading_change: f64,
    final_x: f64,
    final_z: f64,
    mean_odor_difference: f64,
    mean_brightness_difference: f64,
}
impl Observation {
    fn metrics(&self, mirror: f64) -> [f64; 5] {
        let dx = -2.0 - self.final_x;
        let dz = -mirror - self.final_z;
        let distance = dx.hypot(dz);
        [
            self.turn,
            self.flight_turn,
            -mirror * self.heading_change,
            1.0 - distance,
            if distance == 0.0 {
                1.0
            } else {
                (dx * self.heading_change.cos() + dz * self.heading_change.sin()) / distance
            },
        ]
    }
}
fn run(
    graph: &Arc<Graph>,
    seed: u64,
    fields: FieldSet,
    cue: CuePathway,
    silence: &[u32],
) -> Result<Observation, String> {
    let mut chamber = Chamber::with_fields(
        graph.clone(),
        Brain::seed_for_fly(seed, 0),
        fields,
        Some((cue, 1.0)),
    );
    // Warm the brain alone, keeping every body at the identical source-relative pose.
    for _ in 0..WARMUP {
        chamber.brain.step();
    }
    chamber.brain.set_silenced_neurons(silence)?;
    let mut out = Observation {
        turn: 0.,
        flight_turn: 0.,
        heading_change: 0.,
        final_x: -2.,
        final_z: 0.,
        mean_odor_difference: 0.,
        mean_brightness_difference: 0.,
    };
    for _ in 0..MEASURE {
        let frame = chamber.step()?;
        out.turn += frame.neural.motor.turn / MEASURE as f64;
        out.flight_turn += frame.neural.motor.flight_turn / MEASURE as f64;
        out.heading_change += frame.neural.motor.turn * 0.1;
        out.final_x = frame.pose.x;
        out.final_z = frame.pose.z;
        out.mean_odor_difference += (frame.sensory.left.attractive_odor
            + frame.sensory.left.repellent_odor
            - frame.sensory.right.attractive_odor
            - frame.sensory.right.repellent_odor)
            / MEASURE as f64;
        out.mean_brightness_difference +=
            (frame.sensory.left.brightness - frame.sensory.right.brightness) / MEASURE as f64;
    }
    Ok(out)
}
fn uniform_fields() -> Result<FieldSet, String> {
    let (fields, _) = fixture(FieldScenario::ExcitatoryOdor, 1.0)?;
    FieldSet::new(
        fields.geometry().clone(),
        FieldConfig {
            baseline_brightness: 0.2,
            ..FieldConfig::default()
        },
        vec![],
        None,
    )
}
fn stats(samples: &[[f64; 5]]) -> Value {
    ["turn","flightTurn","headingTowardSource","distanceReduction","finalAlignmentTowardSource"].into_iter().enumerate().map(|(axis,name)| {
        let n=samples.len() as f64;
        let mean=samples.iter().map(|s|s[axis]).sum::<f64>()/n;
        let sd=(samples.iter().map(|s|(s[axis]-mean).powi(2)).sum::<f64>()/(n-1.0)).sqrt();
        let half=2.045229642*sd/n.sqrt();
        (name.to_string(),json!({"mean":mean,"ci95":[mean-half,mean+half],"positiveSeeds":samples.iter().filter(|s|s[axis]>0.0).count(),"negativeSeeds":samples.iter().filter(|s|s[axis]<0.0).count()}))
    }).collect()
}
fn contrast(a: &[Observation], b: &[Observation], mirror: f64) -> Value {
    stats(
        &a.iter()
            .zip(b)
            .map(|(a, b)| {
                let a = a.metrics(mirror);
                let b = b.metrics(mirror);
                std::array::from_fn(|i| a[i] - b[i])
            })
            .collect::<Vec<_>>(),
    )
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    let path = args
        .get(1)
        .ok_or("Pass graph directory and output JSON path")?;
    let output = args.get(2).ok_or("Pass output JSON path")?;
    let bytes = std::fs::read(format!("{path}/graph.bin"))?;
    let manifest = std::fs::read_to_string(format!("{path}/manifest.json"))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    let start = Instant::now();
    let baseline = SEEDS
        .map(|seed| run(&graph, seed, uniform_fields()?, CuePathway::None, &[]))
        .collect::<Result<Vec<_>, String>>()?;
    let mut results = vec![];
    for (scenario, groups) in [
        (FieldScenario::ExcitatoryOdor, ["odorExcL", "odorExcR"]),
        (FieldScenario::InhibitoryOdor, ["odorInhL", "odorInhR"]),
    ] {
        let silence: Vec<_> = groups
            .iter()
            .flat_map(|id| {
                graph
                    .manifest
                    .groups
                    .iter()
                    .find(|g| g.id == *id)
                    .unwrap()
                    .indices
                    .iter()
                    .copied()
            })
            .collect();
        let ablated_baseline = SEEDS
            .map(|seed| run(&graph, seed, uniform_fields()?, CuePathway::None, &silence))
            .collect::<Result<Vec<_>, String>>()?;
        let uniform_control = &baseline;
        let ablated_uniform = &ablated_baseline;
        let mut sides = vec![];
        let mut side_samples = vec![];
        for mirror in [1.0, -1.0] {
            let stimulus = SEEDS
                .map(|seed| {
                    let (f, c) = fixture(scenario, mirror)?;
                    run(&graph, seed, f, c, &[])
                })
                .collect::<Result<Vec<_>, String>>()?;
            let ablated = SEEDS
                .map(|seed| {
                    let (f, c) = fixture(scenario, mirror)?;
                    run(&graph, seed, f, c, &silence)
                })
                .collect::<Result<Vec<_>, String>>()?;
            sides.push(json!({"sourceZ":-mirror,"stimulusMinusNoCurrent":contrast(&stimulus,&baseline,mirror),"stimulusMinusUniformControl":contrast(&stimulus,uniform_control,mirror),"ablatedStimulusMinusAblatedNoCurrent":contrast(&ablated,&ablated_baseline,mirror),"ablatedStimulusMinusAblatedUniformControl":contrast(&ablated,ablated_uniform,mirror),"absoluteStimulus":stats(&stimulus.iter().map(|s|s.metrics(mirror)).collect::<Vec<_>>()),"seedObservations":{"stimulus":stimulus,"noCurrent":baseline,"uniformControl":uniform_control,"ablatedStimulus":ablated,"ablatedNoCurrent":ablated_baseline,"ablatedUniformControl":ablated_uniform}}));
            side_samples.push(stimulus);
        }
        // Mirrored motor contrast retains raw motor signs; spatial metrics use each source side.
        let mirrored = stats(
            &side_samples[0]
                .iter()
                .zip(&side_samples[1])
                .map(|(l, r)| {
                    let l = l.metrics(1.0);
                    let r = r.metrics(-1.0);
                    std::array::from_fn(|i| l[i] - r[i])
                })
                .collect::<Vec<_>>(),
        );
        eprintln!(
            "{scenario:?} after {:.1}s: {}",
            start.elapsed().as_secs_f64(),
            mirrored
        );
        results.push(json!({"scenario":scenario,"silencedIndices":silence,"leftMinusRight":mirrored,"sides":sides}));
    }
    let source_hashes: Value = [
        ("field_probe.rs", include_str!("field_probe.rs")),
        ("lif.rs", include_str!("../src/lif.rs")),
        ("graph.rs", include_str!("../src/graph.rs")),
        ("chamber.rs", include_str!("../src/chamber.rs")),
        ("sensory.rs", include_str!("../src/sensory.rs")),
        ("field_lab.rs", include_str!("../src/field_lab.rs")),
        (
            "environment/mod.rs",
            include_str!("../src/environment/mod.rs"),
        ),
        (
            "environment/fields.rs",
            include_str!("../src/environment/fields.rs"),
        ),
    ]
    .into_iter()
    .map(|(k, v)| {
        (
            k.to_string(),
            json!(format!("{:x}", Sha256::digest(v.as_bytes()))),
        )
    })
    .collect();
    let evidence = json!({"graphHash":graph.manifest.graph_hash,"sourceHashes":source_hashes,"rootSeeds":SEEDS.collect::<Vec<_>>(),"flyId":0,"warmupTicks":WARMUP,"measurementTicks":MEASURE,"gain":1.0,"elapsedSeconds":start.elapsed().as_secs_f64(),"conditions":"Same production field_lab::fixture, Chamber, cue_currents and Brain as browser. Brains warm60 unstimulated ticks at stationary initial pose(-2,0), heading0; then100 moving chamber ticks. Fields settle100 ticks before observation. Sources at(-2,-1) and(-2,+1). All source scenes use background brightness .2. No-current controls clear external current each step. Additional visual controls inject source-free uniform brightness .2. Baseline fields omit source: wind0 and source fields cannot affect the body except through disabled neural injection. Bilateral ablation begins after warmup, includes original groups even where stimulus excludes readouts. All comparisons paired by seed.","metrics":"turn/flightTurn are mean motor outputs. headingTowardSource is source-side signed net heading change; positive means yaw toward the initial source side. distanceReduction is initial distance1 minus final source distance. finalAlignmentTowardSource is final heading dot normalized vector to source, positive means facing toward it. Difference metrics subtract the matched control. leftMinusRight uses sourceZ=-1 minus sourceZ=+1; its spatial metrics are each oriented toward their own source.","uncertainty":"Student t(29)95% intervals across paired seed means, descriptive without multiplicity correction. Free movement changes subsequent sensory histories; this is a finite closed-loop fixture, not proof of biological preference or asymptotic target seeking.","results":results});
    std::fs::write(output, serde_json::to_string_pretty(&evidence)?)?;
    Ok(())
}
