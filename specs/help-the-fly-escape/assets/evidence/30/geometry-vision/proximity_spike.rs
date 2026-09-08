//! SCRATCH (geometry-vision spike): paired wall/box fixture measuring whether
//! modeled proximity rays change contact pressure and progress. Not campaign content.
use serde_json::json;
use sim::{attempt::*, body::*, environment::*, placement::PlacementRules, sensory::CuePathway, Graph};
use std::sync::Arc;

fn point(x: f64, z: f64) -> Point {
    Point { x, z }
}
fn dist(a: Point, b: Point) -> f64 {
    (a.x - b.x).hypot(a.z - b.z)
}

/// One room with a solid box between the spawn and the exit, so the only route
/// out requires clearing geometry the rays can actually see.
fn level(flies: u32, ticks: u32) -> LevelDef {
    let geometry = Geometry {
        rooms: vec![RectRoom {
            id: 0,
            min: point(0., 0.),
            max: point(6., 3.),
        }],
        walls: vec![
            Wall { a: point(0., 0.), b: point(6., 0.) },
            Wall { a: point(0., 3.), b: point(6., 3.) },
            Wall { a: point(0., 0.), b: point(0., 3.) },
            Wall { a: point(6., 0.), b: point(6., 1.4) },
            Wall { a: point(6., 1.6), b: point(6., 3.) },
        ],
        solids: vec![
            SolidProp { id: 1, furnishing: None, min: point(2.4, 0.02), max: point(2.7, 2.0), height: 0.5 },
            SolidProp { id: 2, furnishing: None, min: point(4.0, 1.3), max: point(4.3, 2.98), height: 0.5 },
        ],
    };
    LevelDef {
        id: "proximity-spike".into(),
        geometry,
        spawn: sim::spawn::SpawnDef::Cluster {
            min: point(0.4, 1.0),
            max: point(1.2, 2.0),
            flying_count: 2,
        },
        exit: ExitOpening { a: point(6., 1.4), b: point(6., 1.6), outward: point(1., 0.) },
        exit_cue: Some(ExitCue { position: point(6., 1.5), room_id: 0, radius: 2., strength: 1. }),
        food: vec![],
        fixed_objects: vec![],
        zappers: vec![],
        sources: vec![],
        field_config: FieldConfig::default(),
        body_config: BodyConfig {
            life: LifeModel::Timed,
            walk_speed: 0.12,
            flight_speed: 0.24,
            turn_gain: 8.,
            ..Default::default()
        },
        duration_ticks: ticks,
        star_thresholds: [1, 2, 3],
        placement_rules: PlacementRules { fan_heading: 0., inventory: vec![], reserved: vec![] },
    }
}
struct Trial {
    escaped: u32,
    contact_ticks: u64,
    stall_ticks: u64,
    live_ticks: u64,
    progress: f64,
}

fn run(graph: &Arc<Graph>, seed: u64, flies: u32, ticks: u32, gain: f64) -> Result<Trial, String> {
    let level = level(flies, ticks);
    let tuning = AttemptTuning {
        cues: vec![CueInput { pathway: CuePathway::InhibitoryOdor, gain: 1. }],
        taste_gain: 0.,
        proximity_gain: gain,
        proximity_reach: 0.25,
        ..Default::default()
    };
    let spec = Attempt::describe(graph, &level, &tuning, "proximity-spike", seed, flies, &[])
        .map_err(|e| e.to_string())?;
    let mut attempt = Attempt::new(graph.clone(), level.clone(), tuning, spec)?;
    let radius = level.body_config.body_radius;
    let exit = point(6., 1.5);
    let mut trial = Trial { escaped: 0, contact_ticks: 0, stall_ticks: 0, live_ticks: 0, progress: 0. };
    let mut previous: Vec<Option<Point>> = vec![None; flies as usize];
    let mut start: Vec<Option<f64>> = vec![None; flies as usize];
    let mut closest: Vec<f64> = vec![f64::MAX; flies as usize];
    let nominal = level.body_config.walk_speed * GAME_TICK_SECONDS;
    for _ in 1..=ticks {
        let Some(frame) = attempt.step()? else { break };
        for fly in &frame.flies {
            let i = fly.id as usize;
            let p = fly.body.pose.position;
            if start[i].is_none() {
                start[i] = Some(dist(p, exit));
            }
            if fly.body.outcome.is_some() {
                continue;
            }
            trial.live_ticks += 1;
            closest[i] = closest[i].min(dist(p, exit));
            // Pressed against geometry: inside the conservative footprint at a 5 mm margin.
            if level.geometry.room_at(p).is_some()
                && !level.geometry.contains_body(p, radius + 0.005)
            {
                trial.contact_ticks += 1;
            }
            if let Some(q) = previous[i] {
                if dist(p, q) < 0.1 * nominal {
                    trial.stall_ticks += 1;
                }
            }
            previous[i] = Some(p);
        }
    }
    for (i, s) in start.iter().enumerate() {
        if let Some(s) = s {
            trial.progress += (s - closest[i]).max(0.);
        }
    }
    trial.progress /= flies as f64;
    let states = attempt.result();
    if let Some(result) = states {
        trial.escaped = result.outcomes.escaped;
    }
    Ok(trial)
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    let path = args.get(1).ok_or("Pass graph directory, seeds, flies, ticks, output JSON")?;
    let seeds: u64 = args.get(2).ok_or("seeds")?.parse()?;
    let flies: u32 = args.get(3).ok_or("flies")?.parse()?;
    let ticks: u32 = args.get(4).ok_or("ticks")?.parse()?;
    let output = args.get(5).ok_or("output")?;
    let graph = Arc::new(Graph::from_bytes(
        &std::fs::read(format!("{path}/graph.bin"))?,
        &std::fs::read_to_string(format!("{path}/manifest.json"))?,
    )?);
    let mut rows = vec![];
    for seed in 0..seeds {
        for (label, gain) in [("disabled", 0.), ("proximity", 1.)] {
            let t = run(&graph, 1000 + seed, flies, ticks, gain)?;
            println!(
                "seed{seed} {label}: escaped={} contactTicks={} stallTicks={} liveTicks={} progress={:.3}",
                t.escaped, t.contact_ticks, t.stall_ticks, t.live_ticks, t.progress
            );
            rows.push(json!({
                "seed": seed, "arm": label, "escaped": t.escaped,
                "contactTicks": t.contact_ticks, "stallTicks": t.stall_ticks,
                "liveTicks": t.live_ticks, "progressMetres": t.progress,
                "contactRate": t.contact_ticks as f64 / t.live_ticks.max(1) as f64,
                "stallRate": t.stall_ticks as f64 / t.live_ticks.max(1) as f64,
            }));
        }
    }
    std::fs::write(output, serde_json::to_string_pretty(&json!({"flies":flies,"ticks":ticks,"rows":rows}))?)?;
    Ok(())
}
