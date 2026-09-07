use super::*;
use crate::{GroupActivity, MotorOutput};
#[test]
fn numerical_producer_handles_actual_requests() {
    let geometry = Geometry {
        rooms: vec![crate::environment::RectRoom {
            id: 1,
            min: Point { x: -1., z: -1. },
            max: Point { x: 1., z: 1. },
        }],
        walls: vec![],
        solids: vec![],
    };
    let apple: ContactSurface =
        serde_json::from_str(include_str!("../../../../assets/food/apple/contact.json")).unwrap();
    let boundary: crate::surface::ContactBoundary = serde_json::from_str(include_str!(
        "../../../../assets/fly/contact-envelope-candidate.json"
    ))
    .unwrap();
    let mut world = BodyWorld::new(
        &geometry,
        std::slice::from_ref(&apple),
        &[],
        &[],
        ExitOpening {
            a: Point { x: 1., z: -0.1 },
            b: Point { x: 1., z: 0.1 },
            outward: Point { x: 1., z: 0. },
        },
        100,
    )
    .unwrap();
    world.hull = Box::leak(Box::new(ContactHull::from_boundary(boundary).unwrap()));
    for (name, heading, thrust, turn, aligned) in [
        ("upright-seam-turn", 0.70408, 0., 0.0002, false),
        ("upright-ordinary-turn", 0.70408, 0., 0.2, false),
        ("upright-walk-turn", 0.70408, 0.02, 0.2, false),
        ("aligned-idle", 0.70408, 0., 0., true),
        ("aligned-turn", 0.70408, 0., 0.2, true),
        ("aligned-walk", 0.70408, 0.02, 0., true),
    ] {
        let mut up = [0., 1., 0.];
        if aligned {
            up = world
                .surfaces
                .below([0.02, 0.2, -0.003], 0.4)
                .unwrap()
                .unwrap()
                .normal;
        }
        let sample = world
            .surfaces
            .support_at(world.hull, apple.id, [0.02, -0.003], heading, up)
            .unwrap()
            .unwrap();
        let pose = BodyPose {
            position: Point { x: 0.02, z: -0.003 },
            heading,
        };
        let mut body = Body::new(pose, 10., BodyConfig::default()).unwrap();
        body.state.height = sample.root[1];
        body.state.rotation = sample.rotation;
        body.state.support = Some(apple.id);
        let neural = StepOutput {
            motor: MotorOutput {
                thrust,
                turn,
                flight_thrust: 0.,
                flight_turn: 0.,
            },
            groups: Vec::<GroupActivity>::new(),
            spike_count: 0,
        };
        let result = body.step(&neural, &world, Point::default(), 0.1, 1);
        assert!(result.is_ok(), "{name}: {result:?}");
    }
}

#[test]
fn closed_food_containment_is_not_mistaken_for_surface_separation() {
    let apple: ContactSurface =
        serde_json::from_str(include_str!("../../../../assets/food/apple/contact.json")).unwrap();
    let scene = crate::surface::ContactScene::new(&[apple]).unwrap();
    let hull = native_hull().unwrap();
    let q = support_rotation(0., [0., 1., 0.]).unwrap();
    assert!(scene
        .penetration(hull, [0., 0.04, 0.], q)
        .unwrap_err()
        .contains("inside closed food"));
    let open = ContactSurface {
        id: 0,
        vertices: vec![[-1., 0.08, -1.], [1., 0.08, -1.], [0., 0.08, 1.]],
        triangles: vec![[0, 1, 2]],
    };
    assert_eq!(
        crate::surface::ContactScene::new(&[open])
            .unwrap()
            .penetration(hull, [0., 0.04, 0.], q)
            .unwrap(),
        0.
    );
}

#[test]
fn motion_requests_advance_within_budget() {
    let geometry = Geometry {
        rooms: vec![crate::environment::RectRoom {
            id: 1,
            min: Point { x: -1., z: -1. },
            max: Point { x: 1., z: 1. },
        }],
        walls: vec![],
        solids: vec![],
    };
    let apple: ContactSurface =
        serde_json::from_str(include_str!("../../../../assets/food/apple/contact.json")).unwrap();
    let boundary: crate::surface::ContactBoundary = serde_json::from_str(include_str!(
        "../../../../assets/fly/contact-envelope-candidate.json"
    ))
    .unwrap();
    let mut world = BodyWorld::new(
        &geometry,
        std::slice::from_ref(&apple),
        &[],
        &[],
        ExitOpening {
            a: Point { x: 1., z: -0.1 },
            b: Point { x: 1., z: 0.1 },
            outward: Point { x: 1., z: 0. },
        },
        100,
    )
    .unwrap();
    let candidate = Box::leak(Box::new(ContactHull::from_boundary(boundary).unwrap()));

    for candidate_enabled in [false, true] {
        world.hull = if candidate_enabled {
            candidate
        } else {
            native_hull().unwrap()
        };

        let crate::placement::ToolEffect::Fan { speed, .. } =
            crate::placement::tool_def(crate::placement::ToolKind::Fan).effect
        else {
            panic!("fan catalog entry must resolve to wind");
        };
        // Experimental hull comparisons use a fixed load; production covers the actual catalog wind.
        let fan_speed = if candidate_enabled { 0.5 } else { speed };

        for (name, heading, thrust, turn, aligned, wind, center) in [
            ("upright-wind6mm", 0.70408, 0., 0., false, 0.064, false),
            ("upright-fan", 0.70408, 0., 0., false, fan_speed, false),
            ("aligned-fan", 0.70408, 0., 0., true, fan_speed, false),
            ("center-fan", 0., 0., 0., false, fan_speed, true),
            ("center-aligned-fan", 0., 0., 0., true, fan_speed, true),
            ("max-neural", 0., 2., 0., false, 0., true),
        ] {
            let (x, z) = if center { (0., 0.) } else { (0.02, -0.003) };
            let mut up = [0., 1., 0.];
            if aligned {
                up = world
                    .surfaces
                    .below([x, 0.2, z], 0.4)
                    .unwrap()
                    .unwrap()
                    .normal;
            }
            let sample = world
                .surfaces
                .support_at(world.hull, apple.id, [x, z], heading, up)
                .unwrap()
                .unwrap();
            let pose = BodyPose {
                position: Point { x, z },
                heading,
            };
            let mut body = Body::new(pose, 10., BodyConfig::default()).unwrap();
            body.state.height = sample.root[1];
            body.state.rotation = sample.rotation;
            body.state.support = Some(apple.id);
            let neural = StepOutput {
                motor: MotorOutput {
                    thrust,
                    turn,
                    flight_thrust: 0.,
                    flight_turn: 0.,
                },
                groups: Vec::<GroupActivity>::new(),
                spike_count: 0,
            };
            if aligned {
                for i in 1..=12 {
                    let previous = body.state.rotation;
                    let mut idle = neural.clone();
                    idle.motor.thrust = 0.;
                    idle.motor.turn = 0.;
                    body.step(&idle, &world, Point::default(), 0.1, i).unwrap();
                    if previous
                        .iter()
                        .zip(body.state.rotation)
                        .all(|(a, b)| (a - b).abs() < 1e-12)
                    {
                        break;
                    }
                }
            }
            let result = body
                .step(&neural, &world, Point { x: wind, z: 0. }, 0.1, 20)
                .unwrap_or_else(|e| panic!("{name} candidate={candidate_enabled}: {e}"));
            assert!(result.motion.queries <= 512);
            assert!(result.motion.points.len() <= 129);
            assert!(
                body.state.pose.position.x > x,
                "request must advance rather than freeze on contact"
            );
            for pair in result.motion.points.windows(2) {
                for t in [
                    pair[0].fraction,
                    (pair[0].fraction + pair[1].fraction) * 0.5,
                    pair[1].fraction,
                ] {
                    let p = result.motion.at(t).unwrap();
                    assert!(
                        world
                            .surfaces
                            .penetration(
                                world.hull,
                                [p.pose.position.x, p.height, p.pose.position.z],
                                p.rotation
                            )
                            .unwrap()
                            <= 3e-6
                    );
                }
            }
        }
    }
}

#[test]
fn native_shoe_rim_blocks_supported_motion_without_aborting_the_tick() {
    // Production second-house seed 18065457143613761157, fly 9, tick 141.
    let state = BodyState {
        height: 0.11172231836479321,
        mode: BodyMode::Walking,
        outcome: None,
        pose: BodyPose {
            heading: 2.8234335720516226,
            position: Point {
                x: 2.6755426166459073,
                z: 6.711418810252831,
            },
        },
        reserve: 9.800000000000102,
        rotation: [
            0.03067463703697428,
            -0.5850770845133865,
            0.03628180674069793,
            0.8095847715462514,
        ],
        support: Some(25),
    };
    let objects = crate::native_object::NativeObjectShape::WornShoes
        .placed_surfaces(Point { x: 2.6, z: 6.7 }, 0.8, 2)
        .unwrap();
    let geometry = Geometry {
        rooms: vec![crate::environment::RectRoom {
            id: 1,
            min: Point { x: 0., z: 0. },
            max: Point { x: 10., z: 10. },
        }],
        walls: vec![],
        solids: vec![],
    };
    let world = BodyWorld::new(
        &geometry,
        &[],
        &objects,
        &[],
        ExitOpening {
            a: Point { x: 10., z: 1. },
            b: Point { x: 10., z: 2. },
            outward: Point { x: 1., z: 0. },
        },
        1000,
    )
    .unwrap();
    let desired = desired_pose(
        state.pose,
        Locomotion {
            thrust: 0.6814009710002883,
            turn: 0.02024135047684794,
            speed: 0.12,
            turn_gain: 8.,
        },
        Point::default(),
        0.1,
    );
    let trace = motion::advance(&world, &state, desired, 0.1, 0.002632).unwrap();
    assert_eq!(trace.points.first().unwrap().fraction, 0.);
    assert_eq!(trace.end().fraction, 1.);
    let tail = &trace.points[trace.points.len() - 2];
    assert_eq!(
        tail.pose,
        trace.end().pose,
        "blocked remainder holds its last verified pose"
    );
    assert_eq!(tail.rotation, trace.end().rotation);
    assert!(tail.fraction > 0. && tail.fraction < 1.);
    assert!(
        tail.pose.position.distance(state.pose.position) > 0.001,
        "retain the verified approach instead of freezing the whole request"
    );
    assert_eq!(trace.end().support, state.support);
    assert!(
        trace.end().pose.position.distance(desired.position) > 1e-5,
        "blocked motion cannot claim to reach its request"
    );
    for i in 0..=100 {
        let p = trace.at(i as f64 / 100.).unwrap();
        assert!(
            world
                .surfaces
                .neighbor_penetration(
                    world.hull,
                    [p.pose.position.x, p.height, p.pose.position.z],
                    p.rotation,
                    state.support.unwrap()
                )
                .unwrap()
                <= 3e-6
        );
    }
    // The collision result is local to this request, not a permanently stuck body.
    let mut airborne = state.clone();
    trace.end().apply(&mut airborne);
    airborne.mode = BodyMode::Flying;
    let takeoff = motion::advance(&world, &airborne, airborne.pose, 0.1, 0.002632).unwrap();
    assert!(takeoff.end().height > airborne.height);
    assert!(takeoff.end().support.is_none());

    // This was the rejected penetrative candidate, not a valid collision-stop pose.
    let mut invalid = state.clone();
    invalid.pose = BodyPose {
        position: Point {
            x: 2.668859341094733,
            z: 6.713500595041672,
        },
        heading: 2.8372961345630845,
    };
    invalid.height = 0.11020450435284063;
    invalid.rotation = [
        0.08686251057183285,
        -0.5842617566230327,
        0.09497281409803214,
        0.8012947451389076,
    ];
    assert!(
        motion::advance(&world, &invalid, invalid.pose, 0.1, 0.002632).is_err(),
        "an invalid initial penetration remains an error"
    );
}

#[test]
fn free_rotation_cannot_push_a_blocked_fly_into_neighboring_shoe_mesh() {
    let state: BodyState = serde_json::from_str(r#"{"height":0.08816780470482011,"mode":"flying","outcome":null,"pose":{"heading":4.591304066780186,"position":{"x":1.2578663807494694,"z":3.456808803950721}},"reserve":5.800000000000106,"rotation":[0.025199154720995532,0.9975620655081161,-0.022595059457293367,-0.0610277916088221],"support":null}"#).unwrap();
    let desired: BodyPose = serde_json::from_str(
        r#"{"heading":4.564267411386064,"position":{"x":1.253090143632047,"z":3.424799585182792}}"#,
    )
    .unwrap();
    let objects = crate::native_object::NativeObjectShape::WornShoes
        .placed_surfaces(Point { x: 1.2, z: 3.4 }, 0.6, 2)
        .unwrap();
    let geometry = Geometry {
        rooms: vec![crate::environment::RectRoom {
            id: 1,
            min: Point { x: 0., z: 0. },
            max: Point { x: 10., z: 10. },
        }],
        walls: vec![],
        solids: vec![],
    };
    let world = BodyWorld::new(
        &geometry,
        &[],
        &objects,
        &[],
        ExitOpening {
            a: Point { x: 10., z: 1. },
            b: Point { x: 10., z: 2. },
            outward: Point { x: 1., z: 0. },
        },
        1000,
    )
    .unwrap();
    let depth = |p: &MotionPoint| {
        world
            .surfaces
            .penetration(
                world.hull,
                [p.pose.position.x, p.height, p.pose.position.z],
                p.rotation,
            )
            .unwrap()
    };
    let trace = motion::advance(&world, &state, desired, 0.1, 0.002632).unwrap();
    assert!(depth(&trace.points[0]) <= 3e-6);
    assert!(trace.rotation_blocked);
    assert_eq!(trace.end().rotation, state.rotation);
    assert_eq!(trace.end().pose.heading, state.pose.heading);
    assert_eq!(trace.end().fraction, 1.);
    for i in 0..=100 {
        let p = trace.at(i as f64 / 100.).unwrap();
        assert!(
            depth(&p) <= 3e-6,
            "free rotation produced penetration {}",
            depth(&p)
        );
    }
    assert!(
        trace.end().pose.position.distance(desired.position) > 0.01,
        "the shoe blocks the requested movement"
    );
    // The next captured failure had a blocked turn but a penetrative translation hit.
    let state: BodyState=serde_json::from_str(r#"{"height":0.08816214699472592,"mode":"flying","outcome":null,"pose":{"heading":4.588282400211157,"position":{"x":1.2578666725763556,"z":3.4568113204200213}},"reserve":5.8800000000001065,"rotation":[0.02523324670468137,0.997468774177808,-0.022556982145555512,-0.06253407357150904],"support":null}"#).unwrap();
    let desired: BodyPose=serde_json::from_str(r#"{"heading":4.594124730896361,"position":{"x":1.2538818289756446,"z":3.423274149579663}}"#).unwrap();
    let trace = motion::advance(&world, &state, desired, 0.1, 0.002632).unwrap();
    assert_eq!(
        trace.end().pose,
        state.pose,
        "blocked candidate retains the verified pose"
    );
    assert_eq!(trace.end().rotation, state.rotation);
    for i in 0..=100 {
        assert!(depth(&trace.at(i as f64 / 100.).unwrap()) <= 3e-6);
    }
}

#[test]
fn free_space_turns_remain_available_and_zero_time_landing_records_support() {
    let geometry = Geometry {
        rooms: vec![crate::environment::RectRoom {
            id: 1,
            min: Point { x: 0., z: 0. },
            max: Point { x: 4., z: 4. },
        }],
        walls: vec![],
        solids: vec![],
    };
    let objects = crate::native_object::NativeObjectShape::Apple
        .placed_surfaces(Point { x: 2., z: 2. }, 0., 5)
        .unwrap();
    let world = BodyWorld::new(
        &geometry,
        &objects,
        &[],
        &[],
        ExitOpening {
            a: Point { x: 4., z: 1. },
            b: Point { x: 4., z: 3. },
            outward: Point { x: 1., z: 0. },
        },
        100,
    )
    .unwrap();
    let mut state = Body::new_in_mode(
        BodyPose {
            position: Point { x: 1., z: 1. },
            heading: 0.,
        },
        10.,
        BodyConfig::default(),
        BodyMode::Flying,
    )
    .unwrap()
    .state;
    let trace = motion::advance(
        &world,
        &state,
        BodyPose {
            position: Point { x: 1.1, z: 1. },
            heading: 0.2,
        },
        0.1,
        0.002632,
    )
    .unwrap();
    assert!(!trace.rotation_blocked);
    assert!((trace.end().pose.heading - 0.2).abs() < 1e-12);
    assert!((trace.end().pose.position.x - 1.1).abs() < 1e-12);
    let support = world
        .surfaces
        .support_at(world.hull, 5, [2., 2.], 0., [0., 1., 0.])
        .unwrap()
        .unwrap();
    state.pose = BodyPose {
        position: Point { x: 2., z: 2. },
        heading: 0.,
    };
    // One nanometre inside the contact precision makes acquisition exactly zero-time.
    state.height = support.root[1] - 1e-9;
    state.rotation = support.rotation;
    state.mode = BodyMode::Landing;
    state.support = None;
    let trace = motion::advance(&world, &state, state.pose, 0.1, 0.002632).unwrap();
    assert_eq!(trace.points[0].support, Some(5));
    assert_eq!(trace.end().support, Some(5));
    assert!(trace
        .points
        .windows(2)
        .all(|p| p[0].fraction < p[1].fraction));
}

#[test]
fn descending_shoe_rim_contact_keeps_a_verified_prefix() {
    let state: BodyState = serde_json::from_str(r#"{"height":0.14999999999999958,"mode":"landing","outcome":null,"pose":{"heading":5.304068424713702,"position":{"x":2.709540733051919,"z":6.6953914094828}},"reserve":15.760000000000085,"rotation":[0.0,0.9565576643169392,0.0,0.2915431954900029],"support":null}"#).unwrap();
    let desired: BodyPose = serde_json::from_str(r#"{"heading":5.225575491531906,"position":{"x":2.7256588747519683,"z":6.666790309504627}}"#).unwrap();
    let objects = crate::native_object::NativeObjectShape::WornShoes
        .placed_surfaces(Point { x: 2.6, z: 6.7 }, 0.8, 2)
        .unwrap();
    let geometry = Geometry {
        rooms: vec![crate::environment::RectRoom {
            id: 1,
            min: Point { x: 0., z: 0. },
            max: Point { x: 10., z: 10. },
        }],
        walls: vec![],
        solids: vec![],
    };
    let world = BodyWorld::new(
        &geometry,
        &[],
        &objects,
        &[],
        ExitOpening {
            a: Point { x: 10., z: 1. },
            b: Point { x: 10., z: 2. },
            outward: Point { x: 1., z: 0. },
        },
        1000,
    )
    .unwrap();
    let trace = motion::advance(&world, &state, desired, 0.1, 0.002632).unwrap();
    assert_eq!(trace.end().fraction, 1.);
    assert!(trace.end().pose.position.distance(desired.position) > 0.01);
    let held = &trace.points[trace.points.len() - 2];
    assert!(held.fraction > 0.27 && held.fraction < 0.28);
    assert_eq!(held.pose, trace.end().pose);
    assert_eq!(held.height, trace.end().height);
    assert_eq!(held.rotation, trace.end().rotation);
    for pair in trace.points.windows(2) {
        for i in 0..=100 {
            let t = pair[0].fraction + (pair[1].fraction - pair[0].fraction) * i as f64 / 100.;
            let p = trace.at(t).unwrap();
            let depth = world
                .surfaces
                .penetration(
                    world.hull,
                    [p.pose.position.x, p.height, p.pose.position.z],
                    p.rotation,
                )
                .unwrap();
            assert!(depth <= 3e-6, "rim motion penetrates by {depth} at {t}");
        }
    }
}
