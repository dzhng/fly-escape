//! Scale-selection probe for the scent-strength spike: what attractive-odor
//! concentrations does THIS level actually produce, at 1x and 3x placed-banana
//! emission? Field only -- no brain, no bodies. Its output picks the half-saturation
//! constant for the candidate encoding; nothing here is a behavioural result.
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    attempt::{LevelDef, GAME_TICK_SECONDS},
    environment::{FieldSet, Point, Source, SourceKind},
    placement::{resolve_placements, Placement},
};

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Content {
    level: LevelDef,
    reference: Vec<Placement>,
}

fn quantiles(mut values: Vec<f64>) -> Value {
    values.sort_by(f64::total_cmp);
    let at = |q: f64| {
        values
            .get(((values.len() as f64 - 1.) * q).round() as usize)
            .copied()
            .unwrap_or(0.)
    };
    json!({
        "count": values.len(),
        "min": at(0.), "p10": at(0.10), "p25": at(0.25), "median": at(0.50),
        "p75": at(0.75), "p90": at(0.90), "p99": at(0.99), "max": at(1.),
    })
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    let content_text = std::fs::read_to_string(&args[1])?;
    let content: Content = serde_json::from_str(&content_text)?;
    let ticks: u32 = args[3].parse()?;
    let banana = content.reference[0].clone();
    // Named landmarks along the spawn -> room2 -> doorway -> exit route.
    let probes = [
        ("banana", banana.position),
        ("doorwayRoom1Entrance", Point { x: 4.8, z: 2.55 }),
        ("halfMetreInsideRoom1", Point { x: 3.8, z: 2.55 }),
        ("oneMetreFromBanana", Point { x: 3.3, z: 2.55 }),
        ("exitMouth", Point { x: 0.1, z: 2.25 }),
        ("room2Middle", Point { x: 6.5, z: 2.2 }),
        ("spawnCluster", Point { x: 7.8, z: 8.5 }),
    ];

    let mut arms = vec![];
    for (label, multiplier) in [("banana1x", 1.0), ("banana3x", 3.0)] {
        let mut level = content.level.clone();
        // The placed banana emits rate 1 through the shared tool catalog. An extra
        // co-located source of the same radius adds (multiplier - 1) more, which is
        // exactly a rate-`multiplier` source: injection is linear and both sources
        // share one footprint. The fixed household sources are untouched.
        if multiplier != 1.0 {
            level.sources.push(Source {
                position: banana.position,
                radius: 0.75,
                rate: multiplier - 1.0,
                kind: SourceKind::AttractiveOdor,
            });
        }
        let resolved = resolve_placements(&level, std::slice::from_ref(&banana))?;
        let mut fields = FieldSet::new(
            level.geometry.clone(),
            resolved.field_config.clone(),
            resolved.sources.clone(),
            level.exit_cue.clone(),
        )?;
        let mut traces: Vec<Value> = vec![];
        for tick in 1..=ticks {
            fields.advance(GAME_TICK_SECONDS)?;
            if [1u32, 100, 300, 600, 1500, 3000, 4500, 6000].contains(&tick) {
                traces.push(json!({
                    "tick": tick,
                    "at": probes.iter().map(|(name, p)| json!({
                        "name": name,
                        "attractiveOdor": fields.sample_point(*p).attractive_odor,
                    })).collect::<Vec<_>>(),
                }));
            }
        }
        let grid = fields.export_grid();
        let all: Vec<f64> = grid
            .cells
            .iter()
            .flatten()
            .map(|c| c.attractive_odor)
            .collect();
        let detected: Vec<f64> = all.iter().copied().filter(|v| *v >= 0.05).collect();
        arms.push(json!({
            "arm": label,
            "placedBananaRate": multiplier,
            "allActiveCells": quantiles(all),
            "cellsAboveDetectionFloor": quantiles(detected),
            "traces": traces,
        }));
    }
    let report = json!({
        "purpose": "field-only attractive-odor range for choosing the saturating half-concentration",
        "contentPath": args[1],
        "contentHash": format!("{:x}", Sha256::digest(content_text.as_bytes())),
        "settleTicks": ticks,
        "detectionFloor": 0.05,
        "probeSourceHash": format!("{:x}", Sha256::digest(include_bytes!("scent_scale_probe.rs"))),
        "sensorySourceHash": format!("{:x}", Sha256::digest(include_bytes!("../src/sensory.rs"))),
        "arms": arms,
    });
    std::fs::write(&args[2], serde_json::to_string_pretty(&report)?)?;
    println!("{}", serde_json::to_string_pretty(&report)?);
    Ok(())
}
