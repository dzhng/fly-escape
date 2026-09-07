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
        ExitOpening {
            a: Point { x: 1., z: -0.1 },
            b: Point { x: 1., z: 0.1 },
            outward: Point { x: 1., z: 0. },
        },
        100,
    )
    .unwrap();
    world.hull = Box::leak(Box::new(ContactHull::from_boundary(boundary).unwrap()));
    let mut rows = vec![];
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
                .food
                .below([0.02, 0.2, -0.003], 0.4)
                .unwrap()
                .unwrap()
                .normal;
        }
        let sample = world
            .food
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
        let started = std::time::Instant::now();
        let result = body.step(&neural, &world, Point::default(), 0.1, 1);
        assert!(result.is_ok(), "{name}: {result:?}");
        rows.push(serde_json::json!({"name":name,"result":result.as_ref().map(|_|()).map_err(|e|e.as_str()),"knots":result.as_ref().map(|s|s.motion.points.len()).ok(),"elapsedMs":started.elapsed().as_secs_f64()*1000.,"state":body.state()}));
    }
    std::fs::write(
        "/tmp/fly-numerical-body-results.json",
        serde_json::to_vec_pretty(&rows).unwrap(),
    )
    .unwrap();
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
