use sim::{
    environment::Point,
    food::{FoodDef, FoodShape},
    surface::ContactScene,
};

#[test]
fn edible_contact_uses_actual_transformed_surface_not_a_planar_or_solid_volume() {
    let definition = FoodDef {
        position: Point { x: 2., z: 3. },
        heading: 0.7,
        shape: FoodShape::Apple,
    };
    let apple = definition.surface(42).unwrap();
    let scene = ContactScene::new(std::slice::from_ref(&apple)).unwrap();
    let top = scene.below([2., 0.2, 3.], 0.4).unwrap().unwrap();
    assert_eq!(top.surface_id, 42);
    assert!((0.07..0.09).contains(&top.point[1]));
    assert_eq!(scene.touching(top.point, 1e-6).unwrap(), Some(42));
    assert_eq!(
        scene.touching([2., 0.04, 3.], 0.001).unwrap(),
        None,
        "inside fruit is not its edible surface"
    );
    assert_eq!(
        scene.touching([2., 0., 3.45], 0.08).unwrap(),
        None,
        "legacy planar overlap must not imply taste"
    );
    let local = FoodDef {
        position: Point::default(),
        heading: 0.,
        shape: FoodShape::Apple,
    }
    .surface(0)
    .unwrap();
    for (a, b) in local.vertices.iter().zip(&apple.vertices) {
        assert_eq!(a[1], b[1]);
        let distance = (b[0] - 2.).hypot(b[2] - 3.);
        assert!((distance - a[0].hypot(a[2])).abs() < 1e-15);
    }
}

#[test]
fn floor_patches_share_the_surface_query_and_stable_contact_identity() {
    let patch = FoodDef {
        position: Point { x: 1., z: 2. },
        heading: 0.,
        shape: FoodShape::Patch { radius: 0.5 },
    }
    .surface(4)
    .unwrap();
    let mut other = patch.clone();
    other.id = 2;
    let scene = ContactScene::new(&[patch, other]).unwrap();
    assert_eq!(scene.touching([1., 0., 2.], 0.002).unwrap(), Some(2));
    assert_eq!(scene.touching([1., 0.01, 2.], 0.002).unwrap(), None);
    assert_eq!(scene.touching([1.51, 0., 2.], 0.002).unwrap(), None);
    let support = scene.below([1., 0.1, 2.], 0.2).unwrap().unwrap();
    assert_eq!(support.surface_id, 2);
    assert_eq!(support.normal, [0., 1., 0.]);
    assert!(scene.touching([1., 0., 2.], -1.).is_err());
    assert!(scene.touching([f64::NAN, 0., 2.], 0.002).is_err());
}
