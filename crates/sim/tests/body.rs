use sim::food::{FoodDef, FoodShape};
use sim::{body::*, environment::*, GroupActivity, MotorOutput, StepOutput};
/// One walled room whose only opening faces the given outward normal, so a test
/// can pin behaviour that must follow the authored facing rather than an axis.
fn room_with_opening(outward_x: f64) -> (Geometry, ExitOpening) {
    let wall = |ax, az, bx, bz| Wall {
        a: Point { x: ax, z: az },
        b: Point { x: bx, z: bz },
    };
    let open_x = if outward_x > 0. { 4. } else { 0. };
    let closed_x = 4. - open_x;
    (
        Geometry {
            solids: vec![],
            rooms: vec![RectRoom {
                id: 1,
                min: Point { x: 0., z: 0. },
                max: Point { x: 4., z: 4. },
            }],
            walls: vec![
                wall(0., 0., 4., 0.),
                wall(0., 4., 4., 4.),
                wall(closed_x, 0., closed_x, 4.),
                wall(open_x, 0., open_x, 1.),
                wall(open_x, 3., open_x, 4.),
            ],
        },
        ExitOpening {
            a: Point { x: open_x, z: 1. },
            b: Point { x: open_x, z: 3. },
            outward: Point {
                x: outward_x,
                z: 0.,
            },
        },
    )
}
fn geometry() -> Geometry {
    room_with_opening(1.).0
}
fn exit() -> ExitOpening {
    room_with_opening(1.).1
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
            mean_voltage: 0.,
            spike_fraction: proboscis,
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
        reserve_config(reserve),
    )
    .unwrap()
}
/// A timed round: the horizon is the only clock, so no energy is spent or gained.
fn timed_config() -> BodyConfig {
    BodyConfig {
        life: LifeModel::Timed,
        ..BodyConfig::default()
    }
}
/// The shared finite-life model, started at a chosen reserve.
fn reserve_config(initial: f64) -> BodyConfig {
    BodyConfig {
        life: LifeModel::Reserve(ReserveModel {
            initial,
            ..ReserveModel::default()
        }),
        ..BodyConfig::default()
    }
}
fn food_patch(x: f64, z: f64, radius: f64) -> sim::surface::ContactSurface {
    FoodDef {
        position: Point { x, z },
        heading: 0.,
        shape: FoodShape::Patch { radius },
    }
    .surface(0)
    .unwrap()
}
#[test]
fn food_contact_without_proboscis_motor_activity_never_starts_feeding() {
    let g = geometry();
    let foods = [food_patch(2., 2., 0.8)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 100).unwrap();
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
    let foods = [food_patch(2., 2., 0.2)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 6000).unwrap();
    let mut b = body(2., 2., 1.);
    let events = b
        .step(&neural(0., 0.5), &world, Point::default(), 1., 1)
        .unwrap();
    assert!(events
        .events
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
    assert!(
        (3.8..4.3).contains(&after_food),
        "receive only the early food-contact prefix"
    );
    assert_eq!(b.state().reserve, 0.);
    assert_eq!(b.state().outcome, Some(TerminalOutcome::Starved));
}
#[test]
fn meal_plus_timeout_scores_zero_and_terminal_body_is_frozen() {
    let g = geometry();
    let foods = [food_patch(2., 2., 0.5)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 2).unwrap();
    let mut b = body(2., 2., 1.);
    b.step(&neural(0., 0.5), &world, Point::default(), 1., 1)
        .unwrap();
    let events = b
        .step(&neural(0., 0.5), &world, Point::default(), 1., 2)
        .unwrap();
    assert!(b.state().reserve > 1.);
    assert_eq!(b.state().outcome, Some(TerminalOutcome::TimedOut));
    assert!(events.events.iter().any(|e| e.kind
        == BodyEventKind::Terminal {
            outcome: TerminalOutcome::TimedOut
        }));
    let terminal = b.state().clone();
    assert!(b
        .step(&neural(2., 1.), &world, Point { x: 8., z: 0. }, 1., 3)
        .unwrap()
        .events
        .is_empty());
    assert_eq!(*b.state(), terminal);
    let counts = summarize_outcomes(&[terminal]);
    assert_eq!(counts.score, 0);
    assert_eq!(counts.timed_out, 1);
}
#[test]
fn swept_outward_exit_counts_once_and_adjacent_or_covering_wall_never_escapes() {
    let g = geometry();
    let world = BodyWorld::new(&g, &[], &[], &[], exit(), 20).unwrap();
    let mut open = body(2., 2., 10.);
    let events = open
        .step(&neural(2., 0.), &world, Point { x: 5., z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(open.state().outcome, Some(TerminalOutcome::Escaped));
    assert_eq!(open.state().pose.position.x, 4.);
    assert_eq!(
        events
            .events
            .iter()
            .filter(|e| matches!(e.kind, BodyEventKind::Terminal { .. }))
            .count(),
        1
    );
    assert!(open
        .step(&neural(2., 0.), &world, Point::default(), 1., 2)
        .unwrap()
        .events
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
    let blocked_world = BodyWorld::new(&blocked, &[], &[], &[], exit(), 20).unwrap();
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
    let foods = [food_patch(2., 2., 1.)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 100).unwrap();
    let mut b = body(2., 2., 3.);
    let mut command = neural(0., 1.);
    command.motor.flight_thrust = 0.5;
    b.step(&command, &world, Point::default(), 0.1, 1).unwrap();
    assert_eq!(b.state().mode, BodyMode::Flying);
    assert!(!b.contacts(&world).unwrap().food);
    assert!(b.state().reserve < 3.);
    command.motor.flight_thrust = 0.;
    b.step(&command, &world, Point::default(), 0.1, 2).unwrap();
    assert_eq!(b.state().mode, BodyMode::Flying);
    command.groups.extend([
        GroupActivity {
            id: "landingL".into(),
            mean_voltage: 0.,
            spike_fraction: 0.5,
        },
        GroupActivity {
            id: "landingR".into(),
            mean_voltage: 0.,
            spike_fraction: 0.5,
        },
    ]);
    let airborne_reserve = b.state().reserve;
    b.step(&command, &world, Point::default(), 0.1, 3).unwrap();
    assert_eq!(b.state().mode, BodyMode::Landing);
    assert!(b.state().height > 0.);
    assert!(!b.contacts(&world).unwrap().food);
    assert!(b.state().reserve < airborne_reserve);
    b.step(&command, &world, Point::default(), 0.1, 4).unwrap();
    assert_eq!(b.state().mode, BodyMode::Walking);
    assert_eq!(b.state().height, 0.);
    b.step(&command, &world, Point::default(), 0.1, 5).unwrap();
    assert_eq!(b.state().mode, BodyMode::Feeding);
    assert!(b.contacts(&world).unwrap().food);
}
#[test]
fn feeding_is_capped_and_cannot_restart_until_motor_resets() {
    let g = geometry();
    let foods = [food_patch(2., 2., 0.5)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 100).unwrap();
    let mut b = body(2., 2., 1.);
    let mut ended = false;
    for tick in 1..=3 {
        let events = b
            .step(&neural(0., 0.5), &world, Point::default(), 1., tick)
            .unwrap();
        ended |= events.events.iter().any(|e| {
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
    assert!(
        (satiated.state().reserve - (20. - 0.2 * (1. - 0.1 / 2.8))).abs() < 1e-10,
        "satiation ends feeding before the remaining idle cost"
    );
    assert!(events.events.iter().any(|e| e.kind
        == BodyEventKind::FeedingEnded {
            reason: FeedingEnd::Satiated
        }));
}
#[test]
fn wind_is_world_space_without_a_hidden_turn_and_inward_crossing_is_not_escape() {
    let g = geometry();
    let world = BodyWorld::new(&g, &[], &[], &[], exit(), 100).unwrap();
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
    let world = BodyWorld::new(&g, &[], &[], &zappers, exit(), 100).unwrap();
    let mut b = body(2., 2., 10.);
    b.step(&neural(2., 0.), &world, Point { x: 5., z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(b.state().outcome, Some(TerminalOutcome::Zapped));
    assert!(b.state().pose.position.x < 3.);
    let clear = BodyWorld::new(&g, &[], &[], &[], exit(), 100).unwrap();
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
    let foods = [food_patch(2., 2., 10.)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 100).unwrap();
    let mut b = Body::new(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        BodyConfig {
            life: LifeModel::Reserve(ReserveModel {
                initial: 0.01,
                feeding_rate: 0.05,
                ..ReserveModel::default()
            }),
            ..BodyConfig::default()
        },
    )
    .unwrap();
    b.step(&neural(0., 0.5), &world, Point { x: 10., z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(b.state().outcome, Some(TerminalOutcome::Starved));
    assert_eq!(b.state().reserve, 0.);
}
#[test]
fn a_proboscis_spike_starts_a_bout_that_stays_latched_between_pulses() {
    let g = geometry();
    let foods = [food_patch(2., 2., 0.5)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 100).unwrap();
    let mut b = body(2., 2., 1.);
    let mut pulse = neural(0., 0.);
    pulse.groups[0].spike_fraction = 0.25;
    b.step(&pulse, &world, Point::default(), 0.1, 1).unwrap();
    assert_eq!(b.state().mode, BodyMode::Feeding);
    let after_start = b.state().reserve;
    for tick in 2..=10 {
        b.step(&neural(0., 0.), &world, Point::default(), 0.1, tick)
            .unwrap();
        assert_eq!(b.state().mode, BodyMode::Feeding);
    }
    assert!(b.state().reserve > after_start);
}
#[test]
fn landing_spike_enforces_one_game_second_of_ground_dwell() {
    for dt in [0.1, 0.25] {
        let g = geometry();
        let world = BodyWorld::new(&g, &[], &[], &[], exit(), 100).unwrap();
        let mut b = body(2., 2., 10.);
        let mut flight = neural(0., 0.);
        flight.motor.flight_thrust = 0.5;
        b.step(&flight, &world, Point::default(), dt, 1).unwrap();
        assert_eq!(
            b.state().mode,
            BodyMode::Flying,
            "initial dwell must not block takeoff"
        );
        let mut landing = flight.clone();
        landing.groups.push(GroupActivity {
            id: "landingL".into(),
            mean_voltage: 0.,
            spike_fraction: 0.5,
        });
        b.step(&landing, &world, Point::default(), dt, 2).unwrap();
        assert_eq!(b.state().mode, BodyMode::Walking);
        let steps = (1.0 / dt).round() as u32;
        for offset in 1..steps {
            b.step(&flight, &world, Point::default(), dt, 2 + offset)
                .unwrap();
            assert_eq!(
                b.state().mode,
                BodyMode::Walking,
                "takeoff before one second at dt={dt}"
            );
        }
        b.step(&flight, &world, Point::default(), dt, 2 + steps)
            .unwrap();
        assert_eq!(b.state().mode, BodyMode::Flying);
    }
}
#[test]
fn a_new_bout_requires_motor_rearming_after_contact_loss() {
    let g = geometry();
    let foods = [food_patch(2., 2., 0.2)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 100).unwrap();
    let mut b = body(2., 2., 1.);
    let pulse = neural(0., 0.25);
    b.step(&pulse, &world, Point::default(), 0.1, 1).unwrap();
    b.step(&pulse, &world, Point { x: 10., z: 0. }, 0.1, 2)
        .unwrap();
    assert_eq!(b.state().mode, BodyMode::Walking);
    b.step(&pulse, &world, Point { x: -10., z: 0. }, 0.1, 3)
        .unwrap();
    b.step(&pulse, &world, Point::default(), 0.1, 4).unwrap();
    assert_eq!(b.state().mode, BodyMode::Walking);
    b.step(&neural(0., 0.), &world, Point::default(), 0.1, 5)
        .unwrap();
    b.step(&pulse, &world, Point::default(), 0.1, 6).unwrap();
    assert_eq!(b.state().mode, BodyMode::Feeding);
}
#[test]
fn tonic_voltage_without_spikes_does_not_initiate_feeding_or_landing() {
    let g = geometry();
    let foods = [food_patch(2., 2., 0.5)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 100).unwrap();
    let mut b = body(2., 2., 1.);
    let mut quiet = neural(0., 0.);
    quiet.groups[0].mean_voltage = 1.;
    b.step(&quiet, &world, Point::default(), 0.1, 1).unwrap();
    assert_eq!(b.state().mode, BodyMode::Walking);
    quiet.motor.flight_thrust = 0.5;
    quiet.groups.extend([
        GroupActivity {
            id: "landingL".into(),
            mean_voltage: 1.,
            spike_fraction: 0.,
        },
        GroupActivity {
            id: "landingR".into(),
            mean_voltage: 1.,
            spike_fraction: 0.,
        },
    ]);
    b.step(&quiet, &world, Point::default(), 0.1, 2).unwrap();
    b.step(&quiet, &world, Point::default(), 0.1, 3).unwrap();
    assert_eq!(b.state().mode, BodyMode::Flying);
}

#[test]
fn airborne_landing_is_latched_and_terminal_height_freezes_at_the_actual_time() {
    let g = geometry();
    let foods = [food_patch(2., 2., 1.)];
    let world = BodyWorld::new(&g, &foods, &[], &[], exit(), 100).unwrap();
    let start = BodyPose {
        position: Point { x: 2., z: 2. },
        heading: 0.,
    };
    let mut pulse = neural(0., 1.);
    pulse.groups.push(GroupActivity {
        id: "landingL".into(),
        mean_voltage: 0.,
        spike_fraction: 1.,
    });
    let mut b = Body::new_in_mode(start, reserve_config(10.), BodyMode::Flying).unwrap();
    let initial_height = b.state().height;
    b.step(&pulse, &world, Point::default(), 0.1, 1).unwrap();
    assert_eq!(b.state().mode, BodyMode::Landing);
    assert!(b.state().height > 0. && b.state().height < initial_height);
    assert!(!b.contacts(&world).unwrap().food);
    let quiet = neural(0., 0.);
    for tick in 2..8 {
        let before = b.state().height;
        b.step(&quiet, &world, Point::default(), 0.1, tick).unwrap();
        assert_eq!(b.state().mode, BodyMode::Landing);
        assert!(b.state().height > 0. && b.state().height < before);
        assert!(!b.contacts(&world).unwrap().food);
    }
    b.step(&quiet, &world, Point::default(), 0.1, 8).unwrap();
    assert_eq!(b.state().height, 0.);
    assert_eq!(b.state().mode, BodyMode::Walking);
    assert!(b.contacts(&world).unwrap().food);

    let mut dying = Body::new_in_mode(start, reserve_config(0.04), BodyMode::Flying).unwrap();
    dying.step(&pulse, &world, Point::default(), 1., 1).unwrap();
    // Reserve lasts0.05s, so descent stops after0.0375m even though dt spans touchdown.
    assert_eq!(dying.state().outcome, Some(TerminalOutcome::Starved));
    assert!((dying.state().height - 0.5625).abs() < 1e-12);
    let terminal = dying.state().clone();
    dying.step(&quiet, &world, Point::default(), 1., 2).unwrap();
    assert_eq!(*dying.state(), terminal);
}

#[test]
fn native_fly_lands_on_authored_apple_before_it_can_feed() {
    let g = geometry();
    let apple = FoodDef {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        shape: FoodShape::Apple,
    }
    .surface(7)
    .unwrap();
    let world = BodyWorld::new(&g, &[apple], &[], &[], exit(), 100).unwrap();
    let mut b = Body::new_in_mode(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        reserve_config(3.),
        BodyMode::Flying,
    )
    .unwrap();
    let mut landing = neural(0., 1.);
    landing.groups.push(GroupActivity {
        id: "landingL".into(),
        mean_voltage: 0.,
        spike_fraction: 1.,
    });
    for tick in 1..=6 {
        b.step(&landing, &world, Point::default(), 0.1, tick)
            .unwrap();
        assert_eq!(b.state().mode, BodyMode::Landing);
        assert_eq!(b.state().support, None);
        assert!(!b.contacts(&world).unwrap().food);
    }
    b.step(&landing, &world, Point::default(), 0.1, 7).unwrap();
    assert_eq!(b.state().mode, BodyMode::Walking);
    assert_eq!(b.state().support, Some(7));
    assert!(
        (0.07..0.09).contains(&b.state().height),
        "land on fruit, not the floor"
    );
    assert!(b.contacts(&world).unwrap().food);
    let reserve = b.state().reserve;
    b.step(&neural(0., 1.), &world, Point::default(), 0.1, 8)
        .unwrap();
    assert_eq!(b.state().mode, BodyMode::Feeding);
    assert!(b.state().reserve > reserve);
}

#[test]
fn apple_support_follows_walking_and_is_lost_at_the_edge() {
    let g = geometry();
    let apple = FoodDef {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        shape: FoodShape::Apple,
    }
    .surface(7)
    .unwrap();
    let world = BodyWorld::new(&g, &[apple], &[], &[], exit(), 1000).unwrap();
    let mut b = Body::new_in_mode(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        reserve_config(20.),
        BodyMode::Flying,
    )
    .unwrap();
    let mut landing = neural(0., 0.);
    landing.groups.push(GroupActivity {
        id: "landingL".into(),
        mean_voltage: 0.,
        spike_fraction: 1.,
    });
    b.step(&landing, &world, Point::default(), 0.7, 1).unwrap();
    assert_eq!(b.state().support, Some(7));
    let start = b.state().clone();
    let mut lost = false;
    for tick in 2..=101 {
        let previous = b.state().clone();
        b.step(&neural(0.02, 0.), &world, Point::default(), 0.05, tick)
            .unwrap_or_else(|error| panic!("tick {tick}, state {previous:?}: {error}"));
        assert!(
            (b.state().height - previous.height).abs() < 0.04,
            "continuous height across support loss"
        );
        if b.state().support.is_none() {
            assert_eq!(b.state().mode, BodyMode::Landing);
            assert!(!b.contacts(&world).unwrap().food);
            lost = true;
            break;
        }
    }
    assert!(lost, "walking should reach and leave the edge, not stall");
    for tick in 102..=161 {
        b.step(&neural(0.02, 0.), &world, Point::default(), 0.05, tick)
            .unwrap_or_else(|error| panic!("post-edge tick {tick}: {error}"));
    }
    assert!(b.state().support.is_none());
    assert_eq!(b.state().mode, BodyMode::Walking);

    assert!(
        (b.state().pose.position.x - start.pose.position.x)
            .hypot(b.state().pose.position.z - start.pose.position.z)
            > 0.02
    );
}

#[test]
fn recorded_orientation_tracks_turns_and_freezes_with_terminal_pose() {
    use parry3d_f64::math::{Rotation, Vector};
    let g = geometry();
    let world = BodyWorld::new(&g, &[], &[], &[], exit(), 1).unwrap();
    let mut b = body(2., 2., 10.);
    let initial = b.state().rotation;
    let mut command = neural(0.2, 0.);
    command.motor.turn = 0.7;
    b.step(&command, &world, Point::default(), 0.1, 1).unwrap();
    assert_ne!(b.state().rotation, initial);
    let q = Rotation::from_array(b.state().rotation);
    let forward = q * Vector::Z;
    assert!((forward.x - b.state().pose.heading.cos()).abs() < 1e-12);
    assert!((forward.z - b.state().pose.heading.sin()).abs() < 1e-12);
    assert!((q * Vector::Y - Vector::Y).length() < 1e-12);
    let terminal = b.state().clone();
    assert_eq!(terminal.outcome, Some(TerminalOutcome::TimedOut));
    command.motor.turn = -0.7;
    b.step(&command, &world, Point::default(), 0.1, 2).unwrap();
    assert_eq!(b.state(), &terminal);
}

#[test]
fn neighboring_apple_blocks_while_time_advances() {
    let g = geometry();
    let apple = FoodDef {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        shape: FoodShape::Apple,
    }
    .surface(7)
    .unwrap();
    let neighbor = FoodDef {
        position: Point { x: 2.09, z: 2. },
        heading: 0.,
        shape: FoodShape::Apple,
    }
    .surface(8)
    .unwrap();
    let contact_scene =
        sim::surface::ContactScene::new(&[apple.clone(), neighbor.clone()]).unwrap();
    let asset: serde_json::Value =
        serde_json::from_str(include_str!("../../../assets/fly/contact-hull.json")).unwrap();
    let vertices: Vec<[f64; 3]> = serde_json::from_value(asset["vertices"].clone()).unwrap();
    let hull = sim::surface::ContactHull::new(&vertices).unwrap();
    let world = BodyWorld::new(&g, &[apple, neighbor], &[], &[], exit(), 1000).unwrap();
    let mut b = Body::new_in_mode(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        reserve_config(20.),
        BodyMode::Flying,
    )
    .unwrap();
    let mut landing = neural(0., 0.);
    landing.groups.push(GroupActivity {
        id: "landingL".into(),
        mean_voltage: 0.,
        spike_fraction: 1.,
    });
    b.step(&landing, &world, Point::default(), 0.7, 1).unwrap();
    assert_eq!(b.state().support, Some(7));
    let mut failure = None;
    for tick in 2..=150 {
        match b.step(&neural(0.02, 0.), &world, Point::default(), 0.05, tick) {
            Err(error) => {
                failure = Some(error);
                break;
            }
            Ok(step) => {
                for pair in step.motion.points.windows(2) {
                    for t in [
                        pair[0].fraction,
                        (pair[0].fraction + pair[1].fraction) * 0.5,
                        pair[1].fraction,
                    ] {
                        let p = step.motion.at(t).unwrap();
                        assert!(
                            !contact_scene
                                .penetration(
                                    &hull,
                                    [p.pose.position.x, p.height, p.pose.position.z],
                                    p.rotation
                                )
                                .unwrap()
                                .exceeds(3e-6),
                            "native hull trajectory exceeds the numerical food-contact budget"
                        );
                    }
                }
            }
        }
    }
    assert!(failure.is_none());
    assert_eq!(b.state().support, None);
    assert_eq!(b.state().mode, BodyMode::Walking);
    assert!(
        b.state().pose.position.x < 2.09,
        "cannot walk through neighboring apple"
    );
    let stopped = b.state().pose.position;
    let reserve = b.state().reserve;
    for tick in 151..=155 {
        b.step(&neural(0.02, 0.), &world, Point::default(), 0.05, tick)
            .unwrap();
    }
    assert!((b.state().pose.position.x - stopped.x).abs() < 1e-8);
    assert!(
        b.state().reserve < reserve,
        "blocking contact must still consume time"
    );
}

#[test]
fn feeding_prefix_energy_and_terminal_hold_share_the_motion_clock() {
    let g = geometry();
    let world = BodyWorld::new(&g, &[food_patch(2., 2., 1.)], &[], &[], exit(), 100).unwrap();
    let config = BodyConfig {
        life: LifeModel::Reserve(ReserveModel {
            initial: 0.5,
            idle_cost: 1.,
            feeding_rate: 0.1,
            max_bout_seconds: 0.2,
            ..ReserveModel::default()
        }),
        ..BodyConfig::default()
    };
    let mut b = Body::new(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        config,
    )
    .unwrap();
    let step = b
        .step(&neural(0., 1.), &world, Point { x: 0.1, z: 0. }, 1., 1)
        .unwrap();
    assert_eq!(b.state().outcome, Some(TerminalOutcome::Starved));
    assert!((b.state().pose.position.x - 2.052).abs() < 1e-8);
    let terminal = step
        .motion
        .points
        .iter()
        .find(|p| (p.fraction - 0.52).abs() < 1e-10)
        .expect("piecewise feeding delays starvation to0.52");
    for t in [0.52, 0.7, 1.] {
        let p = step.motion.at(t).unwrap();
        assert_eq!(p.pose, terminal.pose);
        assert_eq!(p.rotation, terminal.rotation);
    }
    assert!(step
        .motion
        .points
        .windows(2)
        .all(|p| p[1].fraction > p[0].fraction));
}

#[test]
fn takeoff_from_tilted_apple_makes_progress() {
    let g = geometry();
    let apple = FoodDef {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        shape: FoodShape::Apple,
    }
    .surface(7)
    .unwrap();
    let world = BodyWorld::new(&g, &[apple], &[], &[], exit(), 1000).unwrap();
    let mut b = Body::new_in_mode(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        reserve_config(20.),
        BodyMode::Flying,
    )
    .unwrap();
    let mut landing = neural(0., 0.);
    landing.groups.push(GroupActivity {
        id: "landingL".into(),
        mean_voltage: 0.,
        spike_fraction: 1.,
    });
    b.step(&landing, &world, Point::default(), 0.7, 1).unwrap();
    assert_eq!(b.state().support, Some(7));
    for tick in 2..=25 {
        b.step(&neural(0.01, 0.), &world, Point::default(), 0.05, tick)
            .unwrap();
    }
    let from = b.state().clone();
    assert!(from.support.is_some());
    let mut takeoff = neural(0., 0.);
    takeoff.motor.flight_thrust = 0.5;
    let step = b.step(&takeoff, &world, Point::default(), 0.1, 26).unwrap();
    assert_eq!(b.state().mode, BodyMode::Flying);
    assert!(
        b.state().height > from.height + 0.001,
        "outward takeoff cannot freeze at initial contact: {:?}",
        b.state()
    );
    assert!(step
        .motion
        .points
        .windows(2)
        .all(|p| p[1].fraction > p[0].fraction));
    let mut turn = neural(0., 0.);
    turn.motor.flight_turn = 2.;
    b.step(&turn, &world, Point::default(), 1., 27).unwrap();
    turn.motor.flight_turn = std::f64::consts::PI - 2.;
    b.step(&turn, &world, Point::default(), 1., 28).unwrap();
    b.step(&takeoff, &world, Point::default(), 0.1, 29).unwrap();
    let mut return_landing = neural(0., 0.);
    return_landing.groups.push(GroupActivity {
        id: "landingL".into(),
        mean_voltage: 0.,
        spike_fraction: 1.,
    });
    b.step(&return_landing, &world, Point::default(), 1., 30)
        .unwrap();
    assert_eq!(
        b.state().support,
        Some(7),
        "return flight must reacquire apple: {:?}",
        b.state()
    );
    assert_eq!(b.state().mode, BodyMode::Walking);
    b.step(&neural(0., 1.), &world, Point::default(), 0.1, 31)
        .unwrap();
    assert_eq!(
        b.state().mode,
        BodyMode::Feeding,
        "legitimate revisit can feed"
    );
}

#[test]
fn oblique_wind_slides_at_actual_contact_time_and_a_corner_stops_both_axes() {
    let g = geometry();
    let world = BodyWorld::new(&g, &[], &[], &[], exit(), 100).unwrap();
    let mut b = body(0.2, 2., 3.);
    let radius = BodyConfig::default().body_radius;
    let step = b
        .step(&neural(0., 0.), &world, Point { x: -1., z: 1. }, 0.5, 1)
        .unwrap();
    assert!((b.state().pose.position.x - radius).abs() < 2e-9);
    assert!((b.state().pose.position.z - 2.5).abs() < 2e-9);
    let early = step.motion.at(0.1).unwrap().pose.position;
    assert!((early.x - 0.15).abs() < 1e-9);
    assert!((early.z - 2.05).abs() < 1e-9);
    for i in 0..=100 {
        let p = step.motion.at(i as f64 / 100.).unwrap().pose.position;
        assert!(g.contains_body(p, radius));
    }
    // The next wall must be swept after sliding, never joined by a corner-cutting chord.
    let mut b = body(0.2, 3.6, 3.);
    let step = b
        .step(&neural(0., 0.), &world, Point { x: -1., z: 1. }, 0.5, 1)
        .unwrap();
    assert!((b.state().pose.position.x - radius).abs() < 2e-9);
    assert!((b.state().pose.position.z - (4. - radius)).abs() < 2e-9);
    for i in 0..=100 {
        let p = step.motion.at(i as f64 / 100.).unwrap().pose.position;
        assert!(g.contains_body(p, radius));
    }
}

#[test]
fn native_fly_can_land_and_feed_on_the_authored_banana() {
    let g = geometry();
    let banana = FoodDef {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        shape: FoodShape::Banana,
    }
    .surface(7)
    .unwrap();
    let world = BodyWorld::new(&g, &[banana], &[], &[], exit(), 100).unwrap();
    let mut b = Body::new_in_mode(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        reserve_config(3.),
        BodyMode::Flying,
    )
    .unwrap();
    let mut landing = neural(0., 0.);
    landing.groups.push(GroupActivity {
        id: "landingL".into(),
        mean_voltage: 0.,
        spike_fraction: 1.,
    });
    let mut tick = 0;
    while b.state().mode != BodyMode::Walking && tick < 10 {
        tick += 1;
        b.step(&landing, &world, Point::default(), 0.1, tick)
            .unwrap();
    }
    assert_eq!(b.state().support, Some(7));
    assert!((0.02..0.05).contains(&b.state().height));
    assert!(b.contacts(&world).unwrap().food);
    let reserve = b.state().reserve;
    b.step(&neural(0., 1.), &world, Point::default(), 0.1, tick + 1)
        .unwrap();
    assert_eq!(b.state().mode, BodyMode::Feeding);
    assert!(b.state().reserve > reserve);
}

#[test]
fn household_surfaces_support_walking_but_never_feed_even_with_proboscis_spikes() {
    use sim::native_object::NativeObjectShape;
    for (shape, local_x, local_z) in [
        (NativeObjectShape::WornShoes, -0.079, 0.06),
        (NativeObjectShape::DirtyDishes, 0., 0.),
        (NativeObjectShape::Laundry, 0., 0.),
        (NativeObjectShape::SleepingCat, 0., 0.),
        (NativeObjectShape::Fan, 0.09, 0.07),
        (NativeObjectShape::Vinegar, 0., 0.),
    ] {
        let surfaces = shape
            .placed_surfaces(Point { x: 2., z: 2. }, 0., 7)
            .unwrap();
        let world = BodyWorld::new(&geometry(), &[], &surfaces, &[], exit(), 100)
            .unwrap_or_else(|error| panic!("{shape:?} world: {error}"));
        let mut b = Body::new_in_mode(
            BodyPose {
                position: Point {
                    x: 2. + local_x,
                    z: 2. + local_z,
                },
                heading: 0.,
            },
            reserve_config(10.),
            BodyMode::Flying,
        )
        .unwrap();
        let mut landing = neural(0., 1.);
        landing.groups.push(GroupActivity {
            id: "landingL".into(),
            mean_voltage: 0.,
            spike_fraction: 1.,
        });
        for tick in 1..=10 {
            b.step(&landing, &world, Point::default(), 0.1, tick)
                .unwrap_or_else(|error| panic!("{shape:?} landing: {error}"));
            if b.state().mode == BodyMode::Walking {
                break;
            }
        }
        assert!(
            b.state()
                .support
                .is_some_and(|id| surfaces.iter().any(|s| s.id == id)),
            "{shape:?}"
        );
        assert!(
            b.state().height > 0.01,
            "{shape:?} must rest above the floor"
        );
        assert!(!b.contacts(&world).unwrap().food, "{shape:?} is not food");
        let start = b.state().clone();
        b.step(&neural(0.01, 1.), &world, Point::default(), 0.1, 11)
            .unwrap_or_else(|error| panic!("{shape:?} supported walk: {error}"));
        assert_eq!(
            b.state().mode,
            BodyMode::Walking,
            "{shape:?} cannot begin a feeding bout"
        );
        assert_eq!(
            b.state().support,
            start.support,
            "{shape:?} should retain local support"
        );
        assert!(
            (b.state().pose.position.x - start.pose.position.x)
                .hypot(b.state().pose.position.z - start.pose.position.z)
                > 0.0001,
            "{shape:?} must make supported progress"
        );
        assert!(
            b.state().reserve < start.reserve,
            "{shape:?} cannot replenish energy"
        );
        assert!(!b.contacts(&world).unwrap().food);
    }
}

#[test]
fn household_meshes_do_not_block_the_air_above_their_native_height() {
    use sim::native_object::NativeObjectShape;
    for shape in [
        NativeObjectShape::WornShoes,
        NativeObjectShape::DirtyDishes,
        NativeObjectShape::Laundry,
        NativeObjectShape::SleepingCat,
        NativeObjectShape::Fan,
        NativeObjectShape::Vinegar,
    ] {
        let surfaces = shape
            .placed_surfaces(Point { x: 2., z: 2. }, 0., 7)
            .unwrap();
        let world = BodyWorld::new(&geometry(), &[], &surfaces, &[], exit(), 100).unwrap();
        let mut b = Body::new_in_mode(
            BodyPose {
                position: Point { x: 1.5, z: 2. },
                heading: 0.,
            },
            reserve_config(10.),
            BodyMode::Flying,
        )
        .unwrap();
        let mut forward = neural(0., 1.);
        forward.motor.flight_thrust = 1.;
        b.step(&forward, &world, Point::default(), 0.5, 1).unwrap();
        assert!(
            (b.state().pose.position.x - 2.5).abs() < 1e-8,
            "{shape:?} must allow a fly to cross above it"
        );
        assert_eq!(b.state().mode, BodyMode::Flying);
        assert!(b.state().support.is_none());
        assert!(!b.contacts(&world).unwrap().food);
    }
}

#[test]
fn a_timed_round_outlives_starvation_and_ends_at_its_horizon() {
    let g = geometry();
    let horizon = 30;
    let world = BodyWorld::new(&g, &[], &[], &[], exit(), horizon).unwrap();
    let mut timed = Body::new(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        timed_config(),
    )
    .unwrap();
    let mut finite = body(2., 2., 1.);
    let mut starved_at = None;
    for tick in 1..horizon {
        timed
            .step(&neural(0., 0.), &world, Point::default(), 1., tick)
            .unwrap();
        finite
            .step(&neural(0., 0.), &world, Point::default(), 1., tick)
            .unwrap();
        assert_eq!(timed.state().outcome, None, "no clock but the horizon");
        starved_at = starved_at.or(finite.state().outcome.map(|_| tick));
    }
    assert_eq!(finite.state().outcome, Some(TerminalOutcome::Starved));
    assert!(
        starved_at.is_some_and(|tick| tick < horizon / 2),
        "the finite-life body dies long before the horizon"
    );
    let last = timed
        .step(&neural(0., 0.), &world, Point::default(), 1., horizon)
        .unwrap();
    assert_eq!(timed.state().outcome, Some(TerminalOutcome::TimedOut));
    assert!(last.events.iter().any(|e| e.kind
        == BodyEventKind::Terminal {
            outcome: TerminalOutcome::TimedOut
        }));
    assert_eq!(timed.state().reserve, 0., "a timed round models no energy");
}
#[test]
fn a_timed_fly_walks_on_food_without_feeding_or_moving_its_horizon() {
    let g = geometry();
    let apple = FoodDef {
        position: Point { x: 2., z: 2. },
        heading: 0.,
        shape: FoodShape::Apple,
    }
    .surface(7)
    .unwrap();
    let horizon = 20;
    let world = BodyWorld::new(&g, &[apple], &[], &[], exit(), horizon).unwrap();
    let mut b = Body::new_in_mode(
        BodyPose {
            position: Point { x: 2., z: 2. },
            heading: 0.,
        },
        timed_config(),
        BodyMode::Flying,
    )
    .unwrap();
    let mut landing = neural(0., 1.);
    landing.groups.push(GroupActivity {
        id: "landingL".into(),
        mean_voltage: 0.,
        spike_fraction: 1.,
    });
    let mut events = vec![];
    for tick in 1..=horizon {
        events.extend(
            b.step(&landing, &world, Point::default(), 0.1, tick)
                .unwrap()
                .events,
        );
    }
    assert_eq!(b.state().support, Some(7), "food still carries the body");
    assert!(
        (0.07..0.09).contains(&b.state().height),
        "land on fruit, not the floor"
    );
    assert!(
        b.contacts(&world).unwrap().food,
        "walking contact still reaches the taste pathway"
    );
    assert_eq!(b.state().mode, BodyMode::Walking);
    assert!(
        !events.iter().any(|e| matches!(
            e.kind,
            BodyEventKind::FeedingStarted | BodyEventKind::FeedingEnded { .. }
        )),
        "a timed round never starts a bout, however hard the proboscis fires"
    );
    assert_eq!(b.state().reserve, 0., "food cannot extend a timed round");
    assert_eq!(b.state().outcome, Some(TerminalOutcome::TimedOut));
}
#[test]
fn the_life_model_owns_energy_validation_without_an_immortality_loophole() {
    let pose = BodyPose {
        position: Point { x: 2., z: 2. },
        heading: 0.,
    };
    assert!(Body::new(pose, timed_config()).is_ok());
    let model = reserve_config(1.).life.reserve().unwrap();
    for broken in [
        ReserveModel {
            idle_cost: 0.,
            ..model
        },
        ReserveModel {
            walking_cost: 0.,
            ..model
        },
        ReserveModel {
            flying_cost: 0.,
            ..model
        },
        ReserveModel {
            capacity: 0.,
            ..model
        },
        ReserveModel {
            max_bout_seconds: 0.,
            ..model
        },
        ReserveModel {
            initial: model.capacity + 1.,
            ..model
        },
    ] {
        assert!(
            Body::new(
                pose,
                BodyConfig {
                    life: LifeModel::Reserve(broken),
                    ..BodyConfig::default()
                }
            )
            .is_err(),
            "a finite life cannot be made endless from inside its own model"
        );
    }
    assert!(
        Body::new(
            pose,
            BodyConfig {
                takeoff_threshold: 0.,
                ..timed_config()
            }
        )
        .is_err(),
        "a timed round still decodes motor thresholds"
    );
}
/// A timed body that never flaps: whatever it covers came from the air.
fn drifting_body(x: f64, z: f64) -> Body {
    Body::new(
        BodyPose {
            position: Point { x, z },
            heading: 0.,
        },
        timed_config(),
    )
    .unwrap()
}
fn doorway_suction() -> ExitSuction {
    ExitSuction {
        reach: 0.9,
        speed: 0.5,
    }
}
#[test]
fn authored_exit_suction_carries_a_drifting_body_through_either_facing_doorway() {
    for outward_x in [1., -1.] {
        let (g, exit) = room_with_opening(outward_x);
        let helped = BodyWorld::new(&g, &[], &[], &[], exit, 200)
            .unwrap()
            .with_exit_suction(Some(doorway_suction()))
            .unwrap();
        let unhelped = BodyWorld::new(&g, &[], &[], &[], exit, 200).unwrap();
        // Half a metre inside the opening, on the wrong side of it to walk out.
        let start = Point {
            x: 2. + outward_x * 1.5,
            z: 2.,
        };
        let mut pulled = drifting_body(start.x, start.z);
        let mut ticks = 0;
        while pulled.state().outcome.is_none() && ticks < 200 {
            ticks += 1;
            pulled
                .step(&neural(0., 0.), &helped, Point::default(), 0.1, ticks)
                .unwrap();
        }
        assert_eq!(
            pulled.state().outcome,
            Some(TerminalOutcome::Escaped),
            "outward {outward_x}"
        );
        // Help across the last half metre, not a slow drift: about 1.5 seconds.
        assert!(ticks <= 20, "escape took {ticks} ticks outward {outward_x}");
        let mut untouched = drifting_body(start.x, start.z);
        for tick in 1..=ticks {
            untouched
                .step(&neural(0., 0.), &unhelped, Point::default(), 0.1, tick)
                .unwrap();
        }
        assert_eq!(untouched.state().outcome, None);
        assert_eq!(untouched.state().pose.position, start);
    }
}
#[test]
fn exit_suction_stops_at_its_reach_and_never_pulls_through_a_wall() {
    let g = geometry();
    let world = |g: &Geometry| {
        BodyWorld::new(g, &[], &[], &[], exit(), 200)
            .unwrap()
            .with_exit_suction(Some(doorway_suction()))
            .unwrap()
    };
    let drift = |world: &BodyWorld, from: Point| {
        let mut b = drifting_body(from.x, from.z);
        for tick in 1..=10 {
            b.step(&neural(0., 0.), world, Point::default(), 0.1, tick)
                .unwrap();
        }
        b.state().pose.position
    };
    // A metre from the opening is outside the reach, where the air is still.
    let beyond = Point { x: 3., z: 2. };
    assert_eq!(drift(&world(&g), beyond), beyond);
    // Well within the reach, but behind a partition: still nothing.
    let near = Point { x: 3.5, z: 2. };
    let mut partitioned = g.clone();
    partitioned.walls.push(Wall {
        a: Point { x: 3.6, z: 0.5 },
        b: Point { x: 3.6, z: 2.5 },
    });
    assert_eq!(drift(&world(&partitioned), near), near);
    assert!(drift(&world(&g), near).x > near.x);
}
#[test]
fn exit_suction_is_rejected_outside_its_authored_bounds() {
    let g = geometry();
    let world = || BodyWorld::new(&g, &[], &[], &[], exit(), 200).unwrap();
    for rejected in [
        ExitSuction {
            reach: 0.,
            speed: 0.5,
        },
        ExitSuction {
            reach: 2.5,
            speed: 0.5,
        },
        ExitSuction {
            reach: 0.9,
            speed: 1.5,
        },
        ExitSuction {
            reach: f64::NAN,
            speed: 0.5,
        },
    ] {
        assert!(world().with_exit_suction(Some(rejected)).is_err());
    }
    assert!(world().with_exit_suction(Some(doorway_suction())).is_ok());
    assert!(world().with_exit_suction(None).is_ok());
}

#[test]
fn exit_suction_does_not_reach_into_an_adjacent_open_room() {
    let mut g = geometry();
    g.rooms = vec![
        RectRoom {
            id: 1,
            min: Point { x: 0., z: 0. },
            max: Point { x: 3.6, z: 4. },
        },
        RectRoom {
            id: 2,
            min: Point { x: 3.6, z: 0. },
            max: Point { x: 4., z: 4. },
        },
    ];
    let world = BodyWorld::new(&g, &[], &[], &[], exit(), 200)
        .unwrap()
        .with_exit_suction(Some(doorway_suction()))
        .unwrap();
    let mut outside_room = drifting_body(3.5, 2.);
    let mut inside_room = drifting_body(3.8, 2.);
    for tick in 1..=20 {
        outside_room
            .step(&neural(0., 0.), &world, Point::default(), 0.1, tick)
            .unwrap();
        inside_room
            .step(&neural(0., 0.), &world, Point::default(), 0.1, tick)
            .unwrap();
    }
    assert_eq!(outside_room.state().pose.position, Point { x: 3.5, z: 2. });
    assert_eq!(outside_room.state().outcome, None);
    assert_eq!(inside_room.state().outcome, Some(TerminalOutcome::Escaped));
}
