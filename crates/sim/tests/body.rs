use sim::{body::*, environment::*, GroupActivity, MotorOutput, StepOutput};
fn geometry() -> Geometry {
    Geometry {
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
    }
}
fn exit() -> ExitOpening {
    ExitOpening {
        a: Point { x: 4., z: 1. },
        b: Point { x: 4., z: 3. },
        outward: Point { x: 1., z: 0. },
    }
}
fn neural(thrust: f64, proboscis: f64) -> StepOutput {
    StepOutput {
        motor: MotorOutput {
            thrust,
            turn: 0.,
            flight_thrust: 0.,
            flight_turn: 0.,
        },
        groups: vec![GroupActivity {
            id: "proboscis".into(),
            mean_voltage: proboscis,
            spike_fraction: 0.,
        }],
        spike_count: 0,
    }
}
fn body(x: f64, z: f64, reserve: f64) -> Body {
    Body::new(
        BodyPose {
            position: Point { x, z },
            heading: 0.,
        },
        reserve,
        BodyConfig::default(),
    )
    .unwrap()
}
#[test]
fn food_contact_without_proboscis_motor_activity_never_starts_feeding() {
    let g = geometry();
    let foods = [ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 0.8,
    }];
    let world = BodyWorld::new(&g, &foods, &[], exit(), 100).unwrap();
    let mut b = body(2., 2., 3.);
    for tick in 1..=10 {
        b.step(&neural(0., 0.), &world, Point::default(), 0.1, tick)
            .unwrap();
    }
    assert_eq!(b.state().mode, BodyMode::Walking);
    assert!(b.state().reserve < 3.);
}
#[test]
fn feeding_replenishes_within_capacity_then_contact_loss_allows_later_starvation() {
    let g = geometry();
    let foods = [ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 0.2,
    }];
    let world = BodyWorld::new(&g, &foods, &[], exit(), 6000).unwrap();
    let mut b = body(2., 2., 1.);
    let events = b
        .step(&neural(0., 0.5), &world, Point::default(), 1., 1)
        .unwrap();
    assert!(events
        .iter()
        .any(|e| e.kind == BodyEventKind::FeedingStarted));
    assert!(b.state().reserve > 1.);
    b.step(&neural(0., 0.5), &world, Point { x: 0., z: 1. }, 1., 2)
        .unwrap();
    let after_food = b.state().reserve;
    assert_eq!(b.state().mode, BodyMode::Walking);
    for tick in 3..=100 {
        b.step(&neural(0., 0.), &world, Point::default(), 1., tick)
            .unwrap();
    }
    assert!(after_food < 4.);
    assert_eq!(b.state().reserve, 0.);
    assert_eq!(b.state().outcome, Some(TerminalOutcome::Starved));
}
#[test]
fn meal_plus_timeout_scores_zero_and_terminal_body_is_frozen() {
    let g = geometry();
    let foods = [ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 0.5,
    }];
    let world = BodyWorld::new(&g, &foods, &[], exit(), 2).unwrap();
    let mut b = body(2., 2., 1.);
    b.step(&neural(0., 0.5), &world, Point::default(), 1., 1)
        .unwrap();
    let events = b
        .step(&neural(0., 0.5), &world, Point::default(), 1., 2)
        .unwrap();
    assert!(b.state().reserve > 1.);
    assert_eq!(b.state().outcome, Some(TerminalOutcome::TimedOut));
    assert!(events.iter().any(|e| e.kind
        == BodyEventKind::Terminal {
            outcome: TerminalOutcome::TimedOut
        }));
    let terminal = b.state().clone();
    assert!(b
        .step(&neural(2., 1.), &world, Point { x: 8., z: 0. }, 1., 3)
        .unwrap()
        .is_empty());
    assert_eq!(*b.state(), terminal);
    let counts = summarize_outcomes(&[terminal]);
    assert_eq!(counts.score, 0);
    assert_eq!(counts.timed_out, 1);
}
#[test]
fn swept_outward_exit_counts_once_and_adjacent_or_covering_wall_never_escapes() {
    let g = geometry();
    let world = BodyWorld::new(&g, &[], &[], exit(), 20).unwrap();
    let mut open = body(2., 2., 10.);
    let events = open
        .step(&neural(2., 0.), &world, Point { x: 5., z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(open.state().outcome, Some(TerminalOutcome::Escaped));
    assert_eq!(open.state().pose.position.x, 4.);
    assert_eq!(
        events
            .iter()
            .filter(|e| matches!(e.kind, BodyEventKind::Terminal { .. }))
            .count(),
        1
    );
    assert!(open
        .step(&neural(2., 0.), &world, Point::default(), 1., 2)
        .unwrap()
        .is_empty());
    assert_eq!(summarize_outcomes(&[open.state().clone()]).score, 1);
    let mut adjacent = body(2., 0.5, 10.);
    adjacent
        .step(&neural(2., 0.), &world, Point { x: 5., z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(adjacent.state().outcome, None);
    assert!(adjacent.state().pose.position.x < 4.);
    let mut blocked = g.clone();
    blocked.walls.push(Wall {
        a: Point { x: 4., z: 1. },
        b: Point { x: 4., z: 3. },
    });
    let blocked_world = BodyWorld::new(&blocked, &[], &[], exit(), 20).unwrap();
    let mut b = body(2., 2., 10.);
    b.step(
        &neural(2., 0.),
        &blocked_world,
        Point { x: 5., z: 0. },
        1.,
        1,
    )
    .unwrap();
    assert_eq!(b.state().outcome, None);
    assert!(b.state().pose.position.x < 4.);
}
#[test]
fn takeoff_and_landing_require_their_neural_readouts_and_flight_cannot_feed() {
    let g = geometry();
    let foods = [ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 1.,
    }];
    let world = BodyWorld::new(&g, &foods, &[], exit(), 100).unwrap();
    let mut b = body(2., 2., 3.);
    let mut command = neural(0., 1.);
    command.motor.flight_thrust = 0.5;
    b.step(&command, &world, Point::default(), 0.1, 1).unwrap();
    assert_eq!(b.state().mode, BodyMode::Flying);
    assert!(!b.contacts(&world).food);
    assert!(b.state().reserve < 3.);
    command.motor.flight_thrust = 0.;
    b.step(&command, &world, Point::default(), 0.1, 2).unwrap();
    assert_eq!(b.state().mode, BodyMode::Flying);
    command.groups.extend([
        GroupActivity {
            id: "landingL".into(),
            mean_voltage: 0.5,
            spike_fraction: 0.,
        },
        GroupActivity {
            id: "landingR".into(),
            mean_voltage: 0.5,
            spike_fraction: 0.,
        },
    ]);
    b.step(&command, &world, Point::default(), 0.1, 3).unwrap();
    assert_eq!(b.state().mode, BodyMode::Feeding);
    assert!(b.contacts(&world).food);
}
#[test]
fn feeding_is_capped_and_cannot_restart_until_motor_or_contact_resets() {
    let g = geometry();
    let foods = [ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 0.5,
    }];
    let world = BodyWorld::new(&g, &foods, &[], exit(), 100).unwrap();
    let mut b = body(2., 2., 1.);
    let mut ended = false;
    for tick in 1..=3 {
        let events = b
            .step(&neural(0., 0.5), &world, Point::default(), 1., tick)
            .unwrap();
        ended |= events.iter().any(|e| {
            e.kind
                == BodyEventKind::FeedingEnded {
                    reason: FeedingEnd::BoutLimit,
                }
        });
    }
    assert!(ended);
    assert_eq!(b.state().mode, BodyMode::Walking);
    let fed = b.state().reserve;
    b.step(&neural(0., 0.5), &world, Point::default(), 1., 4)
        .unwrap();
    assert!(b.state().reserve < fed);
    assert_eq!(b.state().mode, BodyMode::Walking);
    b.step(&neural(0., 0.), &world, Point::default(), 0.1, 5)
        .unwrap();
    b.step(&neural(0., 0.5), &world, Point::default(), 0.1, 6)
        .unwrap();
    assert_eq!(b.state().mode, BodyMode::Feeding);
    let mut satiated = body(2., 2., 19.9);
    let events = satiated
        .step(&neural(0., 0.5), &world, Point::default(), 1., 1)
        .unwrap();
    assert_eq!(satiated.state().reserve, 20.);
    assert!(events.iter().any(|e| e.kind
        == BodyEventKind::FeedingEnded {
            reason: FeedingEnd::Satiated
        }));
}
#[test]
fn wind_is_world_space_without_a_hidden_turn_and_inward_crossing_is_not_escape() {
    let g = geometry();
    let world = BodyWorld::new(&g, &[], &[], exit(), 100).unwrap();
    let mut east = body(2., 2., 10.);
    let mut south = body(2., 2., 10.);
    east.step(&neural(0., 0.), &world, Point { x: 1., z: 0. }, 0.1, 1)
        .unwrap();
    south
        .step(&neural(0., 0.), &world, Point { x: 0., z: 1. }, 0.1, 1)
        .unwrap();
    assert_eq!(east.state().pose.position, Point { x: 2.1, z: 2. });
    assert_eq!(south.state().pose.position, Point { x: 2., z: 2.1 });
    assert_eq!(east.state().pose.heading, 0.);
    assert_eq!(south.state().pose.heading, 0.);
    let mut inward = body(5., 2., 10.);
    inward
        .step(&neural(0., 0.), &world, Point { x: -2., z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(inward.state().outcome, None);
    assert_eq!(inward.state().pose.position, Point { x: 3., z: 2. });
}
#[test]
fn swept_zapper_or_earlier_starvation_preempts_exit() {
    let g = geometry();
    let zappers = [ContactRegion {
        center: Point { x: 3., z: 2. },
        radius: 0.1,
    }];
    let world = BodyWorld::new(&g, &[], &zappers, exit(), 100).unwrap();
    let mut b = body(2., 2., 10.);
    b.step(&neural(2., 0.), &world, Point { x: 5., z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(b.state().outcome, Some(TerminalOutcome::Zapped));
    assert!(b.state().pose.position.x < 3.);
    let clear = BodyWorld::new(&g, &[], &[], exit(), 100).unwrap();
    let mut hungry = body(2., 2., 0.01);
    hungry
        .step(&neural(2., 0.), &clear, Point { x: 5., z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(hungry.state().outcome, Some(TerminalOutcome::Starved));
    assert!(hungry.state().pose.position.x < 4.);
    assert_eq!(hungry.state().reserve, 0.);
}
#[test]
fn feeding_does_not_exempt_a_body_from_net_energy_loss() {
    let g = geometry();
    let foods = [ContactRegion {
        center: Point { x: 2., z: 2. },
        radius: 10.,
    }];
    let world = BodyWorld::new(&g, &foods, &[], exit(), 100).unwrap();
    let mut b = Body::new(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        0.01,
        BodyConfig {
            feeding_rate: 0.05,
            ..BodyConfig::default()
        },
    )
    .unwrap();
    b.step(&neural(0., 0.5), &world, Point { x: 10., z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(b.state().outcome, Some(TerminalOutcome::Starved));
    assert_eq!(b.state().reserve, 0.);
}
