//! Scratch duration diagnostic: one continuous native Attempt per (arm, seed) run
//! to a long horizon, sampling outcomes and room occupancy at fixed checkpoints.
//! No respawn, no neural reset, no reseeding, no field or body reset: the Attempt
//! is constructed once and stepped until it reports its own terminal result.
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use sim::{attempt::*, placement::Placement, Graph};
use std::{collections::BTreeMap, sync::Arc, time::Instant};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Content {
    level: LevelDef,
    tuning: AttemptTuning,
    reference: Vec<Placement>,
    /// Decimal wire values; the u64 seeds exceed what a JSON number holds exactly.
    tuning_seeds: Vec<String>,
    #[serde(default)]
    probe_target: Option<sim::environment::Point>,
}

/// Where a fly is at a checkpoint: a terminal outcome, or the floor room it occupies.
fn station(level: &LevelDef, state: &sim::body::BodyState) -> String {
    match state.outcome {
        Some(sim::body::TerminalOutcome::Escaped) => "escaped".into(),
        Some(sim::body::TerminalOutcome::Starved) => "starved".into(),
        Some(sim::body::TerminalOutcome::Zapped) => "zapped".into(),
        Some(sim::body::TerminalOutcome::Caught) => "caught".into(),
        Some(sim::body::TerminalOutcome::TimedOut) => "timedOut".into(),
        None => match level.geometry.room_at(state.pose.position) {
            Some(id) => format!("room{id}"),
            None => "offFloor".into(),
        },
    }
}

fn run(
    graph: &Arc<Graph>,
    content: &Content,
    seed: u64,
    label: &str,
    placements: &[Placement],
    checkpoints: &[u32],
) -> Result<Value, String> {
    let start = Instant::now();
    let spec = Attempt::describe(
        graph,
        &content.level,
        &content.tuning,
        &format!("duration-{label}-{seed}"),
        seed,
        20,
        placements,
    )?;
    let mut attempt = Attempt::new(
        graph.clone(),
        content.level.clone(),
        content.tuning.clone(),
        spec.clone(),
    )?;
    let construct_seconds = start.elapsed().as_secs_f64();
    eprintln!(
        "  [{label} seed {seed}] constructed in {construct_seconds:.2}s; horizon {} ticks",
        spec.duration_ticks
    );

    let flies = spec.fly_count as usize;
    // Tick-weighted floor occupancy per fly, accumulated over the whole single run.
    let mut occupancy: Vec<BTreeMap<String, u32>> = vec![BTreeMap::new(); flies];
    // Nonterminal nonfeeding displacement below 1e-8, and the subset failing body
    // occupancy with the radius enlarged by 1e-5 (the campaign_probe stall definition).
    let food_ids: Vec<u32> = attempt.resolved_setup().state.food.iter().map(|s| s.id).collect();
    let mut food_support_ticks = vec![0u32; flies];
    let mut near_added_ticks = vec![0u32; flies];
    let mut walking_near_added_ticks = vec![0u32; flies];
    let mut visited_added = vec![false; flies];
    let mut left_added = vec![false; flies];
    let mut near_ticks = vec![0u32; flies];
    let mut first_near_tick = vec![Value::Null; flies];
    let mut distance_sum = vec![0.; flies];
    let mut observed_ticks = vec![0u32; flies];
    let mut stalled = vec![0u32; flies];
    let mut boundary_stalled = vec![0u32; flies];
    let mut escape_tick = vec![Value::Null; flies];
    let mut terminal_tick = vec![Value::Null; flies];
    let mut captured: Vec<Value> = vec![];
    let mut progress = Instant::now();
    let radius = content.level.body_config.body_radius;

    let result = loop {
        let frame = attempt.step()?.ok_or("missing terminal frame")?;
        for fly in &frame.flies {
            let id = fly.id as usize;
            if fly.body.outcome.is_none() {
                if fly.body.support.is_some_and(|id| food_ids.contains(&id)) { food_support_ticks[id] += 1; }
                let distance = placements.iter().map(|p| (fly.body.pose.position.x-p.position.x).hypot(fly.body.pose.position.z-p.position.z)).fold(f64::INFINITY, f64::min);
                if distance < 0.9 {
                    visited_added[id] = true;
                    near_added_ticks[id] += 1;
                    if fly.body.mode == sim::body::BodyMode::Walking { walking_near_added_ticks[id] += 1; }
                } else if distance > 1.1 && visited_added[id] { left_added[id] = true; }
            }
            if let Some(target) = content.probe_target {
                if fly.body.outcome.is_none() {
                    let distance = (fly.body.pose.position.x - target.x).hypot(fly.body.pose.position.z - target.z);
                    distance_sum[id] += distance;
                    observed_ticks[id] += 1;
                    if distance < 0.9 {
                        near_ticks[id] += 1;
                        if first_near_tick[id].is_null() { first_near_tick[id] = json!(frame.tick); }
                    }
                }
            }
            *occupancy[id]
                .entry(station(&content.level, &fly.body))
                .or_default() += 1;
            if fly.body.outcome.is_some() && terminal_tick[id].is_null() {
                terminal_tick[id] = json!(frame.tick);
                if fly.body.outcome == Some(sim::body::TerminalOutcome::Escaped) {
                    escape_tick[id] = json!(frame.tick);
                }
            }
            let a = fly.input_pose.position;
            let b = fly.body.pose.position;
            if fly.body.outcome.is_none()
                && fly.body.mode != sim::body::BodyMode::Feeding
                && (a.x - b.x).hypot(a.z - b.z) < 1e-8
            {
                stalled[id] += 1;
                if !content.level.geometry.contains_body(b, radius + 1e-5) {
                    boundary_stalled[id] += 1;
                }
            }
        }
        if checkpoints.contains(&frame.tick) || frame.result.is_some() {
            let mut stations: Map<String, Value> = Map::new();
            for fly in &frame.flies {
                let key = station(&content.level, &fly.body);
                let entry = stations.entry(key).or_insert(json!(0));
                *entry = json!(entry.as_u64().unwrap() + 1);
            }
            let summary = sim::body::summarize_outcomes(
                &frame.flies.iter().map(|f| f.body.clone()).collect::<Vec<_>>(),
            );
            captured.push(json!({
                "tick": frame.tick,
                "simulatedSeconds": frame.tick as f64 * GAME_TICK_SECONDS,
                "wallSeconds": start.elapsed().as_secs_f64(),
                "outcomes": summary,
                "stations": stations,
                "positions": frame.flies.iter().map(|f| json!({
                    "id": f.id,
                    "x": f.body.pose.position.x,
                    "z": f.body.pose.position.z,
                    "mode": f.body.mode,
                    "outcome": f.body.outcome,
                })).collect::<Vec<_>>(),
            }));
            eprintln!(
                "  [{label} seed {seed}] tick {} ({:.0}s sim, {:.1}s wall): escaped {} timedOut {} zapped {} caught {}",
                frame.tick,
                frame.tick as f64 * GAME_TICK_SECONDS,
                start.elapsed().as_secs_f64(),
                summary.escaped,
                summary.timed_out,
                summary.zapped,
                summary.caught,
            );
        } else if progress.elapsed().as_secs_f64() >= 30. {
            progress = Instant::now();
            eprintln!(
                "  [{label} seed {seed}] .. tick {} of {} ({:.1}s wall)",
                frame.tick,
                spec.duration_ticks,
                start.elapsed().as_secs_f64()
            );
        }
        if let Some(result) = frame.result {
            break result;
        }
    };

    Ok(json!({
        "condition": label,
        "seed": seed.to_string(),
        "spec": spec,
        "result": result,
        "checkpoints": captured,
        "perFly": {
            "escapeTick": escape_tick,
            "nearTicks": near_ticks,
            "nearAddedTicks": near_added_ticks,
            "walkingNearAddedTicks": walking_near_added_ticks,
            "visitedAdded": visited_added,
            "leftAdded": left_added,
            "foodSupportTicks": food_support_ticks,
            "firstNearTick": first_near_tick,
            "distanceSum": distance_sum,
            "observedTicks": observed_ticks,
            "terminalTick": terminal_tick,
            "stalledTicks": stalled,
            "boundaryStalledTicks": boundary_stalled,
            "tickOccupancy": occupancy,
        },
        "stallDefinition": "nonterminal nonfeeding displacement below 1e-8; boundary subset fails Geometry occupancy with body radius enlarged by 1e-5",
        "constructSeconds": construct_seconds,
        "wallSeconds": start.elapsed().as_secs_f64(),
    }))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if !(5..=7).contains(&args.len()) {
        return Err(
            "Usage: duration_probe GRAPH_DIR CONTENT_JSON DURATION_TICKS OUTPUT_JSON [SEED_INDEX|all] [empty|reference|both]"
                .into(),
        );
    }
    let content_text = std::fs::read_to_string(&args[2])?;
    let mut content: Content = serde_json::from_str(&content_text)?;
    let authored_duration = content.level.duration_ticks;
    let duration: u32 = args[3].parse()?;
    // The only content edit: the diagnostic horizon. Nothing else is retuned.
    content.level.duration_ticks = duration;
    let checkpoints: Vec<u32> = [3000u32, 6000, 12000, 18000, 36000]
        .into_iter()
        .filter(|t| *t <= duration)
        .collect();

    let start = Instant::now();
    let bytes = std::fs::read(format!("{}/graph.bin", args[1]))?;
    let manifest = std::fs::read_to_string(format!("{}/manifest.json", args[1]))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    drop(bytes);
    let graph_load_seconds = start.elapsed().as_secs_f64();
    eprintln!("graph loaded in {graph_load_seconds:.2}s");

    let identity = json!({
        "contentHash": format!("{:x}", Sha256::digest(content_text.as_bytes())),
        "contentPath": args[2],
        "authoredDurationTicks": authored_duration,
        "diagnosticDurationTicks": duration,
        "graphDir": args[1],
        "graphHash": graph.manifest.graph_hash,
        "manifestHash": format!("{:x}", Sha256::digest(manifest.as_bytes())),
        "neurons": graph.neuron_count(),
        "edges": graph.edge_count(),
        "simulationBuildId": SIMULATION_BUILD_ID,
        "probeSourceHash": format!("{:x}", Sha256::digest(include_bytes!("duration_probe.rs"))),
        "graphLoadSeconds": graph_load_seconds,
        "checkpoints": checkpoints,
        "flyCount": 20,
        "continuity": "one Attempt per (arm, seed), constructed once and stepped to its own terminal frame; no respawn, no neural reset, no reseeding, no field or body reset",
        "seedFilter": args.get(5).cloned().unwrap_or_else(|| "all".into()),
        "armFilter": args.get(6).cloned().unwrap_or_else(|| "both".into()),
        "tuningSeeds": content.tuning_seeds,
    });

    let empty: Vec<Placement> = vec![];
    let mut pairs: Vec<Value> = vec![];
    let all_seeds: Vec<u64> = content
        .tuning_seeds
        .iter()
        .map(|s| s.parse::<u64>())
        .collect::<Result<_, _>>()?;
    // Optional filters exist only so independent (seed, arm) runs can occupy separate
    // cores; each selected run is still one uninterrupted Attempt over the same content.
    let seeds: Vec<u64> = match args.get(5).map(String::as_str) {
        None | Some("all") => all_seeds.clone(),
        Some(index) => vec![*all_seeds
            .get(index.parse::<usize>()?)
            .ok_or("seed index out of range")?],
    };
    let arm_filter = args.get(6).map(String::as_str).unwrap_or("both");
    if !["empty", "reference", "both"].contains(&arm_filter) {
        return Err("arm must be empty, reference or both".into());
    }
    for &seed in &seeds {
        eprintln!("=== seed {seed} ===");
        let mut conditions = vec![];
        let arms: Vec<(&str, &Vec<Placement>)> = [("empty", &empty), ("reference", &content.reference)]
            .into_iter()
            .filter(|(label, _)| arm_filter == "both" || arm_filter == *label)
            .collect();
        for (label, placements) in arms {
            let row = run(&graph, &content, seed, label, placements, &checkpoints)?;
            eprintln!(
                "seed {seed} {label}: {} in {:.1}s",
                row["result"],
                row["wallSeconds"].as_f64().unwrap()
            );
            conditions.push(row);
            // Incremental checkpoint write after every completed arm.
            let mut written = pairs.clone();
            written.push(json!({"seed": seed.to_string(), "conditions": conditions}));
            std::fs::write(
                &args[4],
                serde_json::to_string_pretty(&json!({
                    "identity": identity,
                    "complete": false,
                    "wallSeconds": start.elapsed().as_secs_f64(),
                    "pairs": written,
                }))?,
            )?;
        }
        pairs.push(json!({"seed": seed.to_string(), "conditions": conditions}));
    }
    std::fs::write(
        &args[4],
        serde_json::to_string_pretty(&json!({
            "identity": identity,
            "complete": true,
            "wallSeconds": start.elapsed().as_secs_f64(),
            "pairs": pairs,
        }))?,
    )?;
    eprintln!("done in {:.1}s", start.elapsed().as_secs_f64());
    Ok(())
}
