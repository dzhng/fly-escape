//! Paired content calibration through the real Graph + Attempt; no motion shortcuts.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{attempt::*, placement::Placement, Graph};
use std::{collections::BTreeSet, sync::Arc, time::Instant};
#[derive(Clone, Deserialize)]
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
    use sim::environment::Point;
    let geometry = &level.geometry;
    let radius = level.body_config.body_radius;
    if !(5..=9).contains(&geometry.rooms.len()) || !radius.is_finite() || radius <= 0. {
        return Err("campaign topology requires 5..9 rooms and positive body radius".into());
    }
    let resolved = sim::placement::resolve_placements(level, &[])?;
    sim::body::BodyWorld::new(
        geometry,
        &resolved.state.food,
        &resolved.state.objects,
        &level.zappers,
        level.exit,
        level.duration_ticks,
    )?;
    let mut links = BTreeSet::new();
    for (i, a) in geometry.rooms.iter().enumerate() {
        for b in &geometry.rooms[i + 1..] {
            for (a, b) in [(a, b), (b, a)] {
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
                                Point {
                                    x: edge - radius * 2.,
                                    z: along,
                                },
                                Point {
                                    x: edge + radius * 2.,
                                    z: along,
                                },
                            )
                        } else {
                            (
                                Point {
                                    x: along,
                                    z: edge - radius * 2.,
                                },
                                Point {
                                    x: along,
                                    z: edge + radius * 2.,
                                },
                            )
                        };
                        if geometry.room_at(from) == Some(a.id)
                            && geometry.room_at(to) == Some(b.id)
                            && geometry.contains_body(from, radius)
                            && geometry.contains_body(to, radius)
                            && geometry.sweep(from, to, radius) == to
                        {
                            links.insert((a.id.min(b.id), a.id.max(b.id)));
                            break;
                        }
                    }
                }
            }
        }
    }
    let mid = Point {
        x: (level.exit.a.x + level.exit.b.x) / 2.,
        z: (level.exit.a.z + level.exit.b.z) / 2.,
    };
    let inside = Point {
        x: mid.x - level.exit.outward.x * radius * 2.,
        z: mid.z - level.exit.outward.z * radius * 2.,
    };
    let outside = Point {
        x: mid.x + level.exit.outward.x * radius * 2.,
        z: mid.z + level.exit.outward.z * radius * 2.,
    };
    let exit_room = geometry
        .room_at(inside)
        .ok_or("exit lacks an inside room")?;
    if geometry.room_at(outside).is_some()
        || !geometry.contains_body(inside, radius)
        || geometry.sweep(inside, outside, radius) != outside
    {
        return Err("exit must permit a clear body sweep outward".into());
    }
    let mut reached = BTreeSet::from([exit_room]);
    loop {
        let before = reached.len();
        for &(a, b) in &links {
            if reached.contains(&a) || reached.contains(&b) {
                reached.extend([a, b]);
            }
        }
        if reached.len() == before {
            break;
        }
    }
    if reached.len() != geometry.rooms.len()
        || sim::spawn::resolve(level, 0, 20)?.iter().any(|body| {
            geometry
                .room_at(body.pose.position)
                .is_none_or(|id| !reached.contains(&id))
        })
    {
        return Err(
            "all rooms and spawns must connect to the exit through body-clear openings".into(),
        );
    }
    Ok(
        json!({"bodyRadius":radius,"roomLinks":links,"exitRoom":exit_room,"method":"bounded shared-boundary samples checked by Geometry body occupancy and sweep, followed by offline connectivity traversal; no runtime steering"}),
    )
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct DetectorStats {
    ticks: u32,
    active_ticks: u32,
    left_ticks: u32,
    right_ticks: u32,
    outside_floor_ticks: u32,
    on_floor_ticks: u32,
    on_floor_active_ticks: u32,
    on_floor_relative_contrast_sum: f64,
    blocked_antenna_ticks: u32,
    signed_turn_sum: f64,
    absolute_turn_sum: f64,
    positive_turn_ticks: u32,
    negative_turn_ticks: u32,
    longest_same_sign_run: u32,
    #[serde(skip)]
    run: u32,
    #[serde(skip)]
    previous_sign: i8,
}
impl DetectorStats {
    fn observe(
        &mut self,
        active: bool,
        left: bool,
        outside: bool,
        blocked: bool,
        relative_contrast: f64,
        turn: f64,
    ) {
        self.ticks += 1;
        self.active_ticks += active as u32;
        self.left_ticks += (active && left) as u32;
        self.right_ticks += (active && !left) as u32;
        self.outside_floor_ticks += outside as u32;
        if !outside {
            self.on_floor_ticks += 1;
            self.on_floor_active_ticks += active as u32;
            self.on_floor_relative_contrast_sum += relative_contrast;
        }
        self.blocked_antenna_ticks += blocked as u32;
        self.signed_turn_sum += turn;
        self.absolute_turn_sum += turn.abs();
        let sign = if turn > 1e-8 {
            1
        } else if turn < -1e-8 {
            -1
        } else {
            0
        };
        self.positive_turn_ticks += (sign > 0) as u32;
        self.negative_turn_ticks += (sign < 0) as u32;
        self.run = if sign == 0 {
            0
        } else if sign == self.previous_sign {
            self.run + 1
        } else {
            1
        };
        self.previous_sign = sign;
        self.longest_same_sign_run = self.longest_same_sign_run.max(self.run);
    }
    fn break_run(&mut self) {
        self.run = 0;
        self.previous_sign = 0;
    }
}
fn run(
    graph: &Arc<Graph>,
    content: &Content,
    seed: u64,
    label: &str,
    placements: &[Placement],
    detector: bool,
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
    let mut body_events = vec![];
    let mut wall_motor_samples = vec![];
    let mut detector_samples = vec![];
    let mut detector_free: Vec<DetectorStats> = (0..20).map(|_| DetectorStats::default()).collect();
    let mut detector_wall: Vec<DetectorStats> = (0..20).map(|_| DetectorStats::default()).collect();
    let mut wall_sample_counts = [0u32; 20];
    let mut wall_abs_turn_sum = [0f64; 20];
    let mut wall_abs_turn_max = [0f64; 20];
    let mut wall_abs_heading_delta_sum = [0f64; 20];
    let mut first_tick_seconds = None;
    loop {
        let frame = attempt.step()?.ok_or("missing terminal frame")?;
        if first_tick_seconds.is_none() {
            first_tick_seconds = Some(start.elapsed().as_secs_f64());
        }
        for fly in &frame.flies {
            if !fly.events.is_empty() {
                body_events.push(json!({"tick":frame.tick,"flyId":fly.id,"events":fly.events,"position":fly.body.pose.position,"mode":fly.body.mode}));
            }
            let a = fly.input_pose.position;
            let b = fly.body.pose.position;
            if detector {
                if let (Some(sample), Some(neural)) = (&fly.sensory, &fly.neural) {
                    let cue = &content.tuning.cues[0];
                    let currents =
                        sim::sensory::cue_currents(graph, sample, cue.pathway, cue.gain)?;
                    let active = currents.iter().any(|(_, v)| *v > 0.);
                    let left = sample.left.attractive_odor + sample.left.exit_cue;
                    let right = sample.right.attractive_odor + sample.right.exit_cue;
                    let offset = content.level.field_config.antenna_offset;
                    let dx = fly.input_pose.heading.sin() * offset;
                    let dz = -fly.input_pose.heading.cos() * offset;
                    let antennae = [
                        sim::environment::Point {
                            x: a.x + dx,
                            z: a.z + dz,
                        },
                        sim::environment::Point {
                            x: a.x - dx,
                            z: a.z - dz,
                        },
                    ];
                    let outside = antennae.map(|p| content.level.geometry.room_at(p).is_none());
                    let blocked = antennae.map(|p| !content.level.geometry.contains_body(p, 0.));
                    let wall = fly.body.outcome.is_none()
                        && fly.body.mode != sim::body::BodyMode::Feeding
                        && (a.x - b.x).hypot(a.z - b.z) < 1e-8
                        && !content
                            .level
                            .geometry
                            .contains_body(b, content.level.body_config.body_radius + 1e-5);
                    let turn = if fly.body.mode == sim::body::BodyMode::Flying {
                        neural.motor.flight_turn
                    } else if fly.body.mode == sim::body::BodyMode::Walking {
                        neural.motor.turn
                    } else {
                        0.
                    };
                    let id = fly.id as usize;
                    if wall {
                        detector_wall[id].observe(
                            active,
                            left > right,
                            outside.contains(&true),
                            blocked.contains(&true),
                            if left + right > 0. {
                                (left - right).abs() / (left + right)
                            } else {
                                0.
                            },
                            turn,
                        );
                        detector_free[id].break_run();
                    } else {
                        detector_free[id].observe(
                            active,
                            left > right,
                            outside.contains(&true),
                            blocked.contains(&true),
                            if left + right > 0. {
                                (left - right).abs() / (left + right)
                            } else {
                                0.
                            },
                            turn,
                        );
                        detector_wall[id].break_run();
                    }
                    if frame.tick % 50 == 0 || fly.body.outcome.is_some() {
                        let delta = (fly.body.pose.heading - fly.input_pose.heading
                            + std::f64::consts::PI)
                            .rem_euclid(std::f64::consts::TAU)
                            - std::f64::consts::PI;
                        detector_samples.push(json!({"tick":frame.tick,"flyId":id,"sensory":sample,"left":left,"right":right,"absoluteContrast":(left-right).abs(),"relativeContrast":if left+right>0. {(left-right).abs()/(left+right)} else {0.},"active":active,"selectedSide":if !active {"none"} else if left>right {"left"} else {"right"},"antennae":antennae,"outsideFloor":outside,"blockedAntennae":blocked,"boundaryStalled":wall,"motor":neural.motor,"headingDelta":delta,"inputPose":fly.input_pose,"body":fly.body}));
                    }
                }
            }
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
                    let id = fly.id as usize;
                    boundary_stalled[id] += 1;
                    if let Some(neural) = &fly.neural {
                        let turn = if fly.body.mode == sim::body::BodyMode::Flying {
                            neural.motor.flight_turn
                        } else {
                            neural.motor.turn
                        };
                        let delta = (fly.body.pose.heading - fly.input_pose.heading
                            + std::f64::consts::PI)
                            .rem_euclid(std::f64::consts::TAU)
                            - std::f64::consts::PI;
                        wall_abs_turn_sum[id] += turn.abs();
                        wall_abs_turn_max[id] = wall_abs_turn_max[id].max(turn.abs());
                        wall_abs_heading_delta_sum[id] += delta.abs();
                        if wall_sample_counts[id] < 8
                            && (boundary_stalled[id] <= 2 || frame.tick % 200 == 0)
                        {
                            wall_sample_counts[id] += 1;
                            wall_motor_samples.push(json!({"tick":frame.tick,"flyId":id,"inputPose":fly.input_pose,"body":fly.body,"motor":neural.motor,"appliedTurn":turn,"headingDelta":delta}));
                        }
                    }
                }
            }
        }
        if frame.tick % 50 == 0 || frame.result.is_some() {
            samples.push(json!({"tick":frame.tick,"flies":frame.flies.iter().map(|f|json!({"id":f.id,"inputPose":f.input_pose,"body":f.body,"motor":f.neural.as_ref().map(|n|&n.motor)})).collect::<Vec<_>>()}));
        }
        if let Some(result) = frame.result {
            return Ok(
                json!({"seed":seed,"condition":label,"bodyEvents":body_events,"spec":spec,"result":result,"constructSeconds":construct_seconds,"firstTickSeconds":first_tick_seconds,"wallSeconds":start.elapsed().as_secs_f64(),"detector":if detector {json!({"free":detector_free,"wall":detector_wall,"samples":detector_samples,"activationAuthority":"cue_currents on actual FlyFrame sensory; no duplicated detector threshold","occupancy":"antennae reconstructed from FieldSet.sample formula; room_at checks floor and contains_body(radius=0) checks obstacles"})} else {Value::Null},"wallMotor":{"samples":wall_motor_samples,"maxSamplesPerFly":8,"absTurnSum":wall_abs_turn_sum,"absTurnMax":wall_abs_turn_max,"absHeadingDeltaSum":wall_abs_heading_delta_sum},"stalledTicks":stalled,"boundaryStalledTicks":boundary_stalled,"stallDefinition":"nonterminal nonfeeding displacement below 1e-8; boundary subset fails Geometry occupancy with body radius enlarged by 1e-5","samples":samples}),
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
    if !(6..=7).contains(&args.len())
        || args.get(6).is_some_and(|v| {
            v != "--empty-control"
                && v != "--reference-empty"
                && v != "--detector-controls"
                && v != "--no-fans-control"
        })
    {
        return Err(
            "Usage: campaign_probe GRAPH_DIR CONTENT_JSON tuning|heldout COUNT OUTPUT_JSON [--empty-control|--reference-empty|--detector-controls|--no-fans-control]".into(),
        );
    }
    let content_text = std::fs::read_to_string(&args[2])?;
    let content: Content = serde_json::from_str(&content_text)?;
    let count: usize = args[4].parse()?;
    let reference_empty = args.get(6).is_some_and(|v| v == "--reference-empty");
    let detector = reference_empty || args.get(6).is_some_and(|v| v == "--detector-controls");
    if detector
        && (count > 3
            || content.tuning.cues.len() != 1
            || content.tuning.cues[0].pathway != sim::sensory::CuePathway::InhibitoryOdor)
    {
        return Err("reference-empty diagnostic requires at most three seeds and exactly one inhibitory odor cue".into());
    }
    let no_fans = args.get(6).is_some_and(|v| v == "--no-fans-control");
    let topology = topology(&content.level)?;
    let thresholds = content.level.star_thresholds;
    if thresholds[0] == 0 || thresholds[2] > 20 || thresholds.windows(2).any(|v| v[0] >= v[1]) {
        return Err("star thresholds must be positive, strictly increasing and at most 20".into());
    }
    if !(1..=30).contains(&count)
        || !(5..=9).contains(&content.level.geometry.rooms.len())
        || content.tuning.taste_gain <= 0.
        || !content.tuning.silenced_neurons.is_empty()
    {
        return Err(
            "requires 1..30 seeds, 20 flies, 5..9 rooms, explicit taste gain and no ablation"
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
        let without_fans: Vec<_> = content
            .reference
            .iter()
            .filter(|p| p.kind != sim::placement::ToolKind::Fan)
            .cloned()
            .collect();
        let mut arms = vec![("reference", &content.reference)];
        if !reference_empty {
            arms.push(("poor", &content.poor));
        }
        if no_fans {
            arms.push(("no-fans", &without_fans));
        } else if args.len() == 7 {
            arms.push(("empty", &empty));
        }
        for (label, placements) in arms {
            let row = run(&graph, &content, seed, label, placements, detector)?;
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
        let acceptance = acceptance(
            &summaries,
            count == 30 && pairs.len() == 30,
            content.frozen,
            detector,
            no_fans,
        );
        let report = json!({"acceptance":acceptance,"summaries":summaries,"topology":topology,"contentHash":format!("{:x}",Sha256::digest(content_text.as_bytes())),"content":serde_json::from_str::<Value>(&content_text)?,"graphHash":graph.manifest.graph_hash,"neurons":graph.neuron_count(),"edges":graph.edge_count(),"manifestHash":format!("{:x}",Sha256::digest(manifest.as_bytes())),"simulationBuildId":SIMULATION_BUILD_ID,"probeSourceHash":format!("{:x}",Sha256::digest(include_bytes!("campaign_probe.rs"))),"graphLoadSeconds":graph_load_seconds,"seedSet":args[3],"requestedPairs":count,"completedPairs":pairs.len(),"oneStarReferenceAttempts":stars,"medianPairedEscapeDifference":median(diffs),"wallSeconds":start.elapsed().as_secs_f64(),"pairs":pairs});
        std::fs::write(&args[5], serde_json::to_string_pretty(&report)?)?;
    }
    Ok(())
}

fn acceptance(
    summaries: &serde_json::Map<String, Value>,
    full: bool,
    frozen: bool,
    diagnostic: bool,
    require_no_fans: bool,
) -> Value {
    let benefit = |arm: &str| {
        summaries
            .get(arm)
            .and_then(|s| s["medianReferenceMinusThis"].as_f64())
            .is_some_and(|v| v >= 4.)
    };
    let enough_stars = summaries
        .get("reference")
        .and_then(|s| s["oneStarAttempts"].as_u64())
        .is_some_and(|n| n >= 27);
    json!({"diagnosticOnly":!full || diagnostic,"completeSeedSet":full,
        "seedSetPassed":full && frozen && !diagnostic && enough_stars && benefit("poor") && (!require_no_fans || benefit("no-fans")),
        "campaignAccepted":false,
        "remaining":"Need matching frozen 30-seed tuning and disjoint 30-seed heldout reports, plus integration/human gates; one partial or individual report cannot accept campaign content"})
}

#[cfg(test)]
mod tests {
    use super::*;
    fn level(source: &str) -> LevelDef {
        // The authored TypeScript modules hold JSON literals. Read those same
        // levels so topology checks cannot drift into a separate test campaign.
        let start = source.find("= {").unwrap() + 2;
        let end = source.rfind("};").unwrap() + 1;
        let mut content: Value = serde_json::from_str(&source[start..end]).unwrap();
        serde_json::from_value(content["level"].take()).unwrap()
    }
    #[test]
    fn diagnostic_or_missing_control_cannot_accept_a_seed_set() {
        let mut summaries = serde_json::Map::from_iter([
            (
                "reference".into(),
                json!({"oneStarAttempts":30,"medianEscapes":10}),
            ),
            ("poor".into(), json!({"medianReferenceMinusThis":8})),
            ("no-fans".into(), json!({"medianReferenceMinusThis":5})),
        ]);
        assert_eq!(
            acceptance(&summaries, true, true, false, true)["seedSetPassed"],
            true
        );
        for (full, frozen, diagnostic) in [
            (false, true, false),
            (true, false, false),
            (true, true, true),
        ] {
            let gate = acceptance(&summaries, full, frozen, diagnostic, true);
            assert_eq!(gate["seedSetPassed"], false);
            assert_eq!(gate["campaignAccepted"], false);
        }
        summaries.remove("no-fans");
        assert_eq!(
            acceptance(&summaries, true, true, false, true)["seedSetPassed"],
            false
        );
        summaries.remove("poor");
        assert_eq!(
            acceptance(&summaries, true, true, false, false)["seedSetPassed"],
            false
        );
    }
    #[test]
    fn real_five_and_six_room_layouts_are_order_independent() {
        for text in [
            include_str!("../../../apps/web/src/levels/open-window.ts"),
            include_str!("../../../apps/web/src/levels/turn-the-corner.ts"),
        ] {
            let mut level = level(text);
            let expected = topology(&level).unwrap();
            level.geometry.rooms.reverse();
            assert_eq!(topology(&level).unwrap(), expected);
        }
    }
    #[test]
    fn disconnected_room_and_blocked_exit_are_rejected() {
        let mut level = level(include_str!("../../../apps/web/src/levels/open-window.ts"));
        let mut room = level.geometry.rooms[0].clone();
        room.id = 99;
        room.min.x += 100.;
        room.max.x += 100.;
        level.geometry.rooms.push(room);
        assert!(topology(&level).unwrap_err().contains("connect"));
        level.geometry.rooms.pop();
        level.exit.outward.x = -level.exit.outward.x;
        assert!(topology(&level).is_err());
    }
}
