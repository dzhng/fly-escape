//! Scratch stall diagnostic: replay the control attempt and dump per-tick body
//! motion for one fly, with the advance() outcome recorded by the scratch
//! instrumentation in body::motion.
use serde::Deserialize;
use sim::{attempt::*, placement::Placement, Graph};
use std::{env, fs, sync::Arc};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Content {
    level: LevelDef,
    tuning: AttemptTuning,
    reference: Vec<Placement>,
    tuning_seeds: Vec<String>,
}

fn spike(neural: &sim::StepOutput, id: &str) -> f64 {
    neural.groups.iter().find(|g| g.id == id).map_or(0., |g| g.spike_fraction)
}

fn main() -> Result<(), String> {
    let args: Vec<String> = env::args().collect();
    let content: Content =
        serde_json::from_str(&fs::read_to_string(&args[1]).map_err(|e| e.to_string())?)
            .map_err(|e| e.to_string())?;
    let graph = Arc::new(Graph::from_bytes(&fs::read(format!("{}/graph.bin", &args[2])).map_err(|e| e.to_string())?, &fs::read_to_string(format!("{}/manifest.json", &args[2])).map_err(|e| e.to_string())?)?);
    let target: usize = args[3].parse().map_err(|_| "fly")?;
    let ticks: u32 = args[4].parse().map_err(|_| "ticks")?;
    let seed: u64 = content.tuning_seeds[0].parse().map_err(|_| "seed")?;
    let spec = Attempt::describe(
        &graph,
        &content.level,
        &content.tuning,
        &format!("duration-reference-{seed}"),
        seed,
        20,
        &content.reference,
    )?;
    let mut attempt = Attempt::new(
        graph.clone(),
        content.level.clone(),
        content.tuning.clone(),
        spec.clone(),
    )?;
    println!("tick mode height support x z heading thrust turn landing points endfrac dist advance rotblocked rotunres queries events");
    let mut previous: Option<sim::environment::Point> = None;
    for _ in 0..ticks {
        // advance() runs once per stepping fly per tick, in frame order, so the
        // drained log indexes by position in frame.flies.
        sim::body::motion::ADVANCE_LOG.with(|c| c.borrow_mut().clear());
        let frame = match attempt.step()? {
            Some(frame) => frame,
            None => break,
        };
        let fly = &frame.flies[target];
        let advance = sim::body::motion::ADVANCE_LOG
            .with(|c| c.borrow().get(target).copied())
            .unwrap_or((9, false, false, 0, 0));
        let position = fly.body.pose.position;
        let distance = previous.map_or(0., |p: sim::environment::Point| {
            (position.x - p.x).hypot(position.z - p.z)
        });
        previous = Some(position);
        let neural = fly.neural.as_ref();
        let landing = neural.map_or(0., |n| (spike(n, "landingL") + spike(n, "landingR")) / 2.);
        let end = fly.motion.last().map(|p| p.fraction).unwrap_or(f64::NAN);
        let moved = fly
            .motion
            .first()
            .zip(fly.motion.last())
            .map(|(a, b)| {
                (a.pose.position.x - b.pose.position.x).hypot(a.pose.position.z - b.pose.position.z)
                    + (a.height - b.height).abs()
            })
            .unwrap_or(f64::NAN);
        println!(
            "{} {:?} {:.9} {:?} {:.9} {:.9} {:.6} {:.4} {:.4} {:.4} {} {:.3} {:.3e} within{:.3e} {} {} {} {} {:?}",
            frame.tick,
            fly.body.mode,
            fly.body.height,
            fly.body.support,
            position.x,
            position.z,
            fly.body.pose.heading,
            neural.map_or(0., |n| n.motor.thrust),
            neural.map_or(0., |n| n.motor.turn),
            landing,
            fly.motion.len(),
            end,
            distance,
            moved,
            advance.0,
            advance.1,
            advance.2,
            advance.3,
            (advance.4, &fly.events),
        );
    }
    Ok(())
}
