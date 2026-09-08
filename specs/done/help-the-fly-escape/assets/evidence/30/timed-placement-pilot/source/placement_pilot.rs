//! Scratch pilot: paired timed-campaign placement comparison through the real
//! Graph + Attempt. No motion, steering or policy shortcuts; plans are validated
//! by the production placement owner before any attempt is constructed.
//!
//! Usage: placement_pilot GRAPH_DIR PLANS_JSON SEEDS_CSV OUTPUT_DIR
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    attempt::*,
    body::{BodyMode, TerminalOutcome},
    placement::Placement,
    Graph,
};
use std::{collections::BTreeMap, sync::Arc, time::Instant};

const LEVEL_SOURCE: &str = include_str!("../../../apps/web/src/levels/open-window.ts");

#[derive(Deserialize)]
struct Plan {
    label: String,
    #[serde(default)]
    placements: Vec<Placement>,
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

#[derive(Default, Clone)]
struct FlyTrace {
    feeding_ticks: u32,
    landing_ticks: u32,
    walking_ticks: u32,
    flying_ticks: u32,
    feeding_bouts: u32,
    terminal_tick: Option<u32>,
    outcome: Option<TerminalOutcome>,
    min_exit_distance: f64,
    rooms: BTreeMap<u32, u32>,
    off_room_ticks: u32,
    near_placement_ticks: Vec<u32>,
    final_position: (f64, f64),
}

fn distance(a: sim::environment::Point, b: sim::environment::Point) -> f64 {
    (a.x - b.x).hypot(a.z - b.z)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 5 {
        return Err("Usage: placement_pilot GRAPH_DIR PLANS_JSON SEEDS_CSV OUTPUT_DIR".into());
    }
    let plans_text = std::fs::read_to_string(&args[2])?;
    let plans: Vec<Plan> = serde_json::from_str(&plans_text)?;
    let seeds: Vec<u64> = args[3]
        .split(',')
        .map(|s| s.trim().parse::<u64>())
        .collect::<Result<_, _>>()?;
    let (level, tuning) = content();
    // Production owner decides legality; the pilot never re-implements the rules.
    for plan in &plans {
        sim::placement::resolve_placements(&level, &plan.placements)
            .map_err(|e| format!("plan {} rejected by resolve_placements: {e}", plan.label))?;
    }
    let bytes = std::fs::read(format!("{}/graph.bin", args[1]))?;
    let manifest = std::fs::read_to_string(format!("{}/manifest.json", args[1]))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    drop(bytes);
    let exit_mid = sim::environment::Point {
        x: (level.exit.a.x + level.exit.b.x) / 2.,
        z: (level.exit.a.z + level.exit.b.z) / 2.,
    };

    for &seed in &seeds {
        for plan in &plans {
            let path = format!("{}/{}-{}.json", args[4], plan.label, seed);
            if std::fs::metadata(&path).is_ok() {
                eprintln!("skip existing {path}");
                continue;
            }
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
            let mut attempt = Attempt::new(
                graph.clone(),
                level.clone(),
                tuning.clone(),
                spec.clone(),
            )?;
            let mut traces = vec![FlyTrace::default(); 20];
            for t in traces.iter_mut() {
                t.min_exit_distance = f64::INFINITY;
                t.near_placement_ticks = vec![0; plan.placements.len()];
            }
            let mut events = vec![];
            let mut samples = vec![];
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
                        if matches!(event.kind, sim::body::BodyEventKind::FeedingStarted) {
                            trace.feeding_bouts += 1;
                        }
                        if let sim::body::BodyEventKind::Terminal { outcome } = event.kind {
                            trace.terminal_tick = Some(frame.tick);
                            trace.outcome = Some(outcome);
                        }
                        events.push(json!({"tick":frame.tick,"flyId":fly.id,"event":event,
                            "position":position,"mode":fly.body.mode}));
                    }
                }
                if frame.tick % 250 == 0 || frame.result.is_some() {
                    samples.push(json!({"tick":frame.tick,
                        "flies":frame.flies.iter().map(|f|json!({"id":f.id,
                            "position":f.body.pose.position,"heading":f.body.pose.heading,
                            "mode":f.body.mode,"outcome":f.body.outcome})).collect::<Vec<_>>()}));
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
                        "landingTicks":t.landing_ticks,"walkingTicks":t.walking_ticks,
                        "flyingTicks":t.flying_ticks,"roomTicks":t.rooms,
                        "offRoomTicks":t.off_room_ticks,
                        "nearPlacementTicks":t.near_placement_ticks,
                        "minExitDistance":t.min_exit_distance,
                        "finalPosition":{"x":t.final_position.0,"z":t.final_position.1}})
                })
                .collect();
            let report = json!({
                "plan":plan.label,"seed":seed,"placements":plan.placements,
                "result":result,"spec":spec,
                "graphHash":graph.manifest.graph_hash,
                "manifestHash":format!("{:x}",Sha256::digest(manifest.as_bytes())),
                "levelSourceHash":format!("{:x}",Sha256::digest(LEVEL_SOURCE.as_bytes())),
                "plansHash":format!("{:x}",Sha256::digest(plans_text.as_bytes())),
                "pilotSourceHash":format!("{:x}",Sha256::digest(include_bytes!("placement_pilot.rs"))),
                "simulationBuildId":SIMULATION_BUILD_ID,
                "neurons":graph.neuron_count(),"edges":graph.edge_count(),
                "durationTicks":level.duration_ticks,
                "proximityRadius":0.4,
                "wallSeconds":start.elapsed().as_secs_f64(),
                "flies":flies,"bodyEvents":events,"samples":samples});
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
