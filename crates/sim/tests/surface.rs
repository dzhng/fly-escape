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

#[test]
fn authored_apple_has_closed_outward_geometry_and_queryable_metres() {
    use std::collections::BTreeMap;
    let apple: ContactSurface =
        serde_json::from_str(include_str!("../../../assets/food/apple/contact.json")).unwrap();
    let mut edges = BTreeMap::new();
    let mut volume = 0.;
    for face in &apple.triangles {
        for (a, b) in [(face[0], face[1]), (face[1], face[2]), (face[2], face[0])] {
            *edges.entry((a, b)).or_insert(0) += 1;
        }
        let [a, b, c] = face.map(|i| apple.vertices[i as usize]);
        volume += (a[0] * (b[1] * c[2] - b[2] * c[1])
            + a[1] * (b[2] * c[0] - b[0] * c[2])
            + a[2] * (b[0] * c[1] - b[1] * c[0]))
            / 6.;
    }
    for ((a, b), count) in &edges {
        assert_eq!(*count, 1, "non-manifold edge");
        assert_eq!(edges.get(&(*b, *a)), Some(&1), "open or reversed face");
    }
    assert!(volume > 0., "inward triangle winding");
    assert!(apple.vertices.iter().all(|p| p[1] >= 0.));
    // Broad anatomical bounds catch unit/axis errors without pinning the art's silhouette.
    let height = apple.vertices.iter().map(|p| p[1]).fold(0., f64::max);
    assert!((0.05..0.1).contains(&height));
    let scene = ContactScene::new(&[apple, floor(8, 0.)]).unwrap();
    let hull = hull();
    for x in [-0.03, -0.015, 0., 0.015, 0.03] {
        let ray = scene.below([x, 0.2, 0.], 0.4).unwrap().unwrap();
        assert_eq!(ray.surface_id, 0);
        assert!(ray.normal[1] > 0.5);
        let hit = scene
            .cast(&hull, [x, 0.2, 0.], 0., [0., 1., 0.], [0., -0.4, 0.])
            .unwrap()
            .unwrap();
        assert_eq!(hit.surface_id, 0);
        let root = [x, 0.2 - hit.fraction * 0.4, 0.];
        assert!(root[1] >= ray.point[1] - 1e-8);
        assert!(
            scene
                .cast(&hull, root, 0., [0., 1., 0.], [0., 0.2, 0.])
                .unwrap()
                .is_none(),
            "apple departure at {x}"
        );
    }
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
fn exported_float_vertices_survive_the_core_json_boundary_exactly() {
    let coordinate: f64 = serde_json::from_str("-0.0019336363766342402").unwrap();
    assert_eq!(coordinate, f64::from(f32::from_bits(0xbafd7212)));
    let surface: ContactSurface =
        serde_json::from_str(include_str!("../../../assets/food/apple/contact.json")).unwrap();
    let restored: ContactSurface =
        serde_json::from_str(&serde_json::to_string(&surface).unwrap()).unwrap();
    assert_eq!(surface.vertices, restored.vertices);
    assert_eq!(surface.triangles, restored.triangles);
}

#[test]
fn native_hull_fragment_can_slide_tangent_to_a_surface() {
    // Four native vertices minimize the measured flat-floor GJK obstruction.
    let points: [[f64; 3]; 4] = [
        [
            -0.0013943874510005116,
            -1.288413542521738e-10,
            0.0010241027921438217,
        ],
        [
            -0.0014229806838557124,
            0.00023601131397299469,
            0.0012870709178969264,
        ],
        [
            -0.00118330679833889,
            0.0030070545617491007,
            -0.0008651657262817025,
        ],
        [
            -0.001153554068878293,
            0.003025132231414318,
            -0.0008651657844893634,
        ],
    ];
    let hull = ContactHull::new(&points).unwrap();
    let scene = ContactScene::new(&[floor(0, 0.)]).unwrap();
    let height = -points.iter().map(|p| p[1]).fold(f64::INFINITY, f64::min);
    assert!(scene
        .cast(&hull, [0., height, 0.], 0., [0., 1., 0.], [0.001, 0., 0.])
        .unwrap()
        .is_none());
}

#[test]
fn tangent_motion_still_hits_another_face_in_the_same_mesh() {
    let mut surface = floor(7, 0.);
    surface.vertices.extend([
        [0.001, 0., -0.1],
        [0.001, 0.1, -0.1],
        [0.001, 0.1, 0.1],
        [0.001, 0., 0.1],
    ]);
    surface.triangles.extend([[4, 5, 6], [4, 6, 7]]);
    for reversed in [false, true] {
        if reversed {
            for triangle in &mut surface.triangles {
                triangle.swap(0, 2);
            }
        }
        let scene = ContactScene::new(std::slice::from_ref(&surface)).unwrap();
        let hit = scene
            .cast(&hull(), [-0.005, 0., 0.], 0., [0., 1., 0.], [0.01, 0., 0.])
            .unwrap()
            .unwrap();
        assert_eq!(hit.surface_id, 7);
        near(hit.fraction, 0.45);
        near(hit.point[0], 0.001);
        near(hit.normal[0], -1.);
    }
}

#[test]
fn supported_translation_is_not_tied_to_horizontal_world_axes() {
    let mut surface = floor(2, 0.);
    for vertex in &mut surface.vertices {
        vertex[1] = -0.75 * vertex[0];
    }
    let scene = ContactScene::new(&[surface]).unwrap();
    let hull = hull();
    let up = [0.6, 0.8, 0.];
    for heading in [0., 0.7, 2.4] {
        let landing = scene
            .cast(&hull, [0., 0.1, 0.], heading, up, [0., -0.2, 0.])
            .unwrap()
            .unwrap();
        let root = [0., 0.1 - 0.2 * landing.fraction, 0.];
        for delta in [
            [0.0008, -0.0006, 0.],
            [-0.0008, 0.0006, 0.],
            [0., 0., 0.001],
        ] {
            assert!(
                scene
                    .cast(&hull, root, heading, up, delta)
                    .unwrap()
                    .is_none(),
                "{heading}: {delta:?}"
            );
        }
        assert!(scene
            .cast(&hull, root, heading, up, [-0.0006, -0.0008, 0.])
            .unwrap()
            .is_some());
    }
}

#[test]
fn support_sampling_preserves_the_root_instead_of_snapping_to_the_witness() {
    let mut slope = floor(12, 0.);
    for p in &mut slope.vertices {
        p[1] = -0.75 * p[0];
    }
    let scene = ContactScene::new(&[slope, floor(2, -0.5)]).unwrap();
    let hull = hull();
    let upright = scene
        .support_at(&hull, 12, [0., 0.], 0., [0., 1., 0.])
        .unwrap()
        .unwrap();
    assert_eq!(upright.surface_id, 12);
    near(upright.root[0], 0.);
    near(upright.root[1], 0.001125);
    near(upright.root[2], 0.);
    assert!((upright.point[0] - upright.root[0]).abs() > 0.001);
    let aligned = scene
        .support_at(&hull, 12, [0., 0.], 0., [0.6, 0.8, 0.])
        .unwrap()
        .unwrap();
    near(aligned.root[1], 0.);
    assert_eq!(
        aligned.rotation,
        sim::surface::support_rotation(0., [0.6, 0.8, 0.]).unwrap()
    );
    assert!(scene
        .support_at(&hull, 12, [2., 0.], 0., [0., 1., 0.])
        .unwrap()
        .is_none());
    assert!(scene
        .support_at(&hull, 99, [0., 0.], 0., [0., 1., 0.])
        .is_err());
}

#[test]
fn support_sampling_uses_surface_bounds_and_rejects_invalid_pose_inputs() {
    let scene = ContactScene::new(&[floor(7, 500.)]).unwrap();
    let hull = hull();
    let sample = scene
        .support_at(&hull, 7, [0.1, -0.2], 0.4, [0., 1., 0.])
        .unwrap()
        .unwrap();
    near(sample.root[0], 0.1);
    near(sample.root[1], 500.);
    near(sample.root[2], -0.2);
    for position in [[f64::NAN, 0.], [0., f64::INFINITY]] {
        assert!(scene
            .support_at(&hull, 7, position, 0., [0., 1., 0.])
            .is_err());
    }
    assert!(scene
        .support_at(&hull, 7, [0., 0.], f64::NAN, [0., 1., 0.])
        .is_err());
    assert!(scene
        .support_at(&hull, 7, [0., 0.], 0., [0., -1., 0.])
        .is_err());
}
