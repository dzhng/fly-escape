//! Release-mode sensory sampling probe using authored campaign rooms and optical fixtures.
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    attempt::LevelDef,
    environment::*,
    field_lab::{fixture, FieldScenario},
    placement::resolve_placements,
};
use std::{hint::black_box, time::Instant};
fn measure(name: &str, fields: FieldSet, local_light: bool) -> Value {
    let geometry = fields.geometry();
    let grid = fields.export_grid();
    let positions: Vec<_> = grid
        .cells
        .iter()
        .enumerate()
        .filter(|(_, cell)| {
            cell.is_some_and(|sample| !local_light || sample.shade > 0. || sample.brightness > 0.2)
        })
        .map(|(i, _)| i)
        .collect();
    let poses: Vec<_> = (0..16)
        .map(|i| {
            let index = positions[i * positions.len() / 16];
            (
                Point {
                    x: grid.origin.x
                        + (index % grid.width as usize) as f64 * grid.cell_size
                        + grid.cell_size / 2.,
                    z: grid.origin.z
                        + (index / grid.width as usize) as f64 * grid.cell_size
                        + grid.cell_size / 2.,
                },
                i as f64 * std::f64::consts::TAU / 16.,
            )
        })
        .collect();
    let mut checksum = Sha256::new();
    for &(position, heading) in &poses {
        let sample = fields.sample(position, heading, 0);
        for value in sample
            .vision
            .brightness
            .into_iter()
            .chain(sample.vision.blocked)
        {
            checksum.update(value.to_le_bytes());
        }
    }
    for _ in 0..100 {
        for &(position, heading) in &poses {
            black_box(fields.sample(position, heading, 0));
        }
    }
    let start = Instant::now();
    for tick in 0..10_000 {
        for &(position, heading) in &poses {
            black_box(fields.sample(black_box(position), black_box(heading), tick));
        }
    }
    let elapsed = start.elapsed().as_secs_f64();
    json!({"name":name,"samples":160_000,"population":16,"fullTicks":10_000,"warmupFullTicks":100,
        "seconds":elapsed,"millisecondsPer16FlySensoryTick":elapsed / 10.,"visionChecksum":format!("{:x}",checksum.finalize()),
        "walls":geometry.walls.len(),"solids":geometry.solids.len(),"poses":poses})
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let mut results = vec![];
    let paths: Vec<_> = std::env::args().skip(1).collect();
    if paths.len() != 2 {
        return Err("Usage: vision_probe OPEN_WINDOW_RESOLVED_JSON TURN_THE_CORNER_RESOLVED_JSON".into());
    }
    for path in paths {
        let content: Value = serde_json::from_slice(&std::fs::read(path)?)?;
        let level: LevelDef = serde_json::from_value(content["level"].clone())?;
        let setup = resolve_placements(&level, &[])?;
        let fields = FieldSet::new(
            level.geometry.clone(),
            setup.field_config,
            setup.sources,
            level.exit_cue,
        )?;
        results.push(measure(&level.id, fields, false));
    }
    for (name, scenario) in [
        ("lamp", FieldScenario::Lamp),
        ("shade", FieldScenario::Shade),
    ] {
        results.push(measure(name, fixture(scenario, 1.)?.0, true));
    }
    println!(
        "{}",
        serde_json::to_string_pretty(
            &json!({"profile":"release; single thread; production FieldSet.sample including antenna diagnostics and wind; static fields; construction/serialization/checksum outside timing", "results":results})
        )?
    );
    Ok(())
}
