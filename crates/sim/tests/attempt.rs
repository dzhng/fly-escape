use serde_json::json;
use sha2::{Digest, Sha256};
use sim::{attempt::*, body::*, environment::*, Graph};
use std::sync::Arc;
fn graph() -> Arc<Graph> {
    let mut bytes = b"FLYGRAPH".to_vec();
    for value in [1u32, 4, 0, 0, 0, 0, 0, 0] {
        bytes.extend(value.to_le_bytes());
    }
    let manifest = json!({"schemaVersion":1,"neuronCount":4,"edgeCount":0,"graphHash":format!("{:x}",Sha256::digest(&bytes)),"bodyIds":["1","2","3","4"],"motor":{"dnL":[0],"dnR":[1],"mnL":[],"mnR":[]},"pathways":{},"groups":[{"id":"taste","label":"Taste","indices":[2,3]},{"id":"odorExcL","label":"Left odor","indices":[2]},{"id":"odorExcR","label":"Right odor","indices":[3]},{"id":"proboscis","label":"Proboscis","indices":[3]}],"groupLinks":[],"pathwayProvenance":"synthetic attempt fixture"});
    Arc::new(Graph::from_bytes(&bytes, &manifest.to_string()).unwrap())
}
fn level(count: usize) -> LevelDef {
    LevelDef {
        id: "fixture".into(),
        geometry: Geometry {
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
        spawn_poses: vec![
            BodyPose {
                position: Point { x: 2., z: 2. },
                heading: 0.
            };
            count
        ],
        exit: ExitOpening {
            a: Point { x: 4., z: 1. },
            b: Point { x: 4., z: 3. },
            outward: Point { x: 1., z: 0. },
        },
        exit_cue: None,
        food: vec![],
        zappers: vec![],
        sources: vec![Source {
            position: Point { x: 2., z: 2. },
            radius: 0.5,
            rate: 1.,
            kind: SourceKind::Odor,
        }],
        field_config: FieldConfig::default(),
        body_config: BodyConfig::default(),
        initial_reserve: 10.,
        duration_ticks: 3,
        star_thresholds: [1, 2, 3],
    }
}
fn attempt(graph: Arc<Graph>, level: LevelDef, seed: u64, count: u32) -> Attempt {
    let tuning = AttemptTuning::default();
    let spec = Attempt::describe(&graph, &level, &tuning, "test", seed, count).unwrap();
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
    definition.spawn_poses[1].position = Point { x: 1., z: 1. };
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
    let spec = Attempt::describe(&graph, &definition, &tuning, "identity", u64::MAX, 1).unwrap();
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
    definition.sources[0].position.z = 1.6;
    definition.sources[0].radius = 0.8;
    definition.food.push(ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 0.5,
    });
    let tuning = AttemptTuning {
        cue: Some(CueInput {
            pathway: sim::sensory::CuePathway::ExcitatoryOdor,
            gain: 0.1,
        }),
        taste_gain: 0.1,
    };
    let spec = Attempt::describe(&graph, &definition, &tuning, "currents", 11, 1).unwrap();
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
    definition.spawn_poses[0].position = Point { x: 3.8, z: 2. };
    definition.spawn_poses[1].position = Point { x: 3.8, z: 0.5 };
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
        definition.spawn_poses[0].position = position;
        let error = Attempt::describe(&graph, &definition, &tuning, "spawn", 0, 1).unwrap_err();
        assert!(error.contains("spawn body"), "{error}");
    }
    assert!(Attempt::describe(&graph, &level(100), &tuning, "capacity", 0, 101).is_err());
    assert!(Attempt::describe(&graph, &level(1), &tuning, "capacity", 0, 0).is_err());
    let mut definition = level(1);
    definition.duration_ticks = 6001;
    assert!(Attempt::describe(&graph, &definition, &tuning, "horizon", 0, 1).is_err());
    let mut allowed = attempt(graph, level(100), 0, 100);
    assert_eq!(allowed.step().unwrap().unwrap().neural_steps, 100);
}
