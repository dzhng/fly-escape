//! Scratch DA2 unilateral-stimulation observation. Three paired arms per seed at ONE frozen input
//! current: no current, left `ORN_DA2` only, right `ORN_DA2` only. Nothing is calibrated here; the
//! current is read from the earlier rate-calibration artifact and never re-fitted.
//!
//! The 7 `ORN_DA2` bodies whose annotations never assigned a side are never stimulated in any arm.
//! No body, no odor field, no source bearing, no forced turn, no gain change, no decoder change.
//!
//! `DT_MS` is the same experiment-local unit assignment used by the calibration run: one `Brain`
//! step is read as one millisecond so per-neuron spike counts can be printed as spikes/second. It
//! is explicitly NOT a validated physiological timebase and NOT the gameplay timebase.
use serde_json::{json, Value};
use sim::{sensory::motor_readout_indices, Brain, Graph};
use std::{collections::BTreeMap, ops::Range, sync::Arc, time::Instant};

/// Experiment-local unit assignment: one `Brain` step is read as one millisecond. Unvalidated.
const DT_MS: f64 = 1.0;
const STEPS: usize = 1500;
const BEFORE: Range<usize> = 0..500;
const PULSE: Range<usize> = 500..1000;
const AFTER: Range<usize> = 1000..1500;
/// Each phase is 500 steps = 0.5 s under `DT_MS`.
const WINDOW_SECONDS: f64 = 0.5;
/// Frozen from /tmp/fly-da2-rate-output/rate-calibration.json `calibration.high.chosenCurrent`.
/// Not re-fitted, not re-derived, not swept.
const CURRENT: f64 = 0.082_031_25;
const SEEDS: Range<u64> = 10..40;

/// One 1500-step run under one arm.
struct Run {
    /// Per-neuron spikes/second under `DT_MS`, keyed `phase.group`.
    rates: BTreeMap<String, f64>,
    /// Per-step means of the existing turning readouts, keyed `phase.metric`.
    readouts: BTreeMap<String, f64>,
    /// Sum of every neuron voltage at the last step before the pulse window opens.
    pre_pulse_voltage_sum: f64,
    /// Neurons actually receiving current, and the value each received.
    stimulated: Vec<u32>,
}

fn phases() -> [(&'static str, Range<usize>); 3] {
    [("before", BEFORE), ("during", PULSE), ("after", AFTER)]
}

fn run(
    graph: &Arc<Graph>,
    groups: &BTreeMap<String, Vec<u32>>,
    stimulated: &[u32],
    seed: u64,
) -> Result<Run, Box<dyn std::error::Error>> {
    let currents: Vec<(u32, f64)> = stimulated.iter().map(|&i| (i, CURRENT)).collect();
    let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, 0));
    let mut counts: BTreeMap<String, f64> = BTreeMap::new();
    let mut readouts: BTreeMap<String, f64> = BTreeMap::new();
    let mut pre_pulse_voltage_sum = f64::NAN;
    for step in 0..STEPS {
        if step == PULSE.start {
            pre_pulse_voltage_sum = brain.voltage().iter().sum();
        }
        // Every arm takes the identical code path; only the pulse-window payload differs.
        brain.set_external_current(if PULSE.contains(&step) { &currents } else { &[] })?;
        let out = brain.step();
        let (phase, range) = phases().into_iter().find(|(_, r)| r.contains(&step)).unwrap();
        let spikes = brain.spikes();
        let fraction = |indices: &[u32]| {
            indices.iter().filter(|&&i| spikes[i as usize]).count() as f64 / indices.len() as f64
        };
        for (id, indices) in groups {
            *counts.entry(format!("{phase}.{id}")).or_default() += fraction(indices);
        }
        for (label, prefix) in [("ornAll", "orn"), ("pnAll", "pn")] {
            let pooled: Vec<u32> = groups
                .iter()
                .filter(|(id, _)| id.starts_with(prefix))
                .flat_map(|(_, v)| v.iter().copied())
                .collect();
            *counts.entry(format!("{phase}.{label}")).or_default() += fraction(&pooled);
        }
        if !stimulated.is_empty() {
            *counts.entry(format!("{phase}.ornStimulated")).or_default() += fraction(stimulated);
        }

        let steps_in_phase = range.len() as f64;
        let mut mean = |metric: &str, value: f64| {
            *readouts.entry(format!("{phase}.{metric}")).or_default() += value / steps_in_phase;
        };
        let (mut turn_l, mut turn_r) = (0.0, 0.0);
        for g in &out.groups {
            match g.id.as_str() {
                "turnL" => turn_l = g.spike_fraction,
                "turnR" => turn_r = g.spike_fraction,
                _ => continue,
            }
            mean(&format!("{}SpikeFraction", g.id), g.spike_fraction);
            mean(&format!("{}MeanVoltage", g.id), g.mean_voltage);
        }
        // Primary observable: existing turning-group spike fractions, right minus left.
        mean("turnBias", turn_r - turn_l);
        mean("networkSpikesPerStep", f64::from(out.spike_count));
    }
    let rates = counts.into_iter().map(|(k, v)| (k, v / WINDOW_SECONDS)).collect();
    Ok(Run { rates, readouts, pre_pulse_voltage_sum, stimulated: stimulated.to_vec() })
}

/// Evoked = during minus before, spikes/second.
fn evoked(run: &Run, group: &str) -> Option<f64> {
    Some(run.rates.get(&format!("during.{group}"))? - run.rates.get(&format!("before.{group}"))?)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let path = args.next().ok_or("Pass scratch graph directory")?;
    let out_dir = args.next().ok_or("Pass output directory")?;
    let start = Instant::now();
    assert_eq!(BEFORE.len(), PULSE.len(), "pre-stimulus and stimulus windows must match");
    assert!((PULSE.len() as f64 * DT_MS / 1000.0 - WINDOW_SECONDS).abs() < 1e-12);

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

    let (left, right, unknown) = (groups["ornL"].clone(), groups["ornR"].clone(), groups["ornunknown"].clone());
    if left.is_empty() || right.is_empty() {
        return Err("both sides must be populated".into());
    }
    if left.iter().any(|i| right.contains(i)) {
        return Err("left and right ORN sets overlap".into());
    }
    let readout_indices = motor_readout_indices(&graph);
    if left.iter().chain(&right).any(|i| readout_indices.contains(i)) {
        return Err("stimulus would drive a motor readout directly".into());
    }
    let arms: [(&str, Vec<u32>); 3] =
        [("none", vec![]), ("left", left.clone()), ("right", right.clone())];
    for (label, stimulated) in &arms {
        if unknown.iter().any(|i| stimulated.contains(i)) {
            return Err(format!("unknown-side ORN stimulated in arm {label}").into());
        }
    }

    let mut observations = vec![];
    for seed in SEEDS {
        let mut runs: BTreeMap<&str, Run> = BTreeMap::new();
        for (label, stimulated) in &arms {
            runs.insert(label, run(&graph, &groups, stimulated, seed)?);
        }
        // Verification: with no current before step 500, every arm's pre-pulse trajectory must be
        // bit-identical for a given seed. Only the pulse-window input differs.
        let reference = &runs["none"];
        for (label, side) in [("left", "ornL"), ("right", "ornR")] {
            let arm = &runs[label];
            if arm.pre_pulse_voltage_sum != reference.pre_pulse_voltage_sum {
                return Err(format!("seed {seed} arm {label}: pre-pulse voltages diverged").into());
            }
            for (key, value) in arm.rates.iter().chain(arm.readouts.iter()) {
                // `ornStimulated` names a different neuron set per arm and has no counterpart in the
                // no-current arm; it is checked against its own side group instead.
                if key.starts_with("before.") && key != "before.ornStimulated" {
                    let baseline = reference.rates.get(key).or_else(|| reference.readouts.get(key));
                    if baseline != Some(value) {
                        return Err(format!("seed {seed} arm {label}: before-phase {key} differs").into());
                    }
                }
            }
            if arm.rates["before.ornStimulated"] != arm.rates[&format!("before.{side}")] {
                return Err(format!("seed {seed} arm {label}: stimulated set is not exactly {side}").into());
            }
        }

        let bias = |label: &str, phase: &str| runs[label].readouts[&format!("{phase}.turnBias")];
        let mut arms_json = serde_json::Map::new();
        for (label, _) in &arms {
            let r = &runs[label];
            let evoked_hz: BTreeMap<String, f64> =
                ["ornL", "ornR", "ornunknown", "ornAll", "ornStimulated", "pnL", "pnR", "pnAll"]
                    .iter()
                    .filter_map(|g| evoked(r, g).map(|v| ((*g).to_string(), v)))
                    .collect();
            arms_json.insert(
                (*label).into(),
                json!({
                    "stimulatedNeurons": r.stimulated.len(),
                    "rates": r.rates,
                    "readouts": r.readouts,
                    "evokedHz": evoked_hz,
                    "prePulseVoltageSum": r.pre_pulse_voltage_sum,
                }),
            );
        }
        let (left_delta, right_delta) =
            (bias("left", "during") - bias("none", "during"), bias("right", "during") - bias("none", "during"));
        eprintln!(
            "seed {seed}: left {left_delta:+.3e} right {right_delta:+.3e} @{:.1}s",
            start.elapsed().as_secs_f64()
        );
        observations.push(json!({
            "seed": seed,
            "arms": arms_json,
            "primary": {
                "leftMinusNone": left_delta,
                "rightMinusNone": right_delta,
                "leftMinusRight": left_delta - right_delta,
            },
            "turnBiasByPhase": phases().map(|(p, _)| (p.to_string(), json!({
                "none": bias("none", p), "left": bias("left", p), "right": bias("right", p),
                "leftMinusNone": bias("left", p) - bias("none", p),
                "rightMinusNone": bias("right", p) - bias("none", p),
            }))).into_iter().collect::<BTreeMap<_, _>>(),
            "beforePhaseIdenticalAcrossArms": true,
        }));
    }

    let output = json!({
        "graphSha256": graph.manifest.graph_hash,
        "graphDirectory": path,
        "protocol": {
            "question": "Does unilateral ORN_DA2 stimulation move the existing turning readouts, and with which sign per side?",
            "notATest": "This is not a geosmin-behaviour test, not an attraction test and not an avoidance test.",
            "externalCurrentPerNeuron": CURRENT,
            "currentSource": "/tmp/fly-da2-rate-output/rate-calibration.json calibration.high.chosenCurrent (frozen, not re-fitted)",
            "dtMsAssumed": DT_MS,
            "dtMsMeaning": "experiment-local unit assignment only; explicitly unvalidated timing, not the gameplay timebase",
            "steps": STEPS, "beforeSteps": [BEFORE.start, BEFORE.end], "pulseSteps": [PULSE.start, PULSE.end],
            "afterSteps": [AFTER.start, AFTER.end], "windowSeconds": WINDOW_SECONDS,
            "seeds": SEEDS.clone().collect::<Vec<_>>(),
            "arms": arms.iter().map(|(l, s)| json!({"arm": l, "stimulatedNeurons": s.len()})).collect::<Vec<_>>(),
            "groupSizes": groups.iter().map(|(k, v)| (k.clone(), v.len())).collect::<BTreeMap<_, _>>(),
            "unknownSideNeverStimulated": unknown.len(),
            "primaryMetric": "during-pulse (turnR spike fraction minus turnL spike fraction), stimulated arm minus same-seed no-current arm",
            "brainDynamicsChanged": false, "decoderChanged": false, "gainChanged": false,
            "bodyOrField": false, "sourceBearing": false, "forcedTurn": false,
            "directMotorInput": false,
        },
        "verification": {
            "beforePhaseIdenticalAcrossArms": true,
            "prePulseVoltageSumIdenticalAcrossArms": true,
            "note": "Asserted per seed by exact f64 comparison; the run aborts on any divergence.",
            "leftRightDisjoint": true,
            "unknownSideStimulatedInAnyArm": false,
        },
        "observations": observations,
        "elapsedSeconds": start.elapsed().as_secs_f64(),
        "limits": "Observation only. A phenomenological external current on retained ORN_DA2 bodies is not a \
geosmin dose, not a receptor model and not an odor field. No body, no movement, no source bearing. Timing is \
an unvalidated experiment-local 1 ms/step. Intervals are descriptive across 30 seeds of one model, not \
inference about flies. Sign of a turning readout is not attraction or avoidance; bilateral cancellation is \
not a failure.",
    });
    std::fs::create_dir_all(&out_dir)?;
    std::fs::write(format!("{out_dir}/unilateral.json"), serde_json::to_string_pretty(&output)?)?;
    eprintln!("wrote {out_dir}/unilateral.json in {:.1}s", start.elapsed().as_secs_f64());
    Ok(())
}
