//! Paired content calibration through the real Graph + Attempt; no motion shortcuts.
use serde::Deserialize;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{attempt::*, placement::Placement, Graph};
use std::{collections::BTreeSet, sync::Arc, time::Instant};
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Content {
    level: LevelDef,
    tuning: AttemptTuning,
    reference: Vec<Placement>,
    poor: Vec<Placement>,
    tuning_seeds: Vec<u64>,
    heldout_seeds: Vec<u64>,
    frozen: bool,
}
fn topology(level: &LevelDef) -> Result<Value, String> {
    let geometry = &level.geometry;
    let radius = level.body_config.body_radius;
    let mut links = BTreeSet::new();
    for (i, a) in geometry.rooms.iter().enumerate() {
        for b in &geometry.rooms[i + 1..] {
            for vertical in [true, false] {
                let (edge, peer, lo, hi) = if vertical {
                    (a.max.x, b.min.x, a.min.z.max(b.min.z), a.max.z.min(b.max.z))
                } else {
                    (a.max.z, b.min.z, a.min.x.max(b.min.x), a.max.x.min(b.max.x))
                };
                if edge != peer || lo >= hi {
                    continue;
                }
                for n in 1..100 {
                    let along = lo + (hi - lo) * n as f64 / 100.;
                    let (from, to) = if vertical {
                        (
                            sim::environment::Point {
                                x: edge - radius * 2.,
                                z: along,
                            },
                            sim::environment::Point {
                                x: edge + radius * 2.,
                                z: along,
                            },
                        )
                    } else {
                        (
                            sim::environment::Point {
                                x: along,
                                z: edge - radius * 2.,
                            },
                            sim::environment::Point {
                                x: along,
                                z: edge + radius * 2.,
                            },
                        )
                    };
                    if geometry.contains_body(from, radius)
                        && geometry.contains_body(to, radius)
                        && geometry.sweep(from, to, radius) == to
                    {
                        links.insert((a.id, b.id));
                        break;
                    }
                }
            }
        }
    }
    if links != BTreeSet::from([(1, 2), (2, 3), (2, 5), (3, 4)]) {
        return Err(format!(
            "Open Window must retain four-room route plus one-door pantry; actual {links:?}"
        ));
    }
    Ok(
        json!({"bodyRadius":radius,"roomLinks":links,"method":"sample shared boundaries and cross actual Geometry sweep; room IDs 1..4 main route, 5 pantry"}),
    )
}
fn run(
    graph: &Arc<Graph>,
    content: &Content,
    seed: u64,
    label: &str,
    placements: &[Placement],
) -> Result<Value, String> {
    let start = Instant::now();
    let spec = Attempt::describe(
        graph,
        &content.level,
        &content.tuning,
        &format!("{label}-{seed}"),
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
    let mut stalled = vec![0u32; 20];
    let mut boundary_stalled = vec![0u32; 20];
    let mut samples = vec![];
    let mut first_tick_seconds = None;
    loop {
        let frame = attempt.step()?.ok_or("missing terminal frame")?;
        if first_tick_seconds.is_none() {
            first_tick_seconds = Some(start.elapsed().as_secs_f64());
        }
        for fly in &frame.flies {
            let a = fly.input_pose.position;
            let b = fly.body.pose.position;
            if fly.body.outcome.is_none()
                && fly.body.mode != sim::body::BodyMode::Feeding
                && (a.x - b.x).hypot(a.z - b.z) < 1e-8
            {
                stalled[fly.id as usize] += 1;
                if !content
                    .level
                    .geometry
                    .contains_body(b, content.level.body_config.body_radius + 1e-5)
                {
                    boundary_stalled[fly.id as usize] += 1;
                }
            }
        }
        if frame.tick % 50 == 0 || frame.result.is_some() {
            samples.push(json!({"tick":frame.tick,"flies":frame.flies.iter().map(|f|json!({"id":f.id,"body":f.body})).collect::<Vec<_>>()}));
        }
        if let Some(result) = frame.result {
            return Ok(
                json!({"seed":seed,"condition":label,"spec":spec,"result":result,"constructSeconds":construct_seconds,"firstTickSeconds":first_tick_seconds,"wallSeconds":start.elapsed().as_secs_f64(),"stalledTicks":stalled,"boundaryStalledTicks":boundary_stalled,"stallDefinition":"nonterminal nonfeeding displacement below 1e-8; boundary subset fails Geometry occupancy with body radius enlarged by 1e-5","samples":samples}),
            );
        }
    }
}
fn median(mut values: Vec<f64>) -> f64 {
    values.sort_by(f64::total_cmp);
    let n = values.len();
    (values[(n - 1) / 2] + values[n / 2]) / 2.
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if !(6..=7).contains(&args.len()) || args.get(6).is_some_and(|v| v != "--empty-control") {
        return Err(
            "Usage: campaign_probe GRAPH_DIR CONTENT_JSON tuning|heldout COUNT OUTPUT_JSON [--empty-control]".into(),
        );
    }
    let content_text = std::fs::read_to_string(&args[2])?;
    let content: Content = serde_json::from_str(&content_text)?;
    let count: usize = args[4].parse()?;
    let topology = topology(&content.level)?;
    let thresholds = content.level.star_thresholds;
    if thresholds[0] == 0 || thresholds[2] > 20 || thresholds.windows(2).any(|v| v[0] >= v[1]) {
        return Err("star thresholds must be positive, strictly increasing and at most 20".into());
    }
    if !(1..=30).contains(&count)
        || content.level.spawn_poses.len() != 20
        || content.level.geometry.rooms.len() != 5
        || content.tuning.taste_gain <= 0.
        || !content.tuning.silenced_neurons.is_empty()
    {
        return Err(
            "requires 1..30 seeds, 20 flies, five rooms, explicit taste gain and no ablation"
                .into(),
        );
    }
    let tuning: BTreeSet<_> = content.tuning_seeds.iter().collect();
    let heldout: BTreeSet<_> = content.heldout_seeds.iter().collect();
    if content.tuning_seeds.len() != 30
        || content.heldout_seeds.len() != 30
        || tuning.len() != 30
        || heldout.len() != 30
        || !tuning.is_disjoint(&heldout)
    {
        return Err("requires two disjoint 30-seed sets".into());
    }
    let seeds = match args[3].as_str() {
        "tuning" => &content.tuning_seeds,
        "heldout" if content.frozen => &content.heldout_seeds,
        _ => return Err("heldout requires frozen content; set must be tuning or heldout".into()),
    };
    let start = Instant::now();
    let bytes = std::fs::read(format!("{}/graph.bin", args[1]))?;
    let manifest = std::fs::read_to_string(format!("{}/manifest.json", args[1]))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    drop(bytes);
    let graph_load_seconds = start.elapsed().as_secs_f64();
    let mut pairs = vec![];
    for &seed in seeds.iter().take(count) {
        let mut conditions = vec![];
        let empty = vec![];
        let mut arms = vec![("reference", &content.reference), ("poor", &content.poor)];
        if args.len() == 7 {
            arms.push(("empty", &empty));
        }
        for (label, placements) in arms {
            let row = run(&graph, &content, seed, label, placements)?;
            eprintln!(
                "seed {seed} {label}: {} in {:.2}s; first tick {:.3}s",
                row["result"],
                row["wallSeconds"].as_f64().unwrap(),
                row["firstTickSeconds"].as_f64().unwrap()
            );
            conditions.push(row);
        }
        pairs.push(json!({"seed":seed,"conditions":conditions}));
        let diffs: Vec<f64> = pairs
            .iter()
            .map(|p| {
                p["conditions"][0]["result"]["outcomes"]["escaped"]
                    .as_f64()
                    .unwrap()
                    - p["conditions"][1]["result"]["outcomes"]["escaped"]
                        .as_f64()
                        .unwrap()
            })
            .collect();
        let stars = pairs
            .iter()
            .filter(|p| p["conditions"][0]["result"]["stars"].as_u64().unwrap() >= 1)
            .count();
        let mut summaries = serde_json::Map::new();
        for arm in 0..pairs[0]["conditions"].as_array().unwrap().len() {
            let rows: Vec<_> = pairs.iter().map(|p| &p["conditions"][arm]).collect();
            let escapes: Vec<_> = rows
                .iter()
                .map(|r| r["result"]["outcomes"]["escaped"].as_f64().unwrap())
                .collect();
            let paired: Vec<_> = pairs
                .iter()
                .map(|p| {
                    p["conditions"][0]["result"]["outcomes"]["escaped"]
                        .as_f64()
                        .unwrap()
                        - p["conditions"][arm]["result"]["outcomes"]["escaped"]
                            .as_f64()
                            .unwrap()
                })
                .collect();
            summaries.insert(rows[0]["condition"].as_str().unwrap().into(), json!({"escapes":escapes,"medianEscapes":median(escapes),"oneStarAttempts":rows.iter().filter(|r|r["result"]["stars"].as_u64().unwrap()>=1).count(),"medianReferenceMinusThis":median(paired)}));
        }
        let report = json!({"acceptance":{"diagnosticOnly":count<30,"completeSeedSet":count==30 && pairs.len()==30,"seedSetPassed":count==30 && pairs.len()==30 && stars>=27 && median(diffs.clone())>=4.,"campaignAccepted":false,"remaining":"Need matching frozen 30-seed tuning and disjoint 30-seed heldout reports, plus integration/human gates; one partial or individual report cannot accept campaign content"},"summaries":summaries,"topology":topology,"contentHash":format!("{:x}",Sha256::digest(content_text.as_bytes())),"content":serde_json::from_str::<Value>(&content_text)?,"graphHash":graph.manifest.graph_hash,"neurons":graph.neuron_count(),"edges":graph.edge_count(),"manifestHash":format!("{:x}",Sha256::digest(manifest.as_bytes())),"simulationBuildId":SIMULATION_BUILD_ID,"probeSourceHash":format!("{:x}",Sha256::digest(include_bytes!("campaign_probe.rs"))),"graphLoadSeconds":graph_load_seconds,"seedSet":args[3],"requestedPairs":count,"completedPairs":pairs.len(),"oneStarReferenceAttempts":stars,"medianPairedEscapeDifference":median(diffs),"wallSeconds":start.elapsed().as_secs_f64(),"pairs":pairs});
        std::fs::write(&args[5], serde_json::to_string_pretty(&report)?)?;
    }
    Ok(())
}
