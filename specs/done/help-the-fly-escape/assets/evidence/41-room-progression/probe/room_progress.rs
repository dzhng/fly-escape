//! Bounded room-progression diagnostic through the production Graph and Attempt.
use serde::Deserialize;
use serde_json::{json, Value};
use sim::{attempt::*, placement::Placement, Graph};
use std::{collections::BTreeMap, sync::Arc, time::Instant};
#[derive(Deserialize)]
struct Config {
    level: LevelDef,
    tuning: AttemptTuning,
    placements: Vec<Placement>,
    seeds: Vec<String>,
    label: String,
    #[serde(default)]
    stop_at: Option<u32>,
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    let config: Config = serde_json::from_slice(&std::fs::read(&args[1])?)?;
    let graph = Arc::new(Graph::from_bytes(
        &std::fs::read("data/processed/brain/graph.bin")?,
        &std::fs::read_to_string("data/processed/brain/manifest.json")?,
    )?);
    let mut runs = Vec::<Value>::new();
    for seed in &config.seeds {
        let start = Instant::now();
        let spec = Attempt::describe(
            &graph,
            &config.level,
            &config.tuning,
            &format!("room-progress-{}-{seed}", config.label),
            seed.parse()?,
            16,
            &config.placements,
        )?;
        let mut attempt = Attempt::new(
            graph.clone(),
            config.level.clone(),
            config.tuning.clone(),
            spec.clone(),
        )?;
        let initial = attempt.initial_bodies();
        let spawn_room = config
            .level
            .geometry
            .room_at(initial[0].pose.position)
            .unwrap();
        let exit_inside = sim::environment::Point {
            x: (config.level.exit.a.x + config.level.exit.b.x) / 2.
                - config.level.exit.outward.x * 0.05,
            z: (config.level.exit.a.z + config.level.exit.b.z) / 2.
                - config.level.exit.outward.z * 0.05,
        };
        let exit_room = config.level.geometry.room_at(exit_inside).unwrap();
        let mut previous = initial.clone();
        let mut left = vec![None; 16];
        let mut arrived = vec![None; 16];
        let mut escaped = vec![None; 16];
        let mut stationary = vec![0u32; 16];
        let mut wall_stationary = vec![0u32; 16];
        let mut food_stationary = vec![0u32; 16];
        let mut streak = vec![0u32; 16];
        let mut longest = vec![0u32; 16];
        let mut spawn_ticks = vec![0u32; 16];
        let mut snapshots = vec![];
        loop {
            let frame = attempt.step()?.ok_or("attempt ended without final frame")?;
            let mut rooms = BTreeMap::new();
            for fly in &frame.flies {
                let i = fly.id as usize;
                let p = fly.body.pose.position;
                let room = config.level.geometry.room_at(p);
                *rooms.entry(format!("{:?}", room)).or_insert(0u32) += 1;
                if room != Some(spawn_room) && left[i].is_none() {
                    left[i] = Some(frame.tick);
                }
                if room == Some(exit_room) && arrived[i].is_none() {
                    arrived[i] = Some(frame.tick);
                }
                if fly.body.outcome == Some(sim::body::TerminalOutcome::Escaped)
                    && escaped[i].is_none()
                {
                    escaped[i] = Some(frame.tick);
                }
                if fly.body.outcome.is_none() {
                    if room == Some(spawn_room) {
                        spawn_ticks[i] += 1;
                    }
                    let prev = &previous[i];
                    let travel = (p.x - prev.pose.position.x)
                        .hypot(p.z - prev.pose.position.z)
                        .hypot(fly.body.height - prev.height);
                    if travel < 1e-7 {
                        stationary[i] += 1;
                        streak[i] += 1;
                        longest[i] = longest[i].max(streak[i]);
                        if fly.body.support.is_some() {
                            food_stationary[i] += 1;
                        }
                        if !config
                            .level
                            .geometry
                            .contains_body(p, config.level.body_config.body_radius + 0.002)
                        {
                            wall_stationary[i] += 1;
                        }
                    } else {
                        streak[i] = 0;
                    }
                }
                previous[i] = fly.body.clone();
            }
            if [600, 1200, 2400, 6000].contains(&frame.tick) || frame.result.is_some() {
                let snapshot = json!({"tick":frame.tick,"rooms":rooms,"leftSpawn":left.iter().filter(|x|x.is_some()).count(),"arrivedExitRoom":arrived.iter().filter(|x|x.is_some()).count(),"escaped":escaped.iter().filter(|x|x.is_some()).count(),"bodies":frame.flies.iter().map(|f|&f.body).collect::<Vec<_>>()});
                eprintln!(
                    "{} {seed} tick{} left{} arrived{} escaped{} ({:.1}s)",
                    config.label,
                    frame.tick,
                    snapshot["leftSpawn"],
                    snapshot["arrivedExitRoom"],
                    snapshot["escaped"],
                    start.elapsed().as_secs_f64()
                );
                snapshots.push(snapshot);
            }
            if frame.result.is_some() || config.stop_at == Some(frame.tick) {
                let result = frame.result;
                runs.push(json!({"spec":spec,"initialBodies":initial,"spawnRoom":spawn_room,"exitRoom":exit_room,"leftSpawnTick":left,"arrivedExitRoomTick":arrived,"escapeTick":escaped,"spawnTicks":spawn_ticks,"stationaryTicks":stationary,"nearWallStationaryTicks":wall_stationary,"supportedStationaryTicks":food_stationary,"longestStationaryTicks":longest,"snapshots":snapshots,"result":result,"stoppedAtTick":frame.tick,"seconds":start.elapsed().as_secs_f64()}));
                break;
            }
        }
        std::fs::write(
            &args[2],
            serde_json::to_vec_pretty(&json!({"label":config.label,"runs":runs}))?,
        )?;
    }
    Ok(())
}
