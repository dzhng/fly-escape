use serde_json::json;
use sha2::{Digest, Sha256};
use sim::{attempt::*, body::*, environment::*, Graph};
use std::sync::Arc;
fn graph() -> Arc<Graph> {
    let count = 4u32;
    let mut bytes = b"FLYGRAPH".to_vec();
    for value in [1u32, count, 0]
        .into_iter()
        .chain(std::iter::repeat_n(0, count as usize + 1))
    {
        bytes.extend(value.to_le_bytes());
    }
    let manifest = json!({"schemaVersion":1,"neuronCount":4,"edgeCount":0,"graphHash":format!("{:x}",Sha256::digest(&bytes)),"bodyIds":["1","2","3","4"],"motor":{"dnL":[0],"dnR":[1],"mnL":[],"mnR":[]},"pathways":{},"groups":[{"id":"taste","label":"Taste","indices":[2,3]},{"id":"odorExcL","label":"Left odor","indices":[2]},{"id":"odorExcR","label":"Right odor","indices":[3]},{"id":"proboscis","label":"Proboscis","indices":[3]}],"groupLinks":[],"pathwayProvenance":"synthetic attempt fixture"});
    let mut manifest = manifest;
    manifest["neuronCount"] = json!(count);
    manifest["bodyIds"] = json!((1..=count).map(|i| i.to_string()).collect::<Vec<_>>());

    for id in ["odorInhL", "odorInhR"] {
        let index = if id.ends_with('L') { 2 } else { 3 };
        manifest["groups"]
            .as_array_mut()
            .unwrap()
            .push(json!({"id":id,"label":id,"indices":[index]}));
    }
    Arc::new(Graph::from_bytes(&bytes, &manifest.to_string()).unwrap())
}
fn level(count: usize) -> LevelDef {
    LevelDef {
        fixed_objects: vec![],
        id: "fixture".into(),
        geometry: Geometry {
            solids: vec![],
            rooms: vec![RectRoom {
                id: 1,
                min: Point { x: 0., z: 0. },
                max: Point { x: 4., z: 4. },
            }],
            walls: vec![
                Wall {
                    a: Point { x: 0., z: 0. },
                    b: Point { x: 4., z: 0. },
                },
                Wall {
                    a: Point { x: 0., z: 4. },
                    b: Point { x: 4., z: 4. },
                },
                Wall {
                    a: Point { x: 0., z: 0. },
                    b: Point { x: 0., z: 4. },
                },
                Wall {
                    a: Point { x: 4., z: 0. },
                    b: Point { x: 4., z: 1. },
                },
                Wall {
                    a: Point { x: 4., z: 3. },
                    b: Point { x: 4., z: 4. },
                },
            ],
        },
        spawn: sim::spawn::SpawnDef::fixed(vec![
            BodyPose {
                position: Point { x: 2., z: 2. },
                heading: 0.
            };
            count
        ]),
        exit: ExitOpening {
            a: Point { x: 4., z: 1. },
            b: Point { x: 4., z: 3. },
            outward: Point { x: 1., z: 0. },
        },
        exit_cue: None,
        exit_suction: None,
        food: vec![],
        zappers: vec![],
        sources: vec![Source {
            position: Point { x: 2., z: 2. },
            radius: 0.5,
            rate: 1.,
            kind: SourceKind::RepellentOdor,
        }],
        field_config: FieldConfig::default(),
        body_config: BodyConfig::default(),
        duration_ticks: 3,
        star_thresholds: [1, 2, 3],
        placement_rules: Default::default(),
    }
}
fn attempt(graph: Arc<Graph>, level: LevelDef, seed: u64, count: u32) -> Attempt {
    let tuning = AttemptTuning::default();
    let spec = Attempt::describe(&graph, &level, &tuning, "test", seed, count, &[]).unwrap();
    Attempt::new(graph, level, tuning, spec).unwrap()
}
#[test]
fn twenty_flies_share_one_field_evolution_and_keep_independent_seed_streams() {
    let graph = graph();
    let mut one = attempt(graph.clone(), level(20), 7, 1);
    let mut twenty = attempt(graph, level(20), 7, 20);
    let definition = level(20);
    let mut expected_fields = FieldSet::new(
        definition.geometry,
        definition.field_config,
        definition.sources,
        None,
    )
    .unwrap();
    expected_fields.advance(GAME_TICK_SECONDS).unwrap();
    let a = one.step().unwrap().unwrap();
    let b = twenty.step().unwrap().unwrap();
    assert_eq!(one.field_grid(), twenty.field_grid());
    assert_eq!(twenty.field_grid(), expected_fields.export_grid());
    assert_eq!(a.flies[0].neural, b.flies[0].neural);
    assert_ne!(b.flies[0].neural, b.flies[1].neural);
    let a_next = one.step().unwrap().unwrap();
    let b_next = twenty.step().unwrap().unwrap();
    assert_eq!(
        a_next.flies[0].neural, b_next.flies[0].neural,
        "other flies must not consume this fly's random stream"
    );
    assert_eq!(one.field_grid(), twenty.field_grid());
}
#[test]
fn terminal_flies_stop_updates_while_other_flies_finish_and_timeout_scores_zero() {
    let mut definition = level(2);
    fixed(&mut definition)[1].pose.position = Point { x: 1., z: 1. };
    definition.zappers.push(ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 0.2,
    });
    let mut attempt = attempt(graph(), definition, 9, 2);
    let first = attempt.step().unwrap().unwrap();
    assert_eq!(first.neural_steps, 2);
    assert_eq!(first.flies[0].body.outcome, Some(TerminalOutcome::Zapped));
    let second = attempt.step().unwrap().unwrap();
    assert_eq!(second.neural_steps, 3);
    assert_eq!(second.flies[0].neural, None);
    assert_eq!(second.flies[0].sensory, None);
    assert!(second.flies[0].events.is_empty());
    assert_eq!(second.flies[0].body, first.flies[0].body);
    assert!(second.flies[1].neural.is_some());
    let last = attempt.step().unwrap().unwrap();
    let result = last.result.unwrap();
    assert_eq!(last.neural_steps, 4);
    assert_eq!(result.outcomes.zapped, 1);
    assert_eq!(result.outcomes.timed_out, 1);
    assert_eq!(result.outcomes.score, 0);
    assert_eq!(result.stars, 0);
    let grid = attempt.field_grid();
    assert!(attempt.step().unwrap().is_none());
    assert_eq!(attempt.field_grid(), grid);
    assert_eq!(attempt.result(), Some(&result));
}
#[test]
fn identities_reject_changed_content_and_preserve_full_width_seeds() {
    let graph = graph();
    let definition = level(1);
    let tuning = AttemptTuning::default();
    let spec =
        Attempt::describe(&graph, &definition, &tuning, "identity", u64::MAX, 1, &[]).unwrap();
    assert_eq!(
        serde_json::to_value(&spec).unwrap()["rootSeed"],
        u64::MAX.to_string()
    );
    let equivalent = Attempt::describe(
        &self::graph(),
        &definition,
        &tuning,
        "identity",
        u64::MAX,
        1,
        &[],
    )
    .unwrap();
    assert_eq!(spec, equivalent);
    let mut changed_level = definition.clone();
    changed_level.duration_ticks += 1;
    assert!(Attempt::new(graph.clone(), changed_level, tuning.clone(), spec.clone()).is_err());
    let changed_tuning = AttemptTuning {
        taste_gain: 0.1,
        ..tuning.clone()
    };
    assert!(Attempt::new(
        graph.clone(),
        definition.clone(),
        changed_tuning,
        spec.clone()
    )
    .is_err());
    let mut changed_graph = self::graph();
    Arc::get_mut(&mut changed_graph).unwrap().manifest.groups[0].label =
        "Changed annotation".into();
    assert!(Attempt::new(
        changed_graph,
        definition.clone(),
        tuning.clone(),
        spec.clone()
    )
    .is_err());
    let mut wrong_build = spec.clone();
    wrong_build.simulation_build_id = "other-build".into();
    assert!(Attempt::new(
        graph.clone(),
        definition.clone(),
        tuning.clone(),
        wrong_build
    )
    .is_err());
    assert!(Attempt::new(graph, definition, tuning, spec).is_ok());
}
#[test]
fn sensory_and_taste_currents_sum_without_direct_motor_injection() {
    let graph = graph();
    let mut definition = level(1);
    definition.sources[0].kind = SourceKind::AttractiveOdor;
    definition.sources[0].position.z = 1.6;
    definition.sources[0].radius = 0.8;
    definition.food.push(sim::food::FoodDef {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        shape: sim::food::FoodShape::Patch { radius: 0.5 },
    });
    let tuning = AttemptTuning {
        cues: vec![CueInput {
            pathway: sim::sensory::CuePathway::ExcitatoryOdor,
            gain: 0.1,
        }],
        taste_gain: 0.1,
        ..Default::default()
    };
    let spec = Attempt::describe(&graph, &definition, &tuning, "currents", 11, 1, &[]).unwrap();
    let mut attempt = Attempt::new(graph.clone(), definition, tuning, spec).unwrap();
    let frame = attempt.step().unwrap().unwrap();
    let cue = sim::sensory::cue_currents(
        &graph,
        frame.flies[0].sensory.as_ref().unwrap(),
        sim::sensory::CuePathway::ExcitatoryOdor,
        0.1,
    )
    .unwrap();
    let cue_left = cue.iter().find(|(i, _)| *i == 2).unwrap().1;
    assert!(cue_left > 0., "fixture must expose an odor difference");
    let mut reference = sim::Brain::new(graph, sim::Brain::seed_for_fly(11, 0));
    reference
        .set_external_current(&[(2, cue_left + 0.1)])
        .unwrap();
    assert_eq!(frame.flies[0].neural, Some(reference.step()));
}
#[test]
fn only_physical_escape_contributes_to_attempt_score_and_stars() {
    let mut definition = level(2);
    fixed(&mut definition)[0].pose.position = Point { x: 3.8, z: 2. };
    fixed(&mut definition)[1].pose.position = Point { x: 3.8, z: 0.5 };
    definition.field_config.wind = Point { x: 3., z: 0. };
    definition.duration_ticks = 1;
    let mut attempt = attempt(graph(), definition, 0, 2);
    let frame = attempt.step().unwrap().unwrap();
    assert_eq!(frame.flies[0].body.outcome, Some(TerminalOutcome::Escaped));
    assert_eq!(frame.flies[1].body.outcome, Some(TerminalOutcome::TimedOut));
    let result = frame.result.unwrap();
    assert_eq!(result.outcomes.escaped, 1);
    assert_eq!(result.outcomes.score, 1);
    assert_eq!(result.stars, 1);
    assert!(attempt.step().unwrap().is_none());
}
#[test]
fn invalid_spawn_footprints_and_capacity_are_rejected_before_simulation() {
    let graph = graph();
    let tuning = AttemptTuning::default();
    for position in [
        Point { x: 0., z: 2. },
        Point { x: 0.04, z: 2. },
        Point { x: 4.01, z: 2. },
        Point { x: 3.95, z: 0.96 },
    ] {
        let mut definition = level(1);
        definition.body_config.body_radius = 0.08; // Explicit footprint for these boundary probes.
        fixed(&mut definition)[0].pose.position = position;
        let error =
            Attempt::describe(&graph, &definition, &tuning, "spawn", 0, 1, &[]).unwrap_err();
        assert!(error.contains("spawn body"), "{error}");
    }
    assert!(Attempt::describe(&graph, &level(100), &tuning, "capacity", 0, 101, &[]).is_err());
    assert!(Attempt::describe(&graph, &level(1), &tuning, "capacity", 0, 0, &[]).is_err());
    let mut definition = level(1);
    definition.duration_ticks = 6001;
    assert!(Attempt::describe(&graph, &definition, &tuning, "horizon", 0, 1, &[]).is_err());
    let mut allowed = attempt(graph, level(100), 0, 100);
    assert_eq!(allowed.step().unwrap().unwrap().neural_steps, 100);
}

#[test]
fn solid_footprints_reject_spawns_before_simulation() {
    let mut definition = level(1);
    definition.geometry =
        serde_json::from_str(include_str!("../../../assets/house/five-rooms.json")).unwrap();
    definition.exit.a.x = 16.;
    definition.exit.b.x = 16.;
    let prop = &definition.geometry.solids[0];
    fixed(&mut definition)[0].pose.position = Point {
        x: (prop.min.x + prop.max.x) / 2.,
        z: (prop.min.z + prop.max.z) / 2.,
    };
    let error = Attempt::describe(
        &graph(),
        &definition,
        &AttemptTuning::default(),
        "solid-spawn",
        0,
        1,
        &[],
    )
    .unwrap_err();
    assert!(error.contains("spawn body"), "{error}");
}

#[test]
fn fixed_ablation_is_hashed_validated_and_clamps_neural_readouts() {
    let graph = graph();
    let mut level = level(1);
    level.duration_ticks = 10;
    let tuning = AttemptTuning {
        silenced_neurons: vec![3],
        ..Default::default()
    };
    let spec = Attempt::describe(&graph, &level, &tuning, "ablation", 1, 1, &[]).unwrap();
    let control = Attempt::describe(
        &graph,
        &level,
        &AttemptTuning::default(),
        "ablation",
        1,
        1,
        &[],
    )
    .unwrap();
    assert_ne!(spec.tuning_hash, control.tuning_hash);
    let mut attempt = Attempt::new(graph.clone(), level.clone(), tuning, spec).unwrap();
    for _ in 0..5 {
        let frame = attempt.step().unwrap().unwrap();
        let group = frame.flies[0]
            .neural
            .as_ref()
            .unwrap()
            .groups
            .iter()
            .find(|g| g.id == "proboscis")
            .unwrap();
        assert_eq!((group.mean_voltage, group.spike_fraction), (0., 0.));
    }
    let invalid = AttemptTuning {
        silenced_neurons: vec![graph.neuron_count() as u32],
        ..Default::default()
    };
    assert!(Attempt::describe(&graph, &level, &invalid, "invalid", 1, 1, &[]).is_err());
}

#[path = "fixtures/retina.rs"]
mod retinal_fixture;

#[test]
fn simultaneous_retinal_and_odor_currents_sum_and_each_can_be_ablated() {
    use sim::sensory::CuePathway::*;
    let (mut graph, config, data) = retinal_fixture::fixture();
    let graph_mut = Arc::get_mut(&mut graph).unwrap();
    for (id, index) in [
        ("odorExcL", 2),
        ("odorExcR", 3),
        ("odorInhL", 2),
        ("odorInhR", 3),
    ] {
        graph_mut.manifest.groups.push(sim::Group {
            id: id.into(),
            label: id.into(),
            indices: vec![index],
        });
    }
    let map_json = data.to_string();
    let map = sim::RetinalMap::from_json(&graph, &config.profile, &map_json).unwrap();
    let rgb = vec![255, 128, 0, 0, 64, 255, 32, 16, 255, 192, 128, 64];
    let mut definition = level(1);
    definition.sources = [SourceKind::AttractiveOdor, SourceKind::RepellentOdor]
        .into_iter()
        .map(|kind| Source {
            position: Point { x: 2., z: 1.6 },
            radius: 0.8,
            rate: 2.,
            kind,
        })
        .collect();
    for seed in [0, 7, 42] {
        for enabled in [
            [true, false, false],
            [false, true, false],
            [false, false, true],
            [true, true, true],
            [false, true, true],
            [true, false, true],
            [true, true, false],
        ] {
            let tuning = AttemptTuning {
                cues: [ExcitatoryOdor, InhibitoryOdor, Vision]
                    .into_iter()
                    .zip(enabled)
                    .map(|(pathway, on)| CueInput {
                        pathway,
                        gain: if on { 0.1 } else { 0. },
                    })
                    .collect(),
                ..Default::default()
            };
            let make = || {
                let spec =
                    Attempt::describe(&graph, &definition, &tuning, "mixed", seed, 1, &[]).unwrap();
                Attempt::new_retinal(
                    graph.clone(),
                    definition.clone(),
                    tuning.clone(),
                    spec,
                    config.clone(),
                    &map_json,
                )
                .unwrap()
            };
            let step = |attempt: &mut Attempt| {
                let request = attempt.prepare_tick().unwrap().unwrap();
                attempt
                    .commit_tick(sim::vision::RetinaBatch {
                        request,
                        rgb: rgb.clone(),
                    })
                    .unwrap()
            };
            let mut attempt = make();
            let mut replay = make();
            let frame = step(&mut attempt);
            let senses = frame.flies[0].sensory.unwrap();
            let mut expected = std::collections::BTreeMap::new();
            for cue in &tuning.cues {
                let currents = if cue.pathway == Vision {
                    sim::sensory::retinal_currents(&map, &rgb, cue.gain).unwrap()
                } else {
                    sim::sensory::cue_currents(&graph, &senses, cue.pathway, cue.gain).unwrap()
                };
                for (index, current) in currents {
                    *expected.entry(index).or_insert(0.) += current;
                }
            }
            assert!(expected.values().any(|value| *value > 0.));
            let mut reference = sim::Brain::new(graph.clone(), sim::Brain::seed_for_fly(seed, 0));
            reference
                .set_external_current(&expected.into_iter().collect::<Vec<_>>())
                .unwrap();
            assert_eq!(frame.flies[0].neural, Some(reference.step()));
            assert_eq!(frame, step(&mut replay));
            for _ in 1..definition.duration_ticks {
                assert_eq!(step(&mut attempt), step(&mut replay));
            }
            assert!(attempt.prepare_tick().unwrap().is_none());
            assert!(replay.prepare_tick().unwrap().is_none());
        }
    }
}

#[test]
fn vision_requires_retinal_acquisition_even_when_gain_is_zero() {
    for gain in [0., 1.] {
        let graph = graph();
        let definition = level(1);
        let tuning = AttemptTuning {
            cues: vec![CueInput {
                pathway: sim::sensory::CuePathway::Vision,
                gain,
            }],
            ..Default::default()
        };
        let spec = Attempt::describe(&graph, &definition, &tuning, "no-retina", 1, 1, &[]).unwrap();
        assert!(Attempt::new(graph, definition, tuning, spec)
            .err()
            .unwrap()
            .contains("retinal"));
    }
}

#[test]
fn resolved_placements_preserve_surface_only_taste_local_wind_and_replay() {
    use sim::placement::*;
    let graph = graph();
    let mut definition = level(1);
    definition.body_config.body_radius = 0.08; // Diagnostic body size; the apple remains 45cm away.
    definition.sources.clear();
    definition.placement_rules.inventory = vec![
        ToolStock {
            kind: ToolKind::Fruit,
            count: 1,
        },
        ToolStock {
            kind: ToolKind::Fan,
            count: 1,
        },
    ];
    let placements = vec![
        Placement {
            id: 1,
            kind: ToolKind::Fruit,
            position: Point { x: 2., z: 1.55 },
            heading: 0.,
        },
        Placement {
            id: 2,
            kind: ToolKind::Fan,
            position: Point { x: 1., z: 2. },
            heading: 0.,
        },
    ];
    let tuning = AttemptTuning {
        taste_gain: 0.1,
        ..Default::default()
    };
    let make = |placements: &[Placement]| {
        let spec =
            Attempt::describe(&graph, &definition, &tuning, "placed", 11, 1, placements).unwrap();
        let mut expected = placements.to_vec();
        expected[1].heading = definition.placement_rules.fan_heading;
        assert_eq!(spec.placements, expected);
        Attempt::new(graph.clone(), definition.clone(), tuning.clone(), spec).unwrap()
    };
    let mut attempt = make(&placements);
    let mut replay = make(&placements);
    let frame = attempt.step().unwrap().unwrap();
    let mut reference = sim::Brain::new(graph.clone(), sim::Brain::seed_for_fly(11, 0));
    assert_eq!(
        frame.flies[0].neural,
        Some(reference.step()),
        "the apple cannot supply taste across an empty 45cm gap"
    );
    assert!(frame.flies[0].sensory.unwrap().wind.x > 0.);
    let mut reversed = placements.clone();
    reversed[1].heading = std::f64::consts::PI;
    let other = make(&reversed).step().unwrap().unwrap();
    assert_eq!(
        other.flies[0].sensory.unwrap().wind,
        frame.flies[0].sensory.unwrap().wind
    );
    assert_eq!(frame.flies[0].neural, other.flies[0].neural);
    assert_eq!(
        frame.flies[0].body.pose.heading,
        other.flies[0].body.pose.heading
    );
    let drift = frame.flies[0].body.pose.position.x - other.flies[0].body.pose.position.x;
    assert_eq!(
        drift, 0.,
        "caller-supplied fan rotation cannot change body motion"
    );
    assert_eq!(Some(frame), replay.step().unwrap());
    for _ in 0..19 {
        assert_eq!(attempt.step().unwrap(), replay.step().unwrap());
    }
}

#[test]
fn map_owned_fan_headings_can_start_and_resolve_repeatedly() {
    use sim::placement::*;
    let graph = graph();
    let mut definition = level(1);
    definition.placement_rules.inventory = vec![ToolStock {
        kind: ToolKind::Fan,
        count: 1,
    }];
    definition.placement_rules.fan_heading = std::f64::consts::PI;
    let tuning = AttemptTuning::default();
    for heading in [
        -1e-16,
        -std::f64::consts::FRAC_PI_2,
        -0.,
        std::f64::consts::TAU,
        1e20,
    ] {
        let placements = vec![Placement {
            id: 1,
            kind: ToolKind::Fan,
            position: Point { x: 1., z: 2. },
            heading,
        }];
        let spec = Attempt::describe(
            &graph,
            &definition,
            &tuning,
            "canonical",
            42,
            1,
            &placements,
        )
        .unwrap();
        let attempt = Attempt::new(
            graph.clone(),
            definition.clone(),
            tuning.clone(),
            spec.clone(),
        )
        .unwrap();
        assert_eq!(attempt.resolved_setup().state.placements, spec.placements);
        let again = resolve_placements(&definition, &spec.placements).unwrap();
        assert_eq!(again.state.placements, spec.placements);
        assert_eq!(
            spec.placements[0].heading,
            definition.placement_rules.fan_heading
        );
    }
}

fn fixed(level: &mut LevelDef) -> &mut Vec<sim::spawn::SpawnState> {
    let sim::spawn::SpawnDef::Fixed { states } = &mut level.spawn else {
        panic!("fixed lab")
    };
    states
}

#[test]
fn seeded_cluster_is_legal_reproducible_and_does_not_consume_neural_noise() {
    use sim::spawn::{resolve, SpawnDef};
    let mut definition = level(20);
    definition.spawn = SpawnDef::Cluster {
        min: Point { x: 0.4, z: 0.4 },
        max: Point { x: 3.5, z: 3.5 },
        flying_count: 10,
    };
    let first = resolve(&definition, 81, 20).unwrap();
    assert_eq!(first, resolve(&definition, 81, 20).unwrap());
    assert_ne!(first, resolve(&definition, 82, 20).unwrap());
    let mut quadrants = std::collections::BTreeSet::new();
    for seed in 0..16 {
        let bodies = resolve(&definition, seed, 20).unwrap();
        assert_eq!(
            bodies.iter().filter(|b| b.mode == BodyMode::Flying).count(),
            10
        );
        for (i, b) in bodies.iter().enumerate() {
            assert!(definition
                .geometry
                .contains_body(b.pose.position, definition.body_config.body_radius));
            assert!(bodies[..i]
                .iter()
                .all(|a| (a.pose.position.x - b.pose.position.x)
                    .hypot(a.pose.position.z - b.pose.position.z)
                    > 2. * definition.body_config.body_radius));
            assert!((0. ..std::f64::consts::TAU).contains(&b.pose.heading));
            quadrants.insert((b.pose.heading / std::f64::consts::FRAC_PI_2) as u32);
        }
    }
    assert_eq!(quadrants.len(), 4);
    let graph = graph();
    let tuning = AttemptTuning::default();
    let spec = Attempt::describe(&graph, &definition, &tuning, "cluster", 81, 20, &[]).unwrap();
    let mut attempt = Attempt::new(graph.clone(), definition, tuning, spec).unwrap();
    let frame = attempt.step().unwrap().unwrap();
    assert_eq!(
        attempt.initial_bodies(),
        first,
        "tick-zero metadata cannot mutate after stepping"
    );
    for (id, fly) in frame.flies.iter().enumerate() {
        let mut brain = sim::Brain::new(graph.clone(), sim::Brain::seed_for_fly(81, id as u32));
        assert_eq!(
            fly.neural,
            Some(brain.step()),
            "initialization must not consume neural noise"
        );
    }
}

#[test]
fn cluster_rejects_hazards_and_exhaustion_and_reserves_unsampled_area() {
    use sim::spawn::{resolve, SpawnDef};
    let mut definition = level(20);
    definition.spawn = SpawnDef::Cluster {
        min: Point { x: 0.4, z: 0.4 },
        max: Point { x: 3.5, z: 3.5 },
        flying_count: 10,
    };
    definition
        .geometry
        .solids
        .push(sim::environment::SolidProp {
            furnishing: None,
            id: 4,
            min: Point { x: 1., z: 1. },
            max: Point { x: 1.4, z: 1.4 },
            height: 0.5,
        });
    definition.zappers.push(ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 0.6,
    });
    for b in resolve(&definition, 7, 20).unwrap() {
        assert!(
            (b.pose.position.x - 2.).hypot(b.pose.position.z - 2.)
                > 0.6 + definition.body_config.body_radius
        );
    }
    assert!(definition.spawn.excludes(Point { x: 1., z: 1. }, 0.1));
    assert!(definition.spawn.excludes(Point { x: 3.6, z: 2. }, 0.11));
    assert!(!definition.spawn.excludes(Point { x: 3.7, z: 2. }, 0.1));
    definition.spawn = SpawnDef::Cluster {
        min: Point { x: 1., z: 1. },
        max: Point { x: 1.01, z: 1.01 },
        flying_count: 10,
    };
    assert!(resolve(&definition, 7, 20)
        .unwrap_err()
        .contains("128 samples"));
    definition.spawn = SpawnDef::Cluster {
        min: Point { x: 2., z: 1. },
        max: Point { x: 1., z: 1.01 },
        flying_count: 10,
    };
    assert!(resolve(&definition, 7, 20).is_err());
}

#[test]
fn placement_reserves_the_whole_cluster_before_seed_resolution() {
    let fixture = sim::setup_fixture::fixture().unwrap();
    let placement = sim::placement::Placement {
        id: 1,
        kind: sim::placement::ToolKind::Fruit,
        position: Point { x: 1., z: 1.8 },
        heading: 0.,
    };
    assert!(
        sim::placement::resolve_placements(&fixture.level, &[placement])
            .unwrap_err()
            .contains("spawn footprint")
    );
}

#[test]
fn a_timed_level_reaches_its_horizon_where_a_finite_life_level_starves() {
    let graph = graph();
    let horizon = 10;
    let mut timed = level(2);
    timed.body_config.life = LifeModel::Timed;
    timed.duration_ticks = horizon;
    let mut finite = timed.clone();
    // Half a game second of idling: this level dies long before its horizon.
    finite.body_config.life = LifeModel::Reserve(ReserveModel {
        initial: 0.1,
        capacity: 20.,
        idle_cost: 0.2,
        walking_cost: 0.4,
        flying_cost: 0.8,
        feeding_rate: 3.,
        max_bout_seconds: 3.,
    });
    let mut timed = attempt(graph.clone(), timed, 7, 2);
    let mut finite = attempt(graph, finite, 7, 2);
    assert!(timed.initial_bodies().iter().all(|b| b.reserve == 0.));
    assert!(finite.initial_bodies().iter().all(|b| b.reserve == 0.1));
    let mut last = None;
    for tick in 1..=horizon {
        let frame = timed.step().unwrap().unwrap();
        assert_eq!(frame.tick, tick);
        assert!(
            frame.flies.iter().all(|f| f.body.outcome.is_none()) || tick == horizon,
            "only the horizon ends a timed round here"
        );
        last = Some(frame);
    }
    let result = last.unwrap().result.unwrap();
    assert_eq!(result.outcomes.timed_out, 2);
    assert_eq!(result.outcomes.starved, 0);
    assert_eq!(result.completed_tick, horizon);
    while finite.step().unwrap().is_some() {}
    let starved = finite.result().unwrap();
    assert_eq!(starved.outcomes.starved, 2);
    assert!(starved.completed_tick < horizon);
}

#[test]
fn timed_round_with_only_hazard_victims_keeps_the_authored_timer() {
    let mut definition = level(2);
    definition.body_config.life = LifeModel::Timed;
    definition.zappers.push(ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 0.2,
    });
    let mut run = attempt(graph(), definition, 9, 2);
    let first = run.step().unwrap().unwrap();
    assert!(first
        .flies
        .iter()
        .all(|f| f.body.outcome == Some(TerminalOutcome::Zapped)));
    assert!(first.result.is_none());
    let second = run.step().unwrap().unwrap();
    assert_eq!(second.neural_steps, first.neural_steps);
    assert!(second.result.is_none());
    let final_frame = run.step().unwrap().unwrap();
    let result = final_frame.result.unwrap();
    assert_eq!(result.completed_tick, 3);
    assert_eq!(result.outcomes.zapped, 2);
    assert_eq!(result.outcomes.score, 0);
    assert!(run.step().unwrap().is_none());
}

#[test]
fn all_escaped_ends_a_timed_round_before_its_horizon() {
    let mut definition = level(2);
    definition.body_config.life = LifeModel::Timed;
    definition.duration_ticks = 100;
    definition.field_config.wind = Point { x: 5., z: 0. };
    let mut run = attempt(graph(), definition, 9, 2);
    while run.step().unwrap().is_some() {}
    let result = run.result().unwrap();
    assert_eq!(result.outcomes.escaped, 2);
    assert_eq!(result.outcomes.score, 2);
    assert!(result.completed_tick < 100);
}
#[test]
fn exit_suction_is_absent_unless_a_level_authors_it() {
    let mut authored = serde_json::to_value(level(1)).unwrap();
    // An unauthored level is exactly the level it was before the setting existed,
    // so its identity and any prior recording still line up.
    assert!(!authored.as_object().unwrap().contains_key("exitSuction"));
    let unhelped: LevelDef = serde_json::from_value(authored.clone()).unwrap();
    assert!(unhelped.exit_suction.is_none());
    authored["exitSuction"] = json!({"reach": 0.9, "speed": 0.5});
    let helped: LevelDef = serde_json::from_value(authored).unwrap();
    assert_eq!(
        helped.exit_suction,
        Some(ExitSuction {
            reach: 0.9,
            speed: 0.5,
            room_speed: 0.,
        })
    );
}
#[test]
fn an_authored_suction_without_a_room_pull_keeps_its_prior_json() {
    let mut authored = serde_json::to_value(level(1)).unwrap();
    authored["exitSuction"] = json!({"reach": 0.9, "speed": 0.5});
    let doorway_only: LevelDef = serde_json::from_value(authored.clone()).unwrap();
    assert_eq!(doorway_only.exit_suction.unwrap().room_speed, 0.);
    // A level that authors no room pull serializes back to exactly the JSON it
    // had before the setting existed, so identities and recordings still line up.
    assert_eq!(
        serde_json::to_value(&doorway_only).unwrap()["exitSuction"],
        json!({"reach": 0.9, "speed": 0.5})
    );
    authored["exitSuction"]["roomSpeed"] = json!(0.06);
    let with_room: LevelDef = serde_json::from_value(authored.clone()).unwrap();
    assert_eq!(with_room.exit_suction.unwrap().room_speed, 0.06);
    assert_eq!(
        serde_json::to_value(&with_room).unwrap()["exitSuction"],
        authored["exitSuction"]
    );
}
#[test]
fn authored_exit_suction_only_reaches_the_body_at_the_doorway() {
    let mut definition = level(2);
    fixed(&mut definition)[0].pose.position = Point { x: 3.5, z: 2. };
    fixed(&mut definition)[1].pose.position = Point { x: 0.5, z: 2. };
    // Flightless bodies: whatever moves them came from the authored air.
    definition.body_config.walk_speed = 0.;
    definition.body_config.flight_speed = 0.;
    definition.duration_ticks = 20;
    let run = |definition: LevelDef| {
        let mut attempt = attempt(graph(), definition, 11, 2);
        let mut last = attempt.step().unwrap().unwrap();
        while let Some(frame) = attempt.step().unwrap() {
            last = frame;
        }
        last
    };
    let unhelped = run(definition.clone());
    definition.exit_suction = Some(ExitSuction {
        reach: 0.9,
        speed: 0.5,
        room_speed: 0.,
    });
    let helped = run(definition);
    assert_eq!(
        unhelped.flies[0].body.outcome,
        Some(TerminalOutcome::TimedOut)
    );
    assert_eq!(helped.flies[0].body.outcome, Some(TerminalOutcome::Escaped));
    assert_eq!(
        helped.flies[1].body, unhelped.flies[1].body,
        "a fly away from the doorway must be untouched"
    );
}
