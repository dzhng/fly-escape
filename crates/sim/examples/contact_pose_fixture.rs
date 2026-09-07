//! Fixed geometry and core-computed support poses for the model workbench, not an attempt.
use parry3d_f64::shape::Ball;
use sim::surface::{support_rotation, ContactScene, ContactSurface};
fn main() {
    let (vertices, triangles) = Ball::new(0.04).to_trimesh(32, 16);
    let surface = ContactSurface {
        id: 7,
        vertices: vertices
            .into_iter()
            .map(|v| [v.x, v.y + 0.04, v.z])
            .collect(),
        triangles,
    };
    let scene = ContactScene::new(std::slice::from_ref(&surface)).unwrap();
    let cases: Vec<_> = [-0.03, -0.015, 0., 0.015, 0.03]
        .into_iter()
        .map(|x| {
            let support = scene.below([x, 0.2, 0.], 0.4).unwrap().unwrap();
            let rotation = support_rotation(std::f64::consts::FRAC_PI_2, support.normal).unwrap();
            serde_json::json!({"support":support,"rotation":rotation})
        })
        .collect();
    println!("{}", serde_json::json!({"surface":surface,"cases":cases}));
}
