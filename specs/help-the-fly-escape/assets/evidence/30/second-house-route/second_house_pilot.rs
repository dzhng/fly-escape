//! Scratch pilot: paired timed-campaign placement comparison on the second authored
//! house (turn-the-corner), through the real Graph + Attempt. No motion, steering or
//! policy shortcuts; plans are validated by the production placement owner before any
//! attempt is constructed. Optional `speedScale` is a scratch pacing candidate that
//! scales only bodyConfig walkSpeed/flightSpeed; nothing else is touched.
//!
//! Usage: second_house_pilot GRAPH_DIR PLANS_JSON SEEDS_CSV OUTPUT_DIR
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    attempt::*,
    body::{BodyMode, TerminalOutcome},
    environment::Point,
    placement::Placement,
    Graph,
};
use std::{collections::BTreeMap, sync::Arc, time::Instant};

const LEVEL_SOURCE: &str = include_str!("../../../apps/web/src/levels/turn-the-corner.ts");

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Plan {
    label: String,
    #[serde(default)]
    placements: Vec<Placement>,
    /// Scratch pacing candidate only; 1.0 leaves the shipped body config untouched.
    #[serde(default = "one")]
    speed_scale: f64,
}
fn one() -> f64 {
    1.
}

/// Read the authored TypeScript module the game ships, so the pilot cannot drift
/// into a private copy of the level.
fn content() -> (LevelDef, AttemptTuning) {
    let start = LEVEL_SOURCE.find("= {").unwrap() + 2;
    let end = LEVEL_SOURCE.rfind("};").unwrap() + 1;
    let mut value: Value = serde_json::from_str(&LEVEL_SOURCE[start..end]).unwrap();
    (
        serde_json::from_value(value["level"].take()).unwrap(),
        serde_json::from_value(value["tuning"].take()).unwrap(),
    )
}

/// Named openings in the authored walls, as (label, x range, z range) bands that
/// straddle each gap by 0.5 m on both sides.
const DOORWAYS: [(&str, f64, f64, f64, f64); 6] = [
    ("A-room4-room3", 1.2, 2.1, 5.5, 6.5),
    ("C-room1-room3", 1.8, 2.7, 4.0, 5.0),
    ("B-room2-room3", 6.0, 6.9, 4.0, 5.0),
    ("D-room1-room2", 4.3, 5.3, 2.1, 3.0),
    ("E-room5-room3", 4.35, 5.25, 5.5, 6.5),
    ("F-room6-room3", 6.9, 7.8, 5.5, 6.5),
];

#[derive(Clone)]
struct FlyTrace {
    landing_ticks: u32,
    walking_ticks: u32,
    flying_ticks: u32,
    feeding_ticks: u32,
    feeding_bouts: u32,
    landings: u32,
    takeoffs: u32,
    terminal_tick: Option<u32>,
    outcome: Option<TerminalOutcome>,
    min_exit_distance: f64,
    rooms: BTreeMap<u32, u32>,
    off_room_ticks: u32,
    doorway_ticks: [u32; DOORWAYS.len()],
    near_placement_ticks: Vec<u32>,
    final_position: (f64, f64),
}
impl FlyTrace {
    fn new(placements: usize) -> Self {
        Self {
            landing_ticks: 0,
            walking_ticks: 0,
            flying_ticks: 0,
            feeding_ticks: 0,
            feeding_bouts: 0,
            landings: 0,
            takeoffs: 0,
            terminal_tick: None,
            outcome: None,
            min_exit_distance: f64::INFINITY,
            rooms: BTreeMap::new(),
            off_room_ticks: 0,
            doorway_ticks: [0; DOORWAYS.len()],
            near_placement_ticks: vec![0; placements],
            final_position: (0., 0.),
        }
    }
}

fn distance(a: Point, b: Point) -> f64 {
    (a.x - b.x).hypot(a.z - b.z)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 5 {
        return Err("Usage: second_house_pilot GRAPH_DIR PLANS_JSON SEEDS_CSV OUTPUT_DIR".into());
    }
    let plans_text = std::fs::read_to_string(&args[2])?;
    let plans: Vec<Plan> = serde_json::from_str(&plans_text)?;
    let seeds: Vec<u64> = args[3]
        .split(',')
        .map(|s| s.trim().parse::<u64>())
        .collect::<Result<_, _>>()?;
    let (shipped_level, tuning) = content();
    // Production owner decides legality; the pilot never re-implements the rules.
    for plan in &plans {
        if !(plan.speed_scale.is_finite() && plan.speed_scale > 0.) {
            return Err(format!("plan {} has a non-positive speed scale", plan.label).into());
        }
        sim::placement::resolve_placements(&shipped_level, &plan.placements)
            .map_err(|e| format!("plan {} rejected by resolve_placements: {e}", plan.label))?;
        eprintln!(
            "plan {} accepted by resolve_placements ({} placements, speedScale {})",
            plan.label,
            plan.placements.len(),
            plan.speed_scale
        );
    }
    let bytes = std::fs::read(format!("{}/graph.bin", args[1]))?;
    let manifest = std::fs::read_to_string(format!("{}/manifest.json", args[1]))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    drop(bytes);
    let exit_mid = Point {
        x: (shipped_level.exit.a.x + shipped_level.exit.b.x) / 2.,
        z: (shipped_level.exit.a.z + shipped_level.exit.b.z) / 2.,
    };

    for &seed in &seeds {
        for plan in &plans {
            let path = format!("{}/{}-{}.json", args[4], plan.label, seed);
            if std::fs::metadata(&path).is_ok() {
                eprintln!("skip existing {path}");
                continue;
            }
            let mut level = shipped_level.clone();
            level.body_config.walk_speed *= plan.speed_scale;
            level.body_config.flight_speed *= plan.speed_scale;
            let start = Instant::now();
            let spec = Attempt::describe(
                &graph,
                &level,
                &tuning,
                &format!("pilot-{}-{seed}", plan.label),
                seed,
                20,
                &plan.placements,
            )?;
            let mut attempt =
                Attempt::new(graph.clone(), level.clone(), tuning.clone(), spec.clone())?;
            let mut traces = vec![FlyTrace::new(plan.placements.len()); 20];
            let result = loop {
                let frame = attempt.step()?.ok_or("missing terminal frame")?;
                for fly in &frame.flies {
                    let trace = &mut traces[fly.id as usize];
                    let position = fly.body.pose.position;
                    if fly.body.outcome.is_none() {
                        match fly.body.mode {
                            BodyMode::Feeding => trace.feeding_ticks += 1,
                            BodyMode::Landing => trace.landing_ticks += 1,
                            BodyMode::Walking => trace.walking_ticks += 1,
                            BodyMode::Flying => trace.flying_ticks += 1,
                        }
                        match level.geometry.room_at(position) {
                            Some(id) => *trace.rooms.entry(id).or_default() += 1,
                            None => trace.off_room_ticks += 1,
                        }
                        for (i, d) in DOORWAYS.iter().enumerate() {
                            if (d.1..=d.2).contains(&position.x) && (d.3..=d.4).contains(&position.z)
                            {
                                trace.doorway_ticks[i] += 1;
                            }
                        }
                        for (i, p) in plan.placements.iter().enumerate() {
                            if distance(position, p.position) <= 0.4 {
                                trace.near_placement_ticks[i] += 1;
                            }
                        }
                        trace.min_exit_distance =
                            trace.min_exit_distance.min(distance(position, exit_mid));
                    }
                    trace.final_position = (position.x, position.z);
                    for event in &fly.events {
                        match event.kind {
                            sim::body::BodyEventKind::FeedingStarted => trace.feeding_bouts += 1,
                            sim::body::BodyEventKind::ModeChanged { from, to } => {
                                if to == BodyMode::Landing || to == BodyMode::Walking {
                                    if from == BodyMode::Flying {
                                        trace.landings += 1;
                                    }
                                } else if to == BodyMode::Flying {
                                    trace.takeoffs += 1;
                                }
                            }
                            sim::body::BodyEventKind::Terminal { outcome } => {
                                trace.terminal_tick = Some(frame.tick);
                                trace.outcome = Some(outcome);
                            }
                            _ => {}
                        }
                    }
                }
                if let Some(result) = frame.result {
                    break result;
                }
            };
            let flies: Vec<_> = traces
                .iter()
                .enumerate()
                .map(|(id, t)| {
                    json!({"id":id,"outcome":t.outcome,"terminalTick":t.terminal_tick,
                        "feedingTicks":t.feeding_ticks,"feedingBouts":t.feeding_bouts,
                        "landings":t.landings,"takeoffs":t.takeoffs,
                        "landingTicks":t.landing_ticks,"walkingTicks":t.walking_ticks,
                        "flyingTicks":t.flying_ticks,"roomTicks":t.rooms,
                        "offRoomTicks":t.off_room_ticks,
                        "doorwayTicks":DOORWAYS.iter().enumerate()
                            .map(|(i,d)|(d.0.to_string(),t.doorway_ticks[i]))
                            .collect::<BTreeMap<_,_>>(),
                        "nearPlacementTicks":t.near_placement_ticks,
                        "minExitDistance":t.min_exit_distance,
                        "finalPosition":{"x":t.final_position.0,"z":t.final_position.1}})
                })
                .collect();
            let report = json!({
                "plan":plan.label,"seed":seed,"placements":plan.placements,
                "speedScale":plan.speed_scale,
                "walkSpeed":level.body_config.walk_speed,
                "flightSpeed":level.body_config.flight_speed,
                "result":result,"spec":spec,
                "graphHash":graph.manifest.graph_hash,
                "manifestHash":format!("{:x}",Sha256::digest(manifest.as_bytes())),
                "levelSourceHash":format!("{:x}",Sha256::digest(LEVEL_SOURCE.as_bytes())),
                "plansHash":format!("{:x}",Sha256::digest(plans_text.as_bytes())),
                "pilotSourceHash":format!("{:x}",Sha256::digest(include_bytes!("second_house_pilot.rs"))),
                "simulationBuildId":SIMULATION_BUILD_ID,
                "neurons":graph.neuron_count(),"edges":graph.edge_count(),
                "durationTicks":level.duration_ticks,
                "proximityRadius":0.4,
                "doorwayBands":DOORWAYS.iter().map(|d|json!({"label":d.0,
                    "minX":d.1,"maxX":d.2,"minZ":d.3,"maxZ":d.4})).collect::<Vec<_>>(),
                "wallSeconds":start.elapsed().as_secs_f64(),
                "flies":flies});
            std::fs::write(&path, serde_json::to_string_pretty(&report)?)?;
            eprintln!(
                "seed {seed} {}: {} in {:.1}s -> {path}",
                plan.label,
                serde_json::to_string(&result)?,
                start.elapsed().as_secs_f64()
            );
        }
    }
    Ok(())
}
