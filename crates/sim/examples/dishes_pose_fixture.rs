use sim::surface::{ContactHull, ContactScene};
use sim::{environment::Point, native_object::NativeObjectShape};
fn main() {
    let surfaces = NativeObjectShape::DirtyDishes
        .placed_surfaces(Point { x: 0., z: 0. }, 0., 1)
        .unwrap();
    let shape: serde_json::Value =
        serde_json::from_str(include_str!("../../../assets/fly/contact-hull.json")).unwrap();
    let vertices: Vec<[f64; 3]> = serde_json::from_value(shape["vertices"].clone()).unwrap();
    let hull = ContactHull::new(&vertices).unwrap();
    let scene = ContactScene::new(&surfaces).unwrap();
    let cases: Vec<_> = [
        [-0.02, 0.08],
        [0.0, 0.10],
        [0.0, 0.125],
        [0.0, 0.133],
        [0.0, 0.136],
    ]
    .into_iter()
    .map(|[x, z]| {
        let hit = scene.below([x, 0.3, z], 0.6).unwrap().unwrap();
        let normal = hit.normal;
        scene
            .support_at(&hull, hit.surface_id, [x, z], std::f64::consts::PI, normal)
            .unwrap()
            .unwrap()
    })
    .collect();
    let bowl_upright: Vec<_> = [[-0.02, 0.], [0., 0.], [0.02, 0.]]
        .into_iter()
        .map(|[x, z]| {
            let hit = scene.below([x, 0.3, z], 0.6).unwrap().unwrap();
            scene
                .support_at(&hull, hit.surface_id, [x, z], 0., [0., 1., 0.])
                .unwrap()
                .unwrap()
        })
        .collect();
    println!(
        "{}",
        serde_json::json!({"cases":cases,"bowlUpright":bowl_upright})
    );
}
