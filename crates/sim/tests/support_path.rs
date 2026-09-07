use sim::surface::{
    ContactBoundary, ContactHull, ContactScene, ContactSurface, FixedSupportRequest,
    SupportPathBudget, SupportPathError, SupportPathStop,
};
fn hull() -> ContactHull {
    let boundary: ContactBoundary = serde_json::from_str(include_str!(
        "../../../assets/fly/contact-envelope-candidate.json"
    ))
    .unwrap();
    ContactHull::from_boundary(boundary).unwrap()
}
fn budget() -> SupportPathBudget {
    SupportPathBudget {
        work: 2_000_000,
        items: 16_384,
    }
}
fn patch(id: u32, lo: f64, hi: f64, y: f64) -> ContactSurface {
    ContactSurface {
        id,
        vertices: vec![[lo, y, -0.1], [hi, y, -0.1], [hi, y, 0.1], [lo, y, 0.1]],
        triangles: vec![[0, 2, 1], [0, 3, 2]],
    }
}
fn request(
    scene: &ContactScene,
    hull: &ContactHull,
    id: u32,
    position: [f64; 2],
    delta: [f64; 2],
    heading: f64,
    up: [f64; 3],
) -> FixedSupportRequest {
    FixedSupportRequest {
        surface_id: id,
        start_root: scene
            .support_at(hull, id, position, heading, up)
            .unwrap()
            .unwrap()
            .root,
        displacement: delta,
        heading,
        up,
    }
}
#[test]
fn authored_apple_paths_match_core_support_and_preserve_the_supplied_start() {
    let apple: ContactSurface =
        serde_json::from_str(include_str!("../../../assets/food/apple/contact.json")).unwrap();
    let boundary: ContactBoundary = serde_json::from_str(include_str!(
        "../../../assets/fly/contact-envelope-candidate.json"
    ))
    .unwrap();
    let physical = parry3d_f64::shape::ConvexPolyhedron::from_convex_hull(
        &boundary
            .vertices
            .iter()
            .map(|p| parry3d_f64::math::Vector::from_array(*p) * 1000.)
            .collect::<Vec<_>>(),
    )
    .unwrap();
    let mesh = parry3d_f64::shape::TriMesh::with_flags(
        apple
            .vertices
            .iter()
            .map(|p| parry3d_f64::math::Vector::from_array(*p) * 1000.)
            .collect(),
        apple.triangles.clone(),
        parry3d_f64::shape::TriMeshFlags::empty(),
    )
    .unwrap();
    let id = apple.id;
    let scene = ContactScene::new(&[apple]).unwrap();
    let hull = hull();
    for (heading, tilt) in [(0., 0.0_f64), (1.5, 0.), (0., 0.7), (1.5, 0.7)] {
        let up = [tilt, (1. - tilt * tilt).sqrt(), 0.];
        let input = request(&scene, &hull, id, [0.020, -0.003], [0., 0.006], heading, up);
        let path = scene.fixed_support_path(&hull, input, budget()).unwrap();
        assert_eq!(path.stop, SupportPathStop::End, "{heading}/{tilt} {path:?}");
        assert_eq!(path.segments.first().unwrap().from_root, input.start_root);
        assert_eq!(path.segments.last().unwrap().to_fraction, 1.);
        for segment in &path.segments {
            for i in 0..=16 {
                let t = i as f64 / 16.;
                let point = std::array::from_fn::<_, 3, _>(|j| {
                    segment.from_root[j] + (segment.to_root[j] - segment.from_root[j]) * t
                });
                let pose = parry3d_f64::math::Pose {
                    translation: parry3d_f64::math::Vector::from_array(point) * 1000.,
                    rotation: parry3d_f64::math::Rotation::from_array(path.rotation),
                };
                let contact = parry3d_f64::query::contact(
                    &pose,
                    &physical,
                    &parry3d_f64::math::Pose::IDENTITY,
                    &mesh,
                    1e-5,
                )
                .unwrap()
                .unwrap();
                assert!(contact.dist.abs() < 1e-5, "static contact {contact:?}");
                let expected = scene
                    .support_at(&hull, id, [point[0], point[2]], heading, up)
                    .unwrap()
                    .unwrap();
                assert!(
                    (point[1] - expected.root[1]).abs() < 1e-8,
                    "{point:?} != {:?}",
                    expected.root
                );
            }
        }
        assert!(path.work.operations <= budget().work);
        assert!(path.work.peak_items <= budget().items);
        eprintln!(
            "orientation {heading}/{tilt}: {} segments, {:?}",
            path.segments.len(),
            path.work
        );
    }
}
#[test]
fn flat_seams_are_continuous_but_a_different_height_branch_stops() {
    let hull = hull();
    let flat = patch(1, -0.1, 0.1, 0.);
    let scene = ContactScene::new(std::slice::from_ref(&flat)).unwrap();
    let input = request(&scene, &hull, 1, [-0.02, 0.], [0.04, 0.], 0., [0., 1., 0.]);
    let path = scene.fixed_support_path(&hull, input, budget()).unwrap();
    assert_eq!(path.stop, SupportPathStop::End);
    for segment in &path.segments {
        assert!((segment.to_root[1] - input.start_root[1]).abs() < 1e-8);
    }
    let mut stepped = flat;
    let higher = patch(1, 0., 0.1, 0.02);
    stepped.vertices.extend(higher.vertices);
    stepped
        .triangles
        .extend(higher.triangles.into_iter().map(|t| t.map(|i| i + 4)));
    let scene = ContactScene::new(&[stepped]).unwrap();
    let path = scene.fixed_support_path(&hull, input, budget()).unwrap();
    assert_eq!(path.stop, SupportPathStop::Discontinuity);
    assert!(path.segments.last().unwrap().to_root[0] < 0.);
    assert!(path.segments.iter().all(|s| s.to_root[1].abs() < 1e-8));
}

#[test]
fn gaps_stop_the_prefix_without_connecting_disconnected_patches() {
    let mut surface = patch(1, -0.05, 0., 0.);
    let second = patch(1, 0.02, 0.05, 0.);
    surface.vertices.extend(second.vertices);
    surface
        .triangles
        .extend(second.triangles.into_iter().map(|t| t.map(|i| i + 4)));
    let scene = ContactScene::new(&[surface]).unwrap();
    let hull = hull();
    let input = request(&scene, &hull, 1, [-0.02, 0.], [0.06, 0.], 0., [0., 1., 0.]);
    let path = scene.fixed_support_path(&hull, input, budget()).unwrap();
    assert_eq!(path.stop, SupportPathStop::Gap);
    let last = path.segments.last().unwrap();
    assert!(last.to_root[0] < 0.005);
    assert!(last.to_fraction < 1.);
}
#[test]
fn other_food_blocks_without_transferring_support() {
    let scene = ContactScene::new(&[patch(1, -0.1, 0.1, 0.), patch(2, 0., 0.05, 0.001)]).unwrap();
    let hull = hull();
    let input = request(&scene, &hull, 1, [-0.02, 0.], [0.04, 0.], 0., [0., 1., 0.]);
    let path = scene.fixed_support_path(&hull, input, budget()).unwrap();
    assert_eq!(path.stop, SupportPathStop::OtherSurface(2));
    assert_eq!(path.surface_id, 1);
    assert!(path.segments.last().unwrap().to_fraction < 0.6);
    let touching = FixedSupportRequest {
        start_root: path.segments.last().unwrap().to_root,
        displacement: [0.01, 0.],
        ..input
    };
    let stopped = scene.fixed_support_path(&hull, touching, budget()).unwrap();
    assert_eq!(stopped.stop, SupportPathStop::OtherSurface(2));
    assert!(stopped
        .segments
        .iter()
        .all(|s| s.to_fraction > s.from_fraction));
    let overlapping = request(&scene, &hull, 1, [0.01, 0.], [-0.03, 0.], 0., [0., 1., 0.]);
    let path = scene
        .fixed_support_path(&hull, overlapping, budget())
        .unwrap();
    assert_eq!(path.stop, SupportPathStop::OtherSurface(2));
    assert!(path.segments.is_empty());
}
#[test]
fn start_mismatch_point_only_hull_and_exhaustion_are_explicit() {
    let scene = ContactScene::new(&[patch(1, -0.1, 0.1, 0.)]).unwrap();
    let hull = hull();
    let input = request(&scene, &hull, 1, [-0.02, 0.], [0.04, 0.], 0., [0., 1., 0.]);
    let mut wrong = input;
    wrong.start_root[1] += 0.001;
    assert!(matches!(
        scene.fixed_support_path(&hull, wrong, budget()),
        Err(SupportPathError::Invalid(_))
    ));
    assert!(matches!(
        scene.fixed_support_path(
            &hull,
            input,
            SupportPathBudget {
                work: 1,
                items: 16_384
            }
        ),
        Err(SupportPathError::Exhausted(_))
    ));
    assert!(matches!(
        scene.fixed_support_path(
            &hull,
            input,
            SupportPathBudget {
                work: 2_000_000,
                items: 1
            }
        ),
        Err(SupportPathError::Exhausted(_))
    ));
    let boundary: ContactBoundary = serde_json::from_str(include_str!(
        "../../../assets/fly/contact-envelope-candidate.json"
    ))
    .unwrap();
    let point_only = ContactHull::new(&boundary.vertices).unwrap();
    assert!(matches!(
        scene.fixed_support_path(&point_only, input, budget()),
        Err(SupportPathError::Invalid(_))
    ));
}

#[test]
fn a_root_supported_inside_authored_closed_food_is_blocked() {
    let hull = hull();
    for (source, height, position) in [
        (
            include_str!("../../../assets/food/apple/contact.json"),
            0.04,
            [0., 0.],
        ),
        (
            include_str!("../../../assets/food/banana/contact.json"),
            0.02,
            [0., -0.02],
        ),
    ] {
        let mut food: ContactSurface = serde_json::from_str(source).unwrap();
        food.id = 2;
        let scene = ContactScene::new(&[patch(1, -0.1, 0.1, height), food]).unwrap();
        let input = request(&scene, &hull, 1, position, [0.001, 0.], 0., [0., 1., 0.]);
        let path = scene.fixed_support_path(&hull, input, budget()).unwrap();
        assert_eq!(path.stop, SupportPathStop::OtherSurface(2));
        assert!(path.segments.is_empty());
    }
}

#[test]
fn open_patches_are_not_volumes_and_closed_winding_is_validated() {
    let scene = ContactScene::new(&[patch(1, -0.1, 0.1, 0.), patch(2, -0.1, 0.1, 0.01)]).unwrap();
    let hull = hull();
    let input = request(&scene, &hull, 1, [0., 0.], [0.001, 0.], 0., [0., 1., 0.]);
    assert_eq!(
        scene
            .fixed_support_path(&hull, input, budget())
            .unwrap()
            .stop,
        SupportPathStop::End
    );
    let mut apple: ContactSurface =
        serde_json::from_str(include_str!("../../../assets/food/apple/contact.json")).unwrap();
    for triangle in &mut apple.triangles {
        triangle.swap(0, 1);
    }
    assert!(ContactScene::new(std::slice::from_ref(&apple)).is_err());
    apple.triangles[0].swap(0, 1);
    assert!(ContactScene::new(&[apple]).is_err());
}

#[test]
fn disconnected_closed_food_and_nonmanifold_edges_are_rejected() {
    let mut apple: ContactSurface =
        serde_json::from_str(include_str!("../../../assets/food/apple/contact.json")).unwrap();
    let offset = apple.vertices.len() as u32;
    let second = apple.clone();
    apple.vertices.extend(
        second
            .vertices
            .into_iter()
            .map(|p| [0.2 + p[0] * 0.5, p[1] * 0.5, p[2] * 0.5]),
    );
    apple.triangles.extend(
        second
            .triangles
            .into_iter()
            .map(|t| [t[1] + offset, t[0] + offset, t[2] + offset]),
    );
    assert!(ContactScene::new(&[apple]).is_err());
    let mut surface = patch(1, -0.1, 0.1, 0.);
    surface.triangles.push(surface.triangles[0]);
    assert!(ContactScene::new(&[surface]).is_err());
}

#[test]
fn a_closed_component_cannot_be_hidden_by_an_open_component() {
    let original: ContactSurface =
        serde_json::from_str(include_str!("../../../assets/food/apple/contact.json")).unwrap();
    for shared_vertex in [false, true] {
        let mut apple = original.clone();
        let offset = apple.vertices.len() as u32;
        apple
            .vertices
            .extend([[0.2, 0.2, 0.], [0.3, 0.2, 0.], [0.2, 0.3, 0.]]);
        apple.triangles.push([
            if shared_vertex { 0 } else { offset },
            offset + 1,
            offset + 2,
        ]);
        assert!(ContactScene::new(&[apple]).is_err());
    }
}

#[test]
fn touching_wall_inward_motion_does_not_emit_a_zero_width_segment() {
    let boundary: ContactBoundary = serde_json::from_str(include_str!(
        "../../../assets/fly/contact-envelope-candidate.json"
    ))
    .unwrap();
    let hull = ContactHull::from_boundary(boundary.clone()).unwrap();
    let rotation = parry3d_f64::math::Rotation::from_array(
        sim::surface::support_rotation(0., [0., 1., 0.]).unwrap(),
    );
    let x = boundary
        .vertices
        .iter()
        .map(|p| (rotation * (parry3d_f64::math::Vector::from_array(*p) * 1000.)).x)
        .fold(f64::NEG_INFINITY, f64::max)
        / 1000.;
    let wall = ContactSurface {
        id: 2,
        vertices: vec![
            [x, -0.1, -0.1],
            [x, 0.1, -0.1],
            [x, 0.1, 0.1],
            [x, -0.1, 0.1],
        ],
        triangles: vec![[0, 1, 2], [0, 2, 3]],
    };
    let scene = ContactScene::new(&[patch(1, -0.1, 0.1, 0.), wall]).unwrap();
    let input = request(&scene, &hull, 1, [0., 0.], [0.001, 0.], 0., [0., 1., 0.]);
    let path = scene.fixed_support_path(&hull, input, budget()).unwrap();
    assert_eq!(path.stop, SupportPathStop::OtherSurface(2));
    assert!(path.segments.is_empty(), "{:?}", path.segments);
}
