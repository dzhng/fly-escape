//! Cross-language consumer fixture: expected domain frames and their Rust packing.
use sim::{attempt::*, body::*, environment::*, record::*, GroupActivity, MotorOutput, StepOutput};
fn main() {
    let layout = RecordLayout::new(vec!["left".into(), "right".into()]).unwrap();
    let mut frames = vec![];
    for tick in 1..=4 {
        let mut flies = vec![];
        for id in 0..2 {
            let pose = BodyPose {
                position: Point {
                    x: f64::from(tick) + f64::from(id) / 7.,
                    z: -0.123456789012345,
                },
                heading: 1.23456789012345,
            };
            let terminal = tick >= 3;
            let events = if tick == 3 {
                vec![
                    BodyEvent {
                        tick,
                        kind: BodyEventKind::ModeChanged {
                            from: BodyMode::Flying,
                            to: BodyMode::Feeding,
                        },
                    },
                    BodyEvent {
                        tick,
                        kind: BodyEventKind::FeedingStarted,
                    },
                    BodyEvent {
                        tick,
                        kind: BodyEventKind::FeedingEnded {
                            reason: FeedingEnd::Terminal,
                        },
                    },
                    BodyEvent {
                        tick,
                        kind: BodyEventKind::Terminal {
                            outcome: TerminalOutcome::Starved,
                        },
                    },
                ]
            } else {
                vec![]
            };
            flies.push(FlyFrame {
                id,
                input_pose: pose,
                body: BodyState {
                    support: (tick != 4).then_some(id * 7),
                    rotation: sim::surface::support_rotation(0.7, [0., 0.8, 0.6]).unwrap(),
                    height: f64::from(tick + id) / 137.,
                    pose: BodyPose {
                        position: Point {
                            x: pose.position.x + 0.25,
                            z: -2.,
                        },
                        heading: -3.,
                    },
                    mode: BodyMode::Walking,
                    reserve: 12.3456789012345,
                    outcome: terminal.then_some(TerminalOutcome::Starved),
                },
                sensory: (tick != 4 && !(tick == 1 && id == 1)).then_some(SensorySample {
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
                    wind: Point { x: -0.9, z: 1.1 },
                }),
                neural: (tick != 4 && !(tick == 2 && id == 0)).then_some(StepOutput {
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
                events,
            });
        }
        for fly in &mut flies {
            fly.motion = MotionTrace::stationary(&fly.body).points;
            fly.motion[0].pose = fly.input_pose;
        }
        frames.push(AttemptFrame {
            tick,
            neural_steps: tick * 2,
            flies,
            result: (tick == 4).then_some(AttemptResult {
                attempt_id: "fixture".into(),
                completed_tick: 4,
                outcomes: OutcomeSummary {
                    starved: 2,
                    ..Default::default()
                },
                stars: 0,
            }),
        });
    }
    let chunks = vec![
        PackedChunk::encode("fixture", 0, &layout, &frames[..2]).unwrap(),
        PackedChunk::encode("fixture", 1, &layout, &frames[2..]).unwrap(),
    ];
    println!(
        "{}",
        serde_json::json!({"layout": layout,"chunks":chunks,"frames":frames,"archiveByteBound":layout.archive_bytes(2,4).unwrap()})
    );
}
