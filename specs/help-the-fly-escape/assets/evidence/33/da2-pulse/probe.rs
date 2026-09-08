//! Scratch DA2 pulse/control probe. Uncalibrated neural-current perturbation of the
//! retained ORN_DA2 population; no odor field, no body, no gain sweep.
use serde_json::{json, Value};
use sim::{sensory::motor_readout_indices, Brain, Graph};
use std::{collections::BTreeMap, sync::Arc, time::Instant};

const STEPS: usize = 1000;
const PULSE: std::ops::Range<usize> = 400..600;
const GAIN: f64 = 2.0;
const SEEDS: [u64; 3] = [0, 1, 2];

/// Fraction of `indices` spiking on this tick.
fn fraction(spikes: &[bool], indices: &[u32]) -> f64 {
    if indices.is_empty() {
        0.0
    } else {
        indices.iter().filter(|&&i| spikes[i as usize]).count() as f64 / indices.len() as f64
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let path = std::env::args().nth(1).ok_or("Pass scratch graph directory")?;
    let start = Instant::now();
    let graph = Arc::new(Graph::from_bytes(
        &std::fs::read(format!("{path}/graph.bin"))?,
        &std::fs::read_to_string(format!("{path}/manifest.json"))?,
    )?);
    let da2: Value = serde_json::from_str(&std::fs::read_to_string(format!("{path}/da2-groups.json"))?)?;
    if da2["graphHash"] != json!(graph.manifest.graph_hash) {
        return Err("DA2 group file does not belong to this graph".into());
    }
    let groups: BTreeMap<String, Vec<u32>> = da2["groups"]
        .as_object()
        .ok_or("missing DA2 groups")?
        .iter()
        .map(|(id, g)| {
            (
                id.clone(),
                g["indices"].as_array().unwrap().iter().map(|v| v.as_u64().unwrap() as u32).collect(),
            )
        })
        .collect();
    let stimulated: Vec<u32> = groups
        .iter()
        .filter(|(id, _)| id.starts_with("orn"))
        .flat_map(|(_, v)| v.iter().copied())
        .collect();
    let readouts = motor_readout_indices(&graph);
    let overlap: Vec<u32> = stimulated.iter().copied().filter(|i| readouts.contains(i)).collect();
    if !overlap.is_empty() {
        return Err("stimulus would drive a motor readout directly".into());
    }
    let currents: Vec<(u32, f64)> = stimulated.iter().map(|&i| (i, GAIN)).collect();

    let phases = [("before", 0..PULSE.start), ("during", PULSE), ("after", PULSE.end..STEPS)];
    let mut observations = vec![];
    for seed in SEEDS {
        let mut arms = serde_json::Map::new();
        for active in [false, true] {
            let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, 0));
            let mut totals: BTreeMap<String, f64> = BTreeMap::new();
            for step in 0..STEPS {
                if active {
                    brain.set_external_current(if PULSE.contains(&step) { &currents } else { &[] })?;
                }
                let out = brain.step();
                let phase = phases.iter().find(|(_, r)| r.contains(&step)).unwrap();
                let n = phase.1.len() as f64;
                let mut add = |metric: &str, value: f64| {
                    *totals.entry(format!("{}.{metric}", phase.0)).or_default() += value / n;
                };
                for (id, indices) in &groups {
                    add(&format!("{id}SpikeFraction"), fraction(brain.spikes(), indices));
                }
                for g in &out.groups {
                    if ["turnL", "turnR"].contains(&g.id.as_str()) {
                        add(&format!("{}SpikeFraction", g.id), g.spike_fraction);
                        add(&format!("{}MeanVoltage", g.id), g.mean_voltage);
                    }
                }
                add("motorTurn", out.motor.turn);
                add("motorFlightTurn", out.motor.flight_turn);
                add("motorThrust", out.motor.thrust);
                add("spikeCount", f64::from(out.spike_count));
            }
            arms.insert(if active { "active" } else { "control" }.into(), json!(totals));
        }
        let (active, control) = (arms["active"].clone(), arms["control"].clone());
        let difference: BTreeMap<String, f64> = active
            .as_object()
            .unwrap()
            .keys()
            .map(|k| (k.clone(), active[k].as_f64().unwrap() - control[k].as_f64().unwrap()))
            .collect();
        eprintln!("seed {seed} at {:.1}s", start.elapsed().as_secs_f64());
        observations.push(json!({"seed": seed, "control": control, "active": active, "activeMinusControl": difference}));
    }
    let keys: Vec<String> = observations[0]["activeMinusControl"].as_object().unwrap().keys().cloned().collect();
    let mut summary = serde_json::Map::new();
    for key in keys {
        let values: Vec<f64> = observations.iter().map(|o| o["activeMinusControl"][&key].as_f64().unwrap()).collect();
        summary.insert(
            key.clone(),
            json!({"perSeed": values, "mean": values.iter().sum::<f64>() / values.len() as f64,
                   "min": values.iter().cloned().fold(f64::INFINITY, f64::min),
                   "max": values.iter().cloned().fold(f64::NEG_INFINITY, f64::max)}),
        );
    }
    let output = json!({
        "graphHash": graph.manifest.graph_hash,
        "stimulatedNeurons": stimulated.len(),
        "stimulatedGroups": groups.iter().map(|(k, v)| (k.clone(), v.len())).collect::<BTreeMap<_, _>>(),
        "externalCurrentPerNeuron": GAIN, "steps": STEPS, "pulseSteps": [PULSE.start, PULSE.end],
        "seeds": SEEDS, "brainWarmupSteps": 0,
        "elapsedSeconds": start.elapsed().as_secs_f64(),
        "activeMinusControl": summary, "observations": observations,
        "limits": "Uncalibrated external neural current injected into retained ORN_DA2 bodies; NOT a geosmin dose \
and not a receptor model. Cold Brain initialization, no odor field, no body, no movement, no gain sweep. \
Paired against the same-seed no-current run; identical noise stream. Three seeds are descriptive only."});
    std::fs::write(format!("{path}/pulse.json"), serde_json::to_string_pretty(&output)?)?;
    println!("{}", serde_json::to_string_pretty(&output["activeMinusControl"])?);
    Ok(())
}
