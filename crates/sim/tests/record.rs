use sim::food::{FoodDef, FoodShape};
use sim::{attempt::*, body::*, environment::*, record::*, GroupActivity, MotorOutput, StepOutput};

fn frame(tick: u32) -> AttemptFrame {
    let pose = BodyPose {
        position: Point {
            x: 1.23456789012345,
            z: -0.2,
        },
        heading: 0.3,
    };
    let mut frame = AttemptFrame {
        retina: None,
        tick,
        neural_steps: tick.saturating_mul(2),
        flies: vec![FlyFrame {
            id: 0,
            input_pose: pose,
            body: BodyState {
                support: Some(7),
                rotation: sim::surface::support_rotation(0.7, [0., 0.8, 0.6]).unwrap(),
                height: 0.,
                pose: BodyPose {
                    position: Point { x: 2., z: 3. },
                    heading: 4.,
                },
                mode: BodyMode::Feeding,
                reserve: 9.87654321098765,
                outcome: None,
            },
            sensory: Some(SensorySample {
                left: FieldSample {
                    attractive_odor: 0.1,
                    repellent_odor: 0.9,
                    brightness: 0.2,
                    shade: 0.3,
                    exit_cue: 0.4,
                },
                right: FieldSample {
                    attractive_odor: 0.5,
                    repellent_odor: 0.3,
                    brightness: 0.6,
                    shade: 0.7,
                    exit_cue: 0.8,
                },
                vision: VisionSample::default(),
                wind: Point { x: -0.9, z: 1.1 },
            }),
            neural: Some(StepOutput {
                motor: MotorOutput {
                    thrust: 1.2,
                    turn: -1.3,
                    flight_thrust: 1.4,
                    flight_turn: -1.5,
                },
                groups: vec![
                    GroupActivity {
                        id: "left".into(),
                        mean_voltage: -52.1234567890123,
                        spike_fraction: 0.25,
                    },
                    GroupActivity {
                        id: "right".into(),
                        mean_voltage: -61.5,
                        spike_fraction: 0.125,
                    },
                ],
                spike_count: 17,
            }),
            motion: vec![],
            events: vec![],
        }],
        result: None,
    };
    sync_motion(&mut frame.flies[0]);
    frame
}
fn sync_motion(fly: &mut FlyFrame) {
    fly.motion = MotionTrace::stationary(&fly.body).points;
    fly.motion[0].pose = fly.input_pose;
}
#[test]
fn replay_preserves_precision_optional_measurements_events_and_result() {
    let layout = RecordLayout::new(vec!["left".into(), "right".into()]).unwrap();
    let mut frames: Vec<_> = (1..=4).map(frame).collect();
    frames[0].flies[0].sensory = None;
    frames[1].flies[0].neural = None;
    let events = vec![
        BodyEventKind::ModeChanged {
            from: BodyMode::Flying,
            to: BodyMode::Walking,
        },
        BodyEventKind::FeedingStarted,
        BodyEventKind::FeedingEnded {
            reason: FeedingEnd::Terminal,
        },
        BodyEventKind::Terminal {
            outcome: TerminalOutcome::Zapped,
        },
    ];
    frames[2].flies[0].events = events
        .into_iter()
        .map(|kind| BodyEvent { tick: 3, kind })
        .collect();
    frames[2].flies[0].body.outcome = Some(TerminalOutcome::Zapped);
    frames[3].flies[0].body = frames[2].flies[0].body.clone();
    frames[3].flies[0].sensory = None;
    frames[3].flies[0].neural = None;
    frames[3].result = Some(AttemptResult {
        attempt_id: "a".into(),
        completed_tick: 4,
        outcomes: OutcomeSummary {
            zapped: 1,
            ..Default::default()
        },
        stars: 0,
    });
    let chunk = PackedChunk::encode("a", 7, &layout, &frames).unwrap();
    assert_eq!(chunk.decode(&layout).unwrap(), frames);
    // Consumer locates fields from exported names, never a handwritten TS offset.
    let metadata = serde_json::to_value(&layout).unwrap();
    let reserve = metadata["valueFields"]
        .as_array()
        .unwrap()
        .iter()
        .position(|v| v == "reserve")
        .unwrap();
    assert_eq!(chunk.values[reserve], frames[0].flies[0].body.reserve);
    assert_eq!(chunk.sequence, 7);
}

#[test]
fn horizon_and_event_budget_fail_explicitly_before_encoding() {
    let layout = RecordLayout::new((0..16).map(|n| n.to_string()).collect()).unwrap();
    let bytes = layout.archive_bytes(20, 6000).unwrap();
    assert!(bytes <= ARCHIVE_CAP_BYTES);
    // Nonvisual capacity probes share the larger quota but still enforce authored bounds.
    assert!(layout.archive_bytes(100, 100).is_ok());
    for (flies, ticks) in [(u32::MAX, 6000), (20, u32::MAX), (0, 1), (1, 0)] {
        assert!(layout.archive_bytes(flies, ticks).is_err());
    }
    let layout = RecordLayout::new(vec!["left".into(), "right".into()]).unwrap();
    let mut f = frame(1);
    f.flies[0].events = vec![
        BodyEvent {
            tick: 1,
            kind: BodyEventKind::FeedingStarted
        };
        MAX_EVENTS_PER_FLY_TICK + 1
    ];
    assert!(PackedChunk::encode("a", 0, &layout, &[f]).is_err());
    assert!(PackedChunk::encode("a", 0, &layout, &[frame(u32::MAX)]).is_err());
    assert!(PackedChunk::encode("a", 0, &layout, &[frame(1), frame(3)]).is_err());
}

#[test]
fn malformed_transport_buffers_are_errors_not_panics_or_partial_replays() {
    let layout = RecordLayout::new(vec!["left".into(), "right".into()]).unwrap();
    let good = PackedChunk::encode("a", 0, &layout, &[frame(1)]).unwrap();
    let mutations: [fn(&mut PackedChunk); 12] = [
        |c| {
            c.values.pop();
        },
        |c| {
            c.states.pop();
        },
        |c| c.states[0] = u32::MAX,
        |c| c.states[2] = 4,
        |c| c.tick_count = u32::MAX,
        |c| c.fly_count = u32::MAX,
        |c| c.start_tick = u32::MAX,
        |c| c.values[0] = f64::NAN,
        |c| c.events = vec![1],
        |c| c.events = vec![0, 0, 1, 0, 0],
        |c| c.events = vec![1, 1, 1, 0, 0],
        |c| c.events = vec![1, 0, 3, 0, 0],
    ];
    for mutate in mutations {
        let mut bad = good.clone();
        mutate(&mut bad);
        assert!(bad.decode(&layout).is_err());
    }
}

#[test]
fn dense_real_body_transitions_fit_and_replay_in_order() {
    let geometry = Geometry {
        solids: vec![],
        rooms: vec![RectRoom {
            id: 1,
            min: Point { x: 0., z: 0. },
            max: Point { x: 4., z: 4. },
        }],
        walls: vec![],
    };
    let food = [FoodDef {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        shape: FoodShape::Patch { radius: 1. },
    }
    .surface(0)
    .unwrap()];
    let world = BodyWorld::new(
        &geometry,
        &food,
        &[],
        &[],
        ExitOpening {
            a: Point { x: 4., z: 1. },
            b: Point { x: 4., z: 3. },
            outward: Point { x: 1., z: 0. },
        },
        3,
    )
    .unwrap();
    let mut body = Body::new(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        BodyConfig {
            life: LifeModel::Reserve(ReserveModel {
                initial: 19.9,
                ..ReserveModel::default()
            }),
            ..BodyConfig::default()
        },
    )
    .unwrap();
    let mut neural = StepOutput {
        motor: MotorOutput {
            thrust: 0.,
            turn: 0.,
            flight_thrust: 1.,
            flight_turn: 0.,
        },
        groups: vec![
            GroupActivity {
                id: "proboscis".into(),
                mean_voltage: 0.,
                spike_fraction: 0.,
            },
            GroupActivity {
                id: "landingL".into(),
                mean_voltage: 0.,
                spike_fraction: 0.,
            },
            GroupActivity {
                id: "landingR".into(),
                mean_voltage: 0.,
                spike_fraction: 0.,
            },
        ],
        spike_count: 0,
    };
    body.step(&neural, &world, Point::default(), 0.1, 1)
        .unwrap();
    assert_eq!(body.state().mode, BodyMode::Flying);
    for g in &mut neural.groups {
        g.spike_fraction = 1.;
    }
    let landing_events = body
        .step(&neural, &world, Point::default(), 0.1, 2)
        .unwrap();
    assert_eq!(
        landing_events
            .events
            .iter()
            .map(|e| e.kind.clone())
            .collect::<Vec<_>>(),
        vec![
            BodyEventKind::ModeChanged {
                from: BodyMode::Flying,
                to: BodyMode::Landing
            },
            BodyEventKind::ModeChanged {
                from: BodyMode::Landing,
                to: BodyMode::Walking
            },
        ]
    );
    let input_pose = body.state().pose;
    let events = body
        .step(&neural, &world, Point::default(), 0.1, 3)
        .unwrap();
    assert_eq!(
        events
            .events
            .iter()
            .map(|e| e.kind.clone())
            .collect::<Vec<_>>(),
        vec![
            BodyEventKind::ModeChanged {
                from: BodyMode::Walking,
                to: BodyMode::Feeding
            },
            BodyEventKind::FeedingStarted,
            BodyEventKind::FeedingEnded {
                reason: FeedingEnd::Satiated
            },
            BodyEventKind::ModeChanged {
                from: BodyMode::Feeding,
                to: BodyMode::Walking
            },
            BodyEventKind::Terminal {
                outcome: TerminalOutcome::TimedOut
            },
        ]
    );
    let layout = RecordLayout::new(neural.groups.iter().map(|g| g.id.clone()).collect()).unwrap();
    let frames = vec![AttemptFrame {
        retina: None,
        tick: 3,
        neural_steps: 3,
        flies: vec![FlyFrame {
            id: 0,
            input_pose,
            body: body.state().clone(),
            sensory: None,
            neural: Some(neural),
            motion: events.motion.points,
            events: events.events,
        }],
        result: None,
    }];
    assert_eq!(
        PackedChunk::encode("a", 0, &layout, &frames)
            .unwrap()
            .decode(&layout)
            .unwrap(),
        frames
    );
}

#[test]
fn records_remain_tick_major_and_fly_major_across_a_full_chunk() {
    let layout = RecordLayout::new(vec!["left".into(), "right".into()]).unwrap();
    let mut frames: Vec<_> = (11..=20).map(frame).collect();
    for f in &mut frames {
        let mut second = f.flies[0].clone();
        second.id = 1;
        second.body.pose.position.x = f64::from(f.tick);
        second.body.reserve = f64::from(f.tick) / 3.;
        sync_motion(&mut second);
        second.events.push(BodyEvent {
            tick: f.tick,
            kind: BodyEventKind::FeedingEnded {
                reason: FeedingEnd::BoutLimit,
            },
        });
        f.flies.push(second);
    }
    let chunk = PackedChunk::encode("a", 1, &layout, &frames).unwrap();
    assert_eq!(chunk.decode(&layout).unwrap(), frames);
    let metadata = serde_json::to_value(&layout).unwrap();
    let reserve = metadata["valueFields"]
        .as_array()
        .unwrap()
        .iter()
        .position(|v| v == "reserve")
        .unwrap();
    for (tick, frame) in frames.iter().enumerate() {
        assert_eq!(
            chunk.values[(tick * 2 + 1) * layout.value_stride() + reserve],
            frame.flies[1].body.reserve
        );
    }
}

#[test]
fn support_and_orientation_roundtrip_and_reject_invalid_payloads() {
    let layout = RecordLayout::new(vec!["left".into(), "right".into()]).unwrap();
    let mut frames = vec![frame(1), frame(2)];
    frames[0].flies[0].body.support = Some(0);
    frames[1].flies[0].body.support = None;
    frames[1].flies[0].body.mode = BodyMode::Flying;
    for frame in &mut frames {
        sync_motion(&mut frame.flies[0]);
    }
    let chunk = PackedChunk::encode("a", 0, &layout, &frames).unwrap();
    assert_eq!(chunk.decode(&layout).unwrap(), frames);
    let metadata = serde_json::to_value(&layout).unwrap();
    assert_eq!(metadata["noSupport"], NO_SUPPORT);
    let rotation = metadata["valueFields"]
        .as_array()
        .unwrap()
        .iter()
        .position(|v| v == "rotationW")
        .unwrap();
    let mut bad = chunk.clone();
    bad.values[rotation] = 2.;
    assert!(bad.decode(&layout).unwrap_err().contains("rotation"));
    frames[0].flies[0].body.support = Some(NO_SUPPORT);
    assert!(PackedChunk::encode("a", 0, &layout, &frames).is_err());
    frames[0].flies[0].body.support = Some(0);
    frames[0].flies[0].body.mode = BodyMode::Landing;
    assert!(PackedChunk::encode("a", 0, &layout, &frames).is_err());
}

#[test]
fn packed_motion_preserves_curvature_and_terminal_hold() {
    let layout = RecordLayout::new(vec!["left".into(), "right".into()]).unwrap();
    let mut frame = frame(1);
    let fly = &mut frame.flies[0];
    fly.body.pose.heading = 0.7;
    fly.input_pose.heading = 0.7;
    sync_motion(fly);
    let mut crest = fly.motion[1].clone();
    crest.fraction = 0.3;
    crest.height = 0.012;
    let mut stopped = fly.motion[1].clone();
    stopped.fraction = 0.52;
    fly.motion.insert(1, crest);
    fly.motion.insert(2, stopped);
    let chunk = PackedChunk::encode("curve", 0, &layout, &[frame]).unwrap();
    let sample = |t| {
        sample_motion(
            &chunk.motion_values,
            &chunk.motion_states,
            &chunk.motion_offsets,
            t,
        )
        .unwrap()
    };
    assert_eq!(sample(0.3)[3], 0.012);
    assert_eq!(sample(0.52), sample(0.9));
    assert_eq!(sample(0.9), sample(1.));
    let mut mismatched = chunk.clone();
    let last = *mismatched.motion_offsets.last().unwrap() as usize - 1;
    mismatched.motion_values[last * 9 + 1] += 0.001;
    assert!(mismatched
        .decode(&layout)
        .unwrap_err()
        .contains("endpoint differs"));
    let mut broken = chunk.motion_offsets.clone();
    broken[1] = u32::MAX;
    assert!(sample_motion(&chunk.motion_values, &chunk.motion_states, &broken, 0.5).is_err());
    let mut broken_values = chunk.motion_values.clone();
    broken_values[9] = 0.;
    assert!(sample_motion(
        &broken_values,
        &chunk.motion_states,
        &chunk.motion_offsets,
        0.5
    )
    .is_err());
    assert!(sample_motion(
        &chunk.motion_values,
        &chunk.motion_states,
        &chunk.motion_offsets,
        f64::NAN
    )
    .is_err());
}

#[test]
fn caught_roundtrips_body_terminal_event_and_summary() {
    let layout = RecordLayout::new(vec!["left".into(), "right".into()]).unwrap();
    let mut f = frame(1);
    f.flies[0].body.outcome = Some(TerminalOutcome::Caught);
    f.flies[0].events.push(BodyEvent {
        tick: 1,
        kind: BodyEventKind::Terminal {
            outcome: TerminalOutcome::Caught,
        },
    });
    f.result = Some(AttemptResult {
        attempt_id: "web".into(),
        completed_tick: 1,
        outcomes: summarize_outcomes(&[f.flies[0].body.clone()]),
        stars: 0,
    });
    assert_eq!(f.result.as_ref().unwrap().outcomes.caught, 1);
    sync_motion(&mut f.flies[0]);
    let packed = PackedChunk::encode("web", 0, &layout, &[f.clone()]).unwrap();
    assert_eq!(packed.decode(&layout).unwrap(), vec![f]);
}

fn retinal_config() -> sim::vision::RetinalConfig {
    sim::vision::RetinalConfig {
        client_generation: 7,
        scene_id: "record-fixture".into(),
        map_hash: "e".repeat(64),
        profile: sim::vision::EyeProfile {
            profile_hash: "a".repeat(64),
            layout_hash: "b".repeat(64),
            rig_hash: "c".repeat(64),
            color_model_hash: "d".repeat(64),
            width: 4,
            height: 4,
            sample_count: 3,
        },
    }
}
#[test]
fn retinal_bytes_preserve_black_terminal_transition_absence_and_full_input_transform() {
    use sim::vision::*;
    let config = retinal_config();
    let layout = RecordLayout::new(vec!["left".into(), "right".into()])
        .unwrap()
        .with_retinal(config.clone())
        .unwrap();
    let mut frames: Vec<_> = (1..=3).map(frame).collect();
    for frame in &mut frames {
        frame.flies[0].sensory.as_mut().unwrap().vision = VisionSample::default();
        let poses = if frame.tick < 3 {
            vec![EyePose {
                fly_id: 0,
                position: [
                    frame.flies[0].input_pose.position.x,
                    0.123456789012345,
                    frame.flies[0].input_pose.position.z,
                ],
                rotation: sim::surface::support_rotation(1.2, [0., 0.6, 0.8]).unwrap(),
            }]
        } else {
            vec![]
        };
        if let Some(pose) = poses.first() {
            frame.flies[0].motion[0].height = pose.position[1];
            frame.flies[0].motion[0].rotation = pose.rotation;
        }
        let rgb = if frame.tick == 1 {
            vec![0; 18]
        } else if frame.tick == 2 {
            (0..18).map(|n| (n * 13 + 7) as u8).collect()
        } else {
            vec![]
        };
        frame.retina = Some(RetinaBatch {
            request: VisionRequest {
                attempt_id: "retinal".into(),
                client_generation: config.client_generation,
                tick: frame.tick,
                profile_hash: config.profile.profile_hash.clone(),
                scene_id: config.scene_id.clone(),
                poses,
            },
            rgb,
        });
        if frame.tick >= 2 {
            frame.flies[0].body.outcome = Some(TerminalOutcome::Caught);
        }
        if frame.tick == 3 {
            frame.flies[0].sensory = None;
            frame.flies[0].neural = None;
        }
    }
    let packed = PackedChunk::encode("retinal", 0, &layout, &frames).unwrap();
    assert_eq!(packed.retina_rgb.len(), 3 * 18);
    assert_eq!(&packed.retina_rgb[..18], &[0; 18]);
    assert_eq!(
        &packed.retina_rgb[18..36],
        frames[1].retina.as_ref().unwrap().rgb
    );
    assert_eq!(&packed.retina_rgb[36..], &[0; 18]);
    let restored = packed.decode(&layout).unwrap();
    for (actual, expected) in restored.iter().zip(&frames) {
        assert_eq!(actual.retina, expected.retina);
    }
    assert_eq!(packed.states[2] & 4, 4);
    assert_eq!(packed.states[7] & 4, 4);
    assert_eq!(packed.states[12] & 4, 0);
    let mut corrupt = packed.clone();
    corrupt.values[28] += 1.;
    assert!(corrupt.decode(&layout).is_err());
}

#[test]
fn retinal_horizon_reserves_every_eye_and_preflights_owned_bytes() {
    let mut config = retinal_config();
    config.profile.width = 128;
    config.profile.height = 128;
    config.profile.sample_count = 721;
    let layout = RecordLayout::new((0..16).map(|n| n.to_string()).collect())
        .unwrap()
        .with_retinal(config)
        .unwrap();
    assert_eq!(
        layout.retina_bytes_per_fly() as u64 * 16 * 6000,
        415_296_000
    );
    assert_eq!(layout.archive_bytes(16, 6000).unwrap(), ARCHIVE_CAP_BYTES);
    assert!(layout.archive_bytes(20, 6000).is_err());
    let simple = RecordLayout::new(vec!["left".into(), "right".into()]).unwrap();
    let frames = vec![frame(1), frame(2)];
    let expected = PackedChunk::encoded_bytes(&simple, &frames).unwrap();
    let chunk = PackedChunk::encode("budget", 0, &simple, &frames).unwrap();
    let actual = CHUNK_ENVELOPE_BYTES
        + (chunk.values.len() + chunk.motion_values.len()) as u64 * 8
        + (chunk.states.len()
            + chunk.events.len()
            + chunk.tick_neural_steps.len()
            + chunk.motion_offsets.len()
            + chunk.motion_states.len()) as u64
            * 4
        + chunk.retina_rgb.len() as u64;
    assert_eq!(expected, actual);
}
