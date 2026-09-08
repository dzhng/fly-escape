//! SCRATCH (repellent-object spike): does a geosmin-emitting object move a *walking* fly?
//!
//! Paired moving-fly comparison. Every condition shares one graph, one dynamics, one decoder, one
//! body owner and one seed set; the only difference is whether a `RepellentOdor` source exists and
//! where it sits (mirrored across z). The local field concentration at each antenna drives that
//! side's retained `ORN_DA2` receptors through `sensory::graded_side_currents` — same-side wiring,
//! no motor injection, no sign flip, no force, no fan, and no gain chosen from an outcome.
use serde_json::{json, Value};
use sim::{chamber::{chamber_geometry, Chamber}, environment::*, Brain, Graph};
use std::{collections::BTreeMap, sync::Arc, time::Instant};

const FLIES: u64 = 20;
const SEEDS: [u64; 3] = [0, 1, 2];
const START: Point = Point { x: -2.0, z: 0.0 };
/// Mirrored object placement: 1.0 m to one side of the shared start pose.
const OFFSET: f64 = 1.0;
const RADIUS: f64 = 0.75;
/// Midpoint of the measured no-odor drift (start -> pooled control endpoint 1.63, 1.92), so the
/// plume actually sits on the path a fly walks. Its z-mirror is the unencountered paired placement.
const ON_PATH: Point = Point { x: -0.184, z: 0.959 };
/// Receptor input-current amplitudes. `0.08203125` is the current previously fitted to the eLife
/// 51040 *high* control evoked ORN rate; `0.01171875` to the low one. `2.0` is NOT a biological
/// dose - it is the existing strong native-pulse amplitude, kept only as a saturating comparison.
const LEVELS: [(&str, f64); 3] = [
    ("lowDose_0.01171875", 0.011_718_75),
    ("highDose_0.08203125", 0.082_031_25),
    ("strongActivation_2.0_notABiologicalDose", 2.0),
];

fn fields(source: Option<Point>) -> Result<FieldSet, String> {
    let config = FieldConfig {
        // Same widened antenna span the existing field fixtures use for the observation chamber.
        antenna_offset: 0.15,
        antenna_forward: 0.,
        ..FieldConfig::default()
    };
    let sources = source
        .map(|position| {
            vec![Source {
                position,
                radius: RADIUS,
                rate: 1.,
                kind: SourceKind::RepellentOdor,
            }]
        })
        .unwrap_or_default();
    let mut fields = FieldSet::new(chamber_geometry(), config, sources, None)?;
    for _ in 0..100 {
        fields.advance(0.1)?;
    }
    Ok(fields)
}

struct Run {
    metrics: BTreeMap<String, f64>,
}

fn run(
    graph: &Arc<Graph>,
    seed: u64,
    fly: u64,
    source: Option<Point>,
    receptors: Option<(&Vec<u32>, &Vec<u32>, f64)>,
    steps: usize,
    score_against: Point,
) -> Result<Run, String> {
    let mut chamber = Chamber::with_fields(
        graph.clone(),
        Brain::seed_for_fly(seed, fly as u32),
        fields(source)?,
        None,
    );
    if let Some((l, r, scale)) = receptors {
        chamber.receptor_drive = Some((l.clone(), r.clone(), scale));
    }
    let object = score_against;
    let dist = |x: f64, z: f64| (x - object.x).hypot(z - object.z);
    let mut m: BTreeMap<String, f64> = BTreeMap::new();
    let mut previous = (START.x, START.z);
    let mut min_distance = dist(START.x, START.z);
    let n = steps as f64;
    for _ in 0..steps {
        let f = chamber.step()?;
        let d = dist(f.pose.x, f.pose.z);
        min_distance = min_distance.min(d);
        *m.entry("meanDistance".into()).or_default() += d / n;
        *m.entry("residenceFraction".into()).or_default() +=
            if d <= RADIUS { 1.0 / n } else { 0.0 };
        *m.entry("approachStepFraction".into()).or_default() +=
            if d < dist(previous.0, previous.1) { 1.0 / n } else { 0.0 };
        *m.entry("pathLength".into()).or_default() =
            m.get("pathLength").copied().unwrap_or(0.0)
                + (f.pose.x - previous.0).hypot(f.pose.z - previous.1);
        *m.entry("meanTurn".into()).or_default() += f.neural.motor.turn / n;
        *m.entry("meanThrust".into()).or_default() += f.neural.motor.thrust / n;
        *m.entry("meanRepellentOdor".into()).or_default() +=
            (f.sensory.left.repellent_odor + f.sensory.right.repellent_odor) / (2.0 * n);
        *m.entry("meanAbsOdorDifference".into()).or_default() +=
            (f.sensory.left.repellent_odor - f.sensory.right.repellent_odor).abs() / n;
        previous = (f.pose.x, f.pose.z);
        m.insert("finalX".into(), f.pose.x);
        m.insert("finalZ".into(), f.pose.z);
        m.insert("finalDistance".into(), d);
    }
    m.insert("minDistance".into(), min_distance);
    // Positive = displaced away from the side the object sits on (mirror-symmetric metric).
    let side = if score_against.z >= 0.0 { 1.0 } else { -1.0 };
    m.insert("displacementAwayFromObject".into(), -side * (previous.1 - START.z));
    Ok(Run { metrics: m })
}

fn summarize(runs: &[Run]) -> Value {
    let keys: Vec<String> = runs[0].metrics.keys().cloned().collect();
    let n = runs.len() as f64;
    let mut out = serde_json::Map::new();
    for k in keys {
        let values: Vec<f64> = runs.iter().map(|r| r.metrics[&k]).collect();
        let mean = values.iter().sum::<f64>() / n;
        let sd = (values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n).sqrt();
        out.insert(k, json!({ "mean": mean, "sd": sd, "n": runs.len() }));
    }
    Value::Object(out)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let path = args.next().ok_or("Pass scratch DA2 graph directory")?;
    let out_dir = args.next().ok_or("Pass output directory")?;
    let steps: usize = args.next().unwrap_or_else(|| "600".into()).parse()?;
    let start = Instant::now();
    let graph = Arc::new(Graph::from_bytes(
        &std::fs::read(format!("{path}/graph.bin"))?,
        &std::fs::read_to_string(format!("{path}/manifest.json"))?,
    )?);
    let groups: Value = serde_json::from_str(&std::fs::read_to_string(format!(
        "{path}/da2-groups.json"
    ))?)?;
    let indices = |side: &str| -> Vec<u32> {
        groups["groups"][side]["indices"]
            .as_array()
            .expect("side group")
            .iter()
            .map(|v| v.as_u64().unwrap() as u32)
            .collect()
    };
    let (left, right) = (indices("ornL"), indices("ornR"));

    // (label, source z, receptor scale, z position the metrics are scored against)
    let lateral = |z: f64| Point { x: START.x, z };
    let mut plan: Vec<(String, Option<Point>, Option<f64>, Point)> = vec![
        ("control_noOdor_scoredVsLeftSite".into(), None, None, lateral(OFFSET)),
        ("control_noOdor_scoredVsRightSite".into(), None, None, lateral(-OFFSET)),
        ("control_noOdor_scoredVsOnPathSite".into(), None, None, ON_PATH),
        ("control_noOdor_scoredVsOnPathMirror".into(), None, None, Point { x: ON_PATH.x, z: -ON_PATH.z }),
    ];
    for (name, scale) in LEVELS {
        plan.push((format!("geosminLeft_{name}"), Some(lateral(OFFSET)), Some(scale), lateral(OFFSET)));
        plan.push((format!("geosminRight_{name}"), Some(lateral(-OFFSET)), Some(scale), lateral(-OFFSET)));
        plan.push((format!("geosminOnPath_{name}"), Some(ON_PATH), Some(scale), ON_PATH));
        plan.push((
            format!("geosminOnPathMirror_{name}"),
            Some(Point { x: ON_PATH.x, z: -ON_PATH.z }),
            Some(scale),
            Point { x: ON_PATH.x, z: -ON_PATH.z },
        ));
    }

    let jobs: Vec<(usize, u64, u64)> = plan
        .iter()
        .enumerate()
        .flat_map(|(i, _)| SEEDS.iter().flat_map(move |&s| (0..FLIES).map(move |f| (i, s, f))))
        .collect();
    let threads = std::thread::available_parallelism().map_or(4, |n| n.get()).min(12);
    let chunk = jobs.len().div_ceil(threads);
    let results: Vec<Vec<((usize, u64, u64), Run)>> = std::thread::scope(|scope| {
        let handles: Vec<_> = jobs
            .chunks(chunk)
            .map(|batch| {
                let (graph, plan, left, right) = (&graph, &plan, &left, &right);
                scope.spawn(move || {
                    batch
                        .iter()
                        .map(|&(i, seed, fly)| {
                            let (_, source, scale, score) = &plan[i];
                            let receptors = scale.map(|s| (left, right, s));
                            (
                                (i, seed, fly),
                                run(graph, seed, fly, *source, receptors, steps, *score)
                                    .expect("run"),
                            )
                        })
                        .collect::<Vec<_>>()
                })
            })
            .collect();
        handles.into_iter().map(|h| h.join().unwrap()).collect()
    });

    let mut by_condition: BTreeMap<usize, Vec<Run>> = BTreeMap::new();
    let mut by_condition_seed: BTreeMap<(usize, u64), Vec<Run>> = BTreeMap::new();
    let mut raw = vec![];
    for ((i, seed, fly), r) in results.into_iter().flatten() {
        raw.push(json!({
            "condition": plan[i].0, "seed": seed, "fly": fly,
            "metrics": r.metrics.clone(),
        }));
        by_condition_seed.entry((i, seed)).or_default().push(Run { metrics: r.metrics.clone() });
        by_condition.entry(i).or_default().push(r);
    }
    let summary: serde_json::Map<String, Value> = by_condition
        .iter()
        .map(|(i, runs)| {
            let per_seed: serde_json::Map<String, Value> = SEEDS
                .iter()
                .map(|s| (s.to_string(), summarize(&by_condition_seed[&(*i, *s)])))
                .collect();
            (
                plan[*i].0.clone(),
                json!({ "pooled": summarize(runs), "perSeed": per_seed }),
            )
        })
        .collect();
    let report = json!({
        "protocol": {
            "flies": FLIES, "seeds": SEEDS, "steps": steps,
            "simulatedSecondsPerRun": steps as f64 * 0.1,
            "startPose": {"x": START.x, "z": START.z, "heading": 0.0},
            "objectOffsetMetres": OFFSET, "sourceRadiusMetres": RADIUS,
            "onPathSite": {"x": ON_PATH.x, "z": ON_PATH.z},
            "levels": LEVELS.map(|(n, v)| json!({"label": n, "receptorCurrent": v})),
            "wiring": "repellent-odor concentration at each antenna -> same-side retained ORN_DA2 external current; motor readouts excluded; graph/dynamics/decoder identical across conditions",
        },
        "graphSha256": graph.manifest.graph_hash,
        "receptorCounts": {"left": left.len(), "right": right.len()},
        "summary": summary,
        "raw": raw,
        "elapsedSeconds": start.elapsed().as_secs_f64(),
    });
    std::fs::create_dir_all(&out_dir)?;
    std::fs::write(
        format!("{out_dir}/chamber-results.json"),
        serde_json::to_string_pretty(&report)?,
    )?;
    println!("wrote {out_dir}/chamber-results.json in {:.1}s", start.elapsed().as_secs_f64());
    Ok(())
}
