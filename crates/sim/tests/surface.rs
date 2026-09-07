use parry3d_f64::shape::Ball;
use sim::surface::{ContactHull, ContactScene, ContactSurface};

fn floor(id: u32, y: f64) -> ContactSurface {
    ContactSurface {
        id,
        vertices: vec![[-1., y, -1.], [1., y, -1.], [1., y, 1.], [-1., y, 1.]],
        triangles: vec![[0, 2, 1], [0, 3, 2]],
    }
}
fn hull() -> ContactHull {
    let mut points = vec![];
    for x in [-0.001, 0.001] {
        for y in [0., 0.0018] {
            for z in [-0.0015, 0.0015] {
                points.push([x, y, z]);
            }
        }
    }
    ContactHull::new(&points).unwrap()
}
fn apple(id: u32) -> ContactSurface {
    let (vertices, triangles) = Ball::new(0.04).to_trimesh(32, 16);
    ContactSurface {
        id,
        vertices: vertices
            .into_iter()
            .map(|v| [v.x, v.y + 0.04, v.z])
            .collect(),
        triangles,
    }
}
fn near(a: f64, b: f64) {
    assert!((a - b).abs() < 1e-8, "{a} != {b}");
}

#[test]
fn first_contact_keeps_world_identity_and_native_support_pivot() {
    let scene = ContactScene::new(&[floor(9, 0.), floor(4, 0.05), floor(2, 0.05)]).unwrap();
    let hit = scene
        .cast(&hull(), [0., 0.2, 0.], 0., [0., 1., 0.], [0., -0.4, 0.])
        .unwrap()
        .unwrap();
    assert_eq!(hit.surface_id, 2);
    near(hit.fraction, 0.375);
    near(hit.point[1], 0.05);
    near(hit.normal[1], 1.);
    let reversed = ContactScene::new(&[floor(2, 0.05), floor(4, 0.05), floor(9, 0.)]).unwrap();
    assert_eq!(
        scene.below([0., 0.2, 0.], 0.4).unwrap(),
        reversed.below([0., 0.2, 0.], 0.4).unwrap()
    );
    assert!(scene.below([2., 0.2, 0.], 0.4).unwrap().is_none());
    assert!(scene
        .cast(&hull(), [0., 0.2, 0.], 0., [0., 1., 0.], [0., 0.2, 0.])
        .unwrap()
        .is_none());
}

#[test]
fn curved_contact_allows_departure_and_does_not_tunnel_at_fly_scale() {
    let scene = ContactScene::new(&[floor(8, 0.), apple(2)]).unwrap();
    let hull = hull();
    for x in [-0.03, -0.015, 0., 0.015, 0.03] {
        let start = [x, 0.2, 0.];
        let displacement = [0., -0.4, 0.];
        let hit = scene
            .cast(&hull, start, 0., [0., 1., 0.], displacement)
            .unwrap()
            .unwrap();
        assert_eq!(hit.surface_id, 2);
        assert!(hit.fraction > 0. && hit.fraction < 0.5);
        assert!(hit.normal[1] > 0.5);
        let root = [x, start[1] + displacement[1] * hit.fraction, 0.];
        assert!(
            scene
                .cast(&hull, root, 0., [0., 1., 0.], [0., 0.2, 0.])
                .unwrap()
                .is_none(),
            "departure at {x}"
        );
        for _ in 0..10 {
            assert_eq!(
                scene
                    .cast(&hull, start, 0., [0., 1., 0.], displacement)
                    .unwrap(),
                Some(hit)
            );
        }
        let repeat = scene
            .cast(&hull, [x, 0.15, 0.], 0., [0., 1., 0.], [0., -0.35, 0.])
            .unwrap()
            .unwrap();
        near(0.15 - 0.35 * repeat.fraction, root[1]);
    }
    let top = scene.below([0., 0.2, 0.], 0.4).unwrap().unwrap();
    assert_eq!(top.surface_id, 2);
    near(top.point[1], 0.08);
    assert_eq!(
        scene
            .below([0.1, 0.2, 0.], 0.4)
            .unwrap()
            .unwrap()
            .surface_id,
        8
    );
}

#[test]
fn surface_normal_orients_the_native_pivot_without_an_added_height_offset() {
    let mut plane = floor(1, 0.);
    for p in &mut plane.vertices {
        p[1] = -0.75 * p[0];
    }
    let scene = ContactScene::new(&[plane]).unwrap();
    let hull = hull();
    let support = scene.below([0., 0.2, 0.], 0.4).unwrap().unwrap();
    near(support.point[1], 0.);
    near(support.normal[0], 0.6);
    near(support.normal[1], 0.8);
    let hit = scene
        .cast(&hull, [0., 0.2, 0.], 0., support.normal, [0., -0.4, 0.])
        .unwrap()
        .unwrap();
    near(0.2 - 0.4 * hit.fraction, 0.);
    assert!(scene
        .cast(&hull, [0., 0., 0.], 0., support.normal, [0., 0.2, 0.])
        .unwrap()
        .is_none());
}

#[test]
fn malformed_contact_inputs_fail_before_querying() {
    assert!(ContactHull::new(&[[0., 0., 0.]; 4]).is_err());
    assert!(ContactHull::new(&[[0., 0., 0.], [1., 0., 0.], [0., 0., 1.], [1., 0., 1.]]).is_err());
    assert!(ContactScene::new(&[floor(1, 0.), floor(1, 1.)]).is_err());
    let mut invalid = floor(1, 0.);
    invalid.triangles[0][0] = 10;
    assert!(ContactScene::new(&[invalid]).is_err());
    let mut invalid = floor(1, 0.);
    invalid.vertices[0][0] = f64::NAN;
    assert!(ContactScene::new(&[invalid]).is_err());
    let mut invalid = floor(1, 0.);
    invalid.triangles[0] = [0, 0, 0];
    assert!(ContactScene::new(&[invalid]).is_err());
    let scene = ContactScene::new(&[floor(1, 0.)]).unwrap();
    let hull = hull();
    assert!(scene.cast(&hull, [0.; 3], 0., [0.; 3], [0.; 3]).is_err());
    assert!(scene
        .cast(&hull, [0.; 3], 0., [0., -1., 0.], [0.; 3])
        .is_err());
    assert!(scene
        .cast(&hull, [0.; 3], f64::NAN, [0., 1., 0.], [0.; 3])
        .is_err());
    assert!(scene
        .cast(&hull, [0.; 3], 0., [1., 1e-30, 0.], [0.; 3])
        .is_err());
    assert!(scene.below([0.; 3], 0.).is_err());
    assert!(scene.below([f64::NAN; 3], 1.).is_err());
}
