use super::*;
use crate::{native_object::NativeObjectShape, GroupActivity, MotorOutput};

fn surfaces() -> Vec<ContactSurface> {
    NativeObjectShape::BugZapper
        .placed_surfaces(Point { x: 2., z: 2. }, 0., 10)
        .unwrap()
}
fn world(hazard: bool) -> BodyWorld {
    object_world(surfaces(), hazard.then_some(ContactHazardKind::Zapper))
}
fn object_world(objects: Vec<ContactSurface>, hazard: Option<ContactHazardKind>) -> BodyWorld {
    let world = BodyWorld::new(
        &Geometry {
            rooms: vec![crate::environment::RectRoom {
                id: 1,
                min: Point { x: 0., z: 0. },
                max: Point { x: 4., z: 4. },
            }],
            walls: vec![],
            solids: vec![],
        },
        &[],
        &objects,
        &[],
        ExitOpening {
            a: Point { x: 4., z: 1. },
            b: Point { x: 4., z: 3. },
            outward: Point { x: 1., z: 0. },
        },
        100,
    )
    .unwrap();
    if let Some(kind) = hazard {
        world
            .with_contact_hazards(
                &objects
                    .iter()
                    .map(|s| ContactHazard {
                        surface_id: s.id,
                        kind,
                    })
                    .collect::<Vec<_>>(),
            )
            .unwrap()
    } else {
        world
    }
}
fn neural() -> StepOutput {
    StepOutput {
        motor: MotorOutput {
            thrust: 1.,
            turn: 0.,
            flight_thrust: 1.,
            flight_turn: 0.,
        },
        groups: vec![GroupActivity {
            id: "proboscis".into(),
            mean_voltage: 0.,
            spike_fraction: 1.,
        }],
        spike_count: 0,
    }
}
fn fly(mode: BodyMode, z: f64) -> Body {
    Body::new_in_mode(
        BodyPose {
            position: Point { x: 1.5, z },
            heading: 0.,
        },
        10.,
        BodyConfig::default(),
        mode,
    )
    .unwrap()
}
#[test]
fn native_zapper_stops_walking_and_flight_at_the_cast_contact_time() {
    let world = world(true);
    for mode in [BodyMode::Walking, BodyMode::Flying] {
        let mut body = fly(mode, 2.);
        let mut input = neural();
        if mode == BodyMode::Walking {
            input.motor.flight_thrust = 0.;
        }
        let step = body.step(&input, &world, Point::default(), 0.5, 1).unwrap();
        assert_eq!(body.state.outcome, Some(TerminalOutcome::Zapped));
        let (time, _) = step
            .motion
            .contact_hazard
            .expect("native cast reports the actual hazard impact");
        assert!(time > 0. && time < 1.);
        assert!((1.84..1.86).contains(&body.state.pose.position.x));
        let speed = if mode == BodyMode::Walking {
            body.config.walk_speed
        } else {
            body.config.flight_speed
        };
        assert!((time - (body.state.pose.position.x - 1.5) / (speed * 0.5)).abs() < 1e-8);
        assert_eq!(step.motion.at(time).unwrap().pose, step.motion.end().pose);
        assert!(!body.contacts(&world).unwrap().food);
        let state = body.state.clone();
        body.step(&neural(), &world, Point::default(), 0.5, 2)
            .unwrap();
        assert_eq!(body.state, state, "terminal bodies remain frozen");
    }
}
#[test]
fn native_zapper_leaves_overflight_and_lateral_misses_safe() {
    let world = world(true);
    // Normal flight targets 0.6 m, below this tall appliance. Query an above-top
    // hull path directly to pin finite-height collision without changing flight policy.
    assert!(world
        .surfaces
        .cast(world.hull, [1.5, 0.8, 2.], 0., [0., 1., 0.], [1., 0., 0.])
        .unwrap()
        .is_none());
    let mut high = fly(BodyMode::Flying, 2.);
    high.state.pose.position.x = 2.;
    high.state.height = 0.8;
    assert!(high.contacts(&world).unwrap().contact_hazard.is_none());

    for (mode, z, height) in [(BodyMode::Flying, 2.12, 0.6), (BodyMode::Walking, 2.18, 0.)] {
        let mut body = fly(mode, z);
        body.state.height = height;
        let mut input = neural();
        if mode == BodyMode::Walking {
            input.motor.flight_thrust = 0.;
        }
        let dt = if mode == BodyMode::Walking { 1. } else { 0.5 };
        let step = body.step(&input, &world, Point::default(), dt, 1).unwrap();
        assert!(body.state.outcome.is_none());
        assert!(body.state.pose.position.x > 2.4);
        assert!(step.motion.contact_hazard.is_none());
        assert!(body.contacts(&world).unwrap().contact_hazard != Some(ContactHazardKind::Zapper));
    }
}
#[test]
fn native_zapper_initial_contact_and_acquired_support_cannot_feed() {
    let safe = world(false);
    let hazard = world(true);
    // First stop on the identical non-hazard mesh; enabling its role must catch initial contact.
    let mut body = fly(BodyMode::Flying, 2.);
    body.step(&neural(), &safe, Point::default(), 0.5, 1)
        .unwrap();
    assert!(body.state.outcome.is_none());
    assert!(body.contacts(&hazard).unwrap().contact_hazard == Some(ContactHazardKind::Zapper));
    let pose = body.state.pose;
    body.step(&neural(), &hazard, Point::default(), 0.1, 2)
        .unwrap();
    assert_eq!(body.state.outcome, Some(TerminalOutcome::Zapped));
    assert_eq!(body.state.pose, pose);
    // Land on the actual base beside the tall housing, then turn on its hazard role.
    let mut body = fly(BodyMode::Flying, 2.125);
    body.state.pose.position.x = 2.;
    let mut landing = neural();
    landing.motor.flight_thrust = 0.;
    landing.motor.thrust = 0.;
    landing.groups.push(GroupActivity {
        id: "landingL".into(),
        mean_voltage: 0.,
        spike_fraction: 1.,
    });
    for tick in 1..=10 {
        body.step(&landing, &safe, Point::default(), 0.1, tick)
            .unwrap();
        if body.state.support.is_some() {
            break;
        }
    }
    assert!(body.state.support.is_some());
    assert!(!body.contacts(&safe).unwrap().food);
    body.step(&landing, &hazard, Point::default(), 0.1, 11)
        .unwrap();
    assert_eq!(body.state.outcome, Some(TerminalOutcome::Zapped));
    // The same landing with the role already present terminates at acquisition.
    let mut body = fly(BodyMode::Flying, 2.125);
    body.state.pose.position.x = 2.;
    for tick in 1..=10 {
        body.step(&landing, &hazard, Point::default(), 0.1, tick)
            .unwrap();
        if body.state.outcome.is_some() {
            break;
        }
    }
    assert_eq!(body.state.outcome, Some(TerminalOutcome::Zapped));
}
#[test]
fn hazard_roles_reject_missing_edible_and_duplicate_surface_ids() {
    let role = |id| ContactHazard {
        surface_id: id,
        kind: ContactHazardKind::Zapper,
    };
    assert!(world(false).with_contact_hazards(&[role(999)]).is_err());
    assert!(world(false)
        .with_contact_hazards(&[role(10), role(10)])
        .is_err());
    let mut world = world(false);
    world.edible_ids.insert(10);
    assert!(world.with_contact_hazards(&[role(10)]).is_err());
}

#[test]
fn starvation_before_native_impact_keeps_the_earlier_terminal_time() {
    let mut body = fly(BodyMode::Walking, 2.);
    body.state.reserve = 0.01;
    let mut input = neural();
    input.motor.flight_thrust = 0.;
    let step = body
        .step(&input, &world(true), Point::default(), 0.5, 1)
        .unwrap();
    assert_eq!(body.state.outcome, Some(TerminalOutcome::Starved));
    assert!((body.state.pose.position.x - 1.525).abs() < 1e-8);
    assert!(
        step.motion.contact_hazard.is_none(),
        "the later impact was never reached"
    );
}

fn web_world(hazard: bool) -> BodyWorld {
    let objects = NativeObjectShape::SpiderWeb
        .placed_surfaces(Point { x: 2., z: 2. }, 0., 10)
        .unwrap();
    assert_eq!(objects.len(), 22);
    object_world(objects, hazard.then_some(ContactHazardKind::Web))
}
fn web_fly(mode: BodyMode, x: f64, height: f64) -> Body {
    let mut body = fly(mode, 1.85);
    body.state.pose.position.x = x;
    body.state.pose.heading = std::f64::consts::FRAC_PI_2;
    body.state.rotation =
        crate::surface::support_rotation(body.state.pose.heading, [0., 1., 0.]).unwrap();
    body.state.height = height;
    body
}
#[test]
fn native_web_strands_catch_walk_and_flight_at_actual_contact_time() {
    let world = web_world(true);
    for (mode, x, height) in [
        (BodyMode::Walking, 2., 0.),
        (BodyMode::Flying, 2.18, 0.242825),
    ] {
        let mut body = web_fly(mode, x, height);
        let mut input = neural();
        if mode == BodyMode::Walking {
            input.motor.flight_thrust = 0.;
        }
        let step = body.step(&input, &world, Point::default(), 0.5, 1).unwrap();
        assert_eq!(body.state.outcome, Some(TerminalOutcome::Caught));
        let (time, kind) = step.motion.contact_hazard.unwrap();
        assert_eq!(kind, ContactHazardKind::Web);
        assert!(time > 0. && time < 1.);
        let speed = if mode == BodyMode::Walking {
            body.config.walk_speed
        } else {
            body.config.flight_speed
        };
        assert!((time - (body.state.pose.position.z - 1.85) / (speed * 0.5)).abs() < 1e-8);
        assert!(!body.contacts(&world).unwrap().food);
        assert!(body.contacts(&world).unwrap().contact_hazard != Some(ContactHazardKind::Zapper));
    }
}
#[test]
fn native_web_empty_gap_and_overflight_remain_passable() {
    let world = web_world(true);
    // First path crosses between visible rings inside the web outline.
    // The other paths pass above the top strand and beside the web.
    for (x, height) in [(2.18, 0.4), (2., 0.6), (2.4, 0.3)] {
        let mut body = web_fly(BodyMode::Flying, x, height);
        let step = body
            .step(&neural(), &world, Point::default(), 0.5, 1)
            .unwrap();
        assert!(body.state.outcome.is_none());
        assert!(body.state.pose.position.z > 2.5);
        assert!(step.motion.contact_hazard.is_none());
    }
}
#[test]
fn native_web_initial_contact_catches_without_feeding() {
    let mut body = web_fly(BodyMode::Flying, 2.18, 0.242825);
    body.step(&neural(), &web_world(false), Point::default(), 0.5, 1)
        .unwrap();
    let world = web_world(true);
    let contacts = body.contacts(&world).unwrap();
    assert_eq!(contacts.contact_hazard, Some(ContactHazardKind::Web));
    assert!(!contacts.food && contacts.contact_hazard != Some(ContactHazardKind::Zapper));
    let pose = body.state.pose;
    body.step(&neural(), &world, Point::default(), 0.1, 2)
        .unwrap();
    assert_eq!(body.state.outcome, Some(TerminalOutcome::Caught));
    assert_eq!(body.state.pose, pose);
}
