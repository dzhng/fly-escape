//! SCRATCH (banana-direction diagnostic): does the production sensory mapping make a banana
//! source attract, repel, or neither?
//!
//! Paired open-arena comparison. Every condition shares one production graph, one production
//! `Body`/`FieldSet`, one production `cue_currents` binding, one body owner and one seed set;
//! the only difference is whether an `AttractiveOdor` source (banana's catalog effect: radius
//! 0.75, rate 1.0) exists and which mirrored site it sits on. No exit cue, no suction, no fan,
//! no food, no competing source, no injected motor command, no sign flip, no gain sweep.
use serde_json::{json, Value};
use sim::{
    attempt::GAME_TICK_SECONDS,
    body::{Body, BodyConfig, BodyMode, BodyPose, ExitOpening, LifeModel},
    chamber::chamber_geometry,
    environment::*,
    sensory::{cue_currents, CuePathway},
    Brain, Graph,
};
use std::{collections::BTreeMap, sync::Arc, time::Instant};

const FLIES: u64 = 24;
const SEEDS: [u64; 3] = [0, 1, 2];
const START: Point = Point { x: 0., z: 0. };
/// Banana's catalog source (crates/sim/src/placement.rs tool_def).
const RADIUS: f64 = 0.75;
const RATE: f64 = 1.0;
/// Early-response window, in ticks (0.1 s each).
const EARLY: usize = 50;
/// Arena half-extent of `chamber_geometry()`; used only to score wall proximity.
const HALF: f64 = 6.0;

/// Production level open-window: fieldConfig verbatim, no fans, no wind.
fn field_config() -> FieldConfig {
    FieldConfig {
        cell_size: 0.2,
        diffusion: 0.5,
        decay: 0.1,
        baseline_brightness: 1.,
        antenna_offset: 0.000_202_072_531_031_628_83,
        antenna_forward: 0.001_414_507_881_697_817_6,
        wind: Point { x: 0., z: 0. },
        fans: vec![],
    }
}

/// Production level open-window: bodyConfig verbatim (timed life, no reserve).
fn body_config() -> BodyConfig {
    BodyConfig {
        life: LifeModel::Timed,
        body_radius: 0.002_632,
        walk_speed: 0.12,
        flight_speed: 0.24,
        turn_gain: 8.,
        takeoff_threshold: 0.2,
        landing_threshold: 0.2,
        landing_dwell_seconds: 1.,
        proboscis_threshold: 0.2,
    }
}

/// Production level open-window tuning.cues verbatim. The inhibitory arm contributes nothing
/// here (no repellent source) but is kept so the mapping under test is the shipped one.
const CUES: [(CuePathway, f64); 2] = [
    (CuePathway::ExcitatoryOdor, 2.0),
    (CuePathway::InhibitoryOdor, 2.0),
];

fn fields(source: Option<Point>, settle_ticks: usize) -> Result<FieldSet, String> {
    let sources = source
        .map(|position| {
            vec![Source {
                position,
                radius: RADIUS,
                rate: RATE,
                kind: SourceKind::AttractiveOdor,
            }]
        })
        .unwrap_or_default();
    // No exit cue: the production level authors `exitCue: null`, so the excitatory channel
    // carries attractive odor alone.
    let mut fields = FieldSet::new(chamber_geometry(), field_config(), sources, None)?;
    for _ in 0..settle_ticks {
        fields.advance(GAME_TICK_SECONDS)?;
    }
    Ok(fields)
}

/// Deterministic per-(seed, fly) start heading, identical across every condition.
fn heading_for(seed: u64, fly: u64) -> f64 {
    let mut h = seed
        .wrapping_mul(0x9e37_79b9_7f4a_7c15)
        .wrapping_add(fly.wrapping_mul(0xbf58_476d_1ce4_e5b9));
    h ^= h >> 33;
    h = h.wrapping_mul(0xff51_afd7_ed55_8ccd);
    h ^= h >> 33;
    (h >> 11) as f64 / (1u64 << 53) as f64 * std::f64::consts::TAU
}

fn wrap_pi(a: f64) -> f64 {
    let t = a.rem_euclid(std::f64::consts::TAU);
    if t > std::f64::consts::PI {
        t - std::f64::consts::TAU
    } else {
        t
    }
}

struct Run {
    metrics: BTreeMap<String, f64>,
}

fn run(
    graph: &Arc<Graph>,
    seed: u64,
    fly: u64,
    source: Option<Point>,
    site: Point,
    steps: usize,
    settle_ticks: usize,
) -> Result<Run, String> {
    let mut fields = fields(source, settle_ticks)?;
    let mut brain = Brain::new(graph.clone(), Brain::seed_for_fly(seed, fly as u32));
    let pose = BodyPose {
        position: START,
        heading: heading_for(seed, fly),
    };
    let mut body = Body::new_in_mode(pose, body_config(), BodyMode::Walking)?;
    // A far, narrow doorway in the corner of the open arena: required by `BodyWorld`, but no
    // suction and no cue point at it. Escapes are counted as contamination, not as an outcome.
    let world = sim::body::BodyWorld::new(
        &chamber_geometry(),
        &[],
        &[],
        &[],
        ExitOpening {
            a: Point { x: HALF, z: 5.8 },
            b: Point { x: HALF, z: 6.0 },
            outward: Point { x: 1., z: 0. },
        },
        steps.max(1) as u32,
    )?;

    let dist = |p: Point| (p.x - site.x).hypot(p.z - site.z);
    let bearing = |p: Point| (site.z - p.z).atan2(site.x - p.x);
    let start_distance = dist(START);
    let mut m: BTreeMap<String, f64> = BTreeMap::new();
    let n = steps as f64;
    let early_n = EARLY.min(steps) as f64;
    let mut previous = START;
    let mut min_distance = start_distance;
    let mut min_wall = HALF;
    let mut alignment_at_early = f64::NAN;
    let start_alignment = wrap_pi(bearing(START) - pose.heading).cos();
    let mut escaped = 0.0;

    for tick in 1..=steps {
        fields.advance(GAME_TICK_SECONDS)?;
        let state_pose = body.state().pose;
        let sample = fields.sample(state_pose.position, state_pose.heading, tick as u32);
        let mut currents = BTreeMap::<u32, f64>::new();
        let mut cue_sum = 0.0;
        for (pathway, gain) in CUES {
            for (index, value) in cue_currents(graph, &sample, pathway, gain)? {
                *currents.entry(index).or_default() += value;
                cue_sum += value;
            }
        }
        let excitatory_left_wins = sample.left.attractive_odor > sample.right.attractive_odor;
        brain.set_external_current(&currents.into_iter().collect::<Vec<_>>())?;
        let output = brain.step();
        body.step(&output, &world, sample.wind, GAME_TICK_SECONDS, tick as u32)?;
        let state = body.state();
        let p = state.pose.position;

        let d = dist(p);
        min_distance = min_distance.min(d);
        let wall = (HALF - p.x.abs()).min(HALF - p.z.abs());
        min_wall = min_wall.min(wall);
        let step_len = (p.x - previous.x).hypot(p.z - previous.z);
        // Bearing error is taken at the pre-step pose, so the recorded turn is the response to it.
        let error = wrap_pi(bearing(state_pose.position) - state_pose.heading);

        *m.entry("meanDistance".into()).or_default() += d / n;
        *m.entry("residenceFraction".into()).or_default() += f64::from(d <= RADIUS) / n;
        *m.entry("approachStepFraction".into()).or_default() += f64::from(d < dist(previous)) / n;
        *m.entry("pathLength".into()).or_default() += step_len;
        *m.entry("meanSpeed".into()).or_default() += step_len / GAME_TICK_SECONDS / n;
        *m.entry("meanTurn".into()).or_default() += output.motor.turn / n;
        *m.entry("meanThrust".into()).or_default() += output.motor.thrust / n;
        *m.entry("meanCueCurrent".into()).or_default() += cue_sum / n;
        *m.entry("detectionFraction".into()).or_default() += f64::from(cue_sum > 0.) / n;
        *m.entry("meanAttractiveOdor".into()).or_default() +=
            (sample.left.attractive_odor + sample.right.attractive_odor) / (2. * n);
        *m.entry("meanAbsOdorDifference".into()).or_default() +=
            (sample.left.attractive_odor - sample.right.attractive_odor).abs() / n;
        // Does the side the odor decode picks agree with the side the source is actually on?
        *m.entry("odorSideMatchesSourceSide".into()).or_default() +=
            f64::from(cue_sum > 0. && (error < 0.) == excitatory_left_wins) / n;
        *m.entry("wallProximityFraction".into()).or_default() += f64::from(wall <= 0.1) / n;
        *m.entry("flyingFraction".into()).or_default() +=
            f64::from(state.mode == BodyMode::Flying) / n;

        if tick <= EARLY {
            // Positive = turned toward the source site; negative = turned away.
            *m.entry("earlySignedTurnToward".into()).or_default() +=
                output.motor.turn * error.signum() / early_n;
            *m.entry("earlyTurnTowardFraction".into()).or_default() +=
                f64::from(output.motor.turn != 0. && output.motor.turn.signum() == error.signum())
                    / early_n;
            *m.entry("earlyDetectionFraction".into()).or_default() += f64::from(cue_sum > 0.) / early_n;
        }
        if tick == EARLY.min(steps) {
            alignment_at_early = wrap_pi(bearing(p) - state.pose.heading).cos();
            m.insert("earlyDistanceChange".into(), d - start_distance);
        }
        previous = p;
        if state.outcome.is_some() {
            escaped = f64::from(tick < steps);
            break;
        }
    }

    m.insert("startDistance".into(), start_distance);
    m.insert("finalDistance".into(), dist(previous));
    m.insert("distanceChange".into(), dist(previous) - start_distance);
    m.insert("minDistance".into(), min_distance);
    m.insert("minWallClearance".into(), min_wall);
    m.insert("terminatedEarly".into(), escaped);
    m.insert(
        "earlyAlignmentChange".into(),
        alignment_at_early - start_alignment,
    );
    m.insert(
        "finalAlignmentChange".into(),
        wrap_pi(bearing(previous) - body.state().pose.heading).cos() - start_alignment,
    );
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
        out.insert(
            k,
            json!({ "mean": mean, "sd": sd, "sem": sd / n.sqrt(), "n": runs.len() }),
        );
    }
    Value::Object(out)
}

/// Paired per-fly difference (source minus its matched no-source run on the same stream).
fn paired(source: &BTreeMap<(u64, u64), Run>, control: &BTreeMap<(u64, u64), Run>) -> Value {
    let keys: Vec<String> = source.values().next().unwrap().metrics.keys().cloned().collect();
    let mut out = serde_json::Map::new();
    for k in keys {
        let diffs: Vec<f64> = source
            .iter()
            .filter_map(|(id, r)| control.get(id).map(|c| r.metrics[&k] - c.metrics[&k]))
            .collect();
        let n = diffs.len() as f64;
        let mean = diffs.iter().sum::<f64>() / n;
        let sd = (diffs.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / n).sqrt();
        let sem = sd / n.sqrt();
        out.insert(
            k,
            json!({ "meanDifference": mean, "sd": sd, "sem": sem,
                    "t": if sem > 0. { mean / sem } else { 0. }, "n": diffs.len() }),
        );
    }
    Value::Object(out)
}

/// What the odor field actually looks like along the mirrored axis after settling.
fn profile(offset: f64, settle_ticks: usize) -> Result<Value, String> {
    let f = fields(Some(Point { x: 0., z: offset }), settle_ticks)?;
    let mut rows = vec![];
    for step in 0..=20 {
        let z = offset * step as f64 / 20.;
        let s = f.sample(Point { x: 0., z }, 0., 1);
        rows.push(json!({
            "distanceFromSource": (offset - z).abs(),
            "left": s.left.attractive_odor,
            "right": s.right.attractive_odor,
            "absDifference": (s.left.attractive_odor - s.right.attractive_odor).abs(),
            "detectedAtProductionThreshold":
                s.left.attractive_odor.max(s.right.attractive_odor) >= 0.05
                && (s.left.attractive_odor - s.right.attractive_odor).abs()
                   > 0.0001 * (s.left.attractive_odor + s.right.attractive_odor),
        }));
    }
    Ok(Value::Array(rows))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut args = std::env::args().skip(1);
    let path = args.next().ok_or("Pass production brain directory")?;
    let out_dir = args.next().ok_or("Pass output directory")?;
    let steps: usize = args.next().unwrap_or_else(|| "400".into()).parse()?;
    let offset: f64 = args.next().unwrap_or_else(|| "0.6".into()).parse()?;
    let settle_ticks: usize = args.next().unwrap_or_else(|| "300".into()).parse()?;
    let start = Instant::now();

    let field_profile = profile(offset, settle_ticks)?;
    if std::env::var("PROFILE_ONLY").is_ok() {
        println!("{}", serde_json::to_string_pretty(&field_profile)?);
        return Ok(());
    }

    let graph = Arc::new(Graph::from_bytes(
        &std::fs::read(format!("{path}/graph.bin"))?,
        &std::fs::read_to_string(format!("{path}/manifest.json"))?,
    )?);

    let north = Point { x: 0., z: offset };
    let south = Point { x: 0., z: -offset };
    // (label, source, site scored against)
    let plan: Vec<(String, Option<Point>, Point)> = vec![
        ("control_noSource_scoredVsNorthSite".into(), None, north),
        ("control_noSource_scoredVsSouthSite".into(), None, south),
        ("bananaNorth".into(), Some(north), north),
        ("bananaSouth".into(), Some(south), south),
    ];

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
                let (graph, plan) = (&graph, &plan);
                scope.spawn(move || {
                    batch
                        .iter()
                        .map(|&(i, seed, fly)| {
                            let (_, source, site) = &plan[i];
                            (
                                (i, seed, fly),
                                run(graph, seed, fly, *source, *site, steps, settle_ticks)
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
    let mut by_id: BTreeMap<usize, BTreeMap<(u64, u64), Run>> = BTreeMap::new();
    let mut by_condition_seed: BTreeMap<(usize, u64), Vec<Run>> = BTreeMap::new();
    for ((i, seed, fly), r) in results.into_iter().flatten() {
        by_condition_seed.entry((i, seed)).or_default().push(Run {
            metrics: r.metrics.clone(),
        });
        by_condition.entry(i).or_default().push(Run {
            metrics: r.metrics.clone(),
        });
        by_id.entry(i).or_default().insert((seed, fly), r);
    }

    let mut conditions = serde_json::Map::new();
    for (i, (label, source, site)) in plan.iter().enumerate() {
        let per_seed: serde_json::Map<String, Value> = SEEDS
            .iter()
            .map(|&s| (s.to_string(), summarize(&by_condition_seed[&(i, s)])))
            .collect();
        conditions.insert(
            label.clone(),
            json!({
                "source": source.map(|p| json!({ "x": p.x, "z": p.z })),
                "scoredSite": { "x": site.x, "z": site.z },
                "pooled": summarize(&by_condition[&i]),
                "perSeed": Value::Object(per_seed),
            }),
        );
    }

    let out = json!({
        "experiment": "banana-direction",
        "question": "Does the production ExcitatoryOdor mapping make an AttractiveOdor banana source attract, repel, or neither?",
        "setup": {
            "graph": path,
            "geometry": "chamber_geometry(): single open room [-6,6]^2, four walls, no solids",
            "startPose": { "x": START.x, "z": START.z, "headingRandomizedPerFly": true },
            "mirroredSourceOffsetMeters": offset,
            "sourceKind": "AttractiveOdor",
            "sourceRadius": RADIUS,
            "sourceRate": RATE,
            "sourceProvenance": "crates/sim/src/placement.rs tool_def(ToolKind::Banana)",
            "cues": [ {"pathway": "excitatoryOdor", "gain": 2.0}, {"pathway": "inhibitoryOdor", "gain": 2.0} ],
            "cueProvenance": "apps/web/src/levels/open-window.ts tuning.cues",
            "fieldConfig": {"cellSize": 0.2, "diffusion": 0.5, "decay": 0.1,
                            "antennaOffset": 0.00020207253103162883, "antennaForward": 0.0014145078816978176,
                            "wind": {"x": 0.0, "z": 0.0}, "fans": []},
            "bodyConfigProvenance": "apps/web/src/levels/open-window.ts level.bodyConfig",
            "tickSeconds": GAME_TICK_SECONDS,
            "steps": steps,
            "settleTicksBeforeStart": settle_ticks,
            "earlyWindowTicks": EARLY,
            "seeds": SEEDS,
            "fliesPerSeed": FLIES,
            "excluded": ["exit cue", "exit suction", "fans", "wind", "food/taste", "competing sources", "physical banana contact geometry"],
        },
        "fieldProfileAlongMirrorAxis": field_profile,
        "conditions": Value::Object(conditions),
        "pairedVsMatchedNoSource": {
            "bananaNorth_minus_control": paired(&by_id[&2], &by_id[&0]),
            "bananaSouth_minus_control": paired(&by_id[&3], &by_id[&1]),
        },
        "runtimeSeconds": start.elapsed().as_secs_f64(),
    });
    std::fs::create_dir_all(&out_dir)?;
    let file = format!("{out_dir}/banana-direction.json");
    std::fs::write(&file, serde_json::to_string_pretty(&out)?)?;
    println!("wrote {file} in {:.1}s", start.elapsed().as_secs_f64());
    Ok(())
}
