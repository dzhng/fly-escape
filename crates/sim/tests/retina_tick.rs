#[path = "fixtures/retina.rs"]
mod retinal_fixture;
use sim::{attempt::*, sensory::CuePathway, vision::*};

fn attempt() -> Attempt {
    attempt_for(sim::swarm_lab::level(2).unwrap(), 7)
}
fn attempt_for(level: LevelDef, generation: u32) -> Attempt {
    let (graph, mut config, map) = retinal_fixture::fixture();
    config.client_generation = generation;
    let tuning = AttemptTuning {
        cues: vec![CueInput {
            pathway: CuePathway::Vision,
            gain: 3.,
        }],
        ..Default::default()
    };
    let spec = Attempt::describe(&graph, &level, &tuning, "retinal-test", 42, 2, &[]).unwrap();
    Attempt::new_retinal(graph, level, tuning, spec, config, &map.to_string()).unwrap()
}

#[test]
fn repeated_prepare_freezes_the_full_native_transform_without_advancing_fields() {
    let mut level = sim::swarm_lab::level(2).unwrap();
    let sim::spawn::SpawnDef::Fixed { states } = &mut level.spawn else {
        unreachable!()
    };
    states[0].mode = sim::spawn::SpawnMode::Flying;
    states[0].pose.heading = 0.73;
    states[1].pose.heading = -0.2;
    let mut attempt = attempt_for(level, 7);
    let fields = attempt.field_grid();
    let initial = attempt.initial_bodies();
    let request = attempt.prepare_tick().unwrap().unwrap();
    assert_eq!(request.tick, 1);
    assert_eq!(request.client_generation, 7);
    assert_eq!(
        request
            .poses
            .iter()
            .map(|pose| pose.fly_id)
            .collect::<Vec<_>>(),
        [0, 1]
    );
    for (pose, state) in request.poses.iter().zip(initial) {
        assert_eq!(
            pose.position,
            [state.pose.position.x, state.height, state.pose.position.z]
        );
        assert_eq!(pose.rotation, state.rotation);
    }
    assert_eq!(attempt.prepare_tick().unwrap(), Some(request));
    assert_eq!(attempt.field_grid(), fields);
    assert!(
        attempt.step().is_err(),
        "baseline stepping cannot bypass pending optical input"
    );
}

#[test]
fn cancellation_invalidates_pending_work_and_a_new_generation_rejects_late_completion() {
    let mut old = attempt();
    let batch = RetinaBatch {
        request: old.prepare_tick().unwrap().unwrap(),
        rgb: vec![255; 24],
    };
    let frozen = old.field_grid();
    old.cancel();
    assert!(old
        .commit_tick(batch.clone())
        .unwrap_err()
        .contains("cancelled"));
    assert!(old.prepare_tick().unwrap_err().contains("cancelled"));
    assert_eq!(old.field_grid(), frozen);
    let mut restarted = attempt_for(sim::swarm_lab::level(2).unwrap(), 8);
    let request = restarted.prepare_tick().unwrap().unwrap();
    assert!(restarted.commit_tick(batch.clone()).is_err());
    assert_eq!(restarted.prepare_tick().unwrap(), Some(request.clone()));
    let frame = restarted
        .commit_tick(RetinaBatch {
            request,
            rgb: batch.rgb,
        })
        .unwrap();
    assert_eq!((frame.tick, frame.neural_steps), (1, 2));
}

#[test]
fn terminal_flies_stop_requesting_eyes_but_keep_their_transition_batch() {
    for zap_both in [false, true] {
        let mut level = sim::swarm_lab::level(2).unwrap();
        level.duration_ticks = 3;
        level.zappers.push(sim::body::ContactRegion {
            center: sim::environment::Point { x: -2., z: -2. },
            radius: 0.15,
        });
        if zap_both {
            level.zappers.push(sim::body::ContactRegion {
                center: sim::environment::Point { x: -1.6, z: -2. },
                radius: 0.15,
            });
        }
        let mut attempt = attempt_for(level, 7);
        let request = attempt.prepare_tick().unwrap().unwrap();
        let batch = RetinaBatch {
            request,
            rgb: vec![123; 24],
        };
        let first = attempt.commit_tick(batch.clone()).unwrap();
        assert_eq!(
            first.flies[0].body.outcome,
            Some(sim::body::TerminalOutcome::Zapped)
        );
        assert_eq!(first.retina, Some(batch));
        let request = attempt.prepare_tick().unwrap().unwrap();
        let active: Vec<_> = request.poses.iter().map(|pose| pose.fly_id).collect();
        assert_eq!(active, if zap_both { vec![] } else { vec![1] });
        let rgb = vec![42; request.poses.len() * 12];
        let second = attempt.commit_tick(RetinaBatch { request, rgb }).unwrap();
        assert_eq!(second.neural_steps, if zap_both { 2 } else { 3 });
        assert_eq!(second.flies[0].body, first.flies[0].body);
        assert_eq!(second.flies[0].neural, None);
        let request = attempt.prepare_tick().unwrap().unwrap();
        let rgb = vec![42; request.poses.len() * 12];
        let last = attempt.commit_tick(RetinaBatch { request, rgb }).unwrap();
        assert!(last.result.is_some());
        assert!(attempt.prepare_tick().unwrap().is_none());
    }
}

#[test]
fn each_fly_brain_consumes_its_own_rgb_currents_with_no_directional_vision_added() {
    let (graph, config, json) = retinal_fixture::fixture();
    let map = sim::RetinalMap::from_json(&graph, &config.profile, &json.to_string()).unwrap();
    let mut attempt = attempt();
    let request = attempt.prepare_tick().unwrap().unwrap();
    let rgb = vec![
        255, 0, 0, 0, 0, 255, 0, 255, 0, 128, 128, 128, 0, 0, 0, 255, 255, 255, 0, 0, 255, 0, 0, 0,
    ];
    let frame = attempt
        .commit_tick(RetinaBatch {
            request,
            rgb: rgb.clone(),
        })
        .unwrap();
    for (id, eyes) in rgb.chunks_exact(12).enumerate() {
        let seed = sim::Brain::seed_for_fly(42, id as u32);
        let mut expected = sim::Brain::new(graph.clone(), seed);
        expected
            .set_external_current(&sim::sensory::retinal_currents(&map, eyes, 3.).unwrap())
            .unwrap();
        let output = expected.step();
        let mut dark = sim::Brain::new(graph.clone(), seed);
        assert_ne!(
            output,
            dark.step(),
            "the fixture must detect omitted visual input"
        );
        assert_eq!(frame.flies[id].neural.as_ref(), Some(&output));
    }
}

#[test]
fn initialization_binds_the_exact_spatial_map() {
    let (graph, config, mut map) = retinal_fixture::fixture();
    // A different valid eye assignment still carries the same source identities.
    map["entries"][0]["eye"] = serde_json::json!("R");
    map["entries"][1]["eye"] = serde_json::json!("L");
    map["support"]["Tm2"] = serde_json::json!({"L":[false,true],"R":[true,false]});
    sim::RetinalMap::from_json(&graph, &config.profile, &map.to_string()).unwrap();
    let level = sim::swarm_lab::level(2).unwrap();
    let tuning = AttemptTuning::default();
    let spec = Attempt::describe(&graph, &level, &tuning, "map-identity", 42, 2, &[]).unwrap();
    assert!(
        Attempt::new_retinal(graph.clone(), level, tuning, spec, config, &map.to_string())
            .err()
            .unwrap()
            .contains("map bytes")
    );
}

#[test]
fn commit_consumes_exactly_one_batch_and_preserves_its_original_bytes() {
    let mut attempt = attempt();
    let request = attempt.prepare_tick().unwrap().unwrap();
    let batch = RetinaBatch {
        request: request.clone(),
        rgb: (0..24).collect(),
    };
    let before = attempt.field_grid();
    let frame = attempt.commit_tick(batch.clone()).unwrap();
    assert_eq!((frame.tick, frame.neural_steps), (1, 2));
    assert_eq!(frame.retina, Some(batch.clone()));
    assert_ne!(attempt.field_grid(), before);
    let fields = attempt.field_grid();
    assert!(attempt.commit_tick(batch).is_err());
    assert_eq!(attempt.field_grid(), fields);
    let next = attempt.prepare_tick().unwrap().unwrap();
    assert_eq!(next.tick, 2);
    for (pose, fly) in next.poses.iter().zip(frame.flies) {
        assert_eq!(
            pose.position,
            [
                fly.body.pose.position.x,
                fly.body.height,
                fly.body.pose.position.z
            ]
        );
        assert_eq!(pose.rotation, fly.body.rotation);
    }
}

#[test]
fn malformed_batches_leave_fields_bodies_and_neural_random_state_untouched() {
    let mut attempt = attempt();
    let mut control = self::attempt();
    let request = attempt.prepare_tick().unwrap().unwrap();
    let valid = RetinaBatch {
        request: request.clone(),
        rgb: (0..24).collect(),
    };
    let fields = attempt.field_grid();
    let faults: [(&str, fn(&mut RetinaBatch)); 15] = [
        ("missing eye", |b| {
            b.rgb.truncate(b.rgb.len() - 6);
        }),
        ("short RGB", |b| {
            b.rgb.pop();
        }),
        ("extra RGB", |b| b.rgb.push(0)),
        ("wrong fly", |b| b.request.poses[1].fly_id = 9),
        ("reordered flies", |b| b.request.poses.swap(0, 1)),
        ("missing fly", |b| {
            b.request.poses.pop();
        }),
        ("stale tick", |b| b.request.tick -= 1),
        ("future tick", |b| b.request.tick += 1),
        ("attempt", |b| b.request.attempt_id.push('x')),
        ("generation", |b| b.request.client_generation += 1),
        ("profile", |b| b.request.profile_hash = "a".repeat(64)),
        ("scene", |b| b.request.scene_id.push('x')),
        ("changed height", |b| b.request.poses[0].position[1] += 0.1),
        ("nonfinite pose", |b| {
            b.request.poses[1].position[0] = f64::NAN
        }),
        ("invalid rotation", |b| {
            b.request.poses[1].rotation = [0.; 4]
        }),
    ];
    for (name, corrupt) in faults {
        let mut batch = valid.clone();
        corrupt(&mut batch);
        assert!(attempt.commit_tick(batch).is_err(), "accepted {name}");
        assert_eq!(attempt.field_grid(), fields, "fields changed for {name}");
        assert_eq!(
            attempt.prepare_tick().unwrap(),
            Some(request.clone()),
            "pending changed for {name}"
        );
    }
    control.prepare_tick().unwrap();
    assert_eq!(
        attempt.commit_tick(valid.clone()).unwrap(),
        control.commit_tick(valid).unwrap()
    );
    assert_eq!(attempt.field_grid(), control.field_grid());
}
