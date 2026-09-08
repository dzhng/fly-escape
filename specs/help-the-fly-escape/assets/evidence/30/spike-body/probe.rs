//! Scratch spatial-response validation for the spike-fraction olfactory candidate.
//! Production Attempt owner, production graph, cold brains; no fake motor output.
//! One fly, an empty square room and a distant exit isolate the odor response.
use serde_json::json;
use sha2::{Digest, Sha256};
use sim::{
    attempt::*,
    body::*,
    environment::*,
    sensory::CuePathway,
    spawn::{SpawnDef, SpawnMode, SpawnState},
    Graph,
};
use std::{sync::Arc, time::Instant};

const HORIZON: u32 = 150;
const SEEDS: u64 = 30;
const CUE_GAIN: f64 = 2.;
const SOURCE_RADIUS: f64 = 0.75;
const SOURCE_RATE: f64 = 1.;
const SOURCE_DISTANCE: f64 = 1.;
const ROOM: f64 = 6.;

fn point(x: f64, z: f64) -> Point {
    Point { x, z }
}
fn distance(a: Point, b: Point) -> f64 {
    (a.x - b.x).hypot(a.z - b.z)
}
/// Heading zero faces +X and the left antenna samples -Z, so a left source sits at -Z.
fn source_position(side_left: bool) -> Point {
    point(
        0.,
        if side_left {
            -SOURCE_DISTANCE
        } else {
            SOURCE_DISTANCE
        },
    )
}
fn level(mode: SpawnMode, side_left: bool, kind: SourceKind) -> LevelDef {
    let gap = 0.45;
    let walls = vec![
        Wall {
            a: point(-ROOM, -ROOM),
            b: point(ROOM, -ROOM),
        },
        Wall {
            a: point(-ROOM, ROOM),
            b: point(ROOM, ROOM),
        },
        Wall {
            a: point(-ROOM, -ROOM),
            b: point(-ROOM, ROOM),
        },
        Wall {
            a: point(ROOM, -ROOM),
            b: point(ROOM, -gap),
        },
        Wall {
            a: point(ROOM, gap),
            b: point(ROOM, ROOM),
        },
    ];
    LevelDef {
        id: format!(
            "spike-body-{}-{}-{}",
            match mode {
                SpawnMode::Walking => "walking",
                SpawnMode::Flying => "flying",
            },
            if side_left { "left" } else { "right" },
            match kind {
                SourceKind::AttractiveOdor => "attractive",
                _ => "repellent",
            }
        ),
        geometry: Geometry {
            rooms: vec![RectRoom {
                id: 1,
                min: point(-ROOM, -ROOM),
                max: point(ROOM, ROOM),
            }],
            walls,
            solids: vec![],
        },
        // Fixed pose and initial mode; the production spawn owner resolves both.
        spawn: SpawnDef::Fixed {
            states: vec![SpawnState {
                pose: BodyPose {
                    position: point(0., 0.),
                    heading: 0.,
                },
                mode,
            }],
        },
        exit: ExitOpening {
            a: point(ROOM, -gap),
            b: point(ROOM, gap),
            outward: point(1., 0.),
        },
        exit_cue: None,
        food: vec![],
        fixed_objects: vec![],
        zappers: vec![],
        sources: vec![Source {
            position: source_position(side_left),
            radius: SOURCE_RADIUS,
            rate: SOURCE_RATE,
            kind,
        }],
        // Campaign level-one field anatomy, minus its fans and wind.
        field_config: FieldConfig {
            cell_size: 0.2,
            diffusion: 0.5,
            decay: 0.1,
            baseline_brightness: 1.,
            wind: point(0., 0.),
            fans: vec![],
            ..FieldConfig::default()
        },
        // Campaign level-one body policy: timed round, .12/.24 walk/flight, turn gain 8.
        body_config: BodyConfig {
            life: LifeModel::Timed,
            walk_speed: 0.12,
            flight_speed: 0.24,
            turn_gain: 8.,
            ..BodyConfig::default()
        },
        duration_ticks: HORIZON,
        star_thresholds: [1, 8, 15],
        placement_rules: Default::default(),
    }
}
fn tuning(enabled: bool, kind: SourceKind) -> AttemptTuning {
    AttemptTuning {
        cues: if enabled {
            vec![CueInput {
                // Candidate binding: attractive odor drives the excitatory-labelled
                // input population, repellent odor the inhibitory-labelled one.
                pathway: match kind {
                    SourceKind::AttractiveOdor => CuePathway::ExcitatoryOdor,
                    _ => CuePathway::InhibitoryOdor,
                },
                gain: CUE_GAIN,
            }]
        } else {
            vec![]
        },
        taste_gain: 0.,
        silenced_neurons: vec![],
    }
}
#[derive(Clone, Copy)]
struct Case {
    mode: SpawnMode,
    side_left: bool,
    kind: SourceKind,
    enabled: bool,
    seed: u64,
}
fn run(graph: &Arc<Graph>, case: Case) -> Result<serde_json::Value, String> {
    let level = level(case.mode, case.side_left, case.kind);
    let tuning = tuning(case.enabled, case.kind);
    let id = format!("{}-{}-{}", level.id, case.enabled, case.seed);
    let spec = Attempt::describe(graph, &level, &tuning, &id, case.seed, 1, &[])?;
    let mut attempt = Attempt::new(graph.clone(), level.clone(), tuning.clone(), spec.clone())?;
    let initial = attempt.initial_bodies();
    if initial.len() != 1 || initial[0].mode != case.mode.body_mode() {
        return Err(format!(
            "resolved initial mode {:?} is not the requested fixture mode",
            initial.first().map(|b| b.mode)
        ));
    }
    let start = initial[0].pose.position;
    let source = source_position(case.side_left);
    // Unit vector from the spawn toward the source; positive displacement is approach.
    let toward = point(
        (source.x - start.x) / SOURCE_DISTANCE,
        (source.z - start.z) / SOURCE_DISTANCE,
    );
    let mut modes = [0u64; 4];
    let mut closest = distance(start, source);
    let mut last = start;
    let mut path = 0.;
    let mut drive = [0u64; 3];
    let mut sums = [0f64; 5];
    let mut trajectory = vec![];
    let mut final_state = initial[0].clone();
    for tick in 1..=HORIZON {
        let frame = attempt
            .step()?
            .ok_or_else(|| format!("attempt ended before tick {tick}"))?;
        let fly = &frame.flies[0];
        let neural = fly
            .neural
            .as_ref()
            .ok_or_else(|| format!("no neural step at tick {tick}"))?;
        let sample = fly
            .sensory
            .as_ref()
            .ok_or_else(|| format!("no sensory sample at tick {tick}"))?;
        // Independent replay of the adapter's lateral detector on the driven channel.
        let values = match case.kind {
            SourceKind::AttractiveOdor => [
                sample.left.attractive_odor + sample.left.exit_cue,
                sample.right.attractive_odor + sample.right.exit_cue,
            ],
            _ => [sample.left.repellent_odor, sample.right.repellent_odor],
        };
        let detected = values[0].max(values[1]) >= 0.05
            && (values[0] - values[1]).abs() > 0.0001 * (values[0] + values[1]);
        drive[if !detected {
            2
        } else if values[0] > values[1] {
            0
        } else {
            1
        }] += 1;
        for (slot, value) in sums.iter_mut().zip([
            neural.motor.thrust,
            neural.motor.turn,
            neural.motor.flight_thrust,
            neural.motor.flight_turn,
            f64::from(neural.spike_count),
        ]) {
            *slot += value;
        }
        modes[match fly.body.mode {
            BodyMode::Walking => 0,
            BodyMode::Flying => 1,
            BodyMode::Landing => 2,
            BodyMode::Feeding => 3,
        }] += 1;
        let position = fly.body.pose.position;
        closest = closest.min(distance(position, source));
        path += distance(position, last);
        last = position;
        final_state = fly.body.clone();
        if case.seed == 0 {
            trajectory.push([position.x, position.z]);
        }
    }
    let displacement = (last.x - start.x) * toward.x + (last.z - start.z) * toward.z;
    let mean = |i: usize| sums[i] / f64::from(HORIZON);
    Ok(json!({
        "levelId": level.id,
        "initialMode": format!("{:?}", initial[0].mode),
        "sourceSide": if case.side_left { "left" } else { "right" },
        "sourceKind": format!("{:?}", case.kind),
        "cueEnabled": case.enabled,
        "cuePathway": tuning.cues.first().map(|c| format!("{:?}", c.pathway)),
        "seed": case.seed,
        "levelHash": spec.level_hash,
        "tuningHash": spec.tuning_hash,
        "finalDistance": distance(last, source),
        "closestDistance": closest,
        "sourceDirectedDisplacement": displacement,
        "pathLength": path,
        "finalPosition": [last.x, last.z],
        "finalHeading": final_state.pose.heading,
        "outcome": final_state.outcome.map(|o| format!("{o:?}")),
        "modeTicks": {"walking": modes[0], "flying": modes[1], "landing": modes[2], "feeding": modes[3]},
        "cueDriveTicks": {"left": drive[0], "right": drive[1], "undetected": drive[2]},
        "meanMotor": {"thrust": mean(0), "turn": mean(1), "flightThrust": mean(2), "flightTurn": mean(3)},
        "meanSpikeCount": mean(4),
        "trajectory": trajectory,
    }))
}
/// The exact content each arm ran, so the level, source placement and cue tuning
/// are reviewable without rebuilding the probe.
fn fixtures() -> Vec<serde_json::Value> {
    let mut all = vec![];
    for mode in [SpawnMode::Walking, SpawnMode::Flying] {
        for side_left in [true, false] {
            for kind in [SourceKind::AttractiveOdor, SourceKind::RepellentOdor] {
                all.push(json!({
                    "level": level(mode, side_left, kind),
                    "tuningEnabled": tuning(true, kind),
                    "tuningDisabled": tuning(false, kind),
                }));
            }
        }
    }
    all
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    let path = args.get(1).ok_or("Pass graph directory, output JSON, threads")?;
    let output = args.get(2).ok_or("Pass output JSON")?;
    let threads: usize = args.get(3).map_or(Ok(1), |v| v.parse())?;
    let limit: usize = args.get(4).map_or(Ok(usize::MAX), |v| v.parse())?;
    let manifest = std::fs::read_to_string(format!("{path}/manifest.json"))?;
    let bytes = std::fs::read(format!("{path}/graph.bin"))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    let manifest_hash = format!("{:x}", Sha256::digest(manifest.as_bytes()));
    drop(bytes);
    drop(manifest);
    let mut cases = vec![];
    for mode in [SpawnMode::Walking, SpawnMode::Flying] {
        for side_left in [true, false] {
            for kind in [SourceKind::AttractiveOdor, SourceKind::RepellentOdor] {
                for enabled in [true, false] {
                    for seed in 0..SEEDS {
                        cases.push(Case {
                            mode,
                            side_left,
                            kind,
                            enabled,
                            seed,
                        });
                    }
                }
            }
        }
    }
    cases.truncate(limit);
    let start = Instant::now();
    let mut rows: Vec<(usize, serde_json::Value)> = std::thread::scope(|scope| {
        let chunk = cases.len().div_ceil(threads.max(1));
        let handles: Vec<_> = cases
            .chunks(chunk.max(1))
            .enumerate()
            .map(|(block, chunk)| {
                let graph = &graph;
                scope.spawn(move || {
                    chunk
                        .iter()
                        .enumerate()
                        .map(|(i, case)| {
                            run(graph, *case).map(|row| (block * 100_000 + i, row))
                        })
                        .collect::<Result<Vec<_>, String>>()
                })
            })
            .collect();
        handles
            .into_iter()
            .map(|h| h.join().expect("probe thread"))
            .collect::<Result<Vec<_>, String>>()
            .map(|blocks| blocks.into_iter().flatten().collect())
    })?;
    rows.sort_by_key(|(order, _)| *order);
    let seconds = start.elapsed().as_secs_f64();
    eprintln!("{} runs in {seconds:.1}s", rows.len());
    std::fs::write(
        output,
        serde_json::to_string_pretty(&json!({
            "probe": "spike-fraction olfactory candidate, production Attempt spatial response",
            "graphHash": graph.manifest.graph_hash,
            "manifestFileHash": manifest_hash,
            "simulationBuildId": SIMULATION_BUILD_ID,
            "probeSourceHash": format!("{:x}", Sha256::digest(include_str!("spike_body_probe.rs").as_bytes())),
            "horizonTicks": HORIZON,
            "seeds": SEEDS,
            "cueGain": CUE_GAIN,
            "flyCount": 1,
            "wallSeconds": seconds,
            "fixtures": fixtures(),
        }))?,
    )?;
    Ok(())
}
