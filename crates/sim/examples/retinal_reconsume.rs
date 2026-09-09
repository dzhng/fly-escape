//! Reconsume an exported production capture without constructing a renderer.
use serde::Deserialize;
use sim::{attempt::*, vision::RetinalConfig, Graph};
use std::{env, fs, sync::Arc};

#[derive(Deserialize)]
struct Export {
    input: StartAttempt,
    config: RetinalConfig,
    frames: Vec<AttemptFrame>,
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = env::args().collect();
    if args.len() != 5 {
        return Err("usage: retinal_reconsume EXPORT.json GRAPH.bin MANIFEST.json MAP.json".into());
    }
    let export: Export = serde_json::from_slice(&fs::read(&args[1])?)?;
    let graph = Arc::new(Graph::from_bytes(
        &fs::read(&args[2])?,
        &fs::read_to_string(&args[3])?,
    )?);
    let input = export.input;
    let spec = Attempt::describe(
        &graph,
        &input.level,
        &input.tuning,
        &input.attempt_id,
        input.root_seed.parse()?,
        input.fly_count,
        &input.placements,
    )?;
    let mut attempt = Attempt::new_retinal(
        graph,
        input.level,
        input.tuning,
        spec,
        export.config,
        &fs::read_to_string(&args[4])?,
    )?;
    let mut frames = Vec::with_capacity(export.frames.len());
    for frame in export.frames {
        let batch = frame.retina.ok_or("exported frame has no retinal batch")?;
        let request = attempt
            .prepare_tick()?
            .ok_or("attempt completed before exported input")?;
        if request != batch.request {
            return Err(format!("pre-neural pose/identity differs at tick {}", frame.tick).into());
        }
        frames.push(attempt.commit_tick(batch)?);
    }
    println!("{}", serde_json::to_string(&frames)?);
    Ok(())
}
