//! Scent-strength spike: does the magnitude of an odour, rather than only which
//! antenna smells more of it, change what flies do? One continuous native Attempt
//! per (encoding, emission, seed): constructed once and stepped to its own terminal
//! frame. No respawn, no neural reset, no reseeding, no field or body reset.
//!
//! The only adapter difference between the two encodings is the amplitude handed to
//! the already-chosen winning side (sim::sensory::OdorEncoding). Side selection, the
//! contrast detector, thresholds, signs, neural dynamics, exit suction and the fan
//! set are identical, and no arm places a fan.
use serde::Deserialize;
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use sim::{
    attempt::*,
    environment::{Point, Source, SourceKind},
    placement::Placement,
    sensory::{cue_currents_with, CuePathway, OdorEncoding},
    Graph,
};
use std::{collections::BTreeMap, sync::Arc, time::Instant};

const FLY_COUNT: u32 = 16;
/// The room holding the exit; "reached the final room" means room_at == this.
const FINAL_ROOM: u32 = 1;
/// Matches the vicinity radius used by the existing placement probes.
const VICINITY: f64 = 0.9;

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Content {
    level: LevelDef,
    tuning: AttemptTuning,
    reference: Vec<Placement>,
    /// Decimal wire values; the u64 seeds exceed what a JSON number holds exactly.
    tuning_seeds: Vec<String>,
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

/// Running summary of a per-tick scalar, kept instead of every sample.
#[derive(Default, Clone)]
struct Tally {
    count: u32,
    nonzero: u32,
    sum: f64,
    max: f64,
}
impl Tally {
    fn push(&mut self, value: f64) {
        self.count += 1;
        if value > 0. {
            self.nonzero += 1;
        }
        self.sum += value;
        self.max = self.max.max(value);
    }
    fn json(&self) -> Value {
        json!({
            "ticks": self.count,
            "nonzeroTicks": self.nonzero,
            "mean": if self.count > 0 { self.sum / self.count as f64 } else { 0. },
            "meanOverNonzero": if self.nonzero > 0 { self.sum / self.nonzero as f64 } else { 0. },
            "max": self.max,
        })
    }
}

/// Global3x odor emission, including authored sources and fixed/placed objects.
/// Co-located surplus sources preserve the native catalog and geometry. Light,
/// airflow and the exit cue are not odor emissions and remain unchanged.
fn scaled_level(content: &Content, banana: &Placement, placed: bool) -> LevelDef {
    use sim::placement::{tool_def, ToolEffect};
    let mut level = content.level.clone();
    let odor = |kind: SourceKind| matches!(kind, SourceKind::AttractiveOdor | SourceKind::RepellentOdor);
    for source in &mut level.sources {
        if odor(source.kind) { source.rate *= 3.; }
    }
    // Catalog-resolved objects retain their native source. Add exactly its twofold
    // surplus for every fixed object and for the placed banana when present.
    for p in content.level.fixed_objects.iter().chain(if placed { Some(banana) } else { None }) {
        if let ToolEffect::Source { kind, radius, rate } = tool_def(p.kind).effect {
            if odor(kind) { level.sources.push(Source { position: p.position, radius, rate: 2. * rate, kind }); }
        }
    }
    level
}

#[allow(clippy::too_many_arguments)]
fn run(
    graph: &Arc<Graph>,
    level: &LevelDef,
    tuning: &AttemptTuning,
    seed: u64,
    label: &str,
    placements: &[Placement],
    vicinity_target: Point,
    checkpoints: &[u32],
) -> Result<Value, String> {
    let start = Instant::now();
    let spec = Attempt::describe(
        graph,
        level,
        tuning,
        &format!("scent-{label}-{seed}"),
        seed,
        FLY_COUNT,
        placements,
    )?;
    let mut attempt = Attempt::new(
        graph.clone(),
        level.clone(),
        tuning.clone(),
        spec.clone(),
    )?;
    let construct_seconds = start.elapsed().as_secs_f64();
    eprintln!(
        "  [{label} seed {seed}] constructed in {construct_seconds:.2}s; {} flies, horizon {} ticks",
        spec.fly_count, spec.duration_ticks
    );

    let flies = spec.fly_count as usize;
    let mut occupancy: Vec<BTreeMap<String, u32>> = vec![BTreeMap::new(); flies];
    let mut reached_final = vec![false; flies];
    let mut first_final_tick = vec![Value::Null; flies];
    let mut escape_tick = vec![Value::Null; flies];
    let mut terminal_tick = vec![Value::Null; flies];
    let mut vicinity_ticks = vec![0u32; flies];
    let mut first_vicinity_tick = vec![Value::Null; flies];
    let mut food_support_ticks = vec![0u32; flies];
    let mut feeding_ticks = vec![0u32; flies];
    // What the adapter actually hands the neurons, recomputed from each frame's own
    // SensorySample with the same function the step used.
    let mut delivered = vec![Tally::default(); flies];
    let mut concentration = vec![Tally::default(); flies];
    let mut captured: Vec<Value> = vec![];
    let mut progress = Instant::now();
    let food_ids: Vec<u32> = attempt
        .resolved_setup()
        .state
        .food
        .iter()
        .map(|s| s.id)
        .collect();

    let result = loop {
        let frame = attempt.step()?.ok_or("missing terminal frame")?;
        for fly in &frame.flies {
            let id = fly.id as usize;
            if fly.body.outcome.is_none() {
                let position = fly.body.pose.position;
                if level.geometry.room_at(position) == Some(FINAL_ROOM) {
                    if !reached_final[id] {
                        first_final_tick[id] = json!(frame.tick);
                    }
                    reached_final[id] = true;
                }
                if (position.x - vicinity_target.x).hypot(position.z - vicinity_target.z) < VICINITY {
                    vicinity_ticks[id] += 1;
                    if first_vicinity_tick[id].is_null() {
                        first_vicinity_tick[id] = json!(frame.tick);
                    }
                }
                if fly.body.support.is_some_and(|s| food_ids.contains(&s)) {
                    food_support_ticks[id] += 1;
                }
                if fly.body.mode == sim::body::BodyMode::Feeding {
                    feeding_ticks[id] += 1;
                }
            }
            if let Some(sample) = &fly.sensory {
                let excitatory = tuning
                    .cues
                    .iter()
                    .find(|c| c.pathway == CuePathway::ExcitatoryOdor);
                if let Some(cue) = excitatory {
                    let currents = cue_currents_with(
                        graph,
                        sample,
                        cue.pathway,
                        cue.gain,
                        tuning.odor_encoding,
                    )?;
                    delivered[id].push(
                        currents
                            .iter()
                            .map(|(_, current)| *current)
                            .fold(0., f64::max),
                    );
                }
                concentration[id].push(
                    sample
                        .left
                        .attractive_odor
                        .max(sample.right.attractive_odor),
                );
            }
            *occupancy[id]
                .entry(station(level, &fly.body))
                .or_default() += 1;
            if fly.body.outcome.is_some() && terminal_tick[id].is_null() {
                terminal_tick[id] = json!(frame.tick);
                if fly.body.outcome == Some(sim::body::TerminalOutcome::Escaped) {
                    escape_tick[id] = json!(frame.tick);
                }
            }
        }
        if checkpoints.contains(&frame.tick) || frame.result.is_some() {
            let mut stations: Map<String, Value> = Map::new();
            for fly in &frame.flies {
                let entry = stations.entry(station(level, &fly.body)).or_insert(json!(0));
                *entry = json!(entry.as_u64().unwrap() + 1);
            }
            let summary = sim::body::summarize_outcomes(
                &frame.flies.iter().map(|f| f.body.clone()).collect::<Vec<_>>(),
            );
            eprintln!(
                "  [{label} seed {seed}] tick {} ({:.1}s wall): escaped {} timedOut {}; reachedFinalRoom {}",
                frame.tick,
                start.elapsed().as_secs_f64(),
                summary.escaped,
                summary.timed_out,
                reached_final.iter().filter(|r| **r).count(),
            );
            captured.push(json!({
                "tick": frame.tick,
                "simulatedSeconds": frame.tick as f64 * GAME_TICK_SECONDS,
                "outcomes": summary,
                "stations": stations,
                "reachedFinalRoomSoFar": reached_final.iter().filter(|r| **r).count(),
            }));
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

    let arrivals: Vec<u32> = first_final_tick
        .iter()
        .filter_map(|v| v.as_u64().map(|t| t as u32))
        .collect();
    Ok(json!({
        "condition": label,
        "seed": seed.to_string(),
        "spec": spec,
        "result": result,
        "checkpoints": captured,
        "summary": {
            "flies": flies,
            "uniqueFinalRoomEntrants": reached_final.iter().filter(|r| **r).count(),
            "escaped": escape_tick.iter().filter(|t| !t.is_null()).count(),
            "meanFirstFinalRoomTick": if arrivals.is_empty() { Value::Null }
                else { json!(arrivals.iter().sum::<u32>() as f64 / arrivals.len() as f64) },
            "medianFirstFinalRoomTick": if arrivals.is_empty() { Value::Null } else {
                let mut sorted = arrivals.clone();
                sorted.sort_unstable();
                json!(sorted[sorted.len() / 2])
            },
            "totalVicinityTicks": vicinity_ticks.iter().sum::<u32>(),
            "fliesEverInVicinity": vicinity_ticks.iter().filter(|t| **t > 0).count(),
            "totalFeedingTicks": feeding_ticks.iter().sum::<u32>(),
            "meanDeliveredExcitatoryCurrent": delivered.iter().map(|t| t.sum).sum::<f64>()
                / delivered.iter().map(|t| t.count as f64).sum::<f64>().max(1.),
            "meanSampledConcentration": concentration.iter().map(|t| t.sum).sum::<f64>()
                / concentration.iter().map(|t| t.count as f64).sum::<f64>().max(1.),
            "deliveryTickFraction": delivered.iter().map(|t| t.nonzero as f64).sum::<f64>()
                / delivered.iter().map(|t| t.count as f64).sum::<f64>().max(1.),
        },
        "perFly": {
            "reachedFinalRoom": reached_final,
            "firstFinalRoomTick": first_final_tick,
            "escapeTick": escape_tick,
            "terminalTick": terminal_tick,
            "vicinityTicks": vicinity_ticks,
            "firstVicinityTick": first_vicinity_tick,
            "foodSupportTicks": food_support_ticks,
            "feedingTicks": feeding_ticks,
            "deliveredExcitatoryCurrent": delivered.iter().map(Tally::json).collect::<Vec<_>>(),
            "sampledAttractiveOdor": concentration.iter().map(Tally::json).collect::<Vec<_>>(),
            "tickOccupancy": occupancy,
        },
        "vicinityTarget": vicinity_target,
        "vicinityRadius": VICINITY,
        "constructSeconds": construct_seconds,
        "wallSeconds": start.elapsed().as_secs_f64(),
    }))
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 7 {
        return Err("Usage: global_scent_probe GRAPH_DIR CONTENT_JSON OUTPUT_JSON DURATION_TICKS binary|saturating SEED_INDEX".into());
    }
    let content_text = std::fs::read_to_string(&args[2])?;
    let mut content: Content = serde_json::from_str(&content_text)?;
    let authored_duration = content.level.duration_ticks;
    let duration: u32 = args[4].parse()?;
    // The diagnostic horizon and encoding are shared with the earlier normal-emission controls.
    content.level.duration_ticks = duration;
    content.tuning.odor_encoding = match args[5].as_str() {
        "binary" => OdorEncoding::Binary,
        "saturating" => OdorEncoding::Saturating,
        other => return Err(format!("unknown encoding {other}").into()),
    };
    let seed_index: usize = args[6].parse()?;
    let seed: u64 = content
        .tuning_seeds
        .get(seed_index)
        .ok_or("seed index out of range")?
        .parse()?;
    let checkpoints: Vec<u32> = [1500u32, 3000, 4500, 6000]
        .into_iter()
        .filter(|t| *t <= duration)
        .collect();
    // Only the first authored placement: one banana at the final-room entrance.
    let banana = content.reference[0].clone();

    let start = Instant::now();
    let bytes = std::fs::read(format!("{}/graph.bin", args[1]))?;
    let manifest = std::fs::read_to_string(format!("{}/manifest.json", args[1]))?;
    let graph = Arc::new(Graph::from_bytes(&bytes, &manifest)?);
    drop(bytes);
    eprintln!("graph loaded in {:.2}s", start.elapsed().as_secs_f64());

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
        "probeSourceHash": format!("{:x}", Sha256::digest(include_bytes!("global_scent_probe.rs"))),
        "sensorySourceHash": format!("{:x}", Sha256::digest(include_bytes!("../src/sensory.rs"))),
        "flyCount": FLY_COUNT,
        "odorEncoding": args[5],
        "saturationHalfConcentration": sim::sensory::SATURATION_HALF_CONCENTRATION,
        "seedIndex": seed_index,
        "seed": seed.to_string(),
        "placement": banana,
        "checkpoints": checkpoints,
        "continuity": "one Attempt per (encoding, emission, seed), constructed once and stepped to its own terminal frame; no respawn, no neural reset, no reseeding, no field or body reset",
        "emissionTreatment": "ALL attractive and repellent odor sources scaled3x, including fixed catalog objects and placed banana",
        "unchanged": "geometry, exit suction, exit cue, light, cue gains, detection thresholds, neural dynamics, spawn; no fan",
    });

    let mut arms = vec![];
    for (label, placed) in [("global3x-empty", false), ("global3x-banana", true)] {
        let level = scaled_level(&content, &banana, placed);
        let placements: Vec<Placement> = if placed { vec![banana.clone()] } else { vec![] };
        let row = run(
            &graph,
            &level,
            &content.tuning,
            seed,
            &format!("{}-{label}", args[5]),
            &placements,
            banana.position,
            &checkpoints,
        )?;
        eprintln!(
            "{} {label} seed {seed}: {} in {:.1}s",
            args[5],
            row["result"],
            row["wallSeconds"].as_f64().unwrap()
        );
        arms.push(row);
        // Incremental checkpoint write after every completed arm.
        std::fs::write(
            &args[3],
            serde_json::to_string_pretty(&json!({
                "identity": identity,
                "complete": false,
                "wallSeconds": start.elapsed().as_secs_f64(),
                "arms": arms,
            }))?,
        )?;
    }
    std::fs::write(
        &args[3],
        serde_json::to_string_pretty(&json!({
            "identity": identity,
            "complete": true,
            "wallSeconds": start.elapsed().as_secs_f64(),
            "arms": arms,
        }))?,
    )?;
    eprintln!("done in {:.1}s", start.elapsed().as_secs_f64());
    Ok(())
}

#[test]
fn all_resolved_odor_sources_scale_and_non_odor_sources_stay_fixed() {
    use sim::placement::resolve_placements;
    let mut content: Content = serde_json::from_str(include_str!("/tmp/fly-five-bananas.json")).unwrap();
    // Synthetic channels supplement the actual-house fixture: this house has no
    // active repellent or lamp emitters, but the global rule must handle both.
    for kind in [SourceKind::RepellentOdor, SourceKind::Lamp] {
        content.level.sources.push(Source { position: content.reference[0].position, radius: 0.75, rate: 0.4, kind });
    }
    let banana = content.reference[0].clone();
    let totals = |sources: &[Source]| {
        let mut map = BTreeMap::<String, (SourceKind, f64)>::new();
        for s in sources {
            let key = format!("{:?}:{:?}:{:?}:{:?}", s.kind, s.position.x, s.position.z, s.radius);
            map.entry(key).or_insert((s.kind,0.)).1 += s.rate;
        }
        map
    };
    for placed in [false,true] {
        let placements = if placed { vec![banana.clone()] } else { vec![] };
        let before = resolve_placements(&content.level, &placements).unwrap();
        let after = resolve_placements(&scaled_level(&content,&banana,placed), &placements).unwrap();
        let old = totals(&before.sources); let new = totals(&after.sources);
        assert_eq!(old.len(),new.len());
        for (key,(kind,rate)) in old {
            let factor = if matches!(kind, SourceKind::AttractiveOdor | SourceKind::RepellentOdor) { 3. } else { 1. };
            assert!((new[&key].1-rate*factor).abs()<1e-12,"{key}");
        }
        assert_eq!(serde_json::to_value(before.state).unwrap(),serde_json::to_value(after.state).unwrap());
        assert_eq!(serde_json::to_value(before.field_config).unwrap(),serde_json::to_value(after.field_config).unwrap());
    }
}
