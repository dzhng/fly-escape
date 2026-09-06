//! Matched actual-graph interventions; taste currents never target motor readouts.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    body::{
        Body, BodyConfig, BodyEventKind, BodyMode, BodyPose, BodyWorld, ContactRegion, ExitOpening,
        TerminalOutcome,
    },
    environment::{Geometry, Point, RectRoom, Wall},
    Brain, Graph, PRNG_ID,
};
use std::{collections::HashSet, sync::Arc, time::Instant};

const WARMUP: usize = 60;
const MEASURE: usize = 100;
const N: usize = 30;
const METRICS: [&str; 7] = [
    "proboscisVoltage",
    "proboscisSpikeFraction",
    "landingLVoltage",
    "landingLSpikeFraction",
    "landingRVoltage",
    "landingRSpikeFraction",
    "flightThrust",
];
#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SeedResult {
    seed: u64,
    means: [f64; 7],
    minima: [f64; 7],
    maxima: [f64; 7],
    proboscis_above_threshold_fraction: f64,
    landing_above_threshold_fraction: f64,
    flight_above_threshold_fraction: f64,
    mode_ticks: [usize; 3],
    mode_transitions: usize,
    feeding_starts: usize,
    final_reserve: f64,
    terminal_outcome: Option<TerminalOutcome>,
    terminal_tick: Option<usize>,
    trace: Vec<[f64; 7]>,
}
fn group_indices(graph: &Graph, id: &str) -> Vec<u32> {
    graph
        .manifest
        .groups
        .iter()
        .find(|g| g.id == id)
        .unwrap()
        .indices
        .clone()
}
fn arena() -> Geometry {
    Geometry {
        solids: vec![],
        rooms: vec![RectRoom {
            id: 1,
            min: Point { x: 0., z: 0. },
            max: Point { x: 100., z: 100. },
        }],
        walls: vec![
            Wall {
                a: Point { x: 0., z: 0. },
                b: Point { x: 100., z: 0. },
            },
            Wall {
                a: Point { x: 0., z: 100. },
                b: Point { x: 100., z: 100. },
            },
            Wall {
                a: Point { x: 0., z: 0. },
                b: Point { x: 0., z: 100. },
            },
            Wall {
                a: Point { x: 100., z: 0. },
                b: Point { x: 100., z: 49. },
            },
            Wall {
                a: Point { x: 100., z: 51. },
                b: Point { x: 100., z: 100. },
            },
        ],
    }
}
fn run(
    graph: &Arc<Graph>,
    seed: u64,
    inputs: &[u32],
    gain: f64,
    silence: &[u32],
) -> Result<SeedResult, String> {
    let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, 0));
    for _ in 0..WARMUP {
        brain.step();
    }
    brain.set_silenced_neurons(silence)?;
    brain.set_external_current(&inputs.iter().map(|&i| (i, gain)).collect::<Vec<_>>())?;
    let geometry = arena();
    let food = [ContactRegion {
        center: Point { x: 50., z: 50. },
        radius: 40.,
    }];
    let world = BodyWorld::new(
        &geometry,
        &food,
        &[],
        ExitOpening {
            a: Point { x: 100., z: 49. },
            b: Point { x: 100., z: 51. },
            outward: Point { x: 1., z: 0. },
        },
        1000,
    )?;
    let config = BodyConfig::default();
    let mut body = Body::new(
        BodyPose {
            position: Point { x: 50., z: 50. },
            heading: 0.,
        },
        5.,
        config.clone(),
    )?;
    let mut result = SeedResult {
        seed,
        means: [0.; 7],
        minima: [f64::INFINITY; 7],
        maxima: [f64::NEG_INFINITY; 7],
        proboscis_above_threshold_fraction: 0.,
        landing_above_threshold_fraction: 0.,
        flight_above_threshold_fraction: 0.,
        mode_ticks: [0; 3],
        mode_transitions: 0,
        feeding_starts: 0,
        final_reserve: 0.,
        terminal_outcome: None,
        terminal_tick: None,
        trace: vec![],
    };
    for tick in 1..=MEASURE {
        let out = brain.step();
        let p = out.groups.iter().find(|g| g.id == "proboscis").unwrap();
        let l = out.groups.iter().find(|g| g.id == "landingL").unwrap();
        let r = out.groups.iter().find(|g| g.id == "landingR").unwrap();
        let values = [
            p.mean_voltage,
            p.spike_fraction,
            l.mean_voltage,
            l.spike_fraction,
            r.mean_voltage,
            r.spike_fraction,
            out.motor.flight_thrust,
        ];
        for (i, &value) in values.iter().enumerate() {
            result.means[i] += value / MEASURE as f64;
            result.minima[i] = result.minima[i].min(value);
            result.maxima[i] = result.maxima[i].max(value);
        }
        result.proboscis_above_threshold_fraction +=
            f64::from(values[1] > config.proboscis_threshold);
        result.landing_above_threshold_fraction +=
            f64::from((values[3] + values[5]) / 2. > config.landing_threshold);
        result.flight_above_threshold_fraction += f64::from(values[6] > config.takeoff_threshold);
        let body_active = body.state().outcome.is_none();
        let events = body.step(&out, &world, Point::default(), 0.1, tick as u32)?;
        result.mode_transitions += events
            .iter()
            .filter(|e| matches!(e.kind, BodyEventKind::ModeChanged { .. }))
            .count();
        result.feeding_starts += events
            .iter()
            .filter(|e| e.kind == BodyEventKind::FeedingStarted)
            .count();
        if body_active {
            result.mode_ticks[match body.state().mode {
                BodyMode::Walking => 0,
                BodyMode::Flying => 1,
                BodyMode::Feeding => 2,
            }] += 1;
            if body.state().outcome.is_some() {
                result.terminal_tick = Some(tick);
            }
        }
        if seed == 0 {
            result.trace.push(values);
        }
    }
    result.final_reserve = body.state().reserve;
    result.terminal_outcome = body.state().outcome;
    result.proboscis_above_threshold_fraction /= MEASURE as f64;
    result.landing_above_threshold_fraction /= MEASURE as f64;
    result.flight_above_threshold_fraction /= MEASURE as f64;
    Ok(result)
}
fn stats(values: &[f64]) -> Value {
    let n = values.len() as f64;
    let mean = values.iter().sum::<f64>() / n;
    let sd = (values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / (n - 1.)).sqrt();
    let half = 2.045229642 * sd / n.sqrt();
    json!({"mean":mean,"sdAcrossSeeds":sd,"ci95":[mean-half,mean+half],"positiveSeeds":values.iter().filter(|&&v|v>0.).count(),"negativeSeeds":values.iter().filter(|&&v|v<0.).count()})
}
fn summary(results: &[SeedResult], baseline: Option<&[SeedResult]>) -> Value {
    let mut metrics = serde_json::Map::new();
    for (i, name) in METRICS.iter().enumerate() {
        metrics.insert(
            name.to_string(),
            stats(
                &results
                    .iter()
                    .enumerate()
                    .map(|(s, v)| v.means[i] - baseline.map_or(0., |b| b[s].means[i]))
                    .collect::<Vec<_>>(),
            ),
        );
    }
    json!(metrics)
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    let gain_one_only = match args.get(3).map(String::as_str) {
        None => false,
        Some("--gain-one-only") => true,
        _ => return Err("unknown probe option".into()),
    };
    let path = args
        .get(1)
        .ok_or("Pass graph directory and evidence output JSON")?;
    let output = args.get(2).ok_or("Pass evidence output JSON")?;
    let bytes = std::fs::read(format!("{path}/graph.bin"))?;
    let manifest = std::fs::read_to_string(format!("{path}/manifest.json"))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    let taste = group_indices(&graph, "taste");
    let proboscis = group_indices(&graph, "proboscis");
    let landing: Vec<_> = group_indices(&graph, "landingL")
        .into_iter()
        .chain(group_indices(&graph, "landingR"))
        .collect();
    let motor = &graph.manifest.motor;
    let readouts: HashSet<_> = proboscis
        .iter()
        .chain(&landing)
        .chain(&motor.dn_left)
        .chain(&motor.dn_right)
        .chain(&motor.mn_left)
        .chain(&motor.mn_right)
        .copied()
        .chain(
            [
                "OLFACTORY_DN_LEFT",
                "OLFACTORY_DN_RIGHT",
                "FLIGHT_DN_LEFT",
                "FLIGHT_DN_RIGHT",
            ]
            .into_iter()
            .flat_map(|id| graph.pathway(id).iter().copied()),
        )
        .collect();
    let inputs: Vec<_> = taste
        .iter()
        .copied()
        .filter(|i| !readouts.contains(i))
        .collect();
    if inputs.is_empty() {
        return Err("No taste sensory neurons remain after motor exclusion".into());
    }
    let start = Instant::now();
    let baseline: Vec<_> = (0..N)
        .map(|s| run(&graph, s as u64, &[], 0., &[]))
        .collect::<Result<_, _>>()?;
    eprintln!(
        "baseline after {:.1}s: {}",
        start.elapsed().as_secs_f64(),
        summary(&baseline, None)
    );
    let mut rows = vec![];
    let mut budget_stopped = false;
    // Gain one and its controls are first. Extra gains run only while the four-minute budget permits.
    for (label, gain, silence, stimulus) in [
        ("taste", 1., &[][..], inputs.as_slice()),
        (
            "proboscisAblatedTaste",
            1.,
            proboscis.as_slice(),
            inputs.as_slice(),
        ),
        ("tasteAblatedBaseline", 0., taste.as_slice(), &[][..]),
        ("tasteAblatedTaste", 1., taste.as_slice(), inputs.as_slice()),
        ("taste", 0.1, &[][..], inputs.as_slice()),
        ("taste", 0.3, &[][..], inputs.as_slice()),
        ("taste", 3., &[][..], inputs.as_slice()),
    ] {
        if gain_one_only && rows.len() == 2 {
            break;
        }
        let estimated_arm = start.elapsed().as_secs_f64() / (rows.len() + 1) as f64;
        if start.elapsed().as_secs_f64() + estimated_arm > 230. {
            budget_stopped = true;
            break;
        }
        let samples: Vec<_> = (0..N)
            .map(|s| run(&graph, s as u64, stimulus, gain, silence))
            .collect::<Result<_, _>>()?;
        eprintln!(
            "{label} gain={gain} after {:.1}s: {}",
            start.elapsed().as_secs_f64(),
            summary(&samples, Some(&baseline))
        );
        rows.push(json!({"condition":label,"gain":gain,"silencedIndices":silence,"means":summary(&samples,None),"minusBaseline":summary(&samples,Some(&baseline)),"seeds":samples}));
    }
    let ablated_baseline = rows
        .iter()
        .find(|r| r["condition"] == "tasteAblatedBaseline")
        .map(|r| serde_json::from_value::<Vec<SeedResult>>(r["seeds"].clone()))
        .transpose()?;
    if let Some(control) = ablated_baseline {
        for row in &mut rows {
            if row["condition"] == "tasteAblatedTaste" {
                let samples: Vec<SeedResult> = serde_json::from_value(row["seeds"].clone())?;
                row["minusMatchedAblatedBaseline"] = summary(&samples, Some(&control));
            }
        }
    }
    let source_hashes: Value = [
        ("lif.rs", include_str!("../src/lif.rs")),
        ("body.rs", include_str!("../src/body.rs")),
        ("graph.rs", include_str!("../src/graph.rs")),
        ("feeding_probe.rs", include_str!("feeding_probe.rs")),
    ]
    .into_iter()
    .map(|(name, text)| {
        (
            name.to_string(),
            json!(format!("{:x}", Sha256::digest(text.as_bytes()))),
        )
    })
    .collect();
    let evidence = json!({"graphHash":graph.manifest.graph_hash,"manifestHash":format!("{:x}",Sha256::digest(manifest.as_bytes())),"graphProvenance":graph.manifest.provenance,"sourceHashes":source_hashes,"prng":PRNG_ID,"rootSeeds":(0..N).collect::<Vec<_>>(),"flyId":0,"warmupTicks":WARMUP,"measurementTicks":MEASURE,"lifParams":sim::LifParams::default(),"bodyConfig":BodyConfig::default(),"gainOneOnly":gain_one_only,"discreteReadout":"Emitted spike fraction for proboscis/landing; latched feeding; one-second minimum post-landing ground dwell","metricOrder":METRICS,"modeOrder":["walking","flying","feeding"],"stimulatedIndices":inputs,"tasteIndices":taste,"excludedReadoutIndices":taste.iter().filter(|i|readouts.contains(i)).collect::<Vec<_>>(),"baseline":{"means":summary(&baseline,None),"seeds":baseline},"conditions":"All arms have matched noise streams and 60 unstimulated warmup ticks. Current/ablation begins afterward for 100 neural ticks. Taste group receives fixed positive input, excluding every locomotion/proboscis/landing readout. Ablation clamps neurons to zero including external/synaptic input. No field feedback. Body starts with reserve 5 on a large food disk; receives actual StepOutput at dt=.1, with zero wind. Contact does not choose current in this intervention; zero-current baseline has identical contact. Body mode/reserve observations are provisional decoder feasibility, not a feeding behavioral acceptance claim. Neural measurement independently continues to its fixed 100-tick window; terminal body state is frozen and excluded from subsequent mode-tick counts.","uncertainty":"Paired seed means, two-sided Student t(29) 95% interval. Descriptive sweep without multiple-comparison correction. Trace contains seed zero only; each seed retains mean/range and threshold fractions.","elapsedSeconds":start.elapsed().as_secs_f64(),"runtimeBudgetSeconds":240,"budgetStopped":budget_stopped,"results":rows});
    std::fs::write(output, serde_json::to_string_pretty(&evidence)?)?;
    Ok(())
}
