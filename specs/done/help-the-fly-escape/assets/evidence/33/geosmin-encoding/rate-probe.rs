//! Scratch DA2 input-current calibration against eLife 51040 fig2-data1 control evoked rates.
//!
//! Fits ONE number: the external current on the 48 retained `ORN_DA2` bodies that reproduces the
//! paper's *evoked* (stimulated minus unstimulated) firing increase at the receptors. Nothing
//! downstream is fitted, inspected during fitting, or validated by this run.
//!
//! `DT_MS` below is an experiment-local unit assignment made so an input current can be compared to
//! a published spikes/second figure at all. It is NOT a validated physiological timebase and NOT the
//! gameplay timebase. `Brain` dynamics (tau, threshold, dt, refractory, noise) are untouched.
use serde_json::{json, Value};
use sim::{sensory::motor_readout_indices, Brain, Graph};
use std::{collections::BTreeMap, ops::Range, sync::Arc, time::Instant};

/// Experiment-local unit assignment: one `Brain` step is read as one millisecond.
const DT_MS: f64 = 1.0;
const STEPS: usize = 1500;
const BEFORE: Range<usize> = 0..500;
const PULSE: Range<usize> = 500..1000;
const AFTER: Range<usize> = 1000..1500;
/// Both the pre-stimulus and the stimulus window are 500 steps = 500 ms under `DT_MS`.
const WINDOW_SECONDS: f64 = 0.5;

/// eLife 51040 fig2-data1 genetic-background controls, evoked spikes/second (not absolute rates,
/// not airborne concentration): 0.2 ug/ml -> 17.0, 20 ug/ml -> 80.6667.
const TARGETS: [(&str, f64); 2] = [("low", 17.0), ("high", 80.666_666_666_666_67)];
const BRACKET: (f64, f64) = (0.0, 2.0);
const MAX_ITERATIONS: usize = 10;
const TOLERANCE_HZ: f64 = 1.0;
const CALIBRATION_SEED: u64 = 0;
const VALIDATION_SEEDS: [u64; 3] = [1, 2, 3];

fn phases() -> [(&'static str, Range<usize>); 3] {
    [("before", BEFORE), ("during", PULSE), ("after", AFTER)]
}

/// One 1500-step run. `rates` are per-neuron spikes/second under `DT_MS`; `readouts` are per-step
/// means of the turning groups and decoder outputs.
struct Run {
    rates: BTreeMap<String, f64>,
    readouts: BTreeMap<String, f64>,
}

impl Run {
    /// The calibration observable: ORN aggregate during-minus-before, spikes / 0.5 s.
    fn orn_evoked_hz(&self) -> f64 {
        self.rates["during.ornAll"] - self.rates["before.ornAll"]
    }
}

fn run(
    graph: &Arc<Graph>,
    groups: &BTreeMap<String, Vec<u32>>,
    stimulated: &[u32],
    seed: u64,
    current: Option<f64>,
) -> Result<Run, Box<dyn std::error::Error>> {
    let currents: Vec<(u32, f64)> = match current {
        Some(c) => stimulated.iter().map(|&i| (i, c)).collect(),
        None => vec![],
    };
    let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, 0));
    let mut counts: BTreeMap<String, f64> = BTreeMap::new();
    let mut readouts: BTreeMap<String, f64> = BTreeMap::new();
    for step in 0..STEPS {
        if current.is_some() {
            brain.set_external_current(if PULSE.contains(&step) { &currents } else { &[] })?;
        }
        let out = brain.step();
        let (phase, range) = phases().into_iter().find(|(_, r)| r.contains(&step)).unwrap();
        let spikes = brain.spikes();
        let mut orn_all = (0.0, 0usize);
        for (id, indices) in groups {
            let fired = indices.iter().filter(|&&i| spikes[i as usize]).count() as f64;
            *counts.entry(format!("{phase}.{id}")).or_default() += fired / indices.len() as f64;
            if id.starts_with("orn") {
                orn_all.0 += fired;
                orn_all.1 += indices.len();
            }
        }
        *counts.entry(format!("{phase}.ornAll")).or_default() += orn_all.0 / orn_all.1 as f64;
        *counts.entry(format!("{phase}.pnAll")).or_default() += groups
            .iter()
            .filter(|(id, _)| id.starts_with("pn"))
            .flat_map(|(_, v)| v.iter())
            .filter(|&&i| spikes[i as usize])
            .count() as f64
            / groups.iter().filter(|(id, _)| id.starts_with("pn")).map(|(_, v)| v.len()).sum::<usize>() as f64;

        let steps_in_phase = range.len() as f64;
        let mut mean = |metric: &str, value: f64| {
            *readouts.entry(format!("{phase}.{metric}")).or_default() += value / steps_in_phase;
        };
        for g in &out.groups {
            if ["turnL", "turnR"].contains(&g.id.as_str()) {
                mean(&format!("{}SpikeFraction", g.id), g.spike_fraction);
                mean(&format!("{}MeanVoltage", g.id), g.mean_voltage);
            }
        }
        mean("motorTurn", out.motor.turn);
        mean("motorFlightTurn", out.motor.flight_turn);
        mean("motorThrust", out.motor.thrust);
        mean("networkSpikesPerStep", f64::from(out.spike_count));
    }
    // Each phase is exactly WINDOW_SECONDS long, so summed per-neuron spikes / 0.5 s is spikes/second.
    let rates = counts.into_iter().map(|(k, v)| (k, v / WINDOW_SECONDS)).collect();
    Ok(Run { rates, readouts })
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
    let stimulated: Vec<u32> = groups
        .iter()
        .filter(|(id, _)| id.starts_with("orn"))
        .flat_map(|(_, v)| v.iter().copied())
        .collect();
    if stimulated.len() != 48 {
        return Err("expected all 48 annotated ORN_DA2 bodies".into());
    }
    if groups["ornL"].is_empty() || groups["ornR"].is_empty() {
        return Err("stimulus is not bilateral".into());
    }
    let readout_indices = motor_readout_indices(&graph);
    if stimulated.iter().any(|i| readout_indices.contains(i)) {
        return Err("stimulus would drive a motor readout directly".into());
    }

    // --- Calibration: seed 0 only, bisect on the ORN observable, never look downstream. ---
    let mut calibrations = serde_json::Map::new();
    let mut frozen: BTreeMap<String, (f64, Run)> = BTreeMap::new();
    for (label, target) in TARGETS {
        let (mut lo, mut hi) = BRACKET;
        let mut iterations = vec![];
        let mut best: Option<(f64, f64, Run)> = None;
        for iteration in 0..MAX_ITERATIONS {
            let current = 0.5 * (lo + hi);
            let observed = run(&graph, &groups, &stimulated, CALIBRATION_SEED, Some(current))?;
            let evoked = observed.orn_evoked_hz();
            let error = evoked - target;
            iterations.push(json!({
                "iteration": iteration, "bracket": [lo, hi], "current": current,
                "ornEvokedHz": evoked, "errorHz": error,
            }));
            eprintln!(
                "{label} iter {iteration}: current {current:.6} -> {evoked:.3} Hz (target {target:.3}, err {error:+.3}) @{:.1}s",
                start.elapsed().as_secs_f64()
            );
            let improved = best.as_ref().is_none_or(|(_, e, _)| error.abs() < e.abs());
            if improved {
                best = Some((current, error, observed));
            }
            if error.abs() <= TOLERANCE_HZ {
                break;
            }
            if evoked < target {
                lo = current;
            } else {
                hi = current;
            }
        }
        let (current, error, observed) = best.expect("at least one iteration");
        calibrations.insert(
            label.into(),
            json!({
                "targetHz": target, "chosenCurrent": current, "realizedOrnEvokedHz": observed.orn_evoked_hz(),
                "errorHz": error, "converged": error.abs() <= TOLERANCE_HZ,
                "iterationsUsed": iterations.len(), "iterations": iterations,
                "calibrationSeed": CALIBRATION_SEED,
                "seed0Rates": observed.rates, "seed0Readouts": observed.readouts,
            }),
        );
        frozen.insert(label.into(), (current, observed));
    }

    // --- Validation: frozen currents, unseen seeds, matched no-current arm for drift. ---
    let mut validations = vec![];
    for seed in VALIDATION_SEEDS {
        let mut arms = serde_json::Map::new();
        for (label, current) in [
            ("noCurrent", None),
            ("low", Some(frozen["low"].0)),
            ("high", Some(frozen["high"].0)),
        ] {
            let observed = run(&graph, &groups, &stimulated, seed, current)?;
            let target = TARGETS.iter().find(|(l, _)| *l == label).map(|(_, t)| *t);
            arms.insert(
                label.into(),
                json!({
                    "current": current, "ornEvokedHz": observed.orn_evoked_hz(),
                    "targetHz": target, "errorHz": target.map(|t| observed.orn_evoked_hz() - t),
                    "rates": observed.rates, "readouts": observed.readouts,
                }),
            );
        }
        eprintln!("validation seed {seed} at {:.1}s", start.elapsed().as_secs_f64());
        validations.push(json!({"seed": seed, "arms": arms}));
    }

    let output = json!({
        "graphSha256": graph.manifest.graph_hash,
        "graphDirectory": path,
        "source": {
            "file": "specs/help-the-fly-escape/assets/evidence/33/geosmin-encoding/control-responses.json",
            "articleDOI": "10.7554/eLife.51040", "dataDOI": "10.7554/eLife.51040.009",
            "responseDefinition": "stimulated minus unstimulated firing, spikes/sec; not absolute firing rate and not airborne concentration",
            "targetsHz": TARGETS.iter().map(|(l, t)| json!({"label": l, "hz": t})).collect::<Vec<_>>(),
        },
        "protocol": {
            "dtMsAssumed": DT_MS,
            "dtMsMeaning": "experiment-local unit assignment for input calibration only; not validated physiology and not the gameplay timebase",
            "brainDynamicsChanged": false,
            "steps": STEPS, "beforeSteps": [BEFORE.start, BEFORE.end], "pulseSteps": [PULSE.start, PULSE.end],
            "afterSteps": [AFTER.start, AFTER.end], "windowSeconds": WINDOW_SECONDS,
            "observable": "ORN aggregate (48 neurons) during-minus-before spikes per neuron / 0.5 s",
            "bracket": [BRACKET.0, BRACKET.1], "maxIterations": MAX_ITERATIONS, "toleranceHz": TOLERANCE_HZ,
            "stimulatedNeurons": stimulated.len(),
            "stimulatedGroups": groups.iter().map(|(k, v)| (k.clone(), v.len())).collect::<BTreeMap<_, _>>(),
            "directMotorInput": false, "bilateral": true,
        },
        "calibration": calibrations,
        "validation": validations,
        "elapsedSeconds": start.elapsed().as_secs_f64(),
        "limits": "Only the ORN input current is fitted, to a receptor-level evoked rate, under an assumed \
1 ms step. Downstream PN and turning values were never used to select the current and are reported as \
observations only. A fitted input does NOT validate the downstream model, the decoder, the extraction, \
or any behavioural claim. No body, no odor field, no gameplay, no gain sweep, no production edit.",
    });
    std::fs::create_dir_all(&out_dir)?;
    std::fs::write(format!("{out_dir}/rate-calibration.json"), serde_json::to_string_pretty(&output)?)?;
    println!("{}", serde_json::to_string_pretty(&output["calibration"])?);
    Ok(())
}
