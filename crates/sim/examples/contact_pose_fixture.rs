//! Fixed native hull support poses for the model workbench, not an attempt.
use sim::surface::{ContactHull, ContactScene, ContactSurface};
fn main() {
    let surface: ContactSurface =
        serde_json::from_str(include_str!("../../../assets/food/apple/contact.json")).unwrap();
    let shape: serde_json::Value =
        serde_json::from_str(include_str!("../../../assets/fly/contact-hull.json")).unwrap();
    let vertices: Vec<[f64; 3]> = serde_json::from_value(shape["vertices"].clone()).unwrap();
    let hull = ContactHull::new(&vertices).unwrap();
    let scene = ContactScene::new(std::slice::from_ref(&surface)).unwrap();
    let cases: Vec<_> = [-0.03, -0.015, 0., 0.015, 0.03]
        .into_iter()
        .map(|x| {
            let normal = scene.below([x, 0.2, 0.], 0.4).unwrap().unwrap().normal;
            let pose = |up| {
                scene
                    .support_at(&hull, surface.id, [x, 0.], std::f64::consts::FRAC_PI_2, up)
                    .unwrap()
                    .unwrap()
            };
            serde_json::json!({"upright":pose([0., 1., 0.]),"supported":pose(normal)})
        })
        .collect();
    println!("{}", serde_json::json!({"surface":surface,"cases":cases}));
}
