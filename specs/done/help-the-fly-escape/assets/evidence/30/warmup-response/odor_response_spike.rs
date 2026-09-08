//! Bounded cold-vs-warm60 odor response spike. Adapted from the archived cold-odor probe
//! (specs/help-the-fly-escape/assets/evidence/30/cold-odor/probe.rs). Chamber fixture only:
//! it reuses the production field_lab geometry, FieldSet, cue adapter, Graph/Brain and
//! Chamber body owner. It is not the campaign body/attempt runner.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    chamber::Chamber,
    environment::*,
    field_lab::{fixture, FieldScenario},
    sensory::{cue_currents, CuePathway},
    Brain, Graph,
};
use std::{sync::Arc, time::Instant};

const SEEDS: std::ops::Range<u64> = 0..30;
const MEASURE: usize = 100;
const GAIN: f64 = 2.0;
const WARMUPS: [usize; 2] = [0, 60];
const NEAR: [f64; 2] = [0.5, 0.75];
const T_CRIT_29: f64 = 2.045229642;
const SWARM: f64 = 20.0;

/// Fixture geometry and source, resampled at the current anatomical antenna spacing
/// (FieldConfig::default()) instead of the fixture's historical .15 m span.
fn fields(scenario: FieldScenario, mirror: f64) -> Result<FieldSet, String> {
    let (historical, _) = fixture(scenario, mirror)?;
    let kind = if matches!(scenario, FieldScenario::ExcitatoryOdor) {
        SourceKind::RepellentOdor
    } else {
        SourceKind::AttractiveOdor
    };
    let mut f = FieldSet::new(
        historical.geometry().clone(),
        FieldConfig {
            baseline_brightness: 0.2,
            ..FieldConfig::default()
        },
        vec![Source {
            position: Point {
                x: -2.,
                z: -mirror,
            },
            radius: 0.75,
            rate: 1.,
            kind,
        }],
        None,
    )?;
    // Settle only the field before observation; brains still begin at their own tick zero.
    for _ in 0..100 {
        f.advance(0.1)?;
    }
    Ok(f)
}

fn run(
    graph: &Arc<Graph>,
    seed: u64,
    scenario: FieldScenario,
    cue: CuePathway,
    mirror: f64,
    warmup: usize,
    active: bool,
) -> Result<Value, String> {
    let source = Point {
        x: -2.,
        z: -mirror,
    };
    let mut chamber = Chamber::with_fields(
        graph.clone(),
        Brain::seed_for_fly(seed, 0),
        fields(scenario, mirror)?,
        Some((if active { cue } else { CuePathway::None }, GAIN)),
    );
    // Warm the brain alone, unstimulated, with the body held at the identical initial pose.
    // Both arms of a pair receive the identical warmup, so warmup never differs within a pair.
    for _ in 0..warmup {
        chamber.brain.step();
    }
    let (mut turn, mut flight_turn) = (0., 0.);
    let (mut detected, mut first_detected) = (0, None);
    let mut distances = vec![];
    let mut pose = None;
    for tick in 0..MEASURE {
        let frame = chamber.step()?;
        if cue_currents(graph, &frame.sensory, cue, GAIN)?
            .iter()
            .any(|(_, v)| *v > 0.)
        {
            detected += 1;
            if first_detected.is_none() {
                first_detected = Some(tick);
            }
        }
        turn += frame.neural.motor.turn / MEASURE as f64;
        flight_turn += frame.neural.motor.flight_turn / MEASURE as f64;
        distances.push((source.x - frame.pose.x).hypot(source.z - frame.pose.z));
        pose = Some(frame.pose);
    }
    let p = pose.ok_or("no ticks")?;
    let (dx, dz) = (source.x - p.x, source.z - p.z);
    let final_distance = dx.hypot(dz);
    let mean_distance = distances.iter().sum::<f64>() / distances.len() as f64;
    let min_distance = distances.iter().cloned().fold(f64::INFINITY, f64::min);
    Ok(json!({
        "active": active,
        "meanTurn": turn,
        "meanFlightTurn": flight_turn,
        // Positive means net motor yaw toward the side the source is on.
        "sourceSignedMeanTurn": -mirror * turn,
        "finalDistance": final_distance,
        "meanDistance": mean_distance,
        "minDistance": min_distance,
        "distanceReduction": 1. - final_distance,
        "ticksWithin0_50m": distances.iter().filter(|d| **d <= NEAR[0]).count(),
        "ticksWithin0_75m": distances.iter().filter(|d| **d <= NEAR[1]).count(),
        "finalAlignment": (dx * p.heading.cos() + dz * p.heading.sin()) / final_distance,
        "finalX": p.x,
        "finalZ": p.z,
        "finalHeading": p.heading,
        "detectedTicks": detected,
        "firstDetectedTick": first_detected,
    }))
}

const METRICS: [&str; 8] = [
    "sourceSignedMeanTurn",
    "meanTurn",
    "meanFlightTurn",
    "meanDistance",
    "minDistance",
    "finalDistance",
    "ticksWithin0_50m",
    "ticksWithin0_75m",
];

fn summary(v: &[f64]) -> Value {
    let n = v.len() as f64;
    let mean = v.iter().sum::<f64>() / n;
    let sd = (v.iter().map(|x| (x - mean).powi(2)).sum::<f64>() / (n - 1.)).sqrt();
    json!({
        "mean": mean,
        "sd": sd,
        "ci95": [mean - T_CRIT_29 * sd / n.sqrt(), mean + T_CRIT_29 * sd / n.sqrt()],
        "seSwarmOf20": sd / SWARM.sqrt(),
        "positiveSeeds": v.iter().filter(|x| **x > 0.).count(),
        "negativeSeeds": v.iter().filter(|x| **x < 0.).count(),
    })
}

/// Paired per-seed differences of `a[metric] - b[metric]`, summarized for every metric.
fn paired(a: &[Value], b: &[Value]) -> Value {
    METRICS
        .into_iter()
        .map(|metric| {
            let deltas: Vec<f64> = a
                .iter()
                .zip(b)
                .map(|(x, y)| x[metric].as_f64().unwrap() - y[metric].as_f64().unwrap())
                .collect();
            (metric.to_string(), summary(&deltas))
        })
        .collect()
}

fn absolute(a: &[Value]) -> Value {
    METRICS
        .into_iter()
        .map(|metric| {
            let v: Vec<f64> = a.iter().map(|x| x[metric].as_f64().unwrap()).collect();
            (metric.to_string(), summary(&v))
        })
        .collect()
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    let path = args.get(1).ok_or("Pass graph directory and output path")?;
    let output = args.get(2).ok_or("Pass output JSON path")?;
    let graph = Arc::new(Graph::from_bytes(
        &std::fs::read(format!("{path}/graph.bin"))?,
        &std::fs::read_to_string(format!("{path}/manifest.json"))?,
    )?);
    let start = Instant::now();
    let mut arms = vec![];
    for (scenario, cue) in [
        (FieldScenario::InhibitoryOdor, CuePathway::InhibitoryOdor),
        (FieldScenario::ExcitatoryOdor, CuePathway::ExcitatoryOdor),
    ] {
        for mirror in [1., -1.] {
            let mut by_warmup = serde_json::Map::new();
            let mut contrasts = vec![];
            for warmup in WARMUPS {
                let mut stimulus = vec![];
                let mut control = vec![];
                for seed in SEEDS {
                    control.push(run(&graph, seed, scenario, cue, mirror, warmup, false)?);
                    stimulus.push(run(&graph, seed, scenario, cue, mirror, warmup, true)?);
                }
                let contrast = paired(&stimulus, &control);
                contrasts.push(
                    stimulus
                        .iter()
                        .zip(&control)
                        .map(|(a, b)| {
                            METRICS
                                .map(|m| a[m].as_f64().unwrap() - b[m].as_f64().unwrap())
                        })
                        .collect::<Vec<_>>(),
                );
                eprintln!(
                    "{scenario:?} sourceZ {} warmup {warmup} at {:.1}s: turn {} meanDist {}",
                    -mirror,
                    start.elapsed().as_secs_f64(),
                    contrast["sourceSignedMeanTurn"],
                    contrast["meanDistance"]
                );
                by_warmup.insert(
                    format!("warmup{warmup}"),
                    json!({
                        "activeMinusMatchedNoCurrent": contrast,
                        "absoluteStimulus": absolute(&stimulus),
                        "absoluteNoCurrent": absolute(&control),
                        "seedObservations": stimulus.iter().zip(&control)
                            .zip(SEEDS)
                            .map(|((a, c), seed)| json!({"seed": seed, "active": a, "control": c}))
                            .collect::<Vec<_>>(),
                    }),
                );
            }
            // Same seeds in both warmups, so the cue effect itself is paired across warmup.
            let warm_minus_cold: Value = METRICS
                .into_iter()
                .enumerate()
                .map(|(i, metric)| {
                    let deltas: Vec<f64> = contrasts[1]
                        .iter()
                        .zip(&contrasts[0])
                        .map(|(w, c)| w[i] - c[i])
                        .collect();
                    (metric.to_string(), summary(&deltas))
                })
                .collect();
            arms.push(json!({
                "scenario": scenario,
                "sourceZ": -mirror,
                "warmupContrastWarm60MinusCold": warm_minus_cold,
                "byWarmup": by_warmup,
            }));
        }
    }
    let source_hashes: Value = [
        ("odor_response_spike.rs", include_str!("odor_response_spike.rs")),
        ("lif.rs", include_str!("../src/lif.rs")),
        ("graph.rs", include_str!("../src/graph.rs")),
        ("chamber.rs", include_str!("../src/chamber.rs")),
        ("body.rs", include_str!("../src/body.rs")),
        ("sensory.rs", include_str!("../src/sensory.rs")),
        ("field_lab.rs", include_str!("../src/field_lab.rs")),
        ("environment/mod.rs", include_str!("../src/environment/mod.rs")),
        ("environment/fields.rs", include_str!("../src/environment/fields.rs")),
    ]
    .into_iter()
    .map(|(k, v)| (k.to_string(), json!(format!("{:x}", Sha256::digest(v.as_bytes())))))
    .collect();
    let evidence = json!({
        "graphHash": graph.manifest.graph_hash,
        "sourceHashes": source_hashes,
        "rootSeeds": SEEDS.collect::<Vec<_>>(),
        "flyId": 0,
        "warmupTicks": WARMUPS,
        "measurementTicks": MEASURE,
        "fieldSettleTicks": 100,
        "gain": GAIN,
        "fieldConfig": FieldConfig { baseline_brightness: 0.2, ..FieldConfig::default() },
        "chamberSpeed": 0.12,
        "chamberTurnGain": 8.0,
        "initialPose": [-2, 0, 0],
        "sourceRadius": 0.75,
        "sourceRate": 1,
        "initialSourceDistance": 1,
        "elapsedSeconds": start.elapsed().as_secs_f64(),
        "arms": arms,
        "conditions": "Chamber observation fixture, NOT the campaign attempt/body runner. Production field_lab::fixture geometry, FieldSet, cue_currents adapter, Graph/Brain and Chamber body owner (speed .12, turn gain 8). Anatomical FieldConfig::default() antenna spacing replaces the fixture's historical .15 m span. Sources at (-2,-1) and (-2,+1), radius .75, background brightness .2, fields settled 100 ticks. Every fly starts at (-2,0) heading 0, one metre from the source. Both current-gain 2 pathways are the current campaign gains. Each stimulus run is paired with an identical-seed, identical-field, identical-warmup no-current control. The 0 and 60 tick warmups use the same seeds, so the cue effect can be differenced across warmup.",
        "metrics": "sourceSignedMeanTurn is mean motor turn signed so positive is yaw toward the source side. meanDistance/minDistance/finalDistance are metres to the source over the 100 moving ticks. ticksWithin0_50m/ticksWithin0_75m count moving ticks inside those radii (0.75 m is the source radius). Contrast metrics subtract the matched no-current control; warmupContrastWarm60MinusCold subtracts the cold contrast from the warm60 contrast on the same seed.",
        "uncertainty": "Descriptive Student t(29) 95% intervals over 30 paired seed differences, no multiplicity correction. seSwarmOf20 is sd/sqrt(20), the standard error a single 20-fly swarm average would carry; it is derived from these 30 single-fly seeds, not measured on swarms.",
    });
    std::fs::write(output, serde_json::to_string_pretty(&evidence)?)?;
    Ok(())
}
