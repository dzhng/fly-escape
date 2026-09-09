//! Paired, vision-only closed-loop motion at the supplied production body gains.
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sim::{
    attempt::{Attempt, AttemptResult, AttemptTuning, CueInput, LevelDef, SIMULATION_BUILD_ID},
    body::{BodyPose, BodyState, ExitOpening},
    environment::{FieldConfig, Geometry, Point, RectRoom, Source, SourceKind, Wall},
    placement::PlacementRules,
    sensory::CuePathway,
    spawn::{SpawnDef, SpawnMode, SpawnState},
    Graph,
};
use std::{path::Path, sync::Arc, time::Instant};

#[derive(Deserialize)]
struct Content {
    level: LevelDef,
}
fn point(x: f64, z: f64) -> Point {
    Point { x, z }
}
fn distance(a: Point, b: Point) -> f64 {
    (a.x - b.x).hypot(a.z - b.z)
}
fn fixture(mut level: LevelDef, lamp: Option<Point>, mode: SpawnMode) -> LevelDef {
    level.id = "vision-motion".into();
    level.geometry = Geometry {
        rooms: vec![RectRoom {
            id: 0,
            min: point(-10., -10.),
            max: point(10., 10.),
        }],
        solids: vec![],
        walls: [
            ((-10., -10.), (10., -10.)),
            ((-10., -10.), (-10., 10.)),
            ((-10., 10.), (10., 10.)),
            ((10., -10.), (10., -0.5)),
            ((10., 0.5), (10., 10.)),
        ]
        .map(|(a, b)| Wall {
            a: point(a.0, a.1),
            b: point(b.0, b.1),
        })
        .to_vec(),
    };
    level.spawn = SpawnDef::Fixed {
        states: vec![SpawnState {
            pose: BodyPose {
                position: point(0., 0.),
                heading: 0.,
            },
            mode,
        }],
    };
    level.exit = ExitOpening {
        a: point(10., -0.5),
        b: point(10., 0.5),
        outward: point(1., 0.),
    };
    level.exit_cue = None;
    level.exit_suction = None;
    level.food.clear();
    level.fixed_objects.clear();
    level.zappers.clear();
    level.placement_rules = PlacementRules::default();
    level.sources = lamp
        .into_iter()
        .map(|position| Source {
            position,
            radius: 3.,
            rate: 1.,
            kind: SourceKind::Lamp,
        })
        .collect();
    level.field_config = FieldConfig {
        cell_size: 1.,
        diffusion: 0.,
        decay: 0.,
        baseline_brightness: 0.,
        wind: point(0., 0.),
        fans: vec![],
        ..level.field_config
    };
    level.duration_ticks = 300;
    level
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct MotionRun {
    initial_body: BodyState,
    final_body: BodyState,
    trajectory_hash: String,
    total_neural_steps: u32,
    path_length: f64,
    boundary_ticks: u32,
    result: AttemptResult,
    #[serde(skip)]
    poses: Vec<BodyPose>,
}
fn run(graph: &Arc<Graph>, level: LevelDef, gain: f64, seed: u64) -> Result<MotionRun, String> {
    let tuning = AttemptTuning {
        cues: vec![CueInput {
            pathway: CuePathway::Vision,
            gain,
        }],
        ..Default::default()
    };
    let spec = Attempt::describe(graph, &level, &tuning, "vision-motion", seed, 1, &[])?;
    let geometry = level.geometry.clone();
    let radius = level.body_config.body_radius;
    let mut attempt = Attempt::new(graph.clone(), level, tuning, spec)?;
    let initial = attempt.initial_bodies().remove(0);
    let mut poses = vec![initial.pose];
    let mut hash = Sha256::new();
    hash.update(serde_json::to_vec(&initial).map_err(|e| e.to_string())?);
    let mut path_length = 0.;
    let mut boundary_ticks = 0;
    for _ in 0..300 {
        let frame = attempt
            .step()?
            .ok_or("attempt ended without a terminal frame")?;
        let body = &frame.flies[0].body;
        path_length += distance(poses.last().unwrap().position, body.pose.position);
        poses.push(body.pose);
        hash.update(frame.tick.to_le_bytes());
        hash.update(serde_json::to_vec(body).map_err(|e| e.to_string())?);
        boundary_ticks += u32::from(!geometry.contains_body(body.pose.position, radius + 1e-6));
        if let Some(result) = frame.result {
            return Ok(MotionRun {
                initial_body: initial,
                final_body: body.clone(),
                trajectory_hash: format!("{:x}", hash.finalize()),
                total_neural_steps: frame.neural_steps,
                path_length,
                boundary_ticks,
                result,
                poses,
            });
        }
    }
    Err("attempt did not finish within its declared 300 ticks".into())
}
fn alignment(pose: BodyPose, reference: Point) -> Option<f64> {
    let dx = reference.x - pose.position.x;
    let dz = reference.z - pose.position.z;
    let distance = dx.hypot(dz);
    (distance > 0.).then(|| (pose.heading.cos() * dx + pose.heading.sin() * dz) / distance)
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Metrics {
    distance_reduction: f64,
    mean_heading_alignment: f64,
    final_heading_alignment: Option<f64>,
    alignment_samples: usize,
}
fn metrics(run: &MotionRun, reference: Point) -> Metrics {
    let aligned: Vec<_> = run
        .poses
        .iter()
        .filter_map(|&pose| alignment(pose, reference))
        .collect();
    // The initial pose is one unit from each reference, so at least one sample exists.
    Metrics {
        distance_reduction: distance(run.initial_body.pose.position, reference)
            - distance(run.final_body.pose.position, reference),
        mean_heading_alignment: aligned.iter().sum::<f64>() / aligned.len() as f64,
        final_heading_alignment: alignment(run.final_body.pose, reference),
        alignment_samples: aligned.len(),
    }
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Summary {
    mean: f64,
    sd_across_seeds: f64,
    ci95: [f64; 2],
}
fn summary(values: &[f64]) -> Summary {
    assert_eq!(
        values.len(),
        30,
        "independent units are the thirty declared seeds"
    );
    let mean = values.iter().sum::<f64>() / 30.;
    let sd = (values.iter().map(|v| (v - mean).powi(2)).sum::<f64>() / 29.).sqrt();
    let half = 2.045229642132703 * sd / 30f64.sqrt(); // Two-sided Student t, df=29.
    Summary {
        mean,
        sd_across_seeds: sd,
        ci95: [mean - half, mean + half],
    }
}
fn classification(distance: &Summary) -> &'static str {
    if distance.ci95[0] > 0. {
        "approach"
    } else if distance.ci95[1] < 0. {
        "avoidance"
    } else {
        "neither"
    }
}
fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<_> = std::env::args().collect();
    if !(6..=7).contains(&args.len()) {
        return Err(
            "Usage: vision_motion_probe GRAPH_DIR MAP_JSON CONTENT_JSON GAIN OUTPUT_JSON [walking|flying]".into(),
        );
    }
    let initial_mode = match args.get(6).map(String::as_str) {
        None | Some("walking") => SpawnMode::Walking,
        Some("flying") => SpawnMode::Flying,
        _ => return Err("initial mode must be walking or flying".into()),
    };
    let gain: f64 = args[4].parse()?;
    if !gain.is_finite() || !(0. ..=3.).contains(&gain) {
        return Err("gain must be finite and within 0..3".into());
    }
    let map_bytes = std::fs::read(&args[2])?;
    let input_map: Value = serde_json::from_slice(&map_bytes)?;
    let content_bytes = std::fs::read(&args[3])?;
    let content: Content = serde_json::from_slice(&content_bytes)?;
    let graph_bytes = std::fs::read(Path::new(&args[1]).join("graph.bin"))?;
    let mut manifest: Value =
        serde_json::from_slice(&std::fs::read(Path::new(&args[1]).join("manifest.json"))?)?;
    manifest["visionInput"] = input_map.clone();
    let graph = Arc::new(Graph::from_bytes(
        &graph_bytes,
        &serde_json::to_string(&manifest)?,
    )?);
    let family = graph
        .manifest
        .vision_input
        .as_ref()
        .ok_or("supplied vision map is absent")?
        .family
        .clone();
    let references = [
        ("left", point(0., -1.)),
        ("right", point(0., 1.)),
        ("forward", point(1., 0.)),
    ];
    let mut distances: [Vec<f64>; 3] = std::array::from_fn(|_| vec![]);
    let mut headings: [Vec<f64>; 3] = std::array::from_fn(|_| vec![]);
    let mut rows = vec![];
    let start = Instant::now();
    for seed in 100..130 {
        let dark = run(
            &graph,
            fixture(content.level.clone(), None, initial_mode),
            gain,
            seed,
        )?;
        let mut conditions = vec![];
        for (index, (name, reference)) in references.into_iter().enumerate() {
            let lit = run(
                &graph,
                fixture(content.level.clone(), Some(reference), initial_mode),
                gain,
                seed,
            )?;
            if lit.initial_body != dark.initial_body {
                return Err("paired initial body states differ".into());
            }
            let dark_metrics = metrics(&dark, reference);
            let lit_metrics = metrics(&lit, reference);
            let distance = lit_metrics.distance_reduction - dark_metrics.distance_reduction;
            let heading = lit_metrics.mean_heading_alignment - dark_metrics.mean_heading_alignment;
            distances[index].push(distance);
            headings[index].push(heading);
            conditions.push(json!({"direction":name,"reference":reference,"lamp":lit,"lampMetrics":lit_metrics,"darkMetrics":dark_metrics,
                "pairedDifference":{"distanceReduction":distance,"meanHeadingAlignment":heading}}));
        }
        rows.push(json!({"seed":seed,"dark":dark,"conditions":conditions}));
        eprintln!("vision motion seed {seed}: completed dark and three lamp attempts");
    }
    let summaries: Vec<_> = references.iter().enumerate().map(|(index, (name, _))| {
        let distance = summary(&distances[index]);
        json!({"direction":name,"classification":classification(&distance),"pairedDistanceReduction":distance,"pairedMeanHeadingAlignment":summary(&headings[index])})
    }).collect();
    let report = json!({"family":family,"mapSha256":format!("{:x}",Sha256::digest(&map_bytes)),
        "contentSha256":format!("{:x}",Sha256::digest(&content_bytes)),"graphHash":graph.manifest.graph_hash,"simulationBuildId":SIMULATION_BUILD_ID,
        "probeSourceSha256":format!("{:x}",Sha256::digest(include_bytes!("vision_motion_probe.rs"))),"gain":gain,"seedRangeInclusive":[100,129],"seedCount":30,"durationTicks":300,
        "warmupTicks":0,"initialMode":initial_mode,"fixture":fixture(content.level,None,initial_mode),"wallSeconds":start.elapsed().as_secs_f64(),"rows":rows,"summaries":summaries,
        "scope":"One fly in the declared initial mode, normal Attempt startup, unmodified supplied BodyConfig. One source-free run per seed is reused for the three reference-point comparisons. Reference points enter no dark-condition body or sensory input. No odor, food, fan, suction, exit cue or additional ablation. Classification uses unadjusted paired seed-level 95% t intervals of lamp-minus-dark distance reduction; approach/avoidance are relative to dark, not proof of absolute attraction. Neither means no resolved difference in this bounded panel. Early outcomes and boundary contact remain reported, not excluded.",
        "metrics":"Distance reduction is initial minus final distance. Heading alignment is the mean heading dot current reference bearing over initial and tick-end poses; exact coincident positions are omitted and final alignment is null there. Path length uses tick-end displacements. Trajectory hash covers initial complete BodyState, then each tick number and complete tick-end BodyState in order."});
    std::fs::write(&args[5], serde_json::to_string_pretty(&report)?)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sim::{
        environment::{FanField, FieldSet},
        placement::resolve_placements,
    };
    #[test]
    fn fixture_preserves_body_configuration_and_removes_nonvisual_cues() {
        let authored = include_str!("../../../apps/web/src/levels/open-window.ts");
        let begin = authored.find("= {").unwrap() + 2;
        let end = authored.rfind("};").unwrap() + 1;
        let mut source: LevelDef = serde_json::from_str::<Content>(&authored[begin..end])
            .unwrap()
            .level;
        source.field_config.wind = point(3., -2.);
        source.field_config.fans.push(FanField {
            position: point(0., 0.),
            heading: 0.,
            reach: 3.,
            half_width: 1.,
            speed: 2.,
        });
        assert!(source.exit_suction.is_some() && !source.fixed_objects.is_empty());
        let expected_body = source.body_config.clone();
        for mode in [SpawnMode::Walking, SpawnMode::Flying] {
            let lit = fixture(source.clone(), Some(point(0., -1.)), mode);
            let dark = fixture(source.clone(), None, mode);
            assert_eq!(lit.body_config, expected_body);
            assert_eq!(dark.body_config, expected_body);
            assert!(lit.exit_suction.is_none() && dark.exit_suction.is_none());
            let initial = sim::spawn::resolve(&lit, 100, 1).unwrap().remove(0);
            assert_eq!(
                initial.pose,
                BodyPose {
                    position: point(0., 0.),
                    heading: 0.
                }
            );
            assert_eq!(initial.mode, mode.body_mode());
            assert_eq!(
                sim::spawn::resolve(&lit, 100, 1).unwrap(),
                sim::spawn::resolve(&dark, 100, 1).unwrap()
            );
            let setup = resolve_placements(&lit, &[]).unwrap();
            assert!(
                setup.state.food.is_empty()
                    && setup.state.objects.is_empty()
                    && setup.state.contact_hazards.is_empty()
            );
            let sample = FieldSet::new(
                lit.geometry,
                setup.field_config,
                setup.sources,
                lit.exit_cue,
            )
            .unwrap()
            .sample(point(0., 0.), 0., 0);
            assert_eq!(sample.wind, point(0., 0.));
            assert_eq!(
                sample.left.attractive_odor + sample.left.repellent_odor + sample.left.exit_cue,
                0.
            );
            assert!((sample.vision.brightness[6] - 2. / 3.).abs() < 1e-12);
            let dark_sample = FieldSet::new(
                dark.geometry,
                dark.field_config,
                dark.sources,
                dark.exit_cue,
            )
            .unwrap()
            .sample(point(0., 0.), 0., 0);
            assert_eq!(dark_sample.vision.brightness, [0.; 8]);
        }
    }
    #[test]
    fn reporting_changes_sign_when_movement_reverses_and_leaves_coincidence_undefined() {
        let target = point(1., 0.);
        assert_eq!(
            alignment(
                BodyPose {
                    position: point(0., 0.),
                    heading: 0.
                },
                target
            ),
            Some(1.)
        );
        assert_eq!(
            alignment(
                BodyPose {
                    position: point(0., 0.),
                    heading: std::f64::consts::PI
                },
                target
            ),
            Some(-1.)
        );
        assert_eq!(
            alignment(
                BodyPose {
                    position: target,
                    heading: 0.
                },
                target
            ),
            None
        );
        assert_eq!(classification(&summary(&[1.; 30])), "approach");
        assert_eq!(classification(&summary(&[-1.; 30])), "avoidance");
        assert_eq!(classification(&summary(&[0.; 30])), "neither");
    }
}
